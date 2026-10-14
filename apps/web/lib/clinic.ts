import 'server-only';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma, type Consultation, type ClinicConfigurationVersion } from '@prisma/client';
import { z } from 'zod';
import {
  actualCareSchema,
  adjustmentReasonSchema,
  clinicConfigurationSchema,
  consultationSummarySchema,
  emptyConsultationSummary,
  wellnessDecisionSchema,
  configurationTestSchema,
  initialRecommendationSchema,
  wellnessPlanSchema,
  evaluateRequiredQuestions,
  evaluateProductEligibility,
  recommendInitial,
  recommendWellness,
  wellnessOfferFacts,
  WELLNESS_ENGINE_VERSION,
  validateConfigurationForActivation,
  validateInitialSelection,
  validateWellnessSelection,
  transitionStage,
  stageForWellnessDecision,
  evaluateTrialAllowance,
  isExactApproval,
  type ActualCare,
  type ClinicConfiguration,
  type ConsultationSummary,
  type InitialRecommendation,
  type WellnessPlan,
} from '@dripwell/shared/v2';
import { getDb } from './db';
import type { ClinicActor } from './auth';
import { ApiError } from './errors';
import { ledgerBalances, type CreditBalance } from './credits';
import { membershipMetrics, type MembershipMetrics } from './membership-metrics';
import { assertRecordingProcessing, publishRecordingProcessing, type RecordingProcessingSnapshot } from './recording-processing';

const uuid = z.string().uuid();
const expectedVersion = z.number().int().positive();
const reason = z.object({
  reason: adjustmentReasonSchema,
  reasonNote: z.string().trim().max(4000).default(''),
});
const visit = z.object({ consultationId: uuid, expectedVersion });
const configurationTarget = z.object({ configurationVersionId: uuid, expectedVersion });

export const clinicActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('config.saveDraft'), locationId: uuid.optional(),
    configurationVersionId: uuid.optional(), expectedVersion: expectedVersion.optional(),
    configuration: clinicConfigurationSchema, source: z.string().max(200).default('Owner settings') }),
  configurationTarget.extend({ action: z.literal('config.test'), summary: consultationSummarySchema,
    notes: z.string().max(4000).default('') }),
  configurationTarget.extend({ action: z.literal('config.activate'), approvedTestIds: z.array(uuid).min(1).max(100) }),
  z.object({ action: z.literal('config.rollback'), configurationVersionId: uuid, locationId: uuid.optional() }),
  z.object({ action: z.literal('location.create'), name: z.string().trim().min(1).max(200),
    address: z.string().max(1000).optional(), phone: z.string().max(100).optional() }),
  z.object({ action: z.literal('consultation.start'), locationId: uuid, reference: z.string().trim().max(100).optional(),
    consent: z.boolean(), idempotencyKey: z.string().trim().min(16).max(200) }),
  visit.extend({ action: z.literal('consultation.consent'), consent: z.boolean() }),
  visit.merge(reason).extend({ action: z.literal('consultation.summary.update'), summary: consultationSummarySchema }),
  visit.extend({ action: z.literal('consultation.initial.generate') }),
  visit.merge(reason).extend({ action: z.literal('consultation.initial.edit'),
    productIds: z.array(z.string().min(1).max(100)).max(100), explanation: z.string().max(20000) }),
  visit.extend({ action: z.literal('consultation.initial.approve') }),
  visit.merge(reason.partial()).extend({ action: z.literal('consultation.care.record'), actualCare: actualCareSchema }),
  visit.extend({ action: z.literal('consultation.wellness.generate') }),
  visit.merge(reason).extend({ action: z.literal('consultation.wellness.edit'),
    offerProductIds: z.array(z.string().min(1).max(100)).max(100),
    visitSummary: z.string().max(20000), explanation: z.string().max(20000) }),
  visit.extend({ action: z.literal('consultation.wellness.approve') }),
  visit.extend({ action: z.literal('consultation.outcome.record'), decision: wellnessDecisionSchema,
    reasonNote: z.string().max(4000).default('') }),
  visit.extend({ action: z.literal('consultation.archive'), reasonNote: z.string().trim().min(1).max(2000) }),
  visit.extend({ action: z.literal('consultation.restore') }),
  z.object({ action: z.literal('notification.read'), notificationId: uuid }),
  z.object({ action: z.literal('member.invite'), email: z.string().email().max(254),
    canApproveClinical: z.boolean().default(false), clinicalAuthorizationNote: z.string().max(4000).default('') }),
  z.object({ action: z.literal('member.update'), userId: uuid, isActive: z.boolean(),
    canApproveClinical: z.boolean(), clinicalAuthorizationNote: z.string().max(4000).default('') }),
  z.object({ action: z.literal('improvement.create'), title: z.string().trim().min(1).max(300),
    classification: z.enum(['APPROPRIATE_CORRECTION', 'UNSUITABLE_SUGGESTION', 'MISSED_SUITABLE_OPTION', 'CATALOG_OR_POLICY']),
    evidenceAdjustmentIds: z.array(uuid).min(1).max(100), notes: z.string().max(10000).default(''),
    configurationVersionId: uuid.optional() }),
  z.object({ action: z.literal('improvement.review'), improvementId: uuid,
    decision: z.enum(['APPROVED', 'REJECTED']), notes: z.string().max(10000).default('') }),
  z.object({ action: z.literal('improvement.test'), improvementId: uuid,
    configurationVersionId: uuid, expectedVersion, summary: consultationSummarySchema, notes: z.string().max(4000).default('') }),
  z.object({ action: z.literal('improvement.activate'), improvementId: uuid,
    configurationVersionId: uuid, expectedVersion, approvedTestIds: z.array(uuid).min(1).max(100) }),
]);
export type ClinicAction = z.infer<typeof clinicActionSchema>;

export type ConfigurationView = {
  id: string; version: number; revision: number; status: string; configuration: ClinicConfiguration;
  source: string; tests: unknown[]; createdAt: string; activatedAt: string | null;
};

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
function canonicalJson(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, canonicalJson(nested)]));
  return value;
}
function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}
export function assertClientDataAllowed(record: Pick<Consultation, 'isTest'>): void {
  if (!record.isTest && process.env.ALLOW_REAL_CLIENT_DATA !== 'true') {
    throw new ApiError(503, 'Client consultations are not enabled for this deployment. Use synthetic setup tests until client processing is enabled.', 'REAL_CLIENT_DATA_DISABLED');
  }
}
function owner(actor: ClinicActor) {
  if (actor.role !== 'SUPER_USER') throw new ApiError(403, 'Only the clinic owner can perform this action.', 'OWNER_REQUIRED');
}
function ownerMfa(actor: ClinicActor) {
  owner(actor);
  if (!actor.mfaEnabled || !actor.mfaVerified) throw new ApiError(403, 'Set up two-factor authentication in account settings before publishing protected clinic changes.', 'MFA_REQUIRED');
}
function clinician(actor: ClinicActor) {
  if (!actor.canApproveClinical) throw new ApiError(403, 'Clinical approval requires an authorized provider.', 'CLINICAL_AUTHORIZATION_REQUIRED');
}
function versionMatches(actual: number, expected: number) {
  if (actual !== expected) throw new ApiError(409, 'This record changed. Refresh it before saving your edits.', 'VERSION_CONFLICT');
}

type Tx = Prisma.TransactionClient;
async function transaction<T>(actor: ClinicActor, operation: (tx: Tx, currentActor: ClinicActor) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      return await getDb().$transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { id: actor.userId }, include: { tenant: true } });
        if (!current?.isActive || current.tenantId !== actor.tenantId || !current.tenant?.isActive) {
          throw new ApiError(403, 'Clinic access is no longer available.', 'ACCESS_CHANGED');
        }
        const session = await tx.authSession.findFirst({ where: { id: actor.sessionId, userId: current.id, revokedAt: null, expiresAt: { gt: new Date() } } });
        if (!session) throw new ApiError(401, 'Sign in again to continue.', 'SESSION_EXPIRED');
        return operation(tx, { ...actor, role: current.role, canApproveClinical: current.canApproveClinical,
          mfaEnabled: current.mfaEnabled, mfaVerified: Boolean(current.mfaEnabled && session.mfaVerifiedAt), mfaVerifiedAt: session.mfaVerifiedAt });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 20000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 11) continue;
      throw error;
    }
  }
  throw new ApiError(409, 'A concurrent change prevented saving. Refresh and try again.', 'VERSION_CONFLICT');
}

const consultationInclude = {
  configurationVersion: true,
  provider: { select: { firstName: true, lastName: true } },
  adjustments: { orderBy: { createdAt: 'desc' as const } },
  revisions: { orderBy: { createdAt: 'asc' as const } },
  events: { orderBy: { createdAt: 'asc' as const } },
  jobs: { orderBy: { createdAt: 'desc' as const }, take: 20 },
} satisfies Prisma.ConsultationInclude;
type FullConsultation = Prisma.ConsultationGetPayload<{ include: typeof consultationInclude }>;

function configurationView(record: ClinicConfigurationVersion): ConfigurationView {
  return {
    id: record.id, version: record.version, revision: record.revision, status: record.status,
    configuration: clinicConfigurationSchema.parse(record.payload), source: record.source,
    tests: Array.isArray(record.tests) ? record.tests : [], createdAt: record.createdAt.toISOString(),
    activatedAt: record.activatedAt?.toISOString() ?? null,
  };
}

async function location(tx: Tx, actor: ClinicActor, locationId: string) {
  const result = await tx.location.findFirst({ where: { id: locationId, tenantId: actor.tenantId, isActive: true } });
  if (!result) throw new ApiError(404, 'Clinic location was not found.', 'LOCATION_NOT_FOUND');
  return result;
}

async function configuration(tx: Tx, actor: ClinicActor, id: string) {
  const result = await tx.clinicConfigurationVersion.findFirst({ where: { id, tenantId: actor.tenantId } });
  if (!result) throw new ApiError(404, 'Configuration was not found.', 'CONFIGURATION_NOT_FOUND');
  return result;
}

async function consultation(tx: Tx, actor: ClinicActor, id: string, expected?: number) {
  const result = await tx.consultation.findFirst({ where: { id, tenantId: actor.tenantId }, include: { configurationVersion: true } });
  if (!result) throw new ApiError(404, 'Consultation was not found.', 'CONSULTATION_NOT_FOUND');
  if (expected !== undefined) versionMatches(result.version, expected);
  return result;
}

async function event(tx: Tx, actor: ClinicActor, visitId: string, action: string, before: unknown, after: unknown, artifactRevision?: number, note?: string) {
  await tx.consultationEvent.create({ data: {
    tenantId: actor.tenantId, consultationId: visitId, userId: actor.userId, action,
    before: before === undefined ? Prisma.JsonNull : jsonValue(before),
    after: after === undefined ? Prisma.JsonNull : jsonValue(after),
    artifactRevision, reason: note,
  } });
}

async function adjustment(tx: Tx, actor: ClinicActor, visitId: string, kind: string, revision: number, before: unknown, after: unknown, category: string, note = '') {
  const beforeObject = before && typeof before === 'object' ? before as Record<string, unknown> : {};
  const afterObject = after && typeof after === 'object' ? after as Record<string, unknown> : {};
  const changedFields = [...new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)])]
    .filter(key => !sameJson(beforeObject[key], afterObject[key]));
  if (!changedFields.length) return;
  await tx.consultationAdjustment.create({ data: {
    tenantId: actor.tenantId, consultationId: visitId, userId: actor.userId,
    kind, revision, before: jsonValue(before), after: jsonValue(after), changedFields,
    reason: category, note,
  } });
}

