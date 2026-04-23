import { prisma } from '../lib/prisma.js';
import { getAssessmentSignals, getAssessmentAnswers, STATIC_QUESTION_BANK } from './questions.js';
import { makeSafetyFlagId, type AssessmentId, type TenantId, type ProviderId, type SafetyFlagId } from '@dripwell/shared';

export const SAFETY_MOCK_MODE = process.env.SAFETY_MOCK_MODE === 'true';

export type FlagTier = 'T1_INFO' | 'T2_FOLLOWUP' | 'T3_URGENT';

export interface DetectedFlag {
  tier: FlagTier;
  flagType: string;
  description: string;
  suggestedScript: string | null;
  triggeredBy: {
    ruleName: string;
    signals: Array<{ signalName: string; confidence: number; value?: string }>;
    answers: Array<{ questionId: string; questionText: string; answerValue: string }>;
  };
}

export interface SafetyFlagRecord {
  id: SafetyFlagId;
  assessmentSessionId: AssessmentId;
  tenantId: TenantId;
  tier: FlagTier;
  flagType: string;
  description: string;
  suggestedScript: string | null;
  providerAcknowledgedAt: Date | null;
  providerAcknowledgedById: ProviderId | null;
  isOverridden: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Flag detection rules (v1 minimal set per TASK-009)
// ---------------------------------------------------------------------------

interface FlagRule {
  name: string;
  tier: FlagTier;
  flagType: string;
  description: string;
  suggestedScript: string | null;
  condition: (ctx: RuleContext) => boolean;
  getTriggers: (ctx: RuleContext) => { signals: DetectedFlag['triggeredBy']['signals']; answers: DetectedFlag['triggeredBy']['answers'] };
}

interface RuleContext {
  signals: Array<{ signalName: string; confidence: number; value: string | null }>;
  answers: Array<{ questionBankId: string; answerValue: string }>;
  vitals?: {
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    pulse?: number;
    spo2?: number;
    temperature?: number | null;
    respiratoryRate?: number | null;
    weight?: number | null;
  } | null;
}

const FLAG_RULES: FlagRule[] = [
  // Tier 3: Vitals-based urgent flags
  {
    name: 'CriticalHypoxemia',
    tier: 'T3_URGENT',
    flagType: 'CRITICAL_HYPOXEMIA',
    description: 'SpO2 below 88% indicates severe hypoxemia. Immediate medical evaluation is required before any IV therapy.',
    suggestedScript: 'Your oxygen saturation is critically low at below 88%. This requires immediate medical attention. We need to pause any wellness treatments and refer you for urgent evaluation.',
    condition: (ctx) => {
      return !!(ctx.vitals?.spo2 !== undefined && ctx.vitals.spo2 < 88);
    },
    getTriggers: (_ctx) => {
      return {
        signals: [],
        answers: [],
      };
    },
  },
  {
    name: 'CriticalHypertension',
    tier: 'T3_URGENT',
    flagType: 'CRITICAL_HYPERTENSION',
    description: 'Blood pressure above 200/120 is a hypertensive emergency. Immediate medical evaluation is required before any IV therapy.',
    suggestedScript: 'Your blood pressure is critically elevated. This is a medical emergency that requires immediate evaluation. We must pause any wellness treatments and refer you for urgent care.',
    condition: (ctx) => {
      const sys = ctx.vitals?.bloodPressureSystolic;
      const dia = ctx.vitals?.bloodPressureDiastolic;
      return !!(sys !== undefined && dia !== undefined && (sys > 200 || dia > 120));
    },
    getTriggers: (_ctx) => {
      return {
        signals: [],
        answers: [],
      };
    },
  },
  {
    name: 'CriticalTachycardia',
    tier: 'T3_URGENT',
    flagType: 'CRITICAL_TACHYCARDIA',
    description: 'Pulse above 150 bpm indicates severe tachycardia. Immediate medical evaluation is required before any IV therapy.',
    suggestedScript: 'Your heart rate is critically elevated at above 150 beats per minute. This requires immediate medical attention. We need to pause any wellness treatments and refer you for urgent evaluation.',
    condition: (ctx) => {
      return !!(ctx.vitals?.pulse !== undefined && ctx.vitals.pulse > 150);
    },
    getTriggers: (_ctx) => {
      return {
        signals: [],
        answers: [],
      };
    },
  },

  // Tier 2: Vitals-based follow-up flags
  {
    name: 'LowOxygenSaturation',
    tier: 'T2_FOLLOWUP',
    flagType: 'LOW_SPO2',
    description: 'SpO2 below 92% suggests mild hypoxemia. Recommend follow-up with a physician before proceeding with IV therapy.',
    suggestedScript: 'Your oxygen saturation is slightly low at below 92%. While not immediately dangerous, I recommend discussing this with a physician before we proceed with IV therapy to ensure it is safe for you.',
    condition: (ctx) => {
      const spo2 = ctx.vitals?.spo2;
      return !!(spo2 !== undefined && spo2 < 92 && spo2 >= 88);
    },
    getTriggers: (_ctx) => {
      return {
        signals: [],
        answers: [],
      };
    },
  },
  {
    name: 'ElevatedBloodPressure',
    tier: 'T2_FOLLOWUP',
    flagType: 'ELEVATED_BP',
    description: 'Blood pressure above 180/110 indicates hypertension that should be evaluated by a physician before IV therapy.',
    suggestedScript: 'Your blood pressure is elevated above 180/110. I recommend checking with your physician about whether IV therapy is appropriate for you today, as high blood pressure can affect treatment safety.',
    condition: (ctx) => {
      const sys = ctx.vitals?.bloodPressureSystolic;
      const dia = ctx.vitals?.bloodPressureDiastolic;
      if (sys === undefined || dia === undefined) return false;
      const isTier3 = sys > 200 || dia > 120;
      const isTier2 = sys > 180 || dia > 110;
      return isTier2 && !isTier3;
    },
    getTriggers: (_ctx) => {
      return {
        signals: [],
        answers: [],
      };
    },
  },
  {
    name: 'ElevatedPulse',
    tier: 'T2_FOLLOWUP',
    flagType: 'ELEVATED_PULSE',
    description: 'Pulse above 120 bpm suggests tachycardia. Recommend discussing with a physician before proceeding with IV therapy.',
    suggestedScript: 'Your heart rate is elevated at above 120 beats per minute. This may be due to anxiety, dehydration, or an underlying condition. I recommend a brief discussion with a physician before we proceed with IV therapy.',
    condition: (ctx) => {
      const pulse = ctx.vitals?.pulse;
      if (pulse === undefined) return false;
      return pulse > 120 && pulse <= 150;
    },
    getTriggers: (_ctx) => {
      return {
        signals: [],
        answers: [],
      };
    },
  },

  // Tier 3: Urgent / Contraindication
  {
    name: 'JaundiceDetection',
    tier: 'T3_URGENT',
    flagType: 'JAUNDICE',
    description: 'Yellowing of the sclera (jaundice) detected. This may indicate liver dysfunction or other serious conditions requiring immediate medical evaluation outside the scope of IV therapy.',
    suggestedScript: 'I notice some yellowing in the whites of your eyes. This can sometimes indicate a liver or bile duct issue that needs evaluation by a physician. I recommend pausing any wellness treatments today and scheduling a medical appointment for proper assessment.',
    condition: (ctx) => {
      const sclera = ctx.signals.find((s) => s.signalName === 'SCLERA_TINT');
      return !!sclera && sclera.confidence >= 0.5 && isJaundiceValue(sclera.value);
    },
    getTriggers: (ctx) => {
      const sclera = ctx.signals.find((s) => s.signalName === 'SCLERA_TINT');
      return {
        signals: sclera ? [{ signalName: sclera.signalName, confidence: sclera.confidence, value: sclera.value || undefined }] : [],
        answers: [],
      };
    },
  },
  {
    name: 'SevereDehydrationWithFatigue',
    tier: 'T3_URGENT',
    flagType: 'SEVERE_DEHYDRATION',
    description: 'Multiple indicators suggest severe dehydration with significant fatigue. This combination may require urgent medical attention and IV therapy should be administered only under careful medical supervision.',
    suggestedScript: 'Your assessment shows signs of significant dehydration combined with severe fatigue. While we can help with hydration, I want to ensure there are no underlying conditions. Have you been able to keep fluids down? If you have been vomiting, have severe abdominal pain, or feel confused, please let me know as you may need urgent medical care.',
    condition: (ctx) => {
      const lipDryness = ctx.signals.find((s) => s.signalName === 'LIP_DRYNESS');
      const skinTexture = ctx.signals.find((s) => s.signalName === 'SKIN_TEXTURE');
      const severeFatigue = ctx.answers.find((a) => {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === a.questionBankId);
        return q?.category === 'SPECIFIC_SYMPTOMS' && q.questionText.includes('fatigued') && a.answerValue === 'months_or_more';
      });
      const lowHydration = ctx.answers.find((a) => {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === a.questionBankId);
        return q?.category === 'HYDRATION' && a.answerValue === '<3';
      });
      const hasSevereDehydrationSignals = !!(lipDryness && lipDryness.confidence >= 0.7 && isSevereDryness(lipDryness.value)) ||
        !!(skinTexture && skinTexture.confidence >= 0.7 && isSevereDryness(skinTexture.value));
      return hasSevereDehydrationSignals && !!severeFatigue && !!lowHydration;
    },
    getTriggers: (ctx) => {
      const lipDryness = ctx.signals.find((s) => s.signalName === 'LIP_DRYNESS');
      const skinTexture = ctx.signals.find((s) => s.signalName === 'SKIN_TEXTURE');
      const severeFatigue = ctx.answers.find((a) => {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === a.questionBankId);
        return q?.category === 'SPECIFIC_SYMPTOMS' && q.questionText.includes('fatigued') && a.answerValue === 'months_or_more';
      });
      const lowHydration = ctx.answers.find((a) => {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === a.questionBankId);
        return q?.category === 'HYDRATION' && a.answerValue === '<3';
      });
      const signals: DetectedFlag['triggeredBy']['signals'] = [];
      if (lipDryness) signals.push({ signalName: lipDryness.signalName, confidence: lipDryness.confidence, value: lipDryness.value || undefined });
      if (skinTexture) signals.push({ signalName: skinTexture.signalName, confidence: skinTexture.confidence, value: skinTexture.value || undefined });
      const answers: DetectedFlag['triggeredBy']['answers'] = [];
      if (severeFatigue) {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === severeFatigue.questionBankId);
        if (q) answers.push({ questionId: severeFatigue.questionBankId, questionText: q.questionText, answerValue: severeFatigue.answerValue });
      }
      if (lowHydration) {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === lowHydration.questionBankId);
        if (q) answers.push({ questionId: lowHydration.questionBankId, questionText: q.questionText, answerValue: lowHydration.answerValue });
      }
      return { signals, answers };
    },
  },

  // Tier 2: Recommend Follow-up
  {
    name: 'PossibleAnemia',
    tier: 'T2_FOLLOWUP',
    flagType: 'POSSIBLE_ANEMIA',
    description: 'Conjunctival pallor combined with severe fatigue may indicate possible anemia. Recommend discussing blood work with the patient.',
    suggestedScript: 'I notice some paleness in the lining of your eyes, and you mentioned significant fatigue. These can sometimes be signs of low iron or anemia. I recommend considering a blood test to check your iron levels and ensure we are providing the right support for your body.',
    condition: (ctx) => {
      const conjPallor = ctx.signals.find((s) => s.signalName === 'CONJUNCTIVAL_PALLOR');
      const severeFatigue = ctx.answers.find((a) => {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === a.questionBankId);
        return q?.category === 'SPECIFIC_SYMPTOMS' && q.questionText.includes('fatigued') && a.answerValue === 'months_or_more';
      });
      return !!conjPallor && conjPallor.confidence >= 0.5 && !!severeFatigue;
    },
    getTriggers: (ctx) => {
      const conjPallor = ctx.signals.find((s) => s.signalName === 'CONJUNCTIVAL_PALLOR');
      const severeFatigue = ctx.answers.find((a) => {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === a.questionBankId);
        return q?.category === 'SPECIFIC_SYMPTOMS' && q.questionText.includes('fatigued') && a.answerValue === 'months_or_more';
      });
      const signals: DetectedFlag['triggeredBy']['signals'] = [];
      if (conjPallor) signals.push({ signalName: conjPallor.signalName, confidence: conjPallor.confidence, value: conjPallor.value || undefined });
      const answers: DetectedFlag['triggeredBy']['answers'] = [];
      if (severeFatigue) {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === severeFatigue.questionBankId);
        if (q) answers.push({ questionId: severeFatigue.questionBankId, questionText: q.questionText, answerValue: severeFatigue.answerValue });
      }
      return { signals, answers };
    },
  },
  {
    name: 'NutritionalDeficiencyConcern',
    tier: 'T2_FOLLOWUP',
    flagType: 'NUTRITIONAL_DEFICIENCY',
    description: 'Angular cheilitis combined with dietary concerns may indicate nutritional deficiencies (B vitamins, iron, or zinc). Recommend discussing diet and potential supplementation.',
    suggestedScript: 'The irritation at the corners of your mouth, along with your dietary pattern, suggests you may benefit from additional B vitamins or minerals. I recommend discussing your diet with a nutritionist and considering blood work to check your vitamin levels. We can include B-complex support in your treatment today.',
    condition: (ctx) => {
      const angularCheil = ctx.signals.find((s) => s.signalName === 'ANGULAR_CHEILITIS');
      const dietConcern = ctx.answers.find((a) => {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === a.questionBankId);
        return q?.category === 'DIET_PATTERN' && (a.answerValue === 'restricted' || a.answerValue === 'mostly_processed');
      });
      return !!angularCheil && angularCheil.confidence >= 0.5 && !!dietConcern;
    },
    getTriggers: (ctx) => {
      const angularCheil = ctx.signals.find((s) => s.signalName === 'ANGULAR_CHEILITIS');
      const dietConcern = ctx.answers.find((a) => {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === a.questionBankId);
        return q?.category === 'DIET_PATTERN' && (a.answerValue === 'restricted' || a.answerValue === 'mostly_processed');
      });
      const signals: DetectedFlag['triggeredBy']['signals'] = [];
      if (angularCheil) signals.push({ signalName: angularCheil.signalName, confidence: angularCheil.confidence, value: angularCheil.value || undefined });
      const answers: DetectedFlag['triggeredBy']['answers'] = [];
      if (dietConcern) {
        const q = STATIC_QUESTION_BANK.find((qb) => qb.id === dietConcern.questionBankId);
        if (q) answers.push({ questionId: dietConcern.questionBankId, questionText: q.questionText, answerValue: dietConcern.answerValue });
      }
      return { signals, answers };
    },
  },

  // Tier 1: Informational
  {
    name: 'MildDehydration',
    tier: 'T1_INFO',
    flagType: 'MILD_DEHYDRATION',
    description: 'Mild signs of dehydration detected. Hydration support is recommended as part of treatment.',
    suggestedScript: null,
    condition: (ctx) => {
      const lipDryness = ctx.signals.find((s) => s.signalName === 'LIP_DRYNESS');
      return !!lipDryness && lipDryness.confidence >= 0.5 && !isSevereDryness(lipDryness.value);
    },
    getTriggers: (ctx) => {
      const lipDryness = ctx.signals.find((s) => s.signalName === 'LIP_DRYNESS');
      const signals: DetectedFlag['triggeredBy']['signals'] = [];
      if (lipDryness) signals.push({ signalName: lipDryness.signalName, confidence: lipDryness.confidence, value: lipDryness.value || undefined });
      return { signals, answers: [] };
    },
  },
  {
    name: 'SkinDryness',
    tier: 'T1_INFO',
    flagType: 'SKIN_DRYNESS',
    description: 'Mild skin dryness detected. Consider hydration and moisturizing recommendations.',
    suggestedScript: null,
    condition: (ctx) => {
      const skinTexture = ctx.signals.find((s) => s.signalName === 'SKIN_TEXTURE');
      return !!skinTexture && skinTexture.confidence >= 0.5 && !isSevereDryness(skinTexture.value);
    },
    getTriggers: (ctx) => {
      const skinTexture = ctx.signals.find((s) => s.signalName === 'SKIN_TEXTURE');
      const signals: DetectedFlag['triggeredBy']['signals'] = [];
      if (skinTexture) signals.push({ signalName: skinTexture.signalName, confidence: skinTexture.confidence, value: skinTexture.value || undefined });
      return { signals, answers: [] };
    },
  },
  {
    name: 'PostureConcern',
    tier: 'T1_INFO',
    flagType: 'POSTURE',
    description: 'Posture or affect concerns detected. May indicate fatigue or musculoskeletal issues.',
    suggestedScript: null,
    condition: (ctx) => {
      const posture = ctx.signals.find((s) => s.signalName === 'POSTURE_AFFECT');
      return !!posture && posture.confidence >= 0.5;
    },
    getTriggers: (ctx) => {
      const posture = ctx.signals.find((s) => s.signalName === 'POSTURE_AFFECT');
      const signals: DetectedFlag['triggeredBy']['signals'] = [];
      if (posture) signals.push({ signalName: posture.signalName, confidence: posture.confidence, value: posture.value || undefined });
      return { signals, answers: [] };
    },
  },
];

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function isJaundiceValue(value: string | null): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.includes('yellow') || lower.includes('jaundice') || lower.includes('icteric');
}

