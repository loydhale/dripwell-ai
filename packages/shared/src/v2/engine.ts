import {
  clinicConfigurationSchema,
  initialRecommendationSchema,
  wellnessPlanSchema,
  type Answer,
  type CatalogProduct,
  type ClinicConfiguration,
  type ClinicQuestion,
  type ConsultationSummary,
  type InitialRecommendation,
  type QuestionState,
  type RecommendationItemSnapshot,
  type WellnessOfferSnapshot,
  type RuleCondition,
  type WellnessPlan,
  type ActualCare,
} from './contracts.js';

export const ENGINE_VERSION = 'dripwell-rules-v2.1' as const;
export const WELLNESS_ENGINE_VERSION = 'dripwell-rules-v2.2' as const;
export type ConditionResult = 'MATCH' | 'NO_MATCH' | 'UNKNOWN';
const treatmentTypes = new Set(['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE']);

function boundedFlags(flags: string[]): string[] {
  const unique = [...new Set(flags)];
  return unique.length <= 1000
    ? unique
    : [
        ...unique.slice(0, 999),
        'Additional policy checks failed. Review the full clinic configuration before approval.',
      ];
}

function isKnown(answer: Answer | undefined): answer is Answer {
  return Boolean(
    answer &&
    answer.status === 'CONFIRMED' &&
    answer.value !== null &&
    !(typeof answer.value === 'string' && answer.value.trim() === '') &&
    !(Array.isArray(answer.value) && answer.value.length === 0),
  );
}

function answerMatchesQuestion(question: ClinicQuestion, answer: Answer): boolean {
  const value = answer.value;
  switch (question.type) {
    case 'BOOLEAN':
      return typeof value === 'boolean';
    case 'NUMBER':
      return typeof value === 'number' && Number.isFinite(value);
    case 'TEXT':
      return typeof value === 'string' && value.trim().length > 0;
    case 'CHOICE':
      return typeof value === 'string' && question.options.includes(value);
    case 'MULTI_CHOICE':
      return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((item) => question.options.includes(item))
      );
  }
}

function conditionMatchesQuestion(question: ClinicQuestion, condition: RuleCondition): boolean {
  const value = condition.value;
  switch (question.type) {
    case 'BOOLEAN':
      return ['EQ', 'NEQ'].includes(condition.operator) && typeof value === 'boolean';
    case 'NUMBER':
      return (
        ['EQ', 'NEQ', 'GTE', 'LTE'].includes(condition.operator) &&
        typeof value === 'number' &&
        Number.isFinite(value)
      );
    case 'TEXT':
      return ['EQ', 'NEQ', 'CONTAINS'].includes(condition.operator)
        ? typeof value === 'string' && value.trim().length > 0
        : condition.operator === 'IN' &&
            Array.isArray(value) &&
            value.length > 0 &&
            value.every((item) => item.trim().length > 0);
    case 'CHOICE':
      return ['EQ', 'NEQ'].includes(condition.operator)
        ? typeof value === 'string' && question.options.includes(value)
        : condition.operator === 'IN' &&
            Array.isArray(value) &&
            value.length > 0 &&
            value.every((item) => question.options.includes(item));
    case 'MULTI_CHOICE':
      return (
        condition.operator === 'CONTAINS' &&
        typeof value === 'string' &&
        question.options.includes(value)
      );
  }
}

function evaluateConfiguredCondition(
  config: ClinicConfiguration,
  condition: RuleCondition,
  answers: ConsultationSummary['answers'],
): ConditionResult {
  const question = config.questions.find((candidate) => candidate.id === condition.questionId);
  const answer = answers[condition.questionId];
  if (
    !question ||
    !conditionMatchesQuestion(question, condition) ||
    !isKnown(answer) ||
    !answerMatchesQuestion(question, answer)
  )
    return 'UNKNOWN';
  return evaluateCondition(condition, answers);
}

