import { randomUUID } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { clinicConfigurationSchema } from '@dripwell/shared/v2';
import type { ClinicActor } from './auth';
import { getDb } from './db';
import { ApiError } from './errors';
import { TRANSCRIPTION_MODEL, SUMMARY_PROMPT_VERSION } from './ai';
import { performRecordingUpload, adoptRecordingUpload } from './recording-uploads';
import { assertRecordingPathNotDetached, recordingDatabaseTime } from './recording-deletion-intents';
import { assertRecordingProcessing, recordingProcessingTransaction, type RecordingProcessingSnapshot } from './recording-processing';
import { performSetupRecordingUpload } from './setup-recording-uploads';

export const MAX_UPLOAD_BYTES = 3_500_000;
export function parseRecordingInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new ApiError(
      400,
      'Recording or setup details are invalid. Refresh and try again.',
      'VALIDATION_ERROR',
    );
  return parsed.data;
}
const AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
]);
const MENU_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
]);

export function requirePrivateStorage() {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new ApiError(
      503,
      'Private file storage is not configured.',
      'PRIVATE_STORAGE_UNAVAILABLE',
    );
}

export async function validateSetupLocation(actor: ClinicActor, locationId: string) {
  if (actor.role !== 'SUPER_USER')
    throw new ApiError(403, 'Clinic owner access is required.', 'OWNER_REQUIRED');
  const location = await getDb().location.findFirst({
    where: {
      id: locationId,
      tenantId: actor.tenantId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!location) throw new ApiError(404, 'This location is not available.', 'LOCATION_NOT_FOUND');
  return location.id;
}

export function validateUpload(file: File, purpose: 'audio' | 'catalog') {
  const mimeType = file.type.split(';')[0]!.toLowerCase();
  if (!file.size || file.size > MAX_UPLOAD_BYTES)
    throw new ApiError(
      413,
      'Upload a file under 3.5 MB. Record short segments for longer consultations.',
      'UPLOAD_TOO_LARGE',
    );
  if (!(purpose === 'audio' ? AUDIO_TYPES : MENU_TYPES).has(mimeType))
    throw new ApiError(415, 'This file type is not supported.', 'UNSUPPORTED_FILE_TYPE');
  return mimeType;
}

type PrivateGetIO = (url: string, options: { access: 'private'; useCache: false; token: string; abortSignal: AbortSignal }) => Promise<{
  statusCode: number; blob: { url: string; pathname: string; etag: string; size: number | null }; stream: ReadableStream<Uint8Array> | null;
} | null>;

export async function readPrivateRecording(snapshot: RecordingProcessingSnapshot, getPrivate: PrivateGetIO = get) {
  requirePrivateStorage();
  const token = process.env.BLOB_READ_WRITE_TOKEN!;
  // Full URL/pathname in SDK metadata echo our request; the trusted store and
  // exact returned ETag/size/body checks carry object validation, not that echo.
  const tokenStoreId = token.split('_')[3];
  if (!token.startsWith('vercel_blob_rw_') || !tokenStoreId
    || !/^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/.test(tokenStoreId)
    || tokenStoreId.toLowerCase() !== snapshot.object.storeId)
    throw new ApiError(409, 'The selected private store does not match this recording.', 'RECORDING_OBJECT_IDENTITY_INVALID');
  const expectedBytes = await recordingProcessingTransaction(async tx => {
    const current = await assertRecordingProcessing(tx, snapshot);
    const row = current.rows.find(r => r.id === snapshot.object.recordingId)!;
    if (!Number.isSafeInteger(row.bytes) || row.bytes <= 0 || row.bytes > MAX_UPLOAD_BYTES)
      throw new ApiError(413, 'Stored file failed size validation.', 'STORED_FILE_INVALID');
    return row.bytes;
  });
  const result = await getPrivate(snapshot.object.objectUrl, { access: 'private', useCache: false, token,
    abortSignal: AbortSignal.timeout(45_000) });
  if (!result || result.statusCode !== 200 || !result.stream)
    throw new ApiError(410, 'This recording is no longer available.', 'RECORDING_UNAVAILABLE');
  if (result.blob.url !== snapshot.object.objectUrl || result.blob.pathname !== snapshot.object.blobPath
    || result.blob.etag !== snapshot.object.etag || result.blob.size !== expectedBytes) {
    void result.stream.cancel().catch(() => {});
    throw new ApiError(409, 'Stored file identity or size changed.', 'STORED_FILE_INVALID');
  }
  const reader = result.stream.getReader();
  const bytes = new Uint8Array(expectedBytes);
  let received = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (received + part.value.byteLength > expectedBytes) {
        await reader.cancel();
        throw new ApiError(413, 'Stored file exceeds its recorded size.', 'STORED_FILE_INVALID');
      }
      bytes.set(part.value, received); received += part.value.byteLength;
    }
  } finally { reader.releaseLock(); }
  if (received !== expectedBytes) throw new ApiError(400, 'Stored file is incomplete.', 'STORED_FILE_INVALID');
  await recordingProcessingTransaction(tx => assertRecordingProcessing(tx, snapshot));
  return bytes;
}

