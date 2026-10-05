import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { type RecordingSegment } from '@prisma/client';
import { clinicConfigurationSchema, emptyConsultationSummary } from '@dripwell/shared/v2';
import { getDb } from './db';
import { appendReceivedTranscript } from './clinic';
import { maintenanceContext } from './maintenance-context';
import type { MaintenanceClaim } from './maintenance-coordinator';
import { captureRecordingObject, commitRecordingDeletion, recordingObjectPath, type RecordingObjectIdentity } from './recording-deletion-intents';
import { acknowledgeRecordingStart, claimRecordingStart, failRecordingProcessing, prepareRecordingProcessing,
  publishRecordingProcessing, refreshRecordingSnapshot } from './recording-processing';
import { adoptRecordingUpload, cleanupDiscardedRecordingUploads, cleanupRecordingUploadAttempt } from './recording-uploads';
import { adoptSetupRecording, performSetupRecordingUpload, reserveSetupRecording, settleSetupRecording } from './setup-recording-uploads';
import { processRecordingJob } from '../workflows/recordings';

const provider = vi.hoisted(() => ({ get: vi.fn(), transcribe: vi.fn(), summary: vi.fn(), catalog: vi.fn(), start: vi.fn() }));
vi.mock('@vercel/blob', () => ({ get: provider.get, put: vi.fn(() => { throw new Error('Unexpected Blob put'); }) }));
vi.mock('workflow/api', () => ({ start: provider.start }));
vi.mock('workflow', () => {
  class FatalError extends Error { static is(value: unknown) { return value instanceof FatalError; } }
  class RetryableError extends Error { static is(value: unknown) { return value instanceof RetryableError; } }
  return { FatalError, RetryableError, getWorkflowMetadata: () => ({ workflowRunId: 'unused-synthetic-run' }) };
});
vi.mock('./ai', async importOriginal => ({ ...await importOriginal<typeof import('./ai')>(),
  transcribePrivateAudio: provider.transcribe, extractConsultationSummary: provider.summary,
  lookupGenerationCost: vi.fn(async () => null), estimateTextCost: vi.fn(() => null) }));
vi.mock('ai', async importOriginal => ({ ...await importOriginal<typeof import('ai')>(), generateText: provider.catalog }));

// Guard before getDb/hooks: exactly the existing fresh disposable CI target.
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'localhost'
    || url.port !== '5432' || url.pathname !== '/dripwell_verification' || process.env.DATABASE_URL !== testUrl)
    throw new Error('Recording consumer cases require the explicit disposable CI database.');
}
const suite = testUrl ? describe : describe.skip;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
const transcription = { text: 'Synthetic additional statement.', segments: [], durationSeconds: 1,
  usage: null, costUsd: null, model: 'synthetic-transcription' };
const summary = { summary: emptyConsultationSummary(), evidence: [], usage: {}, costUsd: null, estimatedCostCents: null };
const catalog = { output: { clinicName: null, currency: null, products: [], questions: [], protocolNotes: [],
  missingQuestions: ['Synthetic catalog gap'] }, usage: {}, providerMetadata: {} };
const configuration = clinicConfigurationSchema.parse({ schemaVersion: 2,
  clinic: { name: 'Synthetic consumer safety', currency: 'USD', contact: '', brandColor: '#0d9488' },
  questions: [], products: [], recommendationPolicy: { clinicalValidated: false, maxAddOns: 0, maxWellnessOffers: 0 },
  reminders: { careOutcomeHours: 1, wellnessDecisionHours: 1 }, retention: { audioDays: 1, documentDays: 1, shareExpiryHours: 1 } });