async function revision(tx: Tx, actor: ClinicActor, visitId: string, kind: string, number: number, payload: unknown, original: boolean, category?: string) {
  await tx.consultationRevision.create({ data: {
    tenantId: actor.tenantId, consultationId: visitId, kind, revision: number,
    payload: jsonValue(payload), original, userId: actor.userId, reason: category,
    model: original && (kind === 'INITIAL' || kind === 'WELLNESS') ? 'deterministic-rules' : undefined,
    promptVersion: original ? (kind === 'INITIAL' || kind === 'WELLNESS'
      ? generationEngineVersion(kind, payload) : 'dripwell-rules-v2.1') : undefined,
  } });
}

async function revokeTakeaways(tx: Tx, actor: Pick<ClinicActor, 'tenantId'>, visitId: string) {
  const now = new Date();
  const takeaways = await tx.takeaway.findMany({ where: { tenantId: actor.tenantId, consultationId: visitId }, select: { id: true } });
  const ids = takeaways.map(item => item.id);
  if (!ids.length) return;
  await tx.takeaway.updateMany({ where: { id: { in: ids }, tenantId: actor.tenantId, revokedAt: null }, data: { revokedAt: now } });
  const shares = await tx.shareLink.findMany({ where: { tenantId: actor.tenantId, takeawayId: { in: ids } }, select: { id: true } });
  await tx.shareLink.updateMany({ where: { tenantId: actor.tenantId, takeawayId: { in: ids }, revokedAt: null }, data: { revokedAt: now } });
  if (shares.length) await tx.shareSession.updateMany({ where: { shareLinkId: { in: shares.map(item => item.id) }, revokedAt: null }, data: { revokedAt: now } });
}

const invalidateClinical = {
  clinicalApprovedVersion: null, clinicalApprovedById: null, clinicalApprovedAt: null,
  wellnessApprovedVersion: null, wellnessApprovedById: null, wellnessApprovedAt: null,
  wellnessDecisionRevision: null,
};
const invalidateWellness = { wellnessApprovedVersion: null, wellnessApprovedById: null, wellnessApprovedAt: null, wellnessDecisionRevision: null };

async function dismissReminders(tx: Tx, actor: ClinicActor, visitId: string, type?: 'CARE_OUTCOME_NEEDED' | 'WELLNESS_DECISION_NEEDED') {
  await tx.notification.updateMany({ where: {
    tenantId: actor.tenantId, consultationId: visitId, dismissedAt: null,
    ...(type ? { type } : {}),
  }, data: { dismissedAt: new Date(), isRead: true } });
}

async function configAudit(tx: Tx, actor: ClinicActor, id: string, details: unknown) {
  await tx.auditLog.create({ data: {
    tenantId: actor.tenantId, userId: actor.userId, action: 'SETTINGS_CHANGED',
    entityType: 'ClinicConfigurationVersion', entityId: id, details: jsonValue(details),
  } });
}

export type ConsultationView = Omit<Consultation,
  'createdAt' | 'updatedAt' | 'consentAt' | 'clinicalApprovedAt' | 'wellnessApprovedAt' |
  'archivedAt' | 'careOutcomeDueAt' | 'wellnessDecisionDueAt' | 'summary' | 'initialRecommendation' |
  'actualCare' | 'wellnessPlan' | 'transcript' | 'completedAt'> & {
  createdAt: string; updatedAt: string; consentAt: string | null; clinicalApprovedAt: string | null;
  wellnessApprovedAt: string | null; archivedAt: string | null; completedAt: string | null; careOutcomeDueAt: string | null;
  wellnessDecisionDueAt: string | null; summary: ConsultationSummary;
  initialRecommendation: InitialRecommendation | null; actualCare: ActualCare | null;
  wellnessPlan: WellnessPlan | null; transcript: unknown[]; providerName: string;
  configuration: ClinicConfiguration; questionStates: import('@dripwell/shared/v2').QuestionState[];
  decisionNeedsReview: boolean; adjustments: unknown[]; revisions: unknown[]; events: unknown[]; jobs: unknown[];
};
export type ClinicMetrics = MembershipMetrics & {
  from: string; to: string; denominator: number; consultations: number;
  careStarted: number; careNotStarted: number; carePending: number;
  wellnessAccepted: number; wellnessRejected: number; wellnessTbd: number;
  wellnessUndecided: number; adjustments: number; overdue: number;
  completionMedianHours: number | null;
};
export type ClinicDashboard = {
  user: { id: string; name: string; email: string; role: string; canApproveClinical: boolean };
  clinic: { id: string; name: string; slug: string };
  locations: { id: string; name: string; address: string | null; phone: string | null }[];
  configuration: { draft: ConfigurationView | null; active: ConfigurationView | null; versions: ConfigurationView[] };
  consultations: ConsultationView[]; consultationCount: number; notifications: unknown[];
  consultationPagination: { nextCursor: string | null; pageSize: number };
  metrics: ClinicMetrics; improvements: unknown[]; adjustments: unknown[];
  staff: { id: string; name: string; email: string; role: string; isActive: boolean; canApproveClinical: boolean }[];
  trial: { status: string; activatedAt: string | null; endsAt: string | null; used: number; limit: number;
    remaining: number; daysRemaining: number; canStart: boolean };
  referral: { code: string | null; url: string | null; referred: number; converted: number;
    balances: CreditBalance[]; creditBalanceCents: number | null; currency: string | null } | null;
};

function dateRange(input: { from?: string | null; to?: string | null }) {
  const to = input.to ? new Date(input.to) : new Date();
  const from = input.from ? new Date(input.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to || to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new ApiError(400, 'Choose a valid reporting period of at most one year.', 'INVALID_DATE_RANGE');
  }
  return { from, to };
}

export const clinicDashboardQuerySchema = z.object({
  locationId: uuid.nullish(), archived: z.boolean().default(false),
  from: z.string().max(100).nullish(), to: z.string().max(100).nullish(),
  search: z.string().trim().max(100).default(''), cursor: uuid.nullish(),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export async function getClinicDashboard(actor: ClinicActor, input: z.input<typeof clinicDashboardQuerySchema> = {}): Promise<ClinicDashboard> {
  const options = clinicDashboardQuerySchema.parse(input);
  return transaction(actor, async (tx, currentActor) => {
    const locations = await tx.location.findMany({ where: { tenantId: currentActor.tenantId, isActive: true }, orderBy: { createdAt: 'asc' } });
    const locationId = options.locationId ?? currentActor.locationId ?? locations[0]?.id;
    if (!locationId || !locations.some(item => item.id === locationId)) throw new ApiError(404, 'Clinic location was not found.', 'LOCATION_NOT_FOUND');
    const period = dateRange(options);
    const periodWhere = { tenantId: currentActor.tenantId, locationId, isTest: false, createdAt: { gte: period.from, lt: period.to } };
    // Archive browsing covers all retained dates; reporting remains scoped to the selected period.
    const searchText = options.search.replace(/[\\%_]/g, '\\$&');
    const boardWhere: Prisma.ConsultationWhereInput = {
      tenantId: currentActor.tenantId, locationId, isTest: false,
      archivedAt: options.archived ? { not: null } : null,
      ...(!options.archived ? { createdAt: { gte: period.from, lt: period.to } } : {}),
      ...(searchText ? { OR: [
        { reference: { contains: searchText, mode: 'insensitive' } },
        { provider: { AND: searchText.split(/\s+/).map(word => ({ OR: [
          { firstName: { contains: word, mode: 'insensitive' as const } },
          { lastName: { contains: word, mode: 'insensitive' as const } },
        ] })) } },
      ] } : {}),
    };
    const anchor = options.cursor ? await tx.consultation.findFirst({
      where: { AND: [boardWhere, { id: options.cursor }] }, select: { id: true, createdAt: true },
    }) : null;
    if (options.cursor && !anchor) throw new ApiError(400, 'This page is no longer available. Refresh your search.', 'INVALID_CURSOR');
    // Immutable creation time plus the unique ID keeps equal timestamps on deterministic pages.
    const pageWhere: Prisma.ConsultationWhereInput = anchor ? { AND: [boardWhere, { OR: [
      { createdAt: { lt: anchor.createdAt } },
      { createdAt: anchor.createdAt, id: { lt: anchor.id } },
    ] }] } : boardWhere;
    const isOwner = currentActor.role === 'SUPER_USER';
    const [versions, visits, consultationCount, notifications, careGroups, decisionGroups, outcomes,
      adjustmentCount, overdue, subscription, staff, proposals, changes, tenant, referralCount, convertedCount, credits] = await Promise.all([
      tx.clinicConfigurationVersion.findMany({ where: { tenantId: currentActor.tenantId, locationId,
        ...(!isOwner ? { status: 'ACTIVE' as const } : {}) }, orderBy: { version: 'desc' }, take: 100 }),
      tx.consultation.findMany({ where: pageWhere, include: consultationInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: options.pageSize + 1 }),
      tx.consultation.count({ where: boardWhere }),
      tx.notification.findMany({ where: { tenantId: currentActor.tenantId, dismissedAt: null,
        OR: [{ userId: currentActor.userId }, { userId: null }] }, orderBy: { createdAt: 'desc' }, take: 100 }),
      tx.consultation.groupBy({ by: ['careOutcome'], where: periodWhere, _count: { _all: true } }),
      tx.consultation.groupBy({ by: ['wellnessDecision'], where: { ...periodWhere,
        wellnessDecisionRevision: { equals: tx.consultation.fields.wellnessRevision },
        wellnessApprovedVersion: { equals: tx.consultation.fields.wellnessRevision } }, _count: { _all: true } }),
      tx.consultation.findMany({ where: periodWhere, select: { actualCare: true, createdAt: true, completedAt: true, careOutcome: true, wellnessDecision: true } }),
      tx.consultationAdjustment.count({ where: { tenantId: currentActor.tenantId, consultation: periodWhere } }),
      tx.consultation.count({ where: { tenantId: currentActor.tenantId, locationId, isTest: false, archivedAt: null,
        OR: [{ careOutcome: 'PENDING', careOutcomeDueAt: { lte: new Date() } },
          { wellnessPlan: { not: Prisma.DbNull }, wellnessDecisionDueAt: { lte: new Date() }, OR: [{ wellnessDecision: null }, { wellnessDecision: 'TBD' },
            { wellnessDecisionRevision: null }, { NOT: { wellnessDecisionRevision: { equals: tx.consultation.fields.wellnessRevision } } },
            { wellnessApprovedVersion: null }, { NOT: { wellnessApprovedVersion: { equals: tx.consultation.fields.wellnessRevision } } }] }] } }),
      tx.subscription.findUnique({ where: { tenantId: currentActor.tenantId } }),
      tx.user.findMany({ where: { tenantId: currentActor.tenantId }, orderBy: { firstName: 'asc' },
        select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, canApproveClinical: true } }),
      isOwner ? tx.improvementProposal.findMany({ where: { tenantId: currentActor.tenantId }, orderBy: { createdAt: 'desc' }, take: 100 }) : Promise.resolve([]),
      isOwner ? tx.consultationAdjustment.findMany({ where: { tenantId: currentActor.tenantId, consultation: { locationId, isTest: false } },
        include: { consultation: { select: { reference: true, summary: true, actualCare: true, wellnessDecision: true, configurationVersionId: true } } },
        orderBy: { createdAt: 'desc' }, take: 100 }) : Promise.resolve([]),
      tx.tenant.findUniqueOrThrow({ where: { id: currentActor.tenantId } }),
      isOwner ? tx.referral.count({ where: { referrerTenantId: currentActor.tenantId } }) : Promise.resolve(0),
      isOwner ? tx.referral.count({ where: { referrerTenantId: currentActor.tenantId, convertedAt: { not: null } } }) : Promise.resolve(0),
      isOwner ? tx.creditLedger.findMany({ where: { tenantId: currentActor.tenantId },
        select: { id: true, sourceEventId: true, reversesId: true, kind: true, amountCents: true, currency: true } }) : Promise.resolve([]),
    ]);
    // Counts and unknown outcomes share one complete cohort within the serializable snapshot.
    const denominator = outcomes.length;
    const memberships = membershipMetrics(outcomes);
    const configurations = versions.map(configurationView);
    const now = Date.now();
    const trialLimit = subscription?.trialLimit ?? 10;
    const used = subscription?.trialUsed ?? 0;
    const allowance = evaluateTrialAllowance(subscription, new Date(now));
    const durations = outcomes.filter(item => item.completedAt)
      .map(item => (item.completedAt!.getTime() - item.createdAt.getTime()) / 3600000).sort((a, b) => a - b);
    const median = durations.length ? (durations[Math.floor((durations.length - 1) / 2)]! + durations[Math.floor(durations.length / 2)]!) / 2 : null;
    const careCount = (value: string) => careGroups.find(item => item.careOutcome === value)?._count._all ?? 0;
    const decisionCount = (value: string | null) => decisionGroups.find(item => item.wellnessDecision === value)?._count._all ?? 0;
    const baseUrl = process.env.APP_URL;
    const balances = ledgerBalances(credits);
    return {
      user: { id: currentActor.userId, name: `${currentActor.firstName} ${currentActor.lastName}`.trim(),
        email: currentActor.email, role: currentActor.role, canApproveClinical: currentActor.canApproveClinical },
      clinic: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      locations: locations.map(item => ({ id: item.id, name: item.name, address: item.address, phone: item.phone })),
      configuration: { draft: configurations.find(item => item.status === 'DRAFT' || item.status === 'TESTED') ?? null,
        active: configurations.find(item => item.status === 'ACTIVE') ?? null, versions: configurations },
      consultations: visits.slice(0, options.pageSize).map(consultationView), consultationCount,
      consultationPagination: { pageSize: options.pageSize,
        nextCursor: visits.length > options.pageSize ? visits[options.pageSize - 1]!.id : null },
      notifications: JSON.parse(JSON.stringify(notifications)),
      metrics: { from: period.from.toISOString(), to: period.to.toISOString(), denominator, consultations: denominator,
        careStarted: careCount('STARTED'), careNotStarted: careCount('NOT_STARTED'), carePending: careCount('PENDING'),
        wellnessAccepted: decisionCount('ACCEPTED'), wellnessRejected: decisionCount('REJECTED'), wellnessTbd: decisionCount('TBD'),
        wellnessUndecided: denominator - decisionCount('ACCEPTED') - decisionCount('REJECTED') - decisionCount('TBD'),
        ...memberships, adjustments: adjustmentCount, overdue, completionMedianHours: median },
      improvements: JSON.parse(JSON.stringify(proposals)), adjustments: JSON.parse(JSON.stringify(changes)),
      staff: staff.map(item => ({ id: item.id, name: `${item.firstName} ${item.lastName}`.trim(), email: item.email,
        role: item.role, isActive: item.isActive, canApproveClinical: item.canApproveClinical })),
      trial: { status: subscription?.status ?? 'NOT_STARTED', activatedAt: subscription?.trialActivatedAt?.toISOString() ?? null,
        endsAt: subscription?.trialEndsAt?.toISOString() ?? null, used, limit: trialLimit, remaining: Math.max(0, trialLimit - used),
        daysRemaining: subscription?.trialEndsAt ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now) / 86400000)) : 14,
        canStart: allowance.canStart && process.env.ALLOW_REAL_CLIENT_DATA === 'true' },
      referral: isOwner ? { code: tenant.referralCode, url: tenant.referralCode && baseUrl ? `${baseUrl}/register?ref=${encodeURIComponent(tenant.referralCode)}` : null,
        referred: referralCount, converted: convertedCount, balances,
        creditBalanceCents: balances.length === 1 ? balances[0]!.availableCents : null,
        currency: balances.length === 1 ? balances[0]!.currency : null } : null,
    };
  });
}

