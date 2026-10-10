BEGIN;

CREATE TABLE "MaintenanceCoordinator" (
    "key" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "deploymentId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'DISABLED',
    "phase" TEXT NOT NULL DEFAULT 'IDLE',
    "generation" BIGINT NOT NULL DEFAULT 0,
    "ordinal" BIGINT NOT NULL DEFAULT 0,
    "claimToken" UUID,
    "ownerRunId" TEXT,
    "dispatchedRunId" TEXT,
    "dispatchAttemptedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "anchorAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "cadenceMs" INTEGER NOT NULL DEFAULT 900000,
    "cursors" JSONB NOT NULL DEFAULT '{}',
    "progress" JSONB NOT NULL DEFAULT '{}',
    "continuation" JSONB,
    "lastCompletedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "skippedSlots" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaintenanceCoordinator_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "MaintenanceCoordinator_values" CHECK (
      "environment" IN ('production', 'preview', 'development') AND
      "mode" IN ('DISABLED', 'MANUAL', 'SCHEDULED') AND
      "phase" IN ('IDLE', 'PENDING_START', 'RUNNING', 'WAITING', 'COMPLETED') AND
      "generation" >= 0 AND "ordinal" >= 0 AND "skippedSlots" >= 0 AND
      "cadenceMs" BETWEEN 1000 AND 900000 AND
      "enabled" = ("mode" = 'SCHEDULED') AND
      jsonb_typeof("cursors") = 'object' AND jsonb_typeof("progress") = 'object'
    )
);

-- Static partial predicates plus immutable-key ordering bound selected pages.
CREATE INDEX "Consultation_maintenance_id_idx" ON "Consultation"("id") WHERE "isTest" = false;
CREATE INDEX "Notification_maintenance_stale_idx" ON "Notification"("consultationId", "type", "id") WHERE "dismissedAt" IS NULL;
CREATE INDEX "RecordingSegment_maintenance_upload_idx" ON "RecordingSegment"("id", "updatedAt") WHERE "status" = 'UPLOADING';
CREATE INDEX "GenerationJob_maintenance_queue_idx" ON "GenerationJob"("id", "updatedAt") WHERE "status" = 'QUEUING' AND "runId" IS NULL;
CREATE INDEX "AuthChallenge_maintenance_page_idx" ON "AuthChallenge"("id", "expiresAt");
CREATE INDEX "AuthSession_maintenance_page_idx" ON "AuthSession"("id", "expiresAt");
CREATE INDEX "RateLimitBucket_maintenance_page_idx" ON "RateLimitBucket"("key", "windowStart");

COMMIT;
