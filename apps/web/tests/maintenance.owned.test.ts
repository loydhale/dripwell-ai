import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
const native = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock('workflow/api', () => ({ start: native.start }));
import { getDb } from '../lib/db';
import { maintenanceContext } from '../lib/maintenance-context';
import { reserveMaintenance, claimMaintenance, completeMaintenance, reserveNextMaintenance,
  maintenanceStatus, withMaintenanceClaim, type MaintenanceClaim } from '../lib/maintenance-coordinator';
import { processMaintenanceFamily, selectMaintenancePage, applyMaintenanceItem,
  requireMaintenancePagesComplete, MAINTENANCE_FAMILIES } from '../lib/maintenance-pages';
import { dispatchMaintenance } from '../workflows/maintenance';
import { GET, POST } from '../app/api/jobs/reconcile/route';

// These global maintenance fixtures are deliberately ineligible for shared or
// hosted databases. The independently reviewed wrapper also checks the Docker
// container, OID/nonce, all table digests and source before dispatch.
const target = new URL(process.env.DATABASE_URL || 'https://unavailable.invalid');
if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL || target.hostname !== '127.0.0.1' ||
  target.port !== '55432' || target.pathname !== '/dripwell_task047_verification' ||
  !['postgres:', 'postgresql:'].includes(target.protocol) || process.env.ALLOW_REAL_CLIENT_DATA !== 'false' ||
  process.env.MAINTENANCE_OWNED_TASK !== 'TASK-047' || !process.env.MAINTENANCE_OWNED_NONCE ||
  !/^[0-9]+$/.test(process.env.MAINTENANCE_OWNED_OID || ''))
  throw new Error('Maintenance cases require the new nonce-owned TASK047 loopback database.');

