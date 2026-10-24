import { z } from 'zod';
import { requireOwner } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';
import { apiRoute, json } from '../../../../lib/http';
import { ApiError } from '../../../../lib/errors';
import { assertAIReady, AIUnavailableError } from '../../../../lib/ai';
import {
  MAX_UPLOAD_BYTES,
  uploadSetupFile,
  parseRecordingInput,
  validateSetupLocation,
  requirePrivateStorage,
} from '../../../../lib/recordings';
import { startRecordingJob } from '../../../../workflows/recordings';
import { rateLimit } from '../../../../lib/rate-limit';

export const maxDuration = 60;
export const POST = apiRoute(
  async (request) => {
    const actor = await requireOwner();
    await rateLimit(`setup-upload:${actor.tenantId}:${actor.userId}`, {
      limit: 30,
      windowMs: 3600000,
    });
    if (Number(request.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES + 20000)
      throw new ApiError(413, 'File is too large.', 'UPLOAD_TOO_LARGE');
    try {
      assertAIReady();
    } catch (error) {
      if (error instanceof AIUnavailableError) throw new ApiError(503, error.message, error.code);
      throw error;
    }
    const form = await request.formData();
    requirePrivateStorage();
    const locationId = await validateSetupLocation(
      actor,
      parseRecordingInput(z.string().uuid(), form.get('locationId')),
    );
    const purpose = parseRecordingInput(z.enum(['voice', 'catalog']), form.get('purpose'));
    const file = form.get('file');
    if (!(file instanceof File))
      throw new ApiError(400, 'Choose a file to upload.', 'FILE_REQUIRED');
    const requestedId = form.get('conversationId');
    const conversationId = requestedId
      ? parseRecordingInput(z.string().uuid(), requestedId)
      : (
          await getDb().setupConversation.create({
            data: { tenantId: actor.tenantId, userId: actor.userId, locationId },
          })
        ).id;
    const job = await uploadSetupFile(
      actor,
      file,
      purpose,
      conversationId,
      locationId,
      form.get('consent') === 'true',
    );
    try {
      await startRecordingJob(job.id);
    } catch {
      return json(
        {
          conversationId,
          jobId: job.id,
          status: 'failed',
          errorCode: 'PROCESSING_START_FAILED',
          fileSaved: true,
        },
        202,
      );
    }
    return json({ conversationId, jobId: job.id, status: 'pending' }, 202);
  },
  { mutation: true },
);
