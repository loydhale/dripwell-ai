-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'FEATURE_REQUEST', 'GENERAL');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('BACKLOG', 'IN_PROGRESS', 'DONE', 'WONT_DO');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('SOFTWARE_ISSUE', 'PROCESS_ISSUE', 'DOCUMENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackDecision" AS ENUM ('DO_IT', 'DONT_DO_IT', 'MAYBE', 'NEEDS_MORE_INFO');

-- CreateEnum
CREATE TYPE "FeedbackPriority" AS ENUM ('P0', 'P1', 'P2');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssessmentStatus" ADD VALUE 'ESCALATED';
ALTER TYPE "AssessmentStatus" ADD VALUE 'DEFERRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_ESCALATED';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_DEFERRED';
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_CAPTURED';
ALTER TYPE "AuditAction" ADD VALUE 'VITALS_RECORDED';

-- AlterTable
ALTER TABLE "AssessmentSession" ADD COLUMN     "consent" JSONB,
ADD COLUMN     "vitals" JSONB;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AssessmentChangeLog" (
    "id" UUID NOT NULL,
    "assessmentSessionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "actionType" TEXT NOT NULL,
    "originalValue" JSONB,
    "modifiedValue" JSONB,
    "changedFields" JSONB,
    "providerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "submitterId" UUID NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'BACKLOG',
    "category" "FeedbackCategory",
    "decision" "FeedbackDecision",
    "priority" "FeedbackPriority",
    "assignedTo" UUID,
    "notes" TEXT,
    "promotedTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentChangeLog_tenantId_idx" ON "AssessmentChangeLog"("tenantId");

-- CreateIndex
CREATE INDEX "AssessmentChangeLog_assessmentSessionId_idx" ON "AssessmentChangeLog"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "AssessmentChangeLog_providerId_idx" ON "AssessmentChangeLog"("providerId");

-- CreateIndex
CREATE INDEX "AssessmentChangeLog_createdAt_idx" ON "AssessmentChangeLog"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_tenantId_idx" ON "Feedback"("tenantId");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_category_idx" ON "Feedback"("category");

-- CreateIndex
CREATE INDEX "Feedback_priority_idx" ON "Feedback"("priority");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- AddForeignKey
ALTER TABLE "AssessmentChangeLog" ADD CONSTRAINT "AssessmentChangeLog_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentChangeLog" ADD CONSTRAINT "AssessmentChangeLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentChangeLog" ADD CONSTRAINT "AssessmentChangeLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
