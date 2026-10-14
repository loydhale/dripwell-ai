import { put } from '@vercel/blob';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getDb } from './db';
import { ApiError } from './errors';
import { assertRecordingPathNotDetached, captureRecordingObject, parseRecordingObjectIdentity,
  recordingObjectIdentitySchema, recordingObjectPath, type RecordingObjectIdentity } from './recording-deletion-intents';

const uploadPointerSchema = z.object({
  recordingId: z.string().uuid(),
  blobPath: z.string(),
  state: z.enum(['IN_FLIGHT', 'ADOPTED', 'CLEANUP_PENDING', 'CLEANED']),
  uploadSettled: z.boolean(),
  blobObject: recordingObjectIdentitySchema.optional(),
});

export type RecordingUploadContext = {
  attemptId: string;
  recordingId: string;
  tenantId: string;
  userId: string;
  consultationId?: string;
  blobPath: string;
  mimeType: string;
  blobObject?: RecordingObjectIdentity;
};
type PrivateUploadIO = {
  putFile: (path: string, file: File, mimeType: string) => Promise<{ pathname: string; url: string; etag: string }>;
  /** Legacy injected adapter retained for callers; dedicated cleanup never invokes it. */
  deleteFile?: (path: string) => Promise<unknown>;
};
const privateUploadIO: PrivateUploadIO = {
  putFile: (path, file, contentType) =>
    put(path, file, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType,
      abortSignal: AbortSignal.timeout(45_000),
    }),
};

