import { prisma } from '../lib/prisma.js';
import {
  computePatternConfidences,
  getAssessmentSignals,
  getAssessmentAnswers,
  STATIC_QUESTION_BANK,
  type WellnessPattern,
} from './questions.js';

export const RECOMMENDATION_MOCK_MODE = process.env.RECOMMENDATION_MOCK_MODE === 'true';

// Bridge wellness pattern labels to ClinicalPattern.name values in the DB
const WELLNESS_TO_CLINICAL_NAME: Record<WellnessPattern, string> = {
  dehydration: 'Dehydration',
  iron_deficiency: 'Iron Deficiency Cluster',
  sleep_deprivation: 'Sleep Deprivation',
  chronic_stress: 'Stress/Magnesium Depletion',
  nutritional_gap: 'B12/Folate Cluster',
  electrolyte_imbalance: 'Electrolyte Imbalance',
  low_energy: 'Low Energy',
};

export interface MatchedSignalDetail {
  signalName: string;
  confidence: number;
  weight: number;
}

export interface MatchedAnswerDetail {
  questionId: string;
  answerValue: string;
  weight: number;
}

export interface PatternMatchDetail {
  clinicalPatternId: string;
  clinicalPatternName: string;
  confidence: number;
  genericIntent: string;
  category: string;
  matchedSignals: MatchedSignalDetail[];
  matchedAnswers: MatchedAnswerDetail[];
  isPrimary: boolean;
  clinicalRationale: string;
}

export interface ComputePatternsResult {
  topPatterns: PatternMatchDetail[];
  allConfidences: Array<{ pattern: WellnessPattern; confidence: number }>;
}

export async function computePatternMatches(params: {
  assessmentSessionId: string;
  tenantId: string;
  mockSignals?: boolean;
}): Promise<ComputePatternsResult> {
  const { assessmentSessionId, tenantId, mockSignals } = params;

  const signals = await getAssessmentSignals(assessmentSessionId, tenantId);
  const answers = await getAssessmentAnswers(assessmentSessionId, tenantId);

  const useMock = mockSignals || (RECOMMENDATION_MOCK_MODE && signals.length === 0);

  const confidences = computePatternConfidences({ signals, answers, mockSignals: useMock });

  const dbPatterns = await prisma.clinicalPattern.findMany({
    where: { isActive: true },
  });

  const dbPatternByName = new Map(
    dbPatterns.map((p) => [normalizePatternName(p.name), p])
  );

  const topPatterns: PatternMatchDetail[] = [];
  const sorted = [...confidences].sort((a, b) => b.confidence - a.confidence);

  for (const wc of sorted) {
    const clinicalName = WELLNESS_TO_CLINICAL_NAME[wc.pattern];
    if (!clinicalName) continue;

    const dbPattern = dbPatternByName.get(normalizePatternName(clinicalName));
    if (!dbPattern) continue;

    const supportingSignals = parseJsonArray(dbPattern.supportingSignals);
    const supportingAnswers = parseJsonArray(dbPattern.supportingAnswers);

    const matchedSignals = buildMatchedSignals(signals, supportingSignals);
    const matchedAnswers = buildMatchedAnswers(answers, supportingAnswers);

    topPatterns.push({
      clinicalPatternId: dbPattern.id,
      clinicalPatternName: dbPattern.name,
      confidence: wc.confidence,
      genericIntent: dbPattern.genericRecommendationIntent,
      category: dbPattern.category,
      matchedSignals,
      matchedAnswers,
      isPrimary: false,
      clinicalRationale: dbPattern.clinicalRationale,
    });
  }

  for (let i = 0; i < Math.min(3, topPatterns.length); i++) {
    topPatterns[i].isPrimary = i === 0;
  }

  return {
    topPatterns: topPatterns.slice(0, 3),
    allConfidences: sorted.map((c) => ({ pattern: c.pattern, confidence: c.confidence })),
  };
}

export async function persistPatternMatches(params: {
  assessmentSessionId: string;
  tenantId: string;
  patterns: PatternMatchDetail[];
}): Promise<void> {
  const { assessmentSessionId, tenantId, patterns } = params;

  await prisma.patternMatch.deleteMany({
    where: { assessmentSessionId, tenantId },
  });

  for (const p of patterns) {
    await prisma.patternMatch.create({
      data: {
        assessmentSessionId,
        tenantId,
        clinicalPatternId: p.clinicalPatternId,
        confidence: p.confidence,
        matchedSignals: p.matchedSignals.map((s) => s.signalName) as unknown as object,
        matchedAnswers: p.matchedAnswers.map((a) => a.questionId) as unknown as object,
        isPrimary: p.isPrimary,
      },
    });
  }
}

function normalizePatternName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseJsonArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

function buildMatchedSignals(
  signals: Array<{ signalName: string; confidence: number }>,
  supportingSignals: Array<Record<string, unknown>>
): MatchedSignalDetail[] {
  const result: MatchedSignalDetail[] = [];
  for (const sup of supportingSignals) {
    const signalName = sup.signalName as string | undefined;
    const minConfidence = typeof sup.minConfidence === 'number' ? sup.minConfidence : 0.5;
    if (!signalName) continue;

    const match = signals.find((s) => s.signalName === signalName);
    if (match && match.confidence >= minConfidence) {
      result.push({
        signalName: match.signalName,
        confidence: match.confidence,
        weight: match.confidence,
      });
    }
  }
  return result;
}

function buildMatchedAnswers(
  answers: Array<{ questionBankId: string; answerValue: string }>,
  supportingAnswers: Array<Record<string, unknown>>
): MatchedAnswerDetail[] {
  const result: MatchedAnswerDetail[] = [];

  for (const ans of answers) {
    const question = STATIC_QUESTION_BANK.find((q) => q.id === ans.questionBankId);
    if (!question) continue;

    for (const sup of supportingAnswers) {
      const category = sup.questionCategory as string | undefined;
      const expectedPattern = sup.expectedAnswerPattern as string | undefined;
      if (!category || !expectedPattern) continue;

      if (question.category === category && answerMatchesPattern(ans.answerValue, expectedPattern)) {
        result.push({
          questionId: ans.questionBankId,
          answerValue: ans.answerValue,
          weight: 0.1,
        });
      }
    }
  }

  return result;
}

function answerMatchesPattern(answerValue: string, pattern: string): boolean {
  const options = pattern.split('|').map((s) => s.trim().toLowerCase());
  return options.includes(answerValue.toLowerCase());
}
