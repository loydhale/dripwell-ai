import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
const boundary = vi.hoisted(() => ({
  lookup: vi.fn(async () => null), getDb: vi.fn(), start: vi.fn(),
}));
vi.mock('./db', () => ({ getDb: boundary.getDb }));
vi.mock('workflow/api', () => ({ start: boundary.start }));
import { maintenanceAuthorization, maintenanceContext, assertMaintenanceContext, nextMaintenanceDue } from './maintenance-context';
import { completedMaintenancePages, maintenanceState, maintenanceCursorSchema, emptyRecordingCleanupPage } from './maintenance-state';
import { GET, POST } from '../app/api/jobs/reconcile/route';

const environmentKeys = ['CRON_SECRET', 'VERCEL', 'VERCEL_PROJECT_ID', 'VERCEL_ENV', 'VERCEL_GIT_COMMIT_REF',
  'VERCEL_DEPLOYMENT_ID', 'MAINTENANCE_LOCAL_PROJECT', 'MAINTENANCE_LOCAL_BRANCH', 'MAINTENANCE_LOCAL_BUILD_ID',
  'MAINTENANCE_LOCAL_INTERVAL_MS', 'WORKFLOW_TARGET_WORLD'];
function local() {
  vi.stubEnv('WORKFLOW_TARGET_WORLD', 'local');
  vi.stubEnv('MAINTENANCE_LOCAL_PROJECT', 'local-source-test');
  vi.stubEnv('MAINTENANCE_LOCAL_BRANCH', 'owned-source-check');
  vi.stubEnv('MAINTENANCE_LOCAL_BUILD_ID', 'a'.repeat(64));
}
function hosted() {
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_PROJECT_ID', 'prj_sourceFixture');
  vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'feat/source-fixture');
  vi.stubEnv('VERCEL_DEPLOYMENT_ID', 'dpl_sourceFixture');
}
function request(method = 'GET', body?: unknown, auth = 'Bearer owned-machine-fixture') {
  return new Request('https://source.example.invalid/api/jobs/reconcile', {
    method, headers: { authorization: auth, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function completed() {
  const dbPages = Object.fromEntries(['reminders', 'abandonedUploads', 'interruptedJobs', 'expiredChallenges', 'oldSessions', 'oldRates']
    .map((family) => [family, { ids: [] as string[], index: 0, cutoff: '2026-10-04T00:00:00.000Z', changed: 0,
      dismissed: 0, upserted: 0, failed: 0, deferred: 0, finished: true }]));
  return Object.assign(dbPages, { recordingUploadCleanup: emptyRecordingCleanupPage('2026-10-04T00:00:00.000Z'),
    expiredAudioRetention: emptyRecordingCleanupPage('2026-10-04T00:00:00.000Z') });
}
beforeEach(() => {
  for (const key of environmentKeys) vi.stubEnv(key, '');
  vi.stubEnv('CRON_SECRET', 'owned-machine-fixture');
  boundary.lookup.mockClear(); boundary.start.mockClear(); boundary.getDb.mockReset();
  boundary.getDb.mockReturnValue({ maintenanceCoordinator: { findUnique: boundary.lookup } });
});
afterEach(() => vi.unstubAllEnvs());

describe('maintenance authority and bounded state', () => {
  test('missing and wrong machine credentials fail before database or native access', async () => {
    for (const auth of ['', 'Bearer wrong']) {
      expect((await POST(request('POST', { command: 'start' }, auth), undefined)).status).toBe(401);
      expect((await GET(request('GET', undefined, auth), undefined)).status).toBe(401);
    }
    vi.stubEnv('CRON_SECRET', '');
    expect((await GET(request(), undefined)).status).toBe(401);
    expect(boundary.getDb).not.toHaveBeenCalled(); expect(boundary.start).not.toHaveBeenCalled();
  });
  test('equal character counts with unequal credential bytes reject without a comparison error', () => {
    vi.stubEnv('CRON_SECRET', 'é');
    expect(() => maintenanceAuthorization(request('GET', undefined, 'Bearer x'))).toThrowError(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
  });
  test('valid authentication without trusted deployment context causes no write or dispatch', async () => {
    expect((await POST(request('POST', { command: 'start' }), undefined)).status).toBe(503);
    expect(boundary.getDb).not.toHaveBeenCalled(); expect(boundary.start).not.toHaveBeenCalled();
  });
  test('hosted context rejects each explicit local override', () => {
    hosted();
    for (const key of ['MAINTENANCE_LOCAL_PROJECT', 'MAINTENANCE_LOCAL_BRANCH', 'MAINTENANCE_LOCAL_BUILD_ID', 'MAINTENANCE_LOCAL_INTERVAL_MS']) {
      vi.stubEnv(key, 'override'); expect(() => maintenanceContext()).toThrow(); vi.stubEnv(key, '');
    }
  });
  test('hosted local and custom Worlds fail before every database or native access', async () => {
    hosted();
    for (const world of ['local', '@workflow/world-local', '@workflow/world-postgres', './custom-world.ts', 'arbitrary', ' vercel ']) {
      vi.stubEnv('WORKFLOW_TARGET_WORLD', world);
      for (const response of [await GET(request(), undefined), await POST(request('POST', { command: 'start' }), undefined)]) {
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ code: 'MAINTENANCE_CONTEXT_UNAVAILABLE' });
      }
      expect(boundary.getDb).not.toHaveBeenCalled(); expect(boundary.start).not.toHaveBeenCalled();
    }
    for (const world of ['', 'vercel']) {
      vi.stubEnv('WORKFLOW_TARGET_WORLD', world);
      expect(maintenanceContext().nativeDeploymentId).toBe('dpl_sourceFixture');
      expect((await GET(request(), undefined)).status).toBe(200);
    }
    expect(boundary.lookup).toHaveBeenCalledTimes(2); expect(boundary.start).not.toHaveBeenCalled();
  });
  test('hosted selection fails closed on an incomplete or invalid platform context', () => {
    hosted();
    for (const [key, value] of [['VERCEL_PROJECT_ID', 'arbitrary'], ['VERCEL_ENV', 'other'],
      ['VERCEL_GIT_COMMIT_REF', ' padded '], ['VERCEL_DEPLOYMENT_ID', 'latest']]) {
      const prior = process.env[key]!; vi.stubEnv(key, value);
      expect(() => maintenanceContext()).toThrow(); vi.stubEnv(key, prior);
    }
  });
  test('environment and branch scopes differ while a new deployment retains the same scope', () => {
    hosted(); const first = maintenanceContext();
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', 'dpl_nextBuild'); const next = maintenanceContext();
    expect(next.key).toBe(first.key); expect(next.nativeDeploymentId).toBe('dpl_nextBuild');
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'feat/other'); expect(maintenanceContext().key).not.toBe(first.key);
    vi.stubEnv('VERCEL_ENV', 'production'); expect(maintenanceContext().key).not.toBe(first.key);
  });
  test('nonhost selection requires an explicit Local World project branch and build digest', () => {
    local(); expect(maintenanceContext()).toMatchObject({ environment: 'development', deploymentId: 'local:' + 'a'.repeat(64), nativeDeploymentId: 'dpl_local@5.0.1' });
    for (const [key, value] of [['WORKFLOW_TARGET_WORLD', 'vercel'], ['MAINTENANCE_LOCAL_PROJECT', 'prj_other'],
      ['MAINTENANCE_LOCAL_BRANCH', ''], ['MAINTENANCE_LOCAL_BUILD_ID', 'latest']]) {
      const prior = process.env[key]!; vi.stubEnv(key, value); expect(() => maintenanceContext()).toThrow(); vi.stubEnv(key, prior);
    }
  });
  test('only nonhost explicitly bounded short verification cadence is accepted', () => {
    local(); vi.stubEnv('MAINTENANCE_LOCAL_INTERVAL_MS', '1000'); expect(maintenanceContext().cadenceMs).toBe(1000);
    for (const value of ['999', '900001', '1e3', '1000.0', '-1000']) {
      vi.stubEnv('MAINTENANCE_LOCAL_INTERVAL_MS', value); expect(() => maintenanceContext()).toThrow();
    }
  });
  test('a stale local build cannot regain its write fence through the same scope', () => {
    local(); const context = maintenanceContext(); vi.stubEnv('MAINTENANCE_LOCAL_BUILD_ID', 'b'.repeat(64));
    expect(maintenanceContext().key).toBe(context.key);
    expect(() => assertMaintenanceContext(context)).toThrowError(expect.objectContaining({ code: 'MAINTENANCE_STALE' }));
  });
  test('next due time stays anchored and skips missed slots instead of looping catchup', () => {
    const anchor = new Date('2026-10-04T00:00:00Z');
    expect(nextMaintenanceDue(anchor, anchor, new Date(anchor.getTime() + 100), 1000)).toEqual({ nextDueAt: new Date(anchor.getTime() + 1000), skippedSlots: 0 });
    expect(nextMaintenanceDue(anchor, anchor, new Date(anchor.getTime() + 4300), 1000)).toEqual({ nextDueAt: new Date(anchor.getTime() + 5000), skippedSlots: 4 });
    expect(nextMaintenanceDue(anchor, new Date(anchor.getTime() + 1000), new Date(anchor.getTime() + 2000), 1000).nextDueAt.getTime()).toBe(anchor.getTime() + 3000);
  });
  test('the existing authenticated Cron GET is a disabled read with no bootstrap', async () => {
    local(); const result = await GET(request(), undefined);
    expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ state: { enabled: false, phase: 'IDLE', generation: '0' }, deferred: [], included: ['reminders', 'abandonedUploads', 'interruptedJobs', 'expiredChallenges', 'oldSessions', 'oldRates', 'recording-upload-blob-cleanup', 'expired-audio-blob-retention'] });
    expect(boundary.lookup).toHaveBeenCalledOnce(); expect(boundary.start).not.toHaveBeenCalled();
  });
  test('request supplied deployment scope or unknown command is rejected before writes', async () => {
    local();
    for (const body of [{ command: 'start', deploymentId: 'dpl_other' }, { command: 'start', scope: 'other' }, { command: 'bootstrap' }])
      expect((await POST(request('POST', body), undefined)).status).toBe(400);
    expect(boundary.getDb).not.toHaveBeenCalled(); expect(boundary.start).not.toHaveBeenCalled();
  });
  test('completion rejects absent families and unfinished work', () => {
    expect(() => completedMaintenancePages({})).toThrowError(expect.objectContaining({ code: 'MAINTENANCE_INCOMPLETE' }));
    const progress = completed(); progress.reminders.ids = ['visit']; progress.reminders.finished = false;
    expect(() => completedMaintenancePages(progress)).toThrowError(expect.objectContaining({ code: 'MAINTENANCE_INCOMPLETE' }));
  });
  test('corrupt progress duplicate IDs caps and false completion fail closed', () => {
    for (const mutate of [
      (p: ReturnType<typeof completed>) => { p.reminders.ids = ['same', 'same']; p.reminders.index = 2; },
      (p: ReturnType<typeof completed>) => { p.reminders.ids = Array.from({ length: 21 }, (_, i) => String(i)); p.reminders.index = 21; },
      (p: ReturnType<typeof completed>) => { p.reminders.ids = ['visit']; },
      (p: ReturnType<typeof completed>) => { p.oldRates.changed = -1; },
    ]) { const progress = completed(); mutate(progress); expect(() => completedMaintenancePages(progress)).toThrowError(expect.objectContaining({ code: 'MAINTENANCE_STATE_INVALID' })); }
  });
  test('completed partial pages retain exact failure and deferral counts', () => {
    const progress = completed(); progress.oldRates.ids = ['rate']; progress.oldRates.index = 1; progress.oldRates.failed = 1;
    progress.reminders.ids = ['visit-a', 'visit-b']; progress.reminders.index = 2; progress.reminders.deferred = 2;
    expect(completedMaintenancePages(progress)).toMatchObject({ oldRates: { failed: 1 }, reminders: { deferred: 2 } });
  });
  test('unknown cursor families and malformed keys fail closed without changing an empty cursor', () => {
    expect(maintenanceState(maintenanceCursorSchema, {})).toEqual({});
    for (const value of [{ other: { after: null, ceiling: null } }, { reminders: { after: '', ceiling: null } }, { reminders: { after: null } }])
      expect(() => maintenanceState(maintenanceCursorSchema, value)).toThrow();
  });
});