suite('recording consumer safety against disposable PostgreSQL', () => {
  const nonce = randomUUID();
  const tenantId = randomUUID(); const ownerId = randomUUID(); const staffId = randomUUID();
  const locationId = randomUUID(); const versionId = randomUUID(); const conversationId = randomUUID();
  const controlTenantId = randomUUID(); const controlOwnerId = randomUUID(); const controlConversationId = randomUUID();
  const controlRecordingId = randomUUID();
  const recordingIds = new Set<string>(); const visitIds = new Set<string>(); const jobIds = new Set<string>();
  const journalIds = new Set<string>(); const intentIds = new Set<string>();
  const objects = new Map<string, RecordingObjectIdentity>();
  const orphanOwners: Array<{ tenantId: string; userId: string; conversationId: string }> = [];
  let control: RecordingSegment;
  let claim: MaintenanceClaim;

  beforeAll(async () => {
    vi.stubEnv('ALLOW_REAL_CLIENT_DATA', 'false');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_syntheticstore_SYNTHETIC_ONLY');
    vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_DEPLOYMENT_ID', ''); vi.stubEnv('WORKFLOW_TARGET_WORLD', 'local');
    vi.stubEnv('MAINTENANCE_LOCAL_PROJECT', `local-consumer-${nonce}`);
    vi.stubEnv('MAINTENANCE_LOCAL_BRANCH', `synthetic-${nonce}`);
    vi.stubEnv('MAINTENANCE_LOCAL_BUILD_ID', createHash('sha256').update(nonce).digest('hex'));
    vi.stubEnv('MAINTENANCE_LOCAL_INTERVAL_MS', '');
    const context = maintenanceContext();
    claim = { context, generation: '1', ordinal: '0', token: randomUUID(), mode: 'MANUAL',
      dueAt: new Date().toISOString(), runId: `synthetic-${nonce}` };
    const db = getDb();
    for (const id of [tenantId, controlTenantId]) await db.tenant.create({ data: { id,
      slug: `consumer-${id}`, name: 'Synthetic consumer fixture', state: 'TEST', medicalDirector: 'Synthetic only' } });
    for (const [id, tenant, role] of [[ownerId, tenantId, 'SUPER_USER'], [staffId, tenantId, 'STAFF'],
      [controlOwnerId, controlTenantId, 'SUPER_USER']] as const)
      await db.user.create({ data: { id, tenantId: tenant, email: `consumer-${id}@example.invalid`, firstName: 'Synthetic',
        lastName: 'Fixture', role, canApproveClinical: false, mfaEnabled: false, passwordHash: 'unusable-synthetic-only' } });
    await db.location.create({ data: { id: locationId, tenantId, name: 'Synthetic consumer location' } });
    await db.clinicConfigurationVersion.create({ data: { id: versionId, tenantId, userId: ownerId, locationId,
      version: 1, status: 'DRAFT', payload: configuration, source: 'Synthetic processing fixture only' } });
    await db.setupConversation.create({ data: { id: conversationId, tenantId, userId: ownerId, locationId } });
    await db.setupConversation.create({ data: { id: controlConversationId, tenantId: controlTenantId, userId: controlOwnerId } });
    control = await db.recordingSegment.create({ data: { id: controlRecordingId, tenantId: controlTenantId, userId: controlOwnerId,
      setupConversationId: controlConversationId, segmentKey: randomUUID(), sequence: 0, blobPath: 'unrelated-synthetic-control',
      bytes: 1, mimeType: 'audio/webm', consentAt: new Date(), expiresAt: new Date(Date.now() + 86400000) } });
    // Real withMaintenanceClaim checks this derived, nonce-owned coordinator;
    // no native timer, provider deletion, or deployed maintenance is started.
    await db.maintenanceCoordinator.create({ data: { key: context.key, projectId: context.projectId,
      environment: context.environment, branch: context.branch, deploymentId: context.deploymentId, cadenceMs: context.cadenceMs,
      mode: 'MANUAL', enabled: false, phase: 'RUNNING', generation: 1n, ordinal: 0n, claimToken: claim.token, ownerRunId: claim.runId } });
  });
  beforeEach(() => {
    vi.clearAllMocks();
    provider.start.mockImplementation(() => { throw new Error('Unexpected native start'); });
    provider.get.mockImplementation(async (url: string) => {
      const object = objects.get(url); if (!object) throw new Error('Unowned synthetic private read');
      return { statusCode: 200, blob: { url, pathname: object.blobPath, etag: object.etag, size: 2 },
        stream: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1, 2])); controller.close(); } }) };
    });
    provider.transcribe.mockResolvedValue(transcription); provider.summary.mockResolvedValue(summary); provider.catalog.mockResolvedValue(catalog);
  });
  afterAll(async () => {
    const db = getDb();
    try { expect(await db.recordingSegment.findUniqueOrThrow({ where: { id: controlRecordingId } })).toEqual(control); }
    finally {
      // Only rows created by this nonce/its real production calls are eligible.
      const produced = await db.generationJob.findMany({ where: { tenantId }, select: { id: true } });
      for (const row of produced) jobIds.add(row.id);
      await db.recordingDeletionIntent.deleteMany({ where: { id: { in: [...intentIds] } } });
      await db.setupRecordingUpload.deleteMany({ where: { id: { in: [...journalIds] } } });
      for (const orphan of orphanOwners) {
        await db.setupConversation.deleteMany({ where: { id: orphan.conversationId, tenantId: orphan.tenantId } });
        await db.user.deleteMany({ where: { id: orphan.userId, tenantId: orphan.tenantId } });
        await db.tenant.deleteMany({ where: { id: orphan.tenantId } });
      }
      await db.generationJob.deleteMany({ where: { id: { in: [...jobIds] }, tenantId } });
      await db.recordingSegment.deleteMany({ where: { id: { in: [...recordingIds] }, tenantId } });
      await db.consultation.deleteMany({ where: { id: { in: [...visitIds] }, tenantId } });
      await db.clinicConfigurationVersion.deleteMany({ where: { id: versionId, tenantId } });
      await db.setupConversation.deleteMany({ where: { id: conversationId, tenantId } });
      await db.user.deleteMany({ where: { id: { in: [ownerId, staffId] }, tenantId } });
      await db.location.deleteMany({ where: { id: locationId, tenantId } });
      await db.tenant.deleteMany({ where: { id: tenantId } });
      await db.recordingSegment.deleteMany({ where: { id: controlRecordingId, tenantId: controlTenantId } });
      await db.setupConversation.deleteMany({ where: { id: controlConversationId, tenantId: controlTenantId } });
      await db.user.deleteMany({ where: { id: controlOwnerId, tenantId: controlTenantId } });
      await db.tenant.deleteMany({ where: { id: controlTenantId } });
      if (claim) await db.maintenanceCoordinator.deleteMany({ where: { key: claim.context.key } });
      vi.unstubAllEnvs(); await db.$disconnect();
    }
  });

  async function fixture(kind: 'TRANSCRIPTION' | 'SETUP_TRANSCRIPTION' | 'CATALOG_EXTRACTION' = 'TRANSCRIPTION', consultationId?: string) {
    const id = randomUUID(); recordingIds.add(id);
    const consultation = kind === 'TRANSCRIPTION';
    const visit = consultation ? consultationId ?? randomUUID() : null;
    if (visit && !visitIds.has(visit)) {
      visitIds.add(visit);
      await getDb().consultation.create({ data: { id: visit, tenantId, providerId: staffId, locationId,
        configurationVersionId: versionId, reference: `SYNTHETIC-${randomUUID()}`, idempotencyKey: randomUUID(),
        isTest: true, consentAt: new Date(), summary: emptyConsultationSummary() } });
    }
    const attemptId = consultation ? randomUUID() : null;
    const target = { tenantId, recordingId: id, consultationId: visit, setupConversationId: consultation ? null : conversationId,
      uploadAttemptId: attemptId };
    const path = recordingObjectPath(target);
    const object = captureRecordingObject(target, { pathname: path,
      url: `https://syntheticstore.private.blob.vercel-storage.com/${path}`, etag: `"${randomUUID()}"` });
    objects.set(object.objectUrl, object);
    const sequence = visit ? await getDb().recordingSegment.count({ where: { tenantId, consultationId: visit } }) : 0;
    await getDb().recordingSegment.create({ data: { id, tenantId, userId: consultation ? staffId : ownerId,
      consultationId: visit, setupConversationId: target.setupConversationId, segmentKey: randomUUID(), sequence,
      blobPath: path, blobObject: object, mimeType: kind === 'CATALOG_EXTRACTION' ? 'text/plain' : 'audio/webm', bytes: 2,
      consentAt: new Date(Date.now() - 7200000), expiresAt: new Date(Date.now() + 3600000) } });
    if (attemptId) {
      jobIds.add(attemptId);
      await getDb().generationJob.create({ data: { id: attemptId, tenantId, consultationId: visit, userId: staffId,
        kind: 'RECORDING_UPLOAD', status: 'COMPLETE', idempotencyKey: `synthetic-upload:${attemptId}`, model: 'synthetic-storage',
        promptVersion: 'synthetic-only', result: { recordingId: id, blobPath: path, blobObject: object, uploadSettled: true, state: 'ADOPTED' } } });
    }
    const jobId = randomUUID(); const runId = `synthetic-${randomUUID()}`; jobIds.add(jobId);
    await getDb().generationJob.create({ data: { id: jobId, tenantId, consultationId: visit,
      userId: consultation ? staffId : ownerId, kind, status: 'RUNNING', runId,
      model: 'synthetic-provider', promptVersion: 'synthetic-only', idempotencyKey: `synthetic-processing:${jobId}`,
      result: { recordingId: id, recordingObject: object, ...(consultation ? { expectedSummaryRevision: 1 } : { conversationId }) } } });
    return { id, object, jobId, runId, visit };
  }
  async function child(parent: Awaited<ReturnType<typeof fixture>>) {
    const id = randomUUID(); jobIds.add(id);
    return getDb().generationJob.create({ data: { id, tenantId, userId: staffId, consultationId: parent.visit,
      kind: 'SUMMARY', status: 'RUNNING', runId: parent.runId, model: 'synthetic-provider', promptVersion: 'synthetic-only',
      idempotencyKey: `summary:${parent.jobId}` } });
  }
  async function late(effect: typeof provider.transcribe, owned: Awaited<ReturnType<typeof fixture>>, change: () => Promise<unknown>, result: unknown) {
    const entered = deferred(); const release = deferred();
    effect.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return result; });
    const finished = processRecordingJob(owned.jobId, owned.runId).then(() => ({ ok: true }), error => ({ error }));
    try {
      await Promise.race([entered.promise, finished.then(outcome => {
        if ('error' in outcome) throw outcome.error;
        throw new Error('Synthetic processing returned before the selected provider boundary');
      })]);
      await change();
    } finally { release.resolve(); }
    return finished;
  }

  async function failedSummaryAttempt() {
    const owned = await fixture();
    await getDb().generationJob.update({ where: { id: owned.jobId }, data: { status: 'PENDING', runId: null } });
    const first = await claimRecordingStart(owned.jobId); expect(first).not.toBeNull();
    expect(await acknowledgeRecordingStart(owned.jobId, first!.token, owned.runId)).toBe(true);
    provider.summary.mockRejectedValueOnce(new Error('Synthetic summary failure'));
    await expect(processRecordingJob(owned.jobId, owned.runId)).rejects.toThrow();
    const summaryJob = await getDb().generationJob.findUniqueOrThrow({ where: { tenantId_idempotencyKey: {
      tenantId, idempotencyKey: `summary:${owned.jobId}` } } });
    jobIds.add(summaryJob.id);
    const prepared = await prepareRecordingProcessing(owned.jobId, owned.runId); expect(prepared).not.toBeNull();
    await failRecordingProcessing(owned.jobId, owned.runId, 'AI_PROCESSING_FAILED');
    const parent = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } });
    const failedChild = await getDb().generationJob.findUniqueOrThrow({ where: { id: summaryJob.id } });
    expect(parent).toMatchObject({ status: 'FAILED', runId: owned.runId, result: { processingSummaryAttempt: {
      childJobId: summaryJob.id, runId: owned.runId, failure: { errorCode: 'AI_PROCESSING_FAILED' } } } });
    expect(failedChild).toMatchObject({ status: 'FAILED', runId: owned.runId, errorCode: 'AI_PROCESSING_FAILED', completedAt: parent.completedAt });
    return { ...owned, childId: summaryJob.id, firstToken: first!.token,
      oldSnapshot: { ...prepared!.snapshot, childJobId: summaryJob.id } };
  }
  async function resetFailedParent(jobId: string) {
    // The unchanged retry route performs exactly this parent-only transition.
    expect(await getDb().generationJob.updateMany({ where: { id: jobId, tenantId, status: 'FAILED' },
      data: { status: 'PENDING', errorCode: null, runId: null, completedAt: null } })).toEqual({ count: 1 });
  }

  test('recovers the exact failed summary child on a legitimate new attempt without duplicate effects', async () => {
    const owned = await failedSummaryAttempt();
    const transcriptEvents = await getDb().consultationEvent.count({ where: { consultationId: owned.visit!, action: 'TRANSCRIPT_RECEIVED' } });
    expect(transcriptEvents).toBe(1);
    const transcriptRevisions = await getDb().consultationRevision.count({ where: { consultationId: owned.visit!, kind: 'TRANSCRIPT' } });
    expect(transcriptRevisions).toBe(1);
    const transcribeCalls = provider.transcribe.mock.calls.length;
    await resetFailedParent(owned.jobId);
    const claimed = await claimRecordingStart(owned.jobId); expect(claimed).not.toBeNull();
    const newRun = `synthetic-retry-${randomUUID()}`;
    expect(await acknowledgeRecordingStart(owned.jobId, claimed!.token, newRun)).toBe(true);
    const parent = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } });
    const rearmedChild = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.childId } });
    expect(parent).toMatchObject({ status: 'PENDING', runId: newRun });
    expect(rearmedChild).toMatchObject({ status: 'RUNNING', runId: newRun, errorCode: null, completedAt: null });
    const forbidden = vi.fn();
    await expect(publishRecordingProcessing(owned.oldSnapshot, forbidden)).rejects.toMatchObject({ code: 'PROCESSING_JOB_REQUIRED' });
    await failRecordingProcessing(owned.jobId, owned.runId, 'OLD_FAILURE');
    expect(await acknowledgeRecordingStart(owned.jobId, owned.firstToken, 'stale-native-id')).toBe(false);
    expect(await acknowledgeRecordingStart(owned.jobId, claimed!.token, 'duplicate-native-id')).toBe(false);
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } })).toEqual(parent);
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.childId } })).toEqual(rearmedChild);
    expect(forbidden).not.toHaveBeenCalled();
    await processRecordingJob(owned.jobId, newRun);
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } })).toMatchObject({ status: 'COMPLETE', runId: newRun,
      result: { summaryApplied: true, needsReview: true, recordingObject: owned.object } });
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.childId } })).toMatchObject({ status: 'COMPLETE', runId: newRun });
    expect(provider.transcribe.mock.calls.length).toBe(transcribeCalls);
    expect(await getDb().consultationEvent.count({ where: { consultationId: owned.visit!, action: 'TRANSCRIPT_RECEIVED' } })).toBe(transcriptEvents);
    expect(await getDb().consultationRevision.count({ where: { consultationId: owned.visit!, kind: 'TRANSCRIPT' } })).toBe(transcriptRevisions);
    expect(await getDb().consultationEvent.count({ where: { consultationId: owned.visit!, action: 'SUMMARY_PROPOSED' } })).toBe(1);
    expect(await getDb().consultation.findUniqueOrThrow({ where: { id: owned.visit! } })).toMatchObject({ clinicalApprovedVersion: null,
      wellnessApprovedVersion: null, summary: { staffReviewed: false, wellnessOffersAllowed: null } });
    const completed = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } });
    const completedChild = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.childId } });
    const calls = [provider.get.mock.calls.length, provider.summary.mock.calls.length];
    await processRecordingJob(owned.jobId, newRun); await failRecordingProcessing(owned.jobId, owned.runId, 'OLD_FAILURE');
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } })).toEqual(completed);
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.childId } })).toEqual(completedChild);
    expect([provider.get.mock.calls.length, provider.summary.mock.calls.length]).toEqual(calls);
    expect(provider.start).not.toHaveBeenCalled();
  });

  test('denies retry claims for terminal foreign active unproven or changed failed children', async () => {
    for (const mode of ['COMPLETE', 'CANCELLED', 'foreign-user', 'foreign-consultation', 'active', 'newer-run',
      'unproven', 'input', 'expiry', 'detached', 'actor'] as const) {
      const owned = await failedSummaryAttempt(); await resetFailedParent(owned.jobId);
      if (mode === 'COMPLETE' || mode === 'CANCELLED') await getDb().generationJob.update({ where: { id: owned.childId }, data: { status: mode } });
      if (mode === 'foreign-user') await getDb().generationJob.update({ where: { id: owned.childId }, data: { userId: controlOwnerId } });
      if (mode === 'foreign-consultation') {
        const other = await fixture();
        await getDb().generationJob.update({ where: { id: owned.childId }, data: { consultationId: other.visit } });
      }
      if (mode === 'active') await getDb().generationJob.update({ where: { id: owned.childId }, data: { status: 'RUNNING' } });
      if (mode === 'newer-run') await getDb().generationJob.update({ where: { id: owned.childId }, data: { runId: `synthetic-newer-${randomUUID()}` } });
      if (mode === 'unproven') await getDb().generationJob.update({ where: { id: owned.jobId }, data: {
        result: { recordingId: owned.id, recordingObject: owned.object, expectedSummaryRevision: 1 } } });
      if (mode === 'input') await getDb().recordingSegment.update({ where: { id: owned.id }, data: { staffTranscript: 'Later synthetic correction' } });
      if (mode === 'expiry' || mode === 'detached') await getDb().recordingSegment.update({ where: { id: owned.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      if (mode === 'detached') {
        const committed = await commitRecordingDeletion(claim, { identity: owned.object, reason: 'RETENTION' });
        expect(committed.status).toBe('COMMITTED'); if (committed.status === 'COMMITTED') intentIds.add(committed.intentId);
      }
      if (mode === 'actor') await getDb().user.update({ where: { id: staffId }, data: { isActive: false } });
      const parent = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } });
      const currentChild = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.childId } });
      const calls = [provider.get.mock.calls.length, provider.summary.mock.calls.length];
      try {
        await expect(claimRecordingStart(owned.jobId)).rejects.toMatchObject({ code: mode === 'input' ? 'RECORDING_INPUTS_CHANGED'
          : mode === 'expiry' || mode === 'detached' ? 'RECORDING_OBJECT_UNAVAILABLE'
          : mode === 'actor' ? 'PROCESSING_ACCESS_CHANGED' : 'PROCESSING_JOB_REQUIRED' });
        expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } })).toEqual(parent);
        expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.childId } })).toEqual(currentChild);
        expect([provider.get.mock.calls.length, provider.summary.mock.calls.length]).toEqual(calls);
      } finally { if (mode === 'actor') await getDb().user.update({ where: { id: staffId }, data: { isActive: true } }); }
    }
    expect(provider.start).not.toHaveBeenCalled();
  });

  test('rechecks failed child and input authority before the new native acknowledgment can rearm', async () => {
    for (const mode of ['CANCELLED', 'newer-run', 'input', 'child-expiry', 'parent-expiry', 'expiry', 'old-run'] as const) {
      const owned = await failedSummaryAttempt(); await resetFailedParent(owned.jobId);
      const claimed = await claimRecordingStart(owned.jobId); expect(claimed).not.toBeNull();
      if (mode === 'CANCELLED') await getDb().generationJob.update({ where: { id: owned.childId }, data: { status: 'CANCELLED' } });
      if (mode === 'newer-run') await getDb().generationJob.update({ where: { id: owned.childId }, data: { runId: `synthetic-newer-${randomUUID()}` } });
      if (mode === 'input') await getDb().recordingSegment.update({ where: { id: owned.id }, data: { staffTranscript: 'Synthetic correction after native claim' } });
      if (mode === 'child-expiry' || mode === 'parent-expiry') await getDb().generationJob.update({ where: {
        id: mode === 'child-expiry' ? owned.childId : owned.jobId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      if (mode === 'expiry') await getDb().recordingSegment.update({ where: { id: owned.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      const parent = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } });
      const currentChild = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.childId } });
      await expect(acknowledgeRecordingStart(owned.jobId, claimed!.token,
        mode === 'old-run' ? owned.runId : `synthetic-retry-${randomUUID()}`)).rejects.toMatchObject({
          code: mode === 'input' ? 'RECORDING_INPUTS_CHANGED' : mode === 'expiry' ? 'RECORDING_OBJECT_UNAVAILABLE' : 'PROCESSING_JOB_REQUIRED' });
      expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } })).toEqual(parent);
      expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.childId } })).toEqual(currentChild);
    }
    expect(provider.start).not.toHaveBeenCalled();
  });

  test('rejects late consultation transcript after detachment or discard', async () => {
    for (const mode of ['detach', 'discard'] as const) {
      const owned = await fixture();
      const finished = await late(provider.transcribe, owned, async () => {
        if (mode === 'detach') {
          await getDb().recordingSegment.update({ where: { id: owned.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
          const committed = await commitRecordingDeletion(claim, { identity: owned.object, reason: 'RETENTION' });
          expect(committed.status).toBe('COMMITTED'); if (committed.status === 'COMMITTED') intentIds.add(committed.intentId);
        } else await getDb().recordingSegment.update({ where: { id: owned.id }, data: { status: 'DISCARDED' } });
      }, transcription);
      expect(finished).toMatchObject({ error: { message: 'RECORDING_OBJECT_UNAVAILABLE' } });
      expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: owned.id } })).toMatchObject({ transcript: null });
      expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } })).toMatchObject({ status: 'RUNNING', usage: null });
      expect(await getDb().consultationRevision.count({ where: { consultationId: owned.visit! } })).toBe(0);
      expect(provider.summary).not.toHaveBeenCalled();
    }
    const blocked = await fixture();
    await getDb().recordingSegment.update({ where: { id: blocked.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const beforeGet = provider.get.mock.calls.length;
    await expect(processRecordingJob(blocked.jobId, blocked.runId)).rejects.toThrow('RECORDING_OBJECT_UNAVAILABLE');
    expect(provider.get.mock.calls.length).toBe(beforeGet);
  });

  test('rejects late setup transcript and catalog draft after availability or owner change', async () => {
    for (const kind of ['SETUP_TRANSCRIPTION', 'CATALOG_EXTRACTION'] as const) {
      const positive = await fixture(kind); await processRecordingJob(positive.jobId, positive.runId);
      expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: positive.jobId } })).toMatchObject({ status: 'COMPLETE' });
      if (kind === 'CATALOG_EXTRACTION') expect(await getDb().setupConversation.findUniqueOrThrow({ where: { id: conversationId } })).toMatchObject({ draft: catalog.output });
      const owned = await fixture(kind);
      const before = await getDb().setupConversation.findUniqueOrThrow({ where: { id: conversationId } });
      const finished = await late(kind === 'CATALOG_EXTRACTION' ? provider.catalog : provider.transcribe, owned, async () => {
        if (kind === 'SETUP_TRANSCRIPTION') await getDb().recordingSegment.update({ where: { id: owned.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
        else await getDb().user.update({ where: { id: ownerId }, data: { isActive: false } });
      }, kind === 'CATALOG_EXTRACTION' ? { ...catalog, output: { ...catalog.output, clinicName: 'Late forbidden draft' } } : transcription);
      expect(finished).toMatchObject({ error: { message: kind === 'CATALOG_EXTRACTION' ? 'PROCESSING_ACCESS_CHANGED' : 'RECORDING_OBJECT_UNAVAILABLE' } });
      expect(await getDb().setupConversation.findUniqueOrThrow({ where: { id: conversationId } })).toEqual(before);
      expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: owned.id } })).toMatchObject({ transcript: null });
      expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } })).toMatchObject({ status: 'RUNNING', usage: null });
      if (kind === 'CATALOG_EXTRACTION') await getDb().user.update({ where: { id: ownerId }, data: { isActive: true } });
    }
  });

  test('rejects summary result application and completion after input or current-run change', async () => {
    for (const mode of ['correction', 'staff-only', 'add', 'remove', 'expiry', 'child-run', 'child-expiry'] as const) {
      const owned = await fixture(); const other = await fixture('TRANSCRIPTION', owned.visit!);
      await getDb().recordingSegment.update({ where: { id: other.id }, data: { transcript: mode === 'staff-only' ? null : 'Synthetic earlier contributor',
        staffTranscript: mode === 'staff-only' ? 'Synthetic staff-only contributor' : null, status: 'TRANSCRIBED' } });
      const finished = await late(provider.summary, owned, async () => {
        const summaryJob = await getDb().generationJob.findUniqueOrThrow({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: `summary:${owned.jobId}` } } });
        jobIds.add(summaryJob.id);
        if (mode === 'correction' || mode === 'staff-only') await getDb().recordingSegment.update({ where: { id: other.id }, data: { staffTranscript: 'New staff correction' } });
        if (mode === 'add') await fixture('TRANSCRIPTION', owned.visit!);
        if (mode === 'remove') await getDb().recordingSegment.delete({ where: { id: other.id } });
        if (mode === 'expiry') await getDb().recordingSegment.update({ where: { id: other.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
        if (mode === 'child-expiry') await getDb().generationJob.update({ where: { id: summaryJob.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
        if (mode === 'child-run') await getDb().generationJob.update({ where: { id: summaryJob.id }, data: { runId: 'synthetic-new-owner-run' } });
      }, summary);
      expect(finished).toMatchObject({ error: { message: mode === 'child-run' || mode === 'child-expiry' ? 'PROCESSING_JOB_REQUIRED'
        : mode === 'expiry' ? 'RECORDING_OBJECT_UNAVAILABLE' : 'RECORDING_INPUTS_CHANGED' } });
      const summaryJob = await getDb().generationJob.findUniqueOrThrow({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: `summary:${owned.jobId}` } } });
      expect(summaryJob).toMatchObject({ status: 'RUNNING', result: null, usage: null });
      expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } })).toMatchObject({ status: 'RUNNING' });
      expect(await getDb().consultationEvent.count({ where: { consultationId: owned.visit!, action: 'SUMMARY_PROPOSED' } })).toBe(0);
      expect((await getDb().consultation.findUniqueOrThrow({ where: { id: owned.visit! } })).summary).toEqual(emptyConsultationSummary());
    }
  });

  test('prevents stale cancelled parent or child success and failure overwrites', async () => {
    for (const status of ['COMPLETE', 'CANCELLED'] as const) {
      const owned = await fixture(); await child(owned);
      await getDb().generationJob.update({ where: { id: owned.jobId }, data: { status } });
      const before = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } });
      await processRecordingJob(owned.jobId, owned.runId); await failRecordingProcessing(owned.jobId, owned.runId, 'OLD_FAILURE');
      expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } })).toEqual(before);
    }
    const owned = await fixture(); const summaryJob = await child(owned);
    const prepared = await prepareRecordingProcessing(owned.jobId, owned.runId); expect(prepared).not.toBeNull();
    await getDb().generationJob.update({ where: { id: summaryJob.id }, data: { status: 'CANCELLED' } });
    await expect(publishRecordingProcessing({ ...prepared!.snapshot, childJobId: summaryJob.id }, async () => 'forbidden')).rejects.toMatchObject({ code: 'PROCESSING_JOB_REQUIRED' });
    await getDb().generationJob.update({ where: { id: owned.jobId }, data: { runId: 'synthetic-new-run' } });
    const newer = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } });
    await failRecordingProcessing(owned.jobId, owned.runId, 'OLD_FAILURE');
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } })).toEqual(newer);
    const starting = await fixture(); await getDb().generationJob.update({ where: { id: starting.jobId }, data: { status: 'PENDING', runId: null } });
    const token = await claimRecordingStart(starting.jobId); expect(token).not.toBeNull();
    await getDb().generationJob.update({ where: { id: starting.jobId }, data: { status: 'CANCELLED' } });
    expect(await acknowledgeRecordingStart(starting.jobId, token!.token, 'late-native-id')).toBe(false);
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: starting.jobId } })).toMatchObject({ status: 'CANCELLED', runId: null });
    const legacy = await fixture(); await getDb().generationJob.update({ where: { id: legacy.jobId }, data: { status: 'PENDING', runId: null, result: { recordingId: legacy.id } } });
    await expect(claimRecordingStart(legacy.jobId)).rejects.toMatchObject({ code: 'RECORDING_OBJECT_IDENTITY_INVALID' });
    expect(provider.start).not.toHaveBeenCalled(); expect(provider.get).not.toHaveBeenCalled();
  });

  test('rolls back recording transcript usage revisions and events together', async () => {
    const owned = await fixture(); const prepared = await prepareRecordingProcessing(owned.jobId, owned.runId); expect(prepared).not.toBeNull();
    const beforeRecording = await getDb().recordingSegment.findUniqueOrThrow({ where: { id: owned.id } });
    const beforeJob = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } });
    const beforeVisit = await getDb().consultation.findUniqueOrThrow({ where: { id: owned.visit! } });
    await expect(publishRecordingProcessing(prepared!.snapshot, async tx => {
      await tx.recordingSegment.update({ where: { id: owned.id }, data: { transcript: transcription.text } });
      await tx.generationJob.update({ where: { id: owned.jobId }, data: { usage: { synthetic: true } } });
      await appendReceivedTranscript({ tenantId, consultationId: owned.visit!, recordingId: owned.id, jobId: owned.jobId,
        processing: await refreshRecordingSnapshot(tx, prepared!.snapshot) }, tx);
      throw new Error('Synthetic rollback after all transcript writes');
    })).rejects.toThrow('Synthetic rollback after all transcript writes');
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: owned.id } })).toEqual(beforeRecording);
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } })).toEqual(beforeJob);
    expect(await getDb().consultation.findUniqueOrThrow({ where: { id: owned.visit! } })).toEqual(beforeVisit);
    expect(await getDb().consultationRevision.count({ where: { consultationId: owned.visit! } })).toBe(0);
    expect(await getDb().consultationEvent.count({ where: { consultationId: owned.visit! } })).toBe(0);
    await processRecordingJob(owned.jobId, owned.runId);
    const completed = await getDb().generationJob.findUniqueOrThrow({ where: { id: owned.jobId } });
    expect(completed).toMatchObject({ status: 'COMPLETE', result: { summaryApplied: true, needsReview: true, recordingObject: owned.object } });
    const summaryJob = await getDb().generationJob.findUniqueOrThrow({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: `summary:${owned.jobId}` } } });
    expect(summaryJob).toMatchObject({ status: 'COMPLETE', runId: owned.runId, result: { applied: true, recordingInputFingerprint: expect.any(String) } });
    expect(await getDb().consultationEvent.count({ where: { consultationId: owned.visit! } })).toBe(2);
    expect(await getDb().consultation.findUniqueOrThrow({ where: { id: owned.visit! } })).toMatchObject({ clinicalApprovedVersion: null,
      wellnessApprovedVersion: null, summary: { staffReviewed: false, wellnessOffersAllowed: null } });
    expect(provider.start).not.toHaveBeenCalled();
    const cached = await fixture();
    await getDb().recordingSegment.update({ where: { id: cached.id }, data: { transcript: 'Already accepted synthetic text', status: 'TRANSCRIBED' } });
    const cachedPrepared = await prepareRecordingProcessing(cached.jobId, cached.runId); expect(cachedPrepared).not.toBeNull();
    const cachedChild = await child(cached);
    await getDb().generationJob.update({ where: { id: cachedChild.id }, data: {
      result: { ...summary, recordingInputFingerprint: cachedPrepared!.snapshot.inputFingerprint } } });
    const summaryCalls = provider.summary.mock.calls.length;
    await processRecordingJob(cached.jobId, cached.runId);
    expect(provider.summary.mock.calls.length).toBe(summaryCalls);
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: cached.jobId } })).toMatchObject({ status: 'COMPLETE' });
  });

  test('retains exact setup settlement after adoption rollback and preserves unrelated control', async () => {
    for (const rollback of [true, false]) {
      const id = randomUUID(); journalIds.add(id); recordingIds.add(id); const jobId = randomUUID(); jobIds.add(jobId);
      const input = { id, tenantId, userId: ownerId, locationId, setupConversationId: conversationId,
        purpose: 'VOICE' as const, mimeType: 'audio/webm', bytes: 2 };
      const put = vi.fn(async (path: string) => {
        expect(await getDb().setupRecordingUpload.findUniqueOrThrow({ where: { id } })).toMatchObject({ state: 'IN_FLIGHT', uploadSettled: false, blobPath: path });
        expect(await getDb().generationJob.count({ where: { id: jobId } })).toBe(0);
        return { pathname: path, url: `https://syntheticstore.private.blob.vercel-storage.com/${path}`, etag: '"settled-object"' };
      });
      const outcome = performSetupRecordingUpload(input, put, async (tx, journal, object) => {
        expect(await getDb().setupRecordingUpload.findUniqueOrThrow({ where: { id } })).toMatchObject({ uploadSettled: true, blobObject: object });
        const created = await tx.generationJob.create({ data: { id: jobId, tenantId, userId: ownerId, kind: 'SETUP_TRANSCRIPTION',
          model: 'synthetic', promptVersion: 'synthetic-only', idempotencyKey: `synthetic-journal:${id}`,
          result: { recordingId: id, conversationId: journal.setupConversationId, recordingObject: object } } });
        if (rollback) throw new Error('Synthetic setup adoption rollback');
        return created;
      });
      if (rollback) await expect(outcome).rejects.toThrow('Synthetic setup adoption rollback'); else await outcome;
      expect(await getDb().setupRecordingUpload.findUniqueOrThrow({ where: { id } })).toMatchObject({ state: rollback ? 'CLEANUP_PENDING' : 'ADOPTED',
        uploadSettled: true, blobObject: { etag: '"settled-object"', nonOverwrite: true } });
      expect(await getDb().recordingSegment.count({ where: { id } })).toBe(rollback ? 0 : 1);
      expect(await getDb().generationJob.count({ where: { id: jobId } })).toBe(rollback ? 0 : 1);
      expect(put).toHaveBeenCalledTimes(1);
      expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: controlRecordingId } })).toEqual(control);
    }
  });

  test('enforces immutable setup owner and single-assignment settlement with no cascade', async () => {
    const id = randomUUID(); journalIds.add(id);
    const journal = await reserveSetupRecording({ id, tenantId, userId: ownerId, locationId, setupConversationId: conversationId,
      purpose: 'CATALOG', mimeType: 'text/plain', bytes: 2 });
    const object = captureRecordingObject({ tenantId, recordingId: id, consultationId: null, setupConversationId: conversationId, uploadAttemptId: null },
      { pathname: journal.blobPath, url: `https://syntheticstore.private.blob.vercel-storage.com/${journal.blobPath}`, etag: '"single-assignment"' });
    await expect(getDb().$executeRaw`UPDATE "SetupRecordingUpload" SET "tenantId" = ${controlTenantId}::uuid WHERE "id" = ${id}::uuid`).rejects.toThrow();
    await expect(getDb().$executeRaw`UPDATE "SetupRecordingUpload" SET "uploadSettled" = true, "blobObject" = 'null'::jsonb WHERE "id" = ${id}::uuid`).rejects.toThrow();
    await settleSetupRecording(id, object);
    const settled = await getDb().setupRecordingUpload.findUniqueOrThrow({ where: { id } });
    expect(await settleSetupRecording(id, object)).toEqual(settled);
    await expect(settleSetupRecording(id, { ...object, etag: '"replacement"' })).rejects.toMatchObject({ code: 'SETUP_UPLOAD_INTERRUPTED' });
    await expect(getDb().$executeRaw`UPDATE "SetupRecordingUpload" SET "blobObject" = ${JSON.stringify({ ...object, etag: '"replacement"' })}::jsonb WHERE "id" = ${id}::uuid`).rejects.toThrow();
    const ownerTenant = randomUUID(); const ownerUser = randomUUID(); const ownerConversation = randomUUID(); const orphan = randomUUID(); journalIds.add(orphan);
    orphanOwners.push({ tenantId: ownerTenant, userId: ownerUser, conversationId: ownerConversation });
    // Independent ownership survives removal of the exact synthetic owner rows.
    await getDb().tenant.create({ data: { id: ownerTenant, slug: `orphan-${nonce}`, name: 'Synthetic orphan journal', state: 'TEST', medicalDirector: 'Synthetic' } });
    await getDb().user.create({ data: { id: ownerUser, tenantId: ownerTenant, role: 'SUPER_USER', firstName: 'Synthetic', lastName: 'Only',
      email: `orphan-${nonce}@example.invalid`, passwordHash: 'unusable-synthetic' } });
    await getDb().setupConversation.create({ data: { id: ownerConversation, tenantId: ownerTenant, userId: ownerUser } });
    await getDb().setupRecordingUpload.create({ data: { id: orphan, tenantId: ownerTenant, userId: ownerUser, locationId: randomUUID(),
      setupConversationId: ownerConversation, purpose: 'VOICE', mimeType: 'audio/webm', bytes: 1,
      blobPath: `private/${ownerTenant}/setup/${orphan}`, consentAt: new Date(), expiresAt: new Date(Date.now() + 3600000) } });
    const orphanBefore = await getDb().setupRecordingUpload.findUniqueOrThrow({ where: { id: orphan } });
    await getDb().setupConversation.delete({ where: { id: ownerConversation } }); await getDb().user.delete({ where: { id: ownerUser } });
    await getDb().tenant.delete({ where: { id: ownerTenant } });
    expect(await getDb().setupRecordingUpload.findUniqueOrThrow({ where: { id: orphan } })).toEqual(orphanBefore);
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: controlRecordingId } })).toEqual(control);
  });

  test('keeps adoption and tombstone ordering consistent across intake setup and cleanup', async () => {
    const intake = await fixture();
    const del = vi.fn(() => { throw new Error('Dedicated provider deletion is forbidden'); });
    await getDb().recordingSegment.update({ where: { id: intake.id }, data: { status: 'DISCARDED' } });
    expect(await cleanupDiscardedRecordingUploads(intake.id, tenantId, intake.object.blobPath)).toBe(true);
    expect(await cleanupRecordingUploadAttempt(intake.object.uploadAttemptId!, del)).toMatchObject({ pending: true, deleted: false });
    expect(await getDb().generationJob.findUniqueOrThrow({ where: { id: intake.object.uploadAttemptId! } })).toMatchObject({ result: { blobObject: intake.object } });
    expect(del).not.toHaveBeenCalled();
    const setup = await fixture('SETUP_TRANSCRIPTION');
    journalIds.add(setup.id);
    await getDb().setupRecordingUpload.create({ data: { id: setup.id, tenantId, userId: ownerId, locationId, setupConversationId: conversationId,
      purpose: 'VOICE', mimeType: 'audio/webm', bytes: 2, blobPath: setup.object.blobPath,
      consentAt: new Date(Date.now() - 7200000), expiresAt: new Date(Date.now() + 3600000), uploadSettled: true, blobObject: setup.object } });
    await getDb().recordingSegment.update({ where: { id: setup.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const committed = await commitRecordingDeletion(claim, { identity: setup.object, reason: 'RETENTION' });
    expect(committed.status).toBe('COMMITTED'); if (committed.status === 'COMMITTED') intentIds.add(committed.intentId);
    await expect(adoptSetupRecording(setup.id, setup.object, async () => 'forbidden')).rejects.toMatchObject({ code: 'RECORDING_OBJECT_UNAVAILABLE' });
    expect(await getDb().recordingSegment.findUniqueOrThrow({ where: { id: setup.id } })).toMatchObject({ status: 'EXPIRED', blobPath: '', blobObject: null });
    expect(await getDb().setupRecordingUpload.findUniqueOrThrow({ where: { id: setup.id } })).toMatchObject({ state: 'IN_FLIGHT', uploadSettled: true, blobObject: setup.object });
    const accepted = await fixture();
    await getDb().generationJob.update({ where: { id: accepted.object.uploadAttemptId! }, data: { status: 'RUNNING' } });
    await getDb().$transaction(tx => adoptRecordingUpload(tx, { recordingId: accepted.id, tenantId, userId: staffId,
      consultationId: accepted.visit!, attemptId: accepted.object.uploadAttemptId!, blobPath: accepted.object.blobPath,
      blobObject: accepted.object, mimeType: 'audio/webm' }));
    expect(await cleanupRecordingUploadAttempt(accepted.object.uploadAttemptId!, del)).toMatchObject({ pending: false, preserved: true });
    expect(del).not.toHaveBeenCalled();
  });
});
