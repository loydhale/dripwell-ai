# DripWell v2 implementation audit

Date: 2026-10-01. Branch: `feat/dripwell-consultation-v2`.

## Foundation review, attempt 1

AUDIT: V2-FOUNDATION
VERDICT: FAIL
ATTEMPT: 1

Scope: shared v2 contracts, deterministic engine, lifecycle, Prisma schema/migrations, Next.js configuration, authentication/session/MFA, mutation origin checks, PWA caching, and CI. Feature workflows remain under implementation and have no overall verdict yet.

FINDINGS:

- `packages/shared/src/v2/engine.ts:113`: Conditional safety questions evaluate activation predicates without validating the referenced answer against its configured question type. An optional NUMBER gate with an incompatible `EQ true` predicate and a confirmed boolean `false` hides its required safety follow-up. Activation reports no errors, the gate shows needs confirmation, and initial generation returns an unblocked IV with no unresolved questions. Severity: blocking.
- `packages/shared/src/v2/engine.ts:428`: Clinical wellness services use product eligibility without checking unresolved required safety questions. A clinical SERVICE with a confirmed clearance predicate and an unanswered separate required safety screen produces an offer with no safety flags; `validateWellnessSelection` also accepts it. Severity: blocking.

REQUIRED_FIXES:

- Validate rule operator/value semantics against referenced question types/options during configuration activation. Treat invalid typed answers as unknown for conditional follow-ups and preserve the required screen.
- Apply required safety/suitability screening to clinical wellness offers during generation and explicit selection validation. Add regression cases for both paths.

Verification already completed independently:

- Shared domain suite: 12/12 passing.
- Web auth suite: 5/5 passing, including actual PostgreSQL 17 session role rereads, tenant deactivation, revocation, TOTP replay prevention, and concurrent recovery-code consumption.
- Empty question banks and empty clinical eligibility policies fail activation and initial approval. Staff cannot change authoritative catalog prices or inject excluded initial options.
- Session tokens are random, hashed at rest, expiring and revocable. Current role, provider authority, active tenant and location are reread from the database.
- MFA secrets use AES-256-GCM with identity-bound associated data and an independent encryption key. Recovery codes are hashed and consumed under database row locks.
- Mutations validate origin and fetch-site; API responses use private/no-store headers. The service worker caches only four explicit public icon/manifest URLs and clears previous caches.
- PostgreSQL tenant-scoped composite foreign keys and a partial unique active-configuration index support isolation. Existing enum additions precede the migration that uses their new values.

PATTERN_VIOLATIONS: none in reviewed foundation.
GOTCHA_HITS: no v1 mock fallback copied; authoritative price round-tripping is explicitly represented in v2 snapshots.
PRD_AUDIT: implementation findings against F-02, F-04 and F-07; no unauthorized PRD scope change identified.

Plugin guidance reviewed: available Vercel Plugin skills auth, Next.js, storage and bootstrap from `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`. Installed Next.js 16.3.8 documentation confirms async cookie APIs and dynamic rendering for request-bound authenticated routes. Test commands used installed tsx binaries because the environment's bare pnpm command is an auto-install shim.

Production verification remains pending: Vercel project access, service credentials, deployment and applicable clinical/privacy agreements have not been established. Isolated synthetic PostgreSQL verification does not establish production readiness.

## Foundation review, attempt 2

AUDIT: V2-FOUNDATION
VERDICT: PASS
ATTEMPT: 2

Both blocking findings from attempt 1 are resolved:

- Configuration activation validates operators and literals against the declared question type and choice options. Runtime conditional evaluation also validates typed, confirmed answers; unknown values keep required follow-ups visible. Regression cases cover numeric, choice and multi-choice inputs, invalid rule definitions, and mixed unknown/nonmatching conditions.
- Clinical product eligibility now checks unresolved required safety/suitability questions. Both generated wellness matching and manually selected offer validation use this eligibility check. Clinical offers are withheld while permitted nonclinical offers retain their separate suitability checks.

Additional review: the additive artifact-source migration introduces care, initial-summary and wellness-source revisions with bounded integrity constraints. Existing source revisions remain NULL and require regeneration, preserving truthful provenance. Enforcement by feature approval/share workflows will be assessed in the combined review.

Independent verification:

- Shared domain/regression suite: 18/18 passing.
- Shared TypeScript check: passing.
- Web authentication suite: 5/5 passing, including actual PostgreSQL checks.
- Prisma migration status: 9 migrations applied, isolated PostgreSQL schema up to date.

FINDINGS: none blocking in this scope.
PATTERN_VIOLATIONS: none.
PRD_AUDIT: pass for the reviewed foundation.

This verdict applies to the foundation only. Combined feature, browser and production verification remain outstanding.

### Subsequent runtime finding