function isSevereDryness(value: string | null): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.includes('severe') || lower.includes('extreme') || lower.includes('very') || lower.includes('cracked');
}

// ---------------------------------------------------------------------------
// Flag detection
// ---------------------------------------------------------------------------

export interface DetectSafetyFlagsResult {
  flags: DetectedFlag[];
  hasTier3: boolean;
}

export async function detectSafetyFlags(params: {
  assessmentSessionId: string;
  tenantId: string;
  mockMode?: boolean;
}): Promise<DetectSafetyFlagsResult> {
  const { assessmentSessionId, tenantId, mockMode } = params;

  let signals = await getAssessmentSignals(assessmentSessionId, tenantId);
  let answers = await getAssessmentAnswers(assessmentSessionId, tenantId);

  // Read vitals from the assessment session
  const session = await prisma.assessmentSession.findFirst({
    where: { id: assessmentSessionId, tenantId },
    select: { vitals: true },
  });

  const vitals = session?.vitals as unknown as {
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    pulse?: number;
    spo2?: number;
    temperature?: number | null;
    respiratoryRate?: number | null;
    weight?: number | null;
  } | null | undefined;

  if (mockMode || (SAFETY_MOCK_MODE && signals.length === 0)) {
    signals = getMockSignalsForSafety();
    answers = getMockAnswersForSafety();
  }

  const ctx: RuleContext = {
    signals: signals.map((s) => ({ signalName: s.signalName, confidence: s.confidence, value: s.value })),
    answers,
    vitals,
  };

  const flags: DetectedFlag[] = [];
  for (const rule of FLAG_RULES) {
    if (rule.condition(ctx)) {
      const triggers = rule.getTriggers(ctx);
      flags.push({
        tier: rule.tier,
        flagType: rule.flagType,
        description: rule.description,
        suggestedScript: rule.suggestedScript,
        triggeredBy: {
          ruleName: rule.name,
          signals: triggers.signals,
          answers: triggers.answers,
        },
      });
    }
  }

  const hasTier3 = flags.some((f) => f.tier === 'T3_URGENT');

  return { flags, hasTier3 };
}

