import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type GenerationJob, type RecordingSegment } from '@prisma/client';
import { z } from 'zod';
import { getDb } from './db';
import { ApiError } from './errors';
import { assertRecordingObjectAvailable, parseRecordingObjectIdentity, recordingDatabaseTime,
  recordingObjectIdentitySchema, sameRecordingObject, type RecordingObjectIdentity } from './recording-deletion-intents';

type Tx = Prisma.TransactionClient;
const summaryAttemptSchema = z.object({ childJobId: z.string().uuid(), runId: z.string().min(1),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/), expectedSummaryRevision: z.number().int().nonnegative(),
  failure: z.object({ errorCode: z.string().min(1), completedAt: z.string().datetime() }).strict().optional() }).strict();
const payloadSchema = z.object({ recordingId: z.string().uuid(),
  recordingObject: recordingObjectIdentitySchema, conversationId: z.string().uuid().optional(),
  expectedSummaryRevision: z.number().int().nonnegative().optional(), processingStartToken: z.string().uuid().optional(),
  processingSummaryAttempt: summaryAttemptSchema.optional() });
const kinds = ['TRANSCRIPTION', 'SETUP_TRANSCRIPTION', 'CATALOG_EXTRACTION'];
const active = ['PENDING', 'RUNNING'];

export interface RecordingProcessingSnapshot {
  jobId: string;
  runId: string;
  userId: string;
  kind: string;
  object: RecordingObjectIdentity;
  expectedSummaryRevision?: number;
  childJobId?: string;
  inputFingerprint: string;
}

function denied(code = 'PROCESSING_JOB_REQUIRED'): never {
  throw new ApiError(409, 'Recording processing is no longer current.', code);
}
export function recordingInputFingerprint(rows: RecordingSegment[]): string {
  // Includes membership and staff corrections, not just the newest segment.
  return createHash('sha256').update(JSON.stringify([...rows].sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => ({ id: r.id, tenantId: r.tenantId, userId: r.userId,
      consultationId: r.consultationId, setupConversationId: r.setupConversationId,
      sequence: r.sequence, status: r.status, blobObject: r.blobObject, blobPath: r.blobPath,
      bytes: r.bytes, mimeType: r.mimeType, transcript: r.transcript, staffTranscript: r.staffTranscript,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(), consentAt: r.consentAt.toISOString() })))).digest('hex');
}

export async function recordingProcessingTransaction<T>(body: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().$transaction(body, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 2000, timeout: 10_000 });
}

