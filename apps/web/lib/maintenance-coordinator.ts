import { randomUUID } from 'node:crypto';
import { Prisma, type MaintenanceCoordinator } from '@prisma/client';
import { getDb } from './db';
import { ApiError } from './errors';
import { assertMaintenanceContext, MAINTENANCE_LEASE_MS, nextMaintenanceDue, type MaintenanceContext } from './maintenance-context';
import { completedMaintenancePages } from './maintenance-state';

export type MaintenanceMode = 'MANUAL' | 'SCHEDULED';
export interface MaintenanceReservation {
  context: MaintenanceContext;
  generation: string;
  ordinal: string;
  token: string;
  mode: MaintenanceMode;
  dueAt: string;
}
export interface MaintenanceClaim extends MaintenanceReservation { runId: string }
export type MaintenanceCommand = 'run-once' | 'start' | 'stop' | 'recover';
type Tx = Prisma.TransactionClient;

function stale(): never {
  throw new ApiError(409, 'This maintenance owner is no longer current.', 'MAINTENANCE_STALE');
}
function conflict(message: string): never {
  throw new ApiError(409, message, 'MAINTENANCE_CONFLICT');
}

export async function maintenanceTransaction<T>(body: (db: Tx) => Promise<T>): Promise<T> {
  return getDb().$transaction(async (db) => {
    await db.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
    await db.$executeRaw`SET LOCAL lock_timeout = '2000ms'`;
    return body(db);
  }, { maxWait: 2000, timeout: 10_000 });
}

export async function lockCoordinator(db: Tx, key: string) {
  await db.$queryRaw`SELECT "key" FROM "MaintenanceCoordinator" WHERE "key" = ${key} FOR UPDATE`;
  return db.maintenanceCoordinator.findUnique({ where: { key } });
}

function matches(row: MaintenanceCoordinator | null, input: MaintenanceReservation): row is MaintenanceCoordinator {
  const c = input.context;
  return Boolean(row && row.key === c.key && row.projectId === c.projectId &&
    row.environment === c.environment && row.branch === c.branch && row.deploymentId === c.deploymentId &&
    row.cadenceMs === c.cadenceMs && row.generation.toString() === input.generation &&
    row.ordinal.toString() === input.ordinal && row.claimToken === input.token && row.mode === input.mode &&
    row.enabled === (input.mode === 'SCHEDULED'));
}

export function requireClaim(row: MaintenanceCoordinator | null, claim: MaintenanceClaim, phases = ['RUNNING']): MaintenanceCoordinator {
  if (!matches(row, claim) || row.ownerRunId !== claim.runId || !phases.includes(row.phase)) stale();
  return row;
}

/** Lock order is coordinator, then domain rows. Expiry never replaces the token fence. */
export async function withMaintenanceClaim<T>(claim: MaintenanceClaim, body: (db: Tx, row: MaintenanceCoordinator) => Promise<T>, phases = ['RUNNING']) {
  assertMaintenanceContext(claim.context);
  return maintenanceTransaction(async (db) => body(db, requireClaim(await lockCoordinator(db, claim.context.key), claim, phases)));
}

function reservation(row: MaintenanceCoordinator, context: MaintenanceContext): MaintenanceReservation {
  if (!row.claimToken || !row.nextDueAt || !['MANUAL', 'SCHEDULED'].includes(row.mode)) stale();
  return { context, generation: row.generation.toString(), ordinal: row.ordinal.toString(),
    token: row.claimToken, mode: row.mode as MaintenanceMode, dueAt: row.nextDueAt.toISOString() };
}

function status(row: MaintenanceCoordinator | null, context: MaintenanceContext) {
  return { scope: context.key, deploymentId: row?.deploymentId ?? null, enabled: row?.enabled ?? false,
    mode: row?.mode ?? 'DISABLED', phase: row?.phase ?? 'IDLE',
    generation: row?.generation.toString() ?? '0', ordinal: row?.ordinal.toString() ?? '0',
    ownerRunId: row?.ownerRunId ?? null, dispatchedRunId: row?.dispatchedRunId ?? null,
    nextDueAt: row?.nextDueAt?.toISOString() ?? null, leaseUntil: row?.leaseUntil?.toISOString() ?? null,
    lastCompletedAt: row?.lastCompletedAt?.toISOString() ?? null, lastErrorCode: row?.lastErrorCode ?? null,
    skippedSlots: row?.skippedSlots.toString() ?? '0' };
}

