import { timingSafeEqual } from 'node:crypto';
import { del } from '@vercel/blob';
import { getDb } from '../../../../lib/db';
import { apiRoute, json } from '../../../../lib/http';
import { ApiError } from '../../../../lib/errors';
import { reconcileAllReminders } from '../../../../workflows/reminders';
import { reconcileRecordingUploads } from '../../../../lib/recording-uploads';

function cronAuthorization(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = request.headers.get('authorization') || '';
  const expected = secret ? `Bearer ${secret}` : '';
  if (
    !expected ||
    actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  ) {
    throw new ApiError(401, 'Cron authentication is required.', 'UNAUTHENTICATED');
  }
}

export const maxDuration = 300;
export const GET = apiRoute(async (request) => {
  cronAuthorization(request);
  const reminders = await reconcileAllReminders();
  const uploadCleanup = process.env.BLOB_READ_WRITE_TOKEN
    ? await reconcileRecordingUploads()
    : null;
  const db = getDb();
  const expired = await db.recordingSegment.findMany({
    where: { expiresAt: { lte: new Date() }, blobPath: { not: '' }, status: { not: 'UPLOADING' } },
    take: 100,
    select: { id: true, tenantId: true, blobPath: true, status: true },
  });
  let deleted = 0;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    for (const recording of expired) {
      const pendingUpload = await db.generationJob.findFirst({
        where: {
          tenantId: recording.tenantId,
          kind: 'RECORDING_UPLOAD',
          status: { not: 'COMPLETE' },
          result: { path: ['recordingId'], equals: recording.id },
        },
        select: { id: true },
      });
      if (pendingUpload) continue;
      await del(recording.blobPath);
      await db.recordingSegment.updateMany({
        where: {
          id: recording.id,
          tenantId: recording.tenantId,
          blobPath: recording.blobPath,
          status: recording.status,
        },
        data: {
          blobPath: '',
          status: ['TRANSCRIBED', 'DISCARDED'].includes(recording.status)
            ? recording.status
            : 'EXPIRED',
        },
      });
      deleted++;
    }
  }
  const abandoned = new Date(Date.now() - 15 * 60000);
  await db.recordingSegment.updateMany({
    where: { status: 'UPLOADING', updatedAt: { lt: abandoned } },
    data: { status: 'UPLOAD_FAILED' },
  });
  await db.generationJob.updateMany({
    where: { status: 'QUEUING', updatedAt: { lt: abandoned }, runId: null },
    data: { status: 'FAILED', errorCode: 'PROCESSING_START_INTERRUPTED', completedAt: new Date() },
  });
  await db.authChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.authSession.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 30 * 86400000) } },
  });
  await db.rateLimitBucket.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - 2 * 86400000) } },
  });
  return json({
    reminders,
    uploadCleanup,
    expiredAudioDeleted: deleted,
    retentionStorageReady: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  });
});
