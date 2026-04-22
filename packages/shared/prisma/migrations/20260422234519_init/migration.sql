-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_USER', 'PROVIDER', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE');

-- CreateEnum
CREATE TYPE "FlagTier" AS ENUM ('T1_INFO', 'T2_FOLLOWUP', 'T3_URGENT');

-- CreateEnum
CREATE TYPE "QuestionCategory" AS ENUM ('ENERGY_SLEEP', 'HYDRATION', 'STRESS_RECOVERY', 'WOMENS_HEALTH', 'DIET_PATTERN', 'MEDICAL_HISTORY', 'SPECIFIC_SYMPTOMS', 'GOALS');

-- CreateEnum
CREATE TYPE "PhotoAngle" AS ENUM ('FACE', 'UNDER_EYES', 'HAND_FOREARM', 'TONGUE');

-- CreateEnum
CREATE TYPE "SignalName" AS ENUM ('CONJUNCTIVAL_PALLOR', 'UNDER_EYE_DARKNESS', 'UNDER_EYE_PUFFINESS', 'SCLERA_TINT', 'LIP_DRYNESS', 'LIP_PALLOR', 'ANGULAR_CHEILITIS', 'TONGUE_COLOR', 'TONGUE_SURFACE', 'FACIAL_DULLNESS', 'FACIAL_REDNESS', 'SKIN_TEXTURE', 'NAIL_BED_COLOR', 'NAIL_RIDGING', 'NAIL_SPOONING', 'HAIR_QUALITY', 'POSTURE_AFFECT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ASSESSMENT_CREATED', 'PHOTO_CAPTURED', 'SIGNAL_EXTRACTED', 'QUESTION_ANSWERED', 'PATTERN_MATCHED', 'RECOMMENDATION_GENERATED', 'SAFETY_FLAG_RAISED', 'PROVIDER_APPROVED', 'PROVIDER_OVERRIDDEN', 'CATALOG_UPDATED', 'USER_INVITED', 'USER_DEACTIVATED', 'SETTINGS_CHANGED');