/** Unknown or unconfirmed answers never evaluate as a negative safety answer. */
export function evaluateCondition(
  condition: RuleCondition,
  answers: ConsultationSummary['answers'],
): ConditionResult {
  const answer = answers[condition.questionId];
  if (!isKnown(answer)) return 'UNKNOWN';
  const actual = answer.value;
  const target = condition.value;
  let matches: boolean;
  switch (condition.operator) {
    case 'EQ':
    case 'NEQ': {
      if (typeof actual !== typeof target || Array.isArray(actual) || Array.isArray(target))
        return 'UNKNOWN';
      matches = actual === target;
      if (condition.operator === 'NEQ') matches = !matches;
      break;
    }
    case 'CONTAINS': {
      if (typeof target !== 'string') return 'UNKNOWN';
      if (typeof actual === 'string')
        matches = actual.toLocaleLowerCase('en-US').includes(target.toLocaleLowerCase('en-US'));
      else if (Array.isArray(actual)) matches = actual.includes(target);
      else return 'UNKNOWN';
      break;
    }
    case 'IN': {
      if (!Array.isArray(target) || typeof actual !== 'string') return 'UNKNOWN';
      matches = target.includes(actual);
      break;
    }
    case 'GTE':
    case 'LTE': {
      if (typeof target !== 'number' || typeof actual !== 'number') return 'UNKNOWN';
      matches = condition.operator === 'GTE' ? actual >= target : actual <= target;
      break;
    }
  }
  return matches ? 'MATCH' : 'NO_MATCH';
}

export function evaluateRequiredQuestions(
  config: ClinicConfiguration,
  summary: ConsultationSummary,
): QuestionState[] {
  return (
    [...config.questions]
      // An unknown activation condition keeps the question visible and required.
      .filter((question) => {
        const conditions = question.activeWhen.map((condition) =>
          evaluateConfiguredCondition(config, condition, summary.answers),
        );
        return conditions.includes('UNKNOWN') || !conditions.includes('NO_MATCH');
      })
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
      .map((question) => {
        const answer = summary.answers[question.id];
        return {
          questionId: question.id,
          text: question.text,
          why: question.why,
          required: question.required || question.safetyRelevant,
          safetyRelevant: question.safetyRelevant,
          status:
            !answer ||
            answer.value === null ||
            answer.value === '' ||
            (Array.isArray(answer.value) && !answer.value.length)
              ? ('MISSING' as const)
              : isKnown(answer) && answerMatchesQuestion(question, answer)
                ? ('ANSWERED' as const)
                : ('NEEDS_CONFIRMATION' as const),
        };
      })
  );
}

