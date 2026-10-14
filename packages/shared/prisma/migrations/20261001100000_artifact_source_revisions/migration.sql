-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "careRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "initialSummaryRevision" INTEGER,
ADD COLUMN     "wellnessCareRevision" INTEGER,
ADD COLUMN     "wellnessSummaryRevision" INTEGER;

-- Existing outputs deliberately keep NULL source revisions. They must be
-- regenerated, rather than claiming provenance that was never recorded.
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_valid_source_revisions"
  CHECK (
    "careRevision" >= 0
    AND ("initialSummaryRevision" IS NULL OR ("initialSummaryRevision" > 0 AND "initialSummaryRevision" <= "summaryRevision"))
    AND ("wellnessSummaryRevision" IS NULL OR ("wellnessSummaryRevision" > 0 AND "wellnessSummaryRevision" <= "summaryRevision"))
    AND ("wellnessCareRevision" IS NULL OR ("wellnessCareRevision" >= 0 AND "wellnessCareRevision" <= "careRevision"))
  );
