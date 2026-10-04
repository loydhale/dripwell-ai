import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { apiRoute, json, readJson } from '@/lib/http';
import { rateLimit, requestIdentity } from '@/lib/rate-limit';

const schema = z.object({
  clinicName: z.string().trim().min(2).max(100), firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60),
  email: z.email().max(254).transform(value => value.trim().toLowerCase()), password: z.string().min(12).max(72),
  state: z.string().trim().max(80).default(''), medicalDirector: z.string().trim().max(120).default(''),
  referralCode: z.string().trim().max(40).optional(),
}).strict();

export const POST = apiRoute(async request => {
  await rateLimit(`register:${requestIdentity(request)}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  const data = await readJson(request, schema);
  if (Buffer.byteLength(data.password) > 72) throw new ApiError(400, 'Use a password of at most 72 bytes.', 'VALIDATION_ERROR');
  const passwordHash = await hash(data.password, 12);
  const result = await getDb().$transaction(async tx => {
    const referrer = data.referralCode ? await tx.tenant.findFirst({ where: { referralCode: data.referralCode, isActive: true } }) : null;
    if (data.referralCode && !referrer) throw new ApiError(400, 'This referral code is not valid.', 'INVALID_REFERRAL');
    const policy = referrer ? await tx.platformPolicy.findUnique({ where: { id: 'global' } }) : null;
    const now = new Date();
    const slugBase = data.clinicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'clinic';
    const tenant = await tx.tenant.create({ data: {
      name: data.clinicName, slug: `${slugBase}-${randomBytes(5).toString('hex')}`, state: data.state, medicalDirector: data.medicalDirector,
      referralCode: randomBytes(8).toString('hex'),
      locations: { create: { name: data.clinicName } },
      subscription: { create: { status: 'TRIAL', trialActivatedAt: now, trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), trialLimit: 10, trialUsed: 0 } },
    } });
    const user = await tx.user.create({ data: { tenantId: tenant.id, email: data.email, passwordHash, firstName: data.firstName, lastName: data.lastName, role: 'SUPER_USER', canApproveClinical: false } });
    if (referrer) {
      const snapshot = policy?.referralPolicy;
      const version = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && typeof snapshot.version === 'number' ? snapshot.version : null;
      await tx.referral.create({ data: { referrerTenantId: referrer.id, referredTenantId: tenant.id, code: data.referralCode!, policyVersion: version, ...(snapshot ? { policySnapshot: snapshot } : {}) } });
    }
    return { userId: user.id, tenantId: tenant.id };
  });
  await createSession(result.userId);
  return json({ ok: true, redirect: '/setup' }, 201);
}, { mutation: true });
