# Continuous source repairs

Date: 2026-10-02. Branch: `feat/dripwell-consultation-v2`.

## TASK-020, retained archive search and restore

AUDIT: TASK-020
VERDICT: PASS
ATTEMPT: 1
BASE PARENT: `d88de29b16d13e8eb4e1ed50b5d5e75310ebb3a5`

The five-file app/test patch addresses the reproduced F-08 gap without migrations or provider changes. Server queries validate the search, archive flag, UUID cursor and page size, use the current verified tenant and selected active location, and return at most 50 records by default or 100 when explicitly requested. Immutable creation time plus UUID provides deterministic keyset ordering across equal timestamps. Cursor anchors must belong to the same tenant, location, archive and search/date filters. Search escapes literal SQL wildcard characters and matches visit references or staff-name words. Archive browsing includes all retained ages; report denominators still use the selected date period and include archived visits.

The browser sends debounced search to the server, starts a new bounded page when filters change, deduplicates appended pages and rejects stale request responses. Pagination errors preserve existing cards and expose retry. Stage and archive/restore mutations retain their existing authority, audit history and reminder reconciliation.

Independent evidence:

- Both new regressions passed against the explicitly selected isolated PostgreSQL database, 2/2 with zero skips. They walk all 251 retained rows through bounded pages with equal creation timestamps, find the 500-day-old target, preserve the report denominator, search staff names, restore with the expected actor/stage event, and reject foreign-tenant, foreign-location, unknown, mismatched-search and malformed cursors. Invalid sizes/search and report periods fail appropriately. The Coder additionally reported the full clinic suite 15/15, web types and optimized Next build PASS; those broader checks were not repeated without a new concern.
- The actual optimized Next.js 16.3.8 artifact started separately on localhost:4175, with the guarded localhost:55432 `dripwell_verification` database, trusted local APP_URL and `ALLOW_REAL_CLIENT_DATA=false`. Model/email keys were empty; no provider request or email was made. The homepage and authenticated workspace rendered, with no framework overlay or recorded browser errors.
- A dedicated fictional browser fixture contained 251 archived records, one recent active record and a separate second location. Real database-backed staff session authentication was used. The archive initially rendered 50 of 251; Load more rendered 100 unique cards. Server search returned the 500-day-old target as one matching card despite the prior 250-record cutoff. The report denominator remained 251 throughout search and after changing the reporting range to seven days.
- A deliberate browser fetch failure on one pagination request retained all 50 existing cards and displayed an error; the visible retry recovered to 100 unique cards. A deliberately delayed older, actual search response could not overwrite the newer target search after both responses completed. These are isolated client error/ordering injections, not fabricated application/provider output.
- The target's actual Restore visit button completed in the real browser. A separate scoped database read confirmed `archivedAt:null`, preserved `WELLNESS_RECOMMENDATION_TBD` stage and `TBD` decision, and a `consultation.restore` event with the correct staff actor and expected after-state. Subsequent archive search showed zero matches and the archive total fell to 250. Switching to the second location and opening its archive returned only its single location-specific record and denominator 1.
- Actual authenticated HTTP reads of `pageSize=0`, `cursor=invalid` and `archived=invalid` returned 400 `VALIDATION_ERROR`. The actual-PG regressions independently cover valid-but-foreign scope.
- The dedicated browser fixture was removed, with tenant count zero confirmed; the named browser session and separate production server were closed. No unrelated records were truncated, application code edited by the Auditor, hosted resource mutated or real-data flag enabled.

During automation, agent-browser's empty fill did not fire the expected React clear transition. Real Control+A/Backspace correctly cleared and refreshed the results; this was not classified as a product defect. Verification used fresh snapshots and the rendered Restore visit control rather than assuming a button label.

Guidance: Vercel Plugin verification, agent-browser and agent-browser-verify from c12; installed agent-browser 0.38.1 core documentation, Next.js 16.3.8 route-handler documentation and the existing version-matched app contracts. The root ICM development folders and authored Eve/application Workflow folders remain unchanged.

FINDINGS: none blocking in TASK-020.
PATTERN_VIOLATIONS: none.
GOTCHA_HITS: G-005 explicit pinned/local tooling and synthetic database selection.
PRD_AUDIT: PASS, repair fulfills existing archive search/restore and reporting requirements.

