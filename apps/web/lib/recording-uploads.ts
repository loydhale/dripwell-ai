import { put, del } from '@vercel/blob';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getDb } from './db';
import { ApiError } from './errors';

const uploadPointerSchema = z.object({
  recordingId: z.string().uuid(),
  blobPath: z.string(),
  state: z.enum(['IN_FLIGHT', 'ADOPTED', 'CLEANUP_PENDING', 'CLEANED']),
  uploadSettled: z.boolean(),
});

export type RecordingUploadContext = {
  attemptId: string;
  recordingId: string;
  tenantId: string;
  userId: string;
  consultationId?: string;
  blobPath: string;
  mimeType: string;
};
type PrivateUploadIO = {
  putFile: (path: string, file: File, mimeType: string) => Promise<{ pathname: string }>;
  deleteFile: (path: string) => Promise<unknown>;
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
  deleteFile: del,
};

// Call inside the same transaction that adopts the recording. If that
// transaction rolls back, the independent upload pointer still needs cleanup.
export async function adoptRecordingUpload(
  tx: Prisma.TransactionClient,
  context: RecordingUploadContext,
) {
  await tx.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "id" = ${context.recordingId}::uuid AND "tenantId" = ${context.tenantId}::uuid FOR UPDATE`;
  const recording = await tx.recordingSegment.findFirst({
    where: {
      id: context.recordingId,
      tenantId: context.tenantId,
      blobPath: context.blobPath,
      status: { in: ['UPLOADED', 'TRANSCRIBED'] },
    },
    select: { id: true },
  });
  if (!recording)
    throw new ApiError(409, 'This upload cannot be adopted.', 'RECORDING_UPLOAD_INTERRUPTED');
  const adopted = await tx.generationJob.updateMany({
    where: {
      id: context.attemptId,
      tenantId: context.tenantId,
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
      },
    },
  });
  if (!adopted.count)
    throw new ApiError(
      409,
      'This upload was interrupted. Refresh before retrying.',
      'RECORDING_UPLOAD_INTERRUPTED',
    );
}

export async function cleanupRecordingUploadAttempt(
  attemptId: string,
  deleteFile: PrivateUploadIO['deleteFile'] = privateUploadIO.deleteFile,
  now = new Date(),
) {
  const db = getDb();
  const job = await db.generationJob.findUnique({ where: { id: attemptId } });
  if (!job || job.kind !== 'RECORDING_UPLOAD')
    return { pending: false, deleted: false, preserved: false };
  const pointer = uploadPointerSchema.parse(job.result);
  if (
    !pointer.blobPath.startsWith(`private/${job.tenantId}/recordings/`) ||
    !pointer.blobPath.endsWith(`/${pointer.recordingId}/${job.id}`)
  )
    throw new ApiError(409, 'Upload cleanup scope is invalid.', 'UPLOAD_CLEANUP_SCOPE_INVALID');
  const claim = await db.$transaction(async (tx) => {
    // Adoption locks the recording before updating its upload job. Match that
    // order and re-read after the lock, rather than deleting from a stale read.
    await tx.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "id" = ${pointer.recordingId}::uuid AND "tenantId" = ${job.tenantId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "GenerationJob" WHERE "id" = ${job.id}::uuid AND "tenantId" = ${job.tenantId}::uuid FOR UPDATE`;
    const fresh = await tx.generationJob.findUniqueOrThrow({ where: { id: job.id } });
    const current = uploadPointerSchema.parse(fresh.result);
    const recording = await tx.recordingSegment.findFirst({
      where: { id: current.recordingId, tenantId: job.tenantId },
      select: { status: true, blobPath: true },
    });
    if (
      recording?.blobPath === current.blobPath &&
      ['UPLOADED', 'TRANSCRIBED'].includes(recording.status)
    )
      return { pointer: current, action: 'PRESERVE' as const };
    if (current.state === 'ADOPTED' && recording?.status !== 'DISCARDED')
      return { pointer: current, action: 'PRESERVE' as const };
    if (current.state === 'CLEANED') return { pointer: current, action: 'DONE' as const };
    if (current.state === 'IN_FLIGHT' && now.getTime() - fresh.createdAt.getTime() < 90_000)
      return { pointer: current, action: 'WAIT' as const };
    const pendingPointer = { ...current, state: 'CLEANUP_PENDING' as const };
    await tx.generationJob.update({
      where: { id: job.id },
      data: {
        status: 'CLEANUP_PENDING',
        result: pendingPointer,
        completedAt: null,
      },
    });
    return { pointer: pendingPointer, action: 'DELETE' as const };
  });
  if (claim.action === 'PRESERVE') return { pending: false, deleted: false, preserved: true };
  if (claim.action === 'DONE') return { pending: false, deleted: false, preserved: false };
  if (claim.action === 'WAIT') return { pending: true, deleted: false, preserved: false };
  const pendingPointer = claim.pointer;
  try {
    await deleteFile(pendingPointer.blobPath);
  } catch {
    await db.generationJob.updateMany({
      where: { id: job.id, status: 'CLEANUP_PENDING' },
      data: { errorCode: 'PRIVATE_FILE_DELETE_FAILED' },
    });
    return { pending: true, deleted: false, preserved: false };
  }
  if (!pendingPointer.uploadSettled) return { pending: true, deleted: true, preserved: false };
  await db.generationJob.updateMany({
    where: { id: job.id, status: 'CLEANUP_PENDING' },
    data: {
      status: 'COMPLETE',
      errorCode: null,
      completedAt: now,
      result: { ...pendingPointer, state: 'CLEANED' },
    },
  });
  await db.recordingSegment.updateMany({
    where: {
      id: pointer.recordingId,
      tenantId: job.tenantId,
      blobPath: pointer.blobPath,
      status: { in: ['DISCARDED', 'UPLOAD_FAILED', 'EXPIRED'] },
    },
    data: { blobPath: '' },
  });
  return { pending: false, deleted: true, preserved: false };
}

