import { createHash, randomBytes } from 'node:crypto';
import type { Tenant, UserRole } from '@prisma/client';
import { getDb } from './db';
import { ApiError } from './errors';

export const SESSION_COOKIE = 'dripwell_session';
const SESSION_HOURS = 12;

export interface AuthUser {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
  tenant: Tenant | null;
  locationId: string | null;
  canApproveClinical: boolean;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  mfaVerifiedAt: Date | null;
  sessionId: string;
}

export interface ClinicActor extends AuthUser {
  tenantId: string;
  tenant: Tenant;
  locationId: string;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function userFromToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await getDb().authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { tenant: { include: { locations: { where: { isActive: true }, orderBy: { createdAt: 'asc' } } } } } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) return null;
  const user = session.user;
  if (user.tenantId && !user.tenant?.isActive) return null;
  if (user.mfaEnabled && !session.mfaVerifiedAt) return null;
  return {
    id: user.id, userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
    role: user.role, tenantId: user.tenantId, tenant: user.tenant,
    locationId: user.tenant?.locations[0]?.id ?? null,
    canApproveClinical: user.canApproveClinical,
    mfaEnabled: user.mfaEnabled,
    mfaVerified: Boolean(user.mfaEnabled && session.mfaVerifiedAt),
    mfaVerifiedAt: session.mfaVerifiedAt,
    sessionId: session.id,
  };
}

function clinicActor(user: AuthUser | null): ClinicActor | null {
  if (!user || !user.tenantId || !user.tenant || !user.locationId || user.role === 'SYSTEM_ADMIN') return null;
  return user as ClinicActor;
}

export async function getActorFromRequest(request: Request): Promise<ClinicActor | null> {
  const raw = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  let token: string | undefined;
  try { token = raw ? decodeURIComponent(raw) : undefined; } catch { return null; }
  return clinicActor(await userFromToken(token));
}

export async function getUser(): Promise<AuthUser | null> {
  const { cookies } = await import('next/headers');
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) throw new ApiError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
  return user;
}

export async function requireClinic(): Promise<ClinicActor> {
  const actor = clinicActor(await requireUser());
  if (!actor) throw new ApiError(403, 'A current clinic membership is required.', 'CLINIC_REQUIRED');
  return actor;
}

export async function requireOwner(): Promise<ClinicActor> {
  const actor = await requireClinic();
  if (actor.role !== 'SUPER_USER') throw new ApiError(403, 'Only the clinic owner can perform this action.', 'OWNER_REQUIRED');
  return actor;
}

export async function requireOwnerMfa(): Promise<ClinicActor> {
  const actor = await requireOwner();
  if (!actor.mfaEnabled || !actor.mfaVerifiedAt) throw new ApiError(403, 'Set up two-factor authentication in account settings, then sign in again to manage protected clinic settings.', 'MFA_REQUIRED');
  return actor;
}

export async function requirePlatform(): Promise<AuthUser> {
  const actor = await requireUser();
  if (actor.role !== 'SYSTEM_ADMIN' || actor.tenantId) throw new ApiError(403, 'Platform administrator access is required.', 'PLATFORM_REQUIRED');
  if (!actor.mfaEnabled || !actor.mfaVerifiedAt) throw new ApiError(403, 'Two-factor authentication is required for platform administration.', 'MFA_REQUIRED');
  return actor;
}

export async function createSession(userId: string, mfaVerifiedAt: Date | null = null): Promise<void> {
  const db = getDb();
  const user = await db.user.findUnique({ where: { id: userId }, include: { tenant: true } });
  if (!user?.isActive || (user.tenantId && !user.tenant?.isActive)) throw new ApiError(401, 'Sign in to continue.', 'UNAUTHENTICATED');
  if (user.mfaEnabled && !mfaVerifiedAt) throw new ApiError(401, 'Two-factor authentication is required.', 'MFA_REQUIRED');
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const previous = jar.get(SESSION_COOKIE)?.value;
  await db.$transaction(async tx => {
    if (previous) await tx.authSession.updateMany({ where: { tokenHash: hashToken(previous) }, data: { revokedAt: new Date() } });
    await tx.authSession.create({ data: { userId, tokenHash: hashToken(token), expiresAt, mfaVerifiedAt } });
    await tx.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    const excess = await tx.authSession.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, skip: 5, select: { id: true } });
    if (excess.length) await tx.authSession.updateMany({ where: { id: { in: excess.map(item => item.id) } }, data: { revokedAt: new Date() } });
  });
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', expires: expiresAt });
}

export async function destroySession(): Promise<void> {
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().authSession.updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } });
  jar.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', expires: new Date(0) });
}

export function publicUser(user: AuthUser) {
  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, tenantId: user.tenantId, canApproveClinical: user.canApproveClinical, mfaEnabled: user.mfaEnabled, mfaVerified: Boolean(user.mfaVerifiedAt) };
}
