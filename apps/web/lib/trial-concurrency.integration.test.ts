import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import type { ClinicActor } from './auth';
import type { ClinicConfiguration } from '@dripwell/shared/v2';

vi.mock('server-only', () => ({}));
vi.mock('workflow/api', () => ({ start: vi.fn(() => { throw new Error('Synthetic kickoff fenced'); }) }));

// This file may enable its isolated synthetic process only after this exact guard.
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (process.env.CI !== 'true' || process.env.DATABASE_URL !== testUrl ||
    !['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'localhost' ||
    url.port !== '5432' || url.pathname !== '/dripwell_verification' || url.username !== 'dripwell_test' ||
    url.search || url.hash || process.env.ALLOW_REAL_CLIENT_DATA !== 'false')
    throw new Error('Trial proof requires the explicit fresh disposable CI target and initial false flag');
}
const suite = testUrl ? describe : describe.skip;
type Db = ReturnType<typeof import('./db')['getDb']>;
type Tx = Prisma.TransactionClient;
const nonce = randomUUID();
const sentinel = new Error('Owned trial rollback after genuine writes');
const logical = new AsyncLocalStorage<Start>();
type Live = { generation: number; pid: number };
type Start = { key: string; mode: 'ROLLBACK' | 'RACE'; live?: Live; generation: number;
  created?: string; incremented: boolean; usage?: string; event?: string; injected: boolean; settled: boolean };
type Owner = { tenant: string; slug: string; user: string; session: string; location: string; configuration: string;
  subscription: string; visits: Set<string>; usages: Set<string>; events: Set<string>; keys: Set<string> };
function owner(): Owner {
  const tenant = randomUUID();
  return { tenant, slug: `trial-proof-${nonce}-${tenant}`, user: randomUUID(), session: randomUUID(),
    location: randomUUID(), configuration: randomUUID(), subscription: randomUUID(),
    visits: new Set(), usages: new Set(), events: new Set(), keys: new Set() };
}
const subject = owner(), control = owner();
let db: Db | undefined, proof: Proof | undefined, disconnected = false;
let restoreTransaction: (() => void) | undefined;
let releaseBlocker: (() => void) | undefined;
let flagChanged = false, closed = false;

