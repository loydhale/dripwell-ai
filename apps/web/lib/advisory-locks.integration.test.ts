import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma, type PlatformPolicy } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { referralPolicySchema, type ReferralPolicy } from '@dripwell/shared/v2';

vi.mock('server-only', () => ({}));
const boundary = vi.hoisted(() => ({
  cookieValues: new Map<string, string>(),
  createSession: vi.fn(),
  attachSession: vi.fn(),
  sendMessage: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (key: string) =>
      boundary.cookieValues.has(key) ? { value: boundary.cookieValues.get(key) } : undefined,
  }),
}));
vi.mock('eve/client', () => ({
  Client: vi.fn(function () {
    return {
      sessions: { create: boundary.createSession, attach: boundary.attachSession },
    };
  }),
}));

import { POST as setup } from '../app/api/setup/route';
import { PATCH as publishPolicy } from '../app/api/platform/route';
import { hashToken, SESSION_COOKIE } from './auth';
import { getDb } from './db';
import { setReferralPolicy } from './platform';

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  if (!/\/dripwell_verification(?:\?|$)/.test(testUrl))
    throw new Error('Advisory lock tests require the isolated verification database.');
  process.env.DATABASE_URL = testUrl;
}
const suite = testUrl ? describe : describe.skip;

suite('setup and policy operations against isolated PostgreSQL', () => {
  let tenantId: string;
  let locationId: string;
  let ownerId: string;
  let adminId: string;
  let previousPolicy: PlatformPolicy | null;
  let policyVersion: number;
  const ownerToken = randomBytes(32).toString('base64url');
  const adminToken = randomBytes(32).toString('base64url');
  const origin = 'https://synthetic-advisory.example.test';
  const digest = (value: string) => createHash('sha256').update(value).digest('hex');

  beforeAll(async () => {
    vi.stubEnv('APP_URL', origin);
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-external-boundary-no-network');
    const db = getDb();
    const suffix = randomUUID();
    const tenant = await db.tenant.create({
      data: {
        name: 'Synthetic advisory lock clinic', slug: `advisory-${suffix}`,
        state: 'TEST', medicalDirector: 'Synthetic test fixture',
      },
    });
    tenantId = tenant.id;
    locationId = (await db.location.create({
      data: { tenantId, name: 'Synthetic setup location' },
    })).id;
    const owner = await db.user.create({
      data: {
        tenantId, email: `advisory-owner-${suffix}@example.test`,
        passwordHash: 'unusable-synthetic-password', firstName: 'Synthetic',
        lastName: 'Owner', role: 'SUPER_USER',
      },
    });
    ownerId = owner.id;
    const admin = await db.user.create({
      data: {
        email: `advisory-admin-${suffix}@example.test`,
        passwordHash: 'unusable-synthetic-password', firstName: 'Synthetic',
        lastName: 'Administrator', role: 'SYSTEM_ADMIN', mfaEnabled: true,
      },
    });
    adminId = admin.id;
    await db.authSession.createMany({ data: [
      { userId: ownerId, tokenHash: hashToken(ownerToken), expiresAt: new Date(Date.now() + 600000) },
      { userId: adminId, tokenHash: hashToken(adminToken), expiresAt: new Date(Date.now() + 600000), mfaVerifiedAt: new Date() },
    ] });
    previousPolicy = await db.platformPolicy.findUnique({ where: { id: 'global' } });
    const history = await db.auditLog.findMany({
      where: { entityType: 'REFERRAL_POLICY' }, select: { details: true },
    });
    const versions = history.map((entry) => {
      const details = entry.details as { after?: unknown } | null;
      const parsed = referralPolicySchema.safeParse(details?.after);
      return parsed.success ? parsed.data.version : 0;
    });
    const current = referralPolicySchema.safeParse(previousPolicy?.referralPolicy);
    policyVersion = Math.max(current.success ? current.data.version : 0, ...versions) + 1;
    boundary.createSession.mockImplementation(async () => ({
      session: { state: { sessionId: `synthetic-eve:${randomUUID()}` } },
    }));
    boundary.attachSession.mockImplementation((sessionId: string) => ({
      send: (...args: unknown[]) => boundary.sendMessage(sessionId, ...args),
    }));
    boundary.sendMessage.mockImplementation(async (sessionId: string) => ({
      result: async () => ({
        status: 'complete', sessionId,
        message: 'Which products and official prices should this synthetic clinic offer?',
        events: [],
      }),
    }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    boundary.cookieValues.set(SESSION_COOKIE, ownerToken);
  });

  afterAll(async () => {
    const db = getDb();
    await db.auditLog.deleteMany({ where: { userId: adminId, entityType: 'REFERRAL_POLICY' } });
    if (previousPolicy) {
      await db.platformPolicy.update({ where: { id: 'global' }, data: {
        name: previousPolicy.name,
        referralPolicy: previousPolicy.referralPolicy === null
          ? Prisma.JsonNull : previousPolicy.referralPolicy as Prisma.InputJsonValue,
        updatedById: previousPolicy.updatedById, updatedAt: previousPolicy.updatedAt,
      } });
    } else {
      await db.platformPolicy.deleteMany({ where: { id: 'global', updatedById: adminId } });
    }
    await db.rateLimitBucket.deleteMany({
      where: { key: digest(`setup-chat:${tenantId}:${ownerId}`) },
    });
    await db.tenant.delete({ where: { id: tenantId } });
    await db.user.delete({ where: { id: adminId } });
    boundary.cookieValues.clear();
    vi.unstubAllEnvs();
    await db.$disconnect();
  });

  function request(path: string, method: string, body: unknown) {
    return new Request(`${origin}${path}`, {
      method, headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  const message = 'Set up a synthetic clinic catalog without proposing clinical protocols.';
  const setupRequest = (key: string, text = message) =>
    request('/api/setup', 'POST', { locationId, message: text, idempotencyKey: key });
  function policy(version: number): ReferralPolicy {
    return {
      version, creditCents: 2500, currency: 'USD', attributionDays: 30,
      qualification: 'FIRST_PAID_PLATFORM_SUBSCRIPTION', refundReversesCredit: true,
      expiryDays: null,
    };
  }
  const policyRequest = (value: ReferralPolicy | null) =>
    request('/api/platform', 'PATCH', { referralPolicy: value });

  test('setup creates a durable owner conversation and replays without another model operation', async () => {
    const key = randomUUID();
    const response = await setup(setupRequest(key), undefined);
    expect(response.status).toBe(200);
    const output = await response.json();
    const conversation = await getDb().setupConversation.findUniqueOrThrow({
      where: { id: output.conversationId },
    });
    expect(conversation).toMatchObject({ tenantId, userId: ownerId, locationId });
    expect(conversation.eveSessionId).toBe(output.eveSessionId);
    expect(conversation.messages).toMatchObject([{ role: 'user' }, { role: 'assistant' }]);
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: output.generationId } }))
      .toMatchObject({ kind: 'SETUP_CHAT', status: 'COMPLETE', tenantId, userId: ownerId });
    const replay = await setup(setupRequest(key), undefined);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(output);
    expect(boundary.createSession).toHaveBeenCalledTimes(1);
    expect(boundary.sendMessage).toHaveBeenCalledTimes(1);
    const conflict = await setup(setupRequest(key, 'A different synthetic setup message.'), undefined);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  test('an in-flight setup replay reuses its durable conversation and generation', async () => {
    const db = getDb();
    const before = await db.setupConversation.count({ where: { tenantId } });
    const key = randomUUID();
    let started!: () => void;
    let finish!: () => void;
    const modelStarted = new Promise<void>((resolve) => { started = resolve; });
    const modelFinished = new Promise<void>((resolve) => { finish = resolve; });
    const complete = boundary.sendMessage.getMockImplementation()!;
    boundary.sendMessage.mockImplementationOnce(async (...args) => {
      started();
      await modelFinished;
      return complete(...args);
    });
    const initial = setup(setupRequest(key), undefined);
    try {
      expect(await Promise.race([
        modelStarted.then(() => 'model-running'), initial.then(() => 'finished-early'),
      ])).toBe('model-running');
      const replay = await setup(setupRequest(key), undefined);
      expect(replay.status).toBe(202);
      const pending = await replay.json();
      expect(pending.status).toBe('running');
      finish();
      const response = await initial;
      expect(response.status).toBe(200);
      const output = await response.json();
      expect(output.conversationId).toBe(pending.conversationId);
      expect(output.generationId).toBe(pending.generationId);
    } finally {
      finish();
      await initial;
    }
    expect(await db.setupConversation.count({ where: { tenantId } })).toBe(before + 1);
    expect(await db.generationJob.count({
      where: { tenantId, idempotencyKey: `setup-message:${key}` },
    })).toBe(1);
    expect(boundary.createSession).toHaveBeenCalledTimes(1);
    expect(boundary.sendMessage).toHaveBeenCalledTimes(1);
  });

  test('platform policy publishing records history and rejects reused versions after clearing', async () => {
    boundary.cookieValues.set(SESSION_COOKIE, adminToken);
    const value = policy(policyVersion);
    const response = await publishPolicy(policyRequest(value), undefined);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ policy: value });
    expect(await getDb().platformPolicy.findUniqueOrThrow({ where: { id: 'global' } }))
      .toMatchObject({ referralPolicy: value, updatedById: adminId });
    expect(await getDb().auditLog.findMany({
      where: { userId: adminId, entityType: 'REFERRAL_POLICY' },
    })).toMatchObject([{ details: { after: value } }]);
    expect((await publishPolicy(policyRequest(null), undefined)).status).toBe(200);
    const reused = await publishPolicy(policyRequest(value), undefined);
    expect(reused.status).toBe(409);
    expect(await getDb().auditLog.count({
      where: { userId: adminId, entityType: 'REFERRAL_POLICY' },
    })).toBe(2);
  });

  test('concurrent policy publishes serialize the version check and create one audit record', async () => {
    boundary.cookieValues.set(SESSION_COOKIE, adminToken);
    const value = policy(policyVersion + 1);
    const db = getDb();
    const before = await db.auditLog.count({ where: { userId: adminId, entityType: 'REFERRAL_POLICY' } });
    const results = await Promise.allSettled([
      setReferralPolicy(adminId, value), setReferralPolicy(adminId, value),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toMatchObject([
      { reason: { status: 409 } },
    ]);
    expect(await db.platformPolicy.findUniqueOrThrow({ where: { id: 'global' } }))
      .toMatchObject({ referralPolicy: value, updatedById: adminId });
    expect(await db.auditLog.count({ where: { userId: adminId, entityType: 'REFERRAL_POLICY' } }))
      .toBe(before + 1);
  });
});