The CTO's accompanying `docs/VERIFICATION_REPORT.md` factual correction also passes review: it leads with the actual October 2 connected preview/79-check/deployment evidence and Gateway denial, and dates the superseded October 1 absence of live bindings. It preserves historical evidence and makes no new runtime or provider-success claim.

This PASS covers source and isolated synthetic runtime behavior. The repair has not yet been deployed. Actual AI/transcription/email/billing/scheduler and full hosted pilot verification remain subject to the documented gates; TASK-021 and the full owner improvement lifecycle are next in the approved queue.

## TASK-021, saved successful generation results

AUDIT: TASK-021
VERDICT: PASS
ATTEMPT: 1
BASE PARENT: `84a5c147304c6fc66ef0a148c7f71fba702e6dc3`

The scoped three-file app/test patch repairs the saved-result reader without changing schema or clients. `apps/web/app/api/jobs/[id]/route.ts:15` recognizes both persisted successful values, `COMPLETE` and historical `COMPLETED`, and returns the existing public `complete` status with the exact saved result. `apps/web/lib/clinic.ts:590` writes new deterministic initial/wellness jobs using the existing canonical `COMPLETE` value. Historical rows, IDs, results, model/prompt versions, usage, timestamps and idempotency keys remain intact. Pending, queuing, running, failed and cancelled results remain hidden; both successful upload aliases still exclude private upload pointers.

Independent evidence:

- The six new regressions passed, 6/6 with zero skips, through the project's ordinary Vitest configuration and discovery at 12:52 UTC. The command was `node_modules/.bin/vitest run lib/job-results.integration.test.ts` in `apps/web`, after explicitly loading the private verification environment and selecting the guarded localhost:55432 `dripwell_verification` database.
- Actual scoped clinic actions produce and persist both deterministic initial and wellness outputs, then the actual job route and actual `waitForJob` consumer return those exact records. Whole persisted jobs are unchanged after retrieval. Historical `COMPLETED` and workflow-style `COMPLETE` fixtures both reopen successfully without rewriting their statuses.
- The actual route hides partial results for all five unfinished/unsuccessful states. The real polling consumer preserves failed/cancelled errors and observes a persisted running-to-complete transition. Successful `RECORDING_UPLOAD` records reveal no private pointer for either alias.
- Real database-backed sessions enforce foreign-tenant 404, ordinary staff and another owner's setup-job 403, unauthenticated 401 and malformed ID 400. Consultation reads at a second owned location remain available to both owner and staff; foreign access remains 404.
- The tests call the actual route in-process, replacing only browser transport, framework cookie delivery and polling delays. They use real PostgreSQL and current session authority. This is source/database/client-contract verification, not a deployed HTTP test or an actual model/Workflow execution. Workflow-style fixtures are explicitly labeled synthetic, and no inference, transcription or provider usage is claimed.
- Fixture cleanup completed through `afterAll`; no server, email, model request, hosted write, migration, real-data enablement or Auditor application edit occurred. The Coder's clinic 15/15 and web typecheck passed. Independent `git diff --check` passed. No packaging or framework API changed, so the prior optimized build was not repeated without a new concern.

Authority clarification in TASK-021 criterion 3 is co-signed as a statement of existing behavior. `User` has tenant membership and no assigned-location membership (`packages/shared/prisma/schema.prisma:215`); `auth.ts:40` loads the tenant's active locations, with the first as a default (`:49`). `getConsultation` scopes existing detail reads by ID and tenant (`lib/clinic.ts:414`); the job's composite consultation/tenant foreign key preserves that scope (`schema.prisma:1213`). The clarification adds no new role or feature and preserves exact-owner authority for nonconsultation jobs.

The accompanying verification-report update is co-signed. Independent GitHub metadata and logs confirm run `37008021662` completed successfully at exact source `84a5c147`, with 23 domain, 8 auth, 15 clinic, 11 AI-boundary and 24 unit checks, total 81, plus all 10 migrations, types and both builds. That CI run precedes TASK-021 and does not certify this uncommitted patch. The protected preview still uses deployed `90b0565`; neither repair is represented as deployed.

Guidance: Vercel Plugin AI generation persistence and Workflow from c12; installed Workflow 5.0.1 testing documentation, Next.js 16.3.8 route-handler contracts and existing version-matched polling/session code. This patch retains root ICM and authored Eve/Workflow folder conventions.