// Call inside the same transaction that adopts the recording. If that
// transaction rolls back, the independent upload pointer still needs cleanup.
export async function adoptRecordingUpload(
  tx: Prisma.TransactionClient,
  context: RecordingUploadContext,
) {
  if (context.consultationId) await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${context.consultationId}::uuid AND "tenantId" = ${context.tenantId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "id" = ${context.recordingId}::uuid AND "tenantId" = ${context.tenantId}::uuid FOR UPDATE`;
  const object = parseRecordingObjectIdentity(context.blobObject);
  if (object.tenantId !== context.tenantId || object.recordingId !== context.recordingId
    || object.consultationId !== context.consultationId || object.uploadAttemptId !== context.attemptId
    || object.blobPath !== context.blobPath)
    throw new ApiError(409, 'This upload cannot be adopted.', 'RECORDING_UPLOAD_INTERRUPTED');
  await assertRecordingPathNotDetached(tx, context.tenantId, context.blobPath);
  const recording = await tx.recordingSegment.findFirst({
    where: {
      id: context.recordingId,
      tenantId: context.tenantId,
      blobPath: context.blobPath,
      status: { in: ['UPLOADED', 'TRANSCRIBED'] },
    },
    select: { id: true, consultationId: true, setupConversationId: true },
  });
  if (!recording || recording.consultationId !== object.consultationId
    || recording.setupConversationId !== object.setupConversationId)
    throw new ApiError(409, 'This upload cannot be adopted.', 'RECORDING_UPLOAD_INTERRUPTED');
  const adopted = await tx.generationJob.updateMany({
    where: {
      id: context.attemptId,
      tenantId: context.tenantId,
      consultationId: object.consultationId,
      kind: 'RECORDING_UPLOAD',
      status: 'RUNNING',
    },
    data: {
      status: 'COMPLETE',
      completedAt: new Date(),
      result: {
        recordingId: context.recordingId,
        blobPath: context.blobPath,
        state: 'ADOPTED',
        uploadSettled: true,
        blobObject: object,
      },
    },
  });
  if (!adopted.count)
    throw new ApiError(
      409,
      'This upload was interrupted. Refresh before retrying.',
      'RECORDING_UPLOAD_INTERRUPTED',
    );
  await tx.recordingSegment.update({ where: { id: context.recordingId }, data: { blobObject: object } });
}

export async function cleanupRecordingUploadAttempt(
  attemptId: string,
  _deleteFile?: PrivateUploadIO['deleteFile'],
  _now?: Date,
) {
  const db = getDb();
  const initial = await db.generationJob.findUnique({ where: { id: attemptId } });
  if (!initial || initial.kind !== 'RECORDING_UPLOAD')
    return { pending: false, deleted: false, preserved: false };
  const parsed = uploadPointerSchema.safeParse(initial.result);
  if (!parsed.success) return { pending: true, deleted: false, preserved: false, reason: 'LEGACY_OBJECT_IDENTITY' };
  const pointer = parsed.data;
  if (!pointer.blobPath.startsWith(`private/${initial.tenantId}/recordings/`)
    || !pointer.blobPath.endsWith(`/${pointer.recordingId}/${initial.id}`))
    throw new ApiError(409, 'Upload cleanup scope is invalid.', 'UPLOAD_CLEANUP_SCOPE_INVALID');
  return db.$transaction(async tx => {
    if (initial.consultationId) await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${initial.consultationId}::uuid AND "tenantId" = ${initial.tenantId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "id" = ${pointer.recordingId}::uuid AND "tenantId" = ${initial.tenantId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "GenerationJob" WHERE "id" = ${initial.id}::uuid AND "tenantId" = ${initial.tenantId}::uuid FOR UPDATE`;
    const fresh = await tx.generationJob.findUniqueOrThrow({ where: { id: initial.id } });
    const current = uploadPointerSchema.safeParse(fresh.result);
    if (!current.success || fresh.kind !== 'RECORDING_UPLOAD' || fresh.tenantId !== initial.tenantId
      || fresh.consultationId !== initial.consultationId)
      return { pending: true, deleted: false, preserved: false, reason: 'LEGACY_OBJECT_IDENTITY' };
    const value = current.data;
    if (value.recordingId !== pointer.recordingId || value.blobPath !== pointer.blobPath
      || (value.blobObject && (value.blobObject.tenantId !== fresh.tenantId
        || value.blobObject.consultationId !== fresh.consultationId || value.blobObject.setupConversationId !== null
        || value.blobObject.recordingId !== value.recordingId || value.blobObject.uploadAttemptId !== fresh.id
        || value.blobObject.blobPath !== value.blobPath)))
      throw new ApiError(409, 'Upload cleanup scope changed.', 'UPLOAD_CLEANUP_SCOPE_INVALID');
    const recording = await tx.recordingSegment.findFirst({ where: { id: value.recordingId, tenantId: initial.tenantId } });
    if (recording?.blobPath === value.blobPath && ['UPLOADED', 'TRANSCRIBED'].includes(recording.status))
      return { pending: false, deleted: false, preserved: true };
    if (value.state === 'ADOPTED' && recording?.status !== 'DISCARDED')
      return { pending: true, deleted: false, preserved: false, reason: 'LEGACY_OBJECT_IDENTITY' };
    if (value.state === 'CLEANED') return { pending: false, deleted: false, preserved: false };
    // Time/age is never evidence that a put settled or that an object is absent.
    if (!value.uploadSettled && value.state === 'IN_FLIGHT' && recording?.status === 'UPLOADING')
      return { pending: true, deleted: false, preserved: false, reason: 'UPLOAD_UNSETTLED' };
    const reason = !value.uploadSettled ? 'UPLOAD_UNSETTLED'
      : !value.blobObject ? 'LEGACY_OBJECT_IDENTITY' : 'RECORDING_DELETE_DEFERRED';
    await tx.generationJob.update({ where: { id: initial.id }, data: {
      status: 'CLEANUP_PENDING', completedAt: null, errorCode: reason,
      result: { ...value, state: 'CLEANUP_PENDING' },
    } });
    return { pending: true, deleted: false, preserved: false, reason };
  });
}

