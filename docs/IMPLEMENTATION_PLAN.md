# DripWell v2 implementation plan

**Date:** 2026-10-01  
**Contract:** [PRD v2](../PRD.md)  
**Current state:** Existing Vite/Fastify/Prisma assessment app; v2 application migration/features have not been implemented.

## 1. Evidence and reuse decisions

| Foundation | Inspected evidence | Decision |
| --- | --- | --- |
| DripWell | Main at 9fa134fc9005dd0d5d351f14b35882d158dc1de4: instructions, memory, package.json, Prisma schema | Preserve instructions/personas/tasks/memory; audit/reuse tenant, catalog, safety, review, audit concepts; replace photo-first journey |
| OpenScribe | [Reference](https://github.com/loydhale/openscribe-scribe-template-/tree/dddf1c30fcf8313e4452915ddd9189baa5a3762b): README, audio recorder, upload controller | Reuse capture UX, ordered segment/retry and transcript-to-document patterns after license/API review; replace browser localStorage, local Whisper dependency, Electron shell |
| eve | [Structure](https://github.com/vercel/eve/blob/ac77188ad0bd16edd20a590ec93e2d26306b9bd0/docs/concepts/project-structure.mdx), [agent slots](https://github.com/vercel/eve/blob/ac77188ad0bd16edd20a590ec93e2d26306b9bd0/docs/reference/agent-files.md), [tenant memory](https://github.com/vercel/eve/blob/ac77188ad0bd16edd20a590ec93e2d26306b9bd0/docs/patterns/multi-tenant-memory.md) | One authored root agent beside application files initially; skills and typed tools implement domain procedures; trusted tenant/encounter scope |
| Vercel coding guidance | [vercel/vercel-plugin](https://github.com/vercel/vercel-plugin) README and Apache-2.0 license | Required development plugin; use relevant skills and deployment/performance/AI architecture guidance with the existing coding assistant; no hosted Vercel Agent requirement |
| SaaS shell | [nextjs/saas-starter](https://github.com/nextjs/saas-starter) README | Candidate dashboard/team/billing foundation; evaluate its minimal auth and Drizzle against existing Prisma; retain one authoritative ORM |
| Tenant routing | [vercel/platforms](https://github.com/vercel/platforms) README | Reference for hostname routing if needed; subdomains unnecessary for v1 isolation; Redis example is not the clinical record store |

OpenScribe explicitly says it is not HIPAA compliant yet; reuse patterns rather than adopting its deployment/storage defaults.

Official eve source was inspected at the pinned commit above. Shell package installation was unavailable because this workspace could not connect to its configured proxy; no installed-version compatibility was verified here. At implementation time pin dependencies and read node_modules/eve/docs/README.md, node_modules/ai/docs/, and node_modules/workflow/docs/ before coding.

The owner's separate ICM/eve example remains unconfirmed. Preserve the observed project conventions below; verify any additional ICM rules before scaffolding, without guessing what the acronym expands to.

### Required coding workflow

The owner confirmed the Vercel Plugin must be used for coding. Before V2 implementation, verify its guidance is available in the coding environment; use existing provided skills where present or the documented `npx plugins add vercel/vercel-plugin` installation for supported local assistants.

Record the plugin/source version and relevant loaded skills in each implementation task brief. Apply the eve, AI SDK, Workflow, bootstrap, auth/storage, deployment, performance, and verification guidance where relevant; confirm APIs in the installed-version documentation. Auditor checks this along with task behavior. Specialist deployment/performance/AI architecture guidance can support the existing team roles where available.

The downloadable plugin is development tooling, not a clinic feature or an application runtime dependency. Using it does not require purchasing the hosted Vercel Agent service; AI/model access and any provisioned infrastructure retain their normal costs.

## 2. Target ICM/eve folder structure

This is a proposed implementation layout, not existing runtime files.

```text
dripwell-ai/
  AGENTS.md                       # development entry point
  PRD.md
  personas/                       # CTO, coder, auditor guidance
  memory/                         # development state/learning only
  tasks/                          # small implementation briefs
  templates/                      # development templates
  workflows/                      # development procedures
  docs/
    IMPLEMENTATION_PLAN.md
    archive/PRD-v1.md
  apps/
    web/                          # Next.js PWA + role-specific dashboards
      package.json
      next.config.ts              # verified eve/next + Workflow integration
      app/
        (public)/                 # marketing, referrals, sign-in
        (clinic)/                 # consultation, board, settings
        (owner)/                  # review, reports, billing
        (platform)/               # restricted platform administration
        share/[shareId]/           # verified recipient access
        api/                      # authenticated routes, signed webhooks
      components/
      lib/                        # auth, tenant boundary, service adapters
      workflows/                  # application Workflow orchestration
        process-consultation.ts
        produce-wellness-plan.ts
        remind-outcome.ts
        process-subscription-event.ts
      agent/                      # authored eve root agent
        agent.ts
        instructions/
          product.md
          authority.md
          clinical-safety.md
          context-and-memory.md
        channels/eve.ts           # app session/role/tenant verification
        skills/
          clinic-setup/SKILL.md
          consultation-review/SKILL.md
          wellness-document/SKILL.md
          owner-improvement/SKILL.md
        tools/
          read-clinic-config.ts
          propose-clinic-change.ts
          extract-consultation-facts.ts
          evaluate-eligible-items.ts
          propose-wellness-plan.ts
          propose-owner-improvement.ts
        memory/
          clinic-context.ts       # read-only approved tenant/version context
        lib/                      # agent-only helpers
      evals/                      # synthetic eve cases beside agent/
      public/                     # PWA assets
    admin/                        # legacy during migration
    api/                          # legacy during migration
  packages/
    shared/
      prisma/                     # audited existing schema/migrations
    domain/                       # eligibility/transitions/entitlements
    data/                         # tenant-scoped repositories/transactions
    ui/                           # shared design components if useful
  package.json                    # pnpm workspace, Node 24 target
  pnpm-workspace.yaml
  vercel.ts                       # when supported by pinned tooling
```

### Folder/discovery and authority rules

- apps/web/ is the Next.js/eve application root; apps/web/agent/ is its authored single agent. Do not add a competing root agent/ or root agents/ directory.
- Choose instructions/ as the base prompt form; do not also author instructions.md. Evals sit beside agent/. Generated .eve/ is ignored by Git.
- Add only required slots. Later specialist agents belong under agent/subagents/<name>/ with their own capabilities; they do not inherit authored tools automatically.
- apps/web/workflows/ holds application Workflow code. Root workflows/ continues holding development procedures.
- Root memory/ contains no client data. Agent memory is a tenant-scoped provider reading immutable approved context; database records remain authoritative for policy, approvals, visits, and commercial ledgers.
- Bind tenant/encounter/version from authenticated server records, never model-supplied IDs. Context/memory retrieval must filter at the source.
- Owner-improvement routing, tool exposure, and tool execution all verify owner authority. Publishing is an explicit owner command, not an agent memory write.
- Disable runtime self-modification of clinical policies. A setup assistant proposes draft changes; approved version activation happens through authorized services.
- Keep old admin/API code until parity and migration verification; then retire it deliberately.

## 3. Infrastructure responsibilities

| Layer | Owns |
| --- | --- |
| Next.js PWA | Recording, chat/voice input, guidance, review, Kanban, owner/platform views |
| eve | Durable assistant conversations, instructions/skills, bounded typed tools and trusted caller context |
| AI SDK | Structured extraction/generation and streaming through verified adapters |
| Domain services | Eligibility, questions, pricing, output snapshots, transitions, authorization |
| PostgreSQL | Authoritative clinic/visit/config/approval/outcome state and trial/referral ledgers |
| Workflow | Crash-safe transcription, document processing, reminders, subscription/referral jobs |
| Private storage | Scoped artifacts, expiry, retention, deletion |
| Monitoring | Run IDs/costs/latency/sanitized failures, separately controlled sensitive traces |

Use Node/Fluid Compute for Vercel routes. Verify eve/next and Workflow composition against pinned versions. Do not wrap every eve turn in another orchestration layer; business events, not agent text, drive board milestones.

During foundation work discover and provision actual database, auth, private storage, platform subscription billing, transcription, and inference integrations. Use Vercel Marketplace/bootstrap where suitable. This documentation task does not provision resources or change deployment.

Map all health-data paths, including Workflow arguments/results, eve durable sessions, traces, artifacts, and backups. Prefer scoped record IDs in job inputs. Verify required contractual/configuration coverage before real client data.

## 4. Core records and invariants

| Record | Contract |
| --- | --- |
| Tenant/UserMembership | Verified location/owner/staff/provider authority and active membership |
| Catalog/Price/Membership/Service | Canonical IDs, ingredients/compatibility, stock, official prices in integer minor units/currency, terms and versions |
| ClinicConfigurationVersion | Immutable rule/question/catalog references, draft/active state, validation, activation/rollback actor/time |
| Consultation | Encounter, staff, consent, initiation, test flag, care outcome, archive metadata, concurrency token |
| RecordingSegment/TranscriptRevision | Ordered segments/times, processing/errors, evidence and correction/retention history |
| QuestionAnswer/SummaryRevision | Missing/negative/uncertain distinctions, provenance, confirmation/correction |
| RecommendationRevision/Approval/Adjustment | Original/revised items/explanation, evidence/rules/config/prompt/model versions, reasons and exact-revision approval |
| Treatment/CommercialOutcome | Actual care and items; optional confirmed membership/service purchase, distinct from accepted recommendation |
| WellnessPlanRevision/Decision | Approved priced output revision and accepted/rejected/TBD actor/time, with superseded history |
| ConsultationEvent/Notification | Milestones, actor, revision/run ID, deduplication and reminder reconciliation |
| ShareGrant/DocumentArtifact | Approved revision, hashed grant/token, recipient verification, expiry/revocation, private artifact/access log |
| ImprovementProposal/Review | Examples, classification, proposed diff, synthetic evaluation, owner/clinical validation |
| Trial/EntitlementReservation | Activation/expiry, 10-unit allowance, unique consultation reservation, atomic enforcement |
| Referral/Subscription/CreditLedger | Attribution, paid-event qualification, earned/applied/reversed entries, commercial policy version |
| GenerationRun/SupportAccess/AuditEvent | Tenant/run/status/cost and controlled sensitive support grants |

Archive retains audit/snapshots. Financial records contain clinic/account identifiers without client health details.

### Exact Kanban transition contract

1. InitiateConsultation persists consultation, applicable trial reservation, and CONSULTATION_STARTED in one transaction.
2. PersistInitialRecommendation saves a valid revision and INITIAL_RECOMMENDATIONS_GIVEN milestone.
3. PersistWellnessPlan saves a valid revision and WELLNESS_RECOMMENDATIONS_PRODUCED milestone.
4. RecordWellnessDecision requires a produced and approved revision plus an explicit staff command; stores ACCEPTED, REJECTED, or TBD.
5. ArchiveConsultation changes archive metadata without changing stage/decision; restore retains saved stage.

Use unique event/run/revision keys and optimistic concurrency. Retry/stale jobs cannot regress decisions. Generation failures do not advance. Edits invalidate approval; a material new approved wellness plan requires explicit reconsideration while preserving the earlier decision.

## 5. Implementation queue

Each row is a work package to split into small coder briefs. Legacy TASK-001 through TASK-018 remain historical. Use V2- task IDs. Writing this plan does not authorize unattended implementation in the current documentation task.

| Phase | Work packages / PRD coverage | Completion evidence |
| --- | --- | --- |
| 0. Decisions | V2-001 verify Vercel Plugin availability/source and ICM/pinned eve layout; V2-002 starter/ORM/auth comparison; V2-003 eligible service provisioning and PHI map | Verified discovery/versions, one schema strategy, synthetic-only environment |
| 1. Foundation | V2-004 PWA/SaaS shell; V2-005 tenant/role boundaries; V2-006 catalog/pricing/membership/config version migration (F-01/02/12) | Two isolated clinics across UI/API/database/agent; activation/rollback; prices persist |
| 2. Setup | V2-007 eve text/recorded-voice setup; V2-008 catalog images/gap questions; V2-009 editable settings/testing (F-01/02/09) | Owner tests multiple cases and activates; staff cannot publish |
| 3. Capture | V2-010 consent/recording/uploads; V2-011 durable transcription/summary; V2-012 visible questions/manual intake (F-03/04) | iPad/desktop interruption/retry handling; reviewed facts; missing-answer gating |
| 4. Initial care | V2-013 eligibility/local catalog matching; V2-014 adjustments/revision approval; V2-015 actual care/outcomes (F-05/06) | Safety gates, clear explanation, complete change history; care distinct from wellness |
| 5. Wellness/board | V2-016 plan/branded PDF; V2-017 secure sharing; V2-018 exact stages/decisions/archive; V2-019 reminders/animations (F-07/08/09) | Correct triggers/replay, private approved output, reminders cancel/reconcile |
| 6. Improvement | V2-020 owner adjustment/outcome views; V2-021 proposals/tests/activation/rollback; V2-022 platform reporting (F-10/12) | Authorized review, appropriate corrections recognized, immutable historical versions |
| 7. Growth | V2-023 trial entitlement; V2-024 attribution/paid conversion; V2-025 credit ledger/application/admin (F-11/12) | 14 days/10 units, concurrency/retry controls, one configured credit per qualifying event |
| 8. Pilot | V2-026 full synthetic story/evals; V2-027 device/accessibility/retention checks; V2-028 deployment/handoff (all) | PRD definition of done, measured targets, approved commercial/clinical configuration, suitable real-data route |

Implement the trial reservation guard before any external trial can start a consultation, regardless of when full commercial reporting is delivered. Internal phases use synthetic test accounts only.

### Migration

- Preserve v1 in docs/archive/PRD-v1.md; current code/runtime remains intact in this documentation change.
- Audit reusable tenant/catalog/safety/audit logic first. Existing catalog lacks a price column; add a migration and round-trip import/edit persistence rather than silently dropping prices.
- Keep one authoritative identity/schema/ORM. Adapt starter UI to the chosen model rather than leaving Prisma and Drizzle competing over clinical records.
- Add v2 contracts/tables without relabeling historical photo assessments as recorded consultations; preserve their meanings.
- Map old SUPER_USER/vendor roles explicitly to owner/staff/platform plus clinical approval authority.
- Preserve safety acknowledgments across regeneration rather than deleting/recreating flags.
- Migrate web/admin/API flows with verified parity, then retire obsolete photo-first code. Do not silently route production to unfinished v2.

## 6. Validation by business behavior

Use domain/integration tests for critical invariants and browser end-to-end flows, rather than implementation-mirroring tests.

- Tenant/role: cross-clinic access fails, staff cannot use owner-review/publish APIs/tools, anonymous eve access fails closed.
- Evidence/safety: unclear speech/OCR stays uncertain, required answers gate approval, injected transcript instructions cannot change rules, no mock-signal fallback.
- Review/versioning: draft survives edits, reasons persist, approval binds a revision and invalidates on edits, outputs retain config/price/model metadata.
- Board: all six triggers, manual decisions, TBD resolution, archive/restore, correction, regeneration and stale-job races.
- Outcomes: wellness acceptance implies neither care start nor membership sale; optional enrollments/payment remain distinct.
- Durability: replay cannot duplicate segments/documents/milestones/reminders/trial consumption/credits.
- Trial: 10 concurrent eligible starts succeed; an eleventh fails atomically; duplicate starts/retries count once; expiry blocks new starts; existing visits finish; simulations consume zero.
- Referral: one paid event yields one configured credit, self/duplicate attribution rejected, replay/refund/admin corrections retain ledger history.
- Sharing: unapproved/expired/revoked access fails, recipient check is required, internal notes remain private, service worker does not cache PHI.
- Devices: iPad microphone gesture/permissions/interruption, visible upload failure, installability, accessible board/PDF, reduced-motion celebrations.
- Owner loop: appropriate correction leads to reviewed/tested configuration, staff conversations cannot alter active rules.
- Operations: sanitized costs/failures, exceptional audited support, retention/deletion covers durable stores and backups.

## 7. Next resume point

Start with V2-001 through V2-003 after the documentation task: verify the exact ICM example if available, compatible versions, starter/ORM strategy, and integration readiness.

Before external trials, define activation/count/refund and credit value/qualification terms. Before real-client use, validate clinical configuration, consent/retention, service agreements, and recipient verification.

The PRD records authorized product direction. This plan does not invent commercial terms, clinical protocols, deployed infrastructure, or a verified HIPAA status.
