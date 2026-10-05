import { Prisma } from '@prisma/client';
import { ApiError } from './errors';
import { MAINTENANCE_LEASE_MS } from './maintenance-context';
import { withMaintenanceClaim, type MaintenanceClaim } from './maintenance-coordinator';
import { MAINTENANCE_PAGE_LIMITS, MAINTENANCE_FAMILIES, MAINTENANCE_FAMILY_BUDGET_MS,
  maintenanceCursorSchema, maintenanceProgressSchema, maintenanceState, completedMaintenancePages,
  type MaintenanceFamily, type MaintenancePage } from './maintenance-state';
export { MAINTENANCE_PAGE_LIMITS, MAINTENANCE_FAMILIES, MAINTENANCE_FAMILY_BUDGET_MS } from './maintenance-state';
export type { MaintenanceFamily } from './maintenance-state';
type Tx = Prisma.TransactionClient;

function cutoffFor(family: MaintenanceFamily, now: Date) {
  const age = family === 'abandonedUploads' || family === 'interruptedJobs' ? 15 * 60_000
    : family === 'oldSessions' ? 30 * 86_400_000 : family === 'oldRates' ? 2 * 86_400_000 : 0;
  return new Date(now.getTime() - age);
}

async function candidates(db: Tx, family: MaintenanceFamily, cutoff: Date,
  range: { after: string | null; ceiling: string | null }, take: number, order: 'asc' | 'desc' = 'asc') {
  const bound = { ...(range.after ? { gt: range.after } : {}), ...(range.ceiling ? { lte: range.ceiling } : {}) };
  switch (family) {
    case 'reminders': return (await db.consultation.findMany({
      where: { isTest: false, id: bound }, orderBy: { id: order }, take, select: { id: true },
    })).map((row) => row.id);
    case 'abandonedUploads': return (await db.recordingSegment.findMany({
      where: { status: 'UPLOADING', updatedAt: { lt: cutoff }, id: bound }, orderBy: { id: order }, take, select: { id: true },
    })).map((row) => row.id);
    case 'interruptedJobs': return (await db.generationJob.findMany({
      where: { status: 'QUEUING', runId: null, updatedAt: { lt: cutoff }, id: bound }, orderBy: { id: order }, take, select: { id: true },
    })).map((row) => row.id);
    case 'expiredChallenges': return (await db.authChallenge.findMany({
      where: { expiresAt: { lt: cutoff }, id: bound }, orderBy: { id: order }, take, select: { id: true },
    })).map((row) => row.id);
    case 'oldSessions': return (await db.authSession.findMany({
      where: { expiresAt: { lt: cutoff }, id: bound }, orderBy: { id: order }, take, select: { id: true },
    })).map((row) => row.id);
    case 'oldRates': return (await db.rateLimitBucket.findMany({
      where: { windowStart: { lt: cutoff }, key: bound }, orderBy: { key: order }, take, select: { key: true },
    })).map((row) => row.key);
  }
}

export async function selectMaintenancePage(claim: MaintenanceClaim, family: MaintenanceFamily): Promise<MaintenancePage> {
  if (!MAINTENANCE_FAMILIES.includes(family)) throw new ApiError(400, 'Unknown maintenance family.', 'MAINTENANCE_FAMILY_INVALID');
  return withMaintenanceClaim(claim, async (db, row) => {
    const progress = maintenanceState(maintenanceProgressSchema, row.progress);
    if (progress[family]) return progress[family];
    const cursors = maintenanceState(maintenanceCursorSchema, row.cursors);
    const cursor = cursors[family] ?? { after: null, ceiling: null };
    const cutoff = cutoffFor(family, row.claimedAt!);
    const ceiling = cursor.ceiling ?? (await candidates(db, family, cutoff, { after: null, ceiling: null }, 1, 'desc'))[0] ?? null;
    const ids = ceiling ? await candidates(db, family, cutoff, { after: cursor.after, ceiling }, MAINTENANCE_PAGE_LIMITS[family]) : [];
    const last = ids.at(-1) ?? null;
    const ended = ids.length < MAINTENANCE_PAGE_LIMITS[family] || last === ceiling;
    cursors[family] = ended ? { after: null, ceiling: null } : { after: last, ceiling };
    const page: MaintenancePage = { ids, index: 0, cutoff: cutoff.toISOString(), changed: 0,
      dismissed: 0, upserted: 0, failed: 0, deferred: 0, finished: !ids.length };
    progress[family] = page;
    await db.maintenanceCoordinator.update({ where: { key: row.key }, data: {
      progress, cursors, leaseUntil: new Date(Date.now() + MAINTENANCE_LEASE_MS),
    } });
    return page;
  });
}

