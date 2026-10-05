import { randomUUID } from 'node:crypto';
import { Prisma, type RecordingDeletionIntent } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from './errors';
import { MAINTENANCE_LEASE_MS } from './maintenance-context';
import { withMaintenanceClaim, type MaintenanceClaim } from './maintenance-coordinator';

const uuid = z.string().uuid().regex(/^[0-9a-f-]+$/);
const targetFields = z.object({
  tenantId: uuid,
  recordingId: uuid,
  consultationId: uuid.nullable(),
  setupConversationId: uuid.nullable(),
  uploadAttemptId: uuid.nullable(),
}).strict();
const targetSchema = targetFields.refine((value) => value.consultationId !== null
  ? value.setupConversationId === null && value.uploadAttemptId !== null
  : value.setupConversationId !== null && value.uploadAttemptId === null);
export type RecordingObjectTarget = z.infer<typeof targetSchema>;

export function recordingObjectPath(target: RecordingObjectTarget): string {
  const value = targetSchema.parse(target);
  return value.consultationId
    ? `private/${value.tenantId}/recordings/${value.consultationId}/${value.recordingId}/${value.uploadAttemptId}`
    : `private/${value.tenantId}/setup/${value.recordingId}`;
}

export const recordingObjectIdentitySchema = targetFields.extend({
  version: z.literal(1),
  blobPath: z.string(),
  objectUrl: z.string(),
  storeId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  etag: z.string().min(1).max(1024).refine((value) => !/[\r\n]/.test(value)),
  nonOverwrite: z.literal(true),
}).strict().refine((value) => {
  const target = {
    tenantId: value.tenantId, recordingId: value.recordingId,
    consultationId: value.consultationId, setupConversationId: value.setupConversationId,
    uploadAttemptId: value.uploadAttemptId,
  };
  return targetSchema.safeParse(target).success && value.blobPath === recordingObjectPath(target)
    && value.objectUrl === `https://${value.storeId}.private.blob.vercel-storage.com/${value.blobPath}`;
});
export type RecordingObjectIdentity = z.infer<typeof recordingObjectIdentitySchema>;

function unavailable(): never {
  throw new ApiError(409, 'This recording object cannot be used.', 'RECORDING_OBJECT_UNAVAILABLE');
}
function invalid(): never {
  throw new ApiError(409, 'Recording object identity is invalid.', 'RECORDING_OBJECT_IDENTITY_INVALID');
}
export function parseRecordingObjectIdentity(value: unknown): RecordingObjectIdentity {
  const parsed = recordingObjectIdentitySchema.safeParse(value);
  if (!parsed.success) invalid();
  return parsed.data;
}

/** Identity comes from this successful non-overwriting put, never a later head. */
export function captureRecordingObject(target: RecordingObjectTarget, blob: {
  pathname: string; url: string; etag: string;
}): RecordingObjectIdentity {
  const checked = targetSchema.parse(target);
  let url: URL;
  try { url = new URL(blob.url); } catch { invalid(); }
  const suffix = '.private.blob.vercel-storage.com';
  if (!url.hostname.endsWith(suffix)) invalid();
  return parseRecordingObjectIdentity({ ...checked, version: 1, nonOverwrite: true,
    blobPath: blob.pathname, objectUrl: blob.url,
    storeId: url.hostname.slice(0, -suffix.length), etag: blob.etag });
}

export function identityFromIntent(row: RecordingDeletionIntent): RecordingObjectIdentity {
  return parseRecordingObjectIdentity({ version: 1, nonOverwrite: true,
    tenantId: row.tenantId, recordingId: row.recordingId, consultationId: row.consultationId,
    setupConversationId: row.setupConversationId, uploadAttemptId: row.uploadAttemptId,
    blobPath: row.blobPath, objectUrl: row.objectUrl, storeId: row.storeId, etag: row.etag });
}
export function sameRecordingObject(value: unknown, expected: RecordingObjectIdentity): boolean {
  const parsed = recordingObjectIdentitySchema.safeParse(value);
  return parsed.success && (Object.keys(expected) as (keyof RecordingObjectIdentity)[])
    .every((key) => parsed.data[key] === expected[key]);
}

