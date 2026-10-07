import { randomUUID } from 'node:crypto';
import { describe, test, vi } from 'vitest';

type Db = ReturnType<typeof import('./db')['getDb']>;
type Actor = import('./auth').ClinicActor;
type Row = Record<string, unknown>;
class SafeStop extends Error {
  constructor(readonly code: string) { super(`TASK062:${code}`); this.stack = this.message; }
}
function check(value: unknown, code: string): asserts value {
  if (!value) throw new SafeStop(code);
}
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function guard() {
  const target = process.env.TEST_DATABASE_URL;
  check(Boolean(target), 'TARGET_REQUIRED');
  let url: URL;
  try { url = new URL(target!); } catch { throw new SafeStop('TARGET_INVALID'); }
  check(process.env.CI === 'true' && process.env.NODE_ENV === 'test' &&
    process.versions.node.split('.')[0] === '24' && !('VERCEL' in process.env) &&
    process.env.DATABASE_URL === target && ['postgres:', 'postgresql:'].includes(url.protocol) &&
    url.hostname === 'localhost' && url.port === '5432' && url.pathname === '/dripwell_verification' &&
    url.username === 'dripwell_test' && !url.search && !url.hash &&
    process.env.APP_URL === 'http://localhost:3000' && process.env.ALLOW_REAL_CLIENT_DATA === 'false', 'EXACT_CI_REQUIRED');
}
function normalized(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const list = value.map(normalized);
    return list.every(item => item && typeof item === 'object' && 'id' in item)
      ? list.sort((a, b) => String((a as Row).id).localeCompare(String((b as Row).id))) : list;
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalized(item)]));
  return value;
}
function encoded(value: unknown) {
  const text = JSON.stringify(normalized(value));
  check(Buffer.byteLength(text) <= 32768, 'SNAPSHOT_BYTES');
  return text;
}
const omit = (row: Row, keys: string[]) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
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
  identity?: () => void;
  service = 0;
  reconciles = 0;
  dashboards = 0;
  mutations = 0;
  returned = 0;
  denied = 0;
  orm = 0;
  cleanupOrm = 0;
  blocked = 0;
  deleted = 0;
  stop(code: string) { this.first ??= code; }
  require(cleanup = false) {
    guard();
    this.identity?.();
    if (performance.now() - this.began >= (cleanup ? 30000 : 20000)) {
      this.unknown = true;
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
          this.unknown = true;
          this.stop('OWNED_WORK_UNKNOWN');
          reject(new SafeStop(this.first!));
        }, Math.max(0, (cleanup ? 30000 : 20000) - (performance.now() - this.began)));
      })]);
      this.require(cleanup);
      return value;
    } finally { if (timer) clearTimeout(timer); }
  }
  async work<T>(operation: () => PromiseLike<T>, cleanup = false, allowed?: (error: unknown) => boolean): Promise<T> {
    this.require(cleanup);
    const pending = Promise.resolve().then(() => {
      this.require(cleanup);
      return operation(); // The real receiver produces one lazy promise, assimilated once.
    }).then(value => ({ ok: true as const, value }), error => {
      const intended = Boolean(allowed?.(error));
      if (!intended) {
        this.stop(error instanceof SafeStop ? error.code : 'WORK_FAILED');
        if (!(error instanceof SafeStop)) this.unknown = true;
      }
      return { ok: false as const, code: intended ? 'EXPECTED_START_BLOCKED' : this.first! };
    });
    this.pending.add(pending);
    void pending.then(() => this.pending.delete(pending));
    const result = await this.wait(pending, cleanup);
    if (!result.ok) throw new SafeStop(result.code);
    return result.value;
  }
  async join() {
    this.require(true);
    await this.wait(Promise.allSettled([...this.pending]), true);
    check(this.pending.size === 0, 'WORK_NOT_JOINED');
  }
}
const suite = process.env.CI === 'true' || process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('Current reminder recipient ownership', () => {
  test('moves an existing reminder to the current assignee without duplicates through archive and restore', async () => {
    const proof = new Proof();
    const originalDb = Object.getOwnPropertyDescriptor(globalThis, 'dripwellDatabase');
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const nonce = randomUUID();
    const [a, b] = ['A', 'B'].map(label => ({ label, tenant: randomUUID(), location: randomUUID(),
      config: randomUUID(), visit: randomUUID(), slug: `task062-${nonce}-${label.toLowerCase()}`,
      reference: `Task062 ${label} ${nonce}`, key: `task062:${nonce}:${label}` }));
    const members = [a, a, b].map((cohort, index) => ({ cohort, user: randomUUID(), session: randomUUID(),
      email: `staff${index}-${nonce}@task062.invalid`, tokenHash: randomUUID() }));
    const tenantIds = [a.tenant, b.tenant], locationIds = [a.location, b.location];
    const userIds = members.map(row => row.user), sessionIds = members.map(row => row.session);
    const configIds = [a.config, b.config], visitIds = [a.visit, b.visit];
    const owned = new Map<string, Set<string>>();
    const capturedRows = new Map<string, Map<string, Row>>();
    const deleteKeys: Record<string, string[]> = {
      tenant: ['id', 'slug'], location: ['id', 'tenantId'], user: ['id', 'tenantId', 'email'],
      authSession: ['id', 'userId', 'tokenHash'], clinicConfigurationVersion: ['id', 'tenantId', 'locationId', 'userId'],
      consultation: ['id', 'tenantId', 'locationId', 'configurationVersionId', 'providerId'],
      notification: ['id', 'tenantId', 'consultationId', 'entityId', 'idempotencyKey', 'userId'],
      consultationEvent: ['id', 'tenantId', 'consultationId', 'userId', 'action'],
    };
    let db: Db | undefined, getDb: (() => Db) | undefined, phase = 'ADMISSION';
    let reserved = false, restored = false, closed = false, resolved = true;
    let reminders: typeof import('../workflows/reminders') | undefined;
    const denyFetch = () => proof.work(async () => { throw new SafeStop('FETCH_FORBIDDEN'); });
    const remember = (model: string, row: Row) => {
      check(uuid(row.id), 'GENERATED_ID');
      const ids = owned.get(model) ?? new Set<string>();
      check(!ids.has(row.id), 'DUPLICATE_CAPTURE');
      ids.add(row.id); owned.set(model, ids);
      const rows = capturedRows.get(model) ?? new Map<string, Row>();
      rows.set(row.id, row); capturedRows.set(model, rows); return row;
    };
    async function query<T>(operation: () => PromiseLike<T>, cleanup = false) {
      return proof.work(() => {
        check(++proof.orm <= 288, 'ORM_LIMIT');
        if (cleanup) check(++proof.cleanupOrm <= 100, 'CLEANUP_ORM_LIMIT');
        else check(proof.orm - proof.cleanupOrm <= 188, 'SCENARIO_ORM_LIMIT');
        return operation();
      }, cleanup);
    }
    const t = { tenantId: { in: tenantIds } }, u = { userId: { in: userIds } };
    const v = { consultationId: { in: visitIds } }, l = { locationId: { in: locationIds } };
    const or = (...rows: Row[]) => ({ OR: rows });
    const ids = (values: string[]) => ({ id: { in: values } });
    const matrix: Record<string, Row> = {
      tenant: or(ids(tenantIds), { slug: { in: [a.slug, b.slug] } }),
      location: or(t, ids(locationIds)), user: or(t, ids(userIds), { email: { in: members.map(row => row.email) } }),
      authSession: or(u, ids(sessionIds), { tokenHash: { in: members.map(row => row.tokenHash) } }),
      clinicConfigurationVersion: or(t, l, u, ids(configIds)),
      consultation: or(t, l, ids(visitIds), { providerId: { in: userIds } },
        { configurationVersionId: { in: configIds } }, { idempotencyKey: { in: [a.key, b.key] } }),
      notification: or(t, u, v, { entityId: { in: visitIds } }), consultationEvent: or(t, u, v),
      assessmentSession: or(t, l, { providerId: { in: userIds } }), patientIntake: t, photoCapture: t,
      visualSignal: t, questionAnswer: t, patternMatch: t, recommendation: or(t, { providerId: { in: userIds } }),
      safetyFlag: or(t, { providerAcknowledgedById: { in: userIds } }), providerOverride: or(t, { providerId: { in: userIds } }),
      catalogItem: t, catalogItemCompatibility: t, assessmentHistory: t, assessmentChangeLog: or(t, { providerId: { in: userIds } }),
      auditLog: or(t, u, { entityId: { in: [...visitIds, ...configIds, ...locationIds, ...userIds] } }),
      feedback: or(t, { submitterId: { in: userIds } }, { assignedTo: { in: userIds } }),
      consultationRevision: or(t, u, v), consultationAdjustment: or(t, u, v), subscription: t, trialUsage: or(t, v),
      referral: or({ referrerTenantId: { in: tenantIds } }, { referredTenantId: { in: tenantIds } }), creditLedger: t,
      takeaway: or(t, v, { createdById: { in: userIds } }), shareLink: or(t, { createdById: { in: userIds } }),
      userInvite: or(t, { invitedById: { in: userIds } }),
      setupConversation: or(t, u, l), generationJob: or(t, u, v), recordingSegment: or(t, u, v),
      improvementProposal: or(t, u, { configurationVersionId: { in: configIds } }), agentContextSnapshot: or(t, u),
      setupRecordingUpload: or(t, u, l), recordingDeletionIntent: or(t, v), authChallenge: u,
      recommendationItem: or({ recommendation: t }, { catalogItem: t }), catalogItemIngredient: { catalogItem: t },
      shareVerification: { shareLink: t }, shareSession: { shareLink: t }, rateLimitBucket: { key: { contains: nonce } },
    };
    const delegates = () => db as unknown as Record<string, {
      findMany(input: { where: Row; take: number }): PromiseLike<Row[]>;
      deleteMany(input: { where: Row }): PromiseLike<{ count: number }>;
    }>;
    async function census(cleanup = false) {
      const rows: Record<string, Row[]> = {};
      for (const [model, where] of Object.entries(matrix)) {
        const expected = owned.get(model) ?? new Set<string>();
        rows[model] = await query(() => delegates()[model].findMany({ where, take: expected.size + 1 }), cleanup);
        check(rows[model].length === expected.size && rows[model].every(row => expected.has(String(row.id))), 'CENSUS_OWNERSHIP');
        for (const row of rows[model]) {
          const original = capturedRows.get(model)?.get(String(row.id));
          check(original, 'CAPTURE_REQUIRED');
          const changing = model === 'consultation' && row.id === a.visit
            ? ['providerId', 'version', 'updatedAt', 'archivedAt', 'archivedById', 'archiveReason']
            : model === 'notification' && row.tenantId === a.tenant ? ['userId', 'isRead', 'dismissedAt'] : [];
          check(encoded(omit(row, changing)) === encoded(omit(original, changing)), 'CENSUS_SCALAR_DRIFT');
          if (changing.length) check((row.tenantId === a.tenant) &&
            members.slice(0, 2).some(member => member.user === (model === 'consultation' ? row.providerId : row.userId)), 'CENSUS_RECIPIENT');
        }
      }
      check(Object.values(rows).reduce((sum, list) => sum + list.length, 0) <= 18, 'ROW_LIMIT');
      encoded(rows); return rows;
    }
    async function state() {
      const rows = await query(() => db!.tenant.findMany({ where: ids(tenantIds), take: 3, include: {
        locations: { take: 3 }, users: { take: 4, include: { authSessions: { take: 4 } } },
        configurationVersions: { take: 3 }, consultations: { take: 3 },
        notifications: { take: 3 }, consultationEvents: { take: 3 },
      } }));
      check(rows.length === 2, 'STATE_LINEAGES'); encoded(rows); return rows;
    }
    async function top<T>(kind: 'reconciles' | 'dashboards' | 'mutations', operation: () => PromiseLike<T>) {
      return proof.work(async () => {
        check(++proof.service <= 19, 'SERVICE_LIMIT'); proof[kind]++;
        const value = await operation(); encoded(value); return value;
      });
    }
    try {
      proof.require();
      check(!originalDb?.value && !originalDb?.get && !originalDb?.set, 'BORROWED_CLIENT');
      vi.doMock('server-only', () => ({}));
      vi.doMock('workflow', () => ({ sleep: () => proof.work(async () => { throw new SafeStop('SLEEP_FORBIDDEN'); }) }));
      vi.doMock('workflow/api', () => ({ start: (...args: unknown[]) => {
        let consumed = false;
        return { then: (yes?: (value: never) => unknown, no?: (error: unknown) => unknown) => {
          if (consumed) {
            proof.stop('START_CONSUMED_TWICE');
            throw new SafeStop(proof.first!);
          }
          consumed = true;
          return proof.work(async () => {
            check(phase === 'RESTORE' && args.length === 2 && args[0] === reminders?.consultationReminderWorkflow &&
              Array.isArray(args[1]) && args[1].length === 1 && args[1][0] === a.visit && ++proof.blocked === 1, 'START_SCOPE');
            throw new SafeStop('EXPECTED_START_BLOCKED');
          }, false, error => error instanceof SafeStop && error.code === 'EXPECTED_START_BLOCKED').then(yes, no);
        } };
      } }));
      Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true,
        value: denyFetch });
      const { PrismaClient, Prisma } = await proof.work(() => import('@prisma/client'));
      const shared = await proof.work(() => import('@dripwell/shared/v2'));
      db = new PrismaClient({ log: [] });
      Object.defineProperty(globalThis, 'dripwellDatabase', { value: db, configurable: true, writable: true });
      reserved = true;
      ({ getDb } = await proof.work(() => import('./db')));
      proof.identity = () => check(reserved && getDb!() === db &&
        (globalThis as { dripwellDatabase?: Db }).dripwellDatabase === db &&
        (globalThis as unknown as { fetch: unknown }).fetch === denyFetch, 'CLIENT_IDENTITY');
      proof.require();
      const clinic = await proof.work(() => import('./clinic'));
      const { ApiError } = await proof.work(() => import('./errors'));
      reminders = await proof.work(() => import('../workflows/reminders'));
      await census(); // First of five complete census boundaries, before fixture effects.
      const configuration = shared.clinicConfigurationSchema.parse({ schemaVersion: 2,
        clinic: { name: 'Task062 fictional', currency: 'USD', contact: '', brandColor: '#0d9488' }, questions: [], products: [],
        recommendationPolicy: { clinicalValidated: false, validatedBy: '', validationNote: '', maxAddOns: 0, maxWellnessOffers: 0 },
        reminders: { careOutcomeHours: 1, wellnessDecisionHours: 1 }, retention: { audioDays: 1, documentDays: 1, shareExpiryHours: 1 } });
      const dueAt = new Date(Date.now() - 60000), expiresAt = new Date(Date.now() + 3600000);
      async function create(model: string, id: string, operation: () => PromiseLike<unknown>) {
        resolved = false;
        const row = await query(operation) as Row;
        check(row.id === id && row.createdAt instanceof Date, 'CREATED_ROW');
        remember(model, row); resolved = true; return row;
      }
      const tenants = new Map<string, Row>(), users = new Map<string, Row>(), sessions = new Map<string, Row>();
      for (const cohort of [a, b]) {
        tenants.set(cohort.tenant, await create('tenant', cohort.tenant, () => db!.tenant.create({ data: {
          id: cohort.tenant, name: 'Task062 fictional', slug: cohort.slug, state: 'TEST', medicalDirector: 'Nonclinical fixture' } })));
        await create('location', cohort.location, () => db!.location.create({ data: { id: cohort.location,
          tenantId: cohort.tenant, name: 'Task062 fictional location' } }));
      }
      for (const member of members) {
        users.set(member.user, await create('user', member.user, () => db!.user.create({ data: { id: member.user,
          tenantId: member.cohort.tenant, email: member.email, passwordHash: 'test-unusable-password-hash',
          firstName: 'Fictional', lastName: 'Staff', role: 'STAFF', canApproveClinical: false, mfaEnabled: false } })));
        sessions.set(member.session, await create('authSession', member.session, () => db!.authSession.create({ data: {
          id: member.session, userId: member.user, tokenHash: member.tokenHash, expiresAt } })));
      }
      for (const [index, cohort] of [a, b].entries()) {
        const provider = members[index === 0 ? 0 : 2].user;
        await create('clinicConfigurationVersion', cohort.config, () => db!.clinicConfigurationVersion.create({ data: {
          id: cohort.config, tenantId: cohort.tenant, locationId: cohort.location, version: 1, status: 'DRAFT',
          payload: configuration, source: 'Fictional reminder fixture only', userId: provider } }));
        await create('consultation', cohort.visit, () => db!.consultation.create({ data: { id: cohort.visit,
          tenantId: cohort.tenant, locationId: cohort.location, providerId: provider, configurationVersionId: cohort.config,
          reference: cohort.reference, idempotencyKey: cohort.key, isTest: false,
          summary: JSON.parse(JSON.stringify(shared.emptyConsultationSummary())), careOutcomeDueAt: dueAt, wellnessPlan: Prisma.DbNull } }));
      }
      const actors = members.map(member => ({ ...users.get(member.user), id: member.user, userId: member.user,
        tenantId: member.cohort.tenant, tenant: tenants.get(member.cohort.tenant), locationId: member.cohort.location,
        sessionId: member.session, mfaVerified: false, mfaVerifiedAt: null } as unknown as Actor));
      check(users.size === 3 && sessions.size === 3, 'ACTOR_CAPTURE');
      const reconcile = (visitId: string) => top('reconciles', () => reminders!.reconcileConsultationReminders(visitId));
      const key = (visitId: string) => `reminder:${visitId}:CARE_OUTCOME_NEEDED:${dueAt.toISOString()}`;
      async function notification(cohort: typeof a) {
        const rows = await query(() => db!.notification.findMany({ where: { tenantId: cohort.tenant,
          consultationId: cohort.visit, type: 'CARE_OUTCOME_NEEDED', idempotencyKey: key(cohort.visit) }, take: 2 }));
        check(rows.length === 1 && uuid(rows[0].id) && rows[0].entityId === cohort.visit &&
          rows[0].dueAt instanceof Date && rows[0].dueAt.getTime() === dueAt.getTime(), 'REMINDER_CAPTURE');
        return rows[0];
      }
      resolved = false; await reconcile(b.visit); remember('notification', await notification(b)); resolved = true;
      resolved = false; await reconcile(a.visit); const original = remember('notification', await notification(a)); resolved = true;
      await census(); // Materialized baseline: fourteen seeds plus two exact captured reminders.
      const baseline = await state(), bOriginal = encoded(baseline.find(row => row.id === b.tenant));
      const aOriginal = baseline.find(row => row.id === a.tenant)!;
      const controls = encoded(omit(aOriginal as unknown as Row, ['consultations', 'notifications', 'consultationEvents']));
      const originalVisit = aOriginal.consultations[0] as unknown as Row;
      const visitFixed = encoded(omit(originalVisit, ['providerId', 'version', 'updatedAt', 'archivedAt', 'archivedById', 'archiveReason']));
      const reminderFixed = encoded(omit(original, ['userId', 'isRead', 'dismissedAt']));
      async function current() {
        const rows = await state(), aa = rows.find(row => row.id === a.tenant)!;
        check(encoded(rows.find(row => row.id === b.tenant)) === bOriginal &&
          encoded(omit(aa as unknown as Row, ['consultations', 'notifications', 'consultationEvents'])) === controls, 'CONTROL_DRIFT');
        check(aa.consultations.length === 1 && aa.notifications.length === 1, 'CURRENT_SHAPE');
        const visitRow = aa.consultations[0], noteRow = aa.notifications[0];
        check(encoded(omit(visitRow as unknown as Row, ['providerId', 'version', 'updatedAt', 'archivedAt', 'archivedById', 'archiveReason'])) === visitFixed &&
          encoded(omit(noteRow as unknown as Row, ['userId', 'isRead', 'dismissedAt'])) === reminderFixed, 'IDENTITY_OR_FACT_DRIFT');
        return { rows, aa, visitRow, noteRow };
      }
      async function visible(actor: Actor, expected: boolean) {
        const dashboard = await top('dashboards', () => clinic.getClinicDashboard(actor, { locationId: actor.locationId, pageSize: 1 }));
        check(dashboard.notifications.some(row => (row as Row).id === original.id) === expected, 'RECIPIENT_VISIBILITY');
        if (actor.tenantId === b.tenant) check(!dashboard.notifications.some(row => (row as Row).tenantId === a.tenant), 'FOREIGN_VISIBILITY');
      }
      async function read(actor: Actor, denied = false) {
        const before = denied ? encoded((await current()).rows) : null;
        await top('mutations', async () => {
          try {
            const result = await clinic.mutateClinicAction(actor, { action: 'notification.read', notificationId: original.id });
            check(!denied && result.ok && (result.result as Row).id === original.id, 'READ_RESULT'); proof.returned++;
            return result;
          } catch (error) {
            check(denied && error instanceof ApiError && error.status === 404 && error.code === 'NOTIFICATION_NOT_FOUND', 'READ_DENIAL');
            proof.denied++;
            return null;
          }
        });
        if (denied) check(encoded((await current()).rows) === before, 'DENIAL_DRIFT');
      }
      phase = 'INITIAL'; await visible(actors[0], true); await visible(actors[1], false); await read(actors[0]);
      check((await current()).noteRow.isRead === true, 'MARKED_READ');
      const beforeCas = (await current()).visitRow;
      const cas = await query(() => db!.consultation.updateMany({ where: { id: a.visit, tenantId: a.tenant,
        providerId: members[0].user, version: beforeCas.version }, data: { providerId: members[1].user, version: { increment: 1 } } }));
      check(cas.count === 1, 'CAS_COUNT'); await reconcile(a.visit);
      let now = await current();
      check(now.visitRow.providerId === members[1].user && now.visitRow.version === beforeCas.version + 1 &&
        now.visitRow.updatedAt >= beforeCas.updatedAt && now.noteRow.userId === members[1].user &&
        now.noteRow.isRead && now.noteRow.dismissedAt === null, 'REASSIGNMENT');
      await visible(actors[0], false); await visible(actors[1], true); await visible(actors[2], false);
      await read(actors[0], true); await read(actors[2], true); await census(); // Exact current denial boundary.
      await read(actors[1]);
      const reason = 'Task062 fictional archive';
      async function event(action: string, expectedBefore: unknown, expectedAfter: unknown, note: string | null) {
        const rows = await query(() => db!.consultationEvent.findMany({ where: { tenantId: a.tenant,
          consultationId: a.visit, userId: members[1].user, action }, take: 2 }));
        check(rows.length === 1 && uuid(rows[0].id) && rows[0].createdAt instanceof Date &&
          encoded(rows[0].before) === encoded(expectedBefore) && encoded(rows[0].after) === encoded(expectedAfter) &&
          rows[0].reason === note && rows[0].artifactRevision === null && rows[0].idempotencyKey === null, 'EVENT_CAPTURE');
        const captured = remember('consultationEvent', rows[0]); resolved = true; return captured;
      }
      const beforeArchive = (await current()).visitRow;
      phase = 'ARCHIVE'; resolved = false;
      const archived = await top('mutations', () => clinic.mutateClinicAction(actors[1], {
        action: 'consultation.archive', consultationId: a.visit, expectedVersion: beforeArchive.version, reasonNote: reason }));
      check(archived.ok && 'reminderPending' in archived && !archived.reminderPending, 'ARCHIVE_RESULT'); proof.returned++;
      now = await current();
      check(now.visitRow.archivedAt instanceof Date && now.visitRow.archivedById === members[1].user &&
        now.visitRow.archiveReason === reason && now.visitRow.version === beforeArchive.version + 1 &&
        now.noteRow.dismissedAt instanceof Date && now.noteRow.isRead, 'ARCHIVED_STATE');
      const archivedAt = now.visitRow.archivedAt.toISOString();
      const archiveEvent = await event('consultation.archive', { archivedAt: null, stage: beforeArchive.stage },
        { archivedAt, stage: beforeArchive.stage }, reason);
      await visible(actors[1], false); check((await reconcile(a.visit)).nextDueAt === null, 'ARCHIVE_ELIGIBILITY');
      check((await current()).noteRow.dismissedAt instanceof Date, 'ARCHIVE_SUPPRESSION');
      const beforeRestore = (await current()).visitRow;
      phase = 'RESTORE'; resolved = false;
      const restoredResult = await top('mutations', () => clinic.mutateClinicAction(actors[1], {
        action: 'consultation.restore', consultationId: a.visit, expectedVersion: beforeRestore.version }));
      check(restoredResult.ok && 'reminderPending' in restoredResult && restoredResult.reminderPending && proof.blocked === 1, 'RESTORE_PENDING');
      proof.returned++; now = await current();
      check(now.visitRow.archivedAt === null && now.visitRow.archivedById === null && now.visitRow.archiveReason === null &&
        now.visitRow.version === beforeRestore.version + 1 && now.noteRow.dismissedAt === null &&
        now.noteRow.userId === members[1].user && now.noteRow.isRead, 'RESTORED_STATE');
      const restoreEvent = await event('consultation.restore', { archivedAt, stage: beforeRestore.stage },
        { archivedAt: null, stage: beforeRestore.stage }, null);
      check(restoreEvent.createdAt instanceof Date && archiveEvent.createdAt instanceof Date &&
        restoreEvent.createdAt >= archiveEvent.createdAt, 'EVENT_ORDER');
      await reconcile(a.visit); now = await current(); check(now.aa.consultationEvents.length === 2, 'EVENT_COUNT');
      await visible(actors[0], false); await visible(actors[1], true);
      check(proof.service === 19 && proof.reconciles === 5 && proof.dashboards === 8 && proof.mutations === 6 &&
        proof.returned === 4 && proof.denied === 2 && proof.blocked === 1, 'TOP_LEVEL_COUNTS');
    } catch (error) { proof.stop(error instanceof SafeStop ? error.code : 'SCENARIO_FAILED'); }
    try {
      phase = 'CLEANUP'; await proof.join();
      check(reserved && db && resolved && !proof.unknown && proof.pending.size === 0, 'CLEANUP_NOT_QUIESCENT');
      const fresh = await census(true); // Fresh ownership admission, fourth full boundary.
      for (const model of ['notification', 'consultationEvent', 'consultation', 'authSession',
        'clinicConfigurationVersion', 'user', 'location', 'tenant']) {
        const captured = [...(owned.get(model) ?? [])];
        if (!captured.length) continue;
        const exact = fresh[model].map(row => Object.fromEntries(deleteKeys[model].map(key => [key, row[key]])));
        check(exact.length === captured.length && exact.every(row => uuid(row.id)), 'DELETE_SCOPE');
        const where = { OR: exact };
        const deleted = await query(() => delegates()[model].deleteMany({ where }), true);
        check(deleted.count === captured.length, 'DELETE_COUNT'); proof.deleted += deleted.count; owned.delete(model);
      }
      await census(true); // Fifth full boundary: IDs/keys/FKs empty, no broad cascade deletion.
      await proof.work(() => db!.$disconnect(), true); await proof.join(); closed = true;
      proof.require(true); proof.identity = undefined;
      if (originalDb) Object.defineProperty(globalThis, 'dripwellDatabase', originalDb);
      else delete (globalThis as { dripwellDatabase?: Db }).dripwellDatabase;
      if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
      else delete (globalThis as { fetch?: typeof fetch }).fetch;
      reserved = false;
      check(descriptorHeld('dripwellDatabase', originalDb) && descriptorHeld('fetch', originalFetch), 'RESTORE_DESCRIPTORS');
      proof.require(true); restored = true;
    } catch (error) { proof.stop(error instanceof SafeStop ? error.code : 'CLOSURE_FAILED'); proof.unknown = true; }
    proof.require(true);
    const uncertain = proof.unknown || proof.pending.size > 0;
    const record = { task: 'TASK062', outcome: proof.first ? 'FAILED' : 'CLOSURE_CANDIDATE', first: proof.first ?? null,
      phase, service: proof.service, reconciles: proof.reconciles, dashboards: proof.dashboards, mutations: proof.mutations,
      returned: uncertain ? null : proof.returned, denied: uncertain ? null : proof.denied, additionalOrm: proof.orm, cleanupOrm: proof.cleanupOrm,
      blockedStart: proof.blocked, deleted: uncertain ? null : proof.deleted, pending: proof.pending.size, unknown: proof.unknown,
      resolved, closed, restored, elapsedMs: Math.ceil(performance.now() - proof.began) };
    const text = JSON.stringify(record);
    check(Buffer.byteLength(text) <= 2048, 'SAFE_RECORD_BYTES');
    await proof.work(() => new Promise<void>((resolve, reject) => process.stdout.write(`${text}\n`, error =>
      error ? reject(new SafeStop('FINAL_WRITE_FAILED')) : resolve())), true);
    check(proof.pending.size === 0, 'FINAL_WRITE_NOT_JOINED');
    proof.require(true);
    if (proof.first) throw new SafeStop(proof.first);
  }, 30000);
});
