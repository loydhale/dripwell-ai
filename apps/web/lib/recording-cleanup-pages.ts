import { performance } from 'node:perf_hooks';
import { Prisma, type MaintenanceCoordinator } from '@prisma/client';
import { ApiError } from './errors';
import { MAINTENANCE_LEASE_MS } from './maintenance-context';
import { withMaintenanceClaim, type MaintenanceClaim } from './maintenance-coordinator';
import { cleanupItemSchema, RECORDING_CLEANUP_FAMILIES, maintenanceState, maintenanceProgressSchema,
  maintenanceCursorSchema, emptyRecordingCleanupPage, type CleanupItem, type CleanupKey,
  type RecordingCleanupFamily, type RecordingCleanupPage } from './maintenance-state';
import { claimRecordingDeletionInTransaction, commitRecordingDeletionInTransaction,
  deferRecordingDeletionInTransaction, finishRecordingDeletionInTransaction, identityFromIntent,
  lockRecordingDeletionIntent, markRecordingCleanupSourceFinished, ownsRecordingDeletion,
  parseRecordingObjectIdentity, recordingDatabaseTime, type RecordingCleanupSource } from './recording-deletion-intents';
import { deleteRecordingBlob, recordingDeleteToken, type RecordingDeleteIO, type RecordingDeleteOutcome } from './recording-blob-delete';

type Tx = Prisma.TransactionClient;
const reasonFor = (family: RecordingCleanupFamily) => family === 'recordingUploadCleanup' ? 'UPLOAD_CLEANUP' : 'RETENTION';
function stale(): never { throw new ApiError(409, 'Recording cleanup state changed.', 'MAINTENANCE_STALE'); }
function deadline(): never { throw new ApiError(409, 'Recording cleanup budget expired.', 'RECORDING_CLEANUP_DEADLINE'); }
function validFamily(family: RecordingCleanupFamily) {
  if (!RECORDING_CLEANUP_FAMILIES.includes(family)) stale();
}
function pageAt(row: MaintenanceCoordinator, family: RecordingCleanupFamily, index?: number) {
  const progress = maintenanceState(maintenanceProgressSchema, row.progress);
  const page = progress[family];
  if (!page || (index !== undefined && (!Number.isInteger(index) || page.index !== index || page.finished))) stale();
  return { progress, page };
}
function beforeDeadline(page: RecordingCleanupPage, now: Date) {
  if (now.getTime() >= new Date(page.deadline).getTime()) deadline();
}

