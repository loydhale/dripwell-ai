import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import type { Prisma } from '@prisma/client';
import { getDb } from './db';
import { hashToken } from './auth';
import { ApiError } from './errors';

function encryptionKey(): Buffer {
  const encoded = process.env.AUTH_ENCRYPTION_KEY;
  const key = encoded ? Buffer.from(encoded, 'base64url') : Buffer.alloc(0);
  if (key.length !== 32) throw new ApiError(503, 'Two-factor authentication encryption is not configured.', 'MFA_UNAVAILABLE');
  return key;
}

export function encryptSecret(secret: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(userId));
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(encrypted: string, userId: string): string {
  const [version, iv, tag, payload] = encrypted.split('.');
  if (version !== 'v1' || !iv || !tag || !payload) throw new ApiError(503, 'Two-factor authentication could not be loaded.', 'MFA_UNAVAILABLE');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  try { return Buffer.concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()]).toString('utf8'); }
  catch { throw new ApiError(503, 'Two-factor authentication could not be loaded.', 'MFA_UNAVAILABLE'); }
}

export async function beginMfa(userId: string, email: string) {
  const secret = generateSecret();
  const encrypted = encryptSecret(secret, userId);
  const updated = await getDb().user.updateMany({ where: { id: userId, isActive: true, mfaEnabled: false }, data: { mfaPendingSecretEncrypted: encrypted, mfaPendingExpiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
  if (updated.count !== 1) throw new ApiError(409, 'Two-factor authentication is already enabled.', 'MFA_ENABLED');
  return { secret, otpauthUri: generateURI({ issuer: 'DripWell', label: email, secret }), expiresInSeconds: 600 };
}

export async function finishMfa(userId: string, sessionId: string, token: string): Promise<string[]> {
  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(12).toString('hex').toUpperCase().match(/.{1,6}/g)!.join('-'));
  await getDb().$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.mfaEnabled || !user.mfaPendingSecretEncrypted || !user.mfaPendingExpiresAt || user.mfaPendingExpiresAt <= new Date()) throw new ApiError(410, 'Authenticator setup expired. Start again.', 'MFA_SETUP_EXPIRED');
    const result = await verify({ secret: decryptSecret(user.mfaPendingSecretEncrypted, userId), token, epochTolerance: 30 });
    if (!result.valid || !('timeStep' in result)) throw new ApiError(400, 'Authenticator code was not recognized.', 'INVALID_MFA_CODE');
    await tx.user.update({ where: { id: userId }, data: { mfaEnabled: true, mfaSecretEncrypted: user.mfaPendingSecretEncrypted, mfaLastUsedStep: result.timeStep, mfaPendingSecretEncrypted: null, mfaPendingExpiresAt: null, mfaRecoveryHashes: recoveryCodes.map(code => recoveryHash(userId, code)) } });
    await tx.authSession.updateMany({ where: { userId, id: { not: sessionId }, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.authSession.update({ where: { id: sessionId }, data: { mfaVerifiedAt: new Date() } });
  });
  return recoveryCodes;
}

function recoveryHash(userId: string, code: string): string {
  return hashToken(`${userId}:${code.replace(/-/g, '').trim().toUpperCase()}`);
}

export async function consumeMfaCode(tx: Prisma.TransactionClient, userId: string, token: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user?.isActive || !user.mfaEnabled || !user.mfaSecretEncrypted) throw new ApiError(401, 'Two-factor authentication is required.', 'MFA_REQUIRED');
  if (/^\d{6}$/.test(token)) {
    const result = await verify({ secret: decryptSecret(user.mfaSecretEncrypted, userId), token, epochTolerance: 30, ...(user.mfaLastUsedStep !== null ? { afterTimeStep: user.mfaLastUsedStep } : {}) });
    if (!result.valid || !('timeStep' in result)) throw new ApiError(401, 'Authenticator code was not recognized or has already been used.', 'INVALID_MFA_CODE');
    await tx.user.update({ where: { id: userId }, data: { mfaLastUsedStep: result.timeStep } });
    return;
  }
  const candidate = Buffer.from(recoveryHash(userId, token), 'hex');
  const hashes = Array.isArray(user.mfaRecoveryHashes) ? user.mfaRecoveryHashes.filter((value): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)) : [];
  const index = hashes.findIndex(value => timingSafeEqual(Buffer.from(value, 'hex'), candidate));
  if (index < 0) throw new ApiError(401, 'Recovery code was not recognized or has already been used.', 'INVALID_MFA_CODE');
  await tx.user.update({ where: { id: userId }, data: { mfaRecoveryHashes: hashes.filter((_, position) => position !== index) } });
}