export async function receiveConsultationRecording(actor: ClinicActor, data: FormData) {
  requirePrivateStorage();
  const consultationId = parseRecordingInput(
    z.string().uuid(),
    data.get('consultationId') ?? data.get('encounterId'),
  );
  const segmentKey = parseRecordingInput(z.string().uuid(), data.get('segmentId'));
  const sequence = parseRecordingInput(
    z.coerce.number().int().min(0).max(10000),
    parseRecordingInput(z.string().min(1), data.get('sequence')),
  );
  const duration = data.get('durationMs');
  const durationSeconds =
    duration == null
      ? undefined
      : parseRecordingInput(z.coerce.number().min(0).max(600000), duration) / 1000;
  const file = data.get('audio');
  if (!(file instanceof File))
    throw new ApiError(400, 'Choose a recording to upload.', 'AUDIO_REQUIRED');
  if (data.get('consent') !== 'true')
    throw new ApiError(403, 'Client consent is required before recording.', 'CONSENT_REQUIRED');
  const mimeType = validateUpload(file, 'audio');
  const db = getDb();
  const consultation = await db.consultation.findFirst({
    where: { id: consultationId, tenantId: actor.tenantId },
    include: { configurationVersion: true },
  });
  if (!consultation) throw new ApiError(404, 'Consultation not found.', 'NOT_FOUND');
  if (!consultation.consentAt || consultation.consentDeclined)
    throw new ApiError(403, 'Document client consent before recording.', 'CONSENT_REQUIRED');
  if (consultation.archivedAt)
    throw new ApiError(409, 'Restore this consultation before adding recordings.', 'ARCHIVED');
  const { beginRecordingIntake, assertClientDataAllowed } = await import('./clinic');
  assertClientDataAllowed(consultation);
  const existing = await db.recordingSegment.findFirst({
    where: { tenantId: actor.tenantId, segmentKey },
  });
  if (existing) {
    if (existing.consultationId !== consultationId || existing.sequence !== sequence)
      throw new ApiError(
        409,
        'This recording key belongs to a different segment.',
        'IDEMPOTENCY_CONFLICT',
      );
    const job = await db.generationJob.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: actor.tenantId,
          idempotencyKey: `recording:${existing.id}`,
        },
      },
    });
    if (job && existing.status !== 'UPLOAD_FAILED' && existing.status !== 'UPLOADING')
      return { recording: existing, job };
    if (existing.status === 'UPLOADING')
      throw new ApiError(
        409,
        'This segment is still uploading. Retry shortly.',
        'UPLOAD_IN_PROGRESS',
      );
  }
  const config = clinicConfigurationSchema.parse(consultation.configurationVersion.payload);
  const recordingId = existing?.id ?? randomUUID();
  const attemptId = randomUUID();
  const blobPath = `private/${actor.tenantId}/recordings/${consultationId}/${recordingId}/${attemptId}`;
  const expiresAt = new Date(Date.now() + config.retention.audioDays * 86400000);
  let recording;
  let expectedSummaryRevision: number;
  try {
    const accepted = await beginRecordingIntake({
      actor,
      consultationId,
      recordingId,
      segmentKey,
      sequence,
      blobPath,
      mimeType,
      bytes: file.size,
      durationSeconds,
      expiresAt,
    });
    recording = accepted.recording;
    expectedSummaryRevision = accepted.expectedSummaryRevision;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new ApiError(
        409,
        'Another recording is already using this position. Refresh before recording again.',
        'RECORDING_SEQUENCE_CONFLICT',
      );
    throw error;
  }
  try {
    return await performRecordingUpload(
      {
        attemptId,
        recordingId,
        tenantId: actor.tenantId,
        userId: recording.userId,
        consultationId,
        blobPath,
        mimeType,
      },
      file,
      async (pathname, upload) =>
        db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${consultationId}::uuid AND "tenantId" = ${actor.tenantId}::uuid FOR UPDATE`;
          const current = await tx.recordingSegment.findFirst({
            where: { id: recordingId, tenantId: actor.tenantId },
          });
          if (!current || current.status !== 'UPLOADING' || current.blobPath !== upload.blobPath)
            throw new ApiError(
              409,
              'This recording was discarded or its upload was interrupted. Refresh before retrying.',
              'RECORDING_UPLOAD_INTERRUPTED',
            );
          const now = await recordingDatabaseTime(tx);
          const user = await tx.user.findFirst({ where: { id: actor.userId, tenantId: actor.tenantId, isActive: true }, include: { tenant: true } });
          const sourceUser = await tx.user.findFirst({ where: { id: recording.userId, tenantId: actor.tenantId, isActive: true } });
          const session = await tx.authSession.findFirst({ where: { id: actor.sessionId, userId: actor.userId, revokedAt: null, expiresAt: { gt: now } } });
          const visit = await tx.consultation.findFirst({ where: { id: consultationId, tenantId: actor.tenantId }, include: { location: true } });
          if (!user?.tenant?.isActive || !sourceUser || !session || !visit || !visit.location.isActive || visit.archivedAt
            || !visit.consentAt || visit.consentDeclined || current.expiresAt <= now
            || !['SUPER_USER', 'STAFF'].includes(user.role) || (user.role === 'STAFF' && visit.providerId !== user.id))
            throw new ApiError(409, 'Recording access changed while uploading.', 'RECORDING_UPLOAD_INTERRUPTED');
          const { assertClientDataAllowed } = await import('./clinic');
          assertClientDataAllowed(visit);
          const saved = await tx.recordingSegment.update({
            where: { id: recordingId },
            data: { status: 'UPLOADED', blobPath: pathname, blobObject: upload.blobObject },
          });
          const priorJob = await tx.generationJob.findUnique({ where: { tenantId_idempotencyKey: {
            tenantId: actor.tenantId, idempotencyKey: `recording:${recordingId}`,
          } } });
          if (priorJob) throw new ApiError(409, 'This recording already has a processing job. Use a new segment.', 'RECORDING_REVIEW_REQUIRED');
          const job = await tx.generationJob.create({ data: {
            tenantId: actor.tenantId, consultationId, userId: recording.userId, kind: 'TRANSCRIPTION',
            idempotencyKey: `recording:${recordingId}`, model: TRANSCRIPTION_MODEL,
            promptVersion: SUMMARY_PROMPT_VERSION,
            result: { recordingId, expectedSummaryRevision, recordingObject: upload.blobObject! },
          } });
          await tx.consultationEvent.upsert({
            where: { idempotencyKey: `recording-upload:${recordingId}` },
            create: {
              tenantId: actor.tenantId,
              consultationId,
              userId: actor.userId,
              action: 'RECORDING_UPLOADED',
              idempotencyKey: `recording-upload:${recordingId}`,
              after: { recordingId, sequence, bytes: file.size },
            },
            update: {},
          });
          await adoptRecordingUpload(tx, upload);
          return { recording: saved, job };
        }),
    );
  } catch (error) {
    await db.recordingSegment.updateMany({
      where: { id: recording.id, tenantId: actor.tenantId, status: 'UPLOADING', blobPath },
      data: { status: 'UPLOAD_FAILED' },
    });
    throw error;
  }
}

export async function uploadSetupFile(
  actor: ClinicActor,
  file: File,
  purpose: 'voice' | 'catalog',
  conversationId: string,
  locationId: string,
  consent: boolean,
) {
  requirePrivateStorage();
  if (actor.role !== 'SUPER_USER')
    throw new ApiError(403, 'Clinic owner access is required.', 'OWNER_REQUIRED');
  if (purpose === 'voice' && !consent)
    throw new ApiError(403, 'Recording consent is required.', 'CONSENT_REQUIRED');
  const mimeType = validateUpload(file, purpose === 'voice' ? 'audio' : 'catalog');
  const conversation = await getDb().setupConversation.findFirst({
    where: {
      id: conversationId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      locationId,
      location: { is: { isActive: true, tenantId: actor.tenantId } },
    },
  });
  if (!conversation) throw new ApiError(404, 'Setup conversation not found.', 'NOT_FOUND');
  const recordingId = randomUUID();
  return performSetupRecordingUpload({ id: recordingId, tenantId: actor.tenantId, userId: actor.userId,
    locationId, setupConversationId: conversationId, purpose: purpose === 'voice' ? 'VOICE' : 'CATALOG',
    mimeType, bytes: file.size },
    path => put(path, file, { access: 'private', addRandomSuffix: false, allowOverwrite: false,
      contentType: mimeType, abortSignal: AbortSignal.timeout(45_000) }),
    (tx, journal, object) => tx.generationJob.create({ data: {
      tenantId: journal.tenantId, userId: journal.userId,
      kind: purpose === 'voice' ? 'SETUP_TRANSCRIPTION' : 'CATALOG_EXTRACTION',
      idempotencyKey: `setup-upload:${journal.id}`,
      model: purpose === 'voice' ? TRANSCRIPTION_MODEL : process.env.AI_MODEL || 'openai/gpt-6-luna',
      promptVersion: 'setup-upload-v2.1',
      result: { recordingId: journal.id, conversationId: journal.setupConversationId, recordingObject: object },
    } }));
}

export function publicRecording(recording: {
  id: string;
  sequence: number;
  status: string;
  transcript: string | null;
  staffTranscript: string | null;
  createdAt: Date;
  expiresAt: Date;
  durationSeconds: number | null;
}) {
  return {
    id: recording.id,
    sequence: recording.sequence,
    status: recording.status.toLowerCase(),
    transcript: recording.staffTranscript ?? recording.transcript,
    originalTranscript: recording.transcript,
    durationSeconds: recording.durationSeconds,
    createdAt: recording.createdAt.toISOString(),
    expiresAt: recording.expiresAt.toISOString(),
    speakerAttribution: 'Needs staff confirmation',
  };
}

export function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
