import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BlobPreconditionFailedError, BlobNotFoundError } from '@vercel/blob';
const boundary = vi.hoisted(() => ({ claim: vi.fn(), getDb: vi.fn(), start: vi.fn() }));
vi.mock('./db', () => ({ getDb: boundary.getDb }));
vi.mock('./maintenance-coordinator', async original => ({
  ...await original<typeof import('./maintenance-coordinator')>(), withMaintenanceClaim: boundary.claim,
}));
vi.mock('workflow/api', () => ({ start: boundary.start }));
import { ApiError } from './errors';
import { maintenanceContext } from './maintenance-context';
import type { MaintenanceClaim } from './maintenance-coordinator';
import { completedMaintenancePages, cleanupKeySchema, cleanupItemSchema, emptyRecordingCleanupPage,
  type CleanupItem, type RecordingCleanupPage } from './maintenance-state';
import { captureRecordingObject, claimRecordingDeletion } from './recording-deletion-intents';
import { deleteRecordingBlob, recordingDeleteError } from './recording-blob-delete';
import { admitRecordingCleanupItem, deferExpiredRecordingCleanupPage, finishRecordingCleanupItem,
  prepareRecordingCleanupItem, processRecordingCleanupFamily, recordingCleanupTotals } from './recording-cleanup-pages';
import { maintenanceScope, maintenanceRecordingCleanupStep } from '../workflows/maintenance';
import { GET } from '../app/api/jobs/reconcile/route';

