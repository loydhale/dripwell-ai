import { requireOwnerMfa } from '@/lib/auth';
import { customerPortal } from '@/lib/billing';
import { apiRoute, json } from '@/lib/http';
export const runtime = 'nodejs';
export const POST = apiRoute(
  async () => {
    const actor = await requireOwnerMfa();
    return json(await customerPortal(actor.tenantId));
  },
  { mutation: true },
);
