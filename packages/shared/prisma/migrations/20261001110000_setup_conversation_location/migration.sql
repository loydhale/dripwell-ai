-- Existing conversations remain unbound (NULL). A validated location must be
-- supplied for a new session; never infer the first location for old sessions.
-- AlterTable
ALTER TABLE "SetupConversation" ADD COLUMN     "locationId" UUID;

-- CreateIndex
CREATE INDEX "SetupConversation_tenantId_userId_locationId_updatedAt_idx" ON "SetupConversation"("tenantId", "userId", "locationId", "updatedAt");

-- AddForeignKey
ALTER TABLE "SetupConversation" ADD CONSTRAINT "SetupConversation_locationId_tenantId_fkey" FOREIGN KEY ("locationId", "tenantId") REFERENCES "Location"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