export async function getConsultation(actor: ClinicActor, id: string) {
  return transaction(actor, async (tx, currentActor) => {
    const result = await tx.consultation.findFirst({ where: { id, tenantId: currentActor.tenantId }, include: consultationInclude });
    if (!result) throw new ApiError(404, 'Consultation was not found.', 'CONSULTATION_NOT_FOUND');
    return { consultation: consultationView(result), configuration: configurationView(result.configurationVersion) };
  });
}

function consultationView(record: FullConsultation): ConsultationView {
  const config = clinicConfigurationSchema.parse(record.configurationVersion.payload);
  const summary = consultationSummarySchema.parse(record.summary);
  const initial = record.initialRecommendation ? initialRecommendationSchema.parse(record.initialRecommendation) : null;
  const care = record.actualCare ? actualCareSchema.parse(record.actualCare) : null;
  const wellness = record.wellnessPlan ? wellnessPlanSchema.parse(record.wellnessPlan) : null;
  const { configurationVersion: _config, provider, adjustments, revisions, events, jobs, ...base } = record;
  return {
    ...base, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    consentAt: record.consentAt?.toISOString() ?? null, clinicalApprovedAt: record.clinicalApprovedAt?.toISOString() ?? null,
    wellnessApprovedAt: record.wellnessApprovedAt?.toISOString() ?? null, archivedAt: record.archivedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    careOutcomeDueAt: record.careOutcomeDueAt?.toISOString() ?? null, wellnessDecisionDueAt: record.wellnessDecisionDueAt?.toISOString() ?? null,
    summary, initialRecommendation: initial, actualCare: care, wellnessPlan: wellness,
    transcript: Array.isArray(record.transcript) ? record.transcript : [],
    providerName: `${provider.firstName} ${provider.lastName}`.trim(), configuration: config,
    questionStates: evaluateRequiredQuestions(config, summary),
    decisionNeedsReview: !!record.wellnessDecision && (record.wellnessDecisionRevision !== record.wellnessRevision || !isExactApproval(record.wellnessRevision, record.wellnessApprovedVersion)),
    adjustments: JSON.parse(JSON.stringify(adjustments)), revisions: JSON.parse(JSON.stringify(revisions)),
    events: JSON.parse(JSON.stringify(events)), jobs: JSON.parse(JSON.stringify(jobs)),
  };
}

function validate(errors: string[], message = 'The recommendation needs review.') {
  if (errors.length) throw new ApiError(422, `${message} ${errors.join(' ')}`, 'CLINICAL_REVIEW_REQUIRED');
}
export async function noPendingEvidence(tx: Pick<Tx, 'generationJob' | 'recordingSegment'>, actor: Pick<ClinicActor, 'tenantId'>, visitId: string) {
  const [pendingJobs, pendingUploads] = await Promise.all([
    tx.generationJob.count({ where: { tenantId: actor.tenantId, consultationId: visitId,
      kind: { in: ['TRANSCRIPTION', 'SUMMARY', 'CONSULTATION_SUMMARY'] }, status: { in: ['PENDING', 'QUEUING', 'RUNNING'] } } }),
    tx.recordingSegment.count({ where: { tenantId: actor.tenantId, consultationId: visitId, status: { notIn: ['TRANSCRIBED', 'DISCARDED'] } } }),
  ]);
  if (pendingJobs || pendingUploads) throw new ApiError(422, 'Finish processing and review the new recording before approving this visit.', 'EVIDENCE_PROCESSING');
}

async function saveDraft(tx: Tx, actor: ClinicActor, input: Extract<ClinicAction, { action: 'config.saveDraft' }>) {
  owner(actor);
  const locationId = input.locationId ?? actor.locationId;
  await location(tx, actor, locationId);
  if (input.configurationVersionId) {
    const previous = await configuration(tx, actor, input.configurationVersionId);
    if (previous.locationId !== locationId) throw new ApiError(404, 'Configuration was not found at this location.', 'CONFIGURATION_NOT_FOUND');
    if (previous.status === 'ACTIVE' || previous.status === 'RETIRED') throw new ApiError(409, 'Active and historical settings are immutable. Create a new draft.', 'IMMUTABLE_CONFIGURATION');
    if (input.expectedVersion === undefined) throw new ApiError(400, 'Refresh the draft before saving.', 'EXPECTED_VERSION_REQUIRED');
    versionMatches(previous.revision, input.expectedVersion);
    const saved = await tx.clinicConfigurationVersion.update({ where: { id: previous.id }, data: {
      payload: jsonValue(input.configuration), tests: [], status: 'DRAFT', source: input.source,
      revision: { increment: 1 }, userId: actor.userId,
    } });
    await configAudit(tx, actor, saved.id, { action: 'DRAFT_UPDATED', beforeRevision: previous.revision, afterRevision: saved.revision });
    return configurationView(saved);
  }
  const latest = await tx.clinicConfigurationVersion.findFirst({ where: { tenantId: actor.tenantId, locationId }, orderBy: { version: 'desc' } });
  const saved = await tx.clinicConfigurationVersion.create({ data: {
    tenantId: actor.tenantId, locationId, version: (latest?.version ?? 0) + 1,
    payload: jsonValue(input.configuration), source: input.source, userId: actor.userId,
  } });
  await configAudit(tx, actor, saved.id, { action: 'DRAFT_CREATED', version: saved.version });
  return configurationView(saved);
}

async function testConfiguration(tx: Tx, actor: ClinicActor, input: {
  configurationVersionId: string; expectedVersion: number; summary: ConsultationSummary; notes: string;
}) {
  owner(actor);
  const record = await configuration(tx, actor, input.configurationVersionId);
  versionMatches(record.revision, input.expectedVersion);
  if (record.status === 'ACTIVE' || record.status === 'RETIRED') throw new ApiError(409, 'Create a draft before testing a change.', 'IMMUTABLE_CONFIGURATION');
  const config = clinicConfigurationSchema.parse(record.payload);
  const result = configurationTestSchema.parse({ id: randomUUID(), testedAt: new Date().toISOString(),
    summary: input.summary, initial: recommendInitial(config, input.summary, record.id),
    approvedByOwner: false, notes: input.notes });
  const tests = Array.isArray(record.tests) ? record.tests : [];
  const saved = await tx.clinicConfigurationVersion.update({ where: { id: record.id }, data: {
    tests: jsonValue([...tests.slice(-99), result]), status: 'TESTED', revision: { increment: 1 },
  } });
  await configAudit(tx, actor, record.id, { action: 'SYNTHETIC_TEST', testId: result.id, configurationRevision: record.revision });
  return { configuration: configurationView(saved), test: result };
}

