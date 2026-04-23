import { prisma } from '../lib/prisma.js';

// Minimal type shapes used by this service (avoids direct @prisma/client import in api app)
interface VisualSignalShape {
  signalName: string;
  confidence: number;
}

interface QuestionAnswerShape {
  questionBankId: string;
  answerValue: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIDENCE_THRESHOLD = 0.75;
const MAX_QUESTIONS = 5;
const MIN_INFO_GAIN = 0.05;
const PRIOR_CONFIDENCE = 0.1;

// ---------------------------------------------------------------------------
// Wellness patterns being disambiguated (v1 labels, not ClinicalPattern rows)
// ---------------------------------------------------------------------------

export type WellnessPattern =
  | 'dehydration'
  | 'iron_deficiency'
  | 'sleep_deprivation'
  | 'chronic_stress'
  | 'nutritional_gap'
  | 'electrolyte_imbalance'
  | 'low_energy';

export const ALL_PATTERNS: WellnessPattern[] = [
  'dehydration',
  'iron_deficiency',
  'sleep_deprivation',
  'chronic_stress',
  'nutritional_gap',
  'electrolyte_imbalance',
  'low_energy',
];

// ---------------------------------------------------------------------------
// Static question bank — v1 uses a curated static bank for transparency
// ---------------------------------------------------------------------------

export interface StaticQuestion {
  id: string;
  category: string;
  questionText: string;
  answerType: 'single_choice';
  answerOptions: string[];
  patternWeights: Partial<Record<WellnessPattern, Record<string, number>>>;
}

export const STATIC_QUESTION_BANK: StaticQuestion[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    category: 'ENERGY_SLEEP',
    questionText: 'How many hours of sleep do you average per night?',
    answerType: 'single_choice',
    answerOptions: ['<5', '5-6', '7-8', '9+'],
    patternWeights: {
      sleep_deprivation: { '<5': 0.25, '5-6': 0.15, '7-8': -0.1, '9+': -0.15 },
      low_energy: { '<5': 0.15, '5-6': 0.1, '7-8': -0.05, '9+': -0.1 },
      chronic_stress: { '<5': 0.1, '5-6': 0.05, '7-8': 0, '9+': -0.05 },
    },
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    category: 'HYDRATION',
    questionText: 'How many glasses of water do you drink daily?',
    answerType: 'single_choice',
    answerOptions: ['<3', '3-5', '6-8', '9+'],
    patternWeights: {
      dehydration: { '<3': 0.25, '3-5': 0.1, '6-8': -0.1, '9+': -0.15 },
      electrolyte_imbalance: { '<3': 0.1, '3-5': 0, '6-8': -0.05, '9+': -0.05 },
    },
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    category: 'STRESS_RECOVERY',
    questionText: 'How would you rate your current stress level?',
    answerType: 'single_choice',
    answerOptions: ['low', 'moderate', 'high', 'extreme'],
    patternWeights: {
      chronic_stress: { low: -0.15, moderate: 0, high: 0.2, extreme: 0.3 },
      sleep_deprivation: { low: -0.1, moderate: 0, high: 0.1, extreme: 0.15 },
      low_energy: { low: -0.1, moderate: 0, high: 0.1, extreme: 0.15 },
    },
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    category: 'WOMENS_HEALTH',
    questionText: 'Do you experience heavy menstrual bleeding?',
    answerType: 'single_choice',
    answerOptions: ['no', 'yes_sometimes', 'yes_always', 'not_applicable'],
    patternWeights: {
      iron_deficiency: { no: -0.1, yes_sometimes: 0.15, yes_always: 0.25, not_applicable: 0 },
    },
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    category: 'DIET_PATTERN',
    questionText: 'How would you describe your typical diet?',
    answerType: 'single_choice',
    answerOptions: ['balanced', 'irregular', 'restricted', 'mostly_processed'],
    patternWeights: {
      nutritional_gap: { balanced: -0.15, irregular: 0.1, restricted: 0.15, mostly_processed: 0.2 },
      iron_deficiency: { balanced: -0.1, irregular: 0.05, restricted: 0.1, mostly_processed: 0.1 },
    },
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    category: 'MEDICAL_HISTORY',
    questionText: 'Are you currently taking any iron supplements?',
    answerType: 'single_choice',
    answerOptions: ['yes', 'no', 'unsure'],
    patternWeights: {
      iron_deficiency: { yes: -0.15, no: 0.1, unsure: 0 },
      nutritional_gap: { yes: -0.1, no: 0.05, unsure: 0 },
    },
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    category: 'SPECIFIC_SYMPTOMS',
    questionText: 'How long have you been feeling unusually fatigued?',
    answerType: 'single_choice',
    answerOptions: ['not_at_all', 'few_days', 'few_weeks', 'months_or_more'],
    patternWeights: {
      low_energy: { not_at_all: -0.15, few_days: 0.05, few_weeks: 0.15, months_or_more: 0.25 },
      iron_deficiency: { not_at_all: -0.1, few_days: 0, few_weeks: 0.1, months_or_more: 0.2 },
      sleep_deprivation: { not_at_all: -0.1, few_days: 0.05, few_weeks: 0.1, months_or_more: 0.15 },
    },
  },
  {
    id: '88888888-8888-8888-8888-888888888888',
    category: 'STRESS_RECOVERY',
    questionText: 'How well do you recover after exercise?',
    answerType: 'single_choice',
    answerOptions: ['very_well', 'okay', 'poor', 'dont_exercise'],
    patternWeights: {
      chronic_stress: { very_well: -0.1, okay: 0, poor: 0.15, dont_exercise: 0 },
      electrolyte_imbalance: { very_well: -0.1, okay: 0, poor: 0.1, dont_exercise: 0 },
      dehydration: { very_well: -0.1, okay: 0, poor: 0.1, dont_exercise: 0 },
    },
  },
  {
    id: '99999999-9999-9999-9999-999999999999',
    category: 'ENERGY_SLEEP',
    questionText: 'How many caffeinated drinks do you have per day?',
    answerType: 'single_choice',
    answerOptions: ['0', '1-2', '3-4', '5+'],
    patternWeights: {
      sleep_deprivation: { '0': -0.1, '1-2': 0, '3-4': 0.1, '5+': 0.2 },
      dehydration: { '0': -0.05, '1-2': 0, '3-4': 0.1, '5+': 0.15 },
      chronic_stress: { '0': -0.05, '1-2': 0, '3-4': 0.1, '5+': 0.15 },
    },
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    category: 'SPECIFIC_SYMPTOMS',
    questionText: 'Do you experience persistent dry skin?',
    answerType: 'single_choice',
    answerOptions: ['no', 'mild', 'moderate', 'severe'],
    patternWeights: {
      dehydration: { no: -0.15, mild: 0.1, moderate: 0.2, severe: 0.25 },
      nutritional_gap: { no: -0.1, mild: 0.05, moderate: 0.1, severe: 0.15 },
    },
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    category: 'SPECIFIC_SYMPTOMS',
    questionText: 'Do you experience frequent muscle cramps?',
    answerType: 'single_choice',
    answerOptions: ['no', 'rarely', 'sometimes', 'often'],
    patternWeights: {
      electrolyte_imbalance: { no: -0.15, rarely: 0.05, sometimes: 0.15, often: 0.25 },
      dehydration: { no: -0.1, rarely: 0, sometimes: 0.1, often: 0.2 },
    },
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    category: 'GOALS',
    questionText: 'What is your primary goal for this visit?',
    answerType: 'single_choice',
    answerOptions: ['energy', 'recovery', 'immunity', 'beauty', 'hangover', 'athletic', 'stress', 'hydration', 'other'],
    patternWeights: {
      low_energy: { energy: 0.15, recovery: 0.05, immunity: 0, beauty: 0, hangover: 0.05, athletic: 0.05, stress: 0, hydration: 0, other: 0 },
      dehydration: { energy: 0, recovery: 0.05, immunity: 0, beauty: 0, hangover: 0.2, athletic: 0.1, stress: 0, hydration: 0.2, other: 0 },
      chronic_stress: { energy: 0, recovery: 0.1, immunity: 0, beauty: 0, hangover: 0, athletic: 0, stress: 0.2, hydration: 0, other: 0 },
      sleep_deprivation: { energy: 0.1, recovery: 0.1, immunity: 0, beauty: 0, hangover: 0.1, athletic: 0, stress: 0.05, hydration: 0, other: 0 },
    },
  },
];

