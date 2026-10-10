import { randomBytes, randomUUID } from 'node:crypto';
import { describe, test, vi } from 'vitest';

// The marker is the only shim. Auth, domain operations and Prisma stay real.
vi.mock('server-only', () => ({}));
type Db = ReturnType<typeof import('./db')['getDb']>;
type Actor = import('./auth').ClinicActor;
class SafeStop extends Error {
  constructor(readonly code: string) {
    super(`TASK061:${code}`);
    this.stack = this.message;
  }
}
function check(value: unknown, code: string): asserts value {
  if (!value) throw new SafeStop(code);
}
function guard() {
  const target = process.env.TEST_DATABASE_URL;
  check(Boolean(target), 'TARGET_REQUIRED');
  let url: URL;
  try { url = new URL(target!); } catch { throw new SafeStop('TARGET_INVALID'); }
  check(process.versions.node.split('.')[0] === '24' && process.env.CI === 'true' &&
    process.env.NODE_ENV === 'test' && process.env.DATABASE_URL === target &&
    ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname === 'localhost' &&
    url.port === '5432' && url.pathname === '/dripwell_verification' && url.username === 'dripwell_test' &&
    !url.search && !url.hash && process.env.APP_URL === 'http://localhost:3000' &&
    process.env.ALLOW_REAL_CLIENT_DATA === 'false' && !('VERCEL' in process.env), 'EXACT_CI_REQUIRED');
}
function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]));
  return value;
}
function encoded(value: unknown) {
  const text = JSON.stringify(normalize(value));
  check(Buffer.byteLength(text) <= 32768, 'CENSUS_BYTES');
  return text;
}
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
class Proof {
  readonly began = performance.now();
  readonly pending = new Set<Promise<unknown>>();
  first?: string;
  uncertain = false;
  orm = 0;
  domain = 0;
  returned = 0;
  auth = 0;
  deleted = 0;
  stop(code: string) { this.first ??= code; }
  require(cleanup = false) {
    guard();
    if (performance.now() - this.began >= (cleanup ? 30000 : 20000)) {
      this.uncertain = true;
      this.stop('ORIGINAL_CLOCK_EXPIRED');
      throw new SafeStop(this.first!);
    }
    if (this.first && !cleanup) throw new SafeStop(this.first);
  }
  async wait<T>(pending: Promise<T>, cleanup: boolean): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([pending, new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          this.uncertain = true;
          this.stop('OWNED_WORK_UNKNOWN');
          reject(new SafeStop(this.first!));
        }, Math.max(0, (cleanup ? 30000 : 20000) - (performance.now() - this.began)));
      })]);
      this.require(cleanup);
      return value;
    } finally { if (timer) clearTimeout(timer); }
  }
  async work<T>(operation: () => PromiseLike<T>, cleanup = false): Promise<T> {
    this.require(cleanup);
    // The original lazy result is assimilated once, with the call's real receiver.
    const pending = Promise.resolve().then(() => {
      this.require(cleanup);
      return operation();
    }).then(value => ({ ok: true as const, value }), error => {
      this.stop(error instanceof SafeStop ? error.code : 'WORK_FAILED');
      if (!(error instanceof SafeStop)) this.uncertain = true;
      return { ok: false as const };
    });
    this.pending.add(pending);
    void pending.then(() => this.pending.delete(pending));
    const result = await this.wait(pending, cleanup);
    if (!result.ok) throw new SafeStop(this.first!);
    return result.value;
  }
  async join() {
    this.require(true);
    await this.wait(Promise.allSettled([...this.pending]), true);
    check(this.pending.size === 0, 'WORK_NOT_JOINED');
  }
}
const suite = process.env.CI === 'true' || process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('Current clinic transaction authority', () => {
  test('rereads demoted owner and revoked-session authority before writing clinic locations', async () => {
    const proof = new Proof();
    const nonce = randomUUID();
    const cohorts = ['A', 'B'].map(label => ({ label, tenant: randomUUID(), location: randomUUID(),
      user: randomUUID(), session: randomUUID(), token: randomBytes(32).toString('base64url'),
      name: `Task061 ${nonce} ${label}`, slug: `task061-${nonce}-${label.toLowerCase()}`,
      email: `${label.toLowerCase()}-${nonce}@task061.invalid` }));
    const [a, b] = cohorts as [typeof cohorts[number], typeof cohorts[number]];
    const ids = (key: 'tenant' | 'location' | 'user' | 'session') => cohorts.map(row => row[key]);
    const attempted = new Set<string>();
    const globalDb = globalThis as { dripwellDatabase?: Db };
    let db: Db | undefined, owned = false, reserved = false, issued = false, resolved = false, closed = false;
    let generated: string | undefined, auditId: string | undefined, phase = 'ADMISSION';
    async function query<T>(operation: () => PromiseLike<T>, cleanup = false) {
      return proof.work(() => {
        check(owned && db && globalDb.dripwellDatabase === db, 'CLIENT_OWNERSHIP');
        check(++proof.orm <= 64, 'ORM_LIMIT');
        return operation();
      }, cleanup);
    }
    async function census(cleanup = false) {
      const tenants = await query(() => db!.tenant.findMany({ where: { OR: [
        { id: { in: ids('tenant') } }, { slug: { in: cohorts.map(row => row.slug) } } ] }, orderBy: { id: 'asc' }, take: 17 }), cleanup);
      const users = await query(() => db!.user.findMany({ where: { OR: [
        { id: { in: ids('user') } }, { tenantId: { in: ids('tenant') } },
        { email: { in: cohorts.map(row => row.email) } } ] }, orderBy: { id: 'asc' }, take: 17 }), cleanup);
      const locations = await query(() => db!.location.findMany({ where: { OR: [
        { id: { in: ids('location') } }, { tenantId: { in: ids('tenant') } } ] }, orderBy: { id: 'asc' }, take: 17 }), cleanup);
      const sessions = await query(() => db!.authSession.findMany({ where: { OR: [
        { id: { in: ids('session') } }, { userId: { in: ids('user') } } ] }, orderBy: { id: 'asc' }, take: 17 }), cleanup);
      const audits = await query(() => db!.auditLog.findMany({ where: { OR: [
        { tenantId: { in: ids('tenant') } }, { userId: { in: ids('user') } } ] }, orderBy: { id: 'asc' }, take: 17 }), cleanup);
      const rows = { tenants, users, locations, sessions, audits };
      check(Object.values(rows).every(list => list.length < 17) &&
        Object.values(rows).reduce((sum, list) => sum + list.length, 0) <= 16, 'ROW_LIMIT');
      encoded(rows);
      return rows;
    }
    type Census = Awaited<ReturnType<typeof census>>;
    function part(rows: Census, cohort: typeof a) {
      return encoded({ tenants: rows.tenants.filter(row => row.id === cohort.tenant),
        users: rows.users.filter(row => row.tenantId === cohort.tenant),
        locations: rows.locations.filter(row => row.tenantId === cohort.tenant),
        sessions: rows.sessions.filter(row => row.userId === cohort.user),
        audits: rows.audits.filter(row => row.tenantId === cohort.tenant) });
    }
    function lineage(rows: Census) {
      for (const row of rows.tenants) check(cohorts.some(c => attempted.has(c.tenant) && row.id === c.tenant &&
        row.name === c.name && row.slug === c.slug), 'TENANT_LINEAGE');
      for (const row of rows.users) check(cohorts.some(c => attempted.has(c.user) && row.id === c.user &&
        row.tenantId === c.tenant && row.email === c.email && !row.canApproveClinical && !row.mfaEnabled), 'USER_LINEAGE');
      for (const row of rows.sessions) check(cohorts.some(c => attempted.has(c.session) &&
        row.id === c.session && row.userId === c.user), 'SESSION_LINEAGE');
      for (const row of rows.locations) check(cohorts.some(c => attempted.has(c.location) &&
        row.id === c.location && row.tenantId === c.tenant && row.name === c.name) ||
        (resolved && row.id === generated && row.tenantId === a.tenant && row.name === `${a.name} positive`), 'LOCATION_LINEAGE');
      for (const row of rows.audits) check(resolved && row.id === auditId && row.tenantId === a.tenant &&
        row.userId === a.user && row.entityType === 'Location' && row.entityId === generated &&
        row.action === 'SETTINGS_CHANGED' && encoded(row.details) === encoded({ action: 'LOCATION_CREATED', name: `${a.name} positive` }), 'AUDIT_LINEAGE');
    }
    async function children(rows: Census) {
      const tenants = await query(() => db!.tenant.findMany({ where: { id: { in: ids('tenant') } },
        include: { _count: true, subscription: true, referralReceived: true }, take: 17 }), true);
      const users = await query(() => db!.user.findMany({ where: { id: { in: ids('user') } }, include: { _count: true }, take: 17 }), true);
      const locations = await query(() => db!.location.findMany({ where: { id: { in: rows.locations.map(row => row.id) } }, include: { _count: true }, take: 17 }), true);
      check(tenants.length === rows.tenants.length && users.length === rows.users.length &&
        locations.length === rows.locations.length, 'CHILD_CENSUS_COUNT');
      for (const row of tenants) {
        check(row.subscription === null && row.referralReceived === null, 'OPTIONAL_CHILD_FORBIDDEN');
        const expected: Record<string, number> = { locations: rows.locations.filter(x => x.tenantId === row.id).length,
          users: rows.users.filter(x => x.tenantId === row.id).length, auditLogs: rows.audits.filter(x => x.tenantId === row.id).length };
        check(Object.entries(row._count).every(([key, count]) => count === (expected[key] ?? 0)), 'TENANT_CHILD_FORBIDDEN');
      }
      for (const row of users) {
        const expected: Record<string, number> = { authSessions: rows.sessions.filter(x => x.userId === row.id).length,
          auditLogs: rows.audits.filter(x => x.userId === row.id).length };
        check(Object.entries(row._count).every(([key, count]) => count === (expected[key] ?? 0)), 'USER_CHILD_FORBIDDEN');
      }
      check(locations.every(row => Object.values(row._count).every(count => count === 0)), 'LOCATION_CHILD_FORBIDDEN');
    }
    async function remove(operation: () => PromiseLike<{ count: number }>, count: number) {
      const result = await query(operation, true);
      check(result.count === count, 'EXACT_DELETE_COUNT');
      proof.deleted += result.count;
    }
    try {
      proof.require();
      check(!('dripwellDatabase' in globalDb), 'BORROWED_CLIENT');
      const database = await proof.work(() => import('./db'));
      const auth = await proof.work(() => import('./auth'));
      const domain = await proof.work(() => import('./clinic'));
      const errors = await proof.work(() => import('./errors'));
      check(!('dripwellDatabase' in globalDb), 'IMPORT_SELECTED_CLIENT');
      proof.require();
      db = database.getDb();
      owned = globalDb.dripwellDatabase === db;
      check(owned, 'CREATED_CLIENT_REQUIRED');
      const empty = await census();
      check(Object.values(empty).every(rows => rows.length === 0), 'RESERVATION_CONFLICT');
      reserved = true;
      phase = 'SEED';
      for (const c of cohorts) {
        attempted.add(c.tenant);
        check((await query(() => db!.tenant.create({ data: { id: c.tenant, name: c.name,
          slug: c.slug, state: '', medicalDirector: '' } }))).id === c.tenant, 'TENANT_CREATED');
        attempted.add(c.location);
        check((await query(() => db!.location.create({ data: { id: c.location, tenantId: c.tenant, name: c.name } }))).id === c.location, 'LOCATION_CREATED');
        attempted.add(c.user);
        check((await query(() => db!.user.create({ data: { id: c.user, tenantId: c.tenant,
          email: c.email, passwordHash: 'task061-unusable-password-hash', firstName: 'Synthetic', lastName: c.label,
          role: 'SUPER_USER', canApproveClinical: false, mfaEnabled: false } }))).id === c.user, 'USER_CREATED');
        attempted.add(c.session);
        check((await query(() => db!.authSession.create({ data: { id: c.session, userId: c.user,
          tokenHash: auth.hashToken(c.token), expiresAt: new Date(Date.now() + 3600000) } }))).id === c.session, 'SESSION_CREATED');
      }
      const seeded = await census();
      lineage(seeded);
      check(seeded.tenants.length === 2 && seeded.users.length === 2 && seeded.locations.length === 2 &&
        seeded.sessions.length === 2 && seeded.audits.length === 0, 'SEEDED_COUNTS');
      const control = part(seeded, b);
      phase = 'ACTOR';
      const actor = await proof.work(() => {
        check(owned && globalDb.dripwellDatabase === db, 'AUTH_CLIENT_OWNERSHIP');
        proof.auth++;
        return auth.getActorFromRequest(new Request('http://localhost:3000', { headers: { cookie: `dripwell_session=${a.token}` } }));
      });
      check(actor && actor.id === a.user && actor.userId === a.user && actor.tenantId === a.tenant &&
        actor.tenant.id === a.tenant && actor.locationId === a.location && actor.sessionId === a.session &&
        actor.role === 'SUPER_USER' && !actor.canApproveClinical && !actor.mfaEnabled && !actor.mfaVerified &&
        actor.mfaVerifiedAt === null, 'ACTOR_IDENTITY');
      const admitted: Actor = actor;
      const actorBefore = encoded(admitted);
      async function call(name: string, denial?: { status: number; code: string }) {
        return proof.work(async () => {
          check(owned && globalDb.dripwellDatabase === db && ++proof.domain <= 3, 'DOMAIN_ADMISSION');
          let value: unknown;
          try { value = await domain.mutateClinicAction(admitted, { action: 'location.create', name, address: '', phone: '' }); }
          catch (error) {
            proof.returned++;
            if (denial && error instanceof errors.ApiError && error.status === denial.status && error.code === denial.code) return { denied: true };
            proof.uncertain = true;
            throw new SafeStop('DOMAIN_UNEXPECTED_ERROR');
          }
          proof.returned++;
          check(!denial, 'DENIAL_RETURNED_SUCCESS');
          return value;
        });
      }
      phase = 'POSITIVE';
      issued = true;
      const positive = await call(`${a.name} positive`);
      check(positive !== null && typeof positive === 'object' && 'ok' in positive && positive.ok === true &&
        'result' in positive && positive.result !== null && typeof positive.result === 'object' &&
        'id' in positive.result && uuid(positive.result.id), 'POSITIVE_RESULT');
      generated = positive.result.id;
      const original = await census();
      const locations = original.locations.filter(row => row.id === generated && row.tenantId === a.tenant && row.name === `${a.name} positive`);
      const audits = original.audits.filter(row => row.tenantId === a.tenant && row.userId === a.user &&
        row.entityType === 'Location' && row.entityId === generated && row.action === 'SETTINGS_CHANGED');
      check(locations.length === 1 && audits.length === 1 && uuid(audits[0]!.id) &&
        encoded(audits[0]!.details) === encoded({ action: 'LOCATION_CREATED', name: `${a.name} positive` }), 'POSITIVE_LINEAGE');
      auditId = audits[0]!.id;
      resolved = true;
      lineage(original);
      check(original.tenants.length === 2 && original.users.length === 2 && original.sessions.length === 2 &&
        original.locations.length === 3 && original.audits.length === 1, 'POSITIVE_COUNTS');
      check(part(original, b) === control, 'POSITIVE_B_PRESERVATION');
      phase = 'DEMOTION';
      check((await query(() => db!.user.update({ where: { id: a.user }, data: { role: 'STAFF' } }))).role === 'STAFF', 'DEMOTION_COMMITTED');
      const demoted = await census();
      check(part(demoted, b) === control && demoted.users.find(row => row.id === a.user)?.role === 'STAFF', 'DEMOTION_BASELINE');
      await call(`${a.name} denied-role`, { status: 403, code: 'OWNER_REQUIRED' });
      check(encoded(await census()) === encoded(demoted) && encoded(admitted) === actorBefore, 'DEMOTION_DENIAL_PRESERVATION');
      phase = 'REVOCATION';
      check((await query(() => db!.user.update({ where: { id: a.user }, data: { role: 'SUPER_USER' } }))).role === 'SUPER_USER', 'OWNER_RESTORED');
      check((await query(() => db!.authSession.update({ where: { id: a.session }, data: { revokedAt: new Date() } }))).revokedAt !== null, 'REVOCATION_COMMITTED');
      const revoked = await census();
      const revokedSession = revoked.sessions.find(row => row.id === a.session);
      check(part(revoked, b) === control && revokedSession && revokedSession.revokedAt !== null, 'REVOCATION_BASELINE');
      await call(`${a.name} denied-session`, { status: 401, code: 'SESSION_EXPIRED' });
      check(encoded(await census()) === encoded(revoked) && encoded(admitted) === actorBefore, 'REVOCATION_DENIAL_PRESERVATION');
      check(proof.domain === 3 && proof.returned === 3 && proof.auth === 1, 'EXPECTED_CALL_COUNTS');
    } catch (error) { proof.stop(error instanceof SafeStop ? error.code : 'PROOF_FAILED'); }
    finally {
      phase = 'CLOSURE';
      try {
        await proof.join();
        check(!proof.uncertain && (!issued || resolved), 'UNRESOLVED_OBLIGATIONS');
        if (owned && reserved) {
          const rows = await census(true);
          lineage(rows);
          await children(rows);
          await remove(() => db!.auditLog.deleteMany({ where: { id: { in: rows.audits.map(row => row.id) }, tenantId: a.tenant, userId: a.user } }), rows.audits.length);
          await remove(() => db!.authSession.deleteMany({ where: { id: { in: rows.sessions.map(row => row.id) }, userId: { in: ids('user') } } }), rows.sessions.length);
          await remove(() => db!.user.deleteMany({ where: { id: { in: rows.users.map(row => row.id) }, tenantId: { in: ids('tenant') }, email: { in: cohorts.map(row => row.email) } } }), rows.users.length);
          await remove(() => db!.location.deleteMany({ where: { id: { in: rows.locations.map(row => row.id) }, tenantId: { in: ids('tenant') } } }), rows.locations.length);
          await remove(() => db!.tenant.deleteMany({ where: { id: { in: rows.tenants.map(row => row.id) }, slug: { in: cohorts.map(row => row.slug) } } }), rows.tenants.length);
          check(Object.values(await census(true)).every(list => list.length === 0), 'ABSENCE_READBACK');
        }
        if (owned) {
          check(globalDb.dripwellDatabase === db && proof.pending.size === 0, 'DISCONNECT_OWNERSHIP');
          await proof.work(() => db!.$disconnect(), true);
          proof.require(true);
          check(globalDb.dripwellDatabase === db && proof.pending.size === 0, 'REFERENCE_OWNERSHIP');
          delete globalDb.dripwellDatabase;
        }
        closed = true;
      } catch (error) { proof.stop(error instanceof SafeStop ? error.code : 'CLOSURE_FAILED'); }
    }
    const record = JSON.stringify({ task: 'TASK061', outcome: proof.first ? 'FAILED' : 'CLOSURE_CANDIDATE',
      first: proof.first ?? null, phase, auth: proof.auth, domain: proof.domain, returned: proof.returned,
      additionalOrm: proof.orm, deleted: proof.deleted, pending: proof.pending.size,
      unresolved: !closed, elapsedMs: Math.floor(performance.now() - proof.began) });
    check(Buffer.byteLength(record) <= 2048, 'SAFE_RECORD_LIMIT');
    if (!closed || performance.now() - proof.began >= 30000) throw new SafeStop(record);
    await proof.work(() => new Promise<void>((resolve, reject) => {
      process.stdout.write(record + '\n', error => error ? reject(new SafeStop('SAFE_OUTPUT_FAILED')) : resolve());
    }), true);
    proof.require(true);
    if (proof.first) throw new SafeStop(record);
  });
});
