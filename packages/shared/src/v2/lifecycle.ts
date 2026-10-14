import type { ConsultationStage, WellnessDecision } from './contracts.js';

export type StageEvent =
  | 'INITIAL_PRODUCED'
  | 'WELLNESS_PRODUCED'
  | 'MANUAL_ACCEPT'
  | 'MANUAL_REJECT'
  | 'MANUAL_TBD'
  | 'WELLNESS_CHANGED';
const manualStages = new Set<ConsultationStage>([
  'WELLNESS_RECOMMENDATIONS_ACCEPTED',
  'WELLNESS_RECOMMENDATIONS_REJECTED',
  'WELLNESS_RECOMMENDATION_TBD',
]);

/** Call only in the transaction that successfully persists the named artifact. */
export function transitionStage(current: ConsultationStage, event: StageEvent): ConsultationStage {
  switch (event) {
    case 'INITIAL_PRODUCED':
      return current === 'CONSULTATION_STARTED' ? 'INITIAL_RECOMMENDATIONS_GIVEN' : current;
    case 'WELLNESS_PRODUCED':
      return manualStages.has(current) ? current : 'WELLNESS_RECOMMENDATIONS_PRODUCED';
    case 'WELLNESS_CHANGED':
      return 'WELLNESS_RECOMMENDATIONS_PRODUCED';
    case 'MANUAL_ACCEPT':
      return 'WELLNESS_RECOMMENDATIONS_ACCEPTED';
    case 'MANUAL_REJECT':
      return 'WELLNESS_RECOMMENDATIONS_REJECTED';
    case 'MANUAL_TBD':
      return 'WELLNESS_RECOMMENDATION_TBD';
  }
}

export function stageForWellnessDecision(decision: WellnessDecision): ConsultationStage {
  return transitionStage(
    'WELLNESS_RECOMMENDATIONS_PRODUCED',
    decision === 'ACCEPTED'
      ? 'MANUAL_ACCEPT'
      : decision === 'REJECTED'
        ? 'MANUAL_REJECT'
        : 'MANUAL_TBD',
  );
}

export function isExactApproval(
  currentRevision: number,
  approvedRevision: number | null | undefined,
): boolean {
  return currentRevision > 0 && currentRevision === approvedRevision;
}

export function assertExactApproval(
  currentRevision: number,
  approvedRevision: number | null | undefined,
  artifact: string,
): void {
  if (!isExactApproval(currentRevision, approvedRevision))
    throw new Error(`The current ${artifact} revision needs explicit approval.`);
}

export interface TrialState {
  status: string;
  trialActivatedAt: Date | null;
  trialEndsAt: Date | null;
  trialUsed: number;
  trialLimit: number;
}
export interface TrialAllowance {
  canStart: boolean;
  reason:
    | 'PAID'
    | 'AVAILABLE'
    | 'NOT_ACTIVATED'
    | 'TIME_EXPIRED'
    | 'LIMIT_REACHED'
    | 'SUBSCRIPTION_INACTIVE';
  daysRemaining: number;
  consultationsUsed: number;
  consultationsRemaining: number;
}

export function activateTrial(
  now: Date,
): Pick<TrialState, 'status' | 'trialActivatedAt' | 'trialEndsAt' | 'trialUsed' | 'trialLimit'> {
  return {
    status: 'TRIAL',
    trialActivatedAt: new Date(now),
    trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    trialUsed: 0,
    trialLimit: 10,
  };
}

export function evaluateTrialAllowance(
  state: TrialState | null,
  now: Date = new Date(),
): TrialAllowance {
  const used = state?.trialUsed ?? 0;
  const remaining = Math.max(0, (state?.trialLimit ?? 10) - used);
  const days = state?.trialEndsAt
    ? Math.max(0, Math.ceil((state.trialEndsAt.getTime() - now.getTime()) / 86400000))
    : 0;
  const base = { daysRemaining: days, consultationsUsed: used, consultationsRemaining: remaining };
  if (state?.status === 'ACTIVE') return { ...base, canStart: true, reason: 'PAID' };
  if (!state?.trialActivatedAt || !state.trialEndsAt)
    return { ...base, canStart: false, reason: 'NOT_ACTIVATED' };
  if (state.status !== 'TRIAL')
    return { ...base, canStart: false, reason: 'SUBSCRIPTION_INACTIVE' };
  if (state.trialEndsAt.getTime() <= now.getTime())
    return { ...base, canStart: false, reason: 'TIME_EXPIRED' };
  if (used >= state.trialLimit) return { ...base, canStart: false, reason: 'LIMIT_REACHED' };
  return { ...base, canStart: true, reason: 'AVAILABLE' };
}

export function nextReminderDates(
  startedAt: Date,
  careOutcomeHours: number,
  wellnessDecisionHours: number,
): { careOutcomeDueAt: Date; wellnessDecisionDueAt: Date } {
  return {
    careOutcomeDueAt: new Date(startedAt.getTime() + careOutcomeHours * 3600000),
    wellnessDecisionDueAt: new Date(startedAt.getTime() + wellnessDecisionHours * 3600000),
  };
}
