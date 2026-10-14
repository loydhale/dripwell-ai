import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { describe, test, vi } from 'vitest';
import type { ClinicConfiguration } from '@dripwell/shared/v2';

type Jar = { token?: string };
const context = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks');
  return { current: new AsyncLocalStorage<Jar>(), owned: new Set<Jar>(), external: 0 };
});
vi.mock('server-only', () => ({}));
vi.mock('workflow/api', () => ({ start: () => {
  context.external++;
  throw new Error('Owned owner proof forbids Workflow dispatch');
} }));
// Only Next's async request cookie storage is simulated, never identity or ORM.
vi.mock('next/headers', () => ({ cookies: async () => {
  const jar = context.current.getStore();
  if (!jar || !context.owned.has(jar)) throw new Error('Owned cookie context required');
  return {
    get: (name: string) => name === 'dripwell_session' && jar.token
      ? { name, value: jar.token } : undefined,
    set: (name: string, value: string, options: { httpOnly: boolean; sameSite: string; path: string; secure: boolean; expires: Date }) => {
      if (name !== 'dripwell_session' || !/^[A-Za-z0-9_-]{43}$/.test(value) ||
        options.httpOnly !== true || options.sameSite !== 'strict' || options.path !== '/' ||
        options.secure !== false || !(options.expires instanceof Date))
        throw new Error('Owned cookie write contract required');
      jar.token = value;
    },
  };
} }));
const selected = process.env.TEST_DATABASE_URL;
function guard() {
  check(Boolean(selected), 'TARGET_REQUIRED');
  let url: URL;
  try { url = new URL(selected!); } catch { throw new Error('INVALID_CI_TARGET'); }
  check(process.env.CI === 'true' && process.env.DATABASE_URL === selected &&
    ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname === 'localhost' &&
    url.port === '5432' && url.pathname === '/dripwell_verification' && url.username === 'dripwell_test' &&
    !url.search && !url.hash && process.env.NODE_ENV === 'test' &&
    process.env.APP_URL === 'http://localhost:3000' && !('VERCEL' in process.env) &&
    process.env.ALLOW_REAL_CLIENT_DATA === 'false', 'EXACT_FRESH_CI_TARGET_REQUIRED');
}
if (selected) {
  guard();
  check(!('AUTH_ENCRYPTION_KEY' in process.env), 'PARENT_MFA_KEY_FORBIDDEN');
  check(!('dripwellDatabase' in globalThis), 'BORROWED_DATABASE_FORBIDDEN');
}
function check(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}
function object(value: unknown): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'RESPONSE_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}
function same(a: unknown, b: unknown) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
type Db = ReturnType<typeof import('./db')['getDb']>;
type Owner = { name: string; email: string; address: string; password: string; jar: Jar; source: string;
  user?: string; tenant?: string; location?: string; subscription?: string; session?: string;
  config?: string; testId?: string; mfa: boolean; saving: boolean; audits: number; rates: Map<string, number> };
