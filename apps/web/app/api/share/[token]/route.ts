import { z } from 'zod';
import { requireClinic } from '@/lib/auth';
import { apiRoute, json } from '@/lib/http';
import { revokeShare } from '@/lib/sharing';
export const DELETE = apiRoute(
  async (_request, context: { params: Promise<{ token: string }> }) => {
    const actor = await requireClinic();
    const id = z
      .string()
      .uuid()
      .parse((await context.params).token);
    await revokeShare(actor.tenantId, actor.userId, id);
    return json({ revoked: true });
  },
  { mutation: true },
);