export async function performRecordingUpload<T>(
  context: RecordingUploadContext,
  file: File,
  adopt: (pathname: string, context: RecordingUploadContext) => Promise<T>,
  io: PrivateUploadIO = privateUploadIO,
) {
  const db = getDb();
  const target = { tenantId: context.tenantId, recordingId: context.recordingId,
    consultationId: context.consultationId ?? null, setupConversationId: null,
    uploadAttemptId: context.attemptId };
  if (recordingObjectPath(target) !== context.blobPath)
    throw new ApiError(409, 'Upload scope is invalid.', 'PRIVATE_UPLOAD_PATH_INVALID');
  await db.$transaction(async (tx) => {
    if (context.consultationId) await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${context.consultationId}::uuid AND "tenantId" = ${context.tenantId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "id" = ${context.recordingId}::uuid AND "tenantId" = ${context.tenantId}::uuid FOR UPDATE`;
    const recording = await tx.recordingSegment.findFirst({ where: { id: context.recordingId, tenantId: context.tenantId },
      select: { consultationId: true, setupConversationId: true, blobPath: true, status: true } });
    if (!recording || recording.consultationId !== target.consultationId
      || recording.setupConversationId !== target.setupConversationId
      || recording.blobPath !== context.blobPath || recording.status !== 'UPLOADING')
      throw new ApiError(409, 'This upload cannot be started.', 'RECORDING_UPLOAD_INTERRUPTED');
    await assertRecordingPathNotDetached(tx, context.tenantId, context.blobPath);
  });
  await db.generationJob.create({
    data: {
      id: context.attemptId,
      tenantId: context.tenantId,
      userId: context.userId,
      consultationId: context.consultationId,
      kind: 'RECORDING_UPLOAD',
      status: 'RUNNING',
      idempotencyKey: `recording-upload-attempt:${context.attemptId}`,
      model: 'private-vercel-blob',
      promptVersion: 'private-upload-v2.2',
      startedAt: new Date(),
      result: {
        recordingId: context.recordingId,
        blobPath: context.blobPath,
        state: 'IN_FLIGHT',
        uploadSettled: false,
      },
    },
  });
  let uploadSettled = false;
  let blobObject: RecordingObjectIdentity | undefined;
  try {
    const blob = await io.putFile(context.blobPath, file, context.mimeType);
    uploadSettled = true;
    if (blob.pathname !== context.blobPath)
      throw new ApiError(
        409,
        'Private upload returned an unexpected path.',
        'PRIVATE_UPLOAD_PATH_INVALID',
      );
    blobObject = captureRecordingObject(target, blob);
    await db.generationJob.updateMany({ where: { id: context.attemptId, status: { not: 'COMPLETE' } }, data: {
      result: { recordingId: context.recordingId, blobPath: context.blobPath,
        state: 'IN_FLIGHT', uploadSettled: true, blobObject },
    } });
    return await adopt(blob.pathname, { ...context, blobObject });
  } catch (error) {
    // Queue compensation only. Unknown physical outcomes retain their pointer;
    // provider deletion requires the separately reviewed machine intent family.
    try {
      await db.generationJob.updateMany({
        where: { id: context.attemptId, status: { not: 'COMPLETE' } },
        data: {
          status: 'CLEANUP_PENDING',
          completedAt: null,
          result: {
            recordingId: context.recordingId,
            blobPath: context.blobPath,
            state: 'CLEANUP_PENDING',
            uploadSettled,
            ...(blobObject ? { blobObject } : {}),
          },
        },
      });
      await cleanupRecordingUploadAttempt(context.attemptId);
    } catch {
      /* Keep the original pointer. Unknown settlement remains explicitly deferred. */
    }
    throw error;
  }
}

export async function reconcileRecordingUploads(
  _deleteFile?: PrivateUploadIO['deleteFile'],
  now = new Date(),
) {
  const attempts = await getDb().generationJob.findMany({
    where: {
      kind: 'RECORDING_UPLOAD',
      status: { not: 'COMPLETE' },
    },
    orderBy: { updatedAt: 'asc' },
    take: 100,
    select: { id: true },
  });
  let pending = 0;
  let deleted = 0;
  for (const attempt of attempts) {
    const result = await cleanupRecordingUploadAttempt(attempt.id, undefined, now);
    if (result.pending) pending++;
    if (result.deleted) deleted++;
  }
  return { checked: attempts.length, pending, deleted };
}

export async function cleanupDiscardedRecordingUploads(
  recordingId: string,
  tenantId: string,
  legacyPath: string,
) {
  return getDb().$transaction(async tx => {
    const initial = await tx.recordingSegment.findFirst({ where: { id: recordingId, tenantId } });
    if (!initial) return Boolean(legacyPath); // unresolved legacy ownership; never delete
    if (initial.consultationId) await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${initial.consultationId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "id" = ${recordingId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const row = await tx.recordingSegment.findFirst({ where: { id: recordingId, tenantId } });
    if (!row || row.status !== 'DISCARDED') return Boolean(legacyPath);
    const queued = await tx.generationJob.updateMany({ where: { tenantId, consultationId: row.consultationId, kind: 'RECORDING_UPLOAD',
      result: { path: ['recordingId'], equals: recordingId }, NOT: { result: { path: ['state'], equals: 'CLEANED' } } },
      data: { status: 'CLEANUP_PENDING', completedAt: null, errorCode: 'RECORDING_DELETE_DEFERRED' } });
    // The full pointer/settlement is kept. Legacy bytes stay pending, not guessed absent.
    return queued.count > 0 || Boolean(row.blobPath) || Boolean(legacyPath);
  });
}