/** Bounds and binary collation are applied to each SQL branch before top-k. */
async function candidates(tx: Tx, claim: MaintenanceClaim, family: RecordingCleanupFamily, cutoff: Date,
  range: { after: CleanupKey | null; ceiling: CleanupKey | null }, take: 1 | 5, descending = false): Promise<CleanupItem[]> {
  const direction = descending ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const bounded = (at: Prisma.Sql, key: Prisma.Sql) => Prisma.sql`
    ${range.after ? Prisma.sql`AND (${at}, ${key} COLLATE "C") > (${range.after.at}::timestamp, ${range.after.stableId}::text COLLATE "C")` : Prisma.empty}
    ${range.ceiling ? Prisma.sql`AND (${at}, ${key} COLLATE "C") <= (${range.ceiling.at}::timestamp, ${range.ceiling.stableId}::text COLLATE "C")` : Prisma.empty}`;
  const intentAt = Prisma.sql`COALESCE(i."sourceCreatedAt", i."createdAt")`;
  const intentKey = Prisma.sql`COALESCE(i."sourceKind", 'LEGACY_INTENT') || ':' || COALESCE(i."sourceId", i."id")::text`;
  const branches: Prisma.Sql[] = [Prisma.sql`(SELECT
    COALESCE(i."sourceKind", 'LEGACY_INTENT') AS kind, COALESCE(i."sourceId", i."id") AS "sourceId",
    i."tenantId", i."id" AS "intentId", ${intentAt} AS at, ${intentKey} AS "stableId", 0 AS priority
    FROM "RecordingDeletionIntent" i WHERE i."reason" = ${reasonFor(family)} AND i."creatorScope" = ${claim.context.key}
    AND i."status" IN ('PENDING', 'IN_FLIGHT') ${bounded(intentAt, intentKey)}
    ORDER BY ${intentAt} ${direction}, ${intentKey} COLLATE "C" ${direction} LIMIT ${take})`];
  if (family === 'recordingUploadCleanup') {
    const aged = new Date(cutoff.getTime() - 15 * 60_000);
    const jobKey = Prisma.sql`'UPLOAD_ATTEMPT:' || j."id"::text`;
    branches.push(Prisma.sql`(SELECT 'UPLOAD_ATTEMPT' AS kind, j."id" AS "sourceId", j."tenantId",
      NULL::uuid AS "intentId", j."createdAt" AS at, ${jobKey} AS "stableId", 1 AS priority
      FROM "GenerationJob" j WHERE j."kind" = 'RECORDING_UPLOAD' AND
      (j."status" = 'CLEANUP_PENDING' OR (j."status" IN ('QUEUING', 'RUNNING', 'FAILED') AND j."updatedAt" < ${aged}))
      AND NOT EXISTS (SELECT 1 FROM "RecordingDeletionIntent" i WHERE i."tenantId" = j."tenantId" AND i."blobPath" = j."result"->>'blobPath')
      ${bounded(Prisma.sql`j."createdAt"`, jobKey)}
      ORDER BY j."createdAt" ${direction}, ${jobKey} COLLATE "C" ${direction} LIMIT ${take})`);
    const journalKey = Prisma.sql`'SETUP_UPLOAD:' || u."id"::text`;
    branches.push(Prisma.sql`(SELECT 'SETUP_UPLOAD' AS kind, u."id" AS "sourceId", u."tenantId",
      NULL::uuid AS "intentId", u."createdAt" AS at, ${journalKey} AS "stableId", 1 AS priority
      FROM "SetupRecordingUpload" u WHERE (u."state" = 'CLEANUP_PENDING' OR (u."state" = 'IN_FLIGHT' AND u."createdAt" < ${aged}))
      AND NOT EXISTS (SELECT 1 FROM "RecordingDeletionIntent" i WHERE i."tenantId" = u."tenantId" AND i."blobPath" = u."blobPath")
      ${bounded(Prisma.sql`u."createdAt"`, journalKey)}
      ORDER BY u."createdAt" ${direction}, ${journalKey} COLLATE "C" ${direction} LIMIT ${take})`);
  } else {
    const recordingKey = Prisma.sql`'RECORDING:' || r."id"::text`;
    branches.push(Prisma.sql`(SELECT 'RECORDING' AS kind, r."id" AS "sourceId", r."tenantId",
      NULL::uuid AS "intentId", r."createdAt" AS at, ${recordingKey} AS "stableId", 1 AS priority
      FROM "RecordingSegment" r WHERE r."expiresAt" <= ${cutoff} AND r."blobPath" <> ''
      AND NOT EXISTS (SELECT 1 FROM "RecordingDeletionIntent" i WHERE i."tenantId" = r."tenantId" AND i."blobPath" = r."blobPath")
      ${bounded(Prisma.sql`r."createdAt"`, recordingKey)}
      ORDER BY r."createdAt" ${direction}, ${recordingKey} COLLATE "C" ${direction} LIMIT ${take})`);
  }
  const rows = await tx.$queryRaw<Array<{ kind: string; sourceId: string; tenantId: string; intentId: string | null; at: Date; stableId: string }>>(Prisma.sql`
    WITH candidates AS (${Prisma.join(branches, ' UNION ALL ')}), logical AS (
      SELECT DISTINCT ON (at, "stableId" COLLATE "C") * FROM candidates ORDER BY at, "stableId" COLLATE "C", priority
    ) SELECT kind, "sourceId", "tenantId", "intentId", at, "stableId" FROM logical
      ORDER BY at ${direction}, "stableId" COLLATE "C" ${direction} LIMIT ${take}`);
  return rows.map(row => {
    if (!(row.at instanceof Date) || !Number.isFinite(row.at.getTime())) stale();
    return cleanupItemSchema.parse({ kind: row.kind, sourceId: row.sourceId, tenantId: row.tenantId,
      intentId: row.intentId, key: { at: row.at.toISOString(), stableId: row.stableId } });
  });
}

