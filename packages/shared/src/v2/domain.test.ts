import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateTrial,
  assertExactApproval,
  emptyConsultationSummary,
  evaluateCondition,
  evaluateRequiredQuestions,
  evaluateTrialAllowance,
  isExactApproval,
  recommendInitial,
  recommendWellness,
  stageForWellnessDecision,
  transitionStage,
  validateConfigurationForActivation,
  validateInitialSelection,
  validateWellnessSelection,
  type ActualCare,
  type CatalogProduct,
  type ClinicConfiguration,
  type ConsultationSummary,
  type ClinicQuestion,
  type RuleCondition,
} from './index.js';

const configurationVersionId = 'b981b1b9-50fd-419a-aaad-f841f9b67891';
const condition = { questionId: 'clearance', operator: 'EQ' as const, value: true };
function product(id: string, type: CatalogProduct['type'], priceCents: number): CatalogProduct {
  return {
    id,
    type,
    name: id,
    description: '',
    priceCents,
    currency: 'USD',
    available: true,
    ingredients: [],
    goalTags: ['test goal'],
    compatibleWith: [],
    benefits: [],
    terms: type === 'MEMBERSHIP' ? 'Owner-supplied monthly test terms.' : '',
    clinical: type !== 'MEMBERSHIP' && type !== 'SERVICE',
    rules: {
      validated: true,
      validationNote: 'Synthetic test policy only.',
      eligibility: [{ ...condition }],
      exclusions: [{ questionId: 'exclusion', operator: 'EQ', value: true }],
      rationale: 'Synthetic test rationale.',
    },
    priority: 0,
  };
}
function fixture(): { config: ClinicConfiguration; summary: ConsultationSummary } {
  const config: ClinicConfiguration = {
    schemaVersion: 2,
    clinic: { name: 'Synthetic clinic', currency: 'USD', contact: '', brandColor: '#0d9488' },
    questions: [
      {
        id: 'clearance',
        text: 'Synthetic eligibility confirmed?',
        why: 'Synthetic rule evaluation.',
        type: 'BOOLEAN',
        options: [],
        required: true,
        safetyRelevant: true,
        activeWhen: [],
        priority: 10,
      },
      {
        id: 'exclusion',
        text: 'Synthetic exclusion present?',
        why: 'Synthetic exclusion evaluation.',
        type: 'BOOLEAN',
        options: [],
        required: true,
        safetyRelevant: true,
        activeWhen: [],
        priority: 9,
      },
    ],
    products: [
      product('iv-a', 'DRIP', 14000),
      product('iv-b', 'DRIP', 20000),
      { ...product('addon', 'ADD_ON', 4000), compatibleWith: ['iv-a'] },
      product('membership', 'MEMBERSHIP', 8000),
    ],
    recommendationPolicy: {
      clinicalValidated: true,
      validatedBy: 'Synthetic authorized tester',
      validationNote: 'Synthetic fixture only.',
      maxAddOns: 1,
      maxWellnessOffers: 2,
    },
    reminders: { careOutcomeHours: 24, wellnessDecisionHours: 24 },
    retention: { audioDays: 7, documentDays: 30, shareExpiryHours: 24 },
  };
  const summary: ConsultationSummary = {
    ...emptyConsultationSummary(),
    goals: ['test goal'],
    staffReviewed: true,
    wellnessOffersAllowed: true,
    answers: {
      clearance: {
        value: true,
        status: 'CONFIRMED',
        source: 'STAFF',
        evidence: 'Staff confirmed test clearance.',
      },
      exclusion: {
        value: false,
        status: 'CONFIRMED',
        source: 'STAFF',
        evidence: 'Staff confirmed test absence.',
      },
    },
  };
  return { config, summary };
}
function care(): ActualCare {
  return {
    outcome: 'NOT_STARTED',
    items: [],
    observations: 'Synthetic outcome.',
    reason: 'Client choice.',
    membershipEnrolled: null,
    membershipProductId: null,
    servicePurchased: null,
    confirmedCollectedCents: null,
    currency: 'USD',
  };
}

