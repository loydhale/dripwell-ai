import { requireOwner } from '@/lib/auth';
import { clinicReferrals } from '@/lib/platform';
import { apiRoute, json } from '@/lib/http';
export const GET = apiRoute(async () =>
  json(await clinicReferrals((await requireOwner()).tenantId)),
);
