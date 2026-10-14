import { z } from 'zod';
import { adjustmentReasonSchema } from '@dripwell/shared/v2';
import { requireClinic } from '../../../../../lib/auth';
import { apiRoute, json, readJson } from '../../../../../lib/http';
import { discardRecordingEvidence } from '../../../../../lib/clinic';
import { parseRecordingInput } from '../../../../../lib/recordings';
import { cleanupDiscardedRecordingUploads } from '../../../../../lib/recording-uploads';

const discardSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: adjustmentReasonSchema,
  reasonNote: z.string().trim().min(1).max(4000),
});

export const POST = apiRoute(
  async (request, context: { params: Promise<{ id: string }> }) => {
    const actor = await requireClinic();
    const recordingId = parseRecordingInput(z.string().uuid(), (await context.params).id);
    const input = await readJson(request, discardSchema);
    const result = await discardRecordingEvidence({ actor, recordingId, ...input });
    const audioDeletionPending = await cleanupDiscardedRecordingUploads(
      recordingId,
      actor.tenantId,
      result.blobPath,
    );
    return json({
      consultationId: result.consultationId,
      recordingId,
      version: result.version,
      audioDeletionPending,
    });
  },
  { mutation: true },
);
