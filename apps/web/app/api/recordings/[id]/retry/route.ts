import { z } from 'zod';
import { requireClinic } from '../../../../../lib/auth';
import { getDb } from '../../../../../lib/db';
import { apiRoute, json } from '../../../../../lib/http';
import { ApiError } from '../../../../../lib/errors';
import { assertAIReady, AIUnavailableError } from '../../../../../lib/ai';
import { startRecordingJob } from '../../../../../workflows/recordings';
import { parseRecordingInput } from '../../../../../lib/recordings';

export const POST = apiRoute(
  async (_request, context: { params: Promise<{ id: string }> }) => {
    const actor = await requireClinic();
    const recordingId = parseRecordingInput(z.string().uuid(), (await context.params).id);
    const recording = await getDb().recordingSegment.findFirst({
      where: { id: recordingId, tenantId: actor.tenantId },
    });
    if (!recording) throw new ApiError(404, 'Recording not found.', 'NOT_FOUND');
    if (
      recording.setupConversationId &&
      (actor.role !== 'SUPER_USER' || recording.userId !== actor.userId)
    )
      throw new ApiError(403, 'Owner access is required.', 'OWNER_REQUIRED');
    if (
      recording.expiresAt <= new Date() ||
      !recording.blobPath ||
      ['UPLOAD_FAILED', 'DISCARDED', 'EXPIRED'].includes(recording.status)
    )
      throw new ApiError(410, 'This audio must be uploaded again.', 'RECORDING_UNAVAILABLE');
    try {
      assertAIReady();
    } catch (error) {
      if (error instanceof AIUnavailableError) throw new ApiError(503, error.message, error.code);
      throw error;
    }
    const job = await getDb().generationJob.findFirst({
      where: {
        tenantId: actor.tenantId,
        OR: [
          { idempotencyKey: `recording:${recordingId}` },
          { idempotencyKey: `setup-upload:${recordingId}` },
        ],
      },
    });
    if (!job) throw new ApiError(404, 'Processing job not found.', 'NOT_FOUND');
    if (job.status === 'FAILED')
      await getDb().generationJob.updateMany({
        where: { id: job.id, tenantId: actor.tenantId, status: 'FAILED' },
        data: { status: 'PENDING', errorCode: null, runId: null, completedAt: null },
      });
    await startRecordingJob(job.id);
    return json(
      { recordingId, jobId: job.id, status: job.status === 'COMPLETE' ? 'complete' : 'pending' },
      202,
    );
  },
  { mutation: true },
);
