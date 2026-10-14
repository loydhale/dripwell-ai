import { z } from 'zod';
import { requireClinic } from '../../../lib/auth';
import { apiRoute, json } from '../../../lib/http';
import { ApiError } from '../../../lib/errors';
import { assertAIReady, AIUnavailableError } from '../../../lib/ai';
import { getDb } from '../../../lib/db';
import { rateLimit } from '../../../lib/rate-limit';
import {
  MAX_UPLOAD_BYTES,
  receiveConsultationRecording,
  publicRecording,
  parseRecordingInput,
} from '../../../lib/recordings';
import { startRecordingJob } from '../../../workflows/recordings';

export const maxDuration = 60;
export const GET = apiRoute(async (request) => {
  const actor = await requireClinic();
  const consultationId = parseRecordingInput(
    z.string().uuid(),
    new URL(request.url).searchParams.get('consultationId'),
  );
  const consultation = await getDb().consultation.findFirst({
    where: { id: consultationId, tenantId: actor.tenantId },
    select: { id: true },
  });
  if (!consultation) throw new ApiError(404, 'Consultation not found.', 'NOT_FOUND');
  const recordings = await getDb().recordingSegment.findMany({
    where: { consultationId, tenantId: actor.tenantId },
    orderBy: { sequence: 'asc' },
  });
  return json({ recordings: recordings.map(publicRecording) });
});

export const POST = apiRoute(
  async (request) => {
    const actor = await requireClinic();
    await rateLimit(`audio:${actor.tenantId}:${actor.userId}`, { limit: 120, windowMs: 3600000 });
    if (Number(request.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES + 20000)
      throw new ApiError(413, 'Recording segment is too large.', 'UPLOAD_TOO_LARGE');
    try {
      assertAIReady();
    } catch (error) {
      if (error instanceof AIUnavailableError) throw new ApiError(503, error.message, error.code);
      throw error;
    }
    const { recording, job } = await receiveConsultationRecording(actor, await request.formData());
    try {
      await startRecordingJob(job.id);
    } catch {
      return json(
        {
          recordingId: recording.id,
          jobId: job.id,
          status: 'failed',
          errorCode: 'PROCESSING_START_FAILED',
          audioSaved: true,
        },
        202,
      );
    }
    return json(
      {
        recordingId: recording.id,
        jobId: job.id,
        status: job.status.toLowerCase(),
        transcript: recording.transcript,
      },
      202,
    );
  },
  { mutation: true },
);