export function validateConfigurationForActivation(configInput: ClinicConfiguration): string[] {
  const parsed = clinicConfigurationSchema.safeParse(configInput);
  if (!parsed.success)
    return parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  const config = parsed.data;
  const errors: string[] = [];
  const questionIds = new Set<string>();
  const productIds = new Set<string>();
  for (const question of config.questions) {
    if (questionIds.has(question.id)) errors.push(`Duplicate question ID: ${question.id}`);
    questionIds.add(question.id);
    if (['CHOICE', 'MULTI_CHOICE'].includes(question.type) && question.options.length === 0)
      errors.push(`Question ${question.id} needs answer choices.`);
    if (new Set(question.options).size !== question.options.length)
      errors.push(`Question ${question.id} has duplicate answer choices.`);
  }
  for (const product of config.products) {
    if (productIds.has(product.id)) errors.push(`Duplicate product ID: ${product.id}`);
    productIds.add(product.id);
    if (product.available && product.priceCents === null)
      errors.push(`Product ${product.id} needs an official price.`);
    if (product.currency !== config.clinic.currency)
      errors.push(`Product ${product.id} has a different currency.`);
    if (treatmentTypes.has(product.type) && !product.clinical)
      errors.push(`Treatment ${product.id} must be marked clinical.`);
    if (product.available && (product.clinical || treatmentTypes.has(product.type))) {
      if (
        !product.rules.validated ||
        !product.rules.validationNote.trim() ||
        !product.rules.rationale.trim()
      )
        errors.push(`Product ${product.id} needs validated clinical rules and rationale.`);
      if (product.rules.eligibility.length === 0)
        errors.push(`Product ${product.id} needs explicit clinical eligibility conditions.`);
    }
    if (product.available && product.type === 'MEMBERSHIP' && !product.terms.trim())
      errors.push(`Membership ${product.id} needs official terms.`);
  }
  for (const question of config.questions) {
    for (const condition of question.activeWhen) {
      if (!questionIds.has(condition.questionId))
        errors.push(
          `Question ${question.id} refers to an unknown question ${condition.questionId}.`,
        );
      if (condition.questionId === question.id)
        errors.push(`Question ${question.id} cannot depend on its own answer.`);
      const referenced = config.questions.find(
        (candidate) => candidate.id === condition.questionId,
      );
      if (referenced && !conditionMatchesQuestion(referenced, condition))
        errors.push(
          `Question ${question.id} has an incompatible condition for ${condition.questionId}.`,
        );
    }
  }
  for (const product of config.products) {
    for (const condition of [...product.rules.eligibility, ...product.rules.exclusions]) {
      if (!questionIds.has(condition.questionId))
        errors.push(`Product ${product.id} refers to unknown question ${condition.questionId}.`);
      const referenced = config.questions.find(
        (candidate) => candidate.id === condition.questionId,
      );
      if (referenced && !conditionMatchesQuestion(referenced, condition))
        errors.push(
          `Product ${product.id} has an incompatible condition for ${condition.questionId}.`,
        );
    }
    for (const other of product.compatibleWith) {
      if (!productIds.has(other) || other === product.id)
        errors.push(`Product ${product.id} has invalid compatibility ${other}.`);
    }
  }
  const clinicalProducts = config.products.some(
    (product) => product.available && (product.clinical || treatmentTypes.has(product.type)),
  );
  if (clinicalProducts) {
    if (
      !config.recommendationPolicy.clinicalValidated ||
      !config.recommendationPolicy.validatedBy.trim() ||
      !config.recommendationPolicy.validationNote.trim()
    )
      errors.push('The clinical policy needs documented authorized clinical validation.');
    if (!config.questions.some((question) => question.safetyRelevant && question.required))
      errors.push('The clinic must supply required safety questions.');
  }
  if (!config.products.some((product) => product.available))
    errors.push('The catalog needs an available product.');
  return [...new Set(errors)];
}

export interface EligibilityResult {
  eligible: boolean;
  flags: string[];
  evidence: string[];
}
export function evaluateProductEligibility(
  product: CatalogProduct,
  config: ClinicConfiguration,
  summary: ConsultationSummary,
): EligibilityResult {
  const flags: string[] = [];
  const evidence: string[] = [];
  if (!product.available) flags.push(`${product.name} is unavailable.`);
  if (product.priceCents === null || product.currency !== config.clinic.currency)
    flags.push(`${product.name} has no confirmed local price.`);
  const clinical = product.clinical || treatmentTypes.has(product.type);
  if (
    clinical &&
    (!config.recommendationPolicy.clinicalValidated ||
      !product.rules.validated ||
      product.rules.eligibility.length === 0)
  )
    flags.push(`${product.name} has no validated clinical eligibility policy.`);
  if (clinical) {
    for (const question of evaluateRequiredQuestions(config, summary)) {
      if (question.required && question.status !== 'ANSWERED')
        flags.push(
          `${product.name}: confirm required safety or suitability answer ${question.questionId}.`,
        );
    }
  }
  for (const condition of product.rules.eligibility) {
    const result = evaluateConfiguredCondition(config, condition, summary.answers);
    if (result === 'UNKNOWN')
      flags.push(`${product.name}: confirm eligibility answer ${condition.questionId}.`);
    if (result === 'NO_MATCH')
      flags.push(`${product.name}: configured eligibility is not met (${condition.questionId}).`);
    if (result === 'MATCH')
      evidence.push(
        summary.answers[condition.questionId]?.evidence ||
          `Confirmed answer: ${condition.questionId}`,
      );
  }
  for (const condition of product.rules.exclusions) {
    const result = evaluateConfiguredCondition(config, condition, summary.answers);
    if (result === 'UNKNOWN')
      flags.push(`${product.name}: confirm exclusion answer ${condition.questionId}.`);
    if (result === 'MATCH')
      flags.push(`${product.name}: configured exclusion applies (${condition.questionId}).`);
  }
  return { eligible: flags.length === 0, flags, evidence };
}