// ---------------------------------------------------------------------------
// Signal-to-pattern base confidence mapping
// ---------------------------------------------------------------------------

interface SignalPatternMap {
  signalName: string;
  pattern: WellnessPattern;
  weight: number;
}

const SIGNAL_PATTERN_MAP: SignalPatternMap[] = [
  { signalName: 'CONJUNCTIVAL_PALLOR', pattern: 'iron_deficiency', weight: 0.4 },
  { signalName: 'LIP_DRYNESS', pattern: 'dehydration', weight: 0.4 },
  { signalName: 'LIP_PALLOR', pattern: 'iron_deficiency', weight: 0.3 },
  { signalName: 'UNDER_EYE_DARKNESS', pattern: 'sleep_deprivation', weight: 0.3 },
  { signalName: 'UNDER_EYE_PUFFINESS', pattern: 'sleep_deprivation', weight: 0.2 },
  { signalName: 'UNDER_EYE_PUFFINESS', pattern: 'chronic_stress', weight: 0.2 },
  { signalName: 'FACIAL_DULLNESS', pattern: 'low_energy', weight: 0.3 },
  { signalName: 'FACIAL_DULLNESS', pattern: 'nutritional_gap', weight: 0.2 },
  { signalName: 'SKIN_TEXTURE', pattern: 'dehydration', weight: 0.3 },
  { signalName: 'TONGUE_COLOR', pattern: 'iron_deficiency', weight: 0.3 },
  { signalName: 'TONGUE_SURFACE', pattern: 'nutritional_gap', weight: 0.2 },
  { signalName: 'NAIL_BED_COLOR', pattern: 'iron_deficiency', weight: 0.3 },
  { signalName: 'NAIL_RIDGING', pattern: 'nutritional_gap', weight: 0.2 },
  { signalName: 'HAIR_QUALITY', pattern: 'nutritional_gap', weight: 0.2 },
  { signalName: 'HAIR_QUALITY', pattern: 'iron_deficiency', weight: 0.1 },
  { signalName: 'SCLERA_TINT', pattern: 'dehydration', weight: 0.1 },
  { signalName: 'ANGULAR_CHEILITIS', pattern: 'nutritional_gap', weight: 0.3 },
  { signalName: 'FACIAL_REDNESS', pattern: 'chronic_stress', weight: 0.2 },
  { signalName: 'POSTURE_AFFECT', pattern: 'low_energy', weight: 0.2 },
  { signalName: 'NAIL_SPOONING', pattern: 'iron_deficiency', weight: 0.4 },
];

