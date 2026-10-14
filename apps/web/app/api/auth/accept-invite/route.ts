import { hash } from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { createSession, hashToken } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { apiRoute, json, readJson } from '@/lib/http';
import { rateLimit, requestIdentity } from '@/lib/rate-limit';

const schema = z.object({ token: z.string().min(32).max(200), firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), password: z.string().min(12).max(72) }).strict();

export const POST = apiRoute(async request => {
  await rateLimit(`invite-accept:${requestIdentity(request)}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  const data = await readJson(request, schema);
  if (Buffer.byteLength(data.password) > 72) throw new ApiError(400, 'Use a password of at most 72 bytes.', 'VALIDATION_ERROR');
  const passwordHash = await hash(data.password, 12);
  const userId = await getDb().$transaction(async tx => {
    const invite = await tx.userInvite.findUnique({ where: { tokenHash: hashToken(data.token) }, include: { tenant: true } });
    if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt <= new Date() || !invite.tenant.isActive || !['STAFF', 'PROVIDER'].includes(invite.role)) throw new ApiError(410, 'This invitation is no longer available.', 'INVITATION_EXPIRED');
    const currentOwner = await tx.user.findUnique({ where: { id: invite.invitedById } });
    if (!currentOwner?.isActive || currentOwner.role !== 'SUPER_USER' || currentOwner.tenantId !== invite.tenantId) throw new ApiError(410, 'This invitation is no longer available.', 'INVITATION_EXPIRED');
    const consumed = await tx.userInvite.updateMany({ where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
    if (consumed.count !== 1) throw new ApiError(409, 'This invitation was already used.', 'INVITATION_CONSUMED');
    const user = await tx.user.create({ data: { tenantId: invite.tenantId, email: invite.email.toLowerCase(), passwordHash, firstName: data.firstName, lastName: data.lastName, role: invite.role, canApproveClinical: invite.canApproveClinical } });
    return user.id;
  });
  await createSession(userId);
  return json({ ok: true, redirect: '/dashboard' }, 201);
}, { mutation: true });
