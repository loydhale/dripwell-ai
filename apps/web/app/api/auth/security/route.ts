import { compare, hash } from 'bcryptjs';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { apiRoute, json, readJson } from '@/lib/http';
import { consumeMfaCode } from '@/lib/mfa';
import { rateLimit } from '@/lib/rate-limit';

export const GET = apiRoute(async () => {
  const actor = await requireUser();
  const sessions = await getDb().authSession.findMany({ where: { userId: actor.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true, expiresAt: true } });
  return json({ mfaEnabled: actor.mfaEnabled, mfaVerified: actor.mfaVerified, currentSessionId: actor.sessionId, sessions });
});

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('revoke'), sessionId: z.uuid() }).strict(),
  z.object({ action: z.literal('password'), currentPassword: z.string().min(1).max(72), newPassword: z.string().min(12).max(72), code: z.string().max(40).optional() }).strict(),
]);

export const POST = apiRoute(async request => {
  const actor = await requireUser();
  await rateLimit(`security:${actor.id}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  const data = await readJson(request, schema);
  if (data.action === 'revoke') {
    await getDb().authSession.updateMany({ where: { id: data.sessionId, userId: actor.id }, data: { revokedAt: new Date() } });
    return json({ ok: true, signInRequired: data.sessionId === actor.sessionId });
  }
  if (Buffer.byteLength(data.newPassword) > 72) throw new ApiError(400, 'Use a password of at most 72 bytes.', 'VALIDATION_ERROR');
  const passwordHash = await hash(data.newPassword, 12);
  await getDb().$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.id}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: actor.id } });
    if (!user || !await compare(data.currentPassword, user.passwordHash)) throw new ApiError(401, 'Current password was not recognized.', 'INVALID_CREDENTIALS');
    if (user.mfaEnabled) await consumeMfaCode(tx, actor.id, data.code ?? '');
    await tx.user.update({ where: { id: actor.id }, data: { passwordHash } });
    await tx.authSession.updateMany({ where: { userId: actor.id, id: { not: actor.sessionId } }, data: { revokedAt: new Date() } });
    await tx.authChallenge.updateMany({ where: { userId: actor.id, consumedAt: null }, data: { consumedAt: new Date() } });
  });
  return json({ ok: true });
}, { mutation: true });
