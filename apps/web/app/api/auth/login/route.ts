import { randomBytes } from 'node:crypto';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { createSession, hashToken } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { apiRoute, json, readJson } from '@/lib/http';
import { rateLimit, requestIdentity } from '@/lib/rate-limit';

const schema = z.object({ email: z.email().max(254).transform(value => value.trim().toLowerCase()), password: z.string().min(1).max(72) }).strict();
const NON_ACCOUNT_HASH = '$2b$12$62JmC.Wh/wzXs.nkgtKwf.LShBa.SBHdbNBfzXA70mzmaWPiZnPoW';

export const POST = apiRoute(async request => {
  await rateLimit(`login-ip:${requestIdentity(request)}`, { limit: 30, windowMs: 15 * 60 * 1000 });
  const data = await readJson(request, schema);
  await rateLimit(`login-account:${data.email}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  const user = await getDb().user.findUnique({ where: { email: data.email }, include: { tenant: true } });
  const valid = await compare(data.password, user?.passwordHash ?? NON_ACCOUNT_HASH);
  if (!valid || !user?.isActive || (user.tenantId && !user.tenant?.isActive)) throw new ApiError(401, 'Email or password was not recognized.', 'INVALID_CREDENTIALS');
  if (user.mfaEnabled) {
    const token = randomBytes(32).toString('base64url');
    await getDb().authChallenge.create({ data: { userId: user.id, tokenHash: hashToken(token), purpose: 'LOGIN', expiresAt: new Date(Date.now() + 5 * 60 * 1000) } });
    return json({ mfaRequired: true, challengeToken: token });
  }
  await createSession(user.id);
  return json({ ok: true, redirect: user.role === 'SYSTEM_ADMIN' ? '/account?required=platform' : '/dashboard' });
}, { mutation: true });
