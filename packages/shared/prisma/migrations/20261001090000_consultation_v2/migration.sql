-- CreateEnum
CREATE TYPE "ConfigurationStatus" AS ENUM ('DRAFT', 'TESTED', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ConsultationStage" AS ENUM ('CONSULTATION_STARTED', 'INITIAL_RECOMMENDATIONS_GIVEN', 'WELLNESS_RECOMMENDATIONS_PRODUCED', 'WELLNESS_RECOMMENDATIONS_ACCEPTED', 'WELLNESS_RECOMMENDATIONS_REJECTED', 'WELLNESS_RECOMMENDATION_TBD');

-- CreateEnum
CREATE TYPE "CareOutcome" AS ENUM ('PENDING', 'STARTED', 'NOT_STARTED');

-- CreateEnum
CREATE TYPE "WellnessDecision" AS ENUM ('ACCEPTED', 'REJECTED', 'TBD');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "referralCode" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canApproveClinical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaLastUsedStep" INTEGER,
ADD COLUMN     "mfaPendingExpiresAt" TIMESTAMP(3),
ADD COLUMN     "mfaPendingSecretEncrypted" TEXT,
ADD COLUMN     "mfaRecoveryHashes" JSONB DEFAULT '[]',
ADD COLUMN     "mfaSecretEncrypted" TEXT;

-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "priceCents" INTEGER;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "consultationId" UUID,
ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "userId" UUID;

-- CreateTable
CREATE TABLE "ClinicConfigurationVersion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "clinicalValidatedById" UUID,
    "tests" JSONB NOT NULL DEFAULT '[]',
    "activatedAt" TIMESTAMP(3),
    "activatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicConfigurationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "configurationVersionId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "stage" "ConsultationStage" NOT NULL DEFAULT 'CONSULTATION_STARTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "consentAt" TIMESTAMP(3),
    "consentDeclined" BOOLEAN NOT NULL DEFAULT false,
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "summaryRevision" INTEGER NOT NULL DEFAULT 1,
    "initialRecommendation" JSONB,
    "initialRevision" INTEGER NOT NULL DEFAULT 0,
    "clinicalApprovedVersion" INTEGER,
    "clinicalApprovedById" UUID,
    "clinicalApprovedAt" TIMESTAMP(3),
    "actualCare" JSONB,
    "careOutcome" "CareOutcome" NOT NULL DEFAULT 'PENDING',
    "wellnessPlan" JSONB,
    "wellnessRevision" INTEGER NOT NULL DEFAULT 0,
    "wellnessApprovedVersion" INTEGER,
    "wellnessApprovedById" UUID,
    "wellnessApprovedAt" TIMESTAMP(3),
    "wellnessDecision" "WellnessDecision",
    "wellnessDecisionRevision" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "archivedById" UUID,
    "archiveReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "careOutcomeDueAt" TIMESTAMP(3),
    "wellnessDecisionDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationRevision" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "consultationId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "original" BOOLEAN NOT NULL DEFAULT false,
    "userId" UUID,
    "reason" TEXT,
    "promptVersion" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "consultationId" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "artifactRevision" INTEGER,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationAdjustment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "consultationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "changedFields" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "ownerClassification" TEXT,
    "ownerReviewedById" UUID,
    "ownerReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "trialActivatedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "trialLimit" INTEGER NOT NULL DEFAULT 10,
    "trialUsed" INTEGER NOT NULL DEFAULT 0,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "lastStripeEventAt" TIMESTAMP(3),
    "stripeStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialUsage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "consultationId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" UUID NOT NULL,
    "referrerTenantId" UUID NOT NULL,
    "referredTenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "policyVersion" INTEGER,
    "policySnapshot" JSONB,
    "qualifyingInvoiceId" TEXT,
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ATTRIBUTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "referralId" UUID,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "stripeTransactionId" TEXT,
    "reversesId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPolicy" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "name" TEXT,
    "referralPolicy" JSONB,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventCreated" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Takeaway" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "consultationId" UUID NOT NULL,
    "wellnessRevision" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Takeaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "takeawayId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastCodeSentAt" TIMESTAMP(3),
    "codeSendWindowStart" TIMESTAMP(3),
    "codeSendCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareVerification" (
    "id" UUID NOT NULL,
    "shareLinkId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "challengeHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareSession" (
    "id" UUID NOT NULL,
    "shareLinkId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "mfaVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvite" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "canApproveClinical" BOOLEAN NOT NULL DEFAULT false,
    "tokenHash" TEXT NOT NULL,
    "invitedById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SetupConversation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "eveSessionId" TEXT,
    "draft" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "consultationId" UUID,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "runId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "result" JSONB,
    "usage" JSONB,
    "errorCode" TEXT,
    "expiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingSegment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "consultationId" UUID,
    "setupConversationId" UUID,
    "userId" UUID NOT NULL,
    "segmentKey" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "blobPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "transcript" TEXT,
    "staffTranscript" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementProposal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "configurationVersionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "proposedPayload" JSONB NOT NULL,
    "tests" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "userId" UUID NOT NULL,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "activatedVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImprovementProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentContextSnapshot" (
    "scopeKey" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "configVersionId" UUID,
    "context" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentContextSnapshot_pkey" PRIMARY KEY ("scopeKey")
);

-- CreateIndex
CREATE INDEX "ClinicConfigurationVersion_tenantId_locationId_status_idx" ON "ClinicConfigurationVersion"("tenantId", "locationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicConfigurationVersion_id_tenantId_key" ON "ClinicConfigurationVersion"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicConfigurationVersion_id_tenantId_locationId_key" ON "ClinicConfigurationVersion"("id", "tenantId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicConfigurationVersion_tenantId_locationId_version_key" ON "ClinicConfigurationVersion"("tenantId", "locationId", "version");

-- CreateIndex
CREATE INDEX "Consultation_tenantId_stage_archivedAt_idx" ON "Consultation"("tenantId", "stage", "archivedAt");

-- CreateIndex
CREATE INDEX "Consultation_tenantId_providerId_createdAt_idx" ON "Consultation"("tenantId", "providerId", "createdAt");

-- CreateIndex
CREATE INDEX "Consultation_tenantId_careOutcomeDueAt_idx" ON "Consultation"("tenantId", "careOutcomeDueAt");

-- CreateIndex
CREATE INDEX "Consultation_tenantId_wellnessDecisionDueAt_idx" ON "Consultation"("tenantId", "wellnessDecisionDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_id_tenantId_key" ON "Consultation"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_tenantId_idempotencyKey_key" ON "Consultation"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_tenantId_reference_key" ON "Consultation"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "ConsultationRevision_tenantId_consultationId_createdAt_idx" ON "ConsultationRevision"("tenantId", "consultationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationRevision_consultationId_kind_revision_key" ON "ConsultationRevision"("consultationId", "kind", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationEvent_idempotencyKey_key" ON "ConsultationEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ConsultationEvent_tenantId_consultationId_createdAt_idx" ON "ConsultationEvent"("tenantId", "consultationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationEvent_tenantId_action_createdAt_idx" ON "ConsultationEvent"("tenantId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationAdjustment_tenantId_consultationId_createdAt_idx" ON "ConsultationAdjustment"("tenantId", "consultationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationAdjustment_tenantId_ownerClassification_created_idx" ON "ConsultationAdjustment"("tenantId", "ownerClassification", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialUsage_consultationId_key" ON "TrialUsage"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialUsage_tenantId_idempotencyKey_key" ON "TrialUsage"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "TrialUsage_consultationId_tenantId_key" ON "TrialUsage"("consultationId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredTenantId_key" ON "Referral"("referredTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_qualifyingInvoiceId_key" ON "Referral"("qualifyingInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_sourceEventId_key" ON "CreditLedger"("sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_stripeTransactionId_key" ON "CreditLedger"("stripeTransactionId");

-- CreateIndex
CREATE INDEX "CreditLedger_tenantId_createdAt_idx" ON "CreditLedger"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedger_referralId_kind_idx" ON "CreditLedger"("referralId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_eventId_key" ON "BillingEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Takeaway_id_tenantId_key" ON "Takeaway"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Takeaway_consultationId_wellnessRevision_key" ON "Takeaway"("consultationId", "wellnessRevision");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_tokenHash_key" ON "ShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ShareLink_tenantId_takeawayId_idx" ON "ShareLink"("tenantId", "takeawayId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareVerification_challengeHash_key" ON "ShareVerification"("challengeHash");

-- CreateIndex
CREATE INDEX "ShareVerification_shareLinkId_createdAt_idx" ON "ShareVerification"("shareLinkId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareSession_tokenHash_key" ON "ShareSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AuthChallenge_tokenHash_key" ON "AuthChallenge"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvite_tokenHash_key" ON "UserInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "UserInvite_tenantId_email_idx" ON "UserInvite"("tenantId", "email");

-- CreateIndex
CREATE INDEX "SetupConversation_tenantId_userId_createdAt_idx" ON "SetupConversation"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SetupConversation_id_tenantId_key" ON "SetupConversation"("id", "tenantId");

-- CreateIndex
CREATE INDEX "GenerationJob_tenantId_status_createdAt_idx" ON "GenerationJob"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationJob_tenantId_idempotencyKey_key" ON "GenerationJob"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RecordingSegment_tenantId_expiresAt_idx" ON "RecordingSegment"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingSegment_tenantId_segmentKey_key" ON "RecordingSegment"("tenantId", "segmentKey");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingSegment_consultationId_sequence_key" ON "RecordingSegment"("consultationId", "sequence");

-- CreateIndex
CREATE INDEX "ImprovementProposal_tenantId_status_createdAt_idx" ON "ImprovementProposal"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentContextSnapshot_tenantId_userId_idx" ON "AgentContextSnapshot"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_referralCode_key" ON "Tenant"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Location_id_tenantId_key" ON "Location"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_tenantId_key" ON "User"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_consultationId_tenantId_fkey" FOREIGN KEY ("consultationId", "tenantId") REFERENCES "Consultation"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicConfigurationVersion" ADD CONSTRAINT "ClinicConfigurationVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicConfigurationVersion" ADD CONSTRAINT "ClinicConfigurationVersion_locationId_tenantId_fkey" FOREIGN KEY ("locationId", "tenantId") REFERENCES "Location"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_locationId_tenantId_fkey" FOREIGN KEY ("locationId", "tenantId") REFERENCES "Location"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_providerId_tenantId_fkey" FOREIGN KEY ("providerId", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_configurationVersionId_tenantId_locationId_fkey" FOREIGN KEY ("configurationVersionId", "tenantId", "locationId") REFERENCES "ClinicConfigurationVersion"("id", "tenantId", "locationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationRevision" ADD CONSTRAINT "ConsultationRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationRevision" ADD CONSTRAINT "ConsultationRevision_consultationId_tenantId_fkey" FOREIGN KEY ("consultationId", "tenantId") REFERENCES "Consultation"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationEvent" ADD CONSTRAINT "ConsultationEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationEvent" ADD CONSTRAINT "ConsultationEvent_consultationId_tenantId_fkey" FOREIGN KEY ("consultationId", "tenantId") REFERENCES "Consultation"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationAdjustment" ADD CONSTRAINT "ConsultationAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationAdjustment" ADD CONSTRAINT "ConsultationAdjustment_consultationId_tenantId_fkey" FOREIGN KEY ("consultationId", "tenantId") REFERENCES "Consultation"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialUsage" ADD CONSTRAINT "TrialUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialUsage" ADD CONSTRAINT "TrialUsage_consultationId_tenantId_fkey" FOREIGN KEY ("consultationId", "tenantId") REFERENCES "Consultation"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerTenantId_fkey" FOREIGN KEY ("referrerTenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredTenantId_fkey" FOREIGN KEY ("referredTenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Takeaway" ADD CONSTRAINT "Takeaway_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Takeaway" ADD CONSTRAINT "Takeaway_consultationId_tenantId_fkey" FOREIGN KEY ("consultationId", "tenantId") REFERENCES "Consultation"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_takeawayId_tenantId_fkey" FOREIGN KEY ("takeawayId", "tenantId") REFERENCES "Takeaway"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareVerification" ADD CONSTRAINT "ShareVerification_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareSession" ADD CONSTRAINT "ShareSession_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupConversation" ADD CONSTRAINT "SetupConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_consultationId_tenantId_fkey" FOREIGN KEY ("consultationId", "tenantId") REFERENCES "Consultation"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSegment" ADD CONSTRAINT "RecordingSegment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSegment" ADD CONSTRAINT "RecordingSegment_consultationId_tenantId_fkey" FOREIGN KEY ("consultationId", "tenantId") REFERENCES "Consultation"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSegment" ADD CONSTRAINT "RecordingSegment_setupConversationId_tenantId_fkey" FOREIGN KEY ("setupConversationId", "tenantId") REFERENCES "SetupConversation"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementProposal" ADD CONSTRAINT "ImprovementProposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementProposal" ADD CONSTRAINT "ImprovementProposal_configurationVersionId_tenantId_fkey" FOREIGN KEY ("configurationVersionId", "tenantId") REFERENCES "ClinicConfigurationVersion"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentContextSnapshot" ADD CONSTRAINT "AgentContextSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentContextSnapshot" ADD CONSTRAINT "AgentContextSnapshot_userId_tenantId_fkey" FOREIGN KEY ("userId", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentContextSnapshot" ADD CONSTRAINT "AgentContextSnapshot_configVersionId_tenantId_fkey" FOREIGN KEY ("configVersionId", "tenantId") REFERENCES "ClinicConfigurationVersion"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express these partial indexes/check constraints. They enforce
-- business invariants in addition to tenant-scoped application transactions.
CREATE UNIQUE INDEX "ClinicConfigurationVersion_one_active_location"
  ON "ClinicConfigurationVersion" ("tenantId", "locationId")
  WHERE "status" = 'ACTIVE';

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_no_self_referral"
  CHECK ("referrerTenantId" <> "referredTenantId");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_nonnegative_trial_usage"
  CHECK ("trialLimit" >= 0 AND "trialUsed" >= 0 AND "trialUsed" <= "trialLimit");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_trial_window_order"
  CHECK ("trialEndsAt" IS NULL OR "trialActivatedAt" IS NULL OR "trialEndsAt" > "trialActivatedAt");

ALTER TABLE "ClinicConfigurationVersion" ADD CONSTRAINT "ClinicConfigurationVersion_positive_versions"
  CHECK ("version" > 0 AND "revision" > 0);
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_nonnegative_versions"
  CHECK ("version" > 0 AND "summaryRevision" > 0 AND "initialRevision" >= 0 AND "wellnessRevision" >= 0);
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_clinical_approval_revision"
  CHECK ("clinicalApprovedVersion" IS NULL OR ("clinicalApprovedVersion" > 0 AND "clinicalApprovedVersion" <= "initialRevision"));
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_wellness_approval_revision"
  CHECK ("wellnessApprovedVersion" IS NULL OR ("wellnessApprovedVersion" > 0 AND "wellnessApprovedVersion" <= "wellnessRevision"));
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_decision_revision"
  CHECK ("wellnessDecisionRevision" IS NULL OR ("wellnessDecisionRevision" > 0 AND "wellnessDecisionRevision" <= "wellnessRevision"));

ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_valid_price"
  CHECK ("priceCents" IS NULL OR "priceCents" >= 0);
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_valid_currency"
  CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_valid_currency"
  CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_nonzero_amount"
  CHECK ("amountCents" <> 0);

ALTER TABLE "RecordingSegment" ADD CONSTRAINT "RecordingSegment_single_target"
  CHECK (("consultationId" IS NOT NULL)::integer + ("setupConversationId" IS NOT NULL)::integer = 1);
ALTER TABLE "RecordingSegment" ADD CONSTRAINT "RecordingSegment_valid_capture"
  CHECK ("sequence" >= 0 AND "bytes" > 0 AND ("durationSeconds" IS NULL OR "durationSeconds" >= 0) AND "expiresAt" > "createdAt");
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_valid_expiry"
  CHECK ("expiresAt" > "createdAt" AND "codeSendCount" >= 0);
ALTER TABLE "ShareVerification" ADD CONSTRAINT "ShareVerification_valid_attempts"
  CHECK ("attempts" >= 0);