class Proof {
  readonly began = performance.now();
  readonly pending = new Set<Promise<unknown>>();
  first?: Error;
  firstBoundary?: string;
  phaseReader = () => 'ADMISSION';
  handlers = 0;
  returned = 0;
  orm = 0;
  require(cleanup = false) {
    guard();
    check(performance.now() - this.began < (cleanup ? 30000 : 20000), 'ORIGINAL_CLOCK_EXPIRED');
    if (!cleanup && this.first) throw this.first;
  }
  stop() {
    this.firstBoundary ??= this.phaseReader();
    this.first ??= new Error('OWNED_OWNER_PROOF_FAILED');
  }
  async wait<T>(pending: Promise<T>, cleanup: boolean): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([pending, new Promise<never>((_, reject) => {
        timer = setTimeout(() => { this.stop(); reject(this.first); },
          Math.max(0, (cleanup ? 30000 : 20000) - (performance.now() - this.began)));
      })]);
      this.require(cleanup);
      return value;
    } catch { this.stop(); throw this.first; }
    finally { if (timer) clearTimeout(timer); }
  }
  async work<T>(operation: () => PromiseLike<T>, cleanup = false): Promise<T> {
    this.require(cleanup);
    // Consume each lazy Prisma result exactly once with its original receiver.
    const pending = Promise.resolve().then(operation);
    this.pending.add(pending);
    void pending.then(() => this.pending.delete(pending), () => this.pending.delete(pending));
    return this.wait(pending, cleanup);
  }
  async query<T>(operation: () => PromiseLike<T>, cleanup = false): Promise<T> {
    check(++this.orm <= 64, 'OWNED_ORM_BUDGET');
    return this.work(operation, cleanup);
  }
  async join() {
    this.require(true);
    await this.wait(Promise.allSettled([...this.pending]), true);
    check(this.pending.size === 0, 'UNKNOWN_OWNED_WORK');
  }
}
const suite = selected ? describe : describe.skip;
suite('Ordinary owner configuration isolation', () => {
  test("keeps ordinary owners' different nonclinical catalogs and saved evaluations isolated", async () => {
    const proof = new Proof();
    const nonce = randomUUID();
    const owners: Owner[] = ['A', 'B'].map(label => {
      const address = `task059-${nonce}-${label}.invalid`;
      return { name: `Task059 ${nonce} ${label}`, email: `${label.toLowerCase()}-${nonce}@task059.invalid`,
        address, password: randomBytes(24).toString('base64url'), jar: {}, source: `Task059 ${nonce} ${label}`,
        mfa: false, saving: false, audits: 0,
        rates: new Map([[digest(`register:${digest(address)}`), 0], [digest(`mfa:${digest(address)}`), 0]]) };
    });
    let db: Db | undefined;
    let keySet = false, clientOwned = false, hooksSet = false, reserved = false, cleaned = 0, phase = 'ADMISSION';
    proof.phaseReader = () => phase;
    let register: typeof import('../app/api/auth/register/route')['POST'];
    let mfa: typeof import('../app/api/auth/mfa/route')['POST'];
    let clinicPost: typeof import('../app/api/clinic/route')['POST'];
    let clinicGet: typeof import('../app/api/clinic/route')['GET'];
    const allKeys = () => owners.flatMap(owner => [...owner.rates.keys()]);
    async function call(owner: Owner, path: string, action?: Record<string, unknown>, status = 200) {
      proof.require();
      check(++proof.handlers <= 18, 'HANDLER_BUDGET');
      const request = new Request(`http://localhost:3000${path}`, { method: action ? 'POST' : 'GET',
        headers: { origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin',
          'content-type': 'application/json', 'x-forwarded-for': owner.address },
        ...(action ? { body: JSON.stringify(action) } : {}) });
      const handler = path === '/api/auth/register' ? register : path === '/api/auth/mfa' ? mfa : action ? clinicPost : clinicGet;
      const rate = path === '/api/auth/register' ? digest(`register:${digest(owner.address)}`)
        : path === '/api/auth/mfa' ? digest(`mfa:${digest(owner.address)}`) : action ? digest(`clinic-mutation:${owner.user}`) : null;
      if (rate) owner.rates.set(rate, (owner.rates.get(rate) ?? 0) + 1);
      if (path === '/api/auth/mfa') {
        const key = digest(`mfa-user:${owner.user}`);
        owner.rates.set(key, (owner.rates.get(key) ?? 0) + 1);
      }
      const body = await proof.work(() => context.current.run(owner.jar, async () => {
        const response = await handler(request, undefined);
        const bytes = await response.arrayBuffer();
        check(bytes.byteLength <= 65536, 'BOUNDED_RESPONSE_REQUIRED');
        const body = object(JSON.parse(Buffer.from(bytes).toString('utf8')));
        // Never include full enrollment/session responses in assertion diagnostics.
        check(response.status === status, 'EXPECTED_HANDLER_STATUS');
        if (path === '/api/clinic' && action && status === 200) check(body.ok === true, 'NORMAL_MUTATION_ENVELOPE');
        return body;
      }));
      proof.returned++;
      return body;
    }
    async function census(owner: Owner, cleanup = false) {
      const rows = await proof.query(() => db!.user.findMany({ where: { email: owner.email }, take: 65,
        select: { id: true, email: true, role: true, isActive: true, canApproveClinical: true, mfaEnabled: true,
          _count: true, authSessions: { take: 65, orderBy: { id: 'asc' },
            ...(owner.jar.token ? { where: { tokenHash: digest(owner.jar.token) } } : {}),
            select: { id: true, userId: true, revokedAt: true, expiresAt: true, mfaVerifiedAt: true } },
          tenant: { select: { id: true, name: true, slug: true, isActive: true, _count: true,
            referralReceived: { select: { id: true } },
            subscription: { select: { id: true, tenantId: true, status: true, trialLimit: true, trialUsed: true,
              trialActivatedAt: true, trialEndsAt: true } },
            users: { take: 65, select: { id: true } },
            locations: { take: 65, select: { id: true, tenantId: true, name: true, _count: true } },
            configurationVersions: { take: 65, orderBy: { id: 'asc' }, include: { _count: true } },
            auditLogs: { take: 65, orderBy: { id: 'asc' }, select: { id: true, tenantId: true, userId: true,
              action: true, entityType: true, entityId: true, details: true, createdAt: true,
              impersonatedBy: true, assessmentSessionId: true } },
          } },
        } }), cleanup);
      check(rows.length <= 1, 'EXACT_EMAIL_LINEAGE');
      if (!rows.length) {
        check(cleanup, 'REGISTERED_USER_REQUIRED');
        const orphan = await proof.query(() => db!.tenant.findMany({ where: { name: owner.name }, take: 65, select: { id: true } }), true);
        check(orphan.length === 0, 'UNKNOWN_REGISTRATION_OBLIGATION');
        return null;
      }
      const user = rows[0]!, tenant = user.tenant;
      check(tenant && tenant.name === owner.name && tenant.isActive && user.isActive &&
        user.role === 'SUPER_USER' && !user.canApproveClinical && tenant.referralReceived === null, 'ORDINARY_OWNER_LINEAGE');
      const slug = owner.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
      check(new RegExp(`^${slug}-[a-f0-9]{10}$`).test(tenant.slug), 'REGISTERED_SLUG_CORRELATION');
      check(tenant.users.length === 1 && tenant.users[0]!.id === user.id && tenant.locations.length === 1, 'OWNED_USER_LOCATION_CENSUS');
      const location = tenant.locations[0]!, subscription = tenant.subscription, sessions = user.authSessions;
      check(location.name === owner.name && location.tenantId === tenant.id && subscription &&
        subscription.tenantId === tenant.id && subscription.status === 'TRIAL' && subscription.trialLimit === 10 &&
        subscription.trialUsed === 0 && subscription.trialActivatedAt && subscription.trialEndsAt &&
        subscription.trialEndsAt.getTime() - subscription.trialActivatedAt.getTime() === 14 * 86400000, 'OWNED_TRIAL_CENSUS');
      check(sessions.length <= 1 && user._count.authSessions === sessions.length, 'OWNED_SESSION_CENSUS');
      if (!cleanup) check(sessions.length === 1 && user.mfaEnabled === owner.mfa &&
        Boolean(sessions[0]!.mfaVerifiedAt) === owner.mfa && !sessions[0]!.revokedAt &&
        sessions[0]!.expiresAt > new Date(), 'REAL_CURRENT_SESSION_REQUIRED');
      const configs = tenant.configurationVersions, audits = tenant.auditLogs;
      check(configs.length <= 1 && audits.length <= 3 && (cleanup ||
        (configs.length === Number(Boolean(owner.config)) && audits.length === owner.audits)), 'BOUNDED_CONFIG_CENSUS');
      for (const config of configs) check(owner.saving && config.source === owner.source && config.tenantId === tenant.id &&
        config.locationId === location.id && config.userId === user.id && config.version === 1 &&
        Object.values(config._count).every(value => value === 0) && (!owner.config || config.id === owner.config), 'EXACT_OWNED_CONFIG');
      for (const audit of audits) check(audit.tenantId === tenant.id && audit.userId === user.id &&
        audit.action === 'SETTINGS_CHANGED' && audit.entityType === 'ClinicConfigurationVersion' &&
        configs.some(config => config.id === audit.entityId) && !audit.impersonatedBy && !audit.assessmentSessionId &&
        ['DRAFT_CREATED', 'SYNTHETIC_TEST', 'DRAFT_UPDATED'].includes(String(object(audit.details).action)), 'EXACT_OWNED_AUDIT');
      const allowed = { users: 1, locations: 1, configurationVersions: configs.length, auditLogs: audits.length };
      for (const [key, count] of Object.entries(tenant._count))
        check(count === (allowed[key as keyof typeof allowed] ?? 0), 'FORBIDDEN_TENANT_CHILD');
      for (const [key, count] of Object.entries(user._count))
        check(count === (key === 'authSessions' ? sessions.length : key === 'auditLogs' ? audits.length : 0), 'FORBIDDEN_USER_CHILD');
      for (const [key, count] of Object.entries(location._count))
        check(count === (key === 'configurationVersions' ? configs.length : 0), 'FORBIDDEN_LOCATION_CHILD');
      for (const [key, value] of Object.entries({ user: user.id, tenant: tenant.id, location: location.id, subscription: subscription.id })) {
        const captured = owner[key as 'user' | 'tenant' | 'location' | 'subscription'];
        check(uuid(value) && (!captured || captured === value), 'CAPTURED_ID_PARITY');
      }
      owner.user = user.id; owner.tenant = tenant.id; owner.location = location.id; owner.subscription = subscription.id;
      if (sessions[0]) {
        check(!owner.session || owner.session === sessions[0].id, 'CAPTURED_SESSION_PARITY');
        owner.session = sessions[0].id;
      }
      return { user: user.id, tenant: tenant.id, location: location.id, subscription: subscription.id,
        sessions: sessions.map(session => session.id), configs, audits };
    }
    async function cleanup(owner: Owner) {
      proof.require(true);
      check(proof.pending.size === 0, 'UNKNOWN_WORK_BLOCKS_DELETION');
      const owned = await census(owner, true);
      if (owned) {
        const remove = async (operation: () => PromiseLike<{ count: number }>, expected: number) => {
          check(proof.pending.size === 0, 'UNKNOWN_WORK_BLOCKS_DELETION');
          check((await proof.query(operation, true)).count === expected, 'EXACT_DELETE_COUNT');
        };
        await remove(() => db!.auditLog.deleteMany({ where: { tenantId: owned.tenant, userId: owned.user,
          id: { in: owned.audits.map(audit => audit.id) } } }), owned.audits.length);
        await remove(() => db!.clinicConfigurationVersion.deleteMany({ where: { tenantId: owned.tenant,
          id: { in: owned.configs.map(config => config.id) } } }), owned.configs.length);
        await remove(() => db!.authChallenge.deleteMany({ where: { userId: owned.user } }), 0);
        await remove(() => db!.authSession.deleteMany({ where: { userId: owned.user, id: { in: owned.sessions } } }), owned.sessions.length);
        await remove(() => db!.user.deleteMany({ where: { id: owned.user, email: owner.email, tenantId: owned.tenant } }), 1);
        await remove(() => db!.subscription.deleteMany({ where: { id: owned.subscription, tenantId: owned.tenant } }), 1);
        await remove(() => db!.location.deleteMany({ where: { id: owned.location, tenantId: owned.tenant } }), 1);
        await remove(() => db!.tenant.deleteMany({ where: { id: owned.tenant, name: owner.name } }), 1);
      }
      const keys = [...owner.rates.keys()];
      const rates = await proof.query(() => db!.rateLimitBucket.findMany({ where: { key: { in: keys } }, take: 65 }), true);
      check(rates.length <= 4 && rates.every(rate => keys.includes(rate.key)), 'OWNED_RATE_CENSUS');
      check((await proof.query(() => db!.rateLimitBucket.deleteMany({ where: { key: { in: keys } } }), true)).count === rates.length, 'EXACT_RATE_DELETE');
      check((await proof.query(() => db!.user.count({ where: { email: owner.email } }), true)) === 0 &&
        (await proof.query(() => db!.tenant.count({ where: { name: owner.name } }), true)) === 0 &&
        (await proof.query(() => db!.rateLimitBucket.count({ where: { key: { in: keys } } }), true)) === 0, 'OWNED_CLEANUP_READBACK');
      cleaned++;
    }
    try {
      guard();
      check(!('AUTH_ENCRYPTION_KEY' in process.env) && !('dripwellDatabase' in globalThis), 'INITIAL_OWNERSHIP_REQUIRED');
      for (const owner of owners) context.owned.add(owner.jar);
      vi.stubGlobal('fetch', () => { context.external++; throw new Error('Owned proof forbids external fetch'); });
      hooksSet = true;
      const modules = await proof.work(() => Promise.all([import('./db'), import('../app/api/auth/register/route'),
        import('../app/api/auth/mfa/route'), import('../app/api/clinic/route'), import('otplib')]));
      check(!('dripwellDatabase' in globalThis), 'IMPORTS_MUST_NOT_SELECT_A_CLIENT');
      db = modules[0].getDb();
      clientOwned = (globalThis as { dripwellDatabase?: Db }).dripwellDatabase === db;
      check(clientOwned, 'EXCLUSIVE_REAL_CLIENT_REQUIRED');
      [register, mfa, clinicPost, clinicGet] = [modules[1].POST, modules[2].POST, modules[3].POST, modules[3].GET];
      check((await proof.query(() => db!.user.findMany({ where: { email: { in: owners.map(owner => owner.email) } }, take: 65, select: { id: true } }))).length === 0 &&
        (await proof.query(() => db!.tenant.findMany({ where: { name: { in: owners.map(owner => owner.name) } }, take: 65, select: { id: true } }))).length === 0 &&
        (await proof.query(() => db!.rateLimitBucket.findMany({ where: { key: { in: allKeys() } }, take: 65, select: { key: true } }))).length === 0, 'PREDECLARED_SELECTORS_MUST_BE_ABSENT');
      reserved = true;
      process.env.AUTH_ENCRYPTION_KEY = randomBytes(32).toString('base64url');
      keySet = true;
      phase = 'REGISTER';
      for (const owner of owners) {
        const result = await call(owner, '/api/auth/register', { clinicName: owner.name, firstName: 'Fixture', lastName: owner.name.slice(-1),
          email: owner.email, password: owner.password }, 201);
        check(result.ok === true && result.redirect === '/setup' && Object.keys(result).length === 2, 'REGISTER_RETURN_CONTRACT');
        check(typeof owner.jar.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(owner.jar.token), 'REAL_COOKIE_REQUIRED');
        check(await census(owner), 'REGISTER_LINEAGE_REQUIRED');
      }
      check(owners[0]!.tenant !== owners[1]!.tenant && owners[0]!.user !== owners[1]!.user &&
        owners[0]!.location !== owners[1]!.location && owners[0]!.session !== owners[1]!.session &&
        owners[0]!.subscription !== owners[1]!.subscription, 'DISJOINT_NORMAL_LINEAGES');
      check((await proof.query(() => db!.rateLimitBucket.findMany({ where: { key: { in: owners.flatMap(owner => [
        digest(`mfa-user:${owner.user}`), digest(`clinic-mutation:${owner.user}`)]) } }, take: 65, select: { key: true } }))).length === 0, 'NEW_AUTH_RATE_KEYS_MUST_BE_ABSENT');
      for (const owner of owners) {
        owner.rates.set(digest(`mfa-user:${owner.user}`), 0);
        owner.rates.set(digest(`clinic-mutation:${owner.user}`), 0);
      }
      phase = 'MFA';
      for (const owner of owners) {
        const begun = await call(owner, '/api/auth/mfa', { action: 'begin', password: owner.password });
        check(typeof begun.secret === 'string' && typeof begun.otpauthUri === 'string' && begun.expiresInSeconds === 600, 'ENROLLMENT_RETURN_CONTRACT');
        const token = await proof.work(() => modules[4].generate({ secret: begun.secret as string }));
        const finished = await call(owner, '/api/auth/mfa', { action: 'confirm', code: token });
        check(finished.ok === true && Array.isArray(finished.recoveryCodes) && finished.recoveryCodes.length === 10 &&
          finished.recoveryCodes.every(code => typeof code === 'string' && /^[A-F0-9]{6}(-[A-F0-9]{6}){3}$/.test(code)), 'NORMAL_MFA_CONFIRM_CONTRACT');
        owner.mfa = true;
        check(await census(owner), 'VERIFIED_CURRENT_OWNER_REQUIRED');
      }
      phase = 'DASHBOARD';
      for (const owner of owners) {
        const dashboard = await call(owner, '/api/clinic');
        const user = object(dashboard.user), configuration = object(dashboard.configuration);
        check(user.id === owner.user && user.role === 'SUPER_USER' && user.canApproveClinical === false &&
          object(dashboard.clinic).id === owner.tenant && Array.isArray(dashboard.locations) && dashboard.locations.length === 1 &&
          object(dashboard.locations[0]).id === owner.location && configuration.active === null && configuration.draft === null, 'NORMAL_DASHBOARD_SCOPE');
      }
      function catalog(owner: Owner, cents: number): ClinicConfiguration {
        return { schemaVersion: 2, clinic: { name: owner.name, currency: 'USD', contact: '', brandColor: '#0d9488' }, questions: [],
          products: [{ id: `fixture-${owner.name.slice(-1)}`, name: `Fixture ${owner.name.slice(-1)} ${cents === 8500 ? 'planning' : 'orientation'}`,
            type: 'SERVICE', description: 'Disclosed nonclinical synthetic offer', priceCents: cents, currency: 'USD', available: true,
            ingredients: [], goalTags: [], compatibleWith: [], benefits: [], terms: '', clinical: false,
            rules: { validated: false, validationNote: '', eligibility: [], exclusions: [], rationale: '' }, priority: 0 }],
          recommendationPolicy: { clinicalValidated: false, validatedBy: '', validationNote: '', maxAddOns: 0, maxWellnessOffers: 0 },
          reminders: { careOutcomeHours: 24, wellnessDecisionHours: 24 }, retention: { audioDays: 1, documentDays: 1, shareExpiryHours: 1 } };
      }
      phase = 'SAVE';
      for (const [i, owner] of owners.entries()) {
        owner.saving = true;
        const saved = object((await call(owner, '/api/clinic', { action: 'config.saveDraft', locationId: owner.location,
          configuration: catalog(owner, i ? 8500 : 5000), source: owner.source })).result);
        check(uuid(saved.id) && saved.status === 'DRAFT' && saved.revision === 1 && saved.version === 1, 'REAL_DRAFT_REQUIRED');
        owner.config = saved.id;
        owner.audits = 1;
      }
      const summary = { goals: [], symptoms: [], history: [], medications: [], allergies: [], preferences: ['Disclosed fixture only'],
        uncertainties: [], answers: {}, staffReviewed: true, wellnessOffersAllowed: null };
      phase = 'TEST';
      for (const owner of owners) {
        const result = object((await call(owner, '/api/clinic', { action: 'config.test', configurationVersionId: owner.config,
          expectedVersion: 1, summary, notes: 'Nonclinical fixture evaluation, not model output' })).result);
        const view = object(result.configuration), evaluation = object(result.test), initial = object(evaluation.initial);
        check(uuid(evaluation.id) && typeof evaluation.testedAt === 'string' && Number.isFinite(Date.parse(evaluation.testedAt)) &&
          same(evaluation.summary, summary) && evaluation.approvedByOwner === false && initial.configurationVersionId === owner.config &&
          initial.blocked === true && Array.isArray(initial.items) && initial.items.length === 0 &&
          view.id === owner.config && view.status === 'TESTED' && view.revision === 2 && same(view.tests, [evaluation]), 'REAL_SAVED_EVALUATION_REQUIRED');
        owner.testId = evaluation.id;
        owner.audits = 2;
      }
      const beforeA = await census(owners[0]!), beforeB = await census(owners[1]!);
      check(beforeA && beforeB && same(beforeA.configs[0]!.payload, catalog(owners[0]!, 5000)) &&
        same(beforeB.configs[0]!.payload, catalog(owners[1]!, 8500)) && beforeA.configs[0]!.status === 'TESTED' &&
        beforeB.configs[0]!.status === 'TESTED' && beforeA.configs[0]!.revision === 2 && beforeB.configs[0]!.revision === 2, 'DIFFERENT_PERSISTED_CATALOGS');
      for (const [index, saved] of [beforeA, beforeB].entries()) {
        const row = saved.configs[0]!;
        check(row.activatedAt === null && row.activatedById === null && row.clinicalValidatedById === null &&
          Array.isArray(row.tests) && row.tests.length === 1, 'INACTIVE_SAVED_TEST_ROW');
        const evaluation = object(row.tests[0]), initial = object(evaluation.initial);
        check(evaluation.id === owners[index]!.testId && same(evaluation.summary, summary) &&
          evaluation.approvedByOwner === false && initial.configurationVersionId === row.id &&
          initial.blocked === true && Array.isArray(initial.items) && initial.items.length === 0, 'PERSISTED_EVALUATION_CORRELATION');
      }
      phase = 'ACTIVATION_DENIAL';
      for (const owner of owners) check((await call(owner, '/api/clinic', { action: 'config.activate', configurationVersionId: owner.config,
        expectedVersion: 2, approvedTestIds: [owner.testId] }, 422)).code === 'SUCCESSFUL_TEST_REQUIRED', 'NONCLINICAL_ACTIVATION_DENIAL');
      check(same(await census(owners[0]!), beforeA) && same(await census(owners[1]!), beforeB), 'ACTIVATION_PRESERVES_CONFIG_AND_AUDITS');
      phase = 'FOREIGN_DENIAL';
      check((await call(owners[0]!, '/api/clinic', { action: 'config.test', configurationVersionId: owners[1]!.config,
        expectedVersion: 2, summary }, 404)).code === 'CONFIGURATION_NOT_FOUND', 'FOREIGN_TEST_DENIAL');
      check((await call(owners[0]!, '/api/clinic', { action: 'config.saveDraft', configurationVersionId: owners[1]!.config,
        expectedVersion: 2, configuration: catalog(owners[0]!, 5500), source: owners[0]!.source }, 404)).code === 'CONFIGURATION_NOT_FOUND', 'FOREIGN_EDIT_DENIAL');
      check(same(await census(owners[0]!), beforeA) && same(await census(owners[1]!), beforeB), 'FOREIGN_DENIAL_PRESERVATION');
      phase = 'DRAFT_REVISION';
      const edit = object((await call(owners[0]!, '/api/clinic', { action: 'config.saveDraft', configurationVersionId: owners[0]!.config,
        expectedVersion: 2, configuration: catalog(owners[0]!, 5500), source: owners[0]!.source })).result);
      owners[0]!.audits = 3;
      const edited = await census(owners[0]!);
      check(edited && edit.id === owners[0]!.config && edit.revision === 3 && edit.status === 'DRAFT' &&
        same(edit.tests, []) && same(edited.configs[0]!.tests, []) && edited.configs[0]!.revision === 3 &&
        same(edited.configs[0]!.payload, catalog(owners[0]!, 5500)) && same(await census(owners[1]!), beforeB), 'A_EDIT_B_CONTROL_PRESERVATION');
      phase = 'ROLLBACK_DENIAL';
      check((await call(owners[1]!, '/api/clinic', { action: 'config.rollback', configurationVersionId: owners[1]!.config }, 409)).code ===
        'ROLLBACK_NOT_AVAILABLE' && same(await census(owners[1]!), beforeB), 'TESTED_ROLLBACK_DENIAL_PRESERVATION');
      const rates = await proof.query(() => db!.rateLimitBucket.findMany({ where: { key: { in: allKeys() } }, take: 65 }));
      check(rates.length === 8 && rates.every(rate => owners.some(owner => owner.rates.get(rate.key) === rate.count)) &&
        owners[0]!.rates.get(digest(`clinic-mutation:${owners[0]!.user}`)) === 6 &&
        owners[1]!.rates.get(digest(`clinic-mutation:${owners[1]!.user}`)) === 4 && proof.handlers === 18 && context.external === 0, 'REAL_EXPECTED_RATE_EFFECTS');
    } catch { proof.stop(); }
    finally {
      phase = 'CLOSURE';
      try { await proof.join(); } catch { proof.stop(); }
      if (proof.pending.size === 0 && performance.now() - proof.began < 30000) {
        if (db && clientOwned && reserved) for (const owner of owners) {
          try { await cleanup(owner); } catch { proof.stop(); }
        }
        if (db && clientOwned && proof.pending.size === 0) {
          try { await proof.work(() => db!.$disconnect(), true); } catch { proof.stop(); }
        }
        if (proof.pending.size === 0) {
          try {
            proof.require(true);
            if (keySet) delete process.env.AUTH_ENCRYPTION_KEY;
            for (const owner of owners) { owner.jar.token = undefined; owner.password = ''; context.owned.delete(owner.jar); }
            if (hooksSet) vi.unstubAllGlobals();
          } catch { proof.stop(); }
        }
      }
      console.log(JSON.stringify({ schema: 'TASK059_OWNER_HANDLER_PG_V1', phase, firstBoundary: proof.firstBoundary ?? null,
        startedHandlers: proof.handlers, returnedHandlers: proof.returned,
        ormCalls: proof.orm, pending: proof.pending.size, cleanedLineages: cleaned,
        status: proof.first ? 'FAILED' : 'CANDIDATE', unresolvedLineages: 2 - cleaned,
        elapsedMs: Math.ceil(performance.now() - proof.began), scope: 'IN_PROCESS_HANDLER_DB_ONLY' }));
    }
    try { proof.require(true); } catch { proof.stop(); }
    if (proof.first) throw proof.first;
    check(cleaned === 2 && proof.pending.size === 0 && context.external === 0 && !('AUTH_ENCRYPTION_KEY' in process.env), 'TIMELY_OWNED_CLOSURE_REQUIRED');
  });
});
