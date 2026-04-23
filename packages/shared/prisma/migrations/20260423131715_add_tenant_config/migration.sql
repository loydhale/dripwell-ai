-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssessmentStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "AssessmentStatus" ADD VALUE 'APPROVED';
ALTER TYPE "AssessmentStatus" ADD VALUE 'OVERRIDDEN';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_COMPLETED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OverrideReason" ADD VALUE 'CLINICAL_JUDGEMENT';
ALTER TYPE "OverrideReason" ADD VALUE 'CONTRAINDICATION';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "config" JSONB DEFAULT '{}';