async function activateConfiguration(tx: Tx, actor: ClinicActor, input: {
  configurationVersionId: string; expectedVersion: number; approvedTestIds: string[];
}) {
  ownerMfa(actor);
  const record = await configuration(tx, actor, input.configurationVersionId);
  versionMatches(record.revision, input.expectedVersion);
  if (record.status !== 'TESTED') throw new ApiError(409, 'Run and review a synthetic test before activation.', 'CONFIGURATION_TEST_REQUIRED');
  const config = clinicConfigurationSchema.parse(record.payload);
  validate(validateConfigurationForActivation(config), 'Settings are not ready for activation.');
  const clinicalProducts = config.products.some(product => product.available && product.clinical);
  if (clinicalProducts) clinician(actor);
  const tests = z.array(configurationTestSchema).parse(record.tests);
  const selectedTests = tests.filter(test => input.approvedTestIds.includes(test.id));
  if (!selectedTests.length || selectedTests.length !== new Set(input.approvedTestIds).size) throw new ApiError(422, 'Review the saved synthetic test results before activation.', 'CONFIGURATION_TEST_REQUIRED');
  if (!selectedTests.some(test => !test.initial.blocked)) throw new ApiError(422, 'Review at least one complete eligible test consultation before activation.', 'SUCCESSFUL_TEST_REQUIRED');
  const approvedTests = tests.map(test => ({ ...test, approvedByOwner: test.approvedByOwner || input.approvedTestIds.includes(test.id) }));
  await tx.clinicConfigurationVersion.updateMany({ where: { tenantId: actor.tenantId, locationId: record.locationId, status: 'ACTIVE' }, data: { status: 'RETIRED' } });
  const active = await tx.clinicConfigurationVersion.update({ where: { id: record.id }, data: {
    status: 'ACTIVE', tests: jsonValue(approvedTests), activatedAt: new Date(), activatedById: actor.userId,
    clinicalValidatedById: clinicalProducts ? actor.userId : null, revision: { increment: 1 },
  } });
  await configAudit(tx, actor, record.id, { action: 'CONFIGURATION_ACTIVATED', version: record.version, approvedTestIds: input.approvedTestIds,
    clinicalValidatedById: active.clinicalValidatedById });
  return configurationView(active);
}

async function rollbackConfiguration(tx: Tx, actor: ClinicActor, id: string, locationId?: string) {
  ownerMfa(actor);
  const historical = await configuration(tx, actor, id);
  if (locationId && historical.locationId !== locationId) throw new ApiError(404, 'Configuration was not found.', 'CONFIGURATION_NOT_FOUND');
  if (historical.status !== 'RETIRED' || !historical.activatedAt) throw new ApiError(409, 'Only a previously activated configuration can be restored.', 'ROLLBACK_NOT_AVAILABLE');
  const payload = clinicConfigurationSchema.parse(historical.payload);
  validate(validateConfigurationForActivation(payload), 'Historical settings no longer satisfy activation requirements.');
  if (payload.products.some(product => product.available && product.clinical)) clinician(actor);
  const latest = await tx.clinicConfigurationVersion.findFirst({ where: { tenantId: actor.tenantId, locationId: historical.locationId }, orderBy: { version: 'desc' } });
  await tx.clinicConfigurationVersion.updateMany({ where: { tenantId: actor.tenantId, locationId: historical.locationId, status: 'ACTIVE' }, data: { status: 'RETIRED' } });
  const active = await tx.clinicConfigurationVersion.create({ data: {
    tenantId: actor.tenantId, locationId: historical.locationId, version: (latest?.version ?? 0) + 1,
    status: 'ACTIVE', payload: historical.payload as Prisma.InputJsonValue,
    source: `Rollback of version ${historical.version}`, userId: actor.userId,
    tests: historical.tests as Prisma.InputJsonValue, activatedAt: new Date(), activatedById: actor.userId,
    clinicalValidatedById: historical.clinicalValidatedById,
  } });
  await configAudit(tx, actor, active.id, { action: 'CONFIGURATION_ROLLBACK', restoredVersionId: historical.id, version: active.version });
  return configurationView(active);
}

async function startConsultation(tx: Tx, actor: ClinicActor, input: Extract<ClinicAction, { action: 'consultation.start' }>) {
  // A clinic lock and serializable transaction protect concurrent trial starts.
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Tenant" WHERE "id" = ${actor.tenantId}::uuid FOR UPDATE`);
  const existing = await tx.consultation.findUnique({ where: { tenantId_idempotencyKey: { tenantId: actor.tenantId, idempotencyKey: input.idempotencyKey } } });
  if (existing) {
    if (existing.locationId !== input.locationId) throw new ApiError(409, 'This start request belongs to another location.', 'IDEMPOTENCY_CONFLICT');
    return { id: existing.id, resumed: true };
  }
  await location(tx, actor, input.locationId);
  const active = await tx.clinicConfigurationVersion.findFirst({ where: { tenantId: actor.tenantId, locationId: input.locationId, status: 'ACTIVE' } });
  if (!active) throw new ApiError(422, 'The owner must activate tested clinic settings before a consultation can start.', 'ACTIVE_CONFIGURATION_REQUIRED');
  const config = clinicConfigurationSchema.parse(active.payload);
  assertClientDataAllowed({ isTest: false });
  validate(validateConfigurationForActivation(config), 'Clinic settings require owner review.');
  const subscription = await tx.subscription.findUnique({ where: { tenantId: actor.tenantId } });
  const allowance = evaluateTrialAllowance(subscription);
  if (!allowance.canStart) throw new ApiError(402,
    allowance.reason === 'LIMIT_REACHED' ? 'The trial includes 10 initial consultations. Existing visits can still be completed.' :
      allowance.reason === 'TIME_EXPIRED' ? 'The 14-day trial has ended. Existing visits can still be completed.' :
        'An active trial or subscription is required to start a consultation.', allowance.reason);
  const now = new Date();
  const created = await tx.consultation.create({ data: {
    tenantId: actor.tenantId, locationId: input.locationId, providerId: actor.userId,
    configurationVersionId: active.id, reference: input.reference?.trim() || `DW-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`,
    idempotencyKey: input.idempotencyKey, summary: jsonValue(emptyConsultationSummary()),
    consentAt: input.consent ? now : null, consentDeclined: !input.consent,
    careOutcomeDueAt: new Date(now.getTime() + config.reminders.careOutcomeHours * 3600000),
  } });
  if (subscription?.status === 'TRIAL') {
    const consumed = await tx.subscription.updateMany({ where: {
      id: subscription.id, status: 'TRIAL', trialUsed: { lt: subscription.trialLimit }, trialEndsAt: { gt: now },
    }, data: { trialUsed: { increment: 1 } } });
    if (consumed.count !== 1) throw new ApiError(402, 'The trial allowance is exhausted. Existing visits can still be completed.', 'LIMIT_REACHED');
    await tx.trialUsage.create({ data: { tenantId: actor.tenantId, consultationId: created.id, idempotencyKey: input.idempotencyKey } });
  }
  await event(tx, actor, created.id, 'CONSULTATION_STARTED', null, { stage: created.stage, consent: input.consent, configurationVersionId: active.id });
  return { id: created.id, resumed: false };
}

function generationEngineVersion(kind: 'INITIAL' | 'WELLNESS', result: unknown) {
  return kind === 'INITIAL' ? initialRecommendationSchema.parse(result).engineVersion
    : wellnessPlanSchema.parse(result).engineVersion;
}

async function logGeneration(tx: Tx, actor: ClinicActor, record: Consultation, kind: 'INITIAL' | 'WELLNESS', number: number, result: unknown) {
  const now = new Date();
  await tx.generationJob.create({ data: {
    tenantId: actor.tenantId, consultationId: record.id, userId: actor.userId, kind,
    status: 'COMPLETE', idempotencyKey: `${kind}:${record.id}:${number}`,
    model: 'deterministic-rules', promptVersion: generationEngineVersion(kind, result), result: jsonValue(result),
    usage: { inputTokens: 0, outputTokens: 0, costCents: 0 }, startedAt: now, completedAt: now,
  } });
}

function productSnapshots(config: ClinicConfiguration, summary: ConsultationSummary, ids: string[], types: string[]) {
  if (new Set(ids).size !== ids.length) throw new ApiError(422, 'Select each catalog item once.', 'DUPLICATE_PRODUCT');
  return ids.map(id => {
    const product = config.products.find(item => item.id === id && types.includes(item.type));
    if (!product) throw new ApiError(422, 'Choose an item from this location’s approved catalog.', 'CATALOG_ITEM_REQUIRED');
    const eligibility = evaluateProductEligibility(product, config, summary);
    validate(eligibility.flags, `${product.name} is not eligible.`);
    if (product.priceCents === null) throw new ApiError(422, 'Confirm official pricing before using this item.', 'OFFICIAL_PRICE_REQUIRED');
    return { productId: product.id, name: product.name, type: product.type, priceCents: product.priceCents,
      currency: product.currency, quantity: 1, rationale: product.rules.rationale, evidence: eligibility.evidence, terms: product.terms };
  });
}

