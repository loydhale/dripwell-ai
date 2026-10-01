import { z } from 'zod';
import { isSupportedCurrency } from './money.js';

// Monetary fields named priceCents, creditCents, amountCents, or
// confirmedCollectedCents store integer smallest currency units. The legacy
// names do not imply two decimals: USD uses 100 units per dollar, JPY uses one
// unit per yen, and KWD uses 1000 units per dinar. Never convert stored values
// between currencies; use the accompanying currency and shared money helpers.

export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .refine(isSupportedCurrency, {
    message: 'Use a supported uppercase ISO currency code.',
  });

export const consultationStages = [
  'CONSULTATION_STARTED',
  'INITIAL_RECOMMENDATIONS_GIVEN',
  'WELLNESS_RECOMMENDATIONS_PRODUCED',
  'WELLNESS_RECOMMENDATIONS_ACCEPTED',
  'WELLNESS_RECOMMENDATIONS_REJECTED',
  'WELLNESS_RECOMMENDATION_TBD',
] as const;
export const consultationStageSchema = z.enum(consultationStages);
export type ConsultationStage = z.infer<typeof consultationStageSchema>;
export const careOutcomeSchema = z.enum(['PENDING', 'STARTED', 'NOT_STARTED']);
export type CareOutcome = z.infer<typeof careOutcomeSchema>;
export const wellnessDecisionSchema = z.enum(['ACCEPTED', 'REJECTED', 'TBD']);
export type WellnessDecision = z.infer<typeof wellnessDecisionSchema>;
export const adjustmentReasons = [
  'CLIENT_CHOICE',
  'BUDGET',
  'AVAILABILITY',
  'CONTRAINDICATION',
  'MISSING_INFORMATION',
  'UNSUITABLE_SUGGESTION',
  'STAFF_JUDGMENT',
  'OTHER',
] as const;
export const adjustmentReasonSchema = z.enum(adjustmentReasons);