The CTO's actual Next.js startup/browser check discovered a blocking foundation runtime issue after the scoped source re-review: root `app/` coexists with legacy `src/pages/`, and Next.js exits with “`pages` and `app` directories should be under the same folder.” Preserve the legacy source outside Next.js route discovery, rerun build/start and browser checks, then reassess the combined runtime gate. Domain/authentication source checks remain PASS; application runtime is not PASS while this blocker is open.

## Combined implementation review, attempt 1

AUDIT: V2-COMBINED
VERDICT: FAIL
ATTEMPT: 1

The legacy route discovery conflict was resolved by preserving the v1 web source outside Next.js. The CTO verified actual local startup and the home page in a browser. This review covers clinic persistence, approval/input provenance, trials, reminders, owner controls, AI/Eve scoping, sharing/PDF, billing/referrals and platform reporting. Final UI walkthrough and optimized production build remain under verification.

FINDINGS:

- `apps/web/lib/recordings.ts:139`: New audio is persisted without immediately invalidating previously approved clinical/wellness artifacts. Before transcript processing applies the new evidence, `consultation.care.record` and takeaway/share access only compare the old unchanged revisions. Pending-evidence guards on approval alone do not close the interval. Severity: blocking.
- `apps/web/lib/billing.ts:377`: Entitlement updates are gated on `invoice.amount_paid > 0`. A settled subscription invoice funded entirely by referral account credit can leave an active subscriber in TRIAL because subscription-active events preserve existing entitlement. Separate active paid-invoice entitlement from positive-payment referral qualification. Severity: blocking.
- `apps/web/components/consultation.tsx:157`: Resumed recording allocates sequence numbers from processed transcript rows only. Persisted pending/failed recordings can occupy the next number, causing conflicts after reconnect. Allocate from all saved recordings. Severity: blocking.
- `apps/web/components/consultation.tsx:173`: The visible retry reuploads an existing recording whose FAILED job is returned unchanged. `startRecordingJob` only claims PENDING jobs, so retries cannot recover processing. The dedicated retry endpoint is not wired into the UI, and durable failed jobs disappear after page reload. Load recording/job state and invoke the saved-recording retry endpoint. Severity: blocking.
- `apps/web/components/consultation.tsx:44`: Saved transcript text is displayed read-only despite a tracked backend correction route. Expose corrections with reason and expected version so staff can correct the transcript as required. Severity: blocking.
- `apps/web/app/api/setup/route.ts:68`: Setup conversations have no selected-location binding, while the agent uses the authenticated user's first active location. The owner can edit a second location while the assistant recalls first-location settings and conversation. Bind the selected validated location through conversation, agent identity/context and UI requests. Severity: blocking for location correctness.
- `apps/web/lib/clinic.ts:363`: Dashboard referral balance sums positive EARNED, APPLIED, REVERSED and EXPIRED ledger amounts. Reuse kind-aware balances to avoid overstating available credit. Severity: blocking for reporting accuracy.
- `.env.example`: `ALLOW_REAL_CLIENT_DATA=false` is described as disabling processing, but application code does not use it. Enforce the intended gate or correct the claim; do not assert that this variable prevents real-client processing. Severity: blocking for release claims.

Independent checks on the reviewed source all passed:

- Shared domain/money suite: 23/23.
- Web node checks: 17/17, comprising clinic 9, authentication 5 and restricted administrator bootstrap 3. Clinic/auth checks used actual isolated PostgreSQL 17.
- Billing/sharing integration suites: 13/13 with actual isolated PostgreSQL; Stripe network transport is mocked, so live Stripe integration remains unverified.
- AI extraction/upload evaluations: 4/4. No live model inference or transcription was invoked.

Verified source controls include tenant-scoped queries, current authority rereads inside clinic transactions, exact output/input revision guards, immutable configuration versions, provider authorization, audited corrections, unique trial consumption and concurrent ten-start cap, archive preserving outcomes, owner-only improvements, private Blob access, consent checks, read-only approved agent memory, `defaultTools: false`, owner/session continuation binding, OTP attempt limits and revocable recipient sessions. Platform queries select operational aggregates and exclude raw clinical records. These findings still prevent a combined PASS.

Plugin/framework guidance additionally reviewed: Eve 0.69 bundled docs for channel authorization/deployment and private audiences; Workflow 5 documentation for durable steps and ID-only orchestration; AI SDK 7 shipped patterns; Vercel Plugin payments and complete-story verification. Credentials, project linkage and live production services remain unavailable, and production readiness is not asserted.

## Combined implementation review, attempt 2

AUDIT: V2-COMBINED
VERDICT: PASS
ATTEMPT: 2

This is a combined source and local runtime verdict. Production launch and live service verification remain outstanding.