export async function performRecordingUpload<T>(
  context: RecordingUploadContext,
  file: File,
  adopt: (pathname: string, context: RecordingUploadContext) => Promise<T>,
  io: PrivateUploadIO = privateUploadIO,
) {
  const db = getDb();
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
  try {
    const blob = await io.putFile(context.blobPath, file, context.mimeType);
    uploadSettled = true;
    if (blob.pathname !== context.blobPath)
      throw new ApiError(
        409,
        'Private upload returned an unexpected path.',
        'PRIVATE_UPLOAD_PATH_INVALID',
      );
    return await adopt(blob.pathname, context);
  } catch (error) {
    // Persist compensation before attempting deletion. If DB or storage is
    // unavailable, the original IN_FLIGHT pointer remains durable for cron.
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
          },
        },
      });
      await cleanupRecordingUploadAttempt(context.attemptId, io.deleteFile);
    } catch {
      /* Keep the original pointer; cron recovers this operation. */
    }
    throw error;
  }
}

export async function reconcileRecordingUploads(
  deleteFile = privateUploadIO.deleteFile,
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
    const result = await cleanupRecordingUploadAttempt(attempt.id, deleteFile, now);
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
  const attempts = await getDb().generationJob.findMany({
    where: {
      tenantId,
      kind: 'RECORDING_UPLOAD',
      result: { path: ['recordingId'], equals: recordingId },
    },
    select: { id: true },
  });
  if (attempts.length) {
    let pending = false;
    for (const attempt of attempts) {
      const result = await cleanupRecordingUploadAttempt(attempt.id);
      pending ||= result.pending;
    }
    return pending;
  }
  if (!legacyPath) return false;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return true;
  try {
    await privateUploadIO.deleteFile(legacyPath);
    await getDb().recordingSegment.updateMany({
      where: { id: recordingId, tenantId, status: 'DISCARDED', blobPath: legacyPath },
      data: { blobPath: '' },
    });
    return false;
  } catch {
    return true;
  }
}
