import { randomUUID } from 'node:crypto';
import { get, put, del } from '@vercel/blob';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { clinicConfigurationSchema } from '@dripwell/shared/v2';
import type { ClinicActor } from './auth';
import { getDb } from './db';
import { ApiError } from './errors';
import { TRANSCRIPTION_MODEL, SUMMARY_PROMPT_VERSION } from './ai';
import { performRecordingUpload, adoptRecordingUpload } from './recording-uploads';

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

export async function readPrivateRecording(path: string, expectedBytes: number) {
  requirePrivateStorage();
  const result = await get(path, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200)
    throw new ApiError(410, 'This recording is no longer available.', 'RECORDING_UNAVAILABLE');
  if (result.blob.size > MAX_UPLOAD_BYTES || result.blob.size !== expectedBytes)
    throw new ApiError(413, 'Stored file failed size validation.', 'STORED_FILE_INVALID');
  const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
  if (bytes.byteLength !== expectedBytes)
    throw new ApiError(400, 'Stored file is incomplete.', 'STORED_FILE_INVALID');
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
          const saved = await tx.recordingSegment.update({
            where: { id: recordingId },
            data: { status: 'UPLOADED', blobPath: pathname },
          });
          const job = await tx.generationJob.upsert({
            where: {
              tenantId_idempotencyKey: {
                tenantId: actor.tenantId,
                idempotencyKey: `recording:${recordingId}`,
              },
            },
            create: {
              tenantId: actor.tenantId,
              consultationId,
              userId: recording.userId,
              kind: 'TRANSCRIPTION',
              idempotencyKey: `recording:${recordingId}`,
              model: TRANSCRIPTION_MODEL,
              promptVersion: SUMMARY_PROMPT_VERSION,
              result: { recordingId, expectedSummaryRevision },
            },
            update: {
              status: 'PENDING',
              errorCode: null,
              runId: null,
              completedAt: null,
              result: { recordingId, expectedSummaryRevision },
            },
          });
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
  const blob = await put(`private/${actor.tenantId}/setup/${recordingId}`, file, {
    access: 'private',
    addRandomSuffix: false,
    contentType: mimeType,
  });
  try {
    return await getDb().$transaction(async (tx) => {
      await tx.recordingSegment.create({
        data: {
          id: recordingId,
          tenantId: actor.tenantId,
          setupConversationId: conversationId,
          userId: actor.userId,
          segmentKey: recordingId,
          sequence: 0,
          blobPath: blob.pathname,
          mimeType,
          bytes: file.size,
          consentAt: new Date(),
          expiresAt: new Date(Date.now() + 14 * 86400000),
        },
      });
      return tx.generationJob.create({
        data: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          kind: purpose === 'voice' ? 'SETUP_TRANSCRIPTION' : 'CATALOG_EXTRACTION',
          idempotencyKey: `setup-upload:${recordingId}`,
          model:
            purpose === 'voice' ? TRANSCRIPTION_MODEL : process.env.AI_MODEL || 'openai/gpt-6-luna',
          promptVersion: 'setup-upload-v2.1',
          result: { recordingId, conversationId },
        },
      });
    });
  } catch (error) {
    await del(blob.pathname);
    throw error;
  }
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
