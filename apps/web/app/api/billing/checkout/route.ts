import { requireOwnerMfa } from '@/lib/auth';
import { checkout } from '@/lib/billing';
import { apiRoute, json } from '@/lib/http';
export const runtime = 'nodejs';
export const POST = apiRoute(
  async () => {
    const actor = await requireOwnerMfa();
    return json(await checkout(actor.tenantId, actor.email));
  },
  { mutation: true },
);