function getMockSignalsForSafety(): Array<{ signalName: string; confidence: number; value: string | null }> {
  return [
    { signalName: 'CONJUNCTIVAL_PALLOR', confidence: 0.71, value: 'mild' },
    { signalName: 'LIP_DRYNESS', confidence: 0.81, value: 'moderate' },
    { signalName: 'UNDER_EYE_DARKNESS', confidence: 0.68, value: 'mild' },
  ];
}

function getMockAnswersForSafety(): Array<{ questionBankId: string; answerValue: string }> {
  return [
    { questionBankId: '77777777-7777-7777-7777-777777777777', answerValue: 'months_or_more' },
    { questionBankId: '22222222-2222-2222-2222-222222222222', answerValue: '3-5' },
  ];
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function persistSafetyFlags(params: {
  assessmentSessionId: string;
  tenantId: string;
  flags: DetectedFlag[];
}): Promise<SafetyFlagRecord[]> {
  const { assessmentSessionId, tenantId, flags } = params;

  await prisma.safetyFlag.deleteMany({
    where: { assessmentSessionId, tenantId },
  });

  const records: SafetyFlagRecord[] = [];
  for (const flag of flags) {
    const dbRecord = await prisma.safetyFlag.create({
      data: {
        assessmentSessionId,
        tenantId,
        tier: flag.tier,
        flagType: flag.flagType,
        description: flag.description,
        suggestedScript: flag.suggestedScript,
        isOverridden: false,
      },
    });

    records.push({
      id: makeSafetyFlagId(dbRecord.id),
      assessmentSessionId: dbRecord.assessmentSessionId as AssessmentId,
      tenantId: dbRecord.tenantId as TenantId,
      tier: dbRecord.tier as FlagTier,
      flagType: dbRecord.flagType,
      description: dbRecord.description,
      suggestedScript: dbRecord.suggestedScript,
      providerAcknowledgedAt: dbRecord.providerAcknowledgedAt,
      providerAcknowledgedById: dbRecord.providerAcknowledgedById ? makeSafetyFlagId(dbRecord.providerAcknowledgedById) as unknown as ProviderId : null,
      isOverridden: dbRecord.isOverridden,
      createdAt: dbRecord.createdAt,
    });
  }

  return records;
}

export async function getSafetyFlags(params: {
  assessmentSessionId: string;
  tenantId: string;
}): Promise<SafetyFlagRecord[]> {
  const { assessmentSessionId, tenantId } = params;

  const dbRecords = await prisma.safetyFlag.findMany({
    where: { assessmentSessionId, tenantId },
    orderBy: [
      { tier: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  return dbRecords.map((r) => ({
    id: makeSafetyFlagId(r.id),
    assessmentSessionId: r.assessmentSessionId as AssessmentId,
    tenantId: r.tenantId as TenantId,
    tier: r.tier as FlagTier,
    flagType: r.flagType,
    description: r.description,
    suggestedScript: r.suggestedScript,
    providerAcknowledgedAt: r.providerAcknowledgedAt,
    providerAcknowledgedById: r.providerAcknowledgedById ? makeSafetyFlagId(r.providerAcknowledgedById) as unknown as ProviderId : null,
    isOverridden: r.isOverridden,
    createdAt: r.createdAt,
  }));
}

export async function hasUnacknowledgedTier3Flags(params: {
  assessmentSessionId: string;
  tenantId: string;
}): Promise<boolean> {
  const { assessmentSessionId, tenantId } = params;

  const count = await prisma.safetyFlag.count({
    where: {
      assessmentSessionId,
      tenantId,
      tier: 'T3_URGENT',
      providerAcknowledgedAt: null,
      isOverridden: false,
    },
  });

  return count > 0;
}

// ---------------------------------------------------------------------------
// Acknowledgment
// ---------------------------------------------------------------------------

export async function acknowledgeSafetyFlag(params: {
  flagId: string;
  assessmentSessionId: string;
  tenantId: string;
  providerId: string;
}): Promise<SafetyFlagRecord | null> {
  const { flagId, assessmentSessionId, tenantId, providerId } = params;

  const existing = await prisma.safetyFlag.findFirst({
    where: {
      id: flagId,
      assessmentSessionId,
      tenantId,
    },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.safetyFlag.update({
    where: { id: flagId },
    data: {
      providerAcknowledgedAt: new Date(),
      providerAcknowledgedById: providerId,
    },
  });

  return {
    id: makeSafetyFlagId(updated.id),
    assessmentSessionId: updated.assessmentSessionId as AssessmentId,
    tenantId: updated.tenantId as TenantId,
    tier: updated.tier as FlagTier,
    flagType: updated.flagType,
    description: updated.description,
    suggestedScript: updated.suggestedScript,
    providerAcknowledgedAt: updated.providerAcknowledgedAt,
    providerAcknowledgedById: updated.providerAcknowledgedById ? makeSafetyFlagId(updated.providerAcknowledgedById) as unknown as ProviderId : null,
    isOverridden: updated.isOverridden,
    createdAt: updated.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Audit logging helper
// ---------------------------------------------------------------------------

export async function auditSafetyFlags(params: {
  assessmentSessionId: string;
  tenantId: string;
  providerId: string;
  flags: DetectedFlag[];
  impersonatedBy?: string;
}): Promise<void> {
  const { assessmentSessionId, tenantId, providerId, flags, impersonatedBy } = params;

  for (const flag of flags) {
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: providerId,
        impersonatedBy: impersonatedBy || null,
        assessmentSessionId,
        action: 'SAFETY_FLAG_RAISED',
        entityType: 'SafetyFlag',
        entityId: null,
        details: {
          tier: flag.tier,
          flagType: flag.flagType,
          ruleName: flag.triggeredBy.ruleName,
          triggeredBySignals: flag.triggeredBy.signals,
          triggeredByAnswers: flag.triggeredBy.answers.map((a) => ({ questionId: a.questionId, answerValue: a.answerValue })),
        },
      },
    });

    await prisma.notification.create({
      data: {
        tenantId,
        title: `Safety flag: ${flag.tier}`,
        message: flag.description,
        type: 'SAFETY_FLAG',
        entityId: assessmentSessionId,
      },
    });
  }
}
