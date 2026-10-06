import { createHash, randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { Prisma, type RecordingSegment } from '@prisma/client';
vi.mock('server-only', () => ({}));
vi.mock('workflow/api', () => ({ start: vi.fn(() => { throw new Error('Unexpected native start'); }) }));
import { getDb } from './db';
import { maintenanceContext } from './maintenance-context';
import type { MaintenanceClaim } from './maintenance-coordinator';
import { maintenanceState, maintenanceProgressSchema, type CleanupItem, type RecordingCleanupFamily } from './maintenance-state';
import { assertRecordingPathNotDetached, captureRecordingObject, commitRecordingDeletion,
  recordingDatabaseTime, recordingObjectPath, type RecordingObjectIdentity } from './recording-deletion-intents';
import { adoptRecordingUpload } from './recording-uploads';
import { performSetupRecordingUpload } from './setup-recording-uploads';
import { deleteRecordingBlob } from './recording-blob-delete';
import { selectRecordingCleanupPage, prepareRecordingCleanupItem, admitRecordingCleanupItem,
  finishRecordingCleanupItem, deferExpiredRecordingCleanupPage, processRecordingCleanupFamily } from './recording-cleanup-pages';

// Exact normal disposable-CI selector before getDb/hooks. No owned/local harness.
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'localhost' || url.port !== '5432' ||
    url.pathname !== '/dripwell_verification' || process.env.DATABASE_URL !== testUrl || process.env.ALLOW_REAL_CLIENT_DATA !== 'false')
    throw new Error('Recording cleanup pages require the explicit disposable CI database.');
}
const suite = testUrl ? describe : describe.skip;
const id = () => randomUUID().slice(0, -1) + '8';
const previous = (value: string) => value.slice(0, -1) + '7';
const nonce = randomUUID(), tenantId = id(), userId = id(), locationId = id(), conversationId = id(), versionId = id();
const controlTenant = id(), controlUser = id(), controlConversation = id(), controlId = id();
let sourceAt = new Date('2001-01-01T00:00:00.000Z');
const recordingIds = new Set<string>(), jobIds = new Set<string>(), journalIds = new Set<string>(), intentIds = new Set<string>();
const visitIds = new Set<string>(), extraTenants = new Set<string>(), extraUsers = new Set<string>(), extraLocations = new Set<string>(), extraConversations = new Set<string>();
const pending = new Set<Promise<unknown>>();
let quiescenceBlocked = false, ordinal = 0, sequence = 0;
let claim: MaintenanceClaim, control: RecordingSegment;
function tracked<T>(operation: () => Promise<T>): Promise<T> {
  if (quiescenceBlocked) throw new Error('Fixture work is permanently blocked');
  const started = operation(); pending.add(started);
  void started.then(() => pending.delete(started), () => pending.delete(started));
  return started;
}
async function join() {
  if (quiescenceBlocked) throw new Error('Fixture quiescence is permanently blocked');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([Promise.allSettled([...pending]), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { quiescenceBlocked = true; reject(new Error('Fixture quiescence deadline exceeded')); }, 5000);
    })]);
    if (pending.size) { quiescenceBlocked = true; throw new Error('Fixture work remains pending'); }
  } finally { if (timer) clearTimeout(timer); }
}
function assertTracked(items: CleanupItem[]) {
  for (const item of items) {
    const owns = item.kind === 'SETUP_UPLOAD' ? journalIds.has(item.sourceId) : item.kind === 'RECORDING' ? recordingIds.has(item.sourceId)
      : item.kind === 'UPLOAD_ATTEMPT' ? jobIds.has(item.sourceId) : intentIds.has(item.sourceId);
    if (!owns || (item.intentId && !intentIds.has(item.intentId))) throw new Error('Unowned selected fixture prevents effects');
  }
}
async function rememberIntent() {
  const rows = await getDb().recordingDeletionIntent.findMany({ where: { creatorScope: claim.context.key }, select: { id: true } });
  for (const row of rows) intentIds.add(row.id);
}
async function setRange(family: RecordingCleanupFamily, at: Date, lowId: string, highId = lowId,
  kind: CleanupItem['kind'] = family === 'recordingUploadCleanup' ? 'SETUP_UPLOAD' : 'RECORDING') {
  const db = getDb();
  const row = await db.maintenanceCoordinator.findUniqueOrThrow({ where: { key: claim.context.key } });
  const cursors = {
    ...(JSON.parse(JSON.stringify(row.cursors)) as Prisma.InputJsonObject),
    [family]: { after: { at: at.toISOString(), stableId: kind + ':' + previous(lowId) },
      ceiling: { at: at.toISOString(), stableId: kind + ':' + highId } },
  };
  await db.maintenanceCoordinator.update({ where: { key: claim.context.key }, data: { cursors } });
}
async function resetClaim(keepCursors = false) {
  await join();
  ordinal++;
  const context = maintenanceContext();
  claim = { context, mode: 'MANUAL', generation: String(ordinal), ordinal: String(ordinal),
    token: randomUUID(), runId: `synthetic-cleanup-${nonce}-${ordinal}`, dueAt: new Date().toISOString() };
  const now = await getDb().$transaction(tx => recordingDatabaseTime(tx));
  const state = { projectId: context.projectId, environment: context.environment, branch: context.branch,
    deploymentId: context.deploymentId, cadenceMs: context.cadenceMs, mode: 'MANUAL', enabled: false, phase: 'RUNNING',
    generation: BigInt(claim.generation), ordinal: BigInt(claim.ordinal), claimToken: claim.token, ownerRunId: claim.runId,
    claimedAt: now, leaseUntil: new Date(now.getTime() + 300000), progress: {}, ...(keepCursors ? {} : { cursors: {} }) };
  await getDb().maintenanceCoordinator.upsert({ where: { key: context.key }, create: { key: context.key, ...state }, update: state });
}
function objectFor(recordingId: string, consultationId: string | null = null, attemptId: string | null = null,
  ownerTenant = tenantId, setup = conversationId) {
  const target = { tenantId: ownerTenant, recordingId, consultationId,
    setupConversationId: consultationId ? null : setup, uploadAttemptId: attemptId };
  const pathname = recordingObjectPath(target);
  return captureRecordingObject(target, { pathname, url: `https://syntheticstore.private.blob.vercel-storage.com/${pathname}`, etag: `"synthetic-${randomUUID()}"` });
}
async function recording(expired = true) {
  const recordingId = id(); recordingIds.add(recordingId); const object = objectFor(recordingId);
  await getDb().recordingSegment.create({ data: { id: recordingId, tenantId, userId, setupConversationId: conversationId,
    segmentKey: randomUUID(), sequence: sequence++, blobPath: object.blobPath, blobObject: object,
    mimeType: 'audio/webm', bytes: 2, consentAt: sourceAt, createdAt: sourceAt,
    expiresAt: expired ? new Date(sourceAt.getTime() + 3600000) : new Date(Date.now() + 3600000), status: 'UPLOADED' } });
  return object;
}
async function journal(settled = true) {
  const recordingId = id(); journalIds.add(recordingId); const object = objectFor(recordingId);
  await getDb().setupRecordingUpload.create({ data: { id: recordingId, tenantId, userId, locationId,
    setupConversationId: conversationId, blobPath: object.blobPath, purpose: 'VOICE', mimeType: 'audio/webm', bytes: 2,
    consentAt: sourceAt, createdAt: sourceAt, expiresAt: new Date(sourceAt.getTime() + 3600000),
    state: 'CLEANUP_PENDING', uploadSettled: settled, ...(settled ? { blobObject: object } : {}) } });
  return object;
}
async function ready(family: RecordingCleanupFamily, at: Date, sourceId: string, kind?: CleanupItem['kind']) {
  await setRange(family, at, sourceId, sourceId, kind);
  const page = await selectRecordingCleanupPage(claim, family); assertTracked(page.items); expect(page.items).toHaveLength(1);
  const prepared = await prepareRecordingCleanupItem(claim, family, 0); await rememberIntent();
  if (prepared.status !== 'READY') throw new Error('Expected a real current owned cleanup claim');
  const admission = await admitRecordingCleanupItem(claim, family, prepared.active);
  return { ...prepared, ...admission };
}