function normalizedGoals(summary: ConsultationSummary): string[] {
  return summary.goals.map((goal) => goal.trim().toLocaleLowerCase('en-US'));
}
function goalMatches(product: CatalogProduct, summary: ConsultationSummary): string[] {
  const goals = normalizedGoals(summary);
  return product.goalTags.filter((tag) => goals.includes(tag.trim().toLocaleLowerCase('en-US')));
}
export function wellnessOfferFacts(
  product: CatalogProduct,
  summary: ConsultationSummary,
): Pick<WellnessOfferSnapshot, 'benefits' | 'matchedGoals'> {
  const tags = product.goalTags.map((tag) => tag.trim().toLocaleLowerCase('en-US'));
  return {
    benefits: [...product.benefits],
    matchedGoals: summary.goals.filter((goal) =>
      tags.includes(goal.trim().toLocaleLowerCase('en-US')),
    ),
  };
}
function ranked(products: CatalogProduct[], summary: ConsultationSummary): CatalogProduct[] {
  return [...products].sort(
    (a, b) =>
      goalMatches(b, summary).length - goalMatches(a, summary).length ||
      b.priority - a.priority ||
      a.id.localeCompare(b.id),
  );
}
function snapshot(product: CatalogProduct, evidence: string[]): RecommendationItemSnapshot {
  if (product.priceCents === null) throw new Error('Cannot snapshot an unpriced product.');
  return {
    productId: product.id,
    name: product.name,
    type: product.type,
    priceCents: product.priceCents,
    currency: product.currency,
    quantity: 1,
    rationale: product.rules.rationale,
    evidence,
    terms: product.terms,
  };
}

