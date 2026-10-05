BEGIN;
ALTER TABLE "RecordingDeletionIntent"
  ADD COLUMN "sourceKind" TEXT,
  ADD COLUMN "sourceId" UUID,
  ADD COLUMN "sourceCreatedAt" TIMESTAMP(3),
  ADD CONSTRAINT "RecordingDeletionIntent_provenance" CHECK (
    num_nonnulls("sourceKind", "sourceId", "sourceCreatedAt") = 0 OR
    (num_nonnulls("sourceKind", "sourceId", "sourceCreatedAt") = 3 AND (
      ("reason" = 'RETENTION' AND "sourceKind" = 'RECORDING' AND "sourceId" = "recordingId") OR
      ("reason" = 'UPLOAD_CLEANUP' AND "sourceKind" = 'UPLOAD_ATTEMPT' AND "uploadAttemptId" IS NOT NULL AND "sourceId" = "uploadAttemptId") OR
      ("reason" = 'UPLOAD_CLEANUP' AND "sourceKind" = 'SETUP_UPLOAD' AND "sourceId" = "recordingId" AND "setupConversationId" IS NOT NULL)
    ))
  );
CREATE UNIQUE INDEX "RecordingDeletionIntent_source_key"
 ON "RecordingDeletionIntent" ("reason", "sourceKind", "sourceId");
CREATE INDEX "RecordingDeletionIntent_source_page_idx"
 ON "RecordingDeletionIntent" ("reason", "sourceKind", "sourceCreatedAt", "sourceId", "id");
-- Separate trigger retains the original identity trigger and forbids guessed
-- legacy backfill as well as alteration of an already committed source tuple.
CREATE FUNCTION "recording_cleanup_provenance_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."sourceKind", NEW."sourceId", NEW."sourceCreatedAt") IS DISTINCT FROM
    ROW(OLD."sourceKind", OLD."sourceId", OLD."sourceCreatedAt") THEN
   RAISE EXCEPTION 'Recording cleanup provenance is immutable' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "RecordingDeletionIntent_provenance_immutable"
 BEFORE UPDATE ON "RecordingDeletionIntent" FOR EACH ROW
 EXECUTE FUNCTION "recording_cleanup_provenance_immutable"();
COMMIT;
