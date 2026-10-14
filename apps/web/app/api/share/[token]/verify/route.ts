import { z } from 'zod';
import { apiRoute, json, readJson } from '@/lib/http';
import { rateLimit, requestIdentity } from '@/lib/rate-limit';
import { verifyShareCode } from '@/lib/sharing';
export const POST = apiRoute(
  async (request, context: { params: Promise<{ token: string }> }) => {
    await rateLimit(`share-verify-address:${requestIdentity(request)}`, {
      limit: 50,
      windowMs: 3600000,
    });
    const body = await readJson(request, z.object({ code: z.string().regex(/^\d{6}$/) }).strict());
    await verifyShareCode((await context.params).token, body.code);
    return json({ verified: true });
  },
  { mutation: true },
);