test('unknown and uncertain exclusions do not become safe negative answers', () => {
  const { config, summary } = fixture();
  delete summary.answers.exclusion;
  const recommendation = recommendInitial(config, summary, configurationVersionId);
  assert.equal(recommendation.blocked, true);
  assert.deepEqual(recommendation.items, []);
  assert.equal(recommendation.unresolvedQuestions[0]?.status, 'MISSING');
  summary.answers.exclusion = {
    value: false,
    status: 'UNCERTAIN',
    source: 'TRANSCRIPT',
    evidence: 'Low-confidence transcription.',
  };
  assert.equal(recommendInitial(config, summary, configurationVersionId).blocked, true);
  assert.equal(
    evaluateCondition({ questionId: 'exclusion', operator: 'EQ', value: true }, summary.answers),
    'UNKNOWN',
  );
});

test('confirmed boolean false is a valid answer and exclusions block matching products', () => {
  const { config, summary } = fixture();
  assert.equal(
    evaluateRequiredQuestions(config, summary).every((question) => question.status === 'ANSWERED'),
    true,
  );
  assert.equal(recommendInitial(config, summary, configurationVersionId).blocked, false);
  summary.answers.exclusion!.value = true;
  assert.equal(recommendInitial(config, summary, configurationVersionId).blocked, true);
});

test('staff must review summary; repeated inputs produce identical decisions and prices', () => {
  const { config, summary } = fixture();
  const first = recommendInitial(config, summary, configurationVersionId);
  assert.deepEqual(first, recommendInitial(config, summary, configurationVersionId));
  assert.deepEqual(
    first.items.map((item) => [item.productId, item.priceCents]),
    [
      ['iv-a', 14000],
      ['addon', 4000],
    ],
  );
  summary.staffReviewed = false;
  assert.deepEqual(recommendInitial(config, summary, configurationVersionId).items, []);
});

test('prices never influence clinical ordering, and unavailable products are excluded', () => {
  const { config, summary } = fixture();
  config.products[0]!.priceCents = 900000;
  config.products[1]!.priceCents = 1;
  assert.equal(
    recommendInitial(config, summary, configurationVersionId).items[0]?.productId,
    'iv-a',
  );
  config.products[0]!.available = false;
  const changed = recommendInitial(config, summary, configurationVersionId);
  assert.equal(changed.items[0]?.productId, 'iv-b');
  assert.equal(
    changed.items.some((item) => item.productId === 'addon'),
    false,
  );
});

test('catalog prices, clinical validation, rule references and compatibility are activation gates', () => {
  const { config } = fixture();
  assert.deepEqual(validateConfigurationForActivation(config), []);
  config.products[0]!.priceCents = null;
  config.products[0]!.rules.validated = false;
  config.products[1]!.rules.eligibility[0]!.questionId = 'missing';
  config.products[2]!.compatibleWith = ['missing'];
  const errors = validateConfigurationForActivation(config);
  assert.equal(
    errors.some((error) => error.includes('official price')),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes('validated clinical')),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes('unknown question')),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes('invalid compatibility')),
    true,
  );
});

test('staff edits cannot add excluded items, alter official prices or incompatible add-ons', () => {
  const { config, summary } = fixture();
  const recommendation = recommendInitial(config, summary, configurationVersionId);
  assert.deepEqual(validateInitialSelection(config, summary, recommendation), []);
  recommendation.items[0]!.priceCents = 1;
  assert.equal(
    validateInitialSelection(config, summary, recommendation).some((error) =>
      error.includes('official catalog'),
    ),
    true,
  );
  const clean = recommendInitial(config, summary, configurationVersionId);
  clean.items[0] = clean.alternatives.find((item) => item.productId === 'iv-b')!;
  assert.equal(
    validateInitialSelection(config, summary, clean).some((error) =>
      error.includes('not compatible'),
    ),
    true,
  );
});