async function updateVisit(tx: Tx, actor: ClinicActor, input: Extract<ClinicAction, { consultationId: string }>) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Consultation" WHERE "id" = ${input.consultationId}::uuid AND "tenantId" = ${actor.tenantId}::uuid FOR UPDATE`);
  const record = await consultation(tx, actor, input.consultationId, input.expectedVersion);
  if (input.action !== 'consultation.archive' && input.action !== 'consultation.restore' && !(input.action === 'consultation.consent' && !input.consent)) assertClientDataAllowed(record);
  if (record.archivedAt && input.action !== 'consultation.restore' && input.action !== 'consultation.archive') {
    throw new ApiError(409, 'Restore this consultation before editing it.', 'CONSULTATION_ARCHIVED');
  }
  const config = clinicConfigurationSchema.parse(record.configurationVersion.payload);
  const summary = consultationSummarySchema.parse(record.summary);
  const now = new Date();
  let data: Prisma.ConsultationUpdateInput = { version: { increment: 1 } };
  let before: unknown;
  let after: unknown;
  let artifactRevision: number | undefined;
  let note: string | undefined;

  switch (input.action) {
    case 'consultation.consent': {
      before = { consentAt: record.consentAt, consentDeclined: record.consentDeclined };
      after = { consent: input.consent };
      data = { ...data, consentAt: input.consent ? now : null, consentDeclined: !input.consent };
      break;
    }
    case 'consultation.summary.update': {
      if (sameJson(summary, input.summary)) return { id: record.id, unchanged: true };
      artifactRevision = record.summaryRevision + 1;
      before = summary; after = input.summary; note = input.reasonNote;
      await adjustment(tx, actor, record.id, 'SUMMARY', artifactRevision, before, after, input.reason, input.reasonNote);
      await revision(tx, actor, record.id, 'SUMMARY', artifactRevision, after, false, input.reason);
      await revokeTakeaways(tx, actor, record.id);
      data = { ...data, summary: jsonValue(input.summary), summaryRevision: artifactRevision, ...invalidateClinical, completedAt: null,
        ...(record.wellnessPlan ? { wellnessDecisionDueAt: new Date(now.getTime() + config.reminders.wellnessDecisionHours * 3600000) } : {}) };
      break;
    }
    case 'consultation.initial.generate': {
      const initial = recommendInitial(config, summary, record.configurationVersionId);
      if (sameJson(record.initialRecommendation, initial) && record.initialSummaryRevision === record.summaryRevision) return { id: record.id, unchanged: true };
      artifactRevision = record.initialRevision + 1;
      before = { stage: record.stage, recommendation: record.initialRecommendation };
      const stage = transitionStage(record.stage, 'INITIAL_PRODUCED');
      after = { stage, recommendation: initial };
      await revision(tx, actor, record.id, 'INITIAL', artifactRevision, initial, true);
      await logGeneration(tx, actor, record, 'INITIAL', artifactRevision, initial);
      await revokeTakeaways(tx, actor, record.id);
      data = { ...data, initialRecommendation: jsonValue(initial), initialRevision: artifactRevision, initialSummaryRevision: record.summaryRevision,
        stage, ...invalidateClinical, completedAt: null,
        ...(record.wellnessPlan ? { wellnessDecisionDueAt: new Date(now.getTime() + config.reminders.wellnessDecisionHours * 3600000) } : {}) };
      break;
    }
    case 'consultation.initial.edit': {
      if (!record.initialRecommendation) throw new ApiError(422, 'Generate the initial draft before editing it.', 'INITIAL_RECOMMENDATION_REQUIRED');
      const computed = recommendInitial(config, summary, record.configurationVersionId);
      const items = productSnapshots(config, summary, input.productIds, ['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE']);
      const initial = initialRecommendationSchema.parse({ ...computed, items, explanation: input.explanation });
      if (items.length) validate(validateInitialSelection(config, summary, initial));
      if (sameJson(record.initialRecommendation, initial) && record.initialSummaryRevision === record.summaryRevision) return { id: record.id, unchanged: true };
      artifactRevision = record.initialRevision + 1;
      before = record.initialRecommendation; after = initial; note = input.reasonNote;
      await adjustment(tx, actor, record.id, 'INITIAL', artifactRevision, before, after, input.reason, input.reasonNote);
      await revision(tx, actor, record.id, 'INITIAL', artifactRevision, initial, false, input.reason);
      await revokeTakeaways(tx, actor, record.id);
      data = { ...data, initialRecommendation: jsonValue(initial), initialRevision: artifactRevision, initialSummaryRevision: record.summaryRevision,
        ...invalidateClinical, completedAt: null,
        ...(record.wellnessPlan ? { wellnessDecisionDueAt: new Date(now.getTime() + config.reminders.wellnessDecisionHours * 3600000) } : {}) };
      break;
    }
    case 'consultation.initial.approve': {
      clinician(actor);
      await noPendingEvidence(tx, actor, record.id);
      if (!record.initialRecommendation) throw new ApiError(422, 'Generate an initial recommendation before approving it.', 'INITIAL_RECOMMENDATION_REQUIRED');
      const initial = initialRecommendationSchema.parse(record.initialRecommendation);
      if (record.initialSummaryRevision !== record.summaryRevision) throw new ApiError(422, 'Regenerate the initial recommendation to use the corrected summary.', 'SUMMARY_REVISION_CHANGED');
      validate(validateInitialSelection(config, summary, initial));
      if (isExactApproval(record.initialRevision, record.clinicalApprovedVersion)) return { id: record.id, unchanged: true };
      artifactRevision = record.initialRevision;
      before = { approvedVersion: record.clinicalApprovedVersion };
      after = { approvedVersion: record.initialRevision, providerId: actor.userId };
      data = { ...data, clinicalApprovedVersion: record.initialRevision, clinicalApprovedById: actor.userId, clinicalApprovedAt: now };
      break;
    }
    case 'consultation.care.record': {
      const supplied = input.actualCare;
      if (supplied.outcome === 'STARTED') await noPendingEvidence(tx, actor, record.id);
      if (supplied.items.some(item => item.quantity !== 1)) throw new ApiError(422, 'This recommendation supports one documented unit per approved item. Review additional quantities with the clinic’s authorized provider.', 'UNSUPPORTED_CARE_QUANTITY');
      if (supplied.currency !== config.clinic.currency) throw new ApiError(422, 'Use the location’s configured currency.', 'CURRENCY_MISMATCH');
      if (supplied.outcome !== 'STARTED' && supplied.items.length) throw new ApiError(422, 'Care received must be empty when care has not started.', 'CARE_OUTCOME_MISMATCH');
      if (supplied.outcome === 'STARTED' && (!record.initialRecommendation || !isExactApproval(record.initialRevision, record.clinicalApprovedVersion))) {
        throw new ApiError(422, 'An authorized provider must approve the current initial recommendation before care is recorded as started.', 'CLINICAL_APPROVAL_REQUIRED');
      }
      const items = productSnapshots(config, summary, supplied.items.map(item => item.productId), ['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE', 'SERVICE']);
      if (supplied.outcome === 'STARTED') {
        if (!items.length) throw new ApiError(422, 'Record the care actually provided.', 'ACTUAL_CARE_REQUIRED');
        const initial = initialRecommendationSchema.parse(record.initialRecommendation);
        validate(validateInitialSelection(config, summary, initial));
        const prescribedIds = initial.items.map(item => item.productId).sort();
        const actualIds = items.map(item => item.productId).sort();
        if (!sameJson(prescribedIds, actualIds)) {
          clinician(actor);
          if (!input.reason || !supplied.reason.trim()) throw new ApiError(422, 'An authorized provider must record the reason for a treatment substitution.', 'SUBSTITUTION_REASON_REQUIRED');
          const treatmentItems = items.filter(item => item.type !== 'SERVICE');
          if (treatmentItems.length) validate(validateInitialSelection(config, summary, { ...initial, items: treatmentItems }));
        }
      }
      if (supplied.membershipEnrolled === true) {
        const membership = config.products.find(item => item.id === supplied.membershipProductId && item.type === 'MEMBERSHIP');
        if (!membership) throw new ApiError(422, 'Identify the membership actually enrolled.', 'MEMBERSHIP_REQUIRED');
      }
      const care = actualCareSchema.parse({ ...supplied, items });
      if (sameJson(record.actualCare, care)) return { id: record.id, unchanged: true };
      before = record.actualCare; after = care; note = input.reasonNote ?? care.reason;
      artifactRevision = record.version + 1;
      if (record.actualCare && !input.reason) throw new ApiError(422, 'Choose a reason when correcting recorded care.', 'ADJUSTMENT_REASON_REQUIRED');
      if (record.actualCare) await adjustment(tx, actor, record.id, 'CARE', artifactRevision, before, after, input.reason!, note);
      await revision(tx, actor, record.id, 'CARE', artifactRevision, care, false, input.reason);
      await revokeTakeaways(tx, actor, record.id);
      data = { ...data, actualCare: jsonValue(care), careRevision: { increment: 1 }, careOutcome: care.outcome, ...invalidateWellness, completedAt: null,
        ...(record.wellnessPlan ? { wellnessDecisionDueAt: new Date(now.getTime() + config.reminders.wellnessDecisionHours * 3600000) } : {}),
        careOutcomeDueAt: care.outcome === 'PENDING' ? new Date(now.getTime() + config.reminders.careOutcomeHours * 3600000) : null };
      if (care.outcome !== 'PENDING') await dismissReminders(tx, actor, record.id, 'CARE_OUTCOME_NEEDED');
      break;
    }
    case 'consultation.wellness.generate': {
      if (!record.actualCare || record.careOutcome === 'PENDING') throw new ApiError(422, 'Record whether care started and what was provided before producing the wellness plan.', 'ACTUAL_CARE_REQUIRED');
      if (!summary.staffReviewed) throw new ApiError(422, 'Review the consultation summary before creating a takeaway.', 'SUMMARY_REVIEW_REQUIRED');
      const care = actualCareSchema.parse(record.actualCare);
      const wellness = recommendWellness(config, summary, care, record.configurationVersionId);
      if (sameJson(record.wellnessPlan, wellness) && record.wellnessSummaryRevision === record.summaryRevision && record.wellnessCareRevision === record.careRevision) return { id: record.id, unchanged: true };
      artifactRevision = record.wellnessRevision + 1;
      const stage = transitionStage(record.stage, 'WELLNESS_PRODUCED');
      before = { stage: record.stage, plan: record.wellnessPlan }; after = { stage, plan: wellness };
      await revision(tx, actor, record.id, 'WELLNESS', artifactRevision, wellness, true);
      await logGeneration(tx, actor, record, 'WELLNESS', artifactRevision, wellness);
      await revokeTakeaways(tx, actor, record.id);
      data = { ...data, wellnessPlan: jsonValue(wellness), wellnessRevision: artifactRevision, stage,
        wellnessSummaryRevision: record.summaryRevision, wellnessCareRevision: record.careRevision,
        ...invalidateWellness, completedAt: null, wellnessDecisionDueAt: new Date(now.getTime() + config.reminders.wellnessDecisionHours * 3600000) };
      break;
    }
    case 'consultation.wellness.edit': {
      if (!record.wellnessPlan || !record.actualCare) throw new ApiError(422, 'Produce the wellness draft before editing it.', 'WELLNESS_PLAN_REQUIRED');
      if (record.wellnessSummaryRevision !== record.summaryRevision || record.wellnessCareRevision !== record.careRevision) throw new ApiError(422, 'Regenerate the wellness draft after correcting the summary or actual care.', 'WELLNESS_INPUTS_CHANGED');
      const existing = wellnessPlanSchema.parse(record.wellnessPlan);
      const offers = productSnapshots(config, summary, input.offerProductIds, ['SERVICE', 'MEMBERSHIP'])
        .map(item => ({ ...item, ...wellnessOfferFacts(config.products.find(product => product.id === item.productId)!, summary) }));
      const wellness = wellnessPlanSchema.parse({ ...existing, engineVersion: WELLNESS_ENGINE_VERSION,
        careReceived: actualCareSchema.parse(record.actualCare), offers,
        visitSummary: input.visitSummary, explanation: input.explanation });
      validate(validateWellnessSelection(config, summary, wellness), 'The wellness plan needs review.');
      if (sameJson(record.wellnessPlan, wellness) && record.wellnessSummaryRevision === record.summaryRevision && record.wellnessCareRevision === record.careRevision) return { id: record.id, unchanged: true };
      artifactRevision = record.wellnessRevision + 1; before = record.wellnessPlan; after = wellness; note = input.reasonNote;
      await adjustment(tx, actor, record.id, 'WELLNESS', artifactRevision, before, after, input.reason, input.reasonNote);
      await revision(tx, actor, record.id, 'WELLNESS', artifactRevision, wellness, false, input.reason);
      await revokeTakeaways(tx, actor, record.id);
      data = { ...data, wellnessPlan: jsonValue(wellness), wellnessRevision: artifactRevision, ...invalidateWellness, completedAt: null,
        wellnessSummaryRevision: record.summaryRevision, wellnessCareRevision: record.careRevision,
        wellnessDecisionDueAt: new Date(now.getTime() + config.reminders.wellnessDecisionHours * 3600000) };
      break;
    }
    case 'consultation.wellness.approve': {
      await noPendingEvidence(tx, actor, record.id);
      if (!record.wellnessPlan || !record.actualCare) throw new ApiError(422, 'Produce a wellness plan before approving it.', 'WELLNESS_PLAN_REQUIRED');
      const wellness = wellnessPlanSchema.parse(record.wellnessPlan);
      if (record.wellnessSummaryRevision !== record.summaryRevision || record.wellnessCareRevision !== record.careRevision) throw new ApiError(422, 'Regenerate or review the wellness draft using the corrected summary and care.', 'WELLNESS_INPUTS_CHANGED');
      validate(validateWellnessSelection(config, summary, wellness), 'The wellness plan needs review.');
      if (!sameJson(wellness.careReceived, record.actualCare)) throw new ApiError(422, 'Regenerate the wellness plan to include the corrected care record.', 'CARE_REVISION_CHANGED');
      if (record.careOutcome === 'STARTED' && !isExactApproval(record.initialRevision, record.clinicalApprovedVersion)) throw new ApiError(422, 'The current clinical recommendation needs provider approval.', 'CLINICAL_APPROVAL_REQUIRED');
      if (wellness.offers.some(item => config.products.find(product => product.id === item.productId)?.clinical)) clinician(actor);
      if (isExactApproval(record.wellnessRevision, record.wellnessApprovedVersion)) return { id: record.id, unchanged: true };
      artifactRevision = record.wellnessRevision; before = { approvedVersion: record.wellnessApprovedVersion };
      after = { approvedVersion: record.wellnessRevision, approvedBy: actor.userId };
      data = { ...data, wellnessApprovedVersion: record.wellnessRevision, wellnessApprovedById: actor.userId, wellnessApprovedAt: now };
      break;
    }
    case 'consultation.outcome.record': {
      if (!record.wellnessPlan || !isExactApproval(record.wellnessRevision, record.wellnessApprovedVersion)) throw new ApiError(422, 'Approve the current wellness plan before recording its client decision.', 'WELLNESS_APPROVAL_REQUIRED');
      if (record.wellnessSummaryRevision !== record.summaryRevision || record.wellnessCareRevision !== record.careRevision) throw new ApiError(422, 'The wellness plan no longer matches the reviewed visit.', 'WELLNESS_INPUTS_CHANGED');
      const stage = stageForWellnessDecision(input.decision);
      before = { stage: record.stage, decision: record.wellnessDecision, revision: record.wellnessDecisionRevision };
      after = { stage, decision: input.decision, revision: record.wellnessRevision }; artifactRevision = record.wellnessRevision; note = input.reasonNote;
      data = { ...data, stage, wellnessDecision: input.decision, wellnessDecisionRevision: record.wellnessRevision,
        completedAt: input.decision !== 'TBD' && record.careOutcome !== 'PENDING' ? record.completedAt ?? now : null,
        wellnessDecisionDueAt: input.decision === 'TBD' ? new Date(now.getTime() + config.reminders.wellnessDecisionHours * 3600000) : null };
      if (input.decision !== 'TBD') await dismissReminders(tx, actor, record.id, 'WELLNESS_DECISION_NEEDED');
      break;
    }
    case 'consultation.archive': {
      if (record.archivedAt) return { id: record.id, unchanged: true };
      before = { archivedAt: null, stage: record.stage }; after = { archivedAt: now.toISOString(), stage: record.stage }; note = input.reasonNote;
      data = { ...data, archivedAt: now, archivedById: actor.userId, archiveReason: input.reasonNote };
      await dismissReminders(tx, actor, record.id);
      break;
    }
    case 'consultation.restore': {
      if (!record.archivedAt) return { id: record.id, unchanged: true };
      before = { archivedAt: record.archivedAt.toISOString(), stage: record.stage }; after = { archivedAt: null, stage: record.stage };
      data = { ...data, archivedAt: null, archivedById: null, archiveReason: null };
      break;
    }
  }
  await tx.consultation.update({ where: { id: record.id }, data });
  await event(tx, actor, record.id, input.action, before, after, artifactRevision, note);
  return { id: record.id };
}