export async function selectRecordingCleanupPage(claim: MaintenanceClaim, family: RecordingCleanupFamily) {
  validFamily(family);
  return withMaintenanceClaim(claim, async (tx, row) => {
    const progress = maintenanceState(maintenanceProgressSchema, row.progress);
    if (progress[family]) return progress[family];
    const cursors = maintenanceState(maintenanceCursorSchema, row.cursors);
    const cursor = cursors[family] ?? { after: null, ceiling: null };
    const now = await recordingDatabaseTime(tx);
    const ceiling = cursor.ceiling ?? (await candidates(tx, claim, family, now, { after: null, ceiling: null }, 1, true))[0]?.key ?? null;
    const items = ceiling ? await candidates(tx, claim, family, now, { after: cursor.after, ceiling }, 5) : [];
    const page = emptyRecordingCleanupPage(now.toISOString());
    page.items = items; page.ceiling = ceiling; page.finished = items.length === 0;
    page.ended = items.length < 5 || JSON.stringify(items.at(-1)?.key) === JSON.stringify(ceiling);
    progress[family] = page;
    // A fixed empty page can close its exhausted sweep; selection of nonempty
    // work does not advance the cursor before that work is terminal.
    if (!items.length) cursors[family] = { after: null, ceiling: null };
    await tx.maintenanceCoordinator.update({ where: { key: row.key }, data: { progress, cursors,
      leaseUntil: new Date(now.getTime() + MAINTENANCE_LEASE_MS) } });
    return page;
  });
}

async function saveAdvance(tx: Tx, row: MaintenanceCoordinator, family: RecordingCleanupFamily,
  progress: ReturnType<typeof maintenanceProgressSchema.parse>, page: RecordingCleanupPage, expiredBudget = false) {
  if (!expiredBudget) beforeDeadline(page, await recordingDatabaseTime(tx));
  const cursors = maintenanceState(maintenanceCursorSchema, row.cursors);
  const last = page.items[page.index - 1]?.key ?? null;
  cursors[family] = page.finished && page.ended ? { after: null, ceiling: null } : { after: last, ceiling: page.ceiling };
  await tx.maintenanceCoordinator.update({ where: { key: row.key }, data: { progress, cursors } });
  if (!expiredBudget) beforeDeadline(page, await recordingDatabaseTime(tx));
}
function advance(page: RecordingCleanupPage, result: 'deleted' | 'preserved' | 'failed' | 'deferred') {
  page[result]++; page.index++; page.active = null; page.finished = page.index === page.items.length;
}
async function candidateObject(tx: Tx, item: CleanupItem) {
  let metadata: unknown;
  if (item.kind === 'RECORDING') metadata = (await tx.recordingSegment.findFirst({ where: { id: item.sourceId, tenantId: item.tenantId } }))?.blobObject;
  else if (item.kind === 'SETUP_UPLOAD') {
    const source = await tx.setupRecordingUpload.findFirst({ where: { id: item.sourceId, tenantId: item.tenantId } });
    if (!source?.uploadSettled || source.state !== 'CLEANUP_PENDING') return null;
    metadata = source.blobObject;
  } else if (item.kind === 'UPLOAD_ATTEMPT') {
    const source = await tx.generationJob.findFirst({ where: { id: item.sourceId, tenantId: item.tenantId, kind: 'RECORDING_UPLOAD' } });
    const pointer = source?.result;
    if (!pointer || typeof pointer !== 'object' || Array.isArray(pointer) || pointer.uploadSettled !== true || pointer.state !== 'CLEANUP_PENDING') return null;
    metadata = pointer.blobObject;
  } else return null;
  try {
    const object = parseRecordingObjectIdentity(metadata);
    if (object.tenantId !== item.tenantId || (item.kind === 'UPLOAD_ATTEMPT' ? object.uploadAttemptId !== item.sourceId : object.recordingId !== item.sourceId)) return null;
    recordingDeleteToken(object);
    return object;
  } catch (error) { if (error instanceof ApiError) return null; throw error; }
}

