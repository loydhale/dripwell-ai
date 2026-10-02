import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { emptyConsultationSummary, type ClinicConfiguration } from '@dripwell/shared/v2';

vi.mock('server-only', () => ({}));
const cookieValues = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (key: string) => cookieValues.has(key) ? { value: cookieValues.get(key) } : undefined }),
}));

import { GET as readJob } from '../app/api/jobs/[id]/route';
import { waitForJob } from '../components/job-client';
import { getConsultation, mutateClinicAction } from './clinic';
import { getActorFromRequest, hashToken, SESSION_COOKIE, type ClinicActor } from './auth';
import { getDb } from './db';
import { jsonValue } from './recordings';

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/dripwell_verification') {
    throw new Error('Job result tests require the isolated verification database.');
  }
  process.env.DATABASE_URL = testUrl;
}
const suite = testUrl ? describe : describe.skip;
const config: ClinicConfiguration = {
  schemaVersion: 2, clinic: { name: 'Synthetic job clinic', currency: 'USD', contact: '', brandColor: '#0d9488' },
  questions: [{ id: 'synthetic-eligible', text: 'Synthetic eligibility confirmed?', why: 'Test fixture only',
    type: 'BOOLEAN', options: [], required: true, safetyRelevant: true, activeWhen: [], priority: 1 }],
  products: [{
    id: 'synthetic-iv', name: 'Synthetic IV fixture', type: 'DRIP', description: 'Test fixture only',
    priceCents: 10000, currency: 'USD', available: true, ingredients: [], goalTags: ['wellness'],
    compatibleWith: [], benefits: [], terms: '', clinical: true, priority: 1,
    rules: { validated: true, validationNote: 'Synthetic protocol only',
      eligibility: [{ questionId: 'synthetic-eligible', operator: 'EQ', value: true }], exclusions: [], rationale: 'Synthetic eligibility only' },
  }],
  recommendationPolicy: { clinicalValidated: true, validatedBy: 'Synthetic provider', validationNote: 'Synthetic only', maxAddOns: 0, maxWellnessOffers: 0 },
  reminders: { careOutcomeHours: 24, wellnessDecisionHours: 24 }, retention: { audioDays: 1, documentDays: 1, shareExpiryHours: 1 },
};