const db = getDb();
const uuid = (number: number) => number.toString(16).padStart(8, '0') + '-0000-4000-8000-000000000047';
const ago = (days: number) => new Date(Date.now() - days * 86_400_000);
let tenantId: string, userId: string, locationId: string, configurationVersionId: string, token: string;
const coordinatorKeys = new Set<string>();
const rateKeys = new Set<string>();
function context() { const c = maintenanceContext(); coordinatorKeys.add(c.key); return c; }
async function owner(command: 'run-once' | 'start' = 'run-once'): Promise<MaintenanceClaim> {
  const reservation = (await reserveMaintenance(context(), command)).reservation!;
  return (await claimMaintenance(reservation, 'owned-run-' + randomUUID()))!;
}
async function finish(claim: MaintenanceClaim) {
  for (const family of MAINTENANCE_FAMILIES) await processMaintenanceFamily(claim, family);
  return completeMaintenance(claim);
}
async function visit(number: number, extra: Record<string, unknown> = {}) {
  return db.consultation.create({ data: { id: uuid(number), tenantId, locationId, providerId: userId,
    configurationVersionId, reference: 'synthetic-' + number, idempotencyKey: 'synthetic-' + number,
    isTest: false, careOutcomeDueAt: ago(1), wellnessPlan: {}, wellnessDecisionDueAt: ago(1), ...extra } });
}
async function rate(key: string, old = true) {
  rateKeys.add(key); return db.rateLimitBucket.create({ data: { key, windowStart: old ? ago(3) : new Date(), count: 7 } });
}
function request(method = 'GET', body?: unknown, auth = 'Bearer ' + process.env.CRON_SECRET) {
  return new Request('http://127.0.0.1:4197/api/jobs/reconcile', { method,
    headers: { authorization: auth, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeAll(async () => {
  const [identity] = await db.$queryRaw<Array<{ name: string; oid: number; marker: string }>>`
    SELECT datname AS name, oid::integer AS oid, shobj_description(oid, 'pg_database') AS marker
    FROM pg_database WHERE datname = current_database()`;
  expect(identity).toEqual({ name: 'dripwell_task047_verification', oid: Number(process.env.MAINTENANCE_OWNED_OID),
    marker: 'TASK-047 exclusively owned verification ' + process.env.MAINTENANCE_OWNED_NONCE });
});
beforeEach(async () => {
  token = randomUUID(); native.start.mockReset(); native.start.mockResolvedValue({ runId: 'mock-native-' + token });
  coordinatorKeys.clear(); rateKeys.clear();
  const tenant = await db.tenant.create({ data: { name: 'Synthetic maintenance only', slug: 'task047-' + token,
    state: 'TX', medicalDirector: 'Synthetic fixture' } }); tenantId = tenant.id;
  const user = await db.user.create({ data: { tenantId, email: token + '@example.invalid', passwordHash: 'not-loginable',
    firstName: 'Synthetic', lastName: 'Maintenance', role: 'STAFF', canApproveClinical: false } }); userId = user.id;
  const location = await db.location.create({ data: { tenantId, name: 'Synthetic isolated maintenance fixture' } }); locationId = location.id;
  const configuration = await db.clinicConfigurationVersion.create({ data: { tenantId, locationId, userId,
    version: 1, payload: {}, source: 'TASK047 mechanical fixture', status: 'DRAFT' } }); configurationVersionId = configuration.id;
});
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  // Explicit owned IDs and dependency order only; the wrapper then requires all
  // 51 target tables empty, all 50 shared digests unchanged and zero connections.
  await db.consultation.deleteMany({ where: { tenantId } });
  await db.clinicConfigurationVersion.deleteMany({ where: { tenantId } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.rateLimitBucket.deleteMany({ where: { key: { in: [...rateKeys] } } });
  await db.maintenanceCoordinator.deleteMany({ where: { key: { in: [...coordinatorKeys] } } });
});
afterAll(async () => db.$disconnect());

describe('owned PostgreSQL maintenance fencing and bounded pages', () => {
  test('default-disabled GET is read-only and denied or request-scoped POST never starts native work', async () => {
    expect((await GET(request(), undefined)).status).toBe(200);
    expect(await db.maintenanceCoordinator.count()).toBe(0);
    expect((await POST(request('POST', { command: 'start' }, 'Bearer wrong'), undefined)).status).toBe(401);
    expect((await POST(request('POST', { command: 'start', deploymentId: 'other' }), undefined)).status).toBe(400);
    expect(await db.maintenanceCoordinator.count()).toBe(0); expect(native.start).not.toHaveBeenCalled();
    const row = await db.maintenanceCoordinator.create({ data: { key: context().key, projectId: context().projectId,
      environment: 'development', branch: context().branch } });
    expect(row).toMatchObject({ enabled: false, mode: 'DISABLED', phase: 'IDLE', generation: 0n, ordinal: 0n });
  });
  test('manual and scheduled reservation race has one winner and duplicate native claims have one owner', async () => {
    const c = context(); const results = await Promise.allSettled([reserveMaintenance(c, 'run-once'), reserveMaintenance(c, 'start')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const first = results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof reserveMaintenance>>>;
    const claims = await Promise.all([claimMaintenance(first.value.reservation!, 'owner-a'), claimMaintenance(first.value.reservation!, 'owner-b')]);
    expect(claims.filter(Boolean)).toHaveLength(1); const current = claims.find(Boolean)!;
    expect(await claimMaintenance(first.value.reservation!, current.runId)).toEqual(current);
    await expect(reserveMaintenance(c, 'run-once')).rejects.toMatchObject({ code: 'MAINTENANCE_CONFLICT' });
    await finish(current);
    if (current.mode === 'SCHEDULED') await expect(reserveMaintenance(c, 'run-once')).rejects.toMatchObject({ code: 'MAINTENANCE_CONFLICT' });
    else expect((await reserveMaintenance(c, 'start')).reservation!.mode).toBe('SCHEDULED');
  });
  test('another trusted environment cannot run a separate global sweep of the same database', async () => {
    await owner(); vi.stubEnv('MAINTENANCE_LOCAL_BRANCH', 'other-trusted-branch');
    await expect(reserveMaintenance(context(), 'start')).rejects.toMatchObject({ code: 'MAINTENANCE_CONFLICT' });
    expect(await db.maintenanceCoordinator.count()).toBe(1);
  });
  test('uncertain native start is durable and explicit expired recovery fences the old reservation', async () => {
    const c = context(); const first = (await reserveMaintenance(c, 'run-once')).reservation!;
    native.start.mockRejectedValueOnce(new Error('private native uncertainty'));
    await expect(dispatchMaintenance(first)).rejects.toMatchObject({ code: 'MAINTENANCE_START_AMBIGUOUS' });
    expect((await maintenanceStatus(c)).lastErrorCode).toBe('NATIVE_START_AMBIGUOUS');
    await expect(dispatchMaintenance(first)).rejects.toMatchObject({ code: 'MAINTENANCE_CONFLICT' });
    expect(native.start).toHaveBeenCalledOnce();
    await expect(reserveMaintenance(c, 'recover')).rejects.toMatchObject({ code: 'MAINTENANCE_CONFLICT' });
    await db.maintenanceCoordinator.update({ where: { key: c.key }, data: { leaseUntil: ago(1) } });
    const recovered = (await reserveMaintenance(c, 'recover')).reservation!;
    expect(BigInt(recovered.generation)).toBe(BigInt(first.generation) + 1n);
    await expect(claimMaintenance(first, 'late-original')).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    await dispatchMaintenance(recovered);
    expect(native.start.mock.calls[1][2]).toEqual({ deploymentId: 'dpl_local@5.0.1' });
    expect(native.start).toHaveBeenCalledTimes(2);
    const claimed = (await claimMaintenance(recovered, 'recovered-owner'))!;
    const key = 'task047-takeover-' + token; const bucket = await rate(key);
    await selectMaintenancePage(claimed, 'oldRates');
    await db.maintenanceCoordinator.update({ where: { key: c.key }, data: { leaseUntil: ago(1) } });
    await reserveMaintenance(c, 'recover');
    await expect(applyMaintenanceItem(claimed, 'oldRates', 0)).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    expect(await db.rateLimitBucket.findUniqueOrThrow({ where: { key } })).toEqual(bucket);
  });
  test('stop fences a selected item its progress completion and continuation without domain writes', async () => {
    const key = 'task047-stale-' + token; await rate(key); const current = await owner('start');
    const page = await selectMaintenancePage(current, 'oldRates'); expect(page.ids).toEqual([key]);
    const prior = await db.rateLimitBucket.findUniqueOrThrow({ where: { key } });
    await reserveMaintenance(context(), 'stop');
    for (const operation of [() => applyMaintenanceItem(current, 'oldRates', 0), () => completeMaintenance(current), () => reserveNextMaintenance(current)])
      await expect(operation()).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    expect(await db.rateLimitBucket.findUniqueOrThrow({ where: { key } })).toEqual(prior);
  });
  test('an in-flight fenced transaction commits before stop and never writes after generation changes', async () => {
    const key = 'task047-lock-' + token; await rate(key); const current = await owner();
    let entered!: () => void, release!: () => void;
    const locked = new Promise<void>((resolve) => { entered = resolve; });
    const released = new Promise<void>((resolve) => { release = resolve; });
    const effect = withMaintenanceClaim(current, async (tx) => {
      await tx.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
      entered(); await released;
    });
    await locked; let stopped = false;
    const stop = reserveMaintenance(context(), 'stop').then(() => { stopped = true; });
    await new Promise<void>((resolve) => setImmediate(resolve)); expect(stopped).toBe(false);
    release(); await effect; await stop;
    expect((await db.rateLimitBucket.findUniqueOrThrow({ where: { key } })).count).toBe(8);
    await expect(withMaintenanceClaim(current, (tx) => tx.rateLimitBucket.update({ where: { key }, data: { count: 99 } })))
      .rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    expect((await db.rateLimitBucket.findUniqueOrThrow({ where: { key } })).count).toBe(8);
  });
  test('all six families obey caps advance fairly and replay one page without multiplying effects', async () => {
    const old = ago(40), uploadOld = ago(1), prefix = 'task047-page-' + token;
    for (let n = 1; n <= 21; n++) {
      const v = await visit(n);
      await db.notification.createMany({ data: ['CARE_OUTCOME_NEEDED', 'WELLNESS_DECISION_NEEDED'].flatMap((type) =>
        Array.from({ length: 21 }, (_, i) => ({ tenantId, consultationId: v.id, userId,
          type: type as 'CARE_OUTCOME_NEEDED' | 'WELLNESS_DECISION_NEEDED', title: 'Synthetic stale', message: 'Synthetic',
          idempotencyKey: prefix + type + n + '-' + i }))) });
    }
    await db.recordingSegment.createMany({ data: Array.from({ length: 101 }, (_, i) => ({ id: uuid(i + 1), tenantId, userId, consultationId: uuid(1),
      segmentKey: prefix + i, sequence: i, blobPath: 'synthetic-never-requested/' + i, mimeType: 'audio/webm', bytes: 1,
      consentAt: uploadOld, expiresAt: ago(-1), status: 'UPLOADING', updatedAt: uploadOld })) });
    await db.generationJob.createMany({ data: Array.from({ length: 101 }, (_, i) => ({ id: uuid(i + 1), tenantId, userId,
      kind: 'SYNTHETIC', idempotencyKey: prefix + i, model: 'none', promptVersion: 'fixture', status: 'QUEUING', updatedAt: uploadOld })) });
    await db.authChallenge.createMany({ data: Array.from({ length: 51 }, (_, i) => ({ id: uuid(i + 1), userId, tokenHash: prefix + i, expiresAt: old })) });
    await db.authSession.createMany({ data: Array.from({ length: 51 }, (_, i) => ({ id: uuid(i + 1), userId, tokenHash: prefix + i, expiresAt: old })) });
    for (let n = 1; n <= 51; n++) await rate(prefix + n.toString().padStart(3, '0'));
    const preservedVisit = await visit(999, { isTest: true });
    const preservedRate = await rate(prefix + 'recent', false);
    const preservedJob = await db.generationJob.create({ data: { tenantId, userId, kind: 'TRANSCRIPTION',
      idempotencyKey: prefix + '-already-failed', model: 'none', promptVersion: 'fixture', status: 'FAILED',
      errorCode: 'MODEL_UNAVAILABLE', updatedAt: uploadOld } });
    const preservedRecording = await db.recordingSegment.create({ data: { tenantId, userId, consultationId: preservedVisit.id, segmentKey: prefix + '-adopted',
      sequence: 999, blobPath: 'synthetic-never-requested/adopted', mimeType: 'audio/webm', bytes: 1,
      consentAt: uploadOld, expiresAt: ago(-1), status: 'UPLOADED', updatedAt: uploadOld } });
    const first = await owner();
    const expected = { reminders: 20, abandonedUploads: 100, interruptedJobs: 100, expiredChallenges: 50, oldSessions: 50, oldRates: 50 };
    for (const family of MAINTENANCE_FAMILIES) {
      const result = await processMaintenanceFamily(first, family); expect(result.checked).toBe(expected[family]);
      expect(await processMaintenanceFamily(first, family)).toEqual(result);
      if (family === 'reminders') expect(result).toMatchObject({ dismissed: 800, upserted: 40 });
    }
    expect(await db.notification.count({ where: { tenantId, dismissedAt: { not: null } } })).toBe(800);
    expect(await db.notification.count({ where: { tenantId, dismissedAt: null } })).toBe(122);
    await completeMaintenance(first);
    const next = await owner(); for (const family of MAINTENANCE_FAMILIES) expect((await processMaintenanceFamily(next, family)).checked).toBe(1);
    expect(await db.consultation.findUniqueOrThrow({ where: { id: preservedVisit.id } })).toEqual(preservedVisit);
    expect(await db.rateLimitBucket.findUniqueOrThrow({ where: { key: preservedRate.key } })).toEqual(preservedRate);
    expect(await db.generationJob.findUniqueOrThrow({ where: { id: preservedJob.id } })).toEqual(preservedJob);
    expect(await db.recordingSegment.findUniqueOrThrow({ where: { id: preservedRecording.id } })).toEqual(preservedRecording);
    expect(await db.recordingSegment.count({ where: { tenantId, status: 'UPLOAD_FAILED' } })).toBe(101);
    expect(await db.generationJob.count({ where: { tenantId, errorCode: 'PROCESSING_START_INTERRUPTED' } })).toBe(101);
    expect(await db.authChallenge.count({ where: { userId } })).toBe(0); expect(await db.authSession.count({ where: { userId } })).toBe(0);
  });
  test('new immutable keys behind the cursor wait for the next finite sweep', async () => {
    const prefix = 'task047-fair-' + token;
    for (let i = 1; i <= 51; i++) await rate(prefix + i.toString().padStart(3, '0'));
    const first = await owner(); await processMaintenanceFamily(first, 'oldRates'); await finish(first);
    await rate(prefix + '000'); const second = await owner();
    expect((await processMaintenanceFamily(second, 'oldRates')).checked).toBe(1); await finish(second);
    expect(await db.rateLimitBucket.findUnique({ where: { key: prefix + '000' } })).not.toBeNull();
    const third = await owner(); expect((await processMaintenanceFamily(third, 'oldRates')).checked).toBe(1);
    expect(await db.rateLimitBucket.findUnique({ where: { key: prefix + '000' } })).toBeNull();
  });
  test('selected items recheck current status expiry due outcome and recipient under their locks', async () => {
    const v = await visit(1); const old = ago(40), prefix = 'task047-recheck-' + token;
    const recording = await db.recordingSegment.create({ data: { tenantId, userId, consultationId: v.id, segmentKey: prefix, sequence: 1,
      blobPath: 'never-requested', mimeType: 'audio/webm', bytes: 1, consentAt: old, expiresAt: ago(-1), status: 'UPLOADING', updatedAt: ago(1) } });
    const job = await db.generationJob.create({ data: { tenantId, userId, kind: 'SYNTHETIC', idempotencyKey: prefix,
      model: 'none', promptVersion: 'fixture', status: 'QUEUING', updatedAt: ago(1) } });
    const challenge = await db.authChallenge.create({ data: { userId, tokenHash: prefix, expiresAt: old } });
    const session = await db.authSession.create({ data: { userId, tokenHash: prefix, expiresAt: old } });
    const bucket = await rate(prefix); const current = await owner();
    for (const family of MAINTENANCE_FAMILIES) expect((await selectMaintenancePage(current, family)).ids).toHaveLength(1);
    await db.recordingSegment.update({ where: { id: recording.id }, data: { status: 'UPLOADED' } });
    await db.generationJob.update({ where: { id: job.id }, data: { runId: 'already-started' } });
    await db.authChallenge.update({ where: { id: challenge.id }, data: { expiresAt: ago(-1) } });
    await db.authSession.update({ where: { id: session.id }, data: { expiresAt: ago(-1) } });
    await db.rateLimitBucket.update({ where: { key: bucket.key }, data: { windowStart: new Date() } });
    await db.consultation.update({ where: { id: v.id }, data: { careOutcome: 'STARTED', wellnessDecisionDueAt: ago(-1) } });
    for (const family of MAINTENANCE_FAMILIES) expect((await processMaintenanceFamily(current, family)).changed).toBe(0);
    expect(await db.notification.count({ where: { tenantId } })).toBe(0);
    expect((await db.recordingSegment.findUniqueOrThrow({ where: { id: recording.id } })).status).toBe('UPLOADED');
    expect((await db.generationJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('QUEUING');
    // A later sweep sees current due/recipient, dismisses old keys and creates
    // only one key per due condition; a finished page cannot be rerun early.
    await finish(current); const recipient = randomUUID();
    await db.consultation.update({ where: { id: v.id }, data: { careOutcome: 'PENDING', careOutcomeDueAt: ago(1) } });
    await db.notification.create({ data: { tenantId, consultationId: v.id, userId: recipient,
      type: 'CARE_OUTCOME_NEEDED', title: 'Synthetic stale recipient', message: 'Synthetic', idempotencyKey: 'old-' + prefix } });
    const next = await owner(); expect(await processMaintenanceFamily(next, 'reminders')).toMatchObject({ dismissed: 1, upserted: 1 });
    const active = await db.notification.findMany({ where: { tenantId, dismissedAt: null } });
    expect(active).toHaveLength(1); expect(active[0].userId).toBe(userId);
    await finish(next); await db.consultation.update({ where: { id: v.id }, data: { archivedAt: new Date() } });
    expect(await processMaintenanceFamily(await owner(), 'reminders')).toMatchObject({ dismissed: 1, upserted: 0 });
    expect(await db.notification.count({ where: { tenantId, dismissedAt: null } })).toBe(0);
  });
  test('completion requires all pages inside its own fence and its response replay preserves one due reservation', async () => {
    const current = await owner('start');
    await expect(completeMaintenance(current)).rejects.toMatchObject({ code: 'MAINTENANCE_INCOMPLETE' });
    const due = await finish(current); expect(due).not.toBeNull();
    const before = await db.maintenanceCoordinator.findUniqueOrThrow({ where: { key: context().key } });
    expect(before.phase).toBe('WAITING'); expect(await requireMaintenancePagesComplete(current)).toHaveProperty('oldRates');
    expect(await completeMaintenance(current)).toBe(due);
    expect(await db.maintenanceCoordinator.findUniqueOrThrow({ where: { key: context().key } })).toEqual(before);
    await expect(reserveNextMaintenance(current)).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    await db.maintenanceCoordinator.update({ where: { key: context().key }, data: { nextDueAt: ago(1) } });
    const next = await reserveNextMaintenance(current); expect(next.ordinal).toBe('2'); expect(next.context).toEqual(current.context);
    expect(await reserveNextMaintenance(current)).toEqual(next);
    await reserveMaintenance(context(), 'stop');
    await expect(dispatchMaintenance(next)).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' }); expect(native.start).not.toHaveBeenCalled();
  });
  test('corrupt durable page state fails closed before effects and completion', async () => {
    const key = 'task047-corrupt-' + token; const bucket = await rate(key); const current = await owner();
    await db.maintenanceCoordinator.update({ where: { key: context().key }, data: { progress: { oldRates: { finished: true } } } });
    await expect(processMaintenanceFamily(current, 'oldRates')).rejects.toMatchObject({ code: 'MAINTENANCE_STATE_INVALID' });
    await expect(completeMaintenance(current)).rejects.toMatchObject({ code: 'MAINTENANCE_STATE_INVALID' });
    expect(await db.rateLimitBucket.findUniqueOrThrow({ where: { key } })).toEqual(bucket);
  });
  test('a lost committed item response does not duplicate its effect on retry', async () => {
    await visit(1); const current = await owner(); await selectMaintenancePage(current, 'reminders');
    const original = db.$transaction.bind(db); let failed = false;
    const spy = vi.spyOn(db, '$transaction').mockImplementation((async (...args: unknown[]) => {
      const result = await (original as (...a: unknown[]) => Promise<unknown>)(...args);
      if (!failed) { failed = true; throw new Error('Synthetic lost committed response'); }
      return result;
    }) as typeof db.$transaction);
    await expect(applyMaintenanceItem(current, 'reminders', 0)).rejects.toThrow('Synthetic lost committed response'); spy.mockRestore();
    expect(await applyMaintenanceItem(current, 'reminders', 0)).toMatchObject({ index: 1, finished: true, upserted: 2 });
    expect(await db.notification.count({ where: { tenantId } })).toBe(2);
  });
  test('failed and budget-deferred items remain visible while finite cursor progress permits later recovery', async () => {
    const key = 'task047-partial-' + token; await rate(key); const current = await owner();
    await selectMaintenancePage(current, 'oldRates'); const original = db.$transaction.bind(db); let calls = 0;
    const spy = vi.spyOn(db, '$transaction').mockImplementation((async (...args: unknown[]) => {
      if (++calls === 2) throw new Error('Synthetic item transaction unavailable');
      return (original as (...a: unknown[]) => Promise<unknown>)(...args);
    }) as typeof db.$transaction);
    expect(await processMaintenanceFamily(current, 'oldRates')).toMatchObject({ checked: 1, failed: 1, changed: 0 }); spy.mockRestore();
    await finish(current); expect((await maintenanceStatus(context())).lastErrorCode).toBe('ITERATION_PARTIAL');
    const next = await owner(); const began = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValueOnce(began).mockReturnValue(began + 25_000);
    expect(await processMaintenanceFamily(next, 'oldRates')).toMatchObject({ checked: 1, deferred: 1, changed: 0 }); clock.mockRestore();
    await finish(next); const recovered = await owner(); expect((await processMaintenanceFamily(recovered, 'oldRates')).changed).toBe(1);
  });
  test('a new build requires explicit stop and generation rebind before current maintenance', async () => {
    const prior = await owner(); vi.stubEnv('MAINTENANCE_LOCAL_BUILD_ID', 'b'.repeat(64));
    await expect(processMaintenanceFamily(prior, 'oldRates')).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    await expect(reserveMaintenance(context(), 'recover')).rejects.toMatchObject({ code: 'MAINTENANCE_CONFLICT' });
    await reserveMaintenance(context(), 'stop'); const next = await owner();
    expect(next.context.key).toBe(prior.context.key); expect(next.context.deploymentId).not.toBe(prior.context.deploymentId);
    expect(BigInt(next.generation)).toBeGreaterThan(BigInt(prior.generation));
    await expect(processMaintenanceFamily(prior, 'oldRates')).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
  });
});
