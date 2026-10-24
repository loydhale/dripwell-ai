import { z } from 'zod';
import { referralPolicySchema } from '@dripwell/shared/v2';
import { requirePlatform } from '@/lib/auth';
import { platformOverview, setReferralPolicy } from '@/lib/platform';
import { apiRoute, json, readJson } from '@/lib/http';
export const GET = apiRoute(async () => {
  await requirePlatform();
  return json(await platformOverview());
});
export const PATCH = apiRoute(
  async (request) => {
    const actor = await requirePlatform();
    const body = await readJson(
      request,
      z.object({ referralPolicy: referralPolicySchema.nullable() }).strict(),
    );
    return json(await setReferralPolicy(actor.userId, body.referralPolicy));
  },
  { mutation: true },
);