async function memberAction(tx: Tx, actor: ClinicActor, input: Extract<ClinicAction, { action: 'member.invite' | 'member.update' }>) {
  owner(actor);
  if (input.action === 'member.invite') {
    if (input.canApproveClinical) {
      ownerMfa(actor);
      if (!input.clinicalAuthorizationNote.trim()) throw new ApiError(422, 'Document the provider’s clinical authorization before granting approval access.', 'CLINICAL_AUTHORIZATION_NOTE_REQUIRED');
    }
    const email = input.email.trim().toLowerCase();
    const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ApiError(409, 'This email already has an account. Use staff settings to manage existing members.', 'EMAIL_IN_USE');
    await tx.userInvite.updateMany({ where: { tenantId: actor.tenantId, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const token = randomBytes(32).toString('base64url');
    const invite = await tx.userInvite.create({ data: {
      tenantId: actor.tenantId, email, role: input.canApproveClinical ? 'PROVIDER' : 'STAFF',
      canApproveClinical: input.canApproveClinical, tokenHash: createHash('sha256').update(token).digest('hex'),
      invitedById: actor.userId, expiresAt: new Date(Date.now() + 7 * 86400000),
    } });
    await tx.auditLog.create({ data: { tenantId: actor.tenantId, userId: actor.userId, action: 'USER_INVITED',
      entityType: 'UserInvite', entityId: invite.id, details: {
        email, role: invite.role, canApproveClinical: input.canApproveClinical,
        clinicalAuthorizationNote: input.clinicalAuthorizationNote,
      } } });
    // Invitation bearer token is returned once to the owner, never written to logs.
    return { invitationId: invite.id, email, expiresAt: invite.expiresAt.toISOString(),
      inviteUrl: `${process.env.APP_URL ?? ''}/join?token=${encodeURIComponent(token)}` };
  }
  const member = await tx.user.findFirst({ where: { id: input.userId, tenantId: actor.tenantId } });
  if (!member) throw new ApiError(404, 'Staff member was not found.', 'MEMBER_NOT_FOUND');
  if (member.id === actor.userId && !input.isActive) throw new ApiError(422, 'The owner account must remain active.', 'OWNER_MUST_REMAIN_ACTIVE');
  if (input.canApproveClinical !== member.canApproveClinical) {
    ownerMfa(actor);
    if (input.canApproveClinical && !input.clinicalAuthorizationNote.trim()) throw new ApiError(422, 'Document clinical authorization before granting approval access.', 'CLINICAL_AUTHORIZATION_NOTE_REQUIRED');
  }
  const role = member.role === 'SUPER_USER' ? member.role : input.canApproveClinical ? 'PROVIDER' : 'STAFF';
  await tx.user.update({ where: { id: member.id }, data: { isActive: input.isActive, canApproveClinical: input.canApproveClinical, role } });
  if (!input.isActive || input.canApproveClinical !== member.canApproveClinical || role !== member.role) {
    await tx.authSession.updateMany({ where: { userId: member.id, revokedAt: null,
      ...(member.id === actor.userId ? { id: { not: actor.sessionId } } : {}) }, data: { revokedAt: new Date() } });
  }
  await tx.auditLog.create({ data: { tenantId: actor.tenantId, userId: actor.userId, action: 'SETTINGS_CHANGED',
    entityType: 'User', entityId: member.id, details: { action: 'CLINICAL_AUTHORITY_CHANGED',
      before: { isActive: member.isActive, canApproveClinical: member.canApproveClinical, role: member.role },
      after: { isActive: input.isActive, canApproveClinical: input.canApproveClinical, role },
      note: input.clinicalAuthorizationNote } } });
  return { id: member.id };
}

async function improvementAction(tx: Tx, actor: ClinicActor, input: Extract<ClinicAction, { action: 'improvement.create' | 'improvement.review' | 'improvement.test' | 'improvement.activate' }>) {
  owner(actor);
  if (input.action === 'improvement.create') {
    const evidence = await tx.consultationAdjustment.findMany({ where: {
      tenantId: actor.tenantId, id: { in: input.evidenceAdjustmentIds }, consultation: { isTest: false },
    }, include: { consultation: { select: { configurationVersionId: true, reference: true, summary: true, actualCare: true, wellnessDecision: true } } } });
    if (evidence.length !== new Set(input.evidenceAdjustmentIds).size) throw new ApiError(404, 'One or more adjustment records were not found.', 'EVIDENCE_NOT_FOUND');
    const base = await configuration(tx, actor, input.configurationVersionId ?? evidence[0]!.consultation.configurationVersionId);
    const created = await tx.improvementProposal.create({ data: {
      tenantId: actor.tenantId, configurationVersionId: base.id, title: input.title,
      classification: input.classification, evidence: jsonValue(evidence), proposedPayload: base.payload as Prisma.InputJsonValue,
      userId: actor.userId, reviewNote: input.notes,
    } });
    await tx.consultationAdjustment.updateMany({ where: { tenantId: actor.tenantId, id: { in: input.evidenceAdjustmentIds } }, data: {
      ownerClassification: input.classification, ownerReviewedById: actor.userId, ownerReviewedAt: new Date(),
    } });
    await configAudit(tx, actor, base.id, { action: 'IMPROVEMENT_PROPOSED', improvementId: created.id, evidenceAdjustmentIds: input.evidenceAdjustmentIds });
    return JSON.parse(JSON.stringify(created));
  }
  const proposal = await tx.improvementProposal.findFirst({ where: { id: input.improvementId, tenantId: actor.tenantId } });
  if (!proposal) throw new ApiError(404, 'Improvement proposal was not found.', 'IMPROVEMENT_NOT_FOUND');
  if (proposal.status === 'ACTIVATED') throw new ApiError(409, 'An activated improvement is immutable. Create another proposal for further changes.', 'IMMUTABLE_IMPROVEMENT');
  if (input.action === 'improvement.review') {
    ownerMfa(actor);
    const reviewed = await tx.improvementProposal.update({ where: { id: proposal.id }, data: {
      status: input.decision, reviewedById: actor.userId, reviewedAt: new Date(), reviewNote: input.notes,
    } });
    await configAudit(tx, actor, proposal.configurationVersionId, { action: 'IMPROVEMENT_REVIEWED', improvementId: proposal.id, decision: input.decision });
    return JSON.parse(JSON.stringify(reviewed));
  }
  if (proposal.status === 'REJECTED') throw new ApiError(409, 'Reopen and approve the proposal before testing or publishing it.', 'IMPROVEMENT_REJECTED');
  const target = await configuration(tx, actor, input.configurationVersionId);
  const base = await configuration(tx, actor, proposal.configurationVersionId);
  if (target.locationId !== base.locationId) throw new ApiError(422, 'Test changes for the proposal’s original location.', 'LOCATION_MISMATCH');
  if (input.action === 'improvement.test') {
    const result = await testConfiguration(tx, actor, input);
    await tx.improvementProposal.update({ where: { id: proposal.id }, data: {
      proposedPayload: target.payload as Prisma.InputJsonValue, tests: jsonValue(result.configuration.tests),
    } });
    return result;
  }
  ownerMfa(actor);
  if (proposal.status !== 'APPROVED') throw new ApiError(422, 'Explicitly approve the improvement before publishing its tested settings.', 'IMPROVEMENT_APPROVAL_REQUIRED');
  if (!sameJson(proposal.proposedPayload, target.payload) || !Array.isArray(proposal.tests) || !proposal.tests.length) {
    throw new ApiError(422, 'Run the proposed settings through the improvement’s synthetic tests before publication.', 'IMPROVEMENT_TEST_REQUIRED');
  }
  const active = await activateConfiguration(tx, actor, input);
  await tx.improvementProposal.update({ where: { id: proposal.id }, data: { status: 'ACTIVATED', activatedVersionId: active.id } });
  return active;
}

export async function mutateClinicAction(actor: ClinicActor, rawInput: unknown) {
  const parsed = clinicActionSchema.safeParse(rawInput);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '), 'VALIDATION_ERROR');
  const input = parsed.data;
  const result = await transaction(actor, async (tx, currentActor) => {
    if ('consultationId' in input) return updateVisit(tx, currentActor, input);
    switch (input.action) {
      case 'config.saveDraft': return saveDraft(tx, currentActor, input);
      case 'config.test': return testConfiguration(tx, currentActor, input);
      case 'config.activate': return activateConfiguration(tx, currentActor, input);
      case 'config.rollback': return rollbackConfiguration(tx, currentActor, input.configurationVersionId, input.locationId);
      case 'consultation.start': return startConsultation(tx, currentActor, input);
      case 'location.create': {
        owner(currentActor);
        const created = await tx.location.create({ data: { tenantId: currentActor.tenantId, name: input.name, address: input.address, phone: input.phone } });
        await tx.auditLog.create({ data: { tenantId: currentActor.tenantId, userId: currentActor.userId, action: 'SETTINGS_CHANGED',
          entityType: 'Location', entityId: created.id, details: { action: 'LOCATION_CREATED', name: created.name } } });
        return { id: created.id };
      }
      case 'notification.read': {
        const updated = await tx.notification.updateMany({ where: { id: input.notificationId, tenantId: currentActor.tenantId,
          OR: [{ userId: currentActor.userId }, { userId: null }] }, data: { isRead: true } });
        if (!updated.count) throw new ApiError(404, 'Notification was not found.', 'NOTIFICATION_NOT_FOUND');
        return { id: input.notificationId };
      }
      case 'member.invite': case 'member.update': return memberAction(tx, currentActor, input);
      case 'improvement.create': case 'improvement.review': case 'improvement.test': case 'improvement.activate':
        return improvementAction(tx, currentActor, input);
    }
  });
  const visitId = 'consultationId' in input ? input.consultationId : input.action === 'consultation.start' && result && typeof result === 'object' && 'id' in result ? String(result.id) : null;
  let reminderPending = false;
  if (visitId) {
    try {
      const reminders = await import('../workflows/reminders');
      await reminders.reconcileConsultationReminders(visitId);
      if (input.action === 'consultation.start' || input.action === 'consultation.wellness.generate' || input.action === 'consultation.restore' || input.action === 'consultation.outcome.record') {
        await reminders.startConsultationReminder(visitId);
      }
    } catch { reminderPending = true; }
    // Durable due dates remain persisted; cron reconciliation recovers a failed kickoff.
    const detail = await getConsultation(actor, visitId);
    return { ok: true as const, result, consultation: detail.consultation, reminderPending };
  }
  return { ok: true as const, result };
}

export async function applyGeneratedSummary(input: {
  tenantId: string; consultationId: string; summary: ConsultationSummary; jobId: string; expectedSummaryRevision: number; processing: RecordingProcessingSnapshot;
}, existingTx?: Tx) {
  const body = async (tx: Tx) => {
    if (input.processing.childJobId !== input.jobId || input.processing.object.consultationId !== input.consultationId
      || input.processing.object.tenantId !== input.tenantId || input.processing.expectedSummaryRevision !== input.expectedSummaryRevision)
      throw new ApiError(403, 'The processing proof does not authorize this summary.', 'PROCESSING_JOB_REQUIRED');
    await assertRecordingProcessing(tx, input.processing);
    const job = await tx.generationJob.findFirst({ where: { id: input.jobId, tenantId: input.tenantId, consultationId: input.consultationId } });
    if (!job || job.status === 'CANCELLED' || !['TRANSCRIPTION', 'SUMMARY', 'CONSULTATION_SUMMARY'].includes(job.kind)) throw new ApiError(403, 'The processing job does not authorize this consultation.', 'PROCESSING_JOB_REQUIRED');
    const provider = await tx.user.findFirst({ where: { id: job.userId, tenantId: input.tenantId, isActive: true }, include: { tenant: true } });
    if (!provider?.tenant?.isActive) throw new ApiError(403, 'The processing user or clinic is no longer active.', 'PROCESSING_ACCESS_CHANGED');
    const record = await tx.consultation.findFirst({ where: { id: input.consultationId, tenantId: input.tenantId } });
    if (!record) throw new ApiError(404, 'Consultation was not found.', 'CONSULTATION_NOT_FOUND');
    assertClientDataAllowed(record);
    const alreadyApplied = await tx.consultationEvent.findUnique({ where: { idempotencyKey: `summary-job:${job.id}` } });
    if (alreadyApplied) return { applied: true };
    const current = consultationSummarySchema.parse(record.summary);
    const proposed = consultationSummarySchema.parse({ ...input.summary, staffReviewed: false,
      wellnessOffersAllowed: null,
      answers: Object.fromEntries(Object.entries(input.summary.answers).map(([key, answer]) => [key, {
        ...answer, source: 'TRANSCRIPT', status: answer.value === null || answer.status === 'UNCERTAIN' ? 'UNCERTAIN' : 'REPORTED',
      }])) });
    const eligible = !record.archivedAt && !current.staffReviewed && record.summaryRevision === input.expectedSummaryRevision;
    await tx.generationJob.update({ where: { id: job.id }, data: {
      result: jsonValue({ ...(job.result && typeof job.result === 'object' && !Array.isArray(job.result) ? job.result : {}),
        proposedSummary: proposed, applied: eligible, reason: eligible ? undefined : 'Staff corrections or archived state require explicit review.' }),
    } });
    if (!eligible) return { applied: false, reason: 'STAFF_REVIEW_REQUIRED' };
    const nextRevision = record.summaryRevision + 1;
    await tx.consultation.update({ where: { id: record.id }, data: {
      summary: jsonValue(proposed), summaryRevision: nextRevision, version: { increment: 1 }, ...invalidateClinical, completedAt: null,
    } });
    await tx.consultationRevision.create({ data: { tenantId: input.tenantId, consultationId: record.id,
      kind: 'SUMMARY', revision: nextRevision, payload: jsonValue(proposed), original: true,
      userId: provider.id, model: job.model, promptVersion: job.promptVersion } });
    await tx.consultationEvent.create({ data: { tenantId: input.tenantId, consultationId: record.id, userId: provider.id,
      action: 'SUMMARY_PROPOSED', artifactRevision: nextRevision, before: jsonValue(current), after: jsonValue(proposed),
      idempotencyKey: `summary-job:${job.id}` } });
    await revokeTakeaways(tx, { tenantId: input.tenantId }, record.id);
    return { applied: true };
  };
  return existingTx ? body(existingTx) : publishRecordingProcessing(input.processing, tx => body(tx));
}

export async function appendReceivedTranscript(input: {
  tenantId: string; consultationId: string; recordingId: string; jobId: string; processing: RecordingProcessingSnapshot;
}, existingTx?: Tx) {
  const body = async (tx: Tx) => {
    if (input.processing.jobId !== input.jobId || input.processing.object.recordingId !== input.recordingId
      || input.processing.object.consultationId !== input.consultationId || input.processing.object.tenantId !== input.tenantId)
      throw new ApiError(403, 'The processing proof does not authorize this transcript.', 'PROCESSING_JOB_REQUIRED');
    await assertRecordingProcessing(tx, input.processing);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Consultation" WHERE "id" = ${input.consultationId}::uuid AND "tenantId" = ${input.tenantId}::uuid FOR UPDATE`);
    const record = await tx.consultation.findFirst({ where: { id: input.consultationId, tenantId: input.tenantId }, include: { configurationVersion: true } });
    if (!record) throw new ApiError(404, 'Consultation was not found.', 'CONSULTATION_NOT_FOUND');
    assertClientDataAllowed(record);
    if (!record.consentAt || record.consentDeclined) throw new ApiError(403, 'Recording consent is required before processing audio.', 'CONSENT_REQUIRED');
    const job = await tx.generationJob.findFirst({ where: { id: input.jobId, tenantId: input.tenantId, consultationId: record.id, kind: 'TRANSCRIPTION' } });
    const segment = await tx.recordingSegment.findFirst({ where: { id: input.recordingId, tenantId: input.tenantId, consultationId: record.id } });
    if (!job || job.status === 'CANCELLED' || !segment || segment.status === 'DISCARDED' || segment.transcript === null || segment.userId !== job.userId) throw new ApiError(403, 'The transcription job does not authorize this recording.', 'PROCESSING_JOB_REQUIRED');
    const user = await tx.user.findFirst({ where: { id: job.userId, tenantId: input.tenantId, isActive: true }, include: { tenant: true } });
    if (!user?.tenant?.isActive || record.archivedAt) throw new ApiError(403, 'The consultation is no longer available for processing.', 'PROCESSING_ACCESS_CHANGED');
    const existing = await tx.consultationEvent.findUnique({ where: { idempotencyKey: `transcript-recording:${segment.id}` } });
    if (segment.status !== 'TRANSCRIBED') await tx.recordingSegment.update({ where: { id: segment.id }, data: { status: 'TRANSCRIBED' } });
    if (existing) return { summaryRevision: record.summaryRevision, recordVersion: record.version, alreadyApplied: true };
    const segments = await tx.recordingSegment.findMany({ where: { tenantId: input.tenantId, consultationId: record.id, OR: [{ transcript: { not: null } }, { staffTranscript: { not: null } }], status: { not: 'DISCARDED' } }, orderBy: { sequence: 'asc' } });
    const transcript = segments.map(item => ({ id: item.id, sequence: item.sequence,
      text: item.staffTranscript ?? item.transcript ?? '', source: item.staffTranscript !== null ? 'STAFF' : 'TRANSCRIPTION',
      receivedAt: item.createdAt.toISOString() }));
    const summary = consultationSummarySchema.parse(record.summary);
    const nextSummary = { ...summary, staffReviewed: false };
    const summaryRevision = record.summaryRevision + (summary.staffReviewed ? 1 : 0);
    await tx.consultationRevision.create({ data: { tenantId: input.tenantId, consultationId: record.id,
      kind: 'TRANSCRIPT', revision: record.version + 1, payload: jsonValue(transcript), original: true,
      userId: job.userId, model: job.model, promptVersion: job.promptVersion } });
    if (summary.staffReviewed) await tx.consultationRevision.create({ data: { tenantId: input.tenantId, consultationId: record.id,
      kind: 'SUMMARY', revision: summaryRevision, payload: jsonValue(nextSummary), original: false, userId: job.userId,
      reason: 'NEW_TRANSCRIPT_REQUIRES_REVIEW' } });
    const config = clinicConfigurationSchema.parse(record.configurationVersion.payload);
    await tx.consultation.update({ where: { id: record.id }, data: {
      transcript: jsonValue(transcript), summary: jsonValue(nextSummary), summaryRevision,
      version: { increment: 1 }, ...invalidateClinical, completedAt: null,
      ...(record.wellnessPlan ? { wellnessDecisionDueAt: new Date(Date.now() + config.reminders.wellnessDecisionHours * 3600000) } : {}),
    } });
    await revokeTakeaways(tx, { tenantId: input.tenantId }, record.id);
    await tx.consultationEvent.create({ data: { tenantId: input.tenantId, consultationId: record.id,
      userId: job.userId, action: 'TRANSCRIPT_RECEIVED', artifactRevision: record.version + 1,
      before: { summaryRevision: record.summaryRevision, staffReviewed: summary.staffReviewed },
      after: { summaryRevision, staffReviewed: false, recordingId: segment.id },
      idempotencyKey: `transcript-recording:${segment.id}` } });
    return { summaryRevision, recordVersion: record.version + 1, alreadyApplied: false };
  };
  return existingTx ? body(existingTx) : publishRecordingProcessing(input.processing, tx => body(tx));
}

export async function beginRecordingIntake(input: {
  actor: ClinicActor; consultationId: string; recordingId: string; segmentKey: string; sequence: number;
  blobPath: string; mimeType: string; bytes: number; durationSeconds?: number; expiresAt: Date;
}) {
  return transaction(input.actor, async (tx, actor) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Consultation" WHERE "id" = ${input.consultationId}::uuid AND "tenantId" = ${actor.tenantId}::uuid FOR UPDATE`);
    const record = await consultation(tx, actor, input.consultationId);
    assertClientDataAllowed(record);
    if (!record.consentAt || record.consentDeclined) throw new ApiError(403, 'Document client consent before recording.', 'CONSENT_REQUIRED');
    if (record.archivedAt) throw new ApiError(409, 'Restore this consultation before recording.', 'CONSULTATION_ARCHIVED');
    const previous = await tx.recordingSegment.findUnique({ where: { tenantId_segmentKey: { tenantId: actor.tenantId, segmentKey: input.segmentKey } } });
    if (previous && (previous.consultationId !== record.id || previous.sequence !== input.sequence)) throw new ApiError(409, 'This key belongs to another recording segment.', 'IDEMPOTENCY_CONFLICT');
    if (previous?.status === 'UPLOADING') throw new ApiError(409, 'This segment is still uploading. Retry shortly.', 'UPLOAD_IN_PROGRESS');
    if (previous?.status === 'DISCARDED') throw new ApiError(409, 'This segment was deliberately discarded. Use a new segment key for a new recording.', 'RECORDING_DISCARDED');
    if (previous && previous.status !== 'UPLOAD_FAILED') {
      const accepted = await tx.consultationEvent.findUnique({ where: { idempotencyKey: `recording-accepted:${previous.id}` } });
      const metadata = accepted?.after && typeof accepted.after === 'object' && !Array.isArray(accepted.after) ? accepted.after : {};
      const capturedRevision = metadata.expectedSummaryRevision;
      if (typeof capturedRevision !== 'number') throw new ApiError(409, 'The recording needs an explicit staff review before retrying.', 'RECORDING_REVIEW_REQUIRED');
      return { recording: previous, expectedSummaryRevision: capturedRevision, accepted: false };
    }
    const recordingId = previous?.id ?? input.recordingId;
    const { assertRecordingPathNotDetached } = await import('./recording-deletion-intents');
    await assertRecordingPathNotDetached(tx, actor.tenantId, input.blobPath);
    const saved = previous
      ? await tx.recordingSegment.update({ where: { id: previous.id }, data: { status: 'UPLOADING', blobPath: input.blobPath, blobObject: Prisma.DbNull,
        bytes: input.bytes, mimeType: input.mimeType, durationSeconds: input.durationSeconds, expiresAt: input.expiresAt } })
      : await tx.recordingSegment.create({ data: { id: recordingId, tenantId: actor.tenantId, consultationId: record.id,
        userId: actor.userId, segmentKey: input.segmentKey, sequence: input.sequence, blobPath: input.blobPath,
        mimeType: input.mimeType, bytes: input.bytes, durationSeconds: input.durationSeconds, consentAt: record.consentAt,
        expiresAt: input.expiresAt, status: 'UPLOADING' } });
    const accepted = await tx.consultationEvent.findUnique({ where: { idempotencyKey: `recording-accepted:${recordingId}` } });
    if (accepted) {
      const metadata = accepted.after && typeof accepted.after === 'object' && !Array.isArray(accepted.after) ? accepted.after : {};
      if (typeof metadata.expectedSummaryRevision !== 'number') throw new ApiError(409, 'The recording needs staff review before retrying.', 'RECORDING_REVIEW_REQUIRED');
      return { recording: saved, expectedSummaryRevision: metadata.expectedSummaryRevision, accepted: false };
    }
    const summary = consultationSummarySchema.parse(record.summary);
    const nextSummary = { ...summary, staffReviewed: false };
    const nextRevision = record.summaryRevision + (summary.staffReviewed ? 1 : 0);
    if (summary.staffReviewed) await revision(tx, actor, record.id, 'SUMMARY', nextRevision, nextSummary, false, 'NEW_RECORDING_REQUIRES_REVIEW');
    const config = clinicConfigurationSchema.parse(record.configurationVersion.payload);
    await tx.consultation.update({ where: { id: record.id }, data: {
      summary: jsonValue(nextSummary), summaryRevision: nextRevision, version: { increment: 1 },
      ...invalidateClinical, completedAt: null,
      ...(record.wellnessPlan ? { wellnessDecisionDueAt: new Date(Date.now() + config.reminders.wellnessDecisionHours * 3600000) } : {}),
    } });
    await revokeTakeaways(tx, actor, record.id);
    await tx.consultationEvent.create({ data: { tenantId: actor.tenantId, consultationId: record.id,
      userId: actor.userId, action: 'RECORDING_ACCEPTED', idempotencyKey: `recording-accepted:${recordingId}`,
      before: { version: record.version, summaryRevision: record.summaryRevision, staffReviewed: summary.staffReviewed },
      after: { recordingId, sequence: input.sequence, expectedSummaryRevision: nextRevision, version: record.version + 1, staffReviewed: false } } });
    return { recording: saved, expectedSummaryRevision: nextRevision, accepted: true };
  });
}

export async function discardRecordingEvidence(input: {
  actor: ClinicActor; recordingId: string; expectedVersion: number; reason: string; reasonNote: string;
}) {
  const category = adjustmentReasonSchema.parse(input.reason);
  if (!input.reasonNote.trim()) throw new ApiError(422, 'Record why the recording is being discarded.', 'DISCARD_REASON_REQUIRED');
  return transaction(input.actor, async (tx, actor) => {
    const initialSegment = await tx.recordingSegment.findFirst({ where: { id: input.recordingId, tenantId: actor.tenantId } });
    if (!initialSegment?.consultationId) throw new ApiError(404, 'Recording was not found.', 'RECORDING_NOT_FOUND');
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Consultation" WHERE "id" = ${initialSegment.consultationId}::uuid AND "tenantId" = ${actor.tenantId}::uuid FOR UPDATE`);
    const segment = await tx.recordingSegment.findFirst({ where: { id: input.recordingId, tenantId: actor.tenantId, consultationId: initialSegment.consultationId } });
    if (!segment?.consultationId) throw new ApiError(404, 'Recording was not found.', 'RECORDING_NOT_FOUND');
    const record = await consultation(tx, actor, segment.consultationId, input.expectedVersion);
    if (segment.status === 'DISCARDED') return { consultationId: record.id, recordingId: segment.id, blobPath: segment.blobPath, version: record.version };
    if (segment.status === 'TRANSCRIBED') throw new ApiError(422, 'A completed transcript requires a tracked correction instead of discarding its evidence.', 'TRANSCRIPT_CORRECTION_REQUIRED');
    const now = new Date();
    await tx.recordingSegment.update({ where: { id: segment.id }, data: { status: 'DISCARDED', transcript: null, staffTranscript: null, expiresAt: now } });
    const parents = await tx.generationJob.findMany({ where: { tenantId: actor.tenantId, consultationId: record.id, idempotencyKey: `recording:${segment.id}` }, select: { id: true } });
    const jobKeys = [`recording:${segment.id}`, ...parents.map(job => `summary:${job.id}`)];
    await tx.generationJob.updateMany({ where: { tenantId: actor.tenantId, consultationId: record.id,
      OR: [{ idempotencyKey: { in: jobKeys } }, { result: { path: ['recordingId'], equals: segment.id } }] },
      data: { status: 'CANCELLED', errorCode: 'RECORDING_DISCARDED', completedAt: now } });
    const summary = { ...consultationSummarySchema.parse(record.summary), staffReviewed: false };
    const summaryRevision = record.summaryRevision + 1;
    await revision(tx, actor, record.id, 'SUMMARY', summaryRevision, summary, false, category);
    await tx.consultation.update({ where: { id: record.id }, data: { summary: jsonValue(summary), summaryRevision,
      version: { increment: 1 }, ...invalidateClinical, completedAt: null } });
    await revokeTakeaways(tx, actor, record.id);
    await event(tx, actor, record.id, 'RECORDING_DISCARDED', { recordingId: segment.id, status: segment.status },
      { recordingId: segment.id, status: 'DISCARDED', staffReviewed: false }, summaryRevision, `${category}: ${input.reasonNote.trim()}`);
    return { consultationId: record.id, recordingId: segment.id, blobPath: segment.blobPath, version: record.version + 1 };
  });
}

export async function applyTranscriptCorrection(input: {
  actor: ClinicActor; recordingId: string; text: string; reason: string; expectedVersion: number;
}) {
  if (!input.text.trim() || input.text.length > 50000) throw new ApiError(422, 'Provide a corrected transcript of at most 50,000 characters.', 'INVALID_TRANSCRIPT');
  const category = adjustmentReasonSchema.parse(input.reason);
  return transaction(input.actor, async (tx, actor) => {
    const recording = await tx.recordingSegment.findFirst({ where: { id: input.recordingId, tenantId: actor.tenantId } });
    if (!recording?.consultationId) throw new ApiError(404, 'Consultation recording was not found.', 'RECORDING_NOT_FOUND');
    await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${recording.consultationId}::uuid AND "tenantId" = ${actor.tenantId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "RecordingSegment" WHERE "consultationId" = ${recording.consultationId}::uuid AND "tenantId" = ${actor.tenantId}::uuid ORDER BY "id" FOR UPDATE`;
    const record = await consultation(tx, actor, recording.consultationId, input.expectedVersion);
    assertClientDataAllowed(record);
    if (record.archivedAt) throw new ApiError(409, 'Restore the consultation before correcting the transcript.', 'CONSULTATION_ARCHIVED');
    await tx.recordingSegment.update({ where: { id: recording.id }, data: { staffTranscript: input.text.trim() } });
    const segments = await tx.recordingSegment.findMany({ where: { tenantId: actor.tenantId, consultationId: record.id, status: { not: 'DISCARDED' } }, orderBy: { sequence: 'asc' } });
    const transcript = segments.filter(segment => segment.staffTranscript || segment.transcript).map(segment => ({
      id: segment.id, sequence: segment.sequence, text: segment.staffTranscript ?? segment.transcript ?? '',
      source: segment.staffTranscript ? 'STAFF' : 'TRANSCRIPTION', receivedAt: segment.createdAt.toISOString(),
    }));
    const summary = { ...consultationSummarySchema.parse(record.summary), staffReviewed: false };
    const number = record.summaryRevision + 1;
    await adjustment(tx, actor, record.id, 'TRANSCRIPT', record.version + 1,
      { text: recording.staffTranscript ?? recording.transcript }, { text: input.text.trim() }, category);
    await revision(tx, actor, record.id, 'TRANSCRIPT', record.version + 1, transcript, false, category);
    await revision(tx, actor, record.id, 'SUMMARY', number, summary, false, category);
    await revokeTakeaways(tx, actor, record.id);
    await tx.consultation.update({ where: { id: record.id }, data: {
      transcript: jsonValue(transcript), summary: jsonValue(summary), summaryRevision: number,
      version: { increment: 1 }, ...invalidateClinical, completedAt: null,
    } });
    await event(tx, actor, record.id, 'TRANSCRIPT_CORRECTED', { recordingId: recording.id }, { recordingId: recording.id }, record.version + 1, category);
    return { consultationId: record.id, version: record.version + 1 };
  });
}
