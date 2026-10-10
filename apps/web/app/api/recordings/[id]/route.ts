import { z } from 'zod';
import { adjustmentReasonSchema } from '@dripwell/shared/v2';
import { requireClinic } from '../../../../lib/auth';
import { apiRoute, json, readJson } from '../../../../lib/http';
import { applyTranscriptCorrection } from '../../../../lib/clinic';
import { parseRecordingInput } from '../../../../lib/recordings';

const correctionSchema = z.object({
  text: z.string().max(50000),
  reason: adjustmentReasonSchema,
  expectedVersion: z.number().int().positive(),
});

export const PATCH = apiRoute(
  async (request, context: { params: Promise<{ id: string }> }) => {
    const actor = await requireClinic();
    const recordingId = parseRecordingInput(z.string().uuid(), (await context.params).id);
    const input = await readJson(request, correctionSchema);
    return json(await applyTranscriptCorrection({ actor, recordingId, ...input }));
  },
  { mutation: true },
);
