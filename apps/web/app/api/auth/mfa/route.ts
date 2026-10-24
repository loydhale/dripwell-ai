import { compare } from 'bcryptjs';
import { z } from 'zod';
import { createSession, hashToken, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { apiRoute, json, readJson } from '@/lib/http';
import { beginMfa, consumeMfaCode, finishMfa } from '@/lib/mfa';
import { rateLimit, requestIdentity } from '@/lib/rate-limit';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('begin'), password: z.string().min(1).max(72) }).strict(),
  z.object({ action: z.literal('confirm'), code: z.string().regex(/^\d{6}$/) }).strict(),
  z.object({ action: z.literal('challenge'), challengeToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code: z.string().min(6).max(40) }).strict(),
  z.object({ action: z.literal('disable'), password: z.string().min(1).max(72), code: z.string().min(6).max(40) }).strict(),
]);

export const POST = apiRoute(async request => {
  await rateLimit(`mfa:${requestIdentity(request)}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  const data = await readJson(request, schema);
  if (data.action === 'challenge') {
    const challenge = await getDb().authChallenge.findUnique({ where: { tokenHash: hashToken(data.challengeToken) }, include: { user: true } });
    if (!challenge || challenge.purpose !== 'LOGIN' || challenge.consumedAt || challenge.expiresAt <= new Date()) throw new ApiError(410, 'Sign-in verification expired. Sign in again.', 'CHALLENGE_EXPIRED');
    await rateLimit(`mfa-user:${challenge.userId}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    await getDb().$transaction(async tx => {
      const consumed = await tx.authChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) throw new ApiError(410, 'Sign-in verification expired. Sign in again.', 'CHALLENGE_EXPIRED');
      await consumeMfaCode(tx, challenge.userId, data.code);
    });
    await createSession(challenge.userId, new Date());
    return json({ ok: true, redirect: challenge.user.role === 'SYSTEM_ADMIN' ? '/platform' : '/dashboard' });
  }
  const actor = await requireUser();
  await rateLimit(`mfa-user:${actor.id}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (data.action === 'confirm') return json({ ok: true, recoveryCodes: await finishMfa(actor.id, actor.sessionId, data.code) });
  const user = await getDb().user.findUnique({ where: { id: actor.id } });
  if (!user || !await compare(data.password, user.passwordHash)) throw new ApiError(401, 'Password was not recognized.', 'INVALID_CREDENTIALS');
  if (data.action === 'begin') return json(await beginMfa(actor.id, actor.email));
  await getDb().$transaction(async tx => {
    await consumeMfaCode(tx, actor.id, data.code);
    await tx.user.update({ where: { id: actor.id }, data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaPendingSecretEncrypted: null, mfaPendingExpiresAt: null, mfaRecoveryHashes: [], mfaLastUsedStep: null } });
    await tx.authSession.updateMany({ where: { userId: actor.id }, data: { revokedAt: new Date() } });
  });
  return json({ ok: true, signInRequired: true });
}, { mutation: true });