const identifier = z.string().trim().min(1).max(100);
const narrative = z.string().trim().max(20000);
export const answerValueSchema = z.union([
  z.string().max(2000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(500)).max(100),
  z.null(),
]);
export const answerSchema = z.object({
  value: answerValueSchema,
  status: z.enum(['CONFIRMED', 'REPORTED', 'UNCERTAIN']),
  source: z.enum(['STAFF', 'TRANSCRIPT']),
  evidence: z.string().max(2000).default(''),
});
export type Answer = z.infer<typeof answerSchema>;
export const conditionSchema = z.object({
  questionId: identifier,
  operator: z.enum(['EQ', 'NEQ', 'CONTAINS', 'IN', 'GTE', 'LTE']),
  value: z.union([
    z.string().max(2000),
    z.number().finite(),
    z.boolean(),
    z.array(z.string().max(500)).max(100),
  ]),
});
export type RuleCondition = z.infer<typeof conditionSchema>;
export const clinicQuestionSchema = z.object({
  id: identifier,
  text: z.string().trim().min(1).max(1000),
  why: z.string().trim().min(1).max(2000),
  type: z.enum(['TEXT', 'BOOLEAN', 'NUMBER', 'CHOICE', 'MULTI_CHOICE']),
  options: z.array(z.string().min(1).max(500)).max(100).default([]),
  required: z.boolean(),
  safetyRelevant: z.boolean(),
  activeWhen: z.array(conditionSchema).max(50).default([]),
  priority: z.number().int().min(0).max(1000).default(0),
});
export type ClinicQuestion = z.infer<typeof clinicQuestionSchema>;
export const catalogProductSchema = z.object({
  id: identifier,
  name: z.string().trim().min(1).max(200),
  type: z.enum(['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE', 'SERVICE', 'MEMBERSHIP']),
  description: z.string().max(4000).default(''),
  priceCents: z.number().int().min(0).max(100000000).nullable(),
  currency: currencySchema,
  available: z.boolean(),
  ingredients: z
    .array(z.object({ name: z.string().min(1).max(200), quantity: z.string().max(200) }))
    .max(100)
    .default([]),
  goalTags: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  compatibleWith: z.array(identifier).max(500).default([]),
  benefits: z.array(z.string().max(2000)).max(100).default([]),
  terms: z.string().max(4000).default(''),
  clinical: z.boolean(),
  rules: z.object({
    validated: z.boolean(),
    validationNote: z.string().max(4000).default(''),
    eligibility: z.array(conditionSchema).max(100),
    exclusions: z.array(conditionSchema).max(100),
    rationale: z.string().max(4000),
  }),
  priority: z.number().int().min(0).max(1000).default(0),
});
export type CatalogProduct = z.infer<typeof catalogProductSchema>;
export const clinicConfigurationSchema = z.object({
  schemaVersion: z.literal(2),
  clinic: z.object({
    name: z.string().trim().min(1).max(200),
    currency: currencySchema,
    contact: z.string().max(1000).default(''),
    brandColor: z
      .string()
      .regex(/^#[\da-fA-F]{6}$/)
      .default('#0d9488'),
  }),
  questions: z.array(clinicQuestionSchema).max(500),
  products: z.array(catalogProductSchema).max(1000),
  recommendationPolicy: z.object({
    clinicalValidated: z.boolean(),
    validatedBy: z.string().max(200).default(''),
    validationNote: z.string().max(4000).default(''),
    maxAddOns: z.number().int().min(0).max(20),
    maxWellnessOffers: z.number().int().min(0).max(20),
  }),
  reminders: z.object({
    careOutcomeHours: z.number().int().min(1).max(720),
    wellnessDecisionHours: z.number().int().min(1).max(720),
  }),
  retention: z.object({
    audioDays: z.number().int().min(1).max(3650),
    documentDays: z.number().int().min(1).max(3650),
    shareExpiryHours: z.number().int().min(1).max(720),
  }),
});
export type ClinicConfiguration = z.infer<typeof clinicConfigurationSchema>;
export const consultationSummarySchema = z.object({
  goals: z.array(z.string().max(2000)).max(100),
  symptoms: z.array(z.string().max(2000)).max(100),
  history: z.array(z.string().max(2000)).max(100),
  medications: z.array(z.string().max(500)).max(100),
  allergies: z.array(z.string().max(500)).max(100),
  preferences: z.array(z.string().max(2000)).max(100),
  uncertainties: z.array(z.string().max(2000)).max(100),
  answers: z.record(identifier, answerSchema),
  staffReviewed: z.boolean(),
  wellnessOffersAllowed: z.boolean().nullable(),
});
export type ConsultationSummary = z.infer<typeof consultationSummarySchema>;
export function emptyConsultationSummary(): ConsultationSummary {
  return {
    goals: [],
    symptoms: [],
    history: [],
    medications: [],
    allergies: [],
    preferences: [],
    uncertainties: [],
    answers: {},
    staffReviewed: false,
    wellnessOffersAllowed: null,
  };
}
export const questionStateSchema = z.object({
  questionId: identifier,
  text: z.string(),
  why: z.string(),
  required: z.boolean(),
  safetyRelevant: z.boolean(),
  status: z.enum(['ANSWERED', 'MISSING', 'NEEDS_CONFIRMATION']),
});
export type QuestionState = z.infer<typeof questionStateSchema>;
export const recommendationItemSchema = z.object({
  productId: identifier,
  name: z.string().min(1).max(200),
  type: catalogProductSchema.shape.type,
  priceCents: z.number().int().min(0),
  currency: currencySchema,
  quantity: z.number().int().min(1).max(100),
  rationale: z.string().max(4000),
  evidence: z.array(z.string().max(2000)).max(100),
  terms: z.string().max(4000).default(''),
});
export type RecommendationItemSnapshot = z.infer<typeof recommendationItemSchema>;
export const initialRecommendationSchema = z.object({
  configurationVersionId: z.string().uuid(),
  engineVersion: z.literal('dripwell-rules-v2.1'),
  items: z.array(recommendationItemSchema).max(100),
  alternatives: z.array(recommendationItemSchema).max(1000),
  explanation: narrative,
  unresolvedQuestions: z.array(questionStateSchema).max(500),
  safetyFlags: z.array(z.string().max(2000)).max(1000),
  eligibleProductIds: z.array(identifier).max(1000),
  blocked: z.boolean(),
});
export type InitialRecommendation = z.infer<typeof initialRecommendationSchema>;
export const actualCareSchema = z.object({
  outcome: careOutcomeSchema,
  items: z.array(recommendationItemSchema).max(100),
  observations: narrative,
  reason: z.string().max(2000).default(''),
  membershipEnrolled: z.boolean().nullable().default(null),
  membershipProductId: identifier.nullable().default(null),
  servicePurchased: z.boolean().nullable().default(null),
  confirmedCollectedCents: z.number().int().min(0).nullable().default(null),
  currency: currencySchema,
});
export type ActualCare = z.infer<typeof actualCareSchema>;
export const wellnessPlanSchema = z.object({
  configurationVersionId: z.string().uuid(),
  engineVersion: z.literal('dripwell-rules-v2.1'),
  visitSummary: narrative,
  careReceived: actualCareSchema,
  offers: z.array(recommendationItemSchema).max(100),
  explanation: narrative,
  safetyFlags: z.array(z.string().max(2000)).max(1000),
});
export type WellnessPlan = z.infer<typeof wellnessPlanSchema>;
export const transcriptSegmentSchema = z.object({
  id: z.string().uuid(),
  sequence: z.number().int().min(0),
  text: z.string().max(50000),
  source: z.enum(['TRANSCRIPTION', 'STAFF']),
  receivedAt: z.string().datetime(),
});
export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;
export const configurationTestSchema = z.object({
  id: z.string().uuid(),
  testedAt: z.string().datetime(),
  summary: consultationSummarySchema,
  initial: initialRecommendationSchema,
  approvedByOwner: z.boolean(),
  notes: z.string().max(4000),
});
export const referralPolicySchema = z.object({
  version: z.number().int().positive(),
  creditCents: z.number().int().positive(),
  currency: currencySchema,
  attributionDays: z.number().int().positive().max(365),
  qualification: z.literal('FIRST_PAID_PLATFORM_SUBSCRIPTION'),
  refundReversesCredit: z.boolean(),
  expiryDays: z.number().int().positive().max(3650).nullable(),
});
export type ReferralPolicy = z.infer<typeof referralPolicySchema>;