class Proof {
  readonly began = performance.now();
  readonly pending = new Set<Promise<unknown>>();
  poisoned = false;
  firstError: unknown;
  require(cleanup = false) {
    if (this.poisoned) throw this.firstError ?? new Error('Trial proof permanently blocked');
    if (performance.now() - this.began >= (cleanup ? 30000 : 20000))
      throw new Error('Original trial proof deadline exceeded');
  }
  remaining() { return Math.max(0, Math.floor(30000 - (performance.now() - this.began))); }
  stop(error: unknown) { this.firstError ??= error; this.poisoned = true; }
  async wait<T>(promise: Promise<T>, cap = this.remaining()): Promise<T> {
    this.require(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([promise, new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('Trial proof work did not settle within its original budget');
          this.stop(error); reject(error);
        }, Math.min(cap, this.remaining()));
      })]);
      this.require(true);
      return value;
    } finally { if (timer) clearTimeout(timer); }
  }
  async work<T>(operation: () => PromiseLike<T>, cleanup = false, cap?: number): Promise<T> {
    this.require(cleanup);
    // Assimilate each real lazy PrismaPromise once; observers await this normal promise.
    const pending = Promise.resolve(operation());
    this.pending.add(pending);
    void pending.then(() => this.pending.delete(pending), () => this.pending.delete(pending));
    return this.wait(pending, cap);
  }
  async join() {
    this.require(true);
    while (this.pending.size) await this.wait(Promise.allSettled([...this.pending]));
    this.require(true);
  }
}
function current() { if (!proof) throw new Error('Proof clock not initialized'); return proof; }
function database() { if (!db) throw new Error('Guarded database not initialized'); return db; }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected owned result shape');
  return value as Record<string, unknown>;
}
function ownedResult(value: unknown, tenant: string) {
  const row = object(value);
  if (row.tenantId !== tenant || typeof row.id !== 'string') throw new Error('Unowned write result');
  return row;
}
function productOptions(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const options = object(value);
  return options.isolationLevel === Prisma.TransactionIsolationLevel.Serializable &&
    options.maxWait === 10000 && options.timeout === 20000;
}
async function limits(tx: Tx, cap = current().remaining()) {
  const milliseconds = String(Math.max(1, Math.min(cap, current().remaining())));
  await current().work(() => tx.$queryRaw`
    SELECT pg_catalog.set_config('statement_timeout', ${milliseconds}, true),
      pg_catalog.set_config('lock_timeout', ${milliseconds}, true)`, true);
}
async function boundedTx<T>(callback: (tx: Tx) => Promise<T>, cleanup = false, cap = current().remaining()) {
  current().require(cleanup);
  const timeout = Math.max(1, Math.min(cap, current().remaining()));
  let callbackError: unknown;
  return current().work(() => database().$transaction(async tx => {
    try { await limits(tx, timeout); return await callback(tx); }
    catch (error) { callbackError = error; throw error; }
  }, { maxWait: timeout, timeout }).catch(error => {
    if (error !== callbackError && !(error instanceof Prisma.PrismaClientKnownRequestError))
      current().stop(new Error('Owned setup/read/cleanup transaction settlement UNKNOWN'));
    throw error;
  }), cleanup, timeout);
}
const configuration: ClinicConfiguration = {
  schemaVersion: 2, clinic: { name: 'Synthetic nonclinical trial only', currency: 'USD', contact: '', brandColor: '#0d9488' },
  questions: [], products: [{ id: 'synthetic-service', name: 'Synthetic nonclinical service', type: 'SERVICE',
    description: 'Fixture, not care or a clinical protocol', priceCents: 1, currency: 'USD', available: true,
    ingredients: [], goalTags: [], compatibleWith: [], benefits: [], terms: '', clinical: false, priority: 0,
    rules: { validated: false, validationNote: '', eligibility: [], exclusions: [], rationale: '' } }],
  recommendationPolicy: { clinicalValidated: false, validatedBy: '', validationNote: '', maxAddOns: 0, maxWellnessOffers: 0 },
  reminders: { careOutcomeHours: 1, wellnessDecisionHours: 1 },
  retention: { audioDays: 1, documentDays: 1, shareExpiryHours: 1 },
};
async function seed(owned: Owner, count: number): Promise<ClinicActor> {
  const { activateTrial, emptyConsultationSummary } = await import('@dripwell/shared/v2');
  // IDs and exact logical keys are reserved before any fixture or product effect.
  const seeds = Array.from({ length: count }, (_, index) => ({ id: randomUUID(), usage: randomUUID(),
    event: randomUUID(), key: `trial-${nonce}-seed-${index}` }));
  for (const row of seeds) { owned.visits.add(row.id); owned.usages.add(row.usage); owned.events.add(row.event); owned.keys.add(row.key); }
  return boundedTx(async tx => {
    const tenant = await tx.tenant.create({ data: { id: owned.tenant, slug: owned.slug,
      name: 'Synthetic trial proof only', state: 'TEST', medicalDirector: 'No clinical fixture' } });
    await tx.location.create({ data: { id: owned.location, tenantId: owned.tenant, name: 'Synthetic location' } });
    const user = await tx.user.create({ data: { id: owned.user, tenantId: owned.tenant,
      email: `trial-${owned.user}@example.invalid`, passwordHash: 'unusable-synthetic-password',
      firstName: 'Synthetic', lastName: 'Staff', role: 'STAFF', canApproveClinical: false, mfaEnabled: false } });
    await tx.authSession.create({ data: { id: owned.session, userId: owned.user, tokenHash: randomUUID(),
      expiresAt: new Date(Date.now() + 3600000) } });
    // Direct ACTIVE nonclinical seed, not proof of an owner/clinical activation route.
    await tx.clinicConfigurationVersion.create({ data: { id: owned.configuration, tenantId: owned.tenant,
      locationId: owned.location, userId: owned.user, version: 1, status: 'ACTIVE',
      payload: JSON.parse(JSON.stringify(configuration)), source: `Synthetic trial ${nonce}`,
      activatedAt: new Date(), activatedById: owned.user } });
    await tx.subscription.create({ data: { id: owned.subscription, tenantId: owned.tenant,
      ...activateTrial(new Date()), trialUsed: count } });
    for (const row of seeds) {
      await tx.consultation.create({ data: { id: row.id, tenantId: owned.tenant, locationId: owned.location,
        providerId: owned.user, configurationVersionId: owned.configuration, reference: `fixture-${row.id}`,
        idempotencyKey: row.key, consentDeclined: true, summary: JSON.parse(JSON.stringify(emptyConsultationSummary())) } });
      await tx.trialUsage.create({ data: { id: row.usage, tenantId: owned.tenant, consultationId: row.id, idempotencyKey: row.key } });
      await tx.consultationEvent.create({ data: { id: row.event, tenantId: owned.tenant, consultationId: row.id,
        userId: owned.user, action: 'CONSULTATION_STARTED', after: { syntheticSeed: true } } });
    }
    return { id: user.id, userId: user.id, tenantId: tenant.id, tenant, locationId: owned.location,
      email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role,
      canApproveClinical: false, mfaEnabled: false, mfaVerified: false, mfaVerifiedAt: null, sessionId: owned.session };
  });
}
async function state(owned: Owner, cleanup = false) {
  return boundedTx(async tx => {
    const subscription = await tx.subscription.findUnique({ where: { tenantId: owned.tenant } });
    const visits = await tx.consultation.findMany({ where: { tenantId: owned.tenant },
      select: { id: true, idempotencyKey: true, reference: true, isTest: true }, orderBy: { id: 'asc' } });
    const usages = await tx.trialUsage.findMany({ where: { tenantId: owned.tenant },
      select: { id: true, consultationId: true, idempotencyKey: true }, orderBy: { id: 'asc' } });
    const events = await tx.consultationEvent.findMany({ where: { tenantId: owned.tenant },
      select: { id: true, consultationId: true, action: true }, orderBy: { id: 'asc' } });
    const notifications = await tx.notification.findMany({ where: { tenantId: owned.tenant }, select: { id: true, consultationId: true } });
    for (const row of visits) if (!owned.visits.has(row.id) || !owned.keys.has(row.idempotencyKey)) throw new Error('Untracked owned-tenant visit');
    for (const row of usages) if (!owned.usages.has(row.id) || !owned.visits.has(row.consultationId) || !owned.keys.has(row.idempotencyKey)) throw new Error('Untracked trial usage');
    for (const row of events) if (!owned.events.has(row.id) || !owned.visits.has(row.consultationId)) throw new Error('Untracked trial event');
    // Future due dates mean real reconciliation should not create notifications here.
    expect(notifications).toEqual([]);
    return { subscription, visits, usages, events, notifications };
  }, cleanup);
}