test('unknown conditional follow-up remains visible, wrong answer types need confirmation', () => {
  const { config, summary } = fixture();
  config.questions.push({
    ...config.questions[0]!,
    id: 'followup',
    required: true,
    activeWhen: [{ questionId: 'exclusion', operator: 'EQ', value: true }],
  });
  delete summary.answers.exclusion;
  assert.equal(
    evaluateRequiredQuestions(config, summary).some(
      (question) => question.questionId === 'followup',
    ),
    true,
  );
  summary.answers.clearance!.value = 'true';
  assert.equal(
    evaluateRequiredQuestions(config, summary).find(
      (question) => question.questionId === 'clearance',
    )?.status,
    'NEEDS_CONFIRMATION',
  );
});

function conditionalSafetyFixture(
  gateType: ClinicQuestion['type'],
  condition: RuleCondition,
): {
  config: ClinicConfiguration;
  summary: ConsultationSummary;
} {
  const { config, summary } = fixture();
  config.questions.push(
    {
      ...config.questions[0]!,
      id: 'gate',
      type: gateType,
      options: ['yes', 'no'],
      required: false,
      safetyRelevant: false,
    },
    { ...config.questions[0]!, id: 'conditional-safety', activeWhen: [condition] },
  );
  return { config, summary };
}

test('audit reproduction: invalid numeric gate condition and wrong-type answer cannot hide required safety', () => {
  const { config, summary } = conditionalSafetyFixture('NUMBER', {
    questionId: 'gate',
    operator: 'EQ',
    value: true,
  });
  summary.answers.gate = {
    value: false,
    status: 'CONFIRMED',
    source: 'STAFF',
    evidence: 'Adversarial wrong-type value.',
  };
  assert.equal(
    validateConfigurationForActivation(config).some((error) =>
      error.includes('incompatible condition'),
    ),
    true,
  );
  const states = evaluateRequiredQuestions(config, summary);
  assert.equal(
    states.find((question) => question.questionId === 'gate')?.status,
    'NEEDS_CONFIRMATION',
  );
  assert.equal(
    states.find((question) => question.questionId === 'conditional-safety')?.status,
    'MISSING',
  );
  const initial = recommendInitial(config, summary, configurationVersionId);
  assert.equal(initial.blocked, true);
  assert.deepEqual(initial.items, []);
  assert.equal(
    initial.unresolvedQuestions.some((question) => question.questionId === 'conditional-safety'),
    true,
  );
});

test('valid numeric gate rejects wrong-type answers at runtime and applies only confirmed numeric values', () => {
  const { config, summary } = conditionalSafetyFixture('NUMBER', {
    questionId: 'gate',
    operator: 'EQ',
    value: 1,
  });
  assert.deepEqual(validateConfigurationForActivation(config), []);
  summary.answers.gate = {
    value: false,
    status: 'CONFIRMED',
    source: 'STAFF',
    evidence: 'Wrong type.',
  };
  assert.equal(recommendInitial(config, summary, configurationVersionId).blocked, true);
  summary.answers.gate.value = 0;
  assert.equal(
    evaluateRequiredQuestions(config, summary).some(
      (question) => question.questionId === 'conditional-safety',
    ),
    false,
  );
  assert.equal(recommendInitial(config, summary, configurationVersionId).blocked, false);
  summary.answers.gate.value = 1;
  assert.equal(recommendInitial(config, summary, configurationVersionId).blocked, true);
});

test('condition compatibility rejects unsupported operators and literal types in question and product rules', () => {
  const incompatible: [
    ClinicQuestion['type'],
    RuleCondition['operator'],
    RuleCondition['value'],
  ][] = [
    ['BOOLEAN', 'GTE', 0],
    ['NUMBER', 'EQ', true],
    ['NUMBER', 'IN', ['1']],
    ['CHOICE', 'CONTAINS', 'yes'],
    ['CHOICE', 'EQ', 'not-an-option'],
    ['CHOICE', 'IN', ['yes', 'invalid']],
    ['MULTI_CHOICE', 'EQ', ['yes']],
    ['MULTI_CHOICE', 'CONTAINS', 'invalid'],
    ['TEXT', 'IN', []],
    ['TEXT', 'EQ', ''],
    ['TEXT', 'GTE', 1],
  ];
  for (const [type, operator, value] of incompatible) {
    const badCondition: RuleCondition = { questionId: 'gate', operator, value };
    const { config } = conditionalSafetyFixture(type, badCondition);
    config.products[0]!.rules.eligibility.push(badCondition);
    const errors = validateConfigurationForActivation(config);
    assert.equal(
      errors.some((error) =>
        error.startsWith('Question conditional-safety has an incompatible condition'),
      ),
      true,
      `${type}/${operator}`,
    );
    assert.equal(
      errors.some((error) => error.startsWith('Product iv-a has an incompatible condition')),
      true,
      `${type}/${operator}`,
    );
  }
});