async function reminderEffects(db: Tx, id: string) {
  await db.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${id}::uuid FOR UPDATE`;
  const visit = await db.consultation.findUnique({ where: { id }, select: {
    tenantId: true, providerId: true, isTest: true, archivedAt: true,
    careOutcome: true, careOutcomeDueAt: true, wellnessPlan: true, wellnessDecision: true,
    wellnessRevision: true, wellnessDecisionRevision: true, wellnessApprovedVersion: true, wellnessDecisionDueAt: true,
  } });
  if (!visit || visit.isTest) return { changed: 0, dismissed: 0, upserted: 0 };
  const now = new Date();
  const conditions = [
    { type: 'CARE_OUTCOME_NEEDED' as const, needed: visit.careOutcome === 'PENDING', dueAt: visit.careOutcomeDueAt,
      title: 'Care outcome needed', message: 'Record whether care started, did not start, or remains pending.' },
    { type: 'WELLNESS_DECISION_NEEDED' as const, needed: Boolean(visit.wellnessPlan) &&
      (!visit.wellnessDecision || visit.wellnessDecision === 'TBD' ||
       visit.wellnessDecisionRevision !== visit.wellnessRevision || visit.wellnessApprovedVersion !== visit.wellnessRevision),
      dueAt: visit.wellnessDecisionDueAt, title: 'Wellness decision needed',
      message: 'Record the client’s wellness decision when it is known.' },
  ];
  let dismissed = 0;
  let upserted = 0;
  for (const condition of conditions) {
    const needed = !visit.archivedAt && condition.needed && condition.dueAt && condition.dueAt <= now;
    const idempotencyKey = condition.dueAt ? 'reminder:' + id + ':' + condition.type + ':' + condition.dueAt.toISOString() : null;
    // One bounded stale-ID page per condition, also when due/recipient changed.
    const where: Prisma.NotificationWhereInput = { tenantId: visit.tenantId, consultationId: id,
      type: condition.type, dismissedAt: null,
      ...(needed ? { OR: [{ idempotencyKey: { not: idempotencyKey } }, { idempotencyKey: null },
        { userId: { not: visit.providerId } }, { userId: null }] } : {}) };
    const staleIds = (await db.notification.findMany({ where, take: 20, orderBy: { id: 'asc' }, select: { id: true } })).map((row) => row.id);
    if (staleIds.length) dismissed += (await db.notification.updateMany({
      where: { ...where, id: { in: staleIds } }, data: { dismissedAt: now },
    })).count;
    if (needed && idempotencyKey && condition.dueAt) {
      await db.notification.upsert({ where: { idempotencyKey }, create: {
        tenantId: visit.tenantId, userId: visit.providerId, consultationId: id, entityId: id,
        type: condition.type, title: condition.title, message: condition.message,
        dueAt: condition.dueAt, idempotencyKey,
      }, update: { userId: visit.providerId, dismissedAt: null } });
      upserted++;
    }
  }
  return { changed: dismissed + upserted, dismissed, upserted };
}

async function effects(db: Tx, family: MaintenanceFamily, id: string, cutoff: Date) {
  let changed = 0;
  switch (family) {
    case 'reminders': return reminderEffects(db, id);
    case 'abandonedUploads':
      await db.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "id" = ${id}::uuid FOR UPDATE`;
      changed = (await db.recordingSegment.updateMany({ where: { id, status: 'UPLOADING', updatedAt: { lt: cutoff } },
        data: { status: 'UPLOAD_FAILED' } })).count;
      break;
    case 'interruptedJobs':
      await db.$queryRaw`SELECT "id" FROM "GenerationJob" WHERE "id" = ${id}::uuid FOR UPDATE`;
      changed = (await db.generationJob.updateMany({ where: { id, status: 'QUEUING', runId: null, updatedAt: { lt: cutoff } },
        data: { status: 'FAILED', errorCode: 'PROCESSING_START_INTERRUPTED', completedAt: new Date() } })).count;
      break;
    case 'expiredChallenges':
      await db.$queryRaw`SELECT "id" FROM "AuthChallenge" WHERE "id" = ${id}::uuid FOR UPDATE`;
      changed = (await db.authChallenge.deleteMany({ where: { id, expiresAt: { lt: cutoff } } })).count;
      break;
    case 'oldSessions':
      await db.$queryRaw`SELECT "id" FROM "AuthSession" WHERE "id" = ${id}::uuid FOR UPDATE`;
      changed = (await db.authSession.deleteMany({ where: { id, expiresAt: { lt: cutoff } } })).count;
      break;
    case 'oldRates':
      await db.$queryRaw`SELECT "key" FROM "RateLimitBucket" WHERE "key" = ${id} FOR UPDATE`;
      changed = (await db.rateLimitBucket.deleteMany({ where: { key: id, windowStart: { lt: cutoff } } })).count;
      break;
  }
  return { changed, dismissed: 0, upserted: 0 };
}

