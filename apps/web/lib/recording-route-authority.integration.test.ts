import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { describe, test, vi } from 'vitest';

type Db = ReturnType<typeof import('./db')['getDb']>;
type Row = Record<string, unknown>;
class SafeStop extends Error {
  constructor(readonly code: string) { super(`TASK063:${code}`); this.stack = this.message; }
}
function check(value: unknown, code: string): asserts value {
  if (!value) throw new SafeStop(code);
}
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
    const rows = value.map(normalized);
    return rows.every(row => row && typeof row === 'object' && 'id' in row)
      ? rows.sort((a, b) => String((a as Row).id).localeCompare(String((b as Row).id))) : rows;
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalized(item)]));
  return value;
}
function encoded(value: unknown) {
  const text = JSON.stringify(normalized(value));
  check(Buffer.byteLength(text) <= 32768, 'RAM_BYTES'); return text;
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
  orm = 0;
  cleanupOrm = 0;
  starts = 0;
  returned = 0;
  gets = 0;
  retries = 0;
  denied = 0;
  forbidden = 0;
  deleted = 0;
  boundaries = 0;
  readers = 0;
  readerUnknown = false;
  stop(code: string) { this.first ??= code; }
  require(cleanup = false) {
    try { guard(); this.identity?.(); }
    catch { this.unknown = true; this.stop('CONTEXT_OR_IDENTITY'); throw new SafeStop(this.first!); }
    if (performance.now() - this.began >= (cleanup ? 30000 : 20000)) {
      this.unknown = true; this.stop('ORIGINAL_CLOCK_EXPIRED'); throw new SafeStop(this.first!);
    }
    if (this.first && !cleanup) throw new SafeStop(this.first);
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
    const pending = Promise.resolve().then(() => {
      this.require(cleanup); return operation(); // Actual receiver; each lazy result is assimilated once.
    }).then(value => ({ ok: true as const, value }), error => {
      this.stop(error instanceof SafeStop ? error.code : 'WORK_FAILED');
      if (!(error instanceof SafeStop)) this.unknown = true;
      return { ok: false as const, code: this.first! };
    });
    this.pending.add(pending);
    void pending.then(() => this.pending.delete(pending));
    const result = await this.wait(pending, cleanup);
    if (!result.ok) throw new SafeStop(result.code);
    return result.value;
  }
  async join() {
    this.require(true); await this.wait(Promise.allSettled([...this.pending]), true);
    check(this.pending.size === 0, 'WORK_NOT_JOINED');
  }
}
const suite = process.env.CI === 'true' || process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('Current recording route authority', () => {
  test('keeps recording metadata tenant scoped and rejects expired or unauthorized retries before dispatch', async () => {
    const proof = new Proof(); // The original clock precedes admission and every target import.
    const originalDb = Object.getOwnPropertyDescriptor(globalThis, 'dripwellDatabase');
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const context = new AsyncLocalStorage<Request>();
    const nonce = randomUUID();
    const [a, b] = ['A', 'B'].map(label => ({ tenant: randomUUID(), location: randomUUID(), config: randomUUID(),
      visit: randomUUID(), slug: `task063-${nonce}-${label.toLowerCase()}`, key: `task063:${nonce}:${label}` }));
    const members = [a, a, a, b].map((cohort, index) => ({ cohort, user: randomUUID(), session: randomUUID(),
      role: index === 2 ? 'STAFF' as const : 'SUPER_USER' as const,
      email: `${index}-${nonce}@task063.invalid`, token: randomBytes(32).toString('base64url'), tokenHash: '' }));
    const rateKeys = members.flatMap(member => ['audio', 'setup-upload'].map(prefix =>
      createHash('sha256').update(`${prefix}:${member.cohort.tenant}:${member.user}`).digest('hex')));
    const setupId = randomUUID(), recordingIds = [randomUUID(), randomUUID(), randomUUID()];
    const tenantIds = [a.tenant, b.tenant], locationIds = [a.location, b.location], configIds = [a.config, b.config];
    const visitIds = [a.visit, b.visit], userIds = members.map(row => row.user), sessionIds = members.map(row => row.session);
    const allIds: string[] = [...tenantIds, ...locationIds, ...configIds, ...visitIds, ...userIds, ...sessionIds, setupId, ...recordingIds];
    const captured = new Map<string, Map<string, Row>>();
    const deleteKeys: Record<string, string[]> = {
      tenant: ['id', 'slug'], location: ['id', 'tenantId'], user: ['id', 'tenantId', 'email'],
      authSession: ['id', 'userId', 'tokenHash'], clinicConfigurationVersion: ['id', 'tenantId', 'locationId', 'userId'],
      consultation: ['id', 'tenantId', 'locationId', 'providerId', 'configurationVersionId'],
      setupConversation: ['id', 'tenantId', 'locationId', 'userId'],
      recordingSegment: ['id', 'tenantId', 'consultationId', 'setupConversationId', 'userId', 'segmentKey'],
    };
    let db: Db | undefined, getDb: (() => Db) | undefined, phase = 'ADMISSION';
    let reserved = false, resolved = true, closed = false, restored = false;
    let aiSpy: { mockRestore(): void } | undefined, aiRestored: (() => boolean) | undefined;
    let moduleRestored = false;
    const forbidden = (code: string): never => {
      proof.forbidden++; proof.stop(code); throw new SafeStop(proof.first!);
    };
    const denyFetch = () => forbidden('FETCH_FORBIDDEN');
    async function query<T>(operation: () => PromiseLike<T>, cleanup = false) {
      return proof.work(() => {
        check(++proof.orm <= 400, 'ORM_LIMIT');
        if (cleanup) check(++proof.cleanupOrm <= 100, 'CLEANUP_ORM_LIMIT');
        else check(proof.orm - proof.cleanupOrm <= 300, 'SCENARIO_ORM_LIMIT');
        return operation();
      }, cleanup);
    }
    const t = { tenantId: { in: tenantIds } }, u = { userId: { in: userIds } };
    const v = { consultationId: { in: visitIds } }, l = { locationId: { in: locationIds } };
    const or = (...rows: Row[]) => ({ OR: rows }), ids = (values: string[]) => ({ id: { in: values } });
    const matrix: Record<string, Row> = {
      tenant: or(ids(tenantIds), { slug: { in: [a.slug, b.slug] } }), location: or(t, ids(locationIds)),
      user: or(t, ids(userIds), { email: { in: members.map(row => row.email) } }),
      authSession: or(u, ids(sessionIds), { tokenHash: { in: members.map(row => row.tokenHash) } }),
      clinicConfigurationVersion: or(t, l, u, ids(configIds)),
      consultation: or(t, l, ids(visitIds), { providerId: { in: userIds } },
        { configurationVersionId: { in: configIds } }, { idempotencyKey: { in: [a.key, b.key] } }),
      notification: or(t, u, v, { entityId: { in: visitIds } }), consultationEvent: or(t, u, v),
      assessmentSession: or(t, l, { providerId: { in: userIds } }), patientIntake: t, photoCapture: t,
      visualSignal: t, questionAnswer: t, patternMatch: t, recommendation: or(t, { providerId: { in: userIds } }),
      safetyFlag: or(t, { providerAcknowledgedById: { in: userIds } }), providerOverride: or(t, { providerId: { in: userIds } }),
      catalogItem: t, catalogItemCompatibility: t, assessmentHistory: t, assessmentChangeLog: or(t, { providerId: { in: userIds } }),
      auditLog: or(t, u, { entityId: { in: allIds } }), feedback: or(t, { submitterId: { in: userIds } }, { assignedTo: { in: userIds } }),
      consultationRevision: or(t, u, v), consultationAdjustment: or(t, u, v), subscription: t, trialUsage: or(t, v),
      referral: or({ referrerTenantId: { in: tenantIds } }, { referredTenantId: { in: tenantIds } }), creditLedger: t,
      takeaway: or(t, v, { createdById: { in: userIds } }), shareLink: or(t, { createdById: { in: userIds } }),
      userInvite: or(t, { invitedById: { in: userIds } }), setupConversation: or(t, u, l, ids([setupId])),
      generationJob: or(t, u, v, { idempotencyKey: { in: recordingIds.flatMap(id => [`recording:${id}`, `setup-upload:${id}`]) } }),
      recordingSegment: or(t, u, v, ids(recordingIds), { setupConversationId: setupId },
        { segmentKey: { in: recordingIds.map((_, index) => `task063:${nonce}:${index}`) } }),
      improvementProposal: or(t, u, { configurationVersionId: { in: configIds } }), agentContextSnapshot: or(t, u),
      setupRecordingUpload: or(t, u, l, ids(recordingIds), { setupConversationId: setupId }),
      recordingDeletionIntent: or(t, v, { recordingId: { in: recordingIds } }, { setupConversationId: setupId },
        { sourceId: { in: [...recordingIds, setupId] } }), authChallenge: u,
      recommendationItem: or({ recommendation: t }, { catalogItem: t }), catalogItemIngredient: { catalogItem: t },
      shareVerification: { shareLink: t }, shareSession: { shareLink: t },
      rateLimitBucket: { key: { in: rateKeys } },
    };
    const delegates = () => db as unknown as Record<string, {
      findMany(input: { where: Row; take: number }): PromiseLike<Row[]>;
      deleteMany(input: { where: Row }): PromiseLike<{ count: number }>;
    }>;
    function sameRows(model: string, rows: Row[]) {
      const expected = captured.get(model) ?? new Map<string, Row>();
      check(rows.length === expected.size && rows.every(row => expected.has(String(row.id))), 'ROW_MEMBERSHIP');
      for (const row of rows) check(encoded(row) === encoded(expected.get(String(row.id))), 'SCALAR_DRIFT');
    }
    async function census(cleanup = false) {
      const rows: Record<string, Row[]> = {};
      for (const [model, where] of Object.entries(matrix)) {
        rows[model] = await query(() => delegates()[model].findMany({ where, take: (captured.get(model)?.size ?? 0) + 1 }), cleanup);
        sameRows(model, rows[model]);
      }
      check(Object.keys(rows).length === 45 && Object.values(rows).reduce((sum, list) => sum + list.length, 0) <= 20, 'CENSUS_BOUND');
      encoded(rows); proof.boundaries++; return rows;
    }
    async function state() {
      const rows: Record<string, Row[]> = {};
      for (const model of Object.keys(deleteKeys)) {
        rows[model] = await query(() => delegates()[model].findMany({ where: matrix[model], take: (captured.get(model)?.size ?? 0) + 1 }));
        sameRows(model, rows[model]);
      }
      encoded(rows);
    }
    async function create(model: string, data: Row, operation: () => PromiseLike<unknown>) {
      check(typeof data.id === 'string' && allIds.includes(data.id), 'PRETRACKED_ID');
      resolved = false;
      const row = await query(operation) as Row;
      check(row.id === data.id && row.createdAt instanceof Date && Object.entries(data)
        .every(([key, value]) => encoded(row[key]) === encoded(value)), 'CREATE_LINEAGE');
      const rows = captured.get(model) ?? new Map<string, Row>();
      check(!rows.has(String(row.id)), 'DUPLICATE_CAPTURE'); rows.set(String(row.id), row); captured.set(model, rows);
      encoded(Object.fromEntries([...captured].map(([key, value]) => [key, [...value.values()]])));
      resolved = true; return row;
    }
    async function body(response: Response) {
      check(response.body, 'RESPONSE_BODY'); const reader = response.body.getReader();
      proof.readers++;
      const chunks: Uint8Array[] = []; let size = 0, reads = 0, complete = false;
      try {
        for (;;) {
          const item = await proof.work(() => reader.read()); check(++reads <= 16, 'RESPONSE_CHUNKS');
          if (item.done) { complete = true; break; }
          size += item.value.byteLength; check(size <= 4096 && size < 4097, 'RESPONSE_BYTES'); chunks.push(item.value);
        }
        try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Row; }
        catch { throw new SafeStop('RESPONSE_JSON'); }
      } catch (error) {
        proof.stop(error instanceof SafeStop ? error.code : 'RESPONSE_READ_FAILED');
        throw new SafeStop(proof.first!);
      } finally {
        let cancelled = complete, released = false;
        if (!complete) {
          try { await proof.work(() => reader.cancel(), true); cancelled = true; }
          catch { proof.stop('READER_CANCEL_FAILED'); proof.readerUnknown = true; proof.unknown = true; }
        }
        try { await proof.work(async () => { reader.releaseLock(); }, true); released = true; }
        catch { proof.stop('READER_RELEASE_FAILED'); proof.readerUnknown = true; proof.unknown = true; }
        if (cancelled && released) proof.readers--;
        else {
          proof.readerUnknown = true; proof.unknown = true; proof.stop('READER_CLOSURE_UNKNOWN');
          throw new SafeStop(proof.first!);
        }
      }
    }
    try {
      proof.require(); check(allIds.length === 20 && new Set(allIds).size === 20, 'FIXTURE_ID_COUNT');
      check(!originalDb?.value && !originalDb?.get && !originalDb?.set, 'BORROWED_CLIENT');
      vi.doMock('server-only', () => ({}));
      const cookies = async () => {
        proof.require(); const request = context.getStore();
        if (!request) return forbidden('COOKIE_CONTEXT');
        return { get: (name: string) => {
          const value = request.headers.get('cookie')?.split(';').map(part => part.trim())
            .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
          return value === undefined ? undefined : { name, value };
        } };
      };
      vi.doMock('next/headers', () => ({ cookies }));
      vi.doMock('workflow/api', () => ({ start: () => forbidden('WORKFLOW_FORBIDDEN') }));
      Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: denyFetch });
      const { PrismaClient } = await proof.work(() => import('@prisma/client'));
      const shared = await proof.work(() => import('@dripwell/shared/v2'));
      db = new PrismaClient({ log: [] });
      Object.defineProperty(globalThis, 'dripwellDatabase', { value: db, configurable: true, writable: true }); reserved = true;
      const databaseModule = await proof.work(() => import('./db'));
      getDb = databaseModule.getDb;
      const cookieModule = await proof.work(() => import('next/headers'));
      const installedDb = Object.getOwnPropertyDescriptor(globalThis, 'dripwellDatabase');
      const installedFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
      proof.identity = () => check(reserved && getDb!() === db &&
        databaseModule.getDb === getDb && (cookieModule.cookies as unknown) === cookies &&
        descriptorHeld('dripwellDatabase', installedDb) && descriptorHeld('fetch', installedFetch) &&
        (globalThis as { dripwellDatabase?: Db }).dripwellDatabase === db &&
        (globalThis as unknown as { fetch: unknown }).fetch === denyFetch, 'OWNED_CLIENT_IDENTITY');
      proof.require();
      const auth = await proof.work(() => import('./auth'));
      members.forEach(member => { member.tokenHash = auth.hashToken(member.token); });
      matrix.authSession = or(u, ids(sessionIds), { tokenHash: { in: members.map(member => member.tokenHash) } });
      const ai = await proof.work(() => import('./ai'));
      const originalAIReady = ai.assertAIReady;
      aiRestored = () => ai.assertAIReady === originalAIReady;
      aiSpy = vi.spyOn(ai, 'assertAIReady').mockImplementation(() => forbidden('AI_READINESS_FORBIDDEN'));
      const { GET } = await proof.work(() => import('../app/api/recordings/route'));
      const { POST } = await proof.work(() => import('../app/api/recordings/[id]/retry/route'));
      await census(); // Boundary 1: collision-free before any fixture creation.
      const configuration = shared.clinicConfigurationSchema.parse({ schemaVersion: 2,
        clinic: { name: 'Task063 fictional', currency: 'USD', contact: '', brandColor: '#0d9488' }, questions: [], products: [],
        recommendationPolicy: { clinicalValidated: false, validatedBy: '', validationNote: '', maxAddOns: 0, maxWellnessOffers: 0 },
        reminders: { careOutcomeHours: 1, wellnessDecisionHours: 1 }, retention: { audioDays: 1, documentDays: 1, shareExpiryHours: 1 } });
      const capturedNow = Date.now(), createdAt = new Date(capturedNow - 180000), consentAt = new Date(capturedNow - 180001);
      const past = new Date(capturedNow - 60000), future = new Date(capturedNow + 3600000);
      check(consentAt < createdAt && createdAt < past && past.getTime() < capturedNow && future.getTime() > capturedNow + 30000, 'VALID_CHRONOLOGY');
      for (const cohort of [a, b]) {
        const tenant = { id: cohort.tenant, name: 'Task063 fictional', slug: cohort.slug, state: 'TEST', medicalDirector: 'Nonclinical fixture', isActive: true };
        await create('tenant', tenant, () => db!.tenant.create({ data: tenant }));
        const location = { id: cohort.location, tenantId: cohort.tenant, name: 'Task063 fictional location', isActive: true };
        await create('location', location, () => db!.location.create({ data: location }));
      }
      for (const member of members) {
        const user = { id: member.user, tenantId: member.cohort.tenant, email: member.email, role: member.role,
          passwordHash: 'test-unusable-password-hash', firstName: 'Fictional', lastName: 'Staff', isActive: true, canApproveClinical: false, mfaEnabled: false };
        await create('user', user, () => db!.user.create({ data: user }));
        const session = { id: member.session, userId: member.user, tokenHash: member.tokenHash, expiresAt: future };
        await create('authSession', session, () => db!.authSession.create({ data: session }));
      }
      for (const [index, cohort] of [a, b].entries()) {
        const owner = members[index === 0 ? 0 : 3];
        const config = { id: cohort.config, tenantId: cohort.tenant, locationId: cohort.location, version: 1,
          status: 'DRAFT' as const, payload: configuration, source: 'Fictional recording metadata only', userId: owner.user };
        await create('clinicConfigurationVersion', config, () => db!.clinicConfigurationVersion.create({ data: config }));
        const visit = { id: cohort.visit, tenantId: cohort.tenant, locationId: cohort.location, providerId: owner.user,
          configurationVersionId: cohort.config, reference: cohort.key, idempotencyKey: cohort.key, isTest: true,
          summary: JSON.parse(JSON.stringify(shared.emptyConsultationSummary())) as import('@prisma/client').Prisma.InputJsonValue };
        await create('consultation', visit, () => db!.consultation.create({ data: visit }));
      }
      const setup = { id: setupId, tenantId: a.tenant, locationId: a.location, userId: members[0].user, messages: [] };
      await create('setupConversation', setup, () => db!.setupConversation.create({ data: setup }));
      for (const [index, id] of recordingIds.entries()) {
        const cohort = index === 2 ? b : a, owner = members[index === 2 ? 3 : 0];
        const recording = { id, tenantId: cohort.tenant, userId: owner.user,
          consultationId: index === 1 ? null : cohort.visit, setupConversationId: index === 1 ? setupId : null,
          segmentKey: `task063:${nonce}:${index}`, sequence: index, blobPath: `synthetic/task063/${nonce}/${index}`,
          mimeType: 'audio/webm', bytes: 1, durationSeconds: 1, consentAt, createdAt,
          status: index === 1 ? 'UPLOADED' : 'TRANSCRIBED', expiresAt: index === 2 ? future : past,
          transcript: index === 1 ? null : `Fictional original ${index}`, staffTranscript: index === 1 ? null : `Fictional correction ${index}` };
        check(Number(Boolean(recording.consultationId)) + Number(Boolean(recording.setupConversationId)) === 1, 'ONE_TARGET');
        const saved = await create('recordingSegment', recording, () => db!.recordingSegment.create({ data: recording }));
        check(saved.blobObject === null, 'NO_PROVIDER_OBJECT'); // Nullable JSON is omitted, never an invalid JS-null input.
      }
      await census(); // Boundary 2: all twenty complete native rows.
      check([...captured.values()].reduce((sum, rows) => sum + rows.size, 0) === 20, 'SEEDED_COUNT');
      function projection(id: string) {
        const row = captured.get('recordingSegment')!.get(id)!;
        return { id: row.id, sequence: row.sequence, status: String(row.status).toLowerCase(),
          transcript: row.staffTranscript ?? row.transcript, originalTranscript: row.transcript,
          durationSeconds: row.durationSeconds, createdAt: (row.createdAt as Date).toISOString(),
          expiresAt: (row.expiresAt as Date).toISOString(), speakerAttribution: 'Needs staff confirmation' };
      }
      async function call(method: 'GET' | 'POST', member: typeof members[number] | undefined,
        target: string, status: number, code?: string, recording?: string) {
        proof.require(); check(++proof.starts <= 12, 'HANDLER_LIMIT');
        if (method === 'GET') proof.gets++; else proof.retries++;
        const headers = new Headers({ origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' });
        if (member) headers.set('cookie', `${auth.SESSION_COOKIE}=${member.token}`);
        const request = new Request(method === 'GET' ? `http://localhost:3000/api/recordings?consultationId=${target}`
          : `http://localhost:3000/api/recordings/${target}/retry`, { method, headers });
        const response = await proof.work(() => context.run(request, () => method === 'GET'
          ? GET(request, undefined) : POST(request, { params: Promise.resolve({ id: target }) })));
        proof.returned++; check(response.status === status, 'HTTP_STATUS');
        for (const [key, value] of Object.entries({ 'Cache-Control': 'private, no-store, max-age=0',
          Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff' })) check(response.headers.get(key) === value, 'PRIVATE_HEADERS');
        const value = await body(response);
        if (status === 200) {
          check(recording && encoded(value) === encoded({ recordings: [projection(recording)] }), 'EXACT_PUBLIC_PROJECTION');
        } else {
          check(Object.keys(value).sort().join(',') === 'code,error' && value.code === code && typeof value.error === 'string', 'EXACT_DENIAL');
          proof.denied++;
        }
        check(proof.forbidden === 0 && !proof.first && context.getStore() === undefined, 'NO_MASKED_OR_LEAKED_WORK');
        await state(); // All scalar fields in both clinics, including hashes and dates, remain RAM-only.
      }
      phase = 'HANDLERS';
      await call('GET', members[0], a.visit, 200, undefined, recordingIds[0]);
      await call('GET', members[2], a.visit, 200, undefined, recordingIds[0]);
      await call('GET', members[3], b.visit, 200, undefined, recordingIds[2]);
      await call('GET', members[0], b.visit, 404, 'NOT_FOUND');
      await call('GET', members[3], a.visit, 404, 'NOT_FOUND');
      await call('POST', members[0], recordingIds[0], 410, 'RECORDING_UNAVAILABLE');
      await call('POST', members[0], recordingIds[1], 410, 'RECORDING_UNAVAILABLE');
      await call('POST', members[1], recordingIds[1], 403, 'OWNER_REQUIRED');
      await call('POST', members[0], recordingIds[2], 404, 'NOT_FOUND');
      await call('GET', undefined, a.visit, 401, 'UNAUTHENTICATED');
      async function control(model: string, id: string, changing: string[], operation: () => PromiseLike<unknown>) {
        const before = captured.get(model)!.get(id)!; resolved = false;
        const row = await query(operation) as Row;
        check(row.id === id && encoded(omit(row, changing)) === encoded(omit(before, changing)), 'CONTROL_FIXED_SCALARS');
        if (model === 'user') check(row.role === 'STAFF' && row.updatedAt instanceof Date && row.updatedAt >= (before.updatedAt as Date), 'CURRENT_ROLE');
        else check(row.revokedAt instanceof Date, 'CURRENT_REVOCATION');
        captured.get(model)!.set(id, row); resolved = true; await state();
      }
      await control('user', members[0].user, ['role', 'updatedAt'], () => db!.user.update({
        where: { id: members[0].user }, data: { role: 'STAFF' } }));
      await call('POST', members[0], recordingIds[1], 403, 'OWNER_REQUIRED');
      await control('authSession', members[0].session, ['revokedAt'], () => db!.authSession.update({
        where: { id: members[0].session }, data: { revokedAt: new Date() } }));
      await call('GET', members[0], a.visit, 401, 'UNAUTHENTICATED');
      await census(); // Boundary 3: full post-handler current-baseline preservation.
      check(proof.starts === 12 && proof.returned === 12 && proof.gets === 7 && proof.retries === 5 &&
        proof.denied === 9 && proof.forbidden === 0, 'EXACT_HANDLER_COUNTS');
    } catch (error) { proof.stop(error instanceof SafeStop ? error.code : 'SCENARIO_FAILED'); }
    try {
      phase = 'CLEANUP'; await proof.join();
      check(reserved && db && resolved && !proof.unknown && !proof.readerUnknown && proof.readers === 0 &&
        proof.pending.size === 0 && context.getStore() === undefined, 'CLEANUP_NOT_QUIESCENT');
      const fresh = await census(true); // Boundary 4: fresh exact captured ownership before compensation.
      for (const model of ['recordingSegment', 'setupConversation', 'consultation', 'authSession',
        'clinicConfigurationVersion', 'user', 'location', 'tenant']) {
        const rows = captured.get(model); if (!rows?.size) continue;
        const exact = fresh[model].map(row => Object.fromEntries(deleteKeys[model].map(key => [key, row[key]])));
        check(exact.length === rows.size, 'EXACT_DELETE_SCOPE'); resolved = false;
        const deleted = await query(() => delegates()[model].deleteMany({ where: { OR: exact } }), true);
        check(deleted.count === rows.size, 'EXACT_DELETE_COUNT'); proof.deleted += deleted.count; captured.delete(model); resolved = true;
      }
      await census(true); // Boundary 5: all owned ID/key/FK scopes empty, no broad cascade.
      await proof.work(() => db!.$disconnect(), true); await proof.join(); closed = true;
      proof.require(true); proof.identity = undefined;
      aiSpy?.mockRestore(); vi.doUnmock('server-only'); vi.doUnmock('next/headers'); vi.doUnmock('workflow/api');
      check(aiRestored?.(), 'AI_FUNCTION_NOT_RESTORED');
      vi.resetModules(); moduleRestored = true; // Only after actual pending0, empty census and owned disconnect.
      context.disable(); check(context.getStore() === undefined, 'ALS_NOT_CLOSED');
      if (originalDb) Object.defineProperty(globalThis, 'dripwellDatabase', originalDb);
      else delete (globalThis as { dripwellDatabase?: Db }).dripwellDatabase;
      if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
      else delete (globalThis as { fetch?: typeof fetch }).fetch;
      reserved = false;
      check(descriptorHeld('dripwellDatabase', originalDb) && descriptorHeld('fetch', originalFetch), 'RESTORED_DESCRIPTORS');
      proof.require(true); restored = true;
    } catch (error) { proof.stop(error instanceof SafeStop ? error.code : 'CLOSURE_FAILED'); proof.unknown = true; }
    proof.require(true);
    if (!proof.first) check(proof.boundaries === 5 && proof.deleted === 20 && proof.pending.size === 0 &&
      closed && restored && moduleRestored && resolved && !proof.unknown && !proof.readerUnknown &&
      proof.readers === 0 && aiRestored?.(), 'COMPLETE_OWNED_CLOSURE');
    const uncertain = proof.unknown || proof.pending.size > 0 || !resolved;
    const record = { task: 'TASK063', outcome: proof.first ? 'FAILED' : 'CLOSURE_CANDIDATE', first: proof.first ?? null,
      phase, starts: proof.starts, returned: uncertain ? null : proof.returned, GET: proof.gets, retry: proof.retries,
      denied: uncertain ? null : proof.denied, additionalOrm: proof.orm, scenarioOrm: proof.orm - proof.cleanupOrm,
      cleanupOrm: proof.cleanupOrm, forbidden: proof.forbidden, deleted: uncertain ? null : proof.deleted,
      readers: proof.readers, readerClosureUnknown: proof.readerUnknown,
      censusBoundaries: proof.boundaries, pending: proof.pending.size, unknown: proof.unknown, resolved, closed, restored, moduleRestored,
      originalClockMs: 30000, elapsedMs: Math.ceil(performance.now() - proof.began) };
    const text = JSON.stringify(record); check(Buffer.byteLength(text) <= 2048, 'SAFE_RECORD_BYTES');
    await proof.work(() => new Promise<void>((resolve, reject) => process.stdout.write(`${text}\n`, error =>
      error ? reject(new SafeStop('FINAL_WRITE_FAILED')) : resolve())), true);
    check(proof.pending.size === 0 && context.getStore() === undefined, 'FINAL_NOT_JOINED');
    proof.require(true); check(descriptorHeld('dripwellDatabase', originalDb) && descriptorHeld('fetch', originalFetch), 'FINAL_CONTEXT');
    if (proof.first) throw new SafeStop(proof.first);
  }, 30000);
});
