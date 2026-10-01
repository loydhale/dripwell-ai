import { z } from 'zod';
import { requireClinic } from '../../../lib/auth';
import { clinicActionSchema, getClinicDashboard, getConsultation, mutateClinicAction } from '../../../lib/clinic';
import { apiRoute, json, readJson } from '../../../lib/http';
import { rateLimit } from '../../../lib/rate-limit';
import { ApiError } from '../../../lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = apiRoute(async (request) => {
  const actor = await requireClinic();
  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  if (id) {
    if (!z.string().uuid().safeParse(id).success) throw new ApiError(400, 'Consultation ID is invalid.', 'INVALID_ID');
    return json(await getConsultation(actor, id));
  }
  const locationId = params.get('locationId');
  if (locationId && !z.string().uuid().safeParse(locationId).success) throw new ApiError(400, 'Location ID is invalid.', 'INVALID_ID');
  return json(await getClinicDashboard(actor, {
    locationId, archived: params.get('archived') === 'true', from: params.get('from'), to: params.get('to'),
  }));
});

export const POST = apiRoute(async (request) => {
  const actor = await requireClinic();
  await rateLimit(`clinic-mutation:${actor.userId}`, { limit: 120, windowMs: 60000 });
  const input = await readJson(request, clinicActionSchema, 2000000);
  return json(await mutateClinicAction(actor, input));
}, { mutation: true });
