-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'IMPERSONATION_STARTED';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "impersonatedBy" UUID;

-- CreateIndex
CREATE INDEX "AuditLog_impersonatedBy_idx" ON "AuditLog"("impersonatedBy");
