import { createHash, randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { Prisma, type RecordingSegment } from '@prisma/client';
import { getDb } from './db';
import { ApiError } from './errors';
import { maintenanceContext } from './maintenance-context';
import type { MaintenanceClaim } from './maintenance-coordinator';
import { adoptRecordingUpload, performRecordingUpload } from './recording-uploads';
import { assertRecordingObjectAvailable, captureRecordingObject, claimRecordingDeletion,
  commitRecordingDeletion, finishRecordingDeletion, recordingObjectPath,
  type RecordingObjectIdentity } from './recording-deletion-intents';

// Check selection before getDb/hooks. Only the documented disposable CI target.
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== 'localhost' || url.port !== '5432'
    || url.pathname !== '/dripwell_verification' || process.env.DATABASE_URL !== testUrl)
    throw new Error('Deletion contracts require the explicit disposable verification database.');
}
const suite = testUrl ? describe : describe.skip;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

suite('recording deletion foundation against isolated PostgreSQL', () => {
  const nonce = randomUUID();
  const tenantId = randomUUID();
  const userId = randomUUID();
  const locationId = randomUUID();
  const versionId = randomUUID();
  const conversationId = randomUUID();
  const controlTenant = randomUUID();
  const controlUser = randomUUID();
  const controlConversation = randomUUID();
  const controlRecording = randomUUID();
  const recordingIds = new Set<string>();
  const visitIds = new Set<string>();
  const jobIds = new Set<string>();
  const intentIds = new Set<string>();
  let claim: MaintenanceClaim;
  let control: RecordingSegment;

  beforeAll(async () => {
    vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_DEPLOYMENT_ID', '');
    vi.stubEnv('WORKFLOW_TARGET_WORLD', 'local');
    vi.stubEnv('MAINTENANCE_LOCAL_PROJECT', `local-intents-${nonce}`);
    vi.stubEnv('MAINTENANCE_LOCAL_BRANCH', `synthetic-${nonce}`);
    vi.stubEnv('MAINTENANCE_LOCAL_BUILD_ID', createHash('sha256').update(nonce).digest('hex'));
    vi.stubEnv('MAINTENANCE_LOCAL_INTERVAL_MS', '');
    // This is a derived synthetic server context, not a compiled/native proof.
    const context = maintenanceContext();
    claim = { context, generation: '1', ordinal: '0', token: randomUUID(), mode: 'MANUAL',
      dueAt: new Date().toISOString(), runId: `synthetic-${nonce}` };
    const db = getDb();
    for (const id of [tenantId, controlTenant]) await db.tenant.create({ data: {
      id, slug: `intent-${id}`, name: 'Synthetic deletion fixture', state: 'TEST', medicalDirector: 'Synthetic only',
    } });
    await db.user.create({ data: { id: userId, tenantId, email: `intent-${nonce}@example.invalid`,
      firstName: 'Synthetic', lastName: 'Owner', role: 'SUPER_USER', passwordHash: 'unusable-synthetic-only' } });
    await db.user.create({ data: { id: controlUser, tenantId: controlTenant, email: `intent-control-${nonce}@example.invalid`,
      firstName: 'Synthetic', lastName: 'Control', role: 'SUPER_USER', passwordHash: 'unusable-synthetic-only' } });
    await db.location.create({ data: { id: locationId, tenantId, name: 'Synthetic deletion location' } });
    await db.clinicConfigurationVersion.create({ data: { id: versionId, tenantId, locationId, userId,
      version: 1, status: 'DRAFT', payload: {}, source: 'Unused synthetic recording-parent fixture' } });
    await db.setupConversation.create({ data: { id: conversationId, tenantId, userId, locationId } });
    await db.setupConversation.create({ data: { id: controlConversation, tenantId: controlTenant, userId: controlUser } });
    control = await db.recordingSegment.create({ data: { id: controlRecording, tenantId: controlTenant,
      setupConversationId: controlConversation, userId: controlUser, segmentKey: randomUUID(), sequence: 0,
      blobPath: 'synthetic-unrelated-control', bytes: 1, mimeType: 'audio/webm', consentAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000), status: 'UPLOADED' } });
  });

  async function resetClaim(generation = '1') {
    const context = maintenanceContext();
    claim = { ...claim, context, generation, token: randomUUID(), runId: `synthetic-${randomUUID()}` };
    await getDb().maintenanceCoordinator.upsert({ where: { key: context.key }, create: {
      key: context.key, projectId: context.projectId, environment: context.environment,
      branch: context.branch, deploymentId: context.deploymentId, cadenceMs: context.cadenceMs,
      mode: 'MANUAL', enabled: false, phase: 'RUNNING', generation: BigInt(generation), ordinal: 0n,
      claimToken: claim.token, ownerRunId: claim.runId,
    }, update: { mode: 'MANUAL', enabled: false, phase: 'RUNNING', generation: BigInt(generation),
      ordinal: 0n, claimToken: claim.token, ownerRunId: claim.runId } });
  }
  beforeEach(async () => { await resetClaim(); });
  afterEach(() => { vi.restoreAllMocks(); });
  afterAll(async () => {
    const db = getDb();
    try {
      expect(await db.recordingSegment.findUniqueOrThrow({ where: { id: controlRecording } })).toEqual(control);
    } finally {
      await db.recordingDeletionIntent.deleteMany({ where: { id: { in: [...intentIds] } } });
      await db.generationJob.deleteMany({ where: { id: { in: [...jobIds] } } });
      await db.recordingSegment.deleteMany({ where: { id: { in: [...recordingIds, controlRecording] } } });
      await db.consultation.deleteMany({ where: { id: { in: [...visitIds] } } });
      await db.clinicConfigurationVersion.deleteMany({ where: { id: versionId } });
      await db.setupConversation.deleteMany({ where: { id: { in: [conversationId, controlConversation] } } });
      await db.user.deleteMany({ where: { id: { in: [userId, controlUser] } } });
      await db.location.deleteMany({ where: { id: locationId } });
      await db.tenant.deleteMany({ where: { id: { in: [tenantId, controlTenant] } } });
      if (claim) await db.maintenanceCoordinator.deleteMany({ where: { key: claim.context.key } });
      vi.unstubAllEnvs();
      await db.$disconnect();
    }
  });

  async function fixture(consultation = false, expired = true) {
    const recordingId = randomUUID(); recordingIds.add(recordingId);
    const consultationId = consultation ? randomUUID() : null;
    const attemptId = consultation ? randomUUID() : null;
    if (consultationId) {
      visitIds.add(consultationId);
      await getDb().consultation.create({ data: { id: consultationId, tenantId, locationId,
        providerId: userId, configurationVersionId: versionId, reference: `SYNTHETIC-${randomUUID()}`,
        idempotencyKey: randomUUID(), isTest: true } });
    }
    const target = { tenantId, recordingId, consultationId,
      setupConversationId: consultation ? null : conversationId, uploadAttemptId: attemptId };
    const pathname = recordingObjectPath(target);
    const returned = { pathname, url: `https://syntheticstore.private.blob.vercel-storage.com/${pathname}`, etag: `"${randomUUID()}"` };
    const object = captureRecordingObject(target, returned);
    await getDb().recordingSegment.create({ data: { id: recordingId, tenantId, userId,
      consultationId, setupConversationId: target.setupConversationId, segmentKey: randomUUID(), sequence: 0,
      blobPath: pathname, blobObject: object, mimeType: 'audio/webm', bytes: 1,
      consentAt: new Date(Date.now() - 7200000), createdAt: new Date(Date.now() - 7200000),
      expiresAt: new Date(Date.now() + (expired ? -3600000 : 3600000)), status: 'UPLOADED' } });
    if (attemptId) {
      jobIds.add(attemptId);
      await getDb().generationJob.create({ data: { id: attemptId, tenantId, userId, consultationId,
        kind: 'RECORDING_UPLOAD', status: 'COMPLETE', idempotencyKey: `synthetic-${attemptId}`,
        model: 'private-vercel-blob', promptVersion: 'private-upload-v2.2',
        result: { recordingId, blobPath: pathname, state: 'ADOPTED', uploadSettled: true, blobObject: object } } });
    }
    return { object, returned };
  }
  async function commit(object: RecordingObjectIdentity, reason: 'RETENTION' | 'UPLOAD_CLEANUP' = 'RETENTION') {
    const result = await commitRecordingDeletion(claim, { identity: object, reason });
    if (result.status === 'COMMITTED') intentIds.add(result.intentId);
    return result;
  }
  async function committed(object: RecordingObjectIdentity, reason: 'RETENTION' | 'UPLOAD_CLEANUP' = 'RETENTION') {
    const result = await commit(object, reason);
    if (result.status !== 'COMMITTED') throw new Error('Expected owned synthetic intent');
    return result.intentId;
  }

  test('atomically detaches expired audio without creating an AI job or changing a control', async () => {
    const { object } = await fixture();
    const jobsBefore = await getDb().generationJob.count({ where: { tenantId } });
    const id = await committed(object);
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: object.recordingId } }))
      .toMatchObject({ blobPath: '', blobObject: null, status: 'EXPIRED', transcript: null });
    expect(await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id } }))
      .toMatchObject({ tenantId, etag: object.etag, objectUrl: object.objectUrl, status: 'PENDING', attempts: 0 });
    expect(await getDb().generationJob.count({ where: { tenantId } })).toBe(jobsBefore);
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: controlRecording } })).toEqual(control);
  });

  test('rolls back intent and detachment together after the real transaction body', async () => {
    const { object } = await fixture();
    const db = getDb();
    const original = db.$transaction.bind(db);
    vi.spyOn(db, '$transaction').mockImplementationOnce((body, options) => original(async (tx) => {
      await body(tx);
      throw new Error('Synthetic rollback after detachment');
    }, options));
    await expect(commit(object)).rejects.toThrow('Synthetic rollback after detachment');
    expect(await db.recordingDeletionIntent.findUnique({ where: { tenantId_blobPath: { tenantId, blobPath: object.blobPath } } })).toBeNull();
    expect(await db.recordingSegment.findUniqueOrThrow({ where: { id: object.recordingId } }))
      .toMatchObject({ blobPath: object.blobPath, blobObject: object, status: 'UPLOADED' });
  });

  test('preserves adoption that wins the consultation and recording locks', async () => {
    const { object } = await fixture(true, false);
    await getDb().generationJob.update({ where: { id: object.uploadAttemptId! }, data: { status: 'RUNNING' } });
    const held = deferred(); const release = deferred();
    const adoption = getDb().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${object.consultationId}::uuid FOR UPDATE`;
      await tx.recordingSegment.update({ where: { id: object.recordingId }, data: { status: 'UPLOADED' } });
      held.resolve(); await release.promise;
      await adoptRecordingUpload(tx, { tenantId, recordingId: object.recordingId, userId,
        consultationId: object.consultationId!, attemptId: object.uploadAttemptId!, blobPath: object.blobPath,
        mimeType: 'audio/webm', blobObject: object });
    });
    await held.promise;
    const deletion = commit(object, 'UPLOAD_CLEANUP'); release.resolve();
    await adoption;
    expect(await deletion).toEqual({ status: 'PRESERVED', intentId: null });
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: object.uploadAttemptId! } }))
      .toMatchObject({ status: 'COMPLETE', result: { state: 'ADOPTED', blobObject: object } });
  });

  test('rejects late adoption when the committed tombstone wins', async () => {
    const { object } = await fixture(true);
    await committed(object);
    await getDb().generationJob.update({ where: { id: object.uploadAttemptId! }, data: { status: 'RUNNING' } });
    await expect(getDb().$transaction(async (tx) => {
      await tx.recordingSegment.update({ where: { id: object.recordingId }, data: { status: 'UPLOADED', blobPath: object.blobPath } });
      await adoptRecordingUpload(tx, { tenantId, recordingId: object.recordingId, userId,
        consultationId: object.consultationId!, attemptId: object.uploadAttemptId!, blobPath: object.blobPath,
        mimeType: 'audio/webm', blobObject: object });
    })).rejects.toMatchObject({ code: 'RECORDING_OBJECT_UNAVAILABLE' });
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: object.recordingId } })).toMatchObject({ blobPath: '', status: 'EXPIRED' });
  });

  test('defers unknown settlement and missing identity without clearing the pointer', async () => {
    const { object } = await fixture(true);
    await getDb().generationJob.update({ where: { id: object.uploadAttemptId! }, data: { result: {
      recordingId: object.recordingId, blobPath: object.blobPath, state: 'CLEANUP_PENDING', uploadSettled: false, blobObject: object,
    } } });
    expect((await commit(object)).status).toBe('DEFERRED');
    await getDb().generationJob.update({ where: { id: object.uploadAttemptId! }, data: { result: {
      recordingId: object.recordingId, blobPath: object.blobPath, state: 'CLEANUP_PENDING', uploadSettled: true,
    } } });
    expect((await commit(object)).status).toBe('DEFERRED');
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: object.recordingId } })).toMatchObject({ blobPath: object.blobPath });
  });

  test('commits only the old failed attempt while retaining a newer accepted object', async () => {
    const { object } = await fixture(true);
    const newerTarget = { ...object, uploadAttemptId: randomUUID() };
    const newerPath = recordingObjectPath({ tenantId, recordingId: object.recordingId,
      consultationId: object.consultationId, setupConversationId: null, uploadAttemptId: newerTarget.uploadAttemptId });
    const newer = captureRecordingObject({ tenantId, recordingId: object.recordingId,
      consultationId: object.consultationId, setupConversationId: null, uploadAttemptId: newerTarget.uploadAttemptId },
    { pathname: newerPath, url: `https://syntheticstore.private.blob.vercel-storage.com/${newerPath}`, etag: '"new-object"' });
    await getDb().recordingSegment.update({ where: { id: object.recordingId }, data: { blobPath: newerPath, blobObject: newer } });
    await getDb().generationJob.update({ where: { id: object.uploadAttemptId! }, data: { result: {
      recordingId: object.recordingId, blobPath: object.blobPath, state: 'CLEANUP_PENDING', uploadSettled: true, blobObject: object,
    } } });
    await committed(object, 'UPLOAD_CLEANUP');
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: object.recordingId } })).toMatchObject({ blobPath: newerPath, blobObject: newer });
  });

  test('fences stopped workers and reclaims an old intent under a new accepted generation', async () => {
    const { object } = await fixture(); const id = await committed(object);
    const oldClaim = claim;
    const old = (await claimRecordingDeletion(claim, id))!;
    await getDb().maintenanceCoordinator.update({ where: { key: claim.context.key }, data: {
      phase: 'IDLE', generation: 2n, claimToken: null, ownerRunId: null,
    } });
    await expect(commit(object)).rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    await expect(finishRecordingDeletion(oldClaim, id, old.executionToken!, { deleted: true, durationMs: 1 }))
      .rejects.toMatchObject({ code: 'MAINTENANCE_STALE' });
    expect(await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id } })).toEqual(old);
    await resetClaim('2');
    const current = (await claimRecordingDeletion(claim, id))!;
    expect(current).toMatchObject({ creatorGeneration: 1n, executionGeneration: 2n, attempts: 2, objectUrl: object.objectUrl });
    await expect(finishRecordingDeletion(claim, id, old.executionToken!, { deleted: true, durationMs: 1 }))
      .rejects.toMatchObject({ code: 'RECORDING_OBJECT_UNAVAILABLE' });
    await finishRecordingDeletion(claim, id, current.executionToken!, { deleted: true, durationMs: 1 });
    expect(await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'DELETED', attempts: 2 });
  });

  test('serializes duplicate claims and retries bounded errors on the identical object', async () => {
    const { object } = await fixture(); const id = await committed(object);
    const claims = await Promise.all([claimRecordingDeletion(claim, id), claimRecordingDeletion(claim, id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const first = claims.find((value) => value !== null)!;
    await finishRecordingDeletion(claim, id, first.executionToken!, { deleted: false, error: 'OBJECT_CHANGED', durationMs: 5 });
    const retry = (await claimRecordingDeletion(claim, id))!;
    expect(retry).toMatchObject({ attempts: 2, objectUrl: first.objectUrl, etag: first.etag });
    await finishRecordingDeletion(claim, id, retry.executionToken!, { deleted: false, error: 'DELETE_TIMEOUT', durationMs: 5 });
    expect(await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'PENDING', lastError: 'DELETE_TIMEOUT' });
  });

  test('enforces immutable nullable ownership, object and creator columns in raw PostgreSQL', async () => {
    const { object } = await fixture(); const id = await committed(object);
    const before = await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id } });
    for (const field of ['etag', 'creatorScope', 'creatorRunId']) {
      await expect(getDb().$executeRaw(Prisma.sql`UPDATE "RecordingDeletionIntent" SET ${Prisma.raw('"' + field + '"')} = 'synthetic-changed' WHERE "id" = ${id}::uuid`))
        .rejects.toThrow('identity is immutable');
    }
    const visit = randomUUID(); const attempt = randomUUID();
    const path = `private/${tenantId}/recordings/${visit}/${object.recordingId}/${attempt}`;
    await expect(getDb().$executeRaw`UPDATE "RecordingDeletionIntent" SET "consultationId" = ${visit}::uuid,
      "setupConversationId" = NULL, "uploadAttemptId" = ${attempt}::uuid, "blobPath" = ${path},
      "objectUrl" = ${'https://syntheticstore.private.blob.vercel-storage.com/' + path} WHERE "id" = ${id}::uuid`)
      .rejects.toThrow('identity is immutable');
    expect(await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id } })).toEqual(before);
  });

  test('retains a unique tombstone after source-owner deletion and rejects invalid SQL state', async () => {
    const { object } = await fixture(); const id = await committed(object);
    const row = await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id } });
    await expect(getDb().recordingDeletionIntent.create({ data: { ...row, id: randomUUID() } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(getDb().$executeRaw`UPDATE "RecordingDeletionIntent" SET "status" = 'DELETED' WHERE "id" = ${id}::uuid`).rejects.toThrow();
    await getDb().recordingSegment.delete({ where: { id: object.recordingId } });
    expect(await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id } })).toEqual(row);
    // A separate own tenant with only setup parents can cascade safely here.
    const survivorTenant = randomUUID(); const setup = randomUUID(); const survivorUser = randomUUID();
    await getDb().tenant.create({ data: { id: survivorTenant, slug: `intent-${survivorTenant}`, name: 'Synthetic disappearing source', state: 'TEST', medicalDirector: 'Synthetic' } });
    try {
      await getDb().user.create({ data: { id: survivorUser, tenantId: survivorTenant,
        email: `intent-survivor-${survivorTenant}@example.invalid`, firstName: 'Synthetic', lastName: 'Owner',
        role: 'SUPER_USER', passwordHash: 'unusable-synthetic-only' } });
      await getDb().setupConversation.create({ data: { id: setup, tenantId: survivorTenant, userId: survivorUser } });
      const rec = randomUUID();
      const target = { tenantId: survivorTenant, recordingId: rec, consultationId: null, setupConversationId: setup, uploadAttemptId: null };
      const pathname = recordingObjectPath(target);
      const other = captureRecordingObject(target, { pathname, url: `https://syntheticstore.private.blob.vercel-storage.com/${pathname}`, etag: '"survives"' });
      await getDb().recordingSegment.create({ data: { id: rec, tenantId: survivorTenant, setupConversationId: setup,
        userId: survivorUser, segmentKey: randomUUID(), sequence: 0, blobPath: pathname, blobObject: other, mimeType: 'audio/webm', bytes: 1,
        consentAt: new Date(Date.now() - 7200000), createdAt: new Date(Date.now() - 7200000), expiresAt: new Date(Date.now() - 3600000) } });
      const survivor = await committed(other);
      await getDb().tenant.delete({ where: { id: survivorTenant } });
      expect(await getDb().recordingDeletionIntent.findUniqueOrThrow({ where: { id: survivor } })).toMatchObject({ tenantId: survivorTenant, blobPath: pathname });
      expect(await claimRecordingDeletion(claim, survivor)).toMatchObject({ status: 'IN_FLIGHT', objectUrl: other.objectUrl });
    } finally { await getDb().tenant.deleteMany({ where: { id: survivorTenant } }); }
  });

  test('checks live identity and rejects foreign ownership and detached reads', async () => {
    const { object } = await fixture(false, false);
    await getDb().$transaction((tx) => assertRecordingObjectAvailable(tx, object));
    const wrong = { ...object, tenantId: controlTenant };
    const foreignPath = recordingObjectPath({
      tenantId: wrong.tenantId, recordingId: wrong.recordingId,
      consultationId: wrong.consultationId, setupConversationId: wrong.setupConversationId,
      uploadAttemptId: wrong.uploadAttemptId,
    });
    await expect(commit({ ...wrong, blobPath: foreignPath, objectUrl: `https://syntheticstore.private.blob.vercel-storage.com/${foreignPath}` }))
      .rejects.toMatchObject({ code: 'RECORDING_OBJECT_IDENTITY_INVALID' });
    await getDb().recordingSegment.update({ where: { id: object.recordingId }, data: { expiresAt: new Date(Date.now() - 1) } });
    await committed(object);
    await expect(getDb().$transaction((tx) => assertRecordingObjectAvailable(tx, object))).rejects.toMatchObject({ code: 'RECORDING_OBJECT_UNAVAILABLE' });
  });

  test('retains exact returned metadata when adoption fails and cleanup remains pending', async () => {
    const { object, returned } = await fixture(true, false);
    await getDb().generationJob.delete({ where: { id: object.uploadAttemptId! } });
    await getDb().recordingSegment.update({ where: { id: object.recordingId }, data: { status: 'UPLOADING', blobObject: Prisma.DbNull } });
    const wrongTarget = { tenantId, recordingId: object.recordingId, consultationId: randomUUID(),
      setupConversationId: null, uploadAttemptId: randomUUID() };
    const notUploaded = vi.fn(async () => returned);
    await expect(performRecordingUpload({ tenantId, recordingId: object.recordingId, userId,
      consultationId: wrongTarget.consultationId, attemptId: wrongTarget.uploadAttemptId,
      blobPath: recordingObjectPath(wrongTarget), mimeType: 'audio/webm' },
    new File(['x'], 'synthetic.webm', { type: 'audio/webm' }), async () => null,
    { putFile: notUploaded, deleteFile: vi.fn(async () => undefined) })).rejects.toMatchObject({ code: 'RECORDING_UPLOAD_INTERRUPTED' });
    expect(notUploaded).not.toHaveBeenCalled();
    expect(await getDb().generationJob.findUnique({ where: { id: wrongTarget.uploadAttemptId } })).toBeNull();
    const original = new ApiError(409, 'Synthetic interrupted adoption', 'RECORDING_UPLOAD_INTERRUPTED');
    const deletion = vi.fn(async () => { throw new Error('Synthetic delete unavailable'); });
    await expect(performRecordingUpload({ tenantId, recordingId: object.recordingId, userId,
      consultationId: object.consultationId!, attemptId: object.uploadAttemptId!, blobPath: object.blobPath,
      mimeType: 'audio/webm' }, new File(['x'], 'synthetic.webm', { type: 'audio/webm' }),
    async () => { throw original; }, { putFile: async () => returned, deleteFile: deletion })).rejects.toBe(original);
    expect(deletion).toHaveBeenCalledWith(object.blobPath);
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: object.uploadAttemptId! } }))
      .toMatchObject({ status: 'CLEANUP_PENDING', result: { uploadSettled: true, blobObject: object } });
  });
});