export async function prepareRecordingCleanupItem(claim: MaintenanceClaim, family: RecordingCleanupFamily, index: number) {
  return withMaintenanceClaim(claim, async (tx, row) => {
    const { progress, page } = pageAt(row, family, index);
    beforeDeadline(page, await recordingDatabaseTime(tx));
    if (page.active) return { status: 'ACTIVE' as const, page };
    const item = page.items[index];
    if (item.kind === 'LEGACY_INTENT') {
      advance(page, 'deferred'); await saveAdvance(tx, row, family, progress, page);
      return { status: 'ADVANCED' as const, page };
    }
    let intentId = item.intentId;
    if (!intentId) {
      const object = await candidateObject(tx, item);
      if (!object) { advance(page, 'deferred'); await saveAdvance(tx, row, family, progress, page); return { status: 'ADVANCED' as const, page }; }
      const source: RecordingCleanupSource = { kind: item.kind, id: item.sourceId, createdAt: new Date(item.key.at), cutoff: new Date(page.cutoff) };
      const committed = await commitRecordingDeletionInTransaction(tx, claim, { identity: object, reason: reasonFor(family) }, source);
      if (committed.status !== 'COMMITTED') {
        advance(page, committed.status === 'PRESERVED' ? 'preserved' : 'deferred');
        await saveAdvance(tx, row, family, progress, page); return { status: 'ADVANCED' as const, page };
      }
      intentId = committed.intentId;
    }
    const initial = await lockRecordingDeletionIntent(tx, claim, intentId);
    if (initial.sourceKind !== item.kind || initial.sourceId !== item.sourceId || initial.sourceCreatedAt?.toISOString() !== item.key.at || initial.tenantId !== item.tenantId) stale();
    try { recordingDeleteToken(identityFromIntent(initial)); }
    catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'RECORDING_STORE_UNAVAILABLE') throw error;
      advance(page, 'deferred'); await saveAdvance(tx, row, family, progress, page); return { status: 'ADVANCED' as const, page };
    }
    const intent = await claimRecordingDeletionInTransaction(tx, claim, intentId);
    if (!intent) {
      advance(page, initial.status === 'DELETED' ? 'preserved' : 'deferred');
      await saveAdvance(tx, row, family, progress, page); return { status: 'ADVANCED' as const, page };
    }
    beforeDeadline(page, await recordingDatabaseTime(tx));
    const active = { intentId: intent.id, token: intent.executionToken!, index };
    page.active = active;
    await tx.maintenanceCoordinator.update({ where: { key: row.key }, data: { progress } });
    return { status: 'READY' as const, page, active };
  });
}

function activeAt(page: RecordingCleanupPage, active: NonNullable<RecordingCleanupPage['active']>) {
  const owned = page.active;
  if (!owned || owned.intentId !== active.intentId || owned.token !== active.token || owned.index !== active.index) stale();
}
export async function admitRecordingCleanupItem(claim: MaintenanceClaim, family: RecordingCleanupFamily,
  active: NonNullable<RecordingCleanupPage['active']>) {
  const began = performance.now();
  const admitted = await withMaintenanceClaim(claim, async (tx, row) => {
    const { page } = pageAt(row, family, active.index); activeAt(page, active);
    const intent = await lockRecordingDeletionIntent(tx, claim, active.intentId);
    if (!ownsRecordingDeletion(intent, claim, active.token)) stale();
    const object = identityFromIntent(intent); recordingDeleteToken(object);
    const now = await recordingDatabaseTime(tx); beforeDeadline(page, now);
    return { object, remaining: new Date(page.deadline).getTime() - now.getTime() };
  });
  const remainingMs = Math.floor(admitted.remaining - (performance.now() - began));
  if (remainingMs <= 0) deadline();
  return { object: admitted.object, remainingMs: Math.min(20_000, remainingMs) };
}

