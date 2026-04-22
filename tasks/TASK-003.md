# TASK-003 — Design database schema (multi-tenant, anonymous patients, catalogs)

```
TASK_ID: TASK-003
TITLE: Design database schema
PARENT_REQUEST: PRD requires multi-tenant PostgreSQL schema with anonymous patients, catalogs, assessments, and clinical patterns.

GOAL (one sentence):
Design and implement the complete Prisma schema for DripWell.ai covering tenants, users, anonymous patients, catalogs, assessments, signals, patterns, and recommendations.

SCOPE:
In scope:
- Design full Prisma schema in packages/shared/prisma/schema.prisma
- Multi-tenant tables: Tenant, Location (a tenant can have multiple clinic locations)
- User tables: SuperUser, Provider (role-based, no patient accounts)
- Anonymous patient model: AssessmentSession (anonymous ID + timestamp, no PII)
- Catalog tables: CatalogItem, Ingredient, AddOn, Injection, Peptide (with relationships)
- Assessment tables: PhotoCapture, VisualSignal, QuestionAnswer, PatternMatch
- Recommendation tables: Recommendation, SafetyFlag, ProviderOverride
- Clinical pattern library: ClinicalPattern, SignalTaxonomy, QuestionBank
- Audit/log tables: AuditLog, AssessmentHistory
- All relationships, indexes, and constraints
- Prisma seed script with minimal test data
- Initial migration generated

Out of scope (do NOT do these even if tempting):
- Do NOT build API routes or resolvers (that's TASK-004)
- Do NOT add business logic or validation (schema only)
- Do NOT configure production database connection
- Do NOT add full-text search indexes (defer until needed)
- Do NOT optimize for read replicas or sharding

FILES LIKELY INVOLVED:
- packages/shared/prisma/schema.prisma — the full schema (rewrite from current minimal version)
- packages/shared/prisma/seed.ts — seed script for development
- packages/shared/prisma/migrations/ — migration files (auto-generated)
- packages/shared/src/types/index.ts — update with schema-derived types
- packages/shared/src/db/client.ts — Prisma client singleton (if not existing)

RELEVANT MEMORY ENTRIES:
- PRD F-1: Conversational clinic onboarding and catalog ingestion
- PRD F-2: Anonymous patient model (no PII)
- PRD F-3: Photo capture with direct upload
- PRD F-4: Vision AI signal extraction
- PRD F-5: Adaptive questioning
- PRD F-6: Clinical pattern library and recommendation engine
- PRD F-7: Three-tier safety flag system
- PRD F-8: Provider approval gate
- PRD F-10: Longitudinal assessment history
- PRD F-11: Super user admin panel
- LESSONS: L-001, L-002, L-003

ACCEPTANCE CRITERIA (Auditor will check these):
- [ ] Schema compiles with prisma validate (no errors)
- [ ] prisma migrate dev generates clean migration
- [ ] prisma db seed runs successfully with test data
- [ ] All tables from PRD features are present
- [ ] Multi-tenancy: every patient-facing table has tenantId foreign key
- [ ] Anonymous model: no name, email, phone, DOB, or SSN fields anywhere
- [ ] Catalog supports: drips, add-ons, injections, peptides with ingredients
- [ ] Assessment flow: PhotoCapture → VisualSignal → QuestionAnswer → PatternMatch → Recommendation
- [ ] Safety flags: tier enum (T1_INFO, T2_FOLLOWUP, T3_URGENT)
- [ ] Provider override captured with reason codes
- [ ] Indexes on: tenantId, assessmentSessionId, createdAt (for queries)
- [ ] Cascade delete rules set correctly (assessment data deletes with session, not tenant)

NOTES / HINTS:
- Use Prisma's @db.Uuid for IDs (better than auto-increment for distributed systems)
- Use enums for: UserRole, ItemType, FlagTier, QuestionCategory, SignalName
- Tenant isolation is CRITICAL — every query must include tenantId filter
- Photos: store only metadata (url, angle, capturedAt) in DB; actual images in S3
- For anonymous model: AssessmentSession.id is the only identifier. No foreign keys to any identifiable person.
- Catalog items need "active/inactive" toggle (super user can disable without deleting)
- ClinicalPattern table is universal (cross-tenant), but PatternMatch is per-tenant
- Keep the schema normalized but pragmatic — don't over-engineer v1
- Consider using Prisma's Json type for flexible signal confidence scores
- The schema at packages/shared/prisma/schema.prisma currently exists but is minimal — rewrite it completely
```