export async function maintenanceStatus(context: MaintenanceContext) {
  assertMaintenanceContext(context);
  return status(await getDb().maintenanceCoordinator.findUnique({ where: { key: context.key } }), context);
}

export async function reserveMaintenance(context: MaintenanceContext, command: MaintenanceCommand) {
  assertMaintenanceContext(context);
  return maintenanceTransaction(async (db) => {
    // Commands also serialize across scopes sharing one physical DB. A second
    // preview/environment must not run an independent global sweep of that DB.
    await db.$executeRaw`SELECT pg_advisory_xact_lock(47047, 1)`;
    const other = await db.maintenanceCoordinator.findFirst({ where: {
      key: { not: context.key }, OR: [{ enabled: true }, { phase: { in: ['PENDING_START', 'RUNNING', 'WAITING'] } }],
    }, select: { key: true } });
    if (other) conflict('Another environment owns database maintenance.');
    await db.maintenanceCoordinator.upsert({ where: { key: context.key }, create: {
      key: context.key, projectId: context.projectId, environment: context.environment, branch: context.branch,
    }, update: {} });
    const row = (await lockCoordinator(db, context.key))!;
    const now = new Date();
    if (command === 'stop') {
      const stopped = await db.maintenanceCoordinator.update({ where: { key: row.key }, data: {
        enabled: false, mode: 'DISABLED', phase: 'IDLE', generation: { increment: 1 },
        claimToken: null, ownerRunId: null, leaseUntil: null, nextDueAt: null,
        dispatchAttemptedAt: null, dispatchedRunId: null, continuation: Prisma.DbNull, lastErrorCode: null,
      } });
      return { state: status(stopped, context), reservation: null };
    }
    if (command === 'recover') {
      if (!['PENDING_START', 'RUNNING', 'WAITING'].includes(row.phase) ||
        !row.leaseUntil || row.leaseUntil > now || row.deploymentId !== context.deploymentId)
        conflict('Recovery requires an expired current-deployment reservation or claim. Stop before changing deployment.');
    } else if (row.enabled || ['PENDING_START', 'RUNNING', 'WAITING'].includes(row.phase)) {
      conflict('Maintenance is already reserved. Stop scheduled mode before running manually.');
    }
    const mode: MaintenanceMode = command === 'recover'
      ? row.mode as MaintenanceMode : command === 'start' ? 'SCHEDULED' : 'MANUAL';
    if (!['MANUAL', 'SCHEDULED'].includes(mode)) stale();
    const next = await db.maintenanceCoordinator.update({ where: { key: row.key }, data: {
      enabled: mode === 'SCHEDULED', mode, phase: 'PENDING_START', deploymentId: context.deploymentId,
      generation: { increment: 1 }, ordinal: 1, claimToken: randomUUID(), ownerRunId: null,
      dispatchedRunId: null, dispatchAttemptedAt: null, claimedAt: null,
      leaseUntil: new Date(now.getTime() + MAINTENANCE_LEASE_MS),
      anchorAt: command === 'recover' && mode === 'SCHEDULED' ? row.anchorAt : now,
      nextDueAt: now, cadenceMs: context.cadenceMs, progress: {}, continuation: Prisma.DbNull, lastErrorCode: null,
    } });
    return { state: status(next, context), reservation: reservation(next, context) };
  });
}

/** Persist the ambiguity boundary before external native dispatch. Never auto-retry it. */
export async function beginMaintenanceDispatch(input: MaintenanceReservation): Promise<void> {
  assertMaintenanceContext(input.context);
  await maintenanceTransaction(async (db) => {
    const row = await lockCoordinator(db, input.context.key);
    if (!matches(row, input) || row.phase !== 'PENDING_START' || row.nextDueAt?.toISOString() !== input.dueAt) stale();
    if (row.dispatchAttemptedAt) conflict('Native dispatch was already attempted. Use explicit expired-claim recovery.');
    await db.maintenanceCoordinator.update({ where: { key: row.key }, data: { dispatchAttemptedAt: new Date() } });
  });
}

export async function recordMaintenanceDispatch(input: MaintenanceReservation, runId: string | null) {
  assertMaintenanceContext(input.context);
  return maintenanceTransaction(async (db) => {
    const row = await lockCoordinator(db, input.context.key);
    // A fast child/stop can advance the fence before the native response arrives.
    if (!matches(row, input)) return false;
    await db.maintenanceCoordinator.update({ where: { key: row.key }, data: runId
      ? { dispatchedRunId: runId }
      : row.phase === 'PENDING_START' ? { lastErrorCode: 'NATIVE_START_AMBIGUOUS' } : {} });
    return true;
  });
}