suite('recording cleanup pages PostgreSQL', () => {
  beforeAll(async () => {
    vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_DEPLOYMENT_ID', ''); vi.stubEnv('WORKFLOW_TARGET_WORLD', 'local');
    vi.stubEnv('MAINTENANCE_LOCAL_PROJECT', `local-cleanup-${nonce}`); vi.stubEnv('MAINTENANCE_LOCAL_BRANCH', `synthetic-${nonce}`);
    vi.stubEnv('MAINTENANCE_LOCAL_BUILD_ID', createHash('sha256').update(nonce).digest('hex')); vi.stubEnv('MAINTENANCE_LOCAL_INTERVAL_MS', '');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_syntheticstore_synthetic');
    const db = getDb();
    for (const ownerTenant of [tenantId, controlTenant]) await db.tenant.create({ data: { id: ownerTenant,
      slug: `cleanup-${ownerTenant}`, name: 'Synthetic recording cleanup only', state: 'TEST', medicalDirector: 'Synthetic' } });
    for (const [ownerId, ownerTenant] of [[userId, tenantId], [controlUser, controlTenant]]) await db.user.create({ data: { id: ownerId,
      tenantId: ownerTenant, email: `cleanup-${ownerId}@example.invalid`, firstName: 'Synthetic', lastName: 'Only', role: 'SUPER_USER', passwordHash: 'unusable-synthetic' } });
    await db.location.create({ data: { id: locationId, tenantId, name: 'Synthetic cleanup location' } });
    await db.setupConversation.create({ data: { id: conversationId, tenantId, userId, locationId } });
    await db.setupConversation.create({ data: { id: controlConversation, tenantId: controlTenant, userId: controlUser } });
    await db.clinicConfigurationVersion.create({ data: { id: versionId, tenantId, locationId, userId, version: 1, status: 'DRAFT', payload: {}, source: 'Unused synthetic cleanup fixture' } });
    const at = await db.$transaction(tx => recordingDatabaseTime(tx));
    control = await db.recordingSegment.create({ data: { id: controlId, tenantId: controlTenant, userId: controlUser,
      setupConversationId: controlConversation, segmentKey: randomUUID(), sequence: 0, blobPath: 'synthetic-never-selected-control',
      mimeType: 'audio/webm', bytes: 1, consentAt: at, expiresAt: new Date(at.getTime() + 86400000), status: 'UPLOADED' } });
  });
  beforeEach(async () => {
    await join(); await resetClaim();
    // Earlier pending fixtures cannot enter a later case's exact timestamp range.
    sourceAt = new Date(Date.UTC(2001, 0, 1) + ordinal * 60_000);
  });
  afterEach(async () => { await join(); vi.restoreAllMocks(); });
  afterAll(async () => {
    await join(); // Permanent timeout block prevents any reset/teardown.
    const db = getDb();
    expect(await db.recordingSegment.findUniqueOrThrow({ where: { id: controlId } })).toEqual(control);
    await rememberIntent();
    await db.recordingDeletionIntent.deleteMany({ where: { id: { in: [...intentIds] }, creatorScope: claim.context.key } });
    await db.setupRecordingUpload.deleteMany({ where: { id: { in: [...journalIds] } } });
    await db.generationJob.deleteMany({ where: { id: { in: [...jobIds] }, tenantId } });
    await db.recordingSegment.deleteMany({ where: { id: { in: [...recordingIds] }, tenantId } });
    await db.consultation.deleteMany({ where: { id: { in: [...visitIds] }, tenantId } });
    await db.clinicConfigurationVersion.deleteMany({ where: { id: versionId, tenantId } });
    await db.setupConversation.deleteMany({ where: { id: { in: [conversationId, ...extraConversations] } } });
    await db.user.deleteMany({ where: { id: { in: [userId, ...extraUsers] } } });
    await db.location.deleteMany({ where: { id: { in: [locationId, ...extraLocations] } } });
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, ...extraTenants] } } });
    await db.maintenanceCoordinator.deleteMany({ where: { key: claim.context.key, projectId: claim.context.projectId } });
    expect(await db.recordingSegment.findUniqueOrThrow({ where: { id: controlId } })).toEqual(control);
    await db.recordingSegment.delete({ where: { id: controlId } });
    await db.setupConversation.delete({ where: { id: controlConversation } });
    await db.user.delete({ where: { id: controlUser } }); await db.tenant.delete({ where: { id: controlTenant } });
    vi.unstubAllEnvs();
  });

  test('persists fixed5 plus fixed5 ids and resumes the durable index', async () => {
    const uploads = await Promise.all(Array.from({ length: 7 }, () => journal()));
    const retained = await Promise.all(Array.from({ length: 7 }, () => recording()));
    const uploadIds = uploads.map(o => o.recordingId).sort(), recordingKeys = retained.map(o => o.recordingId).sort();
    await setRange('recordingUploadCleanup', sourceAt, uploadIds[0], uploadIds.at(-1)!);
    await setRange('expiredAudioRetention', sourceAt, recordingKeys[0], recordingKeys.at(-1)!);
    const first = await selectRecordingCleanupPage(claim, 'recordingUploadCleanup');
    const second = await selectRecordingCleanupPage(claim, 'expiredAudioRetention');
    assertTracked(first.items); assertTracked(second.items);
    expect(first.items.map(i => i.sourceId)).toEqual(uploadIds.slice(0, 5));
    expect(second.items.map(i => i.sourceId)).toEqual(recordingKeys.slice(0, 5));
    expect(first.items).toHaveLength(5); expect(second.items).toHaveLength(5);
    await journal(); await recording();
    expect(await selectRecordingCleanupPage(claim, 'recordingUploadCleanup')).toEqual(first);
    const one = await prepareRecordingCleanupItem(claim, 'recordingUploadCleanup', 0); await rememberIntent();
    if (one.status !== 'READY') throw new Error('Missing current preparation');
    expect((await prepareRecordingCleanupItem(claim, 'recordingUploadCleanup', 0)).status).toBe('ACTIVE');
    const admission = await admitRecordingCleanupItem(claim, 'recordingUploadCleanup', one.active);
    const io = vi.fn(async () => {});
    const result = await tracked(() => deleteRecordingBlob(admission.object, admission.remainingMs, io));
    await finishRecordingCleanupItem(claim, 'recordingUploadCleanup', one.active, result);
    expect(await processRecordingCleanupFamily(claim, 'recordingUploadCleanup', io)).toMatchObject({ checked: 5, deleted: 5 });
    expect(await processRecordingCleanupFamily(claim, 'expiredAudioRetention', io)).toMatchObject({ checked: 5, deleted: 5 });
    await rememberIntent();
    expect(io).toHaveBeenCalledTimes(10);
    expect(await processRecordingCleanupFamily(claim, 'recordingUploadCleanup', io)).toMatchObject({ checked: 5, deleted: 5 });
    expect(io).toHaveBeenCalledTimes(10);
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: controlId } })).toEqual(control);
  });
  test('preserves cursor cutoff and future-sweep fairness across pending errors', async () => {
    const objects = await Promise.all(Array.from({ length: 7 }, (_, n) => journal(n !== 0)));
    const ids = objects.map(o => o.recordingId).sort();
    await setRange('recordingUploadCleanup', sourceAt, ids[0], ids.at(-1)!);
    const page = await selectRecordingCleanupPage(claim, 'recordingUploadCleanup'); assertTracked(page.items);
    const io = vi.fn(async () => { throw new Error('synthetic unknown provider result'); });
    const result = await processRecordingCleanupFamily(claim, 'recordingUploadCleanup', io); await rememberIntent();
    expect(result.checked).toBe(5); expect(result.failed + result.deferred).toBe(5);
    const row = await getDb().maintenanceCoordinator.findUniqueOrThrow({ where: { key: claim.context.key } });
    expect(row.cursors).toMatchObject({ recordingUploadCleanup: { after: page.items[4].key, ceiling: page.ceiling } });
    await resetClaim(true);
    const next = await selectRecordingCleanupPage(claim, 'recordingUploadCleanup'); assertTracked(next.items);
    expect(next.items.map(i => i.sourceId)).toEqual(ids.slice(5));
    expect(new Date(next.cutoff).getTime()).toBeGreaterThanOrEqual(new Date(page.cutoff).getTime());
    await processRecordingCleanupFamily(claim, 'recordingUploadCleanup', io); await rememberIntent();
    expect((await getDb().maintenanceCoordinator.findUniqueOrThrow({ where: { key: claim.context.key } })).cursors)
      .toMatchObject({ recordingUploadCleanup: { after: null, ceiling: null } });
    // Re-admit only the exact old immutable key on a later sweep; no refill.
    await resetClaim(); await setRange('recordingUploadCleanup', sourceAt, ids[0]);
    const retry = await selectRecordingCleanupPage(claim, 'recordingUploadCleanup'); assertTracked(retry.items);
    expect(retry.items[0].key).toEqual(page.items[0].key);
    expect(retry.items[0].sourceId).toBe(ids[0]);
  });
  test('requires real current claim and intent token before mocked provider call', async () => {
    const object = await recording(); await setRange('expiredAudioRetention', sourceAt, object.recordingId);
    const before = await getDb().recordingSegment.findUniqueOrThrow({ where: { id: object.recordingId } });
    for (const forged of [{ ...claim, token: randomUUID() }, { ...claim, generation: '999' }, { ...claim, runId: 'synthetic-foreign' }])
      await expect(selectRecordingCleanupPage(forged, 'expiredAudioRetention')).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: object.recordingId } })).toEqual(before);
    const selected = await selectRecordingCleanupPage(claim, 'expiredAudioRetention'); assertTracked(selected.items);
    await expect(prepareRecordingCleanupItem(claim, 'expiredAudioRetention', 1)).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    await getDb().recordingSegment.update({ where: { id: object.recordingId }, data: { expiresAt: new Date(Date.now() + 3600000) } });
    const extended = await getDb().recordingSegment.findUniqueOrThrow({ where: { id: object.recordingId } });
    expect((await prepareRecordingCleanupItem(claim, 'expiredAudioRetention', 0)).status).toBe('ADVANCED');
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: object.recordingId } })).toEqual(extended);
    expect(await getDb().recordingDeletionIntent.findUnique({ where: { tenantId_blobPath: { tenantId, blobPath: object.blobPath } } })).toBeNull();
    await resetClaim();
    await getDb().recordingSegment.update({ where: { id: object.recordingId }, data: { expiresAt: new Date(sourceAt.getTime() + 3600000) } });
    const prepared = await ready('expiredAudioRetention', sourceAt, object.recordingId);
    const persisted = await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id: prepared.active.intentId } });
    expect(persisted).toMatchObject({ status: 'IN_FLIGHT', executionToken: prepared.active.token, sourceKind: 'RECORDING', sourceId: object.recordingId });
    expect((await getDb().recordingSegment.findUniqueOrThrow({ where: { id: object.recordingId } })).blobPath).toBe('');
    await expect(admitRecordingCleanupItem(claim, 'expiredAudioRetention', { ...prepared.active, token: randomUUID() }))
      .rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    const io = vi.fn(async (_url: string, _options: { token: string; ifMatch: string; abortSignal: AbortSignal }) => {});
    const result = await tracked(() => deleteRecordingBlob(prepared.object, prepared.remainingMs, io));
    expect(io).toHaveBeenCalledOnce(); expect(io.mock.calls[0][0]).toBe(object.objectUrl);
    expect(io.mock.calls[0][1].ifMatch).toBe(object.etag);
    await finishRecordingCleanupItem(claim, 'expiredAudioRetention', prepared.active, result);
  });
  test('rejects stopped takeover deployment and replaced-token bookkeeping', async () => {
    for (const mode of ['STOP', 'TAKEOVER', 'DEPLOYMENT', 'TOKEN']) {
      await resetClaim(); const object = await journal(); const prepared = await ready('recordingUploadCleanup', sourceAt, object.recordingId);
      let release!: () => void; const latch = new Promise<void>(resolve => { release = resolve; });
      const io = vi.fn(async () => { await latch; });
      const physical = tracked(() => deleteRecordingBlob(prepared.object, prepared.remainingMs, io));
      try {
        if (mode === 'TOKEN') await getDb().recordingDeletionIntent.update({ where: { id: prepared.active.intentId }, data: { executionToken: randomUUID() } });
        else await getDb().maintenanceCoordinator.update({ where: { key: claim.context.key }, data: mode === 'STOP'
          ? { phase: 'IDLE', generation: { increment: 1 }, claimToken: null, ownerRunId: null }
          : mode === 'DEPLOYMENT' ? { deploymentId: 'local:' + 'd'.repeat(64) }
          : { generation: { increment: 1 }, claimToken: randomUUID(), ownerRunId: 'synthetic-takeover' } });
      } finally { release(); }
      const outcome = await physical;
      const intentBefore = await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id: prepared.active.intentId } });
      const progressBefore = await getDb().maintenanceCoordinator.findUniqueOrThrow({ where: { key: claim.context.key } });
      await expect(finishRecordingCleanupItem(claim, 'recordingUploadCleanup', prepared.active, outcome)).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
      await expect(deferExpiredRecordingCleanupPage(claim, 'recordingUploadCleanup', 0, prepared.active)).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
      expect(await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id: prepared.active.intentId } })).toEqual(intentBefore);
      expect(await getDb().maintenanceCoordinator.findUniqueOrThrow({ where: { key: claim.context.key } })).toEqual(progressBefore);
      expect(io).toHaveBeenCalledOnce();
    }
  });
  test('claims committed setup rollback identity without a RecordingSegment', async () => {
    const ownerTenant = id(), ownerUser = id(), ownerLocation = id(), ownerConversation = id(), recordingId = id();
    extraTenants.add(ownerTenant); extraUsers.add(ownerUser); extraLocations.add(ownerLocation); extraConversations.add(ownerConversation); journalIds.add(recordingId);
    const db = getDb();
    await db.tenant.create({ data: { id: ownerTenant, slug: `cleanup-orphan-${ownerTenant}`, name: 'Synthetic orphan', state: 'TEST', medicalDirector: 'Synthetic' } });
    await db.user.create({ data: { id: ownerUser, tenantId: ownerTenant, email: `cleanup-orphan-${ownerUser}@example.invalid`,
      firstName: 'Synthetic', lastName: 'Only', role: 'SUPER_USER', passwordHash: 'unusable-synthetic' } });
    await db.location.create({ data: { id: ownerLocation, tenantId: ownerTenant, name: 'Synthetic orphan location' } });
    await db.setupConversation.create({ data: { id: ownerConversation, tenantId: ownerTenant, userId: ownerUser, locationId: ownerLocation } });
    const sentinel = new Error('Synthetic adoption rollback');
    await expect(performSetupRecordingUpload({ id: recordingId, tenantId: ownerTenant, userId: ownerUser, locationId: ownerLocation,
      setupConversationId: ownerConversation, purpose: 'VOICE', mimeType: 'audio/webm', bytes: 2 },
    async path => ({ pathname: path, url: `https://syntheticstore.private.blob.vercel-storage.com/${path}`, etag: '"returned-before-rollback"' }),
    async () => { throw sentinel; })).rejects.toBe(sentinel);
    const stored = await db.setupRecordingUpload.findUniqueOrThrow({ where: { id: recordingId } });
    expect(stored).toMatchObject({ state: 'CLEANUP_PENDING', uploadSettled: true, blobObject: { etag: '"returned-before-rollback"' } });
    expect(await db.recordingSegment.findUnique({ where: { id: recordingId } })).toBeNull();
    const prepared = await ready('recordingUploadCleanup', stored.createdAt, recordingId);
    const intent = await db.recordingDeletionIntent.findUniqueOrThrow({ where: { id: prepared.active.intentId } });
    expect(intent).toMatchObject({ sourceKind: 'SETUP_UPLOAD', sourceId: recordingId, sourceCreatedAt: stored.createdAt });
    await expect(db.$executeRaw`UPDATE "RecordingDeletionIntent" SET "sourceCreatedAt" = "sourceCreatedAt" + interval '1 second' WHERE "id" = ${intent.id}::uuid`).rejects.toThrow('immutable');
    await db.setupConversation.delete({ where: { id: ownerConversation } }); await db.user.delete({ where: { id: ownerUser } });
    await db.location.delete({ where: { id: ownerLocation } }); await db.tenant.delete({ where: { id: ownerTenant } });
    expect(await db.setupRecordingUpload.findUniqueOrThrow({ where: { id: recordingId } })).toEqual(stored);
    const io = vi.fn(async () => {}); const outcome = await tracked(() => deleteRecordingBlob(prepared.object, prepared.remainingMs, io));
    await finishRecordingCleanupItem(claim, 'recordingUploadCleanup', prepared.active, outcome);
    expect(await db.setupRecordingUpload.findUniqueOrThrow({ where: { id: recordingId } })).toMatchObject({ state: 'CLEANED' });
    expect(io).toHaveBeenCalledOnce();
    const unresolved = await journal(false); await resetClaim(); await setRange('recordingUploadCleanup', sourceAt, unresolved.recordingId);
    const page = await selectRecordingCleanupPage(claim, 'recordingUploadCleanup'); assertTracked(page.items);
    expect(await processRecordingCleanupFamily(claim, 'recordingUploadCleanup', io)).toMatchObject({ deleted: 0, deferred: 1 });
    expect(io).toHaveBeenCalledOnce();
  });
  test('preserves newly adopted object while deleting only old committed identity', async () => {
    const visitId = id(), rec = id(), oldAttempt = id(), newAttempt = id();
    visitIds.add(visitId); recordingIds.add(rec); jobIds.add(oldAttempt); jobIds.add(newAttempt);
    const db = getDb();
    await db.consultation.create({ data: { id: visitId, tenantId, locationId, providerId: userId, configurationVersionId: versionId,
      reference: `SYNTHETIC-${nonce}-${visitId}`, idempotencyKey: randomUUID(), isTest: true } });
    const old = objectFor(rec, visitId, oldAttempt), newer = objectFor(rec, visitId, newAttempt);
    await db.recordingSegment.create({ data: { id: rec, tenantId, userId, consultationId: visitId, segmentKey: randomUUID(), sequence: 0,
      blobPath: newer.blobPath, blobObject: newer, mimeType: 'audio/webm', bytes: 2, consentAt: sourceAt, createdAt: sourceAt,
      expiresAt: new Date(Date.now() + 3600000), status: 'UPLOADED' } });
    await db.generationJob.create({ data: { id: oldAttempt, tenantId, userId, consultationId: visitId, kind: 'RECORDING_UPLOAD',
      status: 'CLEANUP_PENDING', idempotencyKey: randomUUID(), model: 'private-vercel-blob', promptVersion: 'private-upload-v2.2', createdAt: sourceAt,
      result: { recordingId: rec, blobPath: old.blobPath, state: 'CLEANUP_PENDING', uploadSettled: true, blobObject: old } } });
    await db.generationJob.create({ data: { id: newAttempt, tenantId, userId, consultationId: visitId, kind: 'RECORDING_UPLOAD',
      status: 'RUNNING', idempotencyKey: randomUUID(), model: 'private-vercel-blob', promptVersion: 'private-upload-v2.2',
      result: { recordingId: rec, blobPath: newer.blobPath, state: 'IN_FLIGHT', uploadSettled: true, blobObject: newer } } });
    await db.$transaction(tx => adoptRecordingUpload(tx, { attemptId: newAttempt, recordingId: rec, tenantId, userId,
      consultationId: visitId, blobPath: newer.blobPath, mimeType: 'audio/webm', blobObject: newer }));
    const preserved = await db.recordingSegment.findUniqueOrThrow({ where: { id: rec } });
    const newJob = await db.generationJob.findUniqueOrThrow({ where: { id: newAttempt } });
    const prepared = await ready('recordingUploadCleanup', sourceAt, oldAttempt, 'UPLOAD_ATTEMPT');
    const io = vi.fn(async (_url: string, _options: { token: string; ifMatch: string; abortSignal: AbortSignal }) => {});
    const result = await tracked(() => deleteRecordingBlob(prepared.object, prepared.remainingMs, io));
    await finishRecordingCleanupItem(claim, 'recordingUploadCleanup', prepared.active, result);
    expect(io.mock.calls[0][0]).toBe(old.objectUrl); expect(io.mock.calls[0][1].ifMatch).toBe(old.etag);
    expect(await db.recordingSegment.findUniqueOrThrow({ where: { id: rec } })).toEqual(preserved);
    expect(await db.generationJob.findUniqueOrThrow({ where: { id: newAttempt } })).toEqual(newJob);
    await expect(db.$transaction(tx => adoptRecordingUpload(tx, { attemptId: oldAttempt, recordingId: rec, tenantId, userId,
      consultationId: visitId, blobPath: old.blobPath, mimeType: 'audio/webm', blobObject: old })))
      .rejects.toMatchObject({ code: 'RECORDING_OBJECT_UNAVAILABLE' });
    expect(io).toHaveBeenCalledOnce();
  });
  test('atomically finishes intent metrics page index and cursor or rolls all back', async () => {
    const object = await journal(); const prepared = await ready('recordingUploadCleanup', sourceAt, object.recordingId);
    const io = vi.fn(async () => {}); const result = await tracked(() => deleteRecordingBlob(prepared.object, prepared.remainingMs, io));
    const db = getDb(), original = db.$transaction.bind(db), sentinel = new Error('Synthetic whole-publication rollback');
    const beforeIntent = await db.recordingDeletionIntent.findUniqueOrThrow({ where: { id: prepared.active.intentId } });
    const beforeCoordinator = await db.maintenanceCoordinator.findUniqueOrThrow({ where: { key: claim.context.key } });
    const beforeJournal = await db.setupRecordingUpload.findUniqueOrThrow({ where: { id: object.recordingId } });
    const spy = vi.spyOn(db, '$transaction').mockImplementationOnce((body, options) => original(async tx => {
      await body(tx); throw sentinel;
    }, options));
    await expect(finishRecordingCleanupItem(claim, 'recordingUploadCleanup', prepared.active, result)).rejects.toBe(sentinel);
    spy.mockRestore();
    expect(await db.recordingDeletionIntent.findUniqueOrThrow({ where: { id: prepared.active.intentId } })).toEqual(beforeIntent);
    expect(await db.maintenanceCoordinator.findUniqueOrThrow({ where: { key: claim.context.key } })).toEqual(beforeCoordinator);
    expect(await db.setupRecordingUpload.findUniqueOrThrow({ where: { id: object.recordingId } })).toEqual(beforeJournal);
    await finishRecordingCleanupItem(claim, 'recordingUploadCleanup', prepared.active, result);
    expect(await db.recordingDeletionIntent.findUniqueOrThrow({ where: { id: prepared.active.intentId } })).toMatchObject({ status: 'DELETED', lastDurationMs: result.durationMs });
    expect(await db.setupRecordingUpload.findUniqueOrThrow({ where: { id: object.recordingId } })).toMatchObject({ state: 'CLEANED' });
    expect((await db.maintenanceCoordinator.findUniqueOrThrow({ where: { key: claim.context.key } })).progress)
      .toMatchObject({ recordingUploadCleanup: { index: 1, deleted: 1, finished: true, active: null } });
    expect(io).toHaveBeenCalledOnce();
    await resetClaim(); const lateObject = await journal(); const late = await ready('recordingUploadCleanup', sourceAt, lateObject.recordingId);
    const current = await db.maintenanceCoordinator.findUniqueOrThrow({ where: { key: claim.context.key } });
    const progress = maintenanceState(maintenanceProgressSchema, current.progress);
    const now = await db.$transaction(tx => recordingDatabaseTime(tx));
    const ended = new Date(now.getTime() - 1);
    progress.recordingUploadCleanup!.cutoff = new Date(ended.getTime() - 20000).toISOString(); progress.recordingUploadCleanup!.deadline = ended.toISOString();
    await db.maintenanceCoordinator.update({ where: { key: claim.context.key }, data: { progress } });
    await expect(finishRecordingCleanupItem(claim, 'recordingUploadCleanup', late.active, { deleted: true, durationMs: 50 }))
      .rejects.toMatchObject({ code: 'RECORDING_CLEANUP_DEADLINE' });
    await deferExpiredRecordingCleanupPage(claim, 'recordingUploadCleanup', 0, late.active);
    expect(await db.recordingDeletionIntent.findUniqueOrThrow({ where: { id: late.active.intentId } }))
      .toMatchObject({ status: 'PENDING', lastError: 'DELETE_TIMEOUT', lastDurationMs: null, executionToken: null });
    expect((await db.maintenanceCoordinator.findUniqueOrThrow({ where: { key: claim.context.key } })).progress)
      .toMatchObject({ recordingUploadCleanup: { index: 1, deleted: 0, deferred: 1, durationMs: 0, finished: true } });
  });
  test('cleans only tracked fixture intents journals and coordinator while preserving controls', async () => {
    const object = await recording(); const result = await commitRecordingDeletion(claim, { identity: object, reason: 'RETENTION' });
    if (result.status !== 'COMMITTED') throw new Error('Expected owned commitment'); intentIds.add(result.intentId);
    const row = await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id: result.intentId } });
    expect(row).toMatchObject({ sourceKind: 'RECORDING', sourceId: object.recordingId, sourceCreatedAt: sourceAt });
    await expect(getDb().$executeRaw`UPDATE "RecordingDeletionIntent" SET "sourceKind" = NULL, "sourceId" = NULL, "sourceCreatedAt" = NULL WHERE "id" = ${row.id}::uuid`).rejects.toThrow('immutable');
    await expect(getDb().recordingDeletionIntent.create({ data: { ...row, id: id() } })).rejects.toMatchObject({ code: 'P2002' });
    const legacyId = id(), legacyObject = objectFor(id()); intentIds.add(legacyId);
    await getDb().recordingDeletionIntent.create({ data: { id: legacyId, tenantId, recordingId: legacyObject.recordingId,
      setupConversationId: conversationId, reason: 'UPLOAD_CLEANUP', blobPath: legacyObject.blobPath,
      objectUrl: legacyObject.objectUrl, storeId: legacyObject.storeId, etag: legacyObject.etag, creatorScope: claim.context.key,
      creatorGeneration: BigInt(claim.generation), creatorOrdinal: BigInt(claim.ordinal), creatorRunId: claim.runId, createdAt: sourceAt } });
    await setRange('recordingUploadCleanup', sourceAt, legacyId, legacyId, 'LEGACY_INTENT');
    const page = await selectRecordingCleanupPage(claim, 'recordingUploadCleanup'); assertTracked(page.items);
    const io = vi.fn(async () => { throw new Error('Legacy provider permission forbidden'); });
    expect(await processRecordingCleanupFamily(claim, 'recordingUploadCleanup', io)).toMatchObject({ checked: 1, deferred: 1, deleted: 0 });
    expect(io).not.toHaveBeenCalled();
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: controlId } })).toEqual(control);
    expect(pending.size).toBe(0); expect(quiescenceBlocked).toBe(false);
  });

  test('attributes duplicate immutable provenance independently of tenant path uniqueness', async () => {
    const db = getDb(), firstId = id(), rejectedId = id(), positiveId = id();
    for (const intentId of [firstId, rejectedId, positiveId]) intentIds.add(intentId);
    const firstRecordingId = id(), secondRecordingId = id(), syntheticConsultationId = id(), syntheticAttemptId = id();
    const firstObject = objectFor(firstRecordingId);
    // Direct nonclinical index fixtures, not adopted source objects or returned provider metadata.
    const original = await db.recordingDeletionIntent.create({ data: {
      id: firstId, tenantId, recordingId: firstRecordingId, consultationId: null,
      setupConversationId: conversationId, uploadAttemptId: null, reason: 'RETENTION',
      blobPath: firstObject.blobPath, objectUrl: firstObject.objectUrl, storeId: firstObject.storeId, etag: firstObject.etag,
      creatorScope: claim.context.key, creatorGeneration: BigInt(claim.generation),
      creatorOrdinal: BigInt(claim.ordinal), creatorRunId: claim.runId, status: 'PENDING',
      sourceKind: 'RECORDING', sourceId: firstRecordingId, sourceCreatedAt: sourceAt, createdAt: sourceAt,
    } });
    // A canonical hypothetical consultation path intentionally does not match this source's setup target.
    // No consultation, upload job or source recording is created, adopted or sent to provider I/O.
    const duplicateObject = objectFor(firstRecordingId, syntheticConsultationId, syntheticAttemptId);
    const duplicate = {
      ...original, id: rejectedId, consultationId: syntheticConsultationId, setupConversationId: null,
      uploadAttemptId: syntheticAttemptId, blobPath: duplicateObject.blobPath, objectUrl: duplicateObject.objectUrl,
      storeId: duplicateObject.storeId, etag: duplicateObject.etag,
    };
    expect(duplicate.id).not.toBe(original.id);
    expect(original.tenantId).toBe(tenantId); expect(duplicate.tenantId).toBe(tenantId);
    expect(duplicate.blobPath).not.toBe(original.blobPath);
    expect([duplicate.tenantId, duplicate.blobPath]).not.toEqual([original.tenantId, original.blobPath]);
    expect([original.reason, original.sourceKind, original.sourceId]).toEqual(['RETENTION', 'RECORDING', firstRecordingId]);
    expect([duplicate.reason, duplicate.sourceKind, duplicate.sourceId])
      .toEqual([original.reason, original.sourceKind, original.sourceId]);
    expect(duplicate.sourceCreatedAt).toEqual(sourceAt);
    expect(original.blobPath).toBe(`private/${tenantId}/setup/${firstRecordingId}`);
    expect(duplicate.blobPath)
      .toBe(`private/${tenantId}/recordings/${syntheticConsultationId}/${firstRecordingId}/${syntheticAttemptId}`);
    expect(original.objectUrl).toBe(`https://${original.storeId}.private.blob.vercel-storage.com/${original.blobPath}`);
    expect(duplicate.objectUrl).toBe(`https://${duplicate.storeId}.private.blob.vercel-storage.com/${duplicate.blobPath}`);
    let failure: unknown;
    try { await db.recordingDeletionIntent.create({ data: duplicate }); }
    catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    if (!(failure instanceof Prisma.PrismaClientKnownRequestError))
      throw new Error('Expected the real provenance uniqueness violation.');
    expect(failure.code).toBe('P2002');
    expect(failure.meta?.target).toEqual(['reason', 'sourceKind', 'sourceId']);
    expect(await db.recordingDeletionIntent.findUnique({ where: { id: rejectedId } })).toBeNull();
    expect(await db.recordingDeletionIntent.findUniqueOrThrow({ where: { id: firstId } })).toEqual(original);

    const positiveObject = objectFor(secondRecordingId, syntheticConsultationId, syntheticAttemptId);
    const positive = {
      ...duplicate, id: positiveId, recordingId: secondRecordingId, sourceId: secondRecordingId,
      blobPath: positiveObject.blobPath, objectUrl: positiveObject.objectUrl,
      storeId: positiveObject.storeId, etag: positiveObject.etag,
    };
    expect([positive.reason, positive.sourceKind]).toEqual([original.reason, original.sourceKind]);
    expect(positive.sourceId).not.toBe(original.sourceId); expect(positive.sourceId).toBe(positive.recordingId);
    expect(positive.sourceCreatedAt).toEqual(original.sourceCreatedAt);
    expect(positive.tenantId).toBe(tenantId); expect(positive.blobPath).not.toBe(original.blobPath);
    expect(positive.blobPath)
      .toBe(`private/${tenantId}/recordings/${syntheticConsultationId}/${secondRecordingId}/${syntheticAttemptId}`);
    expect(positive.objectUrl).toBe(`https://${positive.storeId}.private.blob.vercel-storage.com/${positive.blobPath}`);
    const created = await db.recordingDeletionIntent.create({ data: positive });
    expect(created).toMatchObject({ id: positiveId, tenantId, recordingId: secondRecordingId,
      consultationId: syntheticConsultationId, setupConversationId: null, uploadAttemptId: syntheticAttemptId,
      reason: 'RETENTION', sourceKind: 'RECORDING', sourceId: secondRecordingId, sourceCreatedAt: sourceAt,
      blobPath: positive.blobPath, objectUrl: positive.objectUrl, creatorScope: claim.context.key, status: 'PENDING' });
    expect(await db.recordingDeletionIntent.count({ where: {
      id: { in: [firstId, rejectedId, positiveId] }, creatorScope: claim.context.key,
    } })).toBe(2);
    expect(await db.recordingDeletionIntent.findUnique({ where: { id: rejectedId } })).toBeNull();
    expect(await db.recordingDeletionIntent.findUniqueOrThrow({ where: { id: firstId } })).toEqual(original);
    expect(await db.recordingSegment.findUniqueOrThrow({ where: { id: controlId } })).toEqual(control);
  });
});
