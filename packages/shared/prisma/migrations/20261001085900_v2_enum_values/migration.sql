-- PostgreSQL must commit enum additions before a later migration can use them
-- as a column default. Keep these additions separate from V2 table creation.
ALTER TYPE "UserRole" ADD VALUE 'STAFF';
ALTER TYPE "NotificationType" ADD VALUE 'CARE_OUTCOME_NEEDED';
ALTER TYPE "NotificationType" ADD VALUE 'WELLNESS_DECISION_NEEDED';