async function lockInputs(tx: Tx, object: RecordingObjectIdentity, jobIds: string[], summaryParentId?: string) {
  if (object.consultationId) {
    await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${object.consultationId}::uuid AND "tenantId" = ${object.tenantId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "consultationId" = ${object.consultationId}::uuid AND "tenantId" = ${object.tenantId}::uuid ORDER BY "id" FOR UPDATE`;
  } else {
    await tx.$queryRaw`SELECT "id" FROM "SetupConversation" WHERE "id" = ${object.setupConversationId}::uuid AND "tenantId" = ${object.tenantId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "id" = ${object.recordingId}::uuid AND "tenantId" = ${object.tenantId}::uuid FOR UPDATE`;
  }
  const rows = await inputRows(tx, object);
  const ids = new Set(jobIds);
  if (summaryParentId) {
    const child = await tx.generationJob.findUnique({ where: { tenantId_idempotencyKey: {
      tenantId: object.tenantId, idempotencyKey: `summary:${summaryParentId}` } } });
    if (child) ids.add(child.id);
  }
  for (const row of rows) {
    const value = recordingObjectIdentitySchema.safeParse(row.blobObject);
    if (value.success && value.data.uploadAttemptId) ids.add(value.data.uploadAttemptId);
  }
  if (object.uploadAttemptId) ids.add(object.uploadAttemptId);
  if (ids.size) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "GenerationJob" WHERE "tenantId" = ${object.tenantId}::uuid AND "id" IN (${Prisma.join([...ids].sort().map(id => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR UPDATE`);
  return rows;
}

async function inputRows(tx: Tx, object: RecordingObjectIdentity) {
  return tx.recordingSegment.findMany({ where: object.consultationId
    ? { tenantId: object.tenantId, consultationId: object.consultationId }
    : { tenantId: object.tenantId, id: object.recordingId }, orderBy: { id: 'asc' } });
}

async function authority(tx: Tx, job: GenerationJob, object: RecordingObjectIdentity) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${job.userId}::uuid AND "tenantId" = ${job.tenantId}::uuid FOR SHARE`;
  const user = await tx.user.findFirst({ where: { id: job.userId, tenantId: job.tenantId, isActive: true }, include: { tenant: true } });
  if (!user?.tenant.isActive) denied('PROCESSING_ACCESS_CHANGED');
  const recording = await tx.recordingSegment.findFirst({ where: { id: object.recordingId, tenantId: object.tenantId } });
  if (!recording || recording.userId !== user.id) denied();
  if (object.consultationId) {
    const payload = payloadSchema.safeParse(job.result);
    if (!payload.success || payload.data.expectedSummaryRevision === undefined) denied('SUMMARY_SNAPSHOT_REQUIRED');
    if (job.kind !== 'TRANSCRIPTION' || job.consultationId !== object.consultationId
      || !['SUPER_USER', 'STAFF'].includes(user.role)) denied();
    const visit = await tx.consultation.findFirst({ where: { id: object.consultationId, tenantId: object.tenantId } });
    if (!visit || visit.archivedAt || !visit.consentAt || visit.consentDeclined
      || (user.role === 'STAFF' && visit.providerId !== user.id)) denied('PROCESSING_ACCESS_CHANGED');
    if (process.env.ALLOW_REAL_CLIENT_DATA !== 'true' && !visit.isTest) denied('REAL_CLIENT_DATA_DISABLED');
    if (!await tx.location.findFirst({ where: { id: visit.locationId, tenantId: object.tenantId, isActive: true } })) denied('PROCESSING_ACCESS_CHANGED');
  } else {
    const payload = payloadSchema.safeParse(job.result);
    if (user.role !== 'SUPER_USER' || !['SETUP_TRANSCRIPTION', 'CATALOG_EXTRACTION'].includes(job.kind)
      || job.consultationId !== null || !payload.success
      || payload.data.conversationId !== object.setupConversationId) denied('PROCESSING_ACCESS_CHANGED');
    const conversation = await tx.setupConversation.findFirst({ where: { id: object.setupConversationId!, tenantId: object.tenantId,
      userId: job.userId, locationId: { not: null }, location: { is: { tenantId: object.tenantId, isActive: true } } } });
    if (!conversation) denied('SETUP_LOCATION_BINDING_REQUIRED');
  }
}

async function currentJob(tx: Tx, snapshot: RecordingProcessingSnapshot) {
  const job = await tx.generationJob.findUnique({ where: { id: snapshot.jobId } });
  const payload = payloadSchema.safeParse(job?.result);
  if (!job || !active.includes(job.status) || job.runId !== snapshot.runId || !snapshot.runId
    || job.tenantId !== snapshot.object.tenantId || job.userId !== snapshot.userId || job.kind !== snapshot.kind
    || !kinds.includes(job.kind) || !payload.success || payload.data.recordingId !== snapshot.object.recordingId
    || !sameRecordingObject(payload.data.recordingObject, snapshot.object)
    || payload.data.expectedSummaryRevision !== snapshot.expectedSummaryRevision) denied();
  await authority(tx, job, snapshot.object);
  if (snapshot.childJobId) {
    const child = await tx.generationJob.findUnique({ where: { id: snapshot.childJobId } });
    if (!child || child.kind !== 'SUMMARY' || !active.includes(child.status) || child.runId !== snapshot.runId
      || child.userId !== job.userId || child.tenantId !== job.tenantId || child.consultationId !== job.consultationId
      || child.idempotencyKey !== `summary:${job.id}`) denied();
  }
  return job;
}

/** All contributing audio identities are locked in id order before any job. */
export async function assertRecordingProcessing(tx: Tx, snapshot: RecordingProcessingSnapshot) {
  const object = parseRecordingObjectIdentity(snapshot.object);
  const rows = await lockInputs(tx, object, [snapshot.jobId, ...(snapshot.childJobId ? [snapshot.childJobId] : [])]);
  const job = await currentJob(tx, snapshot);
  const now = await recordingDatabaseTime(tx);
  if (job.expiresAt && job.expiresAt <= now) denied();
  if (snapshot.childJobId) {
    const child = await tx.generationJob.findUniqueOrThrow({ where: { id: snapshot.childJobId } });
    if (child.expiresAt && child.expiresAt <= now) denied();
  }
  await assertRecordingObjectAvailable(tx, object, now);
  for (const row of rows) {
    if (row.id !== object.recordingId && (row.transcript !== null || row.staffTranscript !== null) && row.status !== 'DISCARDED') {
      await assertRecordingObjectAvailable(tx, parseRecordingObjectIdentity(row.blobObject), now);
    }
  }
  if (recordingInputFingerprint(rows) !== snapshot.inputFingerprint) denied('RECORDING_INPUTS_CHANGED');
  const publicationTime = await recordingDatabaseTime(tx);
  if (rows.some(row => (row.id === object.recordingId || ((row.transcript !== null || row.staffTranscript !== null) && row.status !== 'DISCARDED'))
    && row.expiresAt <= publicationTime)) denied('RECORDING_OBJECT_UNAVAILABLE');
  return { job, rows, now: publicationTime };
}

/** The guard and every resulting write share one real transaction. */
export async function publishRecordingProcessing<T>(snapshot: RecordingProcessingSnapshot,
  body: (tx: Tx, current: Awaited<ReturnType<typeof assertRecordingProcessing>>) => Promise<T>) {
  return recordingProcessingTransaction(async tx => {
    const current = await assertRecordingProcessing(tx, snapshot);
    const result = await body(tx, current);
    // Do not let a long body cross expiry using a frozen transaction-start time.
    // All owner/input/job locks remain held; permitted content/status writes can
    // change the fingerprint, but not replace the originally authorized object.
    await authority(tx, current.job, snapshot.object);
    const rows = await inputRows(tx, snapshot.object);
    const now = await recordingDatabaseTime(tx);
    const finalJob = await tx.generationJob.findUniqueOrThrow({ where: { id: snapshot.jobId } });
    const finalPayload = payloadSchema.safeParse(finalJob.result);
    if (finalJob.runId !== snapshot.runId || ![...active, 'COMPLETE'].includes(finalJob.status)
      || !finalPayload.success || !sameRecordingObject(finalPayload.data.recordingObject, snapshot.object)
      || (finalJob.expiresAt && finalJob.expiresAt <= now)) denied();
    if (snapshot.childJobId) {
      const child = await tx.generationJob.findUniqueOrThrow({ where: { id: snapshot.childJobId } });
      if (child.runId !== snapshot.runId || ![...active, 'COMPLETE'].includes(child.status)
        || (child.expiresAt && child.expiresAt <= now)) denied();
    }
    await assertRecordingObjectAvailable(tx, snapshot.object, now);
    for (const row of rows) if (row.id !== snapshot.object.recordingId && (row.transcript !== null || row.staffTranscript !== null) && row.status !== 'DISCARDED')
      await assertRecordingObjectAvailable(tx, parseRecordingObjectIdentity(row.blobObject), now);
    return result;
  });
}

/** Refresh only after authorized writes in this same locked transaction. */
export async function refreshRecordingSnapshot(tx: Tx, snapshot: RecordingProcessingSnapshot, childJobId = snapshot.childJobId) {
  return { ...snapshot, childJobId, inputFingerprint: recordingInputFingerprint(await inputRows(tx, snapshot.object)) };
}

export async function prepareRecordingProcessing(jobId: string, runId: string) {
  return recordingProcessingTransaction(async tx => {
    const initial = await tx.generationJob.findUnique({ where: { id: jobId } });
    if (!initial || ['COMPLETE', 'COMPLETED', 'CANCELLED', 'FAILED'].includes(initial.status)) return null;
    if (!initial.runId) denied('JOB_STARTING');
    if (initial.runId !== runId) return null;
    const payload = payloadSchema.safeParse(initial.result);
    if (!payload.success) denied('RECORDING_OBJECT_IDENTITY_INVALID'); // legacy: never resolve a replacement pointer
    const object = payload.data.recordingObject;
    const rows = await lockInputs(tx, object, [jobId]);
    const snapshot: RecordingProcessingSnapshot = { jobId, runId, userId: initial.userId, kind: initial.kind,
      object, expectedSummaryRevision: payload.data.expectedSummaryRevision, inputFingerprint: recordingInputFingerprint(rows) };
    const current = await assertRecordingProcessing(tx, snapshot);
    const job = await tx.generationJob.update({ where: { id: jobId }, data: { status: 'RUNNING', startedAt: current.job.startedAt ?? current.now } });
    const recording = current.rows.find(row => row.id === object.recordingId);
    if (!recording) denied();
    return { snapshot, job, recording, payload: payload.data };
  });
}

export async function failRecordingProcessing(jobId: string, runId: string, code: string) {
  await recordingProcessingTransaction(async tx => {
    const initial = await tx.generationJob.findUnique({ where: { id: jobId } });
    const payload = payloadSchema.safeParse(initial?.result);
    if (!initial || !payload.success || initial.runId !== runId || !active.includes(initial.status)) return;
    const child = await tx.generationJob.findUnique({ where: { tenantId_idempotencyKey: { tenantId: initial.tenantId, idempotencyKey: `summary:${jobId}` } } });
    await lockInputs(tx, payload.data.recordingObject, [jobId, ...(child ? [child.id] : [])]);
    const current = await tx.generationJob.findUniqueOrThrow({ where: { id: jobId } });
    const fresh = payloadSchema.safeParse(current.result);
    if (current.runId !== runId || !active.includes(current.status) || current.kind !== initial.kind
      || current.userId !== initial.userId || current.tenantId !== initial.tenantId
      || current.consultationId !== initial.consultationId || !fresh.success
      || !sameRecordingObject(fresh.data.recordingObject, payload.data.recordingObject)) return;
    await authority(tx, current, payload.data.recordingObject);
    const now = await recordingDatabaseTime(tx);
    const attempt = fresh.data.processingSummaryAttempt;
    const failedChild = child ? await tx.generationJob.updateMany({ where: { id: child.id, tenantId: current.tenantId, userId: current.userId,
      consultationId: current.consultationId, kind: 'SUMMARY', runId, status: { in: active }, idempotencyKey: `summary:${jobId}` },
      data: { status: 'FAILED', errorCode: code, completedAt: now } }) : null;
    // Only this locked, matching failure can authorize a later child rearm.
    const { processingSummaryAttempt: _previousAttempt, ...result } = fresh.data;
    await tx.generationJob.updateMany({ where: { id: jobId, runId, status: { in: active } }, data: {
      status: 'FAILED', errorCode: code, completedAt: now, result: { ...result,
        ...(failedChild?.count === 1 && attempt && child && attempt.childJobId === child.id && attempt.runId === runId
          && attempt.expectedSummaryRevision === fresh.data.expectedSummaryRevision
          ? { processingSummaryAttempt: { ...attempt, failure: { errorCode: code, completedAt: now.toISOString() } } } : {}) },
    } });
  });
}

async function summaryChild(tx: Tx, job: GenerationJob) {
  return tx.generationJob.findUnique({ where: { tenantId_idempotencyKey: {
    tenantId: job.tenantId, idempotencyKey: `summary:${job.id}` } } });
}

async function assertRecordingStart(tx: Tx, job: GenerationJob, payload: z.infer<typeof payloadSchema>,
  rows: RecordingSegment[], child: GenerationJob | null) {
  await authority(tx, job, payload.recordingObject);
  const now = await recordingDatabaseTime(tx);
  await assertRecordingObjectAvailable(tx, payload.recordingObject, now);
  for (const row of rows) if (row.id !== payload.recordingId && (row.transcript !== null || row.staffTranscript !== null) && row.status !== 'DISCARDED')
    await assertRecordingObjectAvailable(tx, parseRecordingObjectIdentity(row.blobObject), now);
  const attempt = payload.processingSummaryAttempt;
  if (child) {
    if (job.kind !== 'TRANSCRIPTION' || child.kind !== 'SUMMARY' || child.status !== 'FAILED'
      || child.tenantId !== job.tenantId || child.userId !== job.userId || child.consultationId !== job.consultationId
      || child.idempotencyKey !== `summary:${job.id}` || !attempt?.failure || attempt.childJobId !== child.id
      || attempt.expectedSummaryRevision !== payload.expectedSummaryRevision
      || child.runId !== attempt.runId || child.errorCode !== attempt.failure.errorCode
      || child.completedAt?.toISOString() !== attempt.failure.completedAt) denied();
    if (recordingInputFingerprint(rows) !== attempt.inputFingerprint) denied('RECORDING_INPUTS_CHANGED');
  } else if (attempt) denied();
  const currentTime = await recordingDatabaseTime(tx);
  if ((job.expiresAt && job.expiresAt <= currentTime) || (child?.expiresAt && child.expiresAt <= currentTime)) denied();
  if (rows.some(row => (row.id === payload.recordingId || ((row.transcript !== null || row.staffTranscript !== null) && row.status !== 'DISCARDED'))
    && row.expiresAt <= currentTime)) denied('RECORDING_OBJECT_UNAVAILABLE');
  return currentTime;
}

export async function claimRecordingStart(jobId: string) {
  return recordingProcessingTransaction(async tx => {
    const initial = await tx.generationJob.findUnique({ where: { id: jobId } });
    if (!initial || initial.status !== 'PENDING' || initial.runId !== null) return null;
    const payload = payloadSchema.safeParse(initial.result);
    if (!payload.success) denied('RECORDING_OBJECT_IDENTITY_INVALID');
    const object = payload.data.recordingObject;
    const rows = await lockInputs(tx, object, [jobId], jobId);
    const job = await tx.generationJob.findUniqueOrThrow({ where: { id: jobId } });
    if (job.status !== 'PENDING' || job.runId !== null) return null;
    const fresh = payloadSchema.safeParse(job.result);
    if (!fresh.success || !sameRecordingObject(fresh.data.recordingObject, object)
      || fresh.data.expectedSummaryRevision !== payload.data.expectedSummaryRevision || job.kind !== initial.kind
      || job.userId !== initial.userId || job.tenantId !== initial.tenantId || job.consultationId !== initial.consultationId) denied();
    await assertRecordingStart(tx, job, fresh.data, rows, await summaryChild(tx, job));
    const token = randomUUID();
    await tx.generationJob.update({ where: { id: jobId }, data: { status: 'QUEUING', result: { ...fresh.data, processingStartToken: token } } });
    return { object, token, userId: job.userId, kind: job.kind };
  });
}

export async function acknowledgeRecordingStart(jobId: string, token: string, runId: string | null, errorCode?: string) {
  return recordingProcessingTransaction(async tx => {
    const initial = await tx.generationJob.findUnique({ where: { id: jobId } });
    const payload = payloadSchema.safeParse(initial?.result);
    if (!initial || !payload.success || payload.data.processingStartToken !== token) return false;
    const rows = await lockInputs(tx, payload.data.recordingObject, [jobId], jobId);
    const job = await tx.generationJob.findUniqueOrThrow({ where: { id: jobId } });
    const fresh = payloadSchema.safeParse(job.result);
    if (job.status !== 'QUEUING' || job.runId !== null || !fresh.success || fresh.data.processingStartToken !== token
      || !sameRecordingObject(fresh.data.recordingObject, payload.data.recordingObject)
      || fresh.data.expectedSummaryRevision !== payload.data.expectedSummaryRevision
      || JSON.stringify(fresh.data.processingSummaryAttempt) !== JSON.stringify(payload.data.processingSummaryAttempt)
      || job.userId !== initial.userId || job.kind !== initial.kind || job.tenantId !== initial.tenantId
      || job.consultationId !== initial.consultationId) return false;
    const currentChild = await summaryChild(tx, job);
    const now = await assertRecordingStart(tx, job, fresh.data, rows, currentChild);
    if (runId && currentChild) {
      const attempt = fresh.data.processingSummaryAttempt!;
      if (runId === attempt.runId) denied();
      const rearmed = await tx.generationJob.updateMany({ where: { id: currentChild.id, tenantId: job.tenantId,
        userId: job.userId, consultationId: job.consultationId, kind: 'SUMMARY', status: 'FAILED', runId: attempt.runId,
        idempotencyKey: `summary:${jobId}`, errorCode: attempt.failure!.errorCode, completedAt: currentChild.completedAt },
        data: { runId, status: 'RUNNING', startedAt: now, completedAt: null, errorCode: null } });
      if (rearmed.count !== 1) denied();
      fresh.data.processingSummaryAttempt = { childJobId: currentChild.id, runId, inputFingerprint: attempt.inputFingerprint,
        expectedSummaryRevision: attempt.expectedSummaryRevision };
    }
    await tx.generationJob.update({ where: { id: jobId }, data: runId
      ? { runId, status: 'PENDING', result: fresh.data }
      : { status: 'FAILED', errorCode: errorCode ?? 'PROCESSING_START_FAILED', completedAt: now } });
    const finishTime = await recordingDatabaseTime(tx);
    if ((job.expiresAt && job.expiresAt <= finishTime) || (currentChild?.expiresAt && currentChild.expiresAt <= finishTime)) denied();
    if (rows.some(row => (row.id === fresh.data.recordingId || ((row.transcript !== null || row.staffTranscript !== null) && row.status !== 'DISCARDED'))
      && row.expiresAt <= finishTime)) denied('RECORDING_OBJECT_UNAVAILABLE');
    return true;
  });
}

export function publicRecordingJobResult(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !['recordingObject', 'processingStartToken', 'processingSummaryAttempt', 'recordingInputFingerprint'].includes(key)));
}
