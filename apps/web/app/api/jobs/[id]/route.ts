import { z } from 'zod';
import { requireClinic } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';
import { apiRoute, json } from '../../../../lib/http';
import { ApiError } from '../../../../lib/errors';
import { parseRecordingInput } from '../../../../lib/recordings';

export const GET = apiRoute(async (_request, context: { params: Promise<{ id: string }> }) => {
  const actor = await requireClinic();
  const id = parseRecordingInput(z.string().uuid(), (await context.params).id);
  const job = await getDb().generationJob.findFirst({ where: { id, tenantId: actor.tenantId } });
  if (!job) throw new ApiError(404, 'Processing job not found.', 'NOT_FOUND');
  if (!job.consultationId && (actor.role !== 'SUPER_USER' || job.userId !== actor.userId))
    throw new ApiError(403, 'Owner access is required.', 'OWNER_REQUIRED');
  const complete = job.status === 'COMPLETE' || job.status === 'COMPLETED';
  return json({
    id: job.id,
    kind: job.kind,
    status: complete ? 'complete' : job.status === 'QUEUING' ? 'pending' : job.status.toLowerCase(),
    result: complete && job.kind !== 'RECORDING_UPLOAD' ? job.result : null,
    errorCode: job.errorCode,
    model: job.model,
    promptVersion: job.promptVersion,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
});