// ---------------------------------------------------------------------------
// Confidence computation
// ---------------------------------------------------------------------------

export interface PatternConfidence {
  pattern: WellnessPattern;
  confidence: number;
  baseFromSignals: number;
  fromAnswers: number;
}

export function computePatternConfidences(params: {
  signals: VisualSignalShape[];
  answers: QuestionAnswerShape[];
  mockSignals?: boolean;
}): PatternConfidence[] {
  const { signals, answers, mockSignals } = params;

  let effectiveSignals = signals;
  if (mockSignals && signals.length === 0) {
    effectiveSignals = [
      { signalName: 'CONJUNCTIVAL_PALLOR', confidence: 0.72 },
      { signalName: 'LIP_DRYNESS', confidence: 0.68 },
      { signalName: 'UNDER_EYE_DARKNESS', confidence: 0.55 },
    ];
  }

  // Start with uniform prior
  const rawScores: Record<WellnessPattern, number> = {
    dehydration: PRIOR_CONFIDENCE,
    iron_deficiency: PRIOR_CONFIDENCE,
    sleep_deprivation: PRIOR_CONFIDENCE,
    chronic_stress: PRIOR_CONFIDENCE,
    nutritional_gap: PRIOR_CONFIDENCE,
    electrolyte_imbalance: PRIOR_CONFIDENCE,
    low_energy: PRIOR_CONFIDENCE,
  };

  // Add signal contributions (scaled by signal confidence)
  for (const signal of effectiveSignals) {
    const mappings = SIGNAL_PATTERN_MAP.filter((m) => m.signalName === signal.signalName);
    for (const mapping of mappings) {
      rawScores[mapping.pattern] += mapping.weight * signal.confidence;
    }
  }

  // Add answer contributions
  for (const answer of answers) {
    const question = STATIC_QUESTION_BANK.find((q) => q.id === answer.questionBankId);
    if (!question) continue;

    for (const pattern of ALL_PATTERNS) {
      const weights = question.patternWeights[pattern];
      if (!weights) continue;
      const weight = weights[answer.answerValue];
      if (typeof weight === 'number') {
        rawScores[pattern] += weight;
      }
    }
  }

  // Normalize with sigmoid-like clamp for v1
  const result: PatternConfidence[] = ALL_PATTERNS.map((pattern) => {
    const raw = rawScores[pattern];
    const baseFromSignals = PRIOR_CONFIDENCE + effectiveSignals.reduce((sum, s) => {
      const maps = SIGNAL_PATTERN_MAP.filter((m) => m.signalName === s.signalName && m.pattern === pattern);
      return sum + maps.reduce((mSum, m) => mSum + m.weight * s.confidence, 0);
    }, 0);
    const fromAnswers = raw - baseFromSignals;
    const confidence = clamp(sigmoid(raw), 0, 1);
    return { pattern, confidence, baseFromSignals: clamp(sigmoid(baseFromSignals), 0, 1), fromAnswers: clamp(sigmoid(fromAnswers + PRIOR_CONFIDENCE) - clamp(sigmoid(PRIOR_CONFIDENCE), 0, 1), -1, 1) };
  });

  return result;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-(x - 0.5) * 4));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ---------------------------------------------------------------------------