FINDINGS: none blocking in TASK-021.
PATTERN_VIOLATIONS: none.
GOTCHA_HITS: G-005 explicit local tooling and isolated database selection.
PRD_AUDIT: PASS, fulfills existing F-05/F-07 and F-12 addressable-result requirements; no PRD scope change.

Learning: L-013 recurred for inconsistent terminal-status writers/readers; its counter is now 2. No additional pattern or gotcha. Publish only after CTO updates state; TASK-022 integrated owner improvement verification follows. Full hosted pilot completion and actual provider/account gates remain open.

## TASK-022, complete owner improvement lifecycle

AUDIT: TASK-022
VERDICT: PASS
ATTEMPT: 1
SOURCE: `0b9702205cb7d163b769b1d4db8dd1bd076969da`

The full existing manual owner path passed independent isolated PostgreSQL verification. No model output was substituted. The private audit fixture calls current source `mutateClinicAction`, `getConsultation`, `getClinicDashboard`, database-backed request identity and `approvedTakeaway`; every staff adjustment, proposal, test, publication and rollback uses the real business operation. This verifies F-10 and pilot criterion 6 locally, not the still-pending hosted provider journey.

The fixture explicitly guards `127.0.0.1:55432/dripwell_verification` before loading the database, uses two disposable fictional tenants and genuine hashed opaque sessions, and starts no server. Owner sessions include a synthetic verified MFA state; this tests enforcement and does not claim a real MFA-enrollment exercise. As authorized by CTO, the child process temporarily enables regular-visit processing only against that guarded synthetic database, following the existing clinic-suite pattern. Improvement evidence intentionally excludes setup-test visits, so a genuine regular synthetic visit is necessary to exercise the actual evidence path. The previous flag is restored in `finally`; no hosted flag or service changes. Provider credentials are removed and every network fetch is denied; recorded fetch attempts were zero.

Independent sequence and results:

- The owner manually saved v1, ran a complete synthetic evaluation and explicitly activated it. Staff initiated a fictional visit and recorded reviewed manual intake with recording declined. Initial deterministic output chose synthetic option A at 12,900 cents; staff selected eligible option B at 8,900 cents with reason `BUDGET` and a concrete preference note. The actual adjustment preserves staff ID, original/final payloads, changed items, revision, reason and time. Authorized clinical approval, actual care, approved wellness and manual acceptance followed; the approved takeaway retained care at 8,900 and the optional membership at 5,900 cents. Acceptance did not create enrollment or payment.
- The owner dashboard exposed the real adjustment; staff dashboards exposed neither adjustment evidence nor improvements. The owner classified the change as `APPROPRIATE_CORRECTION` and created a manual evidence-backed proposal. Its stored evidence preserves the actual staff adjustment and visit context; the adjustment records owner identity/classification/time. Notes explicitly treat the budget correction as appropriate rather than equating lower spending with under-recommendation.
- The owner saved a separate v2 draft with a changed option priority and explicitly fictional price data. Clinical eligibility conditions remained unchanged. Staff and a foreign clinic owner were denied proposal creation, review, testing, publication and rollback. Proposal review preserves owner identity, decision, note and timestamp. Publishing before proposal tests failed with `IMPROVEMENT_TEST_REQUIRED`.
- A missing-screening synthetic test remained blocked, and publication using only it failed with `SUCCESSFUL_TEST_REQUIRED`. A complete eligible test selected the corrected option B at 7,900 cents. Both evaluation results and the exact proposed payload remain on the proposal. Publication was denied after removing current session MFA verification and after removing current clinical authority, even with the original actor object; restoring those fixture permissions allowed explicit activation. The active configuration records the owner, clinical validator, selected approved test and activation time; the proposal becomes immutable `ACTIVATED` and points to v2.
- Activation left the complete v1 visit, revisions, generation jobs and approved takeaway unchanged. A new v2 visit used option B at 7,900 and the revised optional membership at 6,900 cents, preserving its own approved snapshots. An attempted review mutation of the activated proposal failed with `IMMUTABLE_IMPROVEMENT`.
- Actual rollback of v1 created a new active v3, with v1 and v2 retired and both original payloads unchanged. Both earlier complete visit/artifact snapshots remained equal after rollback, and reopening their approved takeaways returned the same saved records. The activated proposal, evidence, evaluations and review metadata also remained unchanged. A later visit pinned v3 and again selected option A at 12,900 cents.
- Ten configuration audit rows preserve draft creation, synthetic tests, activation, proposal creation/review and rollback. All carry the authorized owner actor; proposal review references its proposal ID and rollback references the original v1 ID plus new v3 ID. Three real fictional starts consumed three trial units; configuration evaluations did not create visits or consume allowance.
- `finally` deleted only the two captured fixture tenants and their dependent records. Remaining fixture-tenant count was zero, the process-local flag was restored, and zero network fetch attempts were recorded. No application/test source edit, provider request, email, migration, truncation or hosted mutation occurred.

