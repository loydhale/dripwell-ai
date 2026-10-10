import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { generate } from 'otplib';
import { getActorFromRequest, hashToken } from '../lib/auth';
import { ApiError } from '../lib/errors';
import { assertOrigin, handleError, readJson } from '../lib/http';
import { decryptSecret, encryptSecret, beginMfa, finishMfa, consumeMfaCode } from '../lib/mfa';
import { getDb } from '../lib/db';
import { z } from 'zod';

test('mutation origin guards reject missing and foreign origins', () => {
  const appUrl = process.env.APP_URL;
  process.env.APP_URL = 'https://dripwell.example';
  try {
    assert.throws(() => assertOrigin(new Request('https://dripwell.example/api/auth/login', { method: 'POST' })), /Open this action/);
    assert.throws(() => assertOrigin(new Request('https://dripwell.example/api/auth/login', { method: 'POST', headers: { origin: 'https://other.example' } })), /Open this action/);
    assert.doesNotThrow(() => assertOrigin(new Request('https://dripwell.example/api/auth/login', { method: 'POST', headers: { origin: 'https://dripwell.example', 'sec-fetch-site': 'same-origin' } })));
  } finally { if (appUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = appUrl; }
});

test('API validation bounds input and errors never expose an underlying failure', async () => {
  await assert.rejects(readJson(new Request('https://dripwell.example', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"answer":"long"}' }), z.object({ answer: z.string() }), 3), (error: unknown) => error instanceof ApiError && error.status === 413);
  const error = handleError(new Error('private content and connection details'));
  assert.equal(error.status, 500);
  assert.equal(error.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.doesNotMatch(await error.text(), /private content/);
  const invalidId = z.uuid().safeParse('private-not-an-id');
  assert.equal(invalidId.success, false);
  if (!invalidId.success) {
    const response = handleError(invalidId.error);
    assert.equal(response.status, 400);
    assert.doesNotMatch(await response.text(), /private-not-an-id/);
  }
});

test('MFA encryption binds the secret to one identity and requires a separate key', () => {
  const old = process.env.AUTH_ENCRYPTION_KEY;
  process.env.AUTH_ENCRYPTION_KEY = randomBytes(32).toString('base64url');
  try {
    const secret = 'SYNTHETIC_AUTHENTICATOR_SECRET';
    const cipher = encryptSecret(secret, 'synthetic-user-one');
    assert.equal(decryptSecret(cipher, 'synthetic-user-one'), secret);
    assert.throws(() => decryptSecret(cipher, 'synthetic-user-two'), /could not be loaded/);
    delete process.env.AUTH_ENCRYPTION_KEY;
    assert.throws(() => encryptSecret(secret, 'synthetic-user-one'), /not configured/);
  } finally { if (old === undefined) delete process.env.AUTH_ENCRYPTION_KEY; else process.env.AUTH_ENCRYPTION_KEY = old; }
});

test('request auth rejects malformed tokens without accessing a database', async () => {
  assert.equal(await getActorFromRequest(new Request('https://dripwell.example')), null);
  assert.equal(await getActorFromRequest(new Request('https://dripwell.example', { headers: { cookie: 'dripwell_session=malformed' } })), null);
});

const testUrl = process.env.TEST_DATABASE_URL;
test('real database sessions reread authority and MFA recovery codes cannot be reused', { skip: !testUrl }, async () => {
  assert.match(testUrl!, /dripwell_verification/, 'Integration tests require an explicitly named isolated verification database.');
  process.env.DATABASE_URL = testUrl;
  const key = process.env.AUTH_ENCRYPTION_KEY;
  process.env.AUTH_ENCRYPTION_KEY = randomBytes(32).toString('base64url');
  const db = getDb();
  const unique = randomUUID();
  const token = randomBytes(32).toString('base64url');
  const tenant = await db.tenant.create({ data: { name: 'Synthetic security verification', slug: `synthetic-auth-${unique}`, state: '', medicalDirector: '', locations: { create: { name: 'Synthetic location' } } } });
  const user = await db.user.create({ data: { tenantId: tenant.id, email: `synthetic-${unique}@example.invalid`, passwordHash: 'not-a-login-password', firstName: 'Synthetic', lastName: 'Security', role: 'SUPER_USER' } });
  const session = await db.authSession.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60_000) } });
  const request = () => new Request('https://dripwell.example', { headers: { cookie: `dripwell_session=${token}` } });
  try {
    assert.equal((await getActorFromRequest(request()))?.role, 'SUPER_USER');
    await db.user.update({ where: { id: user.id }, data: { role: 'PROVIDER', canApproveClinical: false } });
    assert.equal((await getActorFromRequest(request()))?.canApproveClinical, false, 'Provider title alone must not grant clinical approval.');
    await db.user.update({ where: { id: user.id }, data: { role: 'STAFF' } });
    assert.equal((await getActorFromRequest(request()))?.role, 'STAFF', 'Session must not retain its earlier owner authority.');
    const setup = await beginMfa(user.id, user.email);
    const enrollmentToken = await generate({ secret: setup.secret });
    const recovery = await finishMfa(user.id, session.id, enrollmentToken);
    assert.equal(recovery.length, 10);
    await assert.rejects(db.$transaction(tx => consumeMfaCode(tx, user.id, enrollmentToken)), /already been used/);
    const uses = await Promise.allSettled([
      db.$transaction(tx => consumeMfaCode(tx, user.id, recovery[0]!)),
      db.$transaction(tx => consumeMfaCode(tx, user.id, recovery[0]!)),
    ]);
    assert.equal(uses.filter(result => result.status === 'fulfilled').length, 1, 'Concurrent replay must consume one recovery code once.');
    assert.equal(uses.filter(result => result.status === 'rejected').length, 1);
    await db.tenant.update({ where: { id: tenant.id }, data: { isActive: false } });
    assert.equal(await getActorFromRequest(request()), null, 'Disabling a clinic must invalidate existing sessions immediately.');
    await db.tenant.update({ where: { id: tenant.id }, data: { isActive: true } });
    await db.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    assert.equal(await getActorFromRequest(request()), null, 'Revoked sessions cannot be replayed.');
  } finally {
    await db.tenant.delete({ where: { id: tenant.id } });
    if (key === undefined) delete process.env.AUTH_ENCRYPTION_KEY; else process.env.AUTH_ENCRYPTION_KEY = key;
    await db.$disconnect();
  }
});