suite('addressable generation results against isolated PostgreSQL', () => {
  const tenantIds: string[] = [];
  let owner: ClinicActor;
  let ownerToken: string;
  let staffToken: string;
  let anotherOwnerToken: string;
  let foreignToken: string;
  let visitId: string;
  let foreignJobId: string;

  async function response(jobId: string) {
    return readJob(new Request(`https://synthetic-jobs.example.test/api/jobs/${jobId}`), { params: Promise.resolve({ id: jobId }) });
  }
  async function member(tenantId: string, role: 'SUPER_USER' | 'STAFF') {
    const user = await getDb().user.create({ data: {
      tenantId, email: `jobs-${randomUUID()}@example.test`, passwordHash: 'unusable-synthetic-password',
      firstName: 'Synthetic', lastName: role, role, canApproveClinical: role === 'SUPER_USER',
    } });
    const token = randomBytes(32).toString('base64url');
    await getDb().authSession.create({ data: {
      userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 600000),
    } });
    return { user, token };
  }
  async function fixture() {
    const tenant = await getDb().tenant.create({ data: {
      name: 'Synthetic jobs fixture', slug: `jobs-${randomUUID()}`, state: 'TEST', medicalDirector: 'Synthetic fixture',
    } });
    tenantIds.push(tenant.id);
    const location = await getDb().location.create({ data: { tenantId: tenant.id, name: 'Synthetic job location' } });
    const user = await member(tenant.id, 'SUPER_USER');
    const version = await getDb().clinicConfigurationVersion.create({ data: {
      tenantId: tenant.id, locationId: location.id, version: 1, status: 'ACTIVE',
      payload: JSON.parse(JSON.stringify(config)), source: 'Synthetic test only', userId: user.user.id,
    } });
    const visit = await getDb().consultation.create({ data: {
      tenantId: tenant.id, locationId: location.id, providerId: user.user.id,
      configurationVersionId: version.id, reference: `SYNTHETIC-${randomUUID()}`, idempotencyKey: randomUUID(),
      isTest: true, summary: { ...emptyConsultationSummary(), staffReviewed: true, goals: ['wellness'],
        answers: { 'synthetic-eligible': { value: true, status: 'CONFIRMED', source: 'STAFF', evidence: 'Synthetic answer only' } } },
    } });
    return { tenant, location, member: user, visit };
  }
  async function action(name: string, fields: Record<string, unknown> = {}) {
    const current = (await getConsultation(owner, visitId)).consultation;
    return mutateClinicAction(owner, { action: name, consultationId: visitId, expectedVersion: current.version, ...fields });
  }
  async function savedJob(status: string, result: Record<string, unknown>, kind = 'SUMMARY', consultationId: string | null = visitId) {
    return getDb().generationJob.create({ data: {
      tenantId: owner.tenantId, consultationId, userId: owner.userId, kind, status,
      idempotencyKey: randomUUID(), model: 'synthetic-provider-fixture', promptVersion: 'synthetic-only',
      result: jsonValue(result), usage: { inputTokens: 3, outputTokens: 5, costUsd: null },
      completedAt: ['COMPLETE', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(status) ? new Date() : null,
      errorCode: status === 'FAILED' ? 'SYNTHETIC_FAILURE' : null,
    } });
  }
  beforeAll(async () => {
    const local = await fixture();
    ownerToken = local.member.token;
    visitId = local.visit.id;
    owner = (await getActorFromRequest(new Request('https://synthetic-jobs.example.test', {
      headers: { cookie: `${SESSION_COOKIE}=${ownerToken}` },
    })))!;
    staffToken = (await member(local.tenant.id, 'STAFF')).token;
    anotherOwnerToken = (await member(local.tenant.id, 'SUPER_USER')).token;
    const foreign = await fixture();
    foreignToken = foreign.member.token;
    const job = await getDb().generationJob.create({ data: {
      tenantId: foreign.tenant.id, consultationId: foreign.visit.id, userId: foreign.member.user.id,
      kind: 'INITIAL', status: 'COMPLETE', idempotencyKey: randomUUID(), model: 'synthetic-rules',
      promptVersion: 'synthetic-only', result: { locationId: foreign.location.id, message: 'Foreign synthetic result' },
    } });
    foreignJobId = job.id;
    // Exercise the actual client against the actual route and database, replacing only browser transport.
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      const id = path.split('/').at(-1)!;
      return response(id);
    }));
    vi.stubGlobal('window', { setTimeout: (callback: () => void) => setTimeout(callback, 0), location: { assign: vi.fn() } });
  });
  beforeEach(() => { cookieValues.set(SESSION_COOKIE, ownerToken); });
  afterAll(async () => {
    const db = getDb();
    for (const tenantId of tenantIds) {
      await db.consultation.deleteMany({ where: { tenantId } });
      await db.generationJob.deleteMany({ where: { tenantId } });
      await db.clinicConfigurationVersion.deleteMany({ where: { tenantId } });
      await db.user.deleteMany({ where: { tenantId } });
      await db.location.deleteMany({ where: { tenantId } });
      await db.tenant.delete({ where: { id: tenantId } });
    }
    await db.$disconnect();
    vi.unstubAllGlobals();
  });

  test('returns actual deterministic initial and wellness results with canonical success while preserving provenance', async () => {
    await action('consultation.initial.generate');
    await action('consultation.initial.approve');
    const initial = (await getConsultation(owner, visitId)).consultation.initialRecommendation!;
    await action('consultation.care.record', { actualCare: { outcome: 'STARTED', items: initial.items,
      observations: 'Synthetic fixture care', reason: '', currency: 'USD' } });
    await action('consultation.wellness.generate');
    for (const kind of ['INITIAL', 'WELLNESS']) {
      const saved = await getDb().generationJob.findFirstOrThrow({ where: { tenantId: owner.tenantId, consultationId: visitId, kind } });
      expect(saved.status).toBe('COMPLETE');
      const result = await response(saved.id);
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({ status: 'complete', result: saved.result,
        model: 'deterministic-rules', promptVersion: 'dripwell-rules-v2.1', completedAt: saved.completedAt!.toISOString() });
      expect(await waitForJob(saved.id)).toEqual(saved.result);
      expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: saved.id } })).toEqual(saved);
    }
  });

  test('reopens already-persisted COMPLETED and workflow-style COMPLETE results through the polling client', async () => {
    for (const status of ['COMPLETED', 'COMPLETE']) {
      const saved = await savedJob(status, { summary: { goals: ['Synthetic saved output'] }, summaryApplied: false });
      cookieValues.set(SESSION_COOKIE, staffToken);
      expect(await (await response(saved.id)).json()).toMatchObject({ status: 'complete', result: saved.result });
      expect(await waitForJob(saved.id)).toEqual(saved.result);
      expect((await getDb().generationJob.findUniqueOrThrow({ where: { id: saved.id } })).status).toBe(status);
    }
  });

  test('hides unfinished, failed, cancelled and upload-internal results and preserves failure handling', async () => {
    for (const status of ['PENDING', 'QUEUING', 'RUNNING', 'FAILED', 'CANCELLED']) {
      const saved = await savedJob(status, { privatePartialOutput: 'Synthetic hidden fixture' });
      expect(await (await response(saved.id)).json()).toMatchObject({
        status: status === 'QUEUING' ? 'pending' : status.toLowerCase(), result: null,
      });
      if (status === 'FAILED') await expect(waitForJob(saved.id)).rejects.toThrow('SYNTHETIC_FAILURE');
      if (status === 'CANCELLED') await expect(waitForJob(saved.id)).rejects.toThrow('canceled');
    }
    for (const status of ['COMPLETE', 'COMPLETED']) {
      const upload = await savedJob(status, { blobPath: 'private/synthetic-upload-pointer' }, 'RECORDING_UPLOAD');
      expect(await (await response(upload.id)).json()).toMatchObject({ status: 'complete', result: null });
    }
  });

  test('polls a running job until its saved complete result is available', async () => {
    const saved = await savedJob('RUNNING', { privatePartialOutput: 'Synthetic hidden fixture' });
    const result = { summary: { goals: ['Synthetic final output'] }, summaryApplied: true };
    vi.mocked(fetch).mockImplementationOnce(async () => {
      const pending = await response(saved.id);
      expect(await pending.clone().json()).toMatchObject({ status: 'running', result: null });
      await getDb().generationJob.update({ where: { id: saved.id }, data: {
        status: 'COMPLETE', result, completedAt: new Date(),
      } });
      return pending;
    });
    await expect(waitForJob(saved.id)).resolves.toEqual(result);
  });

  test('denies foreign clinic results and setup jobs belonging to another owner or ordinary staff', async () => {
    expect((await response(foreignJobId)).status).toBe(404);
    const local = await savedJob('COMPLETE', { message: 'Synthetic owner-only setup result' }, 'SETUP_CHAT', null);
    expect((await response(local.id)).status).toBe(200);
    for (const token of [staffToken, anotherOwnerToken]) {
      cookieValues.set(SESSION_COOKIE, token);
      expect((await response(local.id)).status).toBe(403);
    }
    cookieValues.set(SESSION_COOKIE, foreignToken);
    expect((await response(local.id)).status).toBe(404);
    cookieValues.delete(SESSION_COOKIE);
    expect((await response(local.id)).status).toBe(401);
    cookieValues.set(SESSION_COOKIE, ownerToken);
    expect((await response('invalid-id')).status).toBe(400);
  });

  test('preserves authorized tenant-wide consultation reads at a second clinic location', async () => {
    const db = getDb();
    const location = await db.location.create({ data: { tenantId: owner.tenantId, name: 'Second synthetic job location' } });
    const version = await db.clinicConfigurationVersion.create({ data: {
      tenantId: owner.tenantId, locationId: location.id, version: 1, status: 'ACTIVE',
      payload: JSON.parse(JSON.stringify(config)), source: 'Synthetic location scope test', userId: owner.userId,
    } });
    const visit = await db.consultation.create({ data: {
      tenantId: owner.tenantId, locationId: location.id, providerId: owner.userId,
      configurationVersionId: version.id, reference: `SYNTHETIC-SECOND-${randomUUID()}`, idempotencyKey: randomUUID(),
      isTest: true, summary: emptyConsultationSummary(),
    } });
    const job = await savedJob('COMPLETED', { reference: visit.reference, locationId: location.id }, 'INITIAL', visit.id);
    for (const token of [ownerToken, staffToken]) {
      cookieValues.set(SESSION_COOKIE, token);
      expect(await (await response(job.id)).json()).toMatchObject({ status: 'complete', result: job.result });
    }
    cookieValues.set(SESSION_COOKIE, foreignToken);
    expect((await response(job.id)).status).toBe(404);
  });
});