All eight findings from attempt 1 are resolved in the reviewed source. New audio intake invalidates approvals, takeaway links and recipient sessions before the private upload. Pending evidence also blocks care-start, document issuance and recipient reads. Retry/discard retain an explicit review requirement. Recording UI now loads persisted segment states and sequences, invokes the saved-audio retry route, and exposes audited transcript corrections. Setup conversations persist the selected validated location and bind it to tenant, owner and Eve session. Referral balances use linked ledger semantics per currency. Settled credit-funded invoices grant subscription access independently from positive-payment referral eligibility. The real-client flag gates starts, clinical changes, recording intake and processing while allowing explicitly synthetic tests.

Independent verification:

- Full pinned-pnpm test command: 71/71 passing, zero skipped. Shared 23, authentication/bootstrap 8, clinic 13, AI/scope 7, billing/sharing/credits 20.
- After the final fixes, the CTO's canonical full rerun passed 75/75, zero skipped: shared 23, authentication/bootstrap 8, clinic 13, AI/scope/upload lifecycle 11, billing/sharing/credits 20. The Auditor separately reran the four added upload regressions and eight sharing/PDF checks successfully.
- Database-backed checks ran against isolated PostgreSQL 17. External Stripe transport is fixture-controlled, and no live model, Blob or email delivery is claimed.
- All 10 migrations applied and schema up to date, including the additive location binding. Historical unbound setup conversations deliberately remain unavailable.
- Deployment prerequisites command correctly reports an unlinked project and missing environment bindings. It returns failure rather than readiness.

Additional release blockers discovered and resolved during this re-review:

- Upload/discard could orphan a private object after clearing its cleanup pointer. The fix gives each attempt a unique pathname and a durable upload job pointer, adopts that pointer in the recording transaction, and compensates rejected completion. Cleanup rechecks the recording and attempt under matching row locks before claiming deletion. Failed deletion and unknown remote completion retain an addressable pointer for cron; cleanup cannot overwrite committed adoption or delete a newer attempt's object. Four independent actual PostgreSQL regressions pass, including deferred upload/discard, deletion outage recovery, late unknown upload and an observed cleanup/adoption lock wait. Storage transport in these checks is controlled; live Blob execution remains unverified.
- CTO browser evidence caught an approved PDF HTTP 500 caused by virtualized font module resolution in Next. The fix uses physical installed font paths and retains both API families' output tracing includes. Eight independent sharing/PDF checks pass after the fix. The CTO verified actual authenticated dev-server and optimized production-mode downloads with PDF bytes and private/no-store headers. The Auditor independently inspected both generated API NFT traces, which include regular and bold Geist fonts with 40 TTF entries each.

The CTO's optimized Next.js 16.3.8 build passed, including its TypeScript check and 31 static routes. Production-mode `next start` served the authenticated dashboard without an error overlay or console errors and returned the approved PDF as HTTP 200, `application/pdf`, 16,163 bytes, `%PDF-1.7`, private/no-store. The fictional browser journey also verified registration/trial, MFA, configuration entry/test/activation, guided intake, audited edits, initial/provider approval, separate actual care and wellness acceptance, archive/restore, owner improvement evidence and mobile layout. See [verification evidence](VERIFICATION_REPORT.md) for the recorded limits.

The CTO also reran the separate canonical `build:eve` entrypoint successfully with the installed Eve 0.69.0 compiler. Its server bundle built in 2,443 ms with 9.53 MB output, 2.21 MB gzip. This verifies the authored agent build and CI entrypoint, not live inference or deployed Sandbox execution.

FINDINGS: none blocking remain in the reviewed source/local runtime scope.
PATTERN_VIOLATIONS: none unresolved.
GOTCHA_HITS: G-005 pinned pnpm invocation, G-006 physical font paths and real framework verification.
PRD_AUDIT: pass. Minor updates record the implemented runtime and already-authorized scope, explicit trial activation default, recipient verification and live verification limits. No new commercial terms or product feature was introduced.

Deployment guidance also reviewed through the Vercel Plugin deployments-cicd and React best-practices skills. The CI uses frozen dependencies, Node 24, PostgreSQL 17, distinct authentication/domain/feature checks and actual Next/Eve builds; legacy Vite source remains outside Next route discovery. Root ICM context/persona/memory conventions and authored Eve folders are preserved.

Remaining external release gates: link the intended Vercel team/project, provision and verify actual database/private Blob/Gateway/Workflow/Eve/Stripe/Resend bindings, run migrations against that environment, complete deployed synthetic integration checks, and review required real-client service/data controls before enabling `ALLOW_REAL_CLIENT_DATA`. Referral commercial terms must be explicitly configured before promising credits. No live transcription, setup inference, email delivery, checkout, deployed durable workflow or clinical pilot is claimed by this PASS.