export async function applyMaintenanceItem(claim: MaintenanceClaim, family: MaintenanceFamily, index: number) {
  return withMaintenanceClaim(claim, async (db, row) => {
    const progress = maintenanceState(maintenanceProgressSchema, row.progress);
    const page = progress[family];
    if (!page || index < 0 || !Number.isInteger(index) || index >= page.ids.length) throw new ApiError(409, 'Maintenance page changed.', 'MAINTENANCE_STALE');
    if (page.index > index || page.finished) return page;
    if (page.index !== index) throw new ApiError(409, 'Maintenance item is out of order.', 'MAINTENANCE_STALE');
    const result = await effects(db, family, page.ids[index], new Date(page.cutoff));
    page.index++;
    page.changed += result.changed;
    page.dismissed += result.dismissed;
    page.upserted += result.upserted;
    page.finished = page.index === page.ids.length;
    await db.maintenanceCoordinator.update({ where: { key: row.key }, data: {
      progress, leaseUntil: new Date(Date.now() + MAINTENANCE_LEASE_MS),
    } });
    return page;
  });
}

async function skipMaintenanceItem(claim: MaintenanceClaim, family: MaintenanceFamily, index: number, budget: boolean) {
  return withMaintenanceClaim(claim, async (db, row) => {
    const progress = maintenanceState(maintenanceProgressSchema, row.progress);
    const page = progress[family];
    if (!page || page.index !== index || page.finished) return page;
    if (budget) { page.deferred += page.ids.length - index; page.index = page.ids.length; }
    else { page.failed++; page.index++; }
    page.finished = page.index === page.ids.length;
    await db.maintenanceCoordinator.update({ where: { key: row.key }, data: {
      progress, lastErrorCode: budget ? 'FAMILY_BUDGET_REACHED' : 'ITEM_FAILED',
      leaseUntil: new Date(Date.now() + MAINTENANCE_LEASE_MS),
    } });
    return page;
  });
}

export async function processMaintenanceFamily(claim: MaintenanceClaim, family: MaintenanceFamily) {
  const beganAt = Date.now();
  let page = await selectMaintenancePage(claim, family);
  // Finite selected IDs only. Committed item+progress is replay-safe, and a
  // failed/pending item does not monopolize the next sweep's first page.
  while (!page.finished) {
    if (Date.now() - beganAt >= MAINTENANCE_FAMILY_BUDGET_MS) {
      page = (await skipMaintenanceItem(claim, family, page.index, true))!;
      break;
    }
    try { page = await applyMaintenanceItem(claim, family, page.index); }
    catch (error) {
      if (error instanceof ApiError) throw error;
      page = (await skipMaintenanceItem(claim, family, page.index, false))!;
    }
  }
  return { checked: page.ids.length, changed: page.changed, dismissed: page.dismissed,
    upserted: page.upserted, failed: page.failed, deferred: page.deferred };
}

/** Full eight-family proof; DB6 processing alone cannot authorize continuation. */
export async function requireMaintenancePagesComplete(claim: MaintenanceClaim) {
  return withMaintenanceClaim(claim, async (_db, row) => completedMaintenancePages(row.progress),
    ['RUNNING', 'WAITING', 'COMPLETED']);
}