export function recommendInitial(
  config: ClinicConfiguration,
  summary: ConsultationSummary,
  configurationVersionId: string,
): InitialRecommendation {
  const unresolvedQuestions = evaluateRequiredQuestions(config, summary).filter(
    (question) => question.required && question.status !== 'ANSWERED',
  );
  const configErrors = validateConfigurationForActivation(config);
  const safetyFlags = [...configErrors];
  if (!summary.staffReviewed) safetyFlags.push('The consultation summary needs staff review.');
  if (unresolvedQuestions.length)
    safetyFlags.push('Required safety and eligibility questions need confirmed answers.');
  const candidates = config.products.filter((product) => treatmentTypes.has(product.type));
  const eligible = candidates.filter((product) => {
    const result = evaluateProductEligibility(product, config, summary);
    if (!result.eligible) safetyFlags.push(...result.flags);
    return result.eligible;
  });
  const blocked =
    configErrors.length > 0 || !summary.staffReviewed || unresolvedQuestions.length > 0;
  const ivs = ranked(
    eligible.filter((product) => product.type === 'DRIP'),
    summary,
  );
  const alternatives = eligible.map((product) =>
    snapshot(product, evaluateProductEligibility(product, config, summary).evidence),
  );
  const primary = ivs[0];
  const chosen =
    !blocked && primary
      ? [
          primary,
          ...ranked(
            eligible.filter(
              (product) =>
                product.type === 'ADD_ON' &&
                product.compatibleWith.includes(primary.id) &&
                goalMatches(product, summary).length > 0,
            ),
            summary,
          ).slice(0, config.recommendationPolicy.maxAddOns),
        ]
      : [];
  if (!primary)
    safetyFlags.push(
      'No suitable available IV meets the configured rules. Document the visit and obtain clinical review.',
    );
  const items = chosen.map((product) =>
    snapshot(product, evaluateProductEligibility(product, config, summary).evidence),
  );
  const explanation = items.length
    ? `Based on the reviewed conversation and your clinic's validated rules, today's proposed option is ${items.map((item) => item.name).join(' with ')}. ${items
        .map((item) => item.rationale)
        .filter(Boolean)
        .join(' ')} An authorized provider must approve this recommendation before it is shared.`
    : 'No treatment recommendation is ready. Review the missing information and clinical suitability with an authorized provider.';
  return initialRecommendationSchema.parse({
    configurationVersionId,
    engineVersion: ENGINE_VERSION,
    items,
    alternatives,
    explanation,
    unresolvedQuestions,
    safetyFlags: boundedFlags(safetyFlags),
    eligibleProductIds: eligible.map((product) => product.id),
    blocked: blocked || !primary,
  });
}

/** Staff may select eligible alternatives, never rewrite the historical catalog snapshot. */
export function validateInitialSelection(
  config: ClinicConfiguration,
  summary: ConsultationSummary,
  recommendation: InitialRecommendation,
): string[] {
  const computed = recommendInitial(config, summary, recommendation.configurationVersionId);
  const errors: string[] = [];
  if (computed.blocked)
    errors.push(
      'Clinical approval is blocked by unresolved required information or clinic policy.',
    );
  if (!recommendation.items.length)
    errors.push('Select a suitable IV or document the visit without clinical approval.');
  if (recommendation.items.filter((item) => item.type === 'DRIP').length !== 1)
    errors.push('A treatment recommendation must contain exactly one IV.');
  const primary = recommendation.items.find((item) => item.type === 'DRIP');
  if (
    new Set(recommendation.items.map((item) => item.productId)).size !== recommendation.items.length
  )
    errors.push('A recommended product cannot be duplicated.');
  const addOns = recommendation.items.filter((item) => item.type === 'ADD_ON');
  if (addOns.length > config.recommendationPolicy.maxAddOns)
    errors.push('The configured add-on limit is exceeded.');
  for (const item of recommendation.items) {
    const product = config.products.find((candidate) => candidate.id === item.productId);
    if (!product || !computed.eligibleProductIds.includes(item.productId)) {
      errors.push(`${item.productId} is not currently eligible.`);
      continue;
    }
    if (
      item.priceCents !== product.priceCents ||
      item.currency !== product.currency ||
      item.name !== product.name ||
      item.type !== product.type ||
      item.terms !== product.terms ||
      item.quantity !== 1
    )
      errors.push(
        `${product.name} must retain its official catalog data and a single documented unit.`,
      );
    if (product.type === 'ADD_ON' && primary && !product.compatibleWith.includes(primary.productId))
      errors.push(`${product.name} is not compatible with the selected IV.`);
  }
  if (!recommendation.explanation.trim()) errors.push('A client explanation is required.');
  return [...new Set(errors)];
}

