BEGIN;

-- Non-AI ownership survives failed adoption and source-owner cascade deletion.
CREATE TABLE "SetupRecordingUpload" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "setupConversationId" UUID NOT NULL,
  "blobPath" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'IN_FLIGHT',
  "uploadSettled" BOOLEAN NOT NULL DEFAULT false,
  "blobObject" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SetupRecordingUpload_capture" CHECK (
    "blobPath" = 'private/' || "tenantId"::text || '/setup/' || "id"::text
    AND "purpose" IN ('VOICE', 'CATALOG') AND length("mimeType") BETWEEN 1 AND 200
    AND "bytes" > 0 AND "bytes" <= 3500000 AND "expiresAt" > "consentAt"
  ),
  CONSTRAINT "SetupRecordingUpload_settlement" CHECK (
    "state" IN ('IN_FLIGHT', 'ADOPTED', 'CLEANUP_PENDING', 'CLEANED')
    AND "uploadSettled" = ("blobObject" IS NOT NULL)
    AND ("state" NOT IN ('ADOPTED', 'CLEANED') OR "uploadSettled")
    AND ("blobObject" IS NULL OR COALESCE((
      jsonb_typeof("blobObject") = 'object'
      AND "blobObject" ?& ARRAY['version','tenantId','recordingId','consultationId','setupConversationId','uploadAttemptId','blobPath','objectUrl','storeId','etag','nonOverwrite']
      AND "blobObject" - ARRAY['version','tenantId','recordingId','consultationId','setupConversationId','uploadAttemptId','blobPath','objectUrl','storeId','etag','nonOverwrite'] = '{}'::jsonb
      AND "blobObject"->'version' = '1'::jsonb AND "blobObject"->'nonOverwrite' = 'true'::jsonb
      AND "blobObject"->>'tenantId' = "tenantId"::text AND "blobObject"->>'recordingId' = "id"::text
      AND "blobObject"->>'setupConversationId' = "setupConversationId"::text
      AND "blobObject"->'consultationId' = 'null'::jsonb AND "blobObject"->'uploadAttemptId' = 'null'::jsonb
      AND "blobObject"->>'blobPath' = "blobPath"
      AND jsonb_typeof("blobObject"->'storeId') = 'string' AND "blobObject"->>'storeId' ~ '^[a-z0-9][a-z0-9-]{0,127}$'
      AND "blobObject"->>'objectUrl' = 'https://' || ("blobObject"->>'storeId') || '.private.blob.vercel-storage.com/' || "blobPath"
      AND jsonb_typeof("blobObject"->'etag') = 'string'
      AND length("blobObject"->>'etag') BETWEEN 1 AND 1024 AND "blobObject"->>'etag' !~ E'[\r\n]'
    ), false))
  )
);
CREATE UNIQUE INDEX "SetupRecordingUpload_tenantId_blobPath_key" ON "SetupRecordingUpload" ("tenantId", "blobPath");
CREATE INDEX "SetupRecordingUpload_state_createdAt_id_idx" ON "SetupRecordingUpload" ("state", "createdAt", "id");
CREATE FUNCTION "setup_recording_upload_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."id",NEW."tenantId",NEW."userId",NEW."locationId",NEW."setupConversationId",NEW."blobPath",NEW."purpose",NEW."mimeType",NEW."bytes",NEW."consentAt",NEW."expiresAt",NEW."createdAt")
    IS DISTINCT FROM ROW(OLD."id",OLD."tenantId",OLD."userId",OLD."locationId",OLD."setupConversationId",OLD."blobPath",OLD."purpose",OLD."mimeType",OLD."bytes",OLD."consentAt",OLD."expiresAt",OLD."createdAt")
    OR (OLD."blobObject" IS NOT NULL AND NEW."blobObject" IS DISTINCT FROM OLD."blobObject")
    OR (OLD."uploadSettled" AND NOT NEW."uploadSettled") THEN
    RAISE EXCEPTION 'Setup upload ownership and settled object are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SetupRecordingUpload_immutable" BEFORE UPDATE ON "SetupRecordingUpload"
  FOR EACH ROW EXECUTE FUNCTION "setup_recording_upload_immutable"();

COMMIT;