export async function finishRecordingCleanupItem(claim: MaintenanceClaim, family: RecordingCleanupFamily,
  active: NonNullable<RecordingCleanupPage['active']>, result: RecordingDeleteOutcome) {
  return withMaintenanceClaim(claim, async (tx, row) => {
    const { progress, page } = pageAt(row, family, active.index); activeAt(page, active);
    const intent = await lockRecordingDeletionIntent(tx, claim, active.intentId);
    if (!ownsRecordingDeletion(intent, claim, active.token)) stale();
    const now = await recordingDatabaseTime(tx); beforeDeadline(page, now);
    const finished = await finishRecordingDeletionInTransaction(tx, claim, active.intentId, active.token, result, now);
    if (result.deleted) await markRecordingCleanupSourceFinished(tx, finished, now);
    page.durationMs += result.durationMs;
    advance(page, result.deleted ? 'deleted' : 'failed');
    await saveAdvance(tx, row, family, progress, page);
    // A late DB observation rolls back intent, source, metrics and cursor too.
    beforeDeadline(page, await recordingDatabaseTime(tx));
    return page;
  });
}

export async function deferExpiredRecordingCleanupPage(claim: MaintenanceClaim, family: RecordingCleanupFamily,
  index: number, active: RecordingCleanupPage['active']) {
  return withMaintenanceClaim(claim, async (tx, row) => {
    const { progress, page } = pageAt(row, family, index);
    if (active) {
      activeAt(page, active);
      const intent = await lockRecordingDeletionIntent(tx, claim, active.intentId);
      if (!ownsRecordingDeletion(intent, claim, active.token)) stale();
    } else if (page.active) stale();
    if ((await recordingDatabaseTime(tx)).getTime() < new Date(page.deadline).getTime()) stale();
    if (active) await deferRecordingDeletionInTransaction(tx, claim, active.intentId, active.token);
    page.deferred += page.items.length - page.index;
    page.index = page.items.length; page.active = null; page.finished = true;
    await saveAdvance(tx, row, family, progress, page, true);
    return page;
  });
}

export function recordingCleanupTotals(page: RecordingCleanupPage) {
  return { checked: page.items.length, deleted: page.deleted, preserved: page.preserved,
    failed: page.failed, deferred: page.deferred, durationMs: page.durationMs };
}
export async function processRecordingCleanupFamily(claim: MaintenanceClaim, family: RecordingCleanupFamily, io?: RecordingDeleteIO) {
  let page = await selectRecordingCleanupPage(claim, family);
  // Exactly the persisted fixed page; neither failure nor deferral refills it.
  for (let slot = 0; slot < 5 && !page.finished; slot++) {
    let active = page.active;
    try {
      const prepared = await prepareRecordingCleanupItem(claim, family, page.index);
      page = prepared.page;
      if (prepared.status === 'ADVANCED') continue;
      if (prepared.status === 'ACTIVE') throw new ApiError(503, 'Cleanup dispatch is uncertain. Use explicit recovery.', 'MAINTENANCE_CLEANUP_IN_FLIGHT');
      active = prepared.active;
      const admitted = await admitRecordingCleanupItem(claim, family, active);
      const result = await deleteRecordingBlob(admitted.object, admitted.remainingMs, io);
      page = await finishRecordingCleanupItem(claim, family, active, result);
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'RECORDING_CLEANUP_DEADLINE') throw error;
      page = await deferExpiredRecordingCleanupPage(claim, family, page.index, active);
      break;
    }
  }
  if (!page.finished) throw new ApiError(409, 'Recording cleanup page is incomplete.', 'MAINTENANCE_INCOMPLETE');
  return recordingCleanupTotals(page);
}