export async function claimMaintenance(input: MaintenanceReservation, runId: string): Promise<MaintenanceClaim | null> {
  assertMaintenanceContext(input.context);
  if (!runId || runId.length > 200) stale();
  return maintenanceTransaction(async (db) => {
    const row = await lockCoordinator(db, input.context.key);
    if (!matches(row, input)) stale();
    if (row.phase === 'RUNNING' && row.ownerRunId === runId) return { ...input, runId };
    if (row.phase !== 'PENDING_START' || row.ownerRunId) return null;
    if (!row.nextDueAt || row.nextDueAt.toISOString() !== input.dueAt || row.nextDueAt > new Date()) stale();
    const now = new Date();
    await db.maintenanceCoordinator.update({ where: { key: row.key }, data: {
      phase: 'RUNNING', ownerRunId: runId, claimedAt: now,
      leaseUntil: new Date(now.getTime() + MAINTENANCE_LEASE_MS),
    } });
    return { ...input, runId };
  });
}

export async function completeMaintenance(claim: MaintenanceClaim) {
  return withMaintenanceClaim(claim, async (db, row) => {
    if (row.phase === 'COMPLETED') return null;
    if (row.phase === 'WAITING') return row.nextDueAt!.toISOString();
    // The page proof and completion write share the same token/row lock. A
    // stale, partial or malformed iteration cannot reserve its continuation.
    const families = completedMaintenancePages(row.progress);
    const lastErrorCode = Object.values(families).some((page) => page.failed || page.deferred) ? 'ITERATION_PARTIAL' : null;
    const now = new Date();
    if (row.mode === 'MANUAL') {
      await db.maintenanceCoordinator.update({ where: { key: row.key }, data: {
        phase: 'COMPLETED', lastCompletedAt: now, leaseUntil: null, lastErrorCode,
      } });
      return null;
    }
    const next = nextMaintenanceDue(row.anchorAt!, row.nextDueAt!, now, row.cadenceMs);
    await db.maintenanceCoordinator.update({ where: { key: row.key }, data: {
      phase: 'WAITING', lastCompletedAt: now, nextDueAt: next.nextDueAt,
      skippedSlots: { increment: next.skippedSlots },
      leaseUntil: new Date(next.nextDueAt.getTime() + MAINTENANCE_LEASE_MS), lastErrorCode,
    } });
    return next.nextDueAt.toISOString();
  }, ['RUNNING', 'WAITING', 'COMPLETED']);
}

export async function reserveNextMaintenance(claim: MaintenanceClaim): Promise<MaintenanceReservation> {
  assertMaintenanceContext(claim.context);
  return maintenanceTransaction(async (db) => {
    const row = await lockCoordinator(db, claim.context.key);
    const continuation = row?.continuation as { parentToken?: string; parentRunId?: string; parentOrdinal?: string } | null;
    if (row && row.generation.toString() === claim.generation &&
      row.ordinal === BigInt(claim.ordinal) + 1n && continuation?.parentToken === claim.token &&
      continuation.parentRunId === claim.runId && continuation.parentOrdinal === claim.ordinal &&
      row.deploymentId === claim.context.deploymentId && row.enabled && row.mode === 'SCHEDULED')
      return reservation(row, claim.context);
    // Completion changes dueAt, but retains the same generation/ordinal/token/run.
    if (!row || row.phase !== 'WAITING') stale();
    const waitingClaim = { ...claim, dueAt: row.nextDueAt!.toISOString() };
    requireClaim(row, waitingClaim, ['WAITING']);
    if (row.nextDueAt! > new Date()) stale();
    const next = await db.maintenanceCoordinator.update({ where: { key: row.key }, data: {
      ordinal: { increment: 1 }, phase: 'PENDING_START', claimToken: randomUUID(), ownerRunId: null,
      claimedAt: null, dispatchAttemptedAt: null, dispatchedRunId: null, progress: {},
      continuation: { parentToken: claim.token, parentRunId: claim.runId, parentOrdinal: claim.ordinal },
      leaseUntil: new Date(Date.now() + MAINTENANCE_LEASE_MS),
    } });
    return reservation(next, claim.context);
  });
}

export async function maintenanceFailure(claim: MaintenanceClaim) {
  await withMaintenanceClaim(claim, async (db, row) => {
    await db.maintenanceCoordinator.update({ where: { key: row.key }, data: { lastErrorCode: 'ITERATION_FAILED' } });
  });
}
