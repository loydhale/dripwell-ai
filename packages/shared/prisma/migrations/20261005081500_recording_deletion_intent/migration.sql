BEGIN;

ALTER TABLE "RecordingSegment" ADD COLUMN "blobObject" JSONB;

-- No source-owner foreign keys: a committed object must remain addressable
-- after its tenant, recording or upload job is removed.
CREATE TABLE "RecordingDeletionIntent" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "recordingId" UUID NOT NULL,
  "consultationId" UUID,
  "setupConversationId" UUID,
  "uploadAttemptId" UUID,
  "reason" TEXT NOT NULL,
  "blobPath" TEXT NOT NULL,
  "objectUrl" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "etag" TEXT NOT NULL,
  "creatorScope" TEXT NOT NULL,
  "creatorGeneration" BIGINT NOT NULL,
  "creatorOrdinal" BIGINT NOT NULL,
  "creatorRunId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "executionScope" TEXT,
  "executionGeneration" BIGINT,
  "executionOrdinal" BIGINT,
  "executionRunId" TEXT,
  "executionToken" UUID,
  "leaseUntil" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "lastDurationMs" INTEGER,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecordingDeletionIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecordingDeletionIntent_target" CHECK (
    ("consultationId" IS NOT NULL AND "setupConversationId" IS NULL AND "uploadAttemptId" IS NOT NULL)
    OR ("consultationId" IS NULL AND "setupConversationId" IS NOT NULL AND "uploadAttemptId" IS NULL)
  ),
  CONSTRAINT "RecordingDeletionIntent_identity" CHECK (
    "reason" IN ('UPLOAD_CLEANUP', 'RETENTION')
    AND "blobPath" = CASE WHEN "consultationId" IS NOT NULL
      THEN 'private/' || "tenantId"::text || '/recordings/' || "consultationId"::text || '/' || "recordingId"::text || '/' || "uploadAttemptId"::text
      ELSE 'private/' || "tenantId"::text || '/setup/' || "recordingId"::text END
    AND "storeId" ~ '^[a-z0-9][a-z0-9-]{0,127}$'
    AND "objectUrl" = 'https://' || "storeId" || '.private.blob.vercel-storage.com/' || "blobPath"
    AND length("etag") BETWEEN 1 AND 1024 AND "etag" !~ E'[\r\n]'
    AND length("creatorScope") BETWEEN 1 AND 200
    AND length("creatorRunId") BETWEEN 1 AND 200
    AND "creatorGeneration" > 0 AND "creatorOrdinal" >= 0
  ),
  CONSTRAINT "RecordingDeletionIntent_state" CHECK (
    "status" IN ('PENDING', 'IN_FLIGHT', 'DELETED')
    AND num_nonnulls("executionScope", "executionGeneration", "executionOrdinal", "executionRunId", "executionToken", "leaseUntil") IN (0, 6)
    AND ("status" = 'IN_FLIGHT') = ("executionToken" IS NOT NULL)
    AND ("status" = 'DELETED') = ("deletedAt" IS NOT NULL)
    AND ("executionGeneration" IS NULL OR "executionGeneration" > 0)
    AND ("executionOrdinal" IS NULL OR "executionOrdinal" >= 0)
    AND "attempts" >= 0
    AND ("lastDurationMs" IS NULL OR "lastDurationMs" >= 0)
    AND ("lastError" IS NULL OR "lastError" IN ('DELETE_FAILED', 'DELETE_TIMEOUT', 'OBJECT_CHANGED', 'UPLOAD_UNSETTLED'))
  )
);
CREATE UNIQUE INDEX "RecordingDeletionIntent_tenantId_blobPath_key" ON "RecordingDeletionIntent" ("tenantId", "blobPath");
CREATE INDEX "RecordingDeletionIntent_status_createdAt_id_idx" ON "RecordingDeletionIntent" ("status", "createdAt", "id");

CREATE FUNCTION "recording_deletion_identity_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."id", NEW."tenantId", NEW."recordingId", NEW."consultationId", NEW."setupConversationId", NEW."uploadAttemptId", NEW."reason", NEW."blobPath", NEW."objectUrl", NEW."storeId", NEW."etag", NEW."creatorScope", NEW."creatorGeneration", NEW."creatorOrdinal", NEW."creatorRunId", NEW."createdAt")
     IS DISTINCT FROM ROW(OLD."id", OLD."tenantId", OLD."recordingId", OLD."consultationId", OLD."setupConversationId", OLD."uploadAttemptId", OLD."reason", OLD."blobPath", OLD."objectUrl", OLD."storeId", OLD."etag", OLD."creatorScope", OLD."creatorGeneration", OLD."creatorOrdinal", OLD."creatorRunId", OLD."createdAt") THEN
    RAISE EXCEPTION 'Recording deletion identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "RecordingDeletionIntent_immutable"
  BEFORE UPDATE ON "RecordingDeletionIntent"
  FOR EACH ROW EXECUTE FUNCTION "recording_deletion_identity_immutable"();

COMMIT;
