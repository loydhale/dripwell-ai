import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  // ---------------------------------------------------------------------------
  // Tenant + Location
  // ---------------------------------------------------------------------------
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Test Wellness Clinic',
      slug: 'test-wellness',
      state: 'TX',
      medicalDirector: 'Dr. Jane Smith',
      locations: {
        create: {
          name: 'Main Clinic',
          address: '123 Wellness Blvd, Austin, TX 78701',
          phone: '512-555-0100',
        },
      },
    },
    include: { locations: true },
  });

  const location = tenant.locations[0];

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  const superUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'super@test.com',
      passwordHash: '$2b$10$hashedplaceholder',
      firstName: 'Clinic',
      lastName: 'Owner',
      role: 'SUPER_USER',
    },
  });

  const provider = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'provider@test.com',
      passwordHash: '$2b$10$hashedplaceholder',
      firstName: 'Sarah',
      lastName: 'Nurse',
      role: 'PROVIDER',
    },
  });

  // ---------------------------------------------------------------------------
  // Ingredients (universal)
  // ---------------------------------------------------------------------------
  await prisma.ingredient.createMany({
    data: [
      { name: 'Vitamin C', description: 'Ascorbic acid' },
      { name: 'Vitamin B12', description: 'Methylcobalamin' },
      { name: 'Magnesium', description: 'Magnesium chloride' },
      { name: 'Glutathione', description: 'Master antioxidant' },
      { name: 'Zinc', description: 'Zinc sulfate' },
      { name: 'Iron', description: 'Iron dextran' },
      { name: 'B-Complex', description: 'B1, B2, B3, B5, B6' },
      { name: 'Normal Saline', description: '0.9% sodium chloride' },
    ],
  });

  const allIngredients = await prisma.ingredient.findMany();
  const ingredientMap = new Map(allIngredients.map(i => [i.name, i.id]));

  // ---------------------------------------------------------------------------
  // Catalog items
  // ---------------------------------------------------------------------------
  const myersCocktail = await prisma.catalogItem.create({
    data: {
      tenantId: tenant.id,
      name: "Myers' Cocktail",
      description: 'Classic wellness drip with vitamins and minerals',
      type: 'DRIP',
      ingredients: {
        create: [
          { ingredientId: ingredientMap.get('Vitamin C')!, dosage: '5g' },
          { ingredientId: ingredientMap.get('Vitamin B12')!, dosage: '1mg' },
          { ingredientId: ingredientMap.get('Magnesium')!, dosage: '2g' },
          { ingredientId: ingredientMap.get('B-Complex')!, dosage: '2ml' },
          { ingredientId: ingredientMap.get('Normal Saline')!, dosage: '500ml' },
        ],
      },
    },
  });

  const glutathionePush = await prisma.catalogItem.create({
    data: {
      tenantId: tenant.id,
      name: 'Glutathione Push',
      description: 'Antioxidant booster add-on',
      type: 'ADD_ON',
      ingredients: {
        create: [
          { ingredientId: ingredientMap.get('Glutathione')!, dosage: '200mg' },
        ],
      },
    },
  });

  const b12Shot = await prisma.catalogItem.create({
    data: {
      tenantId: tenant.id,
      name: 'B12 Injection',
      description: 'Quick energy boost injection',
      type: 'INJECTION',
      ingredients: {
        create: [
          { ingredientId: ingredientMap.get('Vitamin B12')!, dosage: '1mg' },
        ],
      },
    },
  });

  // Compatibility: Myers' Cocktail can have Glutathione Push as add-on
  await prisma.catalogItemCompatibility.create({
    data: {
      tenantId: tenant.id,
      baseItemId: myersCocktail.id,
      compatibleItemId: glutathionePush.id,
      isDefault: false,
      maxQuantity: 1,
    },
  });

  // ---------------------------------------------------------------------------
  // Signal taxonomy
  // ---------------------------------------------------------------------------
  await prisma.signalTaxonomy.createMany({
    data: [
      {
        name: 'CONJUNCTIVAL_PALLOR',
        displayName: 'Conjunctival Pallor',
        description: 'Pale inner eyelid indicating possible iron deficiency',
        bodyRegion: 'eyes',
        dataType: 'categorical',
        possibleValues: JSON.stringify(['none', 'mild', 'moderate', 'severe']),
      },
      {
        name: 'UNDER_EYE_DARKNESS',
        displayName: 'Under-Eye Darkness',
        description: 'Dark circles under eyes',
        bodyRegion: 'eyes',
        dataType: 'categorical',
        possibleValues: JSON.stringify(['none', 'mild', 'moderate', 'severe']),
      },
      {
        name: 'TONGUE_COLOR',
        displayName: 'Tongue Color',
        description: 'Color of tongue surface',
        bodyRegion: 'mouth',
        dataType: 'categorical',
        possibleValues: JSON.stringify(['pink', 'pale', 'red', 'white-coated']),
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Question bank
  // ---------------------------------------------------------------------------
  await prisma.questionBank.createMany({
    data: [
      {
        category: 'ENERGY_SLEEP',
        questionText: 'How many hours of sleep do you average per night?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['<5', '5-6', '7-8', '9+']),
        informationGainWeight: 0.8,
      },
      {
        category: 'HYDRATION',
        questionText: 'How many glasses of water do you drink daily?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['<3', '3-5', '6-8', '9+']),
        informationGainWeight: 0.7,
      },
      {
        category: 'STRESS_RECOVERY',
        questionText: 'How would you rate your current stress level?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['low', 'moderate', 'high', 'extreme']),
        informationGainWeight: 0.75,
      },
      {
        category: 'WOMENS_HEALTH',
        questionText: 'Do you experience heavy menstrual bleeding?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['no', 'yes_sometimes', 'yes_always', 'not_applicable']),
        informationGainWeight: 0.65,
      },
      {
        category: 'DIET_PATTERN',
        questionText: 'How would you describe your typical diet?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['balanced', 'irregular', 'restricted', 'mostly_processed']),
        informationGainWeight: 0.7,
      },
      {
        category: 'MEDICAL_HISTORY',
        questionText: 'Are you currently taking any iron supplements?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['yes', 'no', 'unsure']),
        informationGainWeight: 0.6,
      },
      {
        category: 'SPECIFIC_SYMPTOMS',
        questionText: 'How long have you been feeling unusually fatigued?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['not_at_all', 'few_days', 'few_weeks', 'months_or_more']),
        informationGainWeight: 0.8,
      },
      {
        category: 'STRESS_RECOVERY',
        questionText: 'How well do you recover after exercise?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['very_well', 'okay', 'poor', 'dont_exercise']),
        informationGainWeight: 0.65,
      },
      {
        category: 'ENERGY_SLEEP',
        questionText: 'How many caffeinated drinks do you have per day?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['0', '1-2', '3-4', '5+']),
        informationGainWeight: 0.6,
      },
      {
        category: 'SPECIFIC_SYMPTOMS',
        questionText: 'Do you experience persistent dry skin?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['no', 'mild', 'moderate', 'severe']),
        informationGainWeight: 0.7,
      },
      {
        category: 'SPECIFIC_SYMPTOMS',
        questionText: 'Do you experience frequent muscle cramps?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['no', 'rarely', 'sometimes', 'often']),
        informationGainWeight: 0.75,
      },
      {
        category: 'GOALS',
        questionText: 'What is your primary goal for this visit?',
        answerType: 'single_choice',
        answerOptions: JSON.stringify(['energy', 'recovery', 'immunity', 'beauty', 'hangover', 'athletic', 'stress', 'hydration', 'other']),
        informationGainWeight: 0.9,
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Clinical patterns
  // ---------------------------------------------------------------------------
  const ironDeficiency = await prisma.clinicalPattern.create({
    data: {
      name: 'Iron Deficiency Cluster',
      description: 'Cluster of visual and reported signs consistent with low iron status',
      category: 'nutritional',
      supportingSignals: JSON.stringify([
        { signalName: 'CONJUNCTIVAL_PALLOR', minConfidence: 0.6, required: true },
        { signalName: 'TONGUE_COLOR', minConfidence: 0.5, required: false },
      ]),
      supportingAnswers: JSON.stringify([
        { questionCategory: 'ENERGY_SLEEP', expectedAnswerPattern: '<5|5-6' },
        { questionCategory: 'MEDICAL_HISTORY', expectedAnswerPattern: 'heavy_menstruation' },
      ]),
      conflictingSignals: JSON.stringify([
        { signalName: 'FACIAL_REDNESS', reason: 'suggests inflammation rather than deficiency' },
      ]),
      genericRecommendationIntent: 'Iron-support IV with B-complex',
      clinicalRationale: 'Conjunctival pallor is a well-documented NFPE sign for iron deficiency. Supporting fatigue history increases confidence.',
      safetyFlags: JSON.stringify([
        { tier: 'T2_FOLLOWUP', type: 'iron_overload_risk', description: 'Screen for hemochromatosis before iron-containing drips' },
      ]),
    },
  });

  // ---------------------------------------------------------------------------
  // Assessment session (anonymous)
  // ---------------------------------------------------------------------------
  const session = await prisma.assessmentSession.create({
    data: {
      tenantId: tenant.id,
      locationId: location.id,
      providerId: provider.id,
      anonymousToken: 'anon-test-001',
      status: 'IN_PROGRESS',
      patientIntake: {
        create: {
          tenantId: tenant.id,
          medications: JSON.stringify([]),
          conditions: JSON.stringify([]),
          allergies: JSON.stringify([]),
          visitGoals: JSON.stringify(['energy', 'immunity']),
          isFromOcr: false,
        },
      },
    },
    include: { patientIntake: true },
  });

  // Photo capture
  const photo = await prisma.photoCapture.create({
    data: {
      tenantId: tenant.id,
      assessmentSessionId: session.id,
      angle: 'FACE',
      url: 'https://s3.example.com/dripwell/photos/face-001.jpg',
      capturedAt: new Date(),
      uploadedAt: new Date(),
    },
  });

  // Visual signals
  await prisma.visualSignal.createMany({
    data: [
      {
        tenantId: tenant.id,
        assessmentSessionId: session.id,
        photoCaptureId: photo.id,
        signalName: 'CONJUNCTIVAL_PALLOR',
        confidence: 0.78,
        value: 'moderate',
        rawJson: JSON.stringify({ region: 'lower_eyelid', confidence: 0.78, severity: 'moderate' }),
      },
      {
        tenantId: tenant.id,
        assessmentSessionId: session.id,
        photoCaptureId: photo.id,
        signalName: 'UNDER_EYE_DARKNESS',
        confidence: 0.65,
        value: 'mild',
      },
    ],
  });

  // Question answers
  const questions = await prisma.questionBank.findMany();
  for (const q of questions) {
    await prisma.questionAnswer.create({
      data: {
        tenantId: tenant.id,
        assessmentSessionId: session.id,
        questionBankId: q.id,
        questionText: q.questionText,
        answerValue: JSON.parse(q.answerOptions as string)[1] ?? 'yes',
        answerType: q.answerType,
        confidenceDelta: 0.1,
      },
    });
  }

  // Pattern match
  await prisma.patternMatch.create({
    data: {
      tenantId: tenant.id,
      assessmentSessionId: session.id,
      clinicalPatternId: ironDeficiency.id,
      confidence: 0.72,
      matchedSignals: JSON.stringify(['CONJUNCTIVAL_PALLOR']),
      matchedAnswers: JSON.stringify(questions.map(q => q.id)),
      isPrimary: true,
    },
  });

  // Recommendation
  const recommendation = await prisma.recommendation.create({
    data: {
      tenantId: tenant.id,
      assessmentSessionId: session.id,
      providerId: provider.id,
      status: 'PENDING',
      primaryCatalogItemId: myersCocktail.id,
      rationale: 'Signal pattern consistent with iron deficiency cluster. Myers Cocktail provides B-complex and vitamin C for absorption support.',
      confidence: 0.72,
      recommendationItems: {
        create: [
          { catalogItemId: myersCocktail.id, isPrimary: true },
          { catalogItemId: glutathionePush.id, isPrimary: false, dosageNote: '200mg push after drip' },
        ],
      },
    },
  });

  // Safety flag
  const safetyFlag = await prisma.safetyFlag.create({
    data: {
      tenantId: tenant.id,
      assessmentSessionId: session.id,
      recommendationId: recommendation.id,
      tier: 'T2_FOLLOWUP',
      flagType: 'iron_overload_risk',
      description: 'Screen for hemochromatosis before iron-containing drips',
      suggestedScript: 'Before we proceed, do you have any family history of iron overload or hemochromatosis?',
    },
  });

  // Provider override example
  await prisma.providerOverride.create({
    data: {
      tenantId: tenant.id,
      assessmentSessionId: session.id,
      providerId: provider.id,
      safetyFlagId: safetyFlag.id,
      overrideType: 'safety_flag',
      reason: 'CLINICAL_DISAGREEMENT',
      reasonNote: 'Patient denies family history, no contraindications noted',
      originalValue: 'flag_active',
      newValue: 'flag_overridden',
    },
  });

  // Audit log entries
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: superUser.id,
        action: 'USER_INVITED',
        entityType: 'User',
        entityId: provider.id,
        details: JSON.stringify({ role: 'PROVIDER' }),
      },
      {
        tenantId: tenant.id,
        userId: provider.id,
        assessmentSessionId: session.id,
        action: 'ASSESSMENT_CREATED',
        entityType: 'AssessmentSession',
        entityId: session.id,
      },
      {
        tenantId: tenant.id,
        userId: provider.id,
        assessmentSessionId: session.id,
        action: 'PHOTO_CAPTURED',
        entityType: 'PhotoCapture',
        entityId: photo.id,
      },
    ],
  });

  // Assessment history
  await prisma.assessmentHistory.create({
    data: {
      tenantId: tenant.id,
      assessmentSessionId: session.id,
      eventType: 'baseline_established',
      description: 'First visit baseline signals recorded',
      metadata: JSON.stringify({ signalsCount: 2, questionsCount: questions.length }),
    },
  });

  console.log('Seed completed successfully.');
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Users: super=${superUser.email}, provider=${provider.email}`);
  console.log(`Catalog items: ${await prisma.catalogItem.count({ where: { tenantId: tenant.id } })}`);
  console.log(`Assessment session: ${session.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
