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
import { GET as overview, PATCH as publishPolicy } from '../app/api/platform/route';
import { hashToken, SESSION_COOKIE } from './auth';
import { getDb } from './db';
import { setReferralPolicy } from './platform';
import { attributeReferral } from './billing';

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  if (!/\/(?:dripwell_verification|dripwell_task040_verification)(?:\?|$)/.test(testUrl))
    throw new Error('Advisory lock tests require the isolated verification database.');
  if (new URL(testUrl).pathname === '/dripwell_task040_verification' &&
      (new URL(testUrl).hostname !== '127.0.0.1' || new URL(testUrl).port !== '55432'))
    throw new Error('The owned TASK040 database must use the verified loopback binding.');
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
  const staffToken = randomBytes(32).toString('base64url');
  const ownedAdditionalTenants: string[] = [];
  const ownedAdditionalSetupRateKeys: string[] = [];
  const origin = 'https://synthetic-advisory.example.test';
  const digest = (value: string) => createHash('sha256').update(value).digest('hex');

  beforeAll(async () => {
    vi.stubEnv('APP_URL', origin);
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-external-boundary-no-network');
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    vi.stubEnv('STRIPE_PRICE_ID', '');
    vi.stubEnv('PLATFORM_SUBSCRIPTION_CENTS', '');
    vi.stubEnv('PLATFORM_SUBSCRIPTION_CURRENCY', '');
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
    const staff = await db.user.create({
      data: {
        tenantId, email: `advisory-staff-${suffix}@example.test`,
        passwordHash: 'unusable-synthetic-password', firstName: 'Synthetic',
        lastName: 'Staff', role: 'PROVIDER',
      },
    });
    await db.authSession.createMany({ data: [
      { userId: ownerId, tokenHash: hashToken(ownerToken), expiresAt: new Date(Date.now() + 600000) },
      { userId: adminId, tokenHash: hashToken(adminToken), expiresAt: new Date(Date.now() + 600000), mfaVerifiedAt: new Date() },
      { userId: staff.id, tokenHash: hashToken(staffToken), expiresAt: new Date(Date.now() + 600000) },
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
      where: { key: { in: [digest(`setup-chat:${tenantId}:${ownerId}`), ...ownedAdditionalSetupRateKeys] } },
    });
    await db.referral.deleteMany({ where: { referrerTenantId: tenantId, referredTenantId: { in: ownedAdditionalTenants } } });
    await db.tenant.delete({ where: { id: tenantId } });
    await db.tenant.deleteMany({ where: { id: { in: ownedAdditionalTenants } } });
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
  async function failedSetup(key: string) {
    const response = await setup(setupRequest(key), undefined);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'AI_PROCESSING_FAILED' });
    const db = getDb();
    const job = await db.generationJob.findUniqueOrThrow({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: `setup-message:${key}` } },
    });
    expect(job).toMatchObject({ kind: 'SETUP_CHAT', status: 'FAILED', userId: ownerId,
      errorCode: 'AI_PROCESSING_FAILED', completedAt: expect.any(Date) });
    const payload = job.result;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        typeof payload.conversationId !== 'string') throw new Error('Missing saved setup identity.');
    const conversation = await db.setupConversation.findUniqueOrThrow({ where: { id: payload.conversationId } });
    expect(payload).toEqual({ conversationId: conversation.id, messageHash: digest(message) });
    expect(conversation).toMatchObject({ tenantId, locationId, userId: ownerId });
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.messages).toMatchObject([{ id: `${job.id}:user`, role: 'user', text: message }]);
    return { job, conversation };
  }
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

  test.each(['session creation', 'message send'])(
    'a failed setup %s can retry the unchanged message without duplicating its identity',
    async (failureStage) => {
      if (failureStage === 'session creation')
        boundary.createSession.mockRejectedValueOnce(new Error('Synthetic temporary session failure.'));
      else boundary.sendMessage.mockRejectedValueOnce(new Error('Synthetic temporary send failure.'));
      const key = randomUUID();
      const { job: failed, conversation } = await failedSetup(key);
      const db = getDb();
      const configurations = await db.clinicConfigurationVersion.findMany({ where: { tenantId } });
      const response = await setup(setupRequest(key), undefined);
      expect(response.status).toBe(200);
      const output = await response.json();
      expect(output).toMatchObject({ conversationId: conversation.id, generationId: failed.id,
        activeConfigurationChanged: false });
      const complete = await db.generationJob.findUniqueOrThrow({ where: { id: failed.id } });
      expect(complete).toMatchObject({ status: 'COMPLETE', errorCode: null, completedAt: expect.any(Date),
        idempotencyKey: failed.idempotencyKey, userId: failed.userId, tenantId: failed.tenantId });
      expect(complete.createdAt).toEqual(failed.createdAt);
      const saved = await db.setupConversation.findUniqueOrThrow({ where: { id: conversation.id } });
      expect(saved.messages).toHaveLength(2);
      expect(saved.messages).toMatchObject([{ id: `${failed.id}:user`, role: 'user', text: message },
        { id: `${failed.id}:assistant`, role: 'assistant' }]);
      if (conversation.eveSessionId) expect(saved.eveSessionId).toBe(conversation.eveSessionId);
      expect(await db.generationJob.count({ where: { tenantId, idempotencyKey: failed.idempotencyKey } })).toBe(1);
      expect(await db.clinicConfigurationVersion.findMany({ where: { tenantId } })).toEqual(configurations);
      const replay = await setup(setupRequest(key), undefined);
      expect(replay.status).toBe(200);
      expect(await replay.json()).toEqual(output);
      expect(boundary.createSession).toHaveBeenCalledTimes(failureStage === 'session creation' ? 2 : 1);
      expect(boundary.sendMessage).toHaveBeenCalledTimes(failureStage === 'session creation' ? 1 : 2);
    },
  );

  test('overlapping failed setup retries claim one running job and perform one additional send', async () => {
    boundary.sendMessage.mockRejectedValueOnce(new Error('Synthetic temporary send failure.'));
    const key = randomUUID();
    const { job: failed, conversation } = await failedSetup(key);
    const db = getDb();
    const conversationCount = await db.setupConversation.count({ where: { tenantId } });
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
    const retry = setup(setupRequest(key), undefined);
    try {
      expect(await Promise.race([
        modelStarted.then(() => 'model-running'), retry.then(() => 'finished-early'),
      ])).toBe('model-running');
      expect(await db.generationJob.findUniqueOrThrow({ where: { id: failed.id } }))
        .toMatchObject({ status: 'RUNNING', errorCode: null, completedAt: null, result: failed.result });
      const replay = await setup(setupRequest(key), undefined);
      expect(replay.status).toBe(202);
      expect(await replay.json()).toMatchObject({ status: 'running', errorCode: null,
        conversationId: conversation.id, generationId: failed.id, jobId: failed.id });
      expect(boundary.sendMessage).toHaveBeenCalledTimes(2);
      finish();
      const response = await retry;
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ conversationId: conversation.id, generationId: failed.id });
    } finally {
      finish();
      await retry;
    }
    expect(await db.setupConversation.count({ where: { tenantId } })).toBe(conversationCount);
    expect(await db.generationJob.count({ where: { tenantId, idempotencyKey: failed.idempotencyKey } })).toBe(1);
    expect((await db.setupConversation.findUniqueOrThrow({ where: { id: conversation.id } })).messages)
      .toMatchObject([{ id: `${failed.id}:user`, role: 'user' }, { id: `${failed.id}:assistant`, role: 'assistant' }]);
    expect(boundary.createSession).toHaveBeenCalledTimes(1);
    expect(boundary.sendMessage).toHaveBeenCalledTimes(2);
  });

  test('failed setup claims reject conflicting messages, conversations, locations, owners, tenants and job kinds', async () => {
    boundary.sendMessage.mockRejectedValueOnce(new Error('Synthetic temporary send failure.'));
    const key = randomUUID();
    const { job: failed, conversation } = await failedSetup(key);
    const db = getDb();
    const assertUnchanged = async () => {
      expect(await db.generationJob.findUniqueOrThrow({ where: { id: failed.id } })).toEqual(failed);
      expect(await db.setupConversation.findUniqueOrThrow({ where: { id: conversation.id } })).toEqual(conversation);
      expect(boundary.sendMessage).toHaveBeenCalledTimes(1);
    };
    const deny = async (body: unknown, status = 409) => {
      const response = await setup(request('/api/setup', 'POST', body), undefined);
      expect(response.status).toBe(status);
      if (status === 409) expect(await response.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      await assertUnchanged();
    };
    const body = { locationId, message, idempotencyKey: key };
    await deny({ ...body, message: 'A different synthetic setup message.' });
    const otherLocation = await db.location.create({ data: { tenantId, name: 'Synthetic second setup location' } });
    await deny({ ...body, locationId: otherLocation.id });
    const otherConversation = await db.setupConversation.create({ data: { tenantId, locationId, userId: ownerId } });
    await deny({ ...body, conversationId: otherConversation.id });
    const otherOwner = await db.user.create({ data: { tenantId, role: 'SUPER_USER',
      email: `synthetic-retry-owner-${randomUUID()}@example.test`, passwordHash: 'unusable-synthetic-password',
      firstName: 'Synthetic', lastName: 'Other owner' } });
    const otherToken = randomBytes(32).toString('base64url');
    await db.authSession.create({ data: { userId: otherOwner.id, tokenHash: hashToken(otherToken),
      expiresAt: new Date(Date.now() + 600000) } });
    ownedAdditionalSetupRateKeys.push(digest(`setup-chat:${tenantId}:${otherOwner.id}`));
    const foreign = await db.tenant.create({ data: { name: 'Synthetic retry control clinic',
      slug: `synthetic-retry-${randomUUID()}`, state: 'TEST', medicalDirector: 'Synthetic fixture' } });
    ownedAdditionalTenants.push(foreign.id);
    const foreignLocation = await db.location.create({ data: { tenantId: foreign.id, name: 'Synthetic foreign location' } });
    const foreignOwner = await db.user.create({ data: { tenantId: foreign.id, role: 'SUPER_USER',
      email: `synthetic-retry-foreign-${randomUUID()}@example.test`, passwordHash: 'unusable-synthetic-password',
      firstName: 'Synthetic', lastName: 'Foreign owner' } });
    const foreignToken = randomBytes(32).toString('base64url');
    await db.authSession.create({ data: { userId: foreignOwner.id, tokenHash: hashToken(foreignToken),
      expiresAt: new Date(Date.now() + 600000) } });
    ownedAdditionalSetupRateKeys.push(digest(`setup-chat:${foreign.id}:${foreignOwner.id}`));
    try {
      boundary.cookieValues.set(SESSION_COOKIE, otherToken);
      await deny(body);
      boundary.cookieValues.set(SESSION_COOKIE, foreignToken);
      await deny(body, 404);
      await deny({ ...body, locationId: foreignLocation.id, conversationId: conversation.id }, 404);
      expect(await db.generationJob.count({ where: { tenantId: foreign.id } })).toBe(0);
      expect(await db.setupConversation.count({ where: { tenantId: foreign.id } })).toBe(0);
    } finally {
      boundary.cookieValues.set(SESSION_COOKIE, ownerToken);
    }
    const wrongKind = await db.generationJob.update({ where: { id: failed.id }, data: { kind: 'SUMMARY' } });
    try {
      const response = await setup(setupRequest(key), undefined);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expect(await db.generationJob.findUniqueOrThrow({ where: { id: failed.id } })).toEqual(wrongKind);
      expect(await db.setupConversation.findUniqueOrThrow({ where: { id: conversation.id } })).toEqual(conversation);
    } finally {
      await db.generationJob.update({ where: { id: failed.id }, data: { kind: failed.kind } });
    }
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

  test('commercial policy overview and publication require the current platform identity and MFA', async () => {
    const db = getDb();
    const before = await db.platformPolicy.findUnique({ where: { id: 'global' } });
    const logs = await db.auditLog.count({ where: { entityType: 'REFERRAL_POLICY' } });
    for (const token of [null, ownerToken, staffToken]) {
      if (token) boundary.cookieValues.set(SESSION_COOKIE, token);
      else boundary.cookieValues.delete(SESSION_COOKIE);
      const status = token === null ? 401 : 403;
      expect((await overview(new Request(`${origin}/api/platform`), undefined)).status).toBe(status);
      expect((await publishPolicy(policyRequest(policy(policyVersion + 2)), undefined)).status).toBe(status);
    }
    boundary.cookieValues.set(SESSION_COOKIE, adminToken);
    await db.user.update({ where: { id: adminId }, data: { mfaEnabled: false } });
    try {
      expect((await overview(new Request(`${origin}/api/platform`), undefined)).status).toBe(403);
      expect((await publishPolicy(policyRequest(policy(policyVersion + 2)), undefined)).status).toBe(403);
    } finally {
      await db.user.update({ where: { id: adminId }, data: { mfaEnabled: true } });
    }
    await db.authSession.update({ where: { tokenHash: hashToken(adminToken) }, data: { mfaVerifiedAt: null } });
    try {
      expect((await overview(new Request(`${origin}/api/platform`), undefined)).status).toBe(401);
      expect((await publishPolicy(policyRequest(policy(policyVersion + 2)), undefined)).status).toBe(401);
    } finally {
      await db.authSession.update({ where: { tokenHash: hashToken(adminToken) }, data: { mfaVerifiedAt: new Date() } });
    }
    expect(await db.platformPolicy.findUnique({ where: { id: 'global' } })).toEqual(before);
    expect(await db.auditLog.count({ where: { entityType: 'REFERRAL_POLICY' } })).toBe(logs);
  });

  test('commercial starter prefill preserves active overrides and disabled history through reenabling', async () => {
    boundary.cookieValues.set(SESSION_COOKIE, adminToken);
    const db = getDb();
    const before = await db.platformPolicy.findUniqueOrThrow({ where: { id: 'global' } });
    const reply = await overview(new Request(`${origin}/api/platform`), undefined);
    expect(reply.status).toBe(200);
    const data = await reply.json();
    expect(data.policy).toEqual(policy(policyVersion + 1));
    expect(data.nextPolicyVersion).toBe(policyVersion + 2);
    expect(data.starterPolicy).toEqual({ ...policy(policyVersion + 2), creditCents: 5000 });
    expect(data.subscriptionOffer).toMatchObject({ checkoutReady: false, terms: { amountCents: 19900, currency: 'USD' } });
    expect(await db.platformPolicy.findUniqueOrThrow({ where: { id: 'global' } })).toEqual(before);
    expect((await publishPolicy(policyRequest(data.starterPolicy), undefined)).status).toBe(200);

    const code = `synthetic-commercial-${randomUUID()}`;
    await db.tenant.update({ where: { id: tenantId }, data: { referralCode: code } });
    const referred = await db.tenant.create({
      data: { name: 'Synthetic versioned referral', slug: code, state: 'TEST', medicalDirector: 'Synthetic fixture' },
    });
    ownedAdditionalTenants.push(referred.id);
    const subscription = await db.subscription.create({
      data: { tenantId: referred.id, status: 'TRIAL', trialLimit: 10, trialUsed: 3,
        trialActivatedAt: new Date(), trialEndsAt: new Date(Date.now() + 14 * 86400000) },
    });
    await db.$transaction(tx => attributeReferral(tx, referred.id, code));
    const snapshot = await db.referral.findUniqueOrThrow({ where: { referredTenantId: referred.id } });
    expect(snapshot.policyVersion).toBe(data.nextPolicyVersion);
    expect(snapshot.policySnapshot).toEqual(data.starterPolicy);

    const custom = { ...policy(policyVersion + 3), creditCents: 7500, currency: 'CAD', attributionDays: 60, refundReversesCredit: false, expiryDays: 90 };
    expect((await publishPolicy(policyRequest(custom), undefined)).status).toBe(200);
    const customOverview = await (await overview(new Request(`${origin}/api/platform`), undefined)).json();
    expect(customOverview.policy).toEqual(custom);
    expect(customOverview.starterPolicy.creditCents).toBe(5000);
    expect(customOverview.nextPolicyVersion).toBe(policyVersion + 4);
    expect((await publishPolicy(policyRequest(null), undefined)).status).toBe(200);
    const disabled = await (await overview(new Request(`${origin}/api/platform`), undefined)).json();
    expect(disabled.policy).toBeNull();
    expect(disabled.nextPolicyVersion).toBe(policyVersion + 4);
    expect(disabled.starterPolicy).toEqual({ ...policy(policyVersion + 4), creditCents: 5000 });
    expect((await publishPolicy(policyRequest(disabled.starterPolicy), undefined)).status).toBe(200);
    expect((await publishPolicy(policyRequest(custom), undefined)).status).toBe(409);
    expect(await db.referral.findUniqueOrThrow({ where: { id: snapshot.id } })).toEqual(snapshot);
    expect(await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).toEqual(subscription);
    expect(await db.creditLedger.count({ where: { referralId: snapshot.id } })).toBe(0);
  });
});
