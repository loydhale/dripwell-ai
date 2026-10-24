import { createHash, timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors';

export interface MaintenanceContext {
  key: string;
  projectId: string;
  environment: 'production' | 'preview' | 'development';
  branch: string;
  deploymentId: string;
  nativeDeploymentId: string;
  cadenceMs: number;
}

export const MAINTENANCE_CADENCE_MS = 15 * 60_000;
export const MAINTENANCE_LEASE_MS = 5 * 60_000;
export const DEFERRED_MAINTENANCE: readonly string[] = [];
export const RECORDING_MAINTENANCE_SCOPE = ['recording-upload-blob-cleanup', 'expired-audio-blob-retention'] as const;

export function maintenanceAuthorization(request: Request): void {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(secret ? 'Bearer ' + secret : '');
  if (!expected.length || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new ApiError(401, 'Machine authentication is required.', 'UNAUTHENTICATED');
  }
}

function unavailable(): never {
  throw new ApiError(503, 'Trusted maintenance deployment context is unavailable.', 'MAINTENANCE_CONTEXT_UNAVAILABLE');
}

/** Server-only selection. A request never supplies a project, branch, build or deployment. */
export function maintenanceContext(): MaintenanceContext {
  let projectId: string;
  let environment: MaintenanceContext['environment'];
  let branch: string;
  let deploymentId: string;
  let nativeDeploymentId: string;
  let cadenceMs = MAINTENANCE_CADENCE_MS;
  if (process.env.VERCEL || process.env.VERCEL_DEPLOYMENT_ID) {
    // Workflow's runtime override wins over platform detection. Unsupported
    // hosted Worlds must fail before a durable DB reservation is written.
    const world = process.env.WORKFLOW_TARGET_WORLD;
    if (world && world !== 'vercel') unavailable();
    if (['MAINTENANCE_LOCAL_PROJECT', 'MAINTENANCE_LOCAL_BRANCH', 'MAINTENANCE_LOCAL_BUILD_ID',
      'MAINTENANCE_LOCAL_INTERVAL_MS'].some((key) => process.env[key])) unavailable();
    projectId = process.env.VERCEL_PROJECT_ID || '';
    const target = process.env.VERCEL_ENV;
    if (!/^prj_[A-Za-z0-9]+$/.test(projectId) || !['production', 'preview', 'development'].includes(target || '')) unavailable();
    environment = target as MaintenanceContext['environment'];
    branch = environment === 'preview' ? process.env.VERCEL_GIT_COMMIT_REF || '' : '';
    deploymentId = process.env.VERCEL_DEPLOYMENT_ID || '';
    if (!/^dpl_[A-Za-z0-9]+$/.test(deploymentId) || (environment === 'preview' && (!branch || branch.length > 200 || branch.trim() !== branch))) unavailable();
    nativeDeploymentId = deploymentId;
  } else {
    // Explicit, non-hosted Local World verification only. The operator binds this
    // build digest to its compiled artifact; Local World has no immutable hosting.
    if (process.env.WORKFLOW_TARGET_WORLD !== 'local') unavailable();
    projectId = process.env.MAINTENANCE_LOCAL_PROJECT || '';
    branch = process.env.MAINTENANCE_LOCAL_BRANCH || '';
    const buildId = process.env.MAINTENANCE_LOCAL_BUILD_ID || '';
    if (!/^local-[A-Za-z0-9_-]{1,80}$/.test(projectId) || !branch || branch.length > 200 || branch.trim() !== branch || !/^[a-f0-9]{64}$/.test(buildId)) unavailable();
    environment = 'development';
    deploymentId = 'local:' + buildId;
    // Match the locked @workflow/world-local 5.0.1 identity; this is not an
    // immutable deployment. The separate build digest fences local writes.
    nativeDeploymentId = 'dpl_local@5.0.1';
    if (process.env.MAINTENANCE_LOCAL_INTERVAL_MS) {
      const value = process.env.MAINTENANCE_LOCAL_INTERVAL_MS;
      if (!/^[0-9]+$/.test(value)) unavailable();
      cadenceMs = Number(value);
      if (!Number.isSafeInteger(cadenceMs) || cadenceMs < 1000 || cadenceMs > MAINTENANCE_CADENCE_MS) unavailable();
    }
  }
  const key = 'maintenance:v1:' + createHash('sha256').update(JSON.stringify([projectId, environment, branch])).digest('hex');
  return { key, projectId, environment, branch, deploymentId, nativeDeploymentId, cadenceMs };
}

export function assertMaintenanceContext(context: MaintenanceContext): void {
  const current = maintenanceContext();
  if (Object.keys(current).some((key) => current[key as keyof MaintenanceContext] !== context[key as keyof MaintenanceContext])) {
    throw new ApiError(409, 'Maintenance belongs to another deployment or environment.', 'MAINTENANCE_STALE');
  }
}

/** One delayed iteration only; never loop through overdue slots. */
export function nextMaintenanceDue(anchor: Date, due: Date, completed: Date, cadenceMs: number) {
  const elapsed = completed.getTime() - anchor.getTime();
  const slot = Math.max(1, Math.floor(elapsed / cadenceMs) + 1);
  const nextDueAt = new Date(anchor.getTime() + slot * cadenceMs);
  const skippedSlots = Math.max(0, Math.round((nextDueAt.getTime() - due.getTime()) / cadenceMs) - 1);
  return { nextDueAt, skippedSlots };
}