test('invalid choice and multi-choice answers cannot hide conditional safety questions', () => {
  const cases: [ClinicQuestion['type'], RuleCondition['operator'], string | string[]][] = [
    ['CHOICE', 'EQ', 'invalid'],
    ['MULTI_CHOICE', 'CONTAINS', ['invalid']],
  ];
  for (const [type, operator, wrongAnswer] of cases) {
    const { config, summary } = conditionalSafetyFixture(type, {
      questionId: 'gate',
      operator,
      value: 'yes',
    });
    assert.deepEqual(validateConfigurationForActivation(config), []);
    summary.answers.gate = {
      value: Array.isArray(wrongAnswer) ? [...wrongAnswer] : wrongAnswer,
      status: 'CONFIRMED',
      source: 'STAFF',
      evidence: 'Invalid option.',
    };
    assert.equal(recommendInitial(config, summary, configurationVersionId).blocked, true);
    assert.equal(
      evaluateRequiredQuestions(config, summary).some(
        (question) => question.questionId === 'conditional-safety',
      ),
      true,
    );
  }
});

test('an unknown conditional input keeps safety visible even alongside a known non-match', () => {
  const { config, summary } = conditionalSafetyFixture('NUMBER', {
    questionId: 'gate',
    operator: 'EQ',
    value: 1,
  });
  config.questions
    .find((question) => question.id === 'conditional-safety')!
    .activeWhen.push({ questionId: 'clearance', operator: 'EQ', value: false });
  assert.equal(
    evaluateRequiredQuestions(config, summary).some(
      (question) => question.questionId === 'conditional-safety',
    ),
    true,
  );
  assert.equal(recommendInitial(config, summary, configurationVersionId).blocked, true);
});

test('wellness offers require explicit preference and matching reviewed goals', () => {
  const { config, summary } = fixture();
  const wellness = recommendWellness(config, summary, care(), configurationVersionId);
  assert.equal(wellness.offers[0]?.productId, 'membership');
  assert.deepEqual(validateWellnessSelection(config, summary, wellness), []);
  summary.wellnessOffersAllowed = null;
  assert.deepEqual(recommendWellness(config, summary, care(), configurationVersionId).offers, []);
  assert.equal(
    validateWellnessSelection(config, summary, wellness).some((error) =>
      error.includes('client wants'),
    ),
    true,
  );
  summary.wellnessOffersAllowed = true;
  summary.goals = ['unrelated'];
  assert.deepEqual(recommendWellness(config, summary, care(), configurationVersionId).offers, []);
});

test('wellness generation requires actual care outcome; acceptance never implies care or payment', () => {
  const { config, summary } = fixture();
  assert.throws(
    () =>
      recommendWellness(config, summary, { ...care(), outcome: 'PENDING' }, configurationVersionId),
    /actual care/,
  );
  const wellness = recommendWellness(config, summary, care(), configurationVersionId);
  assert.equal(wellness.careReceived.outcome, 'NOT_STARTED');
  assert.equal(wellness.careReceived.membershipEnrolled, null);
  assert.equal(wellness.careReceived.confirmedCollectedCents, null);
});