// Question selection
// ---------------------------------------------------------------------------

export interface NextQuestionResult {
  question: StaticQuestion | null;
  progress: {
    questionNumber: number;
    maxQuestions: number;
  };
  patternConfidences: PatternConfidence[];
  shouldTerminate: boolean;
  terminationReason: string | null;
}

export function selectNextQuestion(params: {
  signals: VisualSignalShape[];
  answers: QuestionAnswerShape[];
  mockSignals?: boolean;
}): NextQuestionResult {
  const { signals, answers, mockSignals } = params;

  const confidences = computePatternConfidences({ signals, answers, mockSignals });

  // Check termination condition: any pattern above threshold
  const topPattern = confidences.reduce((best, c) => (c.confidence > best.confidence ? c : best), confidences[0]);
  if (topPattern.confidence >= CONFIDENCE_THRESHOLD) {
    return {
      question: null,
      progress: { questionNumber: answers.length, maxQuestions: MAX_QUESTIONS },
      patternConfidences: confidences,
      shouldTerminate: true,
      terminationReason: `Pattern "${topPattern.pattern}" reached confidence ${topPattern.confidence.toFixed(2)}`,
    };
  }

  // Check termination: max questions reached
  if (answers.length >= MAX_QUESTIONS) {
    return {
      question: null,
      progress: { questionNumber: answers.length, maxQuestions: MAX_QUESTIONS },
      patternConfidences: confidences,
      shouldTerminate: true,
      terminationReason: `Max ${MAX_QUESTIONS} questions reached`,
    };
  }

  const askedIds = new Set(answers.map((a) => a.questionBankId));
  const remaining = STATIC_QUESTION_BANK.filter((q) => !askedIds.has(q.id));

  if (remaining.length === 0) {
    return {
      question: null,
      progress: { questionNumber: answers.length, maxQuestions: MAX_QUESTIONS },
      patternConfidences: confidences,
      shouldTerminate: true,
      terminationReason: 'No remaining questions in bank',
    };
  }

  // Score each remaining question by expected information gain
  // For v1: expected gain = sum over patterns of max absolute weight across answers
  let bestQuestion: StaticQuestion | null = null;
  let bestScore = -Infinity;

  for (const question of remaining) {
    let score = 0;
    for (const pattern of ALL_PATTERNS) {
      const weights = question.patternWeights[pattern];
      if (!weights) continue;
      const maxAbsWeight = Math.max(...Object.values(weights).map(Math.abs));
      score += maxAbsWeight;
    }

    // Boost questions that target the currently highest-confidence patterns
    // to help them cross threshold or be disambiguated
    for (const pc of confidences.sort((a, b) => b.confidence - a.confidence).slice(0, 2)) {
      const weights = question.patternWeights[pc.pattern];
      if (weights) {
        score += 0.05;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestQuestion = question;
    }
  }

  // Check termination: no meaningful information gain remaining
  if (bestScore < MIN_INFO_GAIN) {
    return {
      question: null,
      progress: { questionNumber: answers.length, maxQuestions: MAX_QUESTIONS },
      patternConfidences: confidences,
      shouldTerminate: true,
      terminationReason: 'No remaining question has meaningful information gain',
    };
  }

  return {
    question: bestQuestion,
    progress: { questionNumber: answers.length + 1, maxQuestions: MAX_QUESTIONS },
    patternConfidences: confidences,
    shouldTerminate: false,
    terminationReason: null,
  };
}

// ---------------------------------------------------------------------------
// Audit / logging helpers
// ---------------------------------------------------------------------------

export function formatConfidenceLog(confidences: PatternConfidence[]): string {
  return confidences
    .sort((a, b) => b.confidence - a.confidence)
    .map((c) => `${c.pattern}=${c.confidence.toFixed(3)} (base=${c.baseFromSignals.toFixed(3)}, answers=${c.fromAnswers.toFixed(3)})`)
    .join('; ');
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

export async function getAssessmentSignals(assessmentSessionId: string, tenantId: string): Promise<VisualSignalShape[]> {
  return prisma.visualSignal.findMany({
    where: { assessmentSessionId, tenantId },
    select: { signalName: true, confidence: true },
  });
}

export async function getAssessmentAnswers(assessmentSessionId: string, tenantId: string): Promise<QuestionAnswerShape[]> {
  return prisma.questionAnswer.findMany({
    where: { assessmentSessionId, tenantId },
    select: { questionBankId: true, answerValue: true },
    orderBy: { answeredAt: 'asc' },
  });
}

export async function recordAnswer(params: {
  assessmentSessionId: string;
  tenantId: string;
  questionBankId: string;
  questionText: string;
  answerValue: string;
  answerType: string;
  confidenceDelta: number | null;
}) {
  return prisma.questionAnswer.create({
    data: {
      assessmentSessionId: params.assessmentSessionId,
      tenantId: params.tenantId,
      questionBankId: params.questionBankId,
      questionText: params.questionText,
      answerValue: params.answerValue,
      answerType: params.answerType,
      confidenceDelta: params.confidenceDelta,
    },
  });
}

export async function findQuestionBankById(id: string) {
  return prisma.questionBank.findUnique({ where: { id } });
}

// ---------------------------------------------------------------------------
// Mock mode flag
// ---------------------------------------------------------------------------

export const QUESTION_MOCK_MODE = process.env.QUESTION_MOCK_MODE === 'true';
