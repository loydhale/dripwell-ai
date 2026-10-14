import { FatalError, getWorkflowMetadata, sleep } from 'workflow';
import { start } from 'workflow/api';
import { ApiError } from '../lib/errors';
import { DEFERRED_MAINTENANCE, RECORDING_MAINTENANCE_SCOPE } from '../lib/maintenance-context';
import {
  beginMaintenanceDispatch, claimMaintenance, completeMaintenance, maintenanceFailure,
  recordMaintenanceDispatch, reserveNextMaintenance,
  type MaintenanceClaim, type MaintenanceReservation,
} from '../lib/maintenance-coordinator';
import {
  processMaintenanceFamily, requireMaintenancePagesComplete, type MaintenanceFamily,
} from '../lib/maintenance-pages';

import { processRecordingCleanupFamily } from '../lib/recording-cleanup-pages';
import type { RecordingCleanupFamily } from '../lib/maintenance-state';

function stepError(error: unknown): never {
  if (error instanceof ApiError) throw new FatalError(error.code);
  throw error;
}

export async function dispatchMaintenance(input: MaintenanceReservation) {
  await beginMaintenanceDispatch(input);
  let runId: string;
  try {
    const run = await start(maintenanceWorkflow, [input], { deploymentId: input.context.nativeDeploymentId });
    runId = run.runId;
  } catch {
    await recordMaintenanceDispatch(input, null);
    throw new ApiError(503, 'Native start outcome is uncertain. Use explicit expired-reservation recovery.', 'MAINTENANCE_START_AMBIGUOUS');
  }
  const current = await recordMaintenanceDispatch(input, runId);
  return { runId, current };
}

export async function maintenanceClaimStep(input: MaintenanceReservation) {
  'use step';
  try { return await claimMaintenance(input, getWorkflowMetadata().workflowRunId); }
  catch (error) { stepError(error); }
}
maintenanceClaimStep.maxRetries = 2;

export async function maintenancePageStep(claim: MaintenanceClaim, family: MaintenanceFamily) {
  'use step';
  try { return await processMaintenanceFamily(claim, family); }
  catch (error) { stepError(error); }
}
maintenancePageStep.maxRetries = 2;

export async function maintenanceRecordingCleanupStep(claim: MaintenanceClaim, family: RecordingCleanupFamily) {
  'use step';
  try { return await processRecordingCleanupFamily(claim, family); }
  catch (error) { stepError(error); }
}
// A lost provider response is not an application retry permission. Intent/page
// state fences redelivery; explicit recovery may reclaim the old identity.
maintenanceRecordingCleanupStep.maxRetries = 0;

export async function maintenanceCompletionStep(claim: MaintenanceClaim) {
  'use step';
  try {
    const families = await requireMaintenancePagesComplete(claim);
    const nextDueAt = await completeMaintenance(claim);
    return { families, nextDueAt };
  } catch (error) { stepError(error); }
}
maintenanceCompletionStep.maxRetries = 2;

export async function maintenanceReservationStep(claim: MaintenanceClaim) {
  'use step';
  try { return await reserveNextMaintenance(claim); }
  catch (error) { stepError(error); }
}
maintenanceReservationStep.maxRetries = 2;

export async function maintenanceDispatchStep(input: MaintenanceReservation) {
  'use step';
  try { return await dispatchMaintenance(input); }
  catch (error) { stepError(error); }
}
// Native start is not atomic with its DB reservation. Persisted attempted state
// prevents duplicate caller retries; ambiguous starts require explicit recovery.
maintenanceDispatchStep.maxRetries = 0;

export async function maintenanceFailureStep(claim: MaintenanceClaim) {
  'use step';
  try { await maintenanceFailure(claim); }
  catch (error) { stepError(error); }
}
maintenanceFailureStep.maxRetries = 2;

export async function maintenanceWorkflow(input: MaintenanceReservation) {
  'use workflow';
  const claim = await maintenanceClaimStep(input);
  if (!claim) return { status: 'DUPLICATE', generation: input.generation, ordinal: input.ordinal };
  let completed;
  try {
    // Six fixed, finite DB-only pages. No Blob/model/email/billing dependency.
    await maintenancePageStep(claim, 'reminders');
    await maintenancePageStep(claim, 'abandonedUploads');
    await maintenancePageStep(claim, 'interruptedJobs');
    await maintenancePageStep(claim, 'expiredChallenges');
    await maintenancePageStep(claim, 'oldSessions');
    await maintenancePageStep(claim, 'oldRates');
    await maintenanceRecordingCleanupStep(claim, 'recordingUploadCleanup');
    await maintenanceRecordingCleanupStep(claim, 'expiredAudioRetention');
    completed = await maintenanceCompletionStep(claim);
  } catch (error) {
    await maintenanceFailureStep(claim);
    throw error;
  }
  let nextRunId: string | null = null;
  if (completed.nextDueAt) {
    await sleep(new Date(completed.nextDueAt));
    const next = await maintenanceReservationStep(claim);
    nextRunId = (await maintenanceDispatchStep(next)).runId;
  }
  return { status: 'COMPLETED', generation: claim.generation, ordinal: claim.ordinal,
    runId: claim.runId, families: completed.families, nextRunId };
}

export function maintenanceScope() {
  return { included: ['reminders', 'abandonedUploads', 'interruptedJobs', 'expiredChallenges', 'oldSessions', 'oldRates', ...RECORDING_MAINTENANCE_SCOPE],
    deferred: [...DEFERRED_MAINTENANCE] };
}