test('audit reproduction: clinical wellness service is gated by unanswered required screening while nonclinical suitability remains separate', () => {
  const { config, summary } = fixture();
  const service = { ...product('clinical-service', 'SERVICE', 12000), clinical: true };
  service.rules.exclusions = [];
  config.products.push(service);
  config.products.find((item) => item.id === 'membership')!.rules.exclusions = [];
  const complete = recommendWellness(config, summary, care(), configurationVersionId);
  const clinicalOffer = complete.offers.find((item) => item.productId === service.id)!;
  assert.ok(clinicalOffer);
  delete summary.answers.exclusion;
  assert.deepEqual(validateConfigurationForActivation(config), []);
  const incomplete = recommendWellness(config, summary, care(), configurationVersionId);
  assert.equal(
    incomplete.offers.some((item) => item.productId === service.id),
    false,
  );
  assert.equal(
    incomplete.offers.some((item) => item.productId === 'membership'),
    true,
  );
  assert.equal(
    incomplete.safetyFlags.some((flag) =>
      flag.includes('required safety or suitability answer exclusion'),
    ),
    true,
  );
  assert.equal(
    validateWellnessSelection(config, summary, { ...incomplete, offers: [clinicalOffer] }).some(
      (error) => error.includes('not an eligible'),
    ),
    true,
  );
  assert.deepEqual(validateWellnessSelection(config, summary, incomplete), []);
  summary.answers.exclusion = {
    value: false,
    status: 'UNCERTAIN',
    source: 'TRANSCRIPT',
    evidence: 'Unconfirmed screening.',
  };
  assert.equal(
    recommendWellness(config, summary, care(), configurationVersionId).offers.some(
      (item) => item.productId === service.id,
    ),
    false,
  );
  assert.equal(
    validateWellnessSelection(config, summary, { ...incomplete, offers: [clinicalOffer] }).length >
      0,
    true,
  );
});

test('automatic retries do not regress later manual stages; material changes require reconsideration', () => {
  assert.equal(
    transitionStage('CONSULTATION_STARTED', 'INITIAL_PRODUCED'),
    'INITIAL_RECOMMENDATIONS_GIVEN',
  );
  assert.equal(
    transitionStage('INITIAL_RECOMMENDATIONS_GIVEN', 'WELLNESS_PRODUCED'),
    'WELLNESS_RECOMMENDATIONS_PRODUCED',
  );
  for (const decision of ['ACCEPTED', 'REJECTED', 'TBD'] as const) {
    const stage = stageForWellnessDecision(decision);
    assert.equal(transitionStage(stage, 'INITIAL_PRODUCED'), stage);
    assert.equal(transitionStage(stage, 'WELLNESS_PRODUCED'), stage);
    assert.equal(transitionStage(stage, 'WELLNESS_CHANGED'), 'WELLNESS_RECOMMENDATIONS_PRODUCED');
  }
});

test('approvals bind exactly to a nonzero artifact revision', () => {
  assert.equal(isExactApproval(1, 1), true);
  assert.equal(isExactApproval(2, 1), false);
  assert.equal(isExactApproval(0, 0), false);
  assert.throws(() => assertExactApproval(2, 1, 'wellness plan'), /current wellness plan revision/);
});

test('trial expires at 14 days or 10 starts, while paid account remains allowed', () => {
  const now = new Date('2026-10-01T00:00:00.000Z');
  const trial = activateTrial(now);
  assert.equal(trial.trialLimit, 10);
  assert.equal(trial.trialEndsAt?.toISOString(), '2026-10-15T00:00:00.000Z');
  assert.equal(evaluateTrialAllowance(trial, now).consultationsRemaining, 10);
  assert.equal(evaluateTrialAllowance({ ...trial, trialUsed: 10 }, now).reason, 'LIMIT_REACHED');
  assert.equal(
    evaluateTrialAllowance(trial, new Date('2026-10-15T00:00:00.000Z')).reason,
    'TIME_EXPIRED',
  );
  assert.equal(
    evaluateTrialAllowance({ ...trial, status: 'ACTIVE', trialUsed: 50 }, now).canStart,
    true,
  );
  assert.equal(evaluateTrialAllowance({ ...trial, status: 'PAST_DUE' }, now).canStart, false);
  assert.equal(evaluateTrialAllowance({ ...trial, status: 'TRIALING' }, now).canStart, false);
  assert.equal(evaluateTrialAllowance(null, now).reason, 'NOT_ACTIVATED');
});