type Tx = Prisma.TransactionClient;
export async function lockObjectRows(tx: Tx, object: RecordingObjectIdentity) {
  if (object.consultationId) {
    await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${object.consultationId}::uuid AND "tenantId" = ${object.tenantId}::uuid FOR UPDATE`;
  }
  if (object.setupConversationId) {
    await tx.$queryRaw`SELECT "id" FROM "SetupConversation" WHERE "id" = ${object.setupConversationId}::uuid AND "tenantId" = ${object.tenantId}::uuid FOR UPDATE`;
  }
  await tx.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "id" = ${object.recordingId}::uuid AND "tenantId" = ${object.tenantId}::uuid FOR UPDATE`;
  if (object.uploadAttemptId) {
    await tx.$queryRaw`SELECT "id" FROM "GenerationJob" WHERE "id" = ${object.uploadAttemptId}::uuid AND "tenantId" = ${object.tenantId}::uuid FOR UPDATE`;
  }
  if (object.setupConversationId) {
    await tx.$queryRaw`SELECT "id" FROM "SetupRecordingUpload" WHERE "id" = ${object.recordingId}::uuid AND "tenantId" = ${object.tenantId}::uuid FOR UPDATE`;
  }
}

/** Caller owns the recording/consultation lock; actor paths never lock coordinator. */
export async function assertRecordingPathNotDetached(tx: Tx, tenantId: string, blobPath: string) {
  if (await tx.recordingDeletionIntent.findUnique({ where: { tenantId_blobPath: { tenantId, blobPath } }, select: { id: true } })) unavailable();
}

export async function recordingDatabaseTime(tx: Tx): Promise<Date> {
  const rows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS "now"`;
  const now = rows[0]?.now;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) unavailable();
  return now;
}

/** Call on the publication transaction, using its current database clock. */
export async function assertRecordingObjectAvailable(tx: Tx, expected: RecordingObjectIdentity, at?: Date) {
  const object = parseRecordingObjectIdentity(expected);
  await lockObjectRows(tx, object);
  const now = at ?? await recordingDatabaseTime(tx);
  const recording = await tx.recordingSegment.findFirst({ where: { id: object.recordingId, tenantId: object.tenantId } });
  if (!recording || recording.consultationId !== object.consultationId
    || recording.setupConversationId !== object.setupConversationId
    || recording.blobPath !== object.blobPath || !sameRecordingObject(recording.blobObject, object)
    || !['UPLOADED', 'TRANSCRIBED'].includes(recording.status) || recording.expiresAt <= now) unavailable();
  await assertRecordingPathNotDetached(tx, object.tenantId, object.blobPath);
}

const pointerSchema = z.object({
  recordingId: uuid, blobPath: z.string(),
  state: z.enum(['IN_FLIGHT', 'ADOPTED', 'CLEANUP_PENDING', 'CLEANED']),
  uploadSettled: z.boolean(), blobObject: recordingObjectIdentitySchema.optional(),
});
export type RecordingCleanupSource = {
  kind: 'RECORDING' | 'UPLOAD_ATTEMPT' | 'SETUP_UPLOAD'; id: string; createdAt: Date; cutoff?: Date;
};
export type CommitResult = { status: 'COMMITTED'; intentId: string }
  | { status: 'PRESERVED' | 'DEFERRED'; intentId: null };
function matchesSource(expected: RecordingCleanupSource | undefined, actual: RecordingCleanupSource) {
  return !expected || (expected.kind === actual.kind && expected.id === actual.id &&
    expected.createdAt.getTime() === actual.createdAt.getTime());
}

/** Caller must already hold the genuine coordinator claim lock. No provider I/O. */
export async function commitRecordingDeletionInTransaction(tx: Tx, claim: MaintenanceClaim, candidate: {
  identity: RecordingObjectIdentity; reason: 'UPLOAD_CLEANUP' | 'RETENTION';
}, expectedSource?: RecordingCleanupSource, at?: Date): Promise<CommitResult> {
  const object = parseRecordingObjectIdentity(candidate.identity);
  if (!['UPLOAD_CLEANUP', 'RETENTION'].includes(candidate.reason)) invalid();
  await lockObjectRows(tx, object);
  const existing = await tx.recordingDeletionIntent.findUnique({ where: {
    tenantId_blobPath: { tenantId: object.tenantId, blobPath: object.blobPath },
  } });
  if (existing) {
    if (!sameRecordingObject(identityFromIntent(existing), object) || existing.creatorScope !== claim.context.key) invalid();
    if (expectedSource && (existing.sourceKind !== expectedSource.kind || existing.sourceId !== expectedSource.id ||
      existing.sourceCreatedAt?.getTime() !== expectedSource.createdAt.getTime()))
      return { status: 'DEFERRED', intentId: null };
    return { status: 'COMMITTED', intentId: existing.id };
  }
  const recording = await tx.recordingSegment.findFirst({ where: { id: object.recordingId, tenantId: object.tenantId } });
  const currentPath = recording?.blobPath === object.blobPath;
  if (recording && (recording.consultationId !== object.consultationId || recording.setupConversationId !== object.setupConversationId)) invalid();
  if (currentPath && !sameRecordingObject(recording?.blobObject, object)) return { status: 'DEFERRED', intentId: null };
  let pointer: z.infer<typeof pointerSchema> | undefined;
  let source: RecordingCleanupSource | undefined;
  if (object.uploadAttemptId) {
    const attempt = await tx.generationJob.findFirst({ where: {
      id: object.uploadAttemptId, tenantId: object.tenantId, consultationId: object.consultationId, kind: 'RECORDING_UPLOAD',
    } });
    const parsed = pointerSchema.safeParse(attempt?.result);
    if (!attempt || !parsed.success || parsed.data.recordingId !== object.recordingId ||
      parsed.data.blobPath !== object.blobPath || !sameRecordingObject(parsed.data.blobObject, object) ||
      !parsed.data.uploadSettled || ['IN_FLIGHT', 'CLEANED'].includes(parsed.data.state))
      return { status: 'DEFERRED', intentId: null };
    pointer = parsed.data;
    source = { kind: 'UPLOAD_ATTEMPT', id: attempt.id, createdAt: attempt.createdAt };
  }
  const now = expectedSource ? await recordingDatabaseTime(tx) : at ?? await recordingDatabaseTime(tx);
  if (candidate.reason === 'RETENTION') {
    if (!recording) invalid();
    if (!currentPath || recording.expiresAt > now || (expectedSource?.cutoff && recording.expiresAt > expectedSource.cutoff) || recording.status === 'UPLOADING')
      return { status: 'PRESERVED', intentId: null };
    source = { kind: 'RECORDING', id: recording.id, createdAt: recording.createdAt };
  } else if (object.uploadAttemptId) {
    if ((currentPath && !['DISCARDED', 'UPLOAD_FAILED', 'EXPIRED'].includes(recording!.status)) ||
      (!currentPath && pointer?.state === 'ADOPTED')) return { status: 'PRESERVED', intentId: null };
  } else {
    const journal = await tx.setupRecordingUpload.findFirst({ where: { id: object.recordingId, tenantId: object.tenantId } });
    if (!journal || journal.setupConversationId !== object.setupConversationId || journal.blobPath !== object.blobPath ||
      journal.state !== 'CLEANUP_PENDING' || !journal.uploadSettled || !sameRecordingObject(journal.blobObject, object))
      return { status: 'DEFERRED', intentId: null };
    if (currentPath && !['DISCARDED', 'UPLOAD_FAILED', 'EXPIRED'].includes(recording!.status))
      return { status: 'PRESERVED', intentId: null };
    source = { kind: 'SETUP_UPLOAD', id: journal.id, createdAt: journal.createdAt };
  }
  if (!source || !matchesSource(expectedSource, source)) return { status: 'DEFERRED', intentId: null };
  const intent = await tx.recordingDeletionIntent.create({ data: {
    tenantId: object.tenantId, recordingId: object.recordingId,
    consultationId: object.consultationId, setupConversationId: object.setupConversationId, uploadAttemptId: object.uploadAttemptId,
    reason: candidate.reason, blobPath: object.blobPath, objectUrl: object.objectUrl, storeId: object.storeId, etag: object.etag,
    creatorScope: claim.context.key, creatorGeneration: BigInt(claim.generation), creatorOrdinal: BigInt(claim.ordinal), creatorRunId: claim.runId,
    sourceKind: source.kind, sourceId: source.id, sourceCreatedAt: source.createdAt,
  } });
  if (currentPath) await tx.recordingSegment.update({ where: { id: object.recordingId }, data: {
    blobPath: '', blobObject: Prisma.DbNull, ...(candidate.reason === 'RETENTION' ? { status: 'EXPIRED' } : {}),
  } });
  if (pointer && object.uploadAttemptId) await tx.generationJob.update({ where: { id: object.uploadAttemptId }, data: {
    status: 'CLEANUP_PENDING', completedAt: null, result: { ...pointer, state: 'CLEANUP_PENDING' },
  } });
  return { status: 'COMMITTED', intentId: intent.id };
}

/** DB-only foundation wrapper. Provider pages use the same transaction client. */
export async function commitRecordingDeletion(claim: MaintenanceClaim, candidate: {
  identity: RecordingObjectIdentity; reason: 'UPLOAD_CLEANUP' | 'RETENTION';
}, now = new Date()): Promise<CommitResult> {
  return withMaintenanceClaim(claim, tx => commitRecordingDeletionInTransaction(tx, claim, candidate, undefined, now));
}

export async function lockRecordingDeletionIntent(tx: Tx, claim: MaintenanceClaim, intentId: string) {
  const initial = await tx.recordingDeletionIntent.findFirst({ where: { id: uuid.parse(intentId), creatorScope: claim.context.key } });
  if (!initial) unavailable();
  await lockObjectRows(tx, identityFromIntent(initial));
  await tx.$queryRaw`SELECT "id" FROM "RecordingDeletionIntent" WHERE "id" = ${initial.id}::uuid FOR UPDATE`;
  return tx.recordingDeletionIntent.findUniqueOrThrow({ where: { id: initial.id } });
}
export function ownsRecordingDeletion(row: RecordingDeletionIntent, claim: MaintenanceClaim, token: string) {
  return row.status === 'IN_FLIGHT' && row.executionToken === token && row.executionScope === claim.context.key &&
    row.executionRunId === claim.runId && row.executionGeneration === BigInt(claim.generation) && row.executionOrdinal === BigInt(claim.ordinal);
}
export async function claimRecordingDeletionInTransaction(tx: Tx, claim: MaintenanceClaim, intentId: string, at?: Date) {
  const row = await lockRecordingDeletionIntent(tx, claim, intentId);
  const now = at ?? await recordingDatabaseTime(tx);
  if (row.status === 'DELETED') return null;
  if (row.status === 'IN_FLIGHT' && row.executionScope === claim.context.key &&
    row.executionGeneration === BigInt(claim.generation) && row.leaseUntil! > now) return null;
  return tx.recordingDeletionIntent.update({ where: { id: row.id }, data: {
    status: 'IN_FLIGHT', executionScope: claim.context.key, executionGeneration: BigInt(claim.generation),
    executionOrdinal: BigInt(claim.ordinal), executionRunId: claim.runId, executionToken: randomUUID(),
    leaseUntil: new Date(now.getTime() + MAINTENANCE_LEASE_MS), attempts: { increment: 1 },
  } });
}
export async function claimRecordingDeletion(claim: MaintenanceClaim, intentId: string, now = new Date()) {
  return withMaintenanceClaim(claim, tx => claimRecordingDeletionInTransaction(tx, claim, intentId, now));
}

const outcomeSchema = z.discriminatedUnion('deleted', [
  z.object({ deleted: z.literal(true), durationMs: z.number().int().min(0).max(60_000) }).strict(),
  z.object({ deleted: z.literal(false), durationMs: z.number().int().min(0).max(60_000),
    error: z.enum(['DELETE_FAILED', 'DELETE_TIMEOUT', 'OBJECT_CHANGED', 'UPLOAD_UNSETTLED']) }).strict(),
]);
const clearedExecution = { executionScope: null, executionGeneration: null, executionOrdinal: null,
  executionRunId: null, executionToken: null, leaseUntil: null };
export async function finishRecordingDeletionInTransaction(tx: Tx, claim: MaintenanceClaim, intentId: string, token: string,
  outcome: z.infer<typeof outcomeSchema>, at?: Date) {
  const result = outcomeSchema.parse(outcome);
  const row = await lockRecordingDeletionIntent(tx, claim, intentId);
  if (!ownsRecordingDeletion(row, claim, uuid.parse(token))) unavailable();
  const now = at ?? await recordingDatabaseTime(tx);
  return tx.recordingDeletionIntent.update({ where: { id: row.id }, data: {
    status: result.deleted ? 'DELETED' : 'PENDING', deletedAt: result.deleted ? now : null,
    lastDurationMs: result.durationMs, lastError: result.deleted ? null : result.error, ...clearedExecution,
  } });
}
export async function finishRecordingDeletion(claim: MaintenanceClaim, intentId: string, token: string,
  outcome: z.infer<typeof outcomeSchema>, now = new Date()) {
  return withMaintenanceClaim(claim, tx => finishRecordingDeletionInTransaction(tx, claim, intentId, token, outcome, now));
}
/** Expired-budget closure invalidates the token but does not accept a late result. */
export async function deferRecordingDeletionInTransaction(tx: Tx, claim: MaintenanceClaim, intentId: string, token: string) {
  const row = await lockRecordingDeletionIntent(tx, claim, intentId);
  if (!ownsRecordingDeletion(row, claim, uuid.parse(token))) unavailable();
  await tx.recordingDeletionIntent.update({ where: { id: row.id }, data: {
    status: 'PENDING', lastError: 'DELETE_TIMEOUT', ...clearedExecution,
  } });
}
export async function markRecordingCleanupSourceFinished(tx: Tx, row: RecordingDeletionIntent, now: Date) {
  const object = identityFromIntent(row);
  if (object.uploadAttemptId) {
    const job = await tx.generationJob.findUnique({ where: { id: object.uploadAttemptId } });
    const pointer = pointerSchema.safeParse(job?.result);
    if (job?.tenantId === object.tenantId && job.kind === 'RECORDING_UPLOAD' && pointer.success &&
      pointer.data.state === 'CLEANUP_PENDING' && pointer.data.uploadSettled && sameRecordingObject(pointer.data.blobObject, object))
      await tx.generationJob.update({ where: { id: job.id }, data: { status: 'COMPLETE', completedAt: now,
        result: { ...pointer.data, state: 'CLEANED' } } });
  } else if (row.sourceKind === 'SETUP_UPLOAD') {
    const journal = await tx.setupRecordingUpload.findUnique({ where: { id: row.sourceId! } });
    if (journal?.tenantId === object.tenantId && journal.state === 'CLEANUP_PENDING' && journal.uploadSettled &&
      sameRecordingObject(journal.blobObject, object))
      await tx.setupRecordingUpload.update({ where: { id: journal.id }, data: { state: 'CLEANED' } });
  }
}
