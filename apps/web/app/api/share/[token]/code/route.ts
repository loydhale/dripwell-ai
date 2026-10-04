import { apiRoute, json } from '@/lib/http';
import { rateLimit, requestIdentity } from '@/lib/rate-limit';
import { sendShareCode } from '@/lib/sharing';
export const POST = apiRoute(
  async (request, context: { params: Promise<{ token: string }> }) => {
    await rateLimit(`share-code-address:${requestIdentity(request)}`, {
      limit: 20,
      windowMs: 3600000,
    });
    await sendShareCode((await context.params).token);
    return json({ sent: true, message: 'A code was sent to the intended recipient.' });
  },
  { mutation: true },
);