Private out-of-repository evidence records the exact assertions and snapshot hashes. Version 1 snapshot SHA-256: `d93f432677b6273d4badd7dc28bb06f669da97c562b02a90a796f3dfb4d3afb0`; version 2: `76b3d3929b431e2cbbfc03be1cb7e81176c616c09c883f5d6c5fa9cf2674e378`. These hashes cover the respective visit, revisions, persisted generation jobs and approved takeaways; adjustment owner-classification metadata changes separately as intended.

Guidance: previously loaded Vercel Plugin verification, generation persistence and Workflow guidance; installed framework testing contracts. P-008 current database authority, P-009 shared eligibility gates and immutable version/snapshot contracts are honored. The ICM and authored Eve/Workflow folders remain unchanged.

FINDINGS: none blocking in TASK-022.
PATTERN_VIOLATIONS: none.
GOTCHA_HITS: G-005 explicit local tooling and guarded verification database.
PRD_AUDIT: PASS, existing F-10/section 8 criterion 6 locally verified; no scope change.
Learning: no new lesson, pattern or gotcha beyond existing authority, safety and version-persistence guidance.

Next resume point: CTO publishes these verification documents and routes the CI-only TASK-024 target-guard repair before claiming a passing full fresh CI or deploying the reviewed app repairs. Actual inference/transcription, email, billing, scheduling, retention and full hosted pilot gates remain open.

## TASK-024, documented isolated CI test target

AUDIT: TASK-024
VERDICT: PASS for source and isolated regressions; fresh fixed-head CI pending publication
ATTEMPT: 1
BASE PARENT: `0b9702205cb7d163b769b1d4db8dd1bd076969da`

Independent GitHub metadata confirms CI run `37009796929` failed at the exact parent above. The new job-result suite's guard rejected the already-documented CI target before collecting its cases. `.github/workflows/v2-checks.yml:28` and `:29` explicitly bind both database variables to `localhost:5432/dripwell_verification`; isolated workspace verification uses port 55432. This is a test-environment assumption, separate from application behavior or live provider access.

Only the target condition in `apps/web/lib/job-results.integration.test.ts:21` changes. It requires PostgreSQL protocol, an explicit `TEST_DATABASE_URL`, loopback `127.0.0.1` or `localhost`, documented port 55432 or 5432, and exact database path `/dripwell_verification`. Rejection occurs before selecting `DATABASE_URL`. No ordinary database/preview fallback, fixture/assertion change, schema reset, migration or application edit is introduced.

Independent evidence:

- Executing the exact authored guard text in an isolated VM accepted all eight documented protocol/host/port combinations and rejected seven remote-host, ordinary-database, wrong-port, wrong-protocol, undocumented IPv6 and malformed targets. Every rejected target left the prior database sentinel unchanged. An absent test binding did not select a fallback database.
- After explicitly loading the private guarded local environment, a child runner selected the same disposable database using `localhost:55432` and invoked the ordinary Vitest config. All six actual PostgreSQL job-route/polling cases executed and passed, zero skips, at 13:07 UTC. No actual local port-5432 execution is claimed.
- The six behavioral cases remain unchanged. Coder reports the normal full unit suite 30/30 with zero skips and web types PASS. Independent `git diff --check` passed. Fixture cleanup completed; no server, hosted write or provider request occurred.

FINDINGS: none blocking in the scoped guard repair.
PATTERN_VIOLATIONS: none.
GOTCHA_HITS: G-005 explicit tooling and disposable target selection.
PRD_AUDIT: PASS, verification repair only; no product scope change.
Learning: L-027 records that disposable-target guards must match both documented workspace and CI bindings.

CTO must publish the reviewed fix and verify an actual fresh CI run at that fixed head before deployment or full-task completion. These source/local results do not turn the earlier failed run into a passing one, certify port-5432 integration execution, or establish hosted pilot completion.