function observeTransaction() {
  const client = database(), original = client.$transaction;
  const observer: typeof client.$transaction = ((...args: unknown[]) => {
    const callback = args[0], selected = logical.getStore();
    if (typeof callback !== 'function' || !selected || !productOptions(args[1]))
      return Reflect.apply(original, client, args);
    let callbackError: unknown;
    const body = async (tx: Tx) => {
      const generation = ++selected.generation;
      selected.created = undefined; selected.incremented = false; selected.usage = undefined; selected.event = undefined;
      try {
        await limits(tx);
        const rows = await current().work(() => tx.$queryRaw<{ pid: number }[]>`SELECT pg_catalog.pg_backend_pid() AS pid`, true);
        if (rows.length !== 1 || !Number.isInteger(rows[0]!.pid)) throw new Error('Owned callback PID unavailable');
        selected.live = { generation, pid: rows[0]!.pid };
        const observed = new Proxy(tx, { get(target, key) {
          const delegate = Reflect.get(target, key, target);
          if (!['consultation', 'subscription', 'trialUsage', 'consultationEvent'].includes(String(key)))
            return typeof delegate === 'function' ? delegate.bind(target) : delegate;
          return new Proxy(delegate, { get(real, methodKey) {
            const method = Reflect.get(real, methodKey, real);
            const watches = (key === 'subscription' && methodKey === 'updateMany') ||
              (key !== 'subscription' && methodKey === 'create');
            if (!watches || typeof method !== 'function') return typeof method === 'function' ? method.bind(real) : method;
            return async (...input: unknown[]) => {
              const change = object(input[0]);
              const data = object(change.data);
              if (key === 'subscription') {
                if (object(change.where).id !== subject.subscription) throw new Error('Unowned subscription mutation');
                expect(object(data.trialUsed).increment).toBe(1);
              } else if (data.tenantId !== subject.tenant ||
                (key === 'consultation' ? data.idempotencyKey !== selected.key : data.consultationId !== selected.created))
                throw new Error('Unowned start write');
              // Each genuine delegate result is consumed once with real receiver/arguments.
              const value = await current().work(() => Promise.resolve(Reflect.apply(method, real, input)), true);
              if (key === 'subscription') {
                expect(object(value).count).toBe(1); selected.incremented = true;
              } else {
                const row = ownedResult(value, subject.tenant);
                if (key === 'consultation') {
                  expect(row.idempotencyKey).toBe(selected.key); expect(row.locationId).toBe(subject.location);
                  expect(row.providerId).toBe(subject.user);
                  selected.created = String(row.id); subject.visits.add(String(row.id));
                }
                if (key === 'trialUsage') {
                  expect(row.consultationId).toBe(selected.created); expect(row.idempotencyKey).toBe(selected.key);
                  selected.usage = String(row.id); subject.usages.add(String(row.id));
                }
                if (key === 'consultationEvent') {
                  expect(row.consultationId).toBe(selected.created); expect(row.action).toBe('CONSULTATION_STARTED');
                  expect(row.userId).toBe(subject.user);
                  selected.event = String(row.id); subject.events.add(String(row.id));
                  if (selected.mode === 'ROLLBACK') {
                    expect(selected.created && selected.incremented && selected.usage && selected.event).toBeTruthy();
                    selected.injected = true; throw sentinel;
                  }
                }
              }
              return value;
            };
          } });
        } });
        return await Reflect.apply(callback, undefined, [observed]);
      } catch (error) { callbackError = error; throw error; }
      finally { if (selected.live?.generation === generation) selected.live = undefined; }
    };
    return Promise.resolve(Reflect.apply(original, client, [body, ...args.slice(1)])).then(value => value, error => {
      const knownConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
      if (error !== callbackError && !knownConflict) current().stop(new Error('Owned transaction settlement UNKNOWN'));
      throw error;
    });
  }) as typeof client.$transaction;
  client.$transaction = observer;
  restoreTransaction = () => { client.$transaction = original; restoreTransaction = undefined; };
}
function startContext(key: string, mode: Start['mode']): Start {
  subject.keys.add(key); // Exact tenant/key reservation survives an UNKNOWN default UUID response.
  return { key, mode, generation: 0, incremented: false, injected: false, settled: false };
}
function waitChain(edges: Map<number, number[]>, from: number, blocker: number, allowed: Set<number>) {
  const seen = new Set<number>();
  function reaches(pid: number): boolean {
    if (pid === blocker) return true;
    if (seen.has(pid)) return false;
    seen.add(pid);
    return (edges.get(pid) ?? []).some(next => allowed.has(next) && reaches(next));
  }
  return reaches(from);
}
async function overlap(first: Start, second: Start, blocker: number, blockerLive: () => boolean) {
  for (let poll = 0; poll < 20; poll++) {
    current().require();
    const a = first.live, b = second.live;
    if (a && b && a.pid !== b.pid && blockerLive()) {
      const rows = await boundedTx(tx => tx.$queryRaw<{ pid: number; blockers: number[] }[]>`
        SELECT selected.pid, pg_catalog.pg_blocking_pids(selected.pid) AS blockers
        FROM pg_catalog.unnest(ARRAY[${a.pid}, ${b.pid}]::integer[]) AS selected(pid)`, false, 2000);
      if (first.live === a && second.live === b && blockerLive()) {
        const allowed = new Set([a.pid, b.pid, blocker]);
        const edges = new Map(rows.map(row => [row.pid, row.blockers]));
        if (rows.length === 2 && rows.every(row => allowed.has(row.pid) && row.blockers.every(pid => allowed.has(pid))) &&
          waitChain(edges, a.pid, blocker, allowed) && waitChain(edges, b.pid, blocker, allowed)) return;
      }
    }
    await current().work(() => new Promise<void>(resolve => setTimeout(resolve, 100)), false);
  }
  throw new Error('Two current owned callbacks were not observed in the blocker wait chain');
}
async function erase(owned: Owner) {
  const prior = await state(owned, true);
  if (prior.subscription && prior.subscription.id !== owned.subscription) throw new Error('Unowned subscription cleanup');
  await boundedTx(async tx => {
    await tx.consultation.deleteMany({ where: { tenantId: owned.tenant, id: { in: [...owned.visits] } } });
    await tx.clinicConfigurationVersion.deleteMany({ where: { id: owned.configuration, tenantId: owned.tenant } });
    await tx.authSession.deleteMany({ where: { id: owned.session, userId: owned.user } });
    await tx.subscription.deleteMany({ where: { id: owned.subscription, tenantId: owned.tenant } });
    await tx.user.deleteMany({ where: { id: owned.user, tenantId: owned.tenant } });
    await tx.location.deleteMany({ where: { id: owned.location, tenantId: owned.tenant } });
    await tx.tenant.deleteMany({ where: { id: owned.tenant, slug: owned.slug } });
  }, true);
  expect(await state(owned, true)).toEqual({ subscription: null, visits: [], usages: [], events: [], notifications: [] });
  await boundedTx(async tx => {
    expect(await tx.tenant.count({ where: { id: owned.tenant, slug: owned.slug } })).toBe(0);
    expect(await tx.location.count({ where: { id: owned.location, tenantId: owned.tenant } })).toBe(0);
    expect(await tx.user.count({ where: { id: owned.user, tenantId: owned.tenant } })).toBe(0);
    expect(await tx.authSession.count({ where: { id: owned.session, userId: owned.user } })).toBe(0);
    expect(await tx.clinicConfigurationVersion.count({ where: { id: owned.configuration, tenantId: owned.tenant } })).toBe(0);
  }, true);
}
function safeRecord(stage: string, fields: Record<string, boolean | number>) {
  current().require(true);
  console.info('TASK058_TRIAL_PROOF', JSON.stringify({ stage, ...fields }));
  current().require(true);
}