const cutoff = '2026-10-04T00:00:00.000Z';
const tenantId = randomUUID(), recordingId = randomUUID(), conversationId = randomUUID();
const object = captureRecordingObject({ tenantId, recordingId, consultationId: null,
  setupConversationId: conversationId, uploadAttemptId: null }, {
  pathname: `private/${tenantId}/setup/${recordingId}`,
  url: `https://syntheticstore.private.blob.vercel-storage.com/private/${tenantId}/setup/${recordingId}`, etag: '"original-etag"',
});
let claim: MaintenanceClaim;
let now: Date;
let row: { key: string; progress: unknown; cursors: unknown };
let sqlRows: Array<{ kind: string; sourceId: string; tenantId: string; intentId: string | null; at: Date; stableId: string }>;
function item(kind: CleanupItem['kind'] = 'LEGACY_INTENT', id = randomUUID()): CleanupItem {
  return cleanupItemSchema.parse({ kind, sourceId: id, tenantId, intentId: kind === 'LEGACY_INTENT' ? id : null,
    key: { at: cutoff, stableId: kind + ':' + id } });
}
function install(items: CleanupItem[]): RecordingCleanupPage {
  const page = emptyRecordingCleanupPage(cutoff);
  page.items = items; page.finished = !items.length; page.ceiling = items.at(-1)?.key ?? null;
  row.progress = { recordingUploadCleanup: page };
  return page;
}
function activeIntent() {
  const id = randomUUID(), token = randomUUID();
  return { id, ...object, creatorScope: claim.context.key, sourceKind: 'SETUP_UPLOAD', sourceId: recordingId,
    sourceCreatedAt: new Date(cutoff), status: 'IN_FLIGHT', executionToken: token,
    executionScope: claim.context.key, executionGeneration: 1n, executionOrdinal: 0n,
    executionRunId: claim.runId, leaseUntil: new Date(now.getTime() + 300000), attempts: 1,
    lastDurationMs: null, lastError: null, deletedAt: null };
}
let intent: ReturnType<typeof activeIntent> | null;
const tx = {
  $queryRaw: vi.fn(),
  maintenanceCoordinator: { findUnique: vi.fn(async () => null), update: vi.fn(async ({ data }: { data: object }) => {
    Object.assign(row, data); return row;
  }) },
  recordingSegment: { findFirst: vi.fn() },
  setupRecordingUpload: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  generationJob: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  recordingDeletionIntent: {
    findFirst: vi.fn(async () => intent), findUniqueOrThrow: vi.fn(async () => { if (!intent) throw new Error('No unit intent'); return intent; }),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (!intent) throw new Error('No unit intent');
      const attempts = typeof data.attempts === 'object' && data.attempts && 'increment' in data.attempts
        ? intent.attempts + Number(data.attempts.increment) : intent.attempts;
      Object.assign(intent, data, { attempts }); return intent;
    }),
  },
};
function useActive() {
  intent = activeIntent();
  const page = install([item('SETUP_UPLOAD', recordingId)]);
  page.active = { intentId: intent.id, token: intent.executionToken, index: 0 };
  return page.active;
}
beforeEach(() => {
  vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_DEPLOYMENT_ID', ''); vi.stubEnv('WORKFLOW_TARGET_WORLD', 'local');
  vi.stubEnv('MAINTENANCE_LOCAL_PROJECT', 'local-cleanup-unit'); vi.stubEnv('MAINTENANCE_LOCAL_BRANCH', 'synthetic-cleanup-unit');
  vi.stubEnv('MAINTENANCE_LOCAL_BUILD_ID', 'c'.repeat(64)); vi.stubEnv('MAINTENANCE_LOCAL_INTERVAL_MS', '');
  vi.stubEnv('CRON_SECRET', 'synthetic-unit'); vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_syntheticstore_unit');
  claim = { context: maintenanceContext(), mode: 'MANUAL', generation: '1', ordinal: '0',
    token: randomUUID(), runId: 'synthetic-unit-run', dueAt: cutoff };
  now = new Date(cutoff); row = { key: claim.context.key, progress: {}, cursors: {} }; intent = null; sqlRows = [];
  vi.clearAllMocks();
  boundary.getDb.mockReturnValue(tx);
  boundary.claim.mockImplementation(async (_claim, body) => body(tx, row));
  tx.$queryRaw.mockImplementation(async query => {
    if (Array.isArray(query) && query.join('').includes('clock_timestamp')) return [{ now: new Date(now) }];
    if (query?.sql?.includes('WITH candidates')) {
      const take = Number(query.values.at(-1));
      return query.sql.includes('DESC') ? sqlRows.slice(-take).reverse() : sqlRows.slice(0, take);
    }
    return [];
  });
  tx.recordingSegment.findFirst.mockResolvedValue(null);
  tx.setupRecordingUpload.findFirst.mockResolvedValue(null);
  tx.setupRecordingUpload.findUnique.mockResolvedValue(null);
  tx.generationJob.findFirst.mockResolvedValue(null); tx.generationJob.findUnique.mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('recording cleanup pages', () => {
  test('selects at most five per family with no refill on defer error or deadline', async () => {
    sqlRows = Array.from({ length: 8 }, () => item()).sort((a, b) => a.key.stableId < b.key.stableId ? -1 : 1)
      .map(i => ({ kind: i.kind, sourceId: i.sourceId, tenantId, intentId: i.intentId, at: new Date(i.key.at), stableId: i.key.stableId }));
    const io = vi.fn(async () => { throw new Error('No legacy provider permission'); });
    expect(await processRecordingCleanupFamily(claim, 'recordingUploadCleanup', io)).toMatchObject({ checked: 5, deferred: 5 });
    const selectionCalls = tx.$queryRaw.mock.calls.filter(([query]) => query?.sql?.includes('WITH candidates'));
    expect(selectionCalls).toHaveLength(2);
    expect(await processRecordingCleanupFamily(claim, 'recordingUploadCleanup', io)).toMatchObject({ checked: 5, deferred: 5 });
    expect(tx.$queryRaw.mock.calls.filter(([query]) => query?.sql?.includes('WITH candidates'))).toHaveLength(2);
    expect(io).not.toHaveBeenCalled();
    const page = install([item(), item()]); now = new Date(page.deadline);
    expect(await processRecordingCleanupFamily(claim, 'recordingUploadCleanup', io)).toMatchObject({ checked: 2, deferred: 2 });
  });
  test('orders immutable createdAt stableId ceilings and wraps fairly', async () => {
    const a = item(), b = item(); const keys = [a, b].sort((x, y) => x.key.stableId < y.key.stableId ? -1 : 1);
    for (const value of keys) expect(cleanupKeySchema.parse(value.key)).toEqual(value.key);
    expect(() => cleanupKeySchema.parse({ at: cutoff, stableId: 'RECORDING:------------------------------------' })).toThrow();
    const page = install(keys); page.ended = false;
    await processRecordingCleanupFamily(claim, 'recordingUploadCleanup');
    expect(row.cursors).toEqual({ recordingUploadCleanup: { after: keys[1].key, ceiling: keys[1].key } });
    const next = install([item()]); next.ended = true;
    await processRecordingCleanupFamily(claim, 'recordingUploadCleanup');
    expect(row.cursors).toEqual({ recordingUploadCleanup: { after: null, ceiling: null } });
  });
  test('calls one full URL exact ifMatch and remaining-budget AbortSignal', async () => {
    const io = vi.fn(async (_url: string, _options: { token: string; ifMatch: string; abortSignal: AbortSignal }) => {});
    expect((await deleteRecordingBlob(object, 321, io)).deleted).toBe(true);
    expect(io).toHaveBeenCalledOnce();
    expect(io.mock.calls[0][0]).toBe(object.objectUrl);
    expect(io.mock.calls[0][1]).toMatchObject({ ifMatch: object.etag, token: 'vercel_blob_rw_syntheticstore_unit' });
    expect(io.mock.calls[0][1].abortSignal).toBeInstanceOf(AbortSignal);
    await expect(deleteRecordingBlob(object, 0, io)).rejects.toMatchObject({ code: 'RECORDING_CLEANUP_DEADLINE' });
    expect(io).toHaveBeenCalledOnce();
  });
  test('defers unsettled legacy wrong-store and missing-provenance candidates', async () => {
    for (const scenario of ['legacy', 'unsettled', 'wrong-store', 'missing']) {
      const candidate = item(scenario === 'legacy' ? 'LEGACY_INTENT' : 'SETUP_UPLOAD', recordingId);
      install([candidate]);
      tx.setupRecordingUpload.findFirst.mockResolvedValue({ state: 'CLEANUP_PENDING', uploadSettled: scenario !== 'unsettled',
        blobObject: scenario === 'missing' ? null : object });
      vi.stubEnv('BLOB_READ_WRITE_TOKEN', scenario === 'wrong-store' ? 'vercel_blob_rw_otherstore_unit' : 'vercel_blob_rw_syntheticstore_unit');
      expect((await prepareRecordingCleanupItem(claim, 'recordingUploadCleanup', 0)).status).toBe('ADVANCED');
      expect(row.progress).toMatchObject({ recordingUploadCleanup: { deferred: 1, finished: true } });
    }
    expect(tx.recordingDeletionIntent.update).not.toHaveBeenCalled();
  });
  test('maps timeout precondition and unknown provider failure without raw payload', async () => {
    expect(recordingDeleteError(new BlobPreconditionFailedError())).toBe('OBJECT_CHANGED');
    expect(recordingDeleteError(new DOMException('PRIVATE_', 'AbortError'))).toBe('DELETE_TIMEOUT');
    expect(recordingDeleteError(new BlobNotFoundError())).toBe('DELETE_FAILED');
    const outcome = await deleteRecordingBlob(object, 50, async () => { throw new Error('PRIVATE_PROVIDER_BODY'); });
    expect(outcome).toMatchObject({ deleted: false, error: 'DELETE_FAILED' });
    expect(JSON.stringify(outcome)).not.toContain('PRIVATE_'); expect(JSON.stringify(outcome)).not.toContain(object.objectUrl);
  });
  test('gates success on fresh post-observation deadline', async () => {
    const active = useActive(); now = new Date(new Date(cutoff).getTime() + 20_000);
    await expect(finishRecordingCleanupItem(claim, 'recordingUploadCleanup', active, { deleted: true, durationMs: 2 }))
      .rejects.toMatchObject({ code: 'RECORDING_CLEANUP_DEADLINE' });
    expect(tx.recordingDeletionIntent.update).not.toHaveBeenCalled();
    await deferExpiredRecordingCleanupPage(claim, 'recordingUploadCleanup', 0, active);
    expect(intent).toMatchObject({ status: 'PENDING', executionToken: null, lastError: 'DELETE_TIMEOUT', lastDurationMs: null });
    expect(row.progress).toMatchObject({ recordingUploadCleanup: { deleted: 0, durationMs: 0, deferred: 1, finished: true } });
  });
  test('reuses committed immutable intent after lost bookkeeping', async () => {
    useActive(); const original = intent!.objectUrl;
    expect((await prepareRecordingCleanupItem(claim, 'recordingUploadCleanup', 0)).status).toBe('ACTIVE');
    intent!.executionGeneration = 1n; intent!.leaseUntil = new Date(0);
    const reclaimed = await claimRecordingDeletion({ ...claim, generation: '2' }, intent!.id, now);
    expect(reclaimed).toMatchObject({ objectUrl: original, executionGeneration: 2n, attempts: 2 });
    expect(reclaimed?.executionToken).not.toBe(null);
    expect(boundary.start).not.toHaveBeenCalled();
  });
  test('keeps non-AI metrics separate and requires both provider page completions', () => {
    const dbPages = Object.fromEntries(['reminders', 'abandonedUploads', 'interruptedJobs', 'expiredChallenges', 'oldSessions', 'oldRates']
      .map(family => [family, { ids: [], index: 0, cutoff, changed: 0, dismissed: 0, upserted: 0, failed: 0, deferred: 0, finished: true }]));
    expect(() => completedMaintenancePages(dbPages)).toThrowError(expect.objectContaining({ code: 'MAINTENANCE_INCOMPLETE' }));
    const upload = emptyRecordingCleanupPage(cutoff), retention = emptyRecordingCleanupPage(cutoff);
    expect(() => completedMaintenancePages({ ...dbPages, recordingUploadCleanup: upload })).toThrow();
    expect(completedMaintenancePages({ ...dbPages, recordingUploadCleanup: upload, expiredAudioRetention: retention }))
      .toMatchObject({ recordingUploadCleanup: { checked: 0 }, expiredAudioRetention: { changed: 0 } });
    expect(recordingCleanupTotals(upload)).toEqual({ checked: 0, deleted: 0, preserved: 0, failed: 0, deferred: 0, durationMs: 0 });
    expect(Object.keys(recordingCleanupTotals(upload))).not.toEqual(expect.arrayContaining(['model', 'promptVersion', 'cost', 'tokens']));
  });
  test('preserves default-disabled GET Cron manual and scheduled behavior', async () => {
    const result = await GET(new Request('https://synthetic.invalid/api/jobs/reconcile', { headers: { authorization: 'Bearer synthetic-unit' } }), undefined);
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ state: { enabled: false, phase: 'IDLE' }, deferred: [] });
    expect(maintenanceScope().included).toHaveLength(8); expect(maintenanceScope().deferred).toEqual([]);
    expect(maintenanceRecordingCleanupStep.maxRetries).toBe(0);
    expect(boundary.start).not.toHaveBeenCalled();
  });
  test('retains stop-inflight physical-versus-bookkeeping distinction', async () => {
    const active = useActive(); const admitted = await admitRecordingCleanupItem(claim, 'recordingUploadCleanup', active);
    let release!: () => void;
    const latch = new Promise<void>(resolve => { release = resolve; });
    const io = vi.fn(async () => { await latch; });
    const physical = deleteRecordingBlob(admitted.object, admitted.remainingMs, io);
    intent!.executionToken = randomUUID(); release();
    const outcome = await physical;
    await expect(finishRecordingCleanupItem(claim, 'recordingUploadCleanup', active, outcome))
      .rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    expect(io).toHaveBeenCalledOnce(); expect(tx.recordingDeletionIntent.update).not.toHaveBeenCalled();
  });

  test('accepts a mixed-case trusted store for one unchanged conditional delete', async () => {
    const token = 'vercel_blob_rw_SyNtHeTiCsToRe_OPAQUE_MiXeD';
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', token);
    const io = vi.fn(async (_url: string, _options: { token: string; ifMatch: string; abortSignal: AbortSignal }) => {});
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      expect(await deleteRecordingBlob(object, 321, io)).toEqual({ deleted: true, durationMs: expect.any(Number) });
      expect(io).toHaveBeenCalledTimes(1);
      expect(io).toHaveBeenCalledWith(object.objectUrl, {
        token, ifMatch: object.etag, abortSignal: expect.any(AbortSignal),
      });
      expect(timeout).toHaveBeenCalledTimes(1);
      expect(timeout).toHaveBeenCalledWith(321);
      expect(io.mock.calls[0]![1].abortSignal).toBe(timeout.mock.results[0]!.value);
      expect(object.storeId).toBe('syntheticstore');
      expect(tx.recordingDeletionIntent.update).not.toHaveBeenCalled();
    } finally { timeout.mockRestore(); }
  });

  test('rejects wrong and malformed token store components before conditional deletion', async () => {
    const target = { tenantId: object.tenantId, recordingId: object.recordingId,
      consultationId: object.consultationId, setupConversationId: object.setupConversationId,
      uploadAttemptId: object.uploadAttemptId };
    const canonical = captureRecordingObject(target, { pathname: object.blobPath,
      url: 'https://kstore.private.blob.vercel-storage.com/' + object.blobPath, etag: object.etag });
    const io = vi.fn(async () => {});
    for (const token of [
      undefined, 'vercel_blob_rw_otherstore_OPAQUE', 'wrong_blob_rw_kstore_OPAQUE',
      'vercel_blob_rw__OPAQUE', 'vercel_blob_rw_-kstore_OPAQUE',
      'vercel_blob_rw_' + 'k'.repeat(129) + '_OPAQUE', 'vercel_blob_rw_k store_OPAQUE',
      'vercel_blob_rw_Kstore_OPAQUE',
    ]) {
      vi.stubEnv('BLOB_READ_WRITE_TOKEN', token);
      await expect(deleteRecordingBlob(canonical, 321, io)).rejects.toMatchObject({ code: 'RECORDING_STORE_UNAVAILABLE' });
      expect(io).not.toHaveBeenCalled();
      expect(tx.recordingDeletionIntent.update).not.toHaveBeenCalled();
    }
    expect(canonical.storeId).toBe('kstore');
  });

  test('retains identity and deadline denials with a mixed-case trusted delete token', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_SyNtHeTiCsToRe_OPAQUE_MiXeD');
    const io = vi.fn(async () => {});
    for (const invalid of [{ ...object, objectUrl: object.objectUrl + '?changed=1' }, { ...object, etag: '' }])
      await expect(deleteRecordingBlob(invalid, 321, io)).rejects.toMatchObject({ code: 'RECORDING_OBJECT_IDENTITY_INVALID' });
    for (const remainingMs of [0, -1, 1.5, 20_001])
      await expect(deleteRecordingBlob(object, remainingMs, io)).rejects.toMatchObject({ code: 'RECORDING_CLEANUP_DEADLINE' });
    expect(io).not.toHaveBeenCalled();
    expect(tx.recordingDeletionIntent.update).not.toHaveBeenCalled();
  });
});