-- CreateEnum
CREATE TYPE "OverrideReason" AS ENUM ('CLINICAL_DISAGREEMENT', 'PATIENT_PREFERENCE', 'CONTRAINDICATION_RESOLVED', 'INSUFFICIENT_DATA', 'SAFETY_CONCERN', 'OTHER');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'APPROVED', 'MODIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "medicalDirector" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "locationId" UUID,
    "providerId" UUID NOT NULL,
    "anonymousToken" TEXT,
    "isReturning" BOOLEAN NOT NULL DEFAULT false,
    "priorSessionId" UUID,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientIntake" (
    "id" UUID NOT NULL,
    "assessmentSessionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "medications" JSONB,
    "conditions" JSONB,
    "allergies" JSONB,
    "menstrualStatus" TEXT,
    "recentIllness" TEXT,
    "supplements" JSONB,
    "visitGoals" JSONB,
    "isFromOcr" BOOLEAN NOT NULL DEFAULT false,
    "ocrConfidence" DOUBLE PRECISION,
    "providerVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoCapture" (
    "id" UUID NOT NULL,
    "assessmentSessionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "angle" "PhotoAngle" NOT NULL,
    "url" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3),
    "isOfflineSync" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisualSignal" (
    "id" UUID NOT NULL,
    "assessmentSessionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "photoCaptureId" UUID,
    "signalName" "SignalName" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "value" TEXT,
    "rawJson" JSONB,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisualSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAnswer" (
    "id" UUID NOT NULL,
    "assessmentSessionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "questionBankId" UUID NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerValue" TEXT NOT NULL,
    "answerType" TEXT NOT NULL,
    "confidenceDelta" DOUBLE PRECISION,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternMatch" (
    "id" UUID NOT NULL,
    "assessmentSessionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clinicalPatternId" UUID NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "matchedSignals" JSONB NOT NULL,
    "matchedAnswers" JSONB NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatternMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" UUID NOT NULL,
    "assessmentSessionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "primaryCatalogItemId" UUID NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationItem" (
    "id" UUID NOT NULL,
    "recommendationId" UUID NOT NULL,
    "catalogItemId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "dosageNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyFlag" (
    "id" UUID NOT NULL,
    "assessmentSessionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "recommendationId" UUID,
    "tier" "FlagTier" NOT NULL,
    "flagType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedScript" TEXT,
    "providerAcknowledgedAt" TIMESTAMP(3),
    "providerAcknowledgedById" UUID,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderOverride" (
    "id" UUID NOT NULL,
    "assessmentSessionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "recommendationId" UUID,
    "safetyFlagId" UUID,
    "overrideType" TEXT NOT NULL,
    "reason" "OverrideReason" NOT NULL,
    "reasonNote" TEXT,
    "originalValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalPattern" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supportingSignals" JSONB NOT NULL,
    "supportingAnswers" JSONB NOT NULL,
    "conflictingSignals" JSONB NOT NULL,
    "genericRecommendationIntent" TEXT NOT NULL,
    "clinicalRationale" TEXT NOT NULL,
    "safetyFlags" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalTaxonomy" (
    "id" UUID NOT NULL,
    "name" "SignalName" NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bodyRegion" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "possibleValues" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalTaxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionBank" (
    "id" UUID NOT NULL,
    "category" "QuestionCategory" NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerType" TEXT NOT NULL,
    "answerOptions" JSONB,
    "informationGainWeight" DOUBLE PRECISION,
    "followUpQuestions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ItemType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isInStock" BOOLEAN NOT NULL DEFAULT true,
    "outOfStockReason" TEXT,
    "stateRestrictions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItemIngredient" (
    "id" UUID NOT NULL,
    "catalogItemId" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "dosage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogItemIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItemCompatibility" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "baseItemId" UUID NOT NULL,
    "compatibleItemId" UUID NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "maxQuantity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogItemCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "userId" UUID,
    "assessmentSessionId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentHistory" (
    "id" UUID NOT NULL,
    "assessmentSessionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "baselineSessionId" UUID,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_isActive_idx" ON "Tenant"("isActive");

-- CreateIndex
CREATE INDEX "Location_tenantId_idx" ON "Location"("tenantId");

-- CreateIndex
CREATE INDEX "Location_isActive_idx" ON "Location"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSession_anonymousToken_key" ON "AssessmentSession"("anonymousToken");

-- CreateIndex
CREATE INDEX "AssessmentSession_tenantId_idx" ON "AssessmentSession"("tenantId");

-- CreateIndex
CREATE INDEX "AssessmentSession_providerId_idx" ON "AssessmentSession"("providerId");

-- CreateIndex
CREATE INDEX "AssessmentSession_anonymousToken_idx" ON "AssessmentSession"("anonymousToken");

-- CreateIndex
CREATE INDEX "AssessmentSession_status_idx" ON "AssessmentSession"("status");

-- CreateIndex
CREATE INDEX "AssessmentSession_createdAt_idx" ON "AssessmentSession"("createdAt");

-- CreateIndex
CREATE INDEX "AssessmentSession_priorSessionId_idx" ON "AssessmentSession"("priorSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientIntake_assessmentSessionId_key" ON "PatientIntake"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "PatientIntake_tenantId_idx" ON "PatientIntake"("tenantId");

-- CreateIndex
CREATE INDEX "PatientIntake_assessmentSessionId_idx" ON "PatientIntake"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "PatientIntake_createdAt_idx" ON "PatientIntake"("createdAt");

-- CreateIndex
CREATE INDEX "PhotoCapture_tenantId_idx" ON "PhotoCapture"("tenantId");

-- CreateIndex
CREATE INDEX "PhotoCapture_assessmentSessionId_idx" ON "PhotoCapture"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "PhotoCapture_createdAt_idx" ON "PhotoCapture"("createdAt");

-- CreateIndex
CREATE INDEX "VisualSignal_tenantId_idx" ON "VisualSignal"("tenantId");

-- CreateIndex
CREATE INDEX "VisualSignal_assessmentSessionId_idx" ON "VisualSignal"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "VisualSignal_photoCaptureId_idx" ON "VisualSignal"("photoCaptureId");

-- CreateIndex
CREATE INDEX "VisualSignal_signalName_idx" ON "VisualSignal"("signalName");

-- CreateIndex
CREATE INDEX "VisualSignal_createdAt_idx" ON "VisualSignal"("createdAt");

-- CreateIndex
CREATE INDEX "QuestionAnswer_tenantId_idx" ON "QuestionAnswer"("tenantId");

-- CreateIndex
CREATE INDEX "QuestionAnswer_assessmentSessionId_idx" ON "QuestionAnswer"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "QuestionAnswer_questionBankId_idx" ON "QuestionAnswer"("questionBankId");

-- CreateIndex
CREATE INDEX "QuestionAnswer_createdAt_idx" ON "QuestionAnswer"("createdAt");

-- CreateIndex
CREATE INDEX "PatternMatch_tenantId_idx" ON "PatternMatch"("tenantId");

-- CreateIndex
CREATE INDEX "PatternMatch_assessmentSessionId_idx" ON "PatternMatch"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "PatternMatch_clinicalPatternId_idx" ON "PatternMatch"("clinicalPatternId");

-- CreateIndex
CREATE INDEX "PatternMatch_createdAt_idx" ON "PatternMatch"("createdAt");

-- CreateIndex
CREATE INDEX "Recommendation_tenantId_idx" ON "Recommendation"("tenantId");

-- CreateIndex
CREATE INDEX "Recommendation_assessmentSessionId_idx" ON "Recommendation"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "Recommendation_providerId_idx" ON "Recommendation"("providerId");

-- CreateIndex
CREATE INDEX "Recommendation_status_idx" ON "Recommendation"("status");

-- CreateIndex
CREATE INDEX "Recommendation_createdAt_idx" ON "Recommendation"("createdAt");

-- CreateIndex
CREATE INDEX "RecommendationItem_recommendationId_idx" ON "RecommendationItem"("recommendationId");

-- CreateIndex
CREATE INDEX "RecommendationItem_catalogItemId_idx" ON "RecommendationItem"("catalogItemId");

-- CreateIndex
CREATE INDEX "SafetyFlag_tenantId_idx" ON "SafetyFlag"("tenantId");

-- CreateIndex
CREATE INDEX "SafetyFlag_assessmentSessionId_idx" ON "SafetyFlag"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "SafetyFlag_recommendationId_idx" ON "SafetyFlag"("recommendationId");

-- CreateIndex
CREATE INDEX "SafetyFlag_tier_idx" ON "SafetyFlag"("tier");

-- CreateIndex
CREATE INDEX "SafetyFlag_createdAt_idx" ON "SafetyFlag"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderOverride_tenantId_idx" ON "ProviderOverride"("tenantId");

-- CreateIndex
CREATE INDEX "ProviderOverride_assessmentSessionId_idx" ON "ProviderOverride"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "ProviderOverride_providerId_idx" ON "ProviderOverride"("providerId");

-- CreateIndex
CREATE INDEX "ProviderOverride_recommendationId_idx" ON "ProviderOverride"("recommendationId");

-- CreateIndex
CREATE INDEX "ProviderOverride_safetyFlagId_idx" ON "ProviderOverride"("safetyFlagId");

-- CreateIndex
CREATE INDEX "ProviderOverride_createdAt_idx" ON "ProviderOverride"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalPattern_name_key" ON "ClinicalPattern"("name");

-- CreateIndex
CREATE INDEX "ClinicalPattern_category_idx" ON "ClinicalPattern"("category");

-- CreateIndex
CREATE INDEX "ClinicalPattern_isActive_idx" ON "ClinicalPattern"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SignalTaxonomy_name_key" ON "SignalTaxonomy"("name");

-- CreateIndex
CREATE INDEX "QuestionBank_category_idx" ON "QuestionBank"("category");

-- CreateIndex
CREATE INDEX "QuestionBank_isActive_idx" ON "QuestionBank"("isActive");

-- CreateIndex
CREATE INDEX "CatalogItem_tenantId_idx" ON "CatalogItem"("tenantId");

-- CreateIndex
CREATE INDEX "CatalogItem_type_idx" ON "CatalogItem"("type");

-- CreateIndex
CREATE INDEX "CatalogItem_isActive_idx" ON "CatalogItem"("isActive");

-- CreateIndex
CREATE INDEX "CatalogItem_isInStock_idx" ON "CatalogItem"("isInStock");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE INDEX "Ingredient_isActive_idx" ON "Ingredient"("isActive");

-- CreateIndex
CREATE INDEX "CatalogItemIngredient_catalogItemId_idx" ON "CatalogItemIngredient"("catalogItemId");

-- CreateIndex
CREATE INDEX "CatalogItemIngredient_ingredientId_idx" ON "CatalogItemIngredient"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItemIngredient_catalogItemId_ingredientId_key" ON "CatalogItemIngredient"("catalogItemId", "ingredientId");

-- CreateIndex
CREATE INDEX "CatalogItemCompatibility_tenantId_idx" ON "CatalogItemCompatibility"("tenantId");

-- CreateIndex
CREATE INDEX "CatalogItemCompatibility_baseItemId_idx" ON "CatalogItemCompatibility"("baseItemId");

-- CreateIndex
CREATE INDEX "CatalogItemCompatibility_compatibleItemId_idx" ON "CatalogItemCompatibility"("compatibleItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItemCompatibility_baseItemId_compatibleItemId_key" ON "CatalogItemCompatibility"("baseItemId", "compatibleItemId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_assessmentSessionId_idx" ON "AuditLog"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AssessmentHistory_tenantId_idx" ON "AssessmentHistory"("tenantId");

-- CreateIndex
CREATE INDEX "AssessmentHistory_assessmentSessionId_idx" ON "AssessmentHistory"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "AssessmentHistory_baselineSessionId_idx" ON "AssessmentHistory"("baselineSessionId");

-- CreateIndex
CREATE INDEX "AssessmentHistory_createdAt_idx" ON "AssessmentHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_priorSessionId_fkey" FOREIGN KEY ("priorSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientIntake" ADD CONSTRAINT "PatientIntake_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientIntake" ADD CONSTRAINT "PatientIntake_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoCapture" ADD CONSTRAINT "PhotoCapture_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoCapture" ADD CONSTRAINT "PhotoCapture_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualSignal" ADD CONSTRAINT "VisualSignal_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualSignal" ADD CONSTRAINT "VisualSignal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualSignal" ADD CONSTRAINT "VisualSignal_photoCaptureId_fkey" FOREIGN KEY ("photoCaptureId") REFERENCES "PhotoCapture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_questionBankId_fkey" FOREIGN KEY ("questionBankId") REFERENCES "QuestionBank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternMatch" ADD CONSTRAINT "PatternMatch_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternMatch" ADD CONSTRAINT "PatternMatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternMatch" ADD CONSTRAINT "PatternMatch_clinicalPatternId_fkey" FOREIGN KEY ("clinicalPatternId") REFERENCES "ClinicalPattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_primaryCatalogItemId_fkey" FOREIGN KEY ("primaryCatalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationItem" ADD CONSTRAINT "RecommendationItem_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationItem" ADD CONSTRAINT "RecommendationItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyFlag" ADD CONSTRAINT "SafetyFlag_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyFlag" ADD CONSTRAINT "SafetyFlag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyFlag" ADD CONSTRAINT "SafetyFlag_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyFlag" ADD CONSTRAINT "SafetyFlag_providerAcknowledgedById_fkey" FOREIGN KEY ("providerAcknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOverride" ADD CONSTRAINT "ProviderOverride_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOverride" ADD CONSTRAINT "ProviderOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOverride" ADD CONSTRAINT "ProviderOverride_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOverride" ADD CONSTRAINT "ProviderOverride_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOverride" ADD CONSTRAINT "ProviderOverride_safetyFlagId_fkey" FOREIGN KEY ("safetyFlagId") REFERENCES "SafetyFlag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemIngredient" ADD CONSTRAINT "CatalogItemIngredient_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemIngredient" ADD CONSTRAINT "CatalogItemIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemCompatibility" ADD CONSTRAINT "CatalogItemCompatibility_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemCompatibility" ADD CONSTRAINT "CatalogItemCompatibility_baseItemId_fkey" FOREIGN KEY ("baseItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemCompatibility" ADD CONSTRAINT "CatalogItemCompatibility_compatibleItemId_fkey" FOREIGN KEY ("compatibleItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHistory" ADD CONSTRAINT "AssessmentHistory_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHistory" ADD CONSTRAINT "AssessmentHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHistory" ADD CONSTRAINT "AssessmentHistory_baselineSessionId_fkey" FOREIGN KEY ("baselineSessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