suite('owned trial concurrency PostgreSQL', () => {
  afterEach(() => { if (proof) { proof.require(true); expect(closed && disconnected && proof.pending.size === 0).toBe(true); } });
  afterAll(() => { if (proof) { proof.require(true); expect(closed && disconnected && !flagChanged && !restoreTransaction).toBe(true); } });

  test('preserves the last trial unit across concurrent same-key starts and rolled-back initiation', async () => {
    proof = new Proof();
    let foreign: Awaited<ReturnType<typeof state>> | undefined;
    let firstError: unknown;
    try {
      current().require();
      const { getDb } = await import('./db');
      const { mutateClinicAction } = await import('./clinic');
      db = getDb();
      const actor = await seed(subject, 9);
      await seed(control, 0);
      const before = await state(subject);
      foreign = await state(control);
      expect(before.subscription).toMatchObject({ trialUsed: 9, trialLimit: 10, status: 'TRIAL' });
      expect(before.subscription!.trialEndsAt!.getTime() - before.subscription!.trialActivatedAt!.getTime()).toBe(14 * 86400000);
      expect(before.visits).toHaveLength(9); expect(before.usages).toHaveLength(9); expect(before.events).toHaveLength(9);
      expect(before.visits.every(row => !row.isTest)).toBe(true);
      current().require();
      process.env.ALLOW_REAL_CLIENT_DATA = 'true'; flagChanged = true;
      observeTransaction();
      const invoke = (context: Start) => current().work(() => logical.run(context, async () => {
        try {
          return await mutateClinicAction(actor, { action: 'consultation.start', locationId: subject.location,
            consent: false, idempotencyKey: context.key });
        } finally { context.settled = true; }
      }));
      const rollback = startContext(`trial-${nonce}-rollback`, 'ROLLBACK');
      await expect(invoke(rollback)).rejects.toBe(sentinel);
      await current().join();
      expect(rollback).toMatchObject({ injected: true, incremented: true, settled: true });
      expect(rollback.created && rollback.usage && rollback.event).toBeTruthy();
      expect(await state(subject)).toEqual(before);
      expect(await state(control)).toEqual(foreign);
      safeRecord('ROLLBACK_VERIFIED', { actualWriteWitnesses: 4, pending: current().pending.size, baselineUsed: 9 });

      const key = `trial-${nonce}-same-key`, a = startContext(key, 'RACE'), b = startContext(key, 'RACE');
      let blockerActive = false;
      let ready: (pid: number) => void = () => { throw new Error('Blocker readiness not initialized'); };
      let rejectReady: (error: unknown) => void = () => { throw new Error('Blocker rejection not initialized'); };
      const readyPromise = new Promise<number>((resolve, reject) => { ready = resolve; rejectReady = reject; });
      const released = new Promise<void>(resolve => { releaseBlocker = resolve; });
      const blocker = boundedTx(async tx => {
        const rows = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_catalog.pg_backend_pid() AS pid`;
        await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${subject.tenant}::uuid FOR UPDATE`;
        blockerActive = true; ready(rows[0]!.pid);
        try { await current().wait(released); } finally { blockerActive = false; }
      });
      // Rejections are observed immediately, even while the proof is inspecting locks.
      void blocker.catch(rejectReady);
      let starts: Promise<Awaited<ReturnType<typeof mutateClinicAction>>>[] = [];
      try {
        const pid = await current().wait(readyPromise);
        expect(Number.isInteger(pid)).toBe(true);
        current().require();
        starts = [invoke(a), invoke(b)];
        for (const promise of starts) void promise.catch(() => {});
        await overlap(a, b, pid, () => blockerActive);
        safeRecord('OVERLAP_VERIFIED', { distinctCurrentCallbacks: 2, ownedBlockers: 1 });
      } finally { releaseBlocker?.(); }
      await current().wait(blocker);
      const results = await current().wait(Promise.all(starts));
      await current().join();
      expect(results).toHaveLength(2);
      const values = results.map(result => object(result.result));
      expect(values[0]!.id).toBe(values[1]!.id);
      expect(values.map(value => value.resumed).sort()).toEqual([false, true]);
      expect(a.settled && b.settled).toBe(true);
      const after = await state(subject);
      expect(after.subscription).toMatchObject({ trialUsed: 10, trialLimit: 10 });
      expect(after.visits).toHaveLength(10); expect(after.usages).toHaveLength(10); expect(after.events).toHaveLength(10);
      expect(after.visits.filter(row => row.idempotencyKey === key).map(row => row.id)).toEqual([values[0]!.id]);
      expect(after.usages.filter(row => row.idempotencyKey === key).map(row => row.consultationId)).toEqual([values[0]!.id]);
      expect(after.events.filter(row => row.consultationId === values[0]!.id)).toMatchObject([{ action: 'CONSULTATION_STARTED' }]);
      expect(after.visits.filter(row => row.idempotencyKey === rollback.key)).toEqual([]);
      expect(after.usages.filter(row => row.idempotencyKey === rollback.key)).toEqual([]);
      expect(after.visits.filter(row => before.visits.some(old => old.id === row.id))).toEqual(before.visits);
      expect(after.usages.filter(row => before.usages.some(old => old.id === row.id))).toEqual(before.usages);
      expect(after.events.filter(row => before.events.some(old => old.id === row.id))).toEqual(before.events);
      expect(await state(control)).toEqual(foreign);
      const workflow = await import('workflow/api');
      expect(vi.mocked(workflow.start)).toHaveBeenCalledTimes(2);
      safeRecord('COMMITTED_STATE_VERIFIED', { logicalStarts: 3, committedNewVisits: 1, used: 10, usageRows: 10 });
    } catch (error) { firstError = error; current().firstError ??= error; }
    finally {
      releaseBlocker?.();
      try {
        await current().join();
        restoreTransaction?.();
        if (flagChanged) { process.env.ALLOW_REAL_CLIENT_DATA = 'false'; flagChanged = false; }
        if (db) {
          await erase(subject);
          if (foreign) expect(await state(control, true)).toEqual(foreign);
          await erase(control);
          await current().work(() => database().$disconnect(), true);
          disconnected = true;
        }
        current().require(true);
        closed = true;
        safeRecord('QUIESCENT_CLEANUP_VERIFIED', { pending: current().pending.size, initialFalseRestored: !flagChanged,
          consumerRowsAbsent: true, elapsedMs: Math.ceil(performance.now() - current().began) });
      } catch (error) {
        current().stop(error);
        firstError ??= error;
        // No after-hook reset, flag restoration, teardown or disconnect after poison.
      }
    }
    if (firstError) throw firstError;
    current().require(true);
  });
});
