import { createHash, randomUUID } from 'node:crypto';
import { describe, test, vi } from 'vitest';
import type { AuthSession, Tenant, User } from '@prisma/client';

type Db = ReturnType<typeof import('./db')['getDb']>;
type Actor = import('./auth').ClinicActor;
type Row = Record<string, unknown>;
class SafeStop extends Error {
  constructor(readonly code: string) { super(`TASK064:${code}`); this.stack = this.message; }
}
const object = (value: unknown): value is Row => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function context() {
  const target = process.env.TEST_DATABASE_URL;
  if (!target) return false;
  let url: URL;
  try { url = new URL(target); } catch { return false; }
  return process.env.CI === 'true' && process.env.NODE_ENV === 'test' &&
    process.versions.node.split('.')[0] === '24' && !('VERCEL' in process.env) &&
    process.env.DATABASE_URL === target && ['postgres:', 'postgresql:'].includes(url.protocol) &&
    url.hostname === 'localhost' && url.port === '5432' && url.pathname === '/dripwell_verification' &&
    url.username === 'dripwell_test' && !url.search && !url.hash &&
    process.env.APP_URL === 'http://localhost:3000' && process.env.ALLOW_REAL_CLIENT_DATA === 'false';
}
function normalized(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const rows = value.map(normalized);
    return rows.every(row => object(row) && typeof row.id === 'string')
      ? rows.sort((a, b) => object(a) && object(b) ? String(a.id).localeCompare(String(b.id)) : 0) : rows;
  }
  return object(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, normalized(item)])) : value;
}
function descriptorHeld(key: string, expected: PropertyDescriptor | undefined) {
  const now = Object.getOwnPropertyDescriptor(globalThis, key);
  return (!now && !expected) || Boolean(now && expected && ['value', 'get', 'set', 'writable', 'enumerable', 'configurable']
    .every(field => now[field as keyof PropertyDescriptor] === expected[field as keyof PropertyDescriptor]));
}
class Proof {
  readonly began = performance.now();
  readonly pending = new Set<Promise<unknown>>();
  first?: string;
  unknown = false;
  unresolved = false;
  unsafeOwnership = false;
  identity?: () => void;
  retryable?: (error: unknown) => boolean;
  admitted?: (error: unknown) => boolean;
  cleanup = false;
  service = 0;
  returned = 0;
  denied = 0;
  transactions = 0;
  reads = 0;
  orm = 0;
  cleanupOrm = 0;
  deleted = 0;
  censuses = 0;
  forbidden = 0;
  stop(code: string) { this.first ??= code; }
  assert(value: unknown, code: string, ownership = false): asserts value {
    if (!value) {
      if (ownership) this.unsafeOwnership = true;
      this.stop(code); throw new SafeStop(this.first!);
    }
  }
  require(cleanup = false) {
    this.assert(context(), 'EXACT_CI_CONTEXT');
    this.identity?.();
    if (performance.now() - this.began >= (cleanup ? 30000 : 20000)) {
      this.unknown = true; this.stop('ORIGINAL_CLOCK_EXPIRED'); throw new SafeStop(this.first!);
    }
    if (!cleanup && this.first) throw new SafeStop(this.first);
  }
  encoded(value: unknown, ownership = false) {
    try {
      const text = JSON.stringify(normalized(value));
      this.assert(typeof text === 'string' && Buffer.byteLength(text) <= 65536, 'RAM_BYTES', ownership);
      return text;
    } catch (error) {
      if (ownership) this.unsafeOwnership = true;
      throw error;
    }
  }
  observe<T>(value: PromiseLike<T>, native = false): Promise<T> {
    const pending = Promise.resolve(value);
    this.pending.add(pending);
    void pending.then(() => this.pending.delete(pending), error => {
      this.pending.delete(pending);
      if (native && !this.retryable?.(error) && !this.admitted?.(error)) this.stop('NATIVE_WORK_FAILED');
    });
    return pending;
  }
  async wait<T>(pending: Promise<T>, cleanup: boolean): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([pending, new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          this.unknown = true; this.stop('OWNED_WORK_UNKNOWN'); reject(new SafeStop(this.first!));
        }, Math.max(0, (cleanup ? 30000 : 20000) - (performance.now() - this.began)));
      })]);
      this.require(cleanup); return value;
    } finally { if (timer) clearTimeout(timer); }
  }
  async work<T>(operation: () => PromiseLike<T>, cleanup = false): Promise<T> {
    this.require(cleanup);
    const pending = this.observe(Promise.resolve().then(() => {
      this.require(cleanup); return operation(); // Real receiver, one assimilation of its lazy promise.
    }).then(value => ({ ok: true as const, value }), error => {
      const intended = Boolean(this.admitted?.(error));
      if (!intended) this.stop(error instanceof SafeStop ? error.code : 'WORK_FAILED');
      return { ok: false as const, code: intended ? 'EXPECTED_LOCATION_DENIAL' : this.first! };
    }));
    const result = await this.wait(pending, cleanup);
    if (!result.ok) throw new SafeStop(result.code);
    return result.value;
  }
  async join() {
    this.require(true);
    await this.wait(Promise.allSettled([...this.pending]), true);
    this.assert(this.pending.size === 0, 'WORK_NOT_JOINED');
  }
}
const suite = process.env.CI === 'true' || process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('Real PostgreSQL membership reporting', () => {
  test('partitions the complete enrollment cohort across real PostgreSQL without inheriting board filters', async () => {
    const proof: Proof = new Proof();
    const originalDb = Object.getOwnPropertyDescriptor(globalThis, 'dripwellDatabase');
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const nonce = randomUUID(), tenantIds: string[] = [randomUUID(), randomUUID()];
    const locationIds: string[] = [randomUUID(), randomUUID(), randomUUID()];
    const userIds: string[] = [randomUUID(), randomUUID()], sessionIds: string[] = [randomUUID(), randomUUID()];
    const configIds: string[] = [randomUUID(), randomUUID(), randomUUID()];
    const visitIds: string[] = Array.from({ length: 11 }, () => randomUUID());
    const allIds: string[] = [...tenantIds, ...locationIds, ...userIds, ...sessionIds, ...configIds, ...visitIds];
    const slugs = ['a', 'b'].map(label => `task064-${nonce}-${label}`);
    const emails = ['a', 'b'].map(label => `task064-${nonce}-${label}@example.test`);
    const tokenHashes = ['a', 'b'].map(label => `task064-session-${nonce}-${label}`);
    const references = visitIds.map((_, index) => `T064-${nonce}-${index}`);
    const keys = visitIds.map((_, index) => `task064:${nonce}:${index}`);
    const rateKeys = tenantIds.flatMap(tenant => userIds.flatMap(user => ['audio', 'setup-upload', 'setup-chat']
      .map(scope => createHash('sha256').update(`${scope}:${tenant}:${user}`).digest('hex'))));
    const owned = new Map<string, Map<string, Row>>();
    let db: Db | undefined, getDb: (() => Db) | undefined;
    let reserved = false, closed = false, restored = false, moduleRestored = false, phase = 'ADMISSION';
    let restoreTransaction: (() => void) | undefined;
    const denyFetch = () => { proof.forbidden++; proof.assert(false, 'FETCH_FORBIDDEN'); };
    const ids = (list: string[]) => ({ id: { in: list } });
    const t = { tenantId: { in: tenantIds } }, u = { userId: { in: userIds } };
    const l = { locationId: { in: locationIds } }, v = { consultationId: { in: visitIds } };
    const or = (...items: Row[]) => ({ OR: items });
    const matrix: Record<string, Row> = {
      tenant: or(ids(tenantIds), { slug: { in: slugs } }), location: or(t, ids(locationIds)),
      user: or(t, ids(userIds), { email: { in: emails } }),
      authSession: or(u, ids(sessionIds), { tokenHash: { in: tokenHashes } }),
      clinicConfigurationVersion: or(t, l, u, ids(configIds)),
      consultation: or(t, l, ids(visitIds), { providerId: { in: userIds } },
        { configurationVersionId: { in: configIds } }, { idempotencyKey: { in: keys } }, { reference: { in: references } }),
      notification: or(t, u, v, { entityId: { in: visitIds } }), consultationEvent: or(t, u, v),
      assessmentSession: or(t, l, { providerId: { in: userIds } }), patientIntake: t, photoCapture: t,
      visualSignal: t, questionAnswer: t, patternMatch: t, recommendation: or(t, { providerId: { in: userIds } }),
      safetyFlag: or(t, { providerAcknowledgedById: { in: userIds } }), providerOverride: or(t, { providerId: { in: userIds } }),
      catalogItem: t, catalogItemCompatibility: t, assessmentHistory: t, assessmentChangeLog: or(t, { providerId: { in: userIds } }),
      auditLog: or(t, u, { entityId: { in: allIds } }), feedback: or(t, { submitterId: { in: userIds } }, { assignedTo: { in: userIds } }),
      consultationRevision: or(t, u, v), consultationAdjustment: or(t, u, v), subscription: t, trialUsage: or(t, v),
      referral: or({ referrerTenantId: { in: tenantIds } }, { referredTenantId: { in: tenantIds } }), creditLedger: t,
      takeaway: or(t, v, { createdById: { in: userIds } }), shareLink: or(t, { createdById: { in: userIds } }),
      userInvite: or(t, { invitedById: { in: userIds } }), setupConversation: or(t, u, l), generationJob: or(t, u, v),
      recordingSegment: or(t, u, v), improvementProposal: or(t, u, { configurationVersionId: { in: configIds } }),
      agentContextSnapshot: or(t, u), setupRecordingUpload: or(t, u, l), recordingDeletionIntent: or(t, v), authChallenge: u,
      recommendationItem: or({ recommendation: t }, { catalogItem: t }), catalogItemIngredient: { catalogItem: t },
      shareVerification: { shareLink: t }, shareSession: { shareLink: t }, rateLimitBucket: { key: { in: rateKeys } },
    };
    const excluded = ['ClinicalPattern', 'SignalTaxonomy', 'QuestionBank', 'Ingredient', 'PlatformPolicy', 'BillingEvent', 'MaintenanceCoordinator'];
    const deleteKeys: Record<string, string[]> = {
      consultation: ['id', 'tenantId', 'locationId', 'providerId', 'configurationVersionId', 'reference', 'idempotencyKey'],
      clinicConfigurationVersion: ['id', 'tenantId', 'locationId', 'userId'], authSession: ['id', 'userId', 'tokenHash'],
      user: ['id', 'tenantId', 'email'], location: ['id', 'tenantId'], tenant: ['id', 'slug'],
    };
    async function query<T>(operation: () => PromiseLike<T>, cleanup = false) {
      return proof.work(() => {
        proof.assert(++proof.orm <= 320, 'ORM_LIMIT');
        if (cleanup) proof.assert(++proof.cleanupOrm <= 120, 'CLEANUP_ORM_LIMIT');
        else proof.assert(proof.orm - proof.cleanupOrm <= 200, 'SCENARIO_ORM_LIMIT');
        return operation();
      }, cleanup);
    }
    async function census(cleanup = false) {
      const snapshot: Row = {};
      for (const [model, where] of Object.entries(matrix)) {
        const expected = owned.get(model) ?? new Map<string, Row>();
        const delegate: unknown = db && Reflect.get(db, model);
        proof.assert(object(delegate) && typeof delegate.findMany === 'function', 'CENSUS_DELEGATE', true);
        const rows: unknown = await query(() => Reflect.apply(delegate.findMany, delegate, [{ where, take: expected.size + 1 }]), cleanup);
        proof.assert(Array.isArray(rows) && rows.length === expected.size && rows.length <= 11, 'CENSUS_COUNT', true);
        for (const row of rows) {
          proof.assert(object(row) && uuid(row.id) && expected.has(row.id), 'CENSUS_OWNERSHIP', true);
          proof.assert(proof.encoded(row, true) === proof.encoded(expected.get(row.id), true), 'CENSUS_SCALAR_DRIFT', true);
        }
        snapshot[model] = rows;
      }
      proof.assert(Object.values(snapshot).reduce<number>((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0) <= 23, 'ROOT_LIMIT', true);
      proof.encoded(snapshot, true); proof.censuses++; return snapshot;
    }
    async function create<T>(model: string, id: string, expected: Row, operation: () => PromiseLike<T>) {
      proof.unresolved = true;
      const row = await query(operation);
      proof.assert(object(row) && uuid(row.id) && row.id === id && row.createdAt instanceof Date, 'GENUINE_CREATE');
      proof.assert(Object.entries(expected).every(([key, value]) => proof.encoded(row[key]) === proof.encoded(value)), 'CREATE_LINEAGE');
      const rows = owned.get(model) ?? new Map<string, Row>();
      proof.assert(!rows.has(id), 'DUPLICATE_CAPTURE'); proof.encoded(row);
      rows.set(id, row); owned.set(model, rows); proof.unresolved = false; return row;
    }
    try {
      proof.require();
      proof.assert(!originalDb && allIds.length === 23 && new Set(allIds).size === 23 && allIds.every(uuid), 'FRESH_RESERVATION');
      proof.assert(Object.keys(matrix).length === 45 && excluded.length === 7, 'MODEL_PARTITION');
      vi.resetModules(); vi.doMock('server-only', () => ({}));
      const { PrismaClient, Prisma } = await proof.work(() => import('@prisma/client'));
      const modelNames = Object.values(Prisma.ModelName);
      proof.assert(modelNames.length === 52 && modelNames.every(name => excluded.includes(name) ||
        `${name[0]!.toLowerCase()}${name.slice(1)}` in matrix), 'GENERATED_MODEL_PARTITION');
      db = new PrismaClient({ log: [] });
      Object.defineProperty(globalThis, 'dripwellDatabase', { value: db, writable: true, configurable: true });
      Object.defineProperty(globalThis, 'fetch', { value: denyFetch, writable: true, configurable: true }); reserved = true;
      const database = await proof.work(() => import('./db')); getDb = database.getDb;
      proof.identity = () => {
        if (!getDb || !db) return proof.assert(false, 'CLIENT_CONTEXT');
        proof.assert(getDb() === db && Reflect.get(globalThis, 'dripwellDatabase') === db &&
          Reflect.get(globalThis, 'fetch') === denyFetch, 'CLIENT_IDENTITY');
      };
      proof.require();
      const nativeTransaction: unknown = Reflect.get(db, '$transaction');
      proof.assert(typeof nativeTransaction === 'function', 'TRANSACTION_RECEIVER');
      const priorTransaction = Object.getOwnPropertyDescriptor(db, '$transaction');
      Object.defineProperty(db, '$transaction', { configurable: true, value: (...args: unknown[]) => {
        proof.require(); proof.assert(++proof.transactions <= 84 && typeof args[0] === 'function', 'TRANSACTION_LIMIT');
        const callback = args[0], options = args[1];
        proof.assert(object(options) && options.isolationLevel === Prisma.TransactionIsolationLevel.Serializable &&
          options.maxWait === 10000 && options.timeout === 20000, 'TRANSACTION_OPTIONS');
        const observed = (tx: unknown) => {
          proof.assert(object(tx), 'TRANSACTION_CLIENT');
          const view = new Proxy(tx, { get(target, key) {
            const delegate: unknown = Reflect.get(target, key, target);
            if (!object(delegate) || typeof key !== 'string' || !(key in matrix)) return delegate;
            return new Proxy(delegate, { get(receiver, method) {
              const native: unknown = Reflect.get(receiver, method, receiver);
              if (typeof native !== 'function') return native;
              return (...parameters: unknown[]) => {
                proof.require(); proof.assert(++proof.reads <= 1116 &&
                  ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findMany', 'count', 'groupBy'].includes(String(method)), 'READ_DELEGATE_LIMIT');
                const value: unknown = Reflect.apply(native, receiver, parameters);
                proof.assert(object(value) && typeof value.then === 'function', 'READ_PROMISE');
                return proof.observe(Promise.resolve(value), true);
              };
            } });
          } });
          return Reflect.apply(callback, undefined, [view]);
        };
        const value: unknown = Reflect.apply(nativeTransaction, db, [observed, options]);
        proof.assert(object(value) && typeof value.then === 'function', 'TRANSACTION_PROMISE');
        return proof.observe(Promise.resolve(value), true);
      } });
      restoreTransaction = () => {
        if (priorTransaction) Object.defineProperty(db!, '$transaction', priorTransaction);
        else Reflect.deleteProperty(db!, '$transaction');
      };
      proof.retryable = error => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
      const shared = await proof.work(() => import('@dripwell/shared/v2'));
      const clinic = await proof.work(() => import('./clinic'));
      const { ApiError } = await proof.work(() => import('./errors'));
      await census(); phase = 'SEED';
      const configuration = shared.clinicConfigurationSchema.parse({ schemaVersion: 2,
        clinic: { name: 'Task064 fictional', currency: 'USD', contact: '', brandColor: '#0d9488' }, questions: [], products: [],
        recommendationPolicy: { clinicalValidated: false, validatedBy: '', validationNote: '', maxAddOns: 0, maxWellnessOffers: 0 },
        reminders: { careOutcomeHours: 1, wellnessDecisionHours: 1 }, retention: { audioDays: 1, documentDays: 1, shareExpiryHours: 1 } });
      const capturedNow = Date.now(), createdAt = new Date(capturedNow - 60000), expiresAt = new Date(capturedNow + 3600000);
      const tenants: (Tenant & Row)[] = [], users: (User & Row)[] = [], sessions: (AuthSession & Row)[] = [];
      for (const [index, id] of tenantIds.entries()) tenants.push(await create('tenant', id, { id, slug: slugs[index], isActive: true },
        () => db!.tenant.create({ data: { id, name: 'Task064 fictional', slug: slugs[index]!, state: 'TEST', medicalDirector: 'Nonclinical fixture' } })));
      for (const [index, id] of locationIds.entries()) {
        const tenantId = tenantIds[index === 2 ? 1 : 0]!;
        await create('location', id, { id, tenantId, isActive: true }, () => db!.location.create({ data: { id, tenantId, name: 'Task064 fictional location' } }));
      }
      for (const [index, id] of userIds.entries()) {
        const tenantId = tenantIds[index]!;
        users.push(await create('user', id, { id, tenantId, email: emails[index], role: 'STAFF', isActive: true, canApproveClinical: false, mfaEnabled: false },
          () => db!.user.create({ data: { id, tenantId, email: emails[index]!, passwordHash: 'test-unusable-password-hash',
            firstName: 'Fictional', lastName: 'Staff', role: 'STAFF', canApproveClinical: false, mfaEnabled: false } })));
        const sessionId = sessionIds[index]!;
        sessions.push(await create('authSession', sessionId, { id: sessionId, userId: id, tokenHash: tokenHashes[index], createdAt, expiresAt, revokedAt: null, mfaVerifiedAt: null },
          () => db!.authSession.create({ data: { id: sessionId, userId: id, tokenHash: tokenHashes[index]!, createdAt, expiresAt } })));
      }
      for (const [index, id] of configIds.entries()) {
        const tenantId = tenantIds[index === 2 ? 1 : 0]!, userId = userIds[index === 2 ? 1 : 0]!, locationId = locationIds[index]!;
        await create('clinicConfigurationVersion', id, { id, tenantId, locationId, userId, status: 'DRAFT', payload: configuration },
          () => db!.clinicConfigurationVersion.create({ data: { id, tenantId, locationId, userId, version: 1,
            status: 'DRAFT', payload: configuration, source: 'Task064 fictional metadata only' } }));
      }
      const care = (membershipEnrolled: boolean | null) => shared.actualCareSchema.parse({ outcome: 'NOT_STARTED', items: [],
        observations: 'Fictional reporting metadata only', reason: 'No clinical care performed', membershipEnrolled,
        membershipProductId: null, servicePurchased: null, confirmedCollectedCents: null, currency: 'USD' });
      const purchased = shared.actualCareSchema.parse({ ...care(null), servicePurchased: true, confirmedCollectedCents: 10000 });
      const invalid = { ...care(true), currency: 'invalid' };
      proof.assert(!shared.actualCareSchema.safeParse(invalid).success, 'INVALID_CARE_REQUIRED');
      const careValues = [care(true), care(false), Prisma.DbNull, Prisma.JsonNull, purchased, invalid,
        care(true), care(true), care(false), care(false), care(true)];
      const from = new Date('2026-01-15T00:00:00.000Z'), to = new Date('2026-01-16T00:00:00.000Z');
      const mid = new Date(from.getTime() + 3600000);
      const dates = [from, new Date(to.getTime() - 1), mid, mid, mid, mid, mid, new Date(from.getTime() - 1), to, mid, mid];
      const summary = shared.consultationSummarySchema.parse(shared.emptyConsultationSummary());
      for (const [index, id] of visitIds.entries()) {
        const loc = index === 9 ? 1 : index === 10 ? 2 : 0, tenantId = tenantIds[loc === 2 ? 1 : 0]!;
        const locationId = locationIds[loc]!, configurationVersionId = configIds[loc]!, providerId = userIds[loc === 2 ? 1 : 0]!;
        const archivedAt = index === 0 || index === 5 ? mid : null;
        await create('consultation', id, { id, tenantId, locationId, configurationVersionId, providerId,
          reference: references[index], idempotencyKey: keys[index], isTest: index === 6, createdAt: dates[index], archivedAt,
          summary, actualCare: index === 2 || index === 3 ? null : careValues[index], careOutcome: 'NOT_STARTED',
          transcript: [], initialRecommendation: null, clinicalApprovedVersion: null, clinicalApprovedById: null,
          clinicalApprovedAt: null, wellnessPlan: null, wellnessApprovedVersion: null, wellnessApprovedById: null,
          wellnessApprovedAt: null, wellnessDecision: null, consentAt: null, completedAt: null,
          archiveReason: archivedAt ? 'Fictional retained reporting metadata' : null },
          () => db!.consultation.create({ data: { id, tenantId, locationId, configurationVersionId, providerId,
            reference: references[index]!, idempotencyKey: keys[index]!, isTest: index === 6, summary, createdAt: dates[index]!,
            actualCare: careValues[index]!, careOutcome: 'NOT_STARTED', archivedAt,
            archiveReason: archivedAt ? 'Fictional retained reporting metadata' : null, wellnessPlan: Prisma.DbNull } }));
      }
      const unusable = owned.get('consultation')?.get(visitIds[5]!)?.actualCare;
      proof.assert(object(unusable) && !shared.actualCareSchema.safeParse(unusable).success, 'STORED_UNUSABLE_CARE');
      await census(); phase = 'DASHBOARDS';
      proof.assert(users.length === 2 && sessions.length === 2 && tenants.length === 2, 'ACTOR_CAPTURE');
      const actors: Actor[] = users.map((user, index) => ({ id: user.id, userId: user.id, tenantId: user.tenantId!, tenant: tenants[index]!,
        locationId: locationIds[index === 1 ? 2 : 0]!, email: user.email, firstName: user.firstName, lastName: user.lastName,
        role: user.role, canApproveClinical: user.canApproveClinical, mfaEnabled: user.mfaEnabled,
        mfaVerified: false, mfaVerifiedAt: null, sessionId: sessions[index]!.id }));
      const period = { from: from.toISOString(), to: to.toISOString() };
      async function dashboard(actor: Actor, options: Parameters<typeof clinic.getClinicDashboard>[1], expectedIds: string[],
        counts: [number, number, number, number, number | null]) {
        proof.assert(++proof.service <= 7, 'SERVICE_LIMIT');
        const result = await proof.work(() => clinic.getClinicDashboard(actor, options)); proof.encoded(result); proof.returned++;
        const [denominator, enrolled, declined, unknown, rate] = counts, metrics = result.metrics;
        proof.assert(proof.encoded(result.consultations.map(row => row.id)) === proof.encoded(expectedIds) &&
          result.consultationCount === expectedIds.length && result.consultationPagination.nextCursor === null, 'BOARD_SELECTION');
        proof.assert(metrics.denominator === denominator && metrics.consultations === denominator &&
          metrics.membershipEnrollments === enrolled && metrics.membershipDeclines === declined &&
          metrics.membershipNotRecorded === unknown && metrics.membershipRecorded === enrolled + declined &&
          enrolled + declined + unknown === denominator && metrics.membershipEnrollmentRate === rate, 'ENROLLMENT_PARTITION');
        proof.assert(!result.consultations.some(row => row.id === visitIds[5]) &&
          result.user.role === 'STAFF' && !result.user.canApproveClinical && result.referral === null, 'ORDINARY_READ_BOUNDARY');
      }
      const primary: [number, number, number, number, number | null] = [6, 1, 1, 4, 0.5];
      await dashboard(actors[0]!, { ...period, locationId: locationIds[0], search: references[1], pageSize: 1 }, [visitIds[1]!], primary);
      await dashboard(actors[0]!, { ...period, locationId: locationIds[0], search: `unmatched-${nonce}`, pageSize: 1 }, [], primary);
      await dashboard(actors[0]!, { ...period, locationId: locationIds[0], archived: true, search: references[0], pageSize: 1 }, [visitIds[0]!], primary);
      await dashboard(actors[0]!, { ...period, locationId: locationIds[1], pageSize: 1 }, [visitIds[9]!], [1, 0, 1, 0, 0]);
      await dashboard(actors[1]!, { ...period, locationId: locationIds[2], pageSize: 1 }, [visitIds[10]!], [1, 1, 0, 0, 1]);
      proof.admitted = error => error instanceof ApiError && error.status === 404 && error.code === 'LOCATION_NOT_FOUND';
      try {
        proof.assert(++proof.service <= 7, 'SERVICE_LIMIT');
        await proof.work(() => clinic.getClinicDashboard(actors[0]!, { ...period, locationId: locationIds[2] }));
        proof.assert(false, 'FOREIGN_LOCATION_RETURNED');
      } catch (error) {
        proof.assert(error instanceof SafeStop && error.code === 'EXPECTED_LOCATION_DENIAL' && !proof.first, 'EXACT_LOCATION_DENIAL');
        proof.denied++;
      } finally { proof.admitted = undefined; }
      await dashboard(actors[0]!, { locationId: locationIds[0], pageSize: 1,
        from: new Date(to.getTime() + 7200000).toISOString(), to: new Date(to.getTime() + 10800000).toISOString() }, [], [0, 0, 0, 0, null]);
      await census();
      proof.assert(proof.service === 7 && proof.returned === 6 && proof.denied === 1 && proof.forbidden === 0, 'READ_COUNTS');
    } catch (error) { proof.stop(error instanceof SafeStop ? error.code : 'SCENARIO_FAILED'); }
    try {
      phase = 'CLEANUP'; proof.cleanup = true; await proof.join();
      proof.assert(reserved && db && !proof.unresolved && !proof.unknown && !proof.unsafeOwnership && proof.pending.size === 0, 'CLEANUP_QUIESCENCE');
      await census(true);
      for (const model of ['consultation', 'clinicConfigurationVersion', 'authSession', 'user', 'location', 'tenant']) {
        const rows = owned.get(model) ?? new Map<string, Row>();
        for (const [id, row] of [...rows]) {
          const where = Object.fromEntries(deleteKeys[model]!.map(key => [key, row[key]]));
          proof.assert(where.id === id && Object.values(where).every(value => typeof value === 'string'), 'EXACT_DELETE_IDENTITY');
          const delegate: unknown = Reflect.get(db, model);
          proof.assert(object(delegate) && typeof delegate.deleteMany === 'function', 'DELETE_DELEGATE');
          proof.unresolved = true;
          const result: unknown = await query(() => {
            proof.assert(!proof.unsafeOwnership, 'UNSAFE_CENSUS_OWNERSHIP');
            return Reflect.apply(delegate.deleteMany, delegate, [{ where }]);
          }, true);
          proof.assert(object(result) && result.count === 1, 'EXACT_DELETE_COUNT'); rows.delete(id); proof.deleted++; proof.unresolved = false;
        }
      }
      await census(true); await proof.join(); restoreTransaction?.();
      await proof.work(() => {
        proof.assert(!proof.unsafeOwnership, 'UNSAFE_CENSUS_OWNERSHIP');
        return db!.$disconnect();
      }, true); await proof.join(); closed = true;
      proof.require(true); proof.identity = undefined;
      if (originalDb) Object.defineProperty(globalThis, 'dripwellDatabase', originalDb);
      else Reflect.deleteProperty(globalThis, 'dripwellDatabase');
      if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
      else Reflect.deleteProperty(globalThis, 'fetch');
      vi.doUnmock('server-only'); vi.resetModules();
      const refreshed = await proof.work(() => import('./db'), true);
      proof.assert(refreshed.getDb !== getDb, 'MODULE_CACHE_RESTORE'); moduleRestored = true;
      proof.assert(descriptorHeld('dripwellDatabase', originalDb) && descriptorHeld('fetch', originalFetch), 'GLOBAL_RESTORE'); restored = true;
      proof.identity = () => proof.assert(restored && moduleRestored && descriptorHeld('dripwellDatabase', originalDb) &&
        descriptorHeld('fetch', originalFetch), 'FINAL_CONTEXT');
    } catch (error) { proof.stop(error instanceof SafeStop ? error.code : 'CLOSURE_FAILED'); proof.unknown = true; }
    proof.require(true);
    const obligations = [...owned.values()].reduce((sum, rows) => sum + rows.size, 0);
    const uncertain = proof.unknown || proof.unresolved || proof.unsafeOwnership || proof.pending.size > 0;
    const record = { task: 'TASK064', outcome: proof.first ? 'FAILED' : 'CLOSURE_CANDIDATE', first: proof.first ?? null, phase,
      service: proof.service, returned: uncertain ? null : proof.returned, denied: uncertain ? null : proof.denied,
      additionalOrm: proof.orm, cleanupOrm: proof.cleanupOrm, transactions: proof.transactions, delegateReads: proof.reads,
      deleted: proof.deleted, censuses: proof.censuses, forbidden: proof.forbidden, pending: proof.pending.size,
      unknown: proof.unknown, unresolved: proof.unresolved, unsafeOwnership: proof.unsafeOwnership,
      obligations, closed, restored, moduleRestored,
      elapsedMs: Math.ceil(performance.now() - proof.began) };
    const text = JSON.stringify(record); proof.assert(Buffer.byteLength(text) <= 2048, 'SAFE_RECORD_BYTES');
    await proof.work(() => new Promise<void>((resolve, reject) => process.stdout.write(`${text}\n`, error =>
      error ? reject(new SafeStop('FINAL_WRITE_FAILED')) : resolve())), true);
    await proof.join(); proof.require(true);
    if (proof.first) throw new SafeStop(proof.first);
    proof.assert(!proof.unsafeOwnership && proof.censuses === 5 && proof.deleted === 23 && obligations === 0 && closed && restored && moduleRestored, 'COMPLETE_CLOSURE');
  }, 30000);
});