export function recommendWellness(
  config: ClinicConfiguration,
  summary: ConsultationSummary,
  care: ActualCare,
  configurationVersionId: string,
): WellnessPlan {
  if (care.outcome === 'PENDING')
    throw new Error('Record the actual care outcome before producing a wellness plan.');
  const safetyFlags = validateConfigurationForActivation(config);
  const eligibleOffers =
    summary.wellnessOffersAllowed === true && summary.staffReviewed && safetyFlags.length === 0
      ? ranked(
          config.products.filter((product) => {
            if (
              !['SERVICE', 'MEMBERSHIP'].includes(product.type) ||
              goalMatches(product, summary).length === 0
            )
              return false;
            const eligibility = evaluateProductEligibility(product, config, summary);
            if (!eligibility.eligible) safetyFlags.push(...eligibility.flags);
            return eligibility.eligible;
          }),
          summary,
        )
      : [];
  if (summary.wellnessOffersAllowed === null)
    safetyFlags.push(
      'Wellness offer preference is unconfirmed. No commercial offers are suggested.',
    );
  const offers = eligibleOffers
    .slice(0, config.recommendationPolicy.maxWellnessOffers)
    .map((product) => ({
      ...snapshot(product, [
        ...evaluateProductEligibility(product, config, summary).evidence,
        ...goalMatches(product, summary).map((goal) => `Reviewed goal: ${goal}`),
      ]),
      ...wellnessOfferFacts(product, summary),
    }));
  return wellnessPlanSchema.parse({
    configurationVersionId,
    engineVersion: WELLNESS_ENGINE_VERSION,
    visitSummary: summary.goals.length
      ? `During today's visit, you discussed: ${summary.goals.join('; ')}.`
      : 'Your consultation was reviewed by the clinic team.',
    careReceived: care,
    offers,
    explanation: offers.length
      ? `If useful for the goals you discussed, ask your clinic about ${offers.map((item) => item.name).join(', ')}. These are optional next steps, with the official prices and terms shown below.`
      : 'Your care summary is below. Contact your clinic if you would like to discuss future services.',
    safetyFlags: boundedFlags(safetyFlags),
  });
}

export function validateWellnessSelection(
  config: ClinicConfiguration,
  summary: ConsultationSummary,
  plan: WellnessPlan,
): string[] {
  const errors: string[] = [];
  if (plan.careReceived.outcome === 'PENDING') errors.push('Actual care must be recorded first.');
  if (plan.offers.length && summary.wellnessOffersAllowed !== true)
    errors.push('Confirm that the client wants wellness offers.');
  if (plan.offers.length > config.recommendationPolicy.maxWellnessOffers)
    errors.push('The configured wellness offer limit is exceeded.');
  if (new Set(plan.offers.map((item) => item.productId)).size !== plan.offers.length)
    errors.push('A wellness offer cannot be duplicated.');
  for (const item of plan.offers) {
    const product = config.products.find((candidate) => candidate.id === item.productId);
    if (
      !product ||
      !['MEMBERSHIP', 'SERVICE'].includes(product.type) ||
      !evaluateProductEligibility(product, config, summary).eligible
    ) {
      errors.push(`${item.productId} is not an eligible service or membership.`);
      continue;
    }
    if (
      item.priceCents !== product.priceCents ||
      item.currency !== product.currency ||
      item.name !== product.name ||
      item.type !== product.type ||
      item.terms !== product.terms ||
      item.quantity !== 1
    )
      errors.push(`${product.name} must retain official catalog pricing and terms.`);
  }
  if (plan.engineVersion === WELLNESS_ENGINE_VERSION) {
    for (const item of plan.offers) {
      const product = config.products.find((candidate) => candidate.id === item.productId);
      if (!product) continue;
      const facts = wellnessOfferFacts(product, summary);
      if (
        JSON.stringify(item.benefits) !== JSON.stringify(facts.benefits) ||
        JSON.stringify(item.matchedGoals) !== JSON.stringify(facts.matchedGoals)
      )
        errors.push(`${product.name} must retain approved benefits and reviewed goals.`);
    }
  }
  if (!summary.staffReviewed) errors.push('The consultation summary needs staff review.');
  if (!plan.visitSummary.trim() || !plan.explanation.trim())
    errors.push('The takeaway needs a visit summary and explanation.');
  return [...new Set(errors)];
}
