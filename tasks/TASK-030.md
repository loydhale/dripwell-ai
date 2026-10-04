# TASK-030: Verify the authenticated recovery endpoint on isolated data

TASK_ID: TASK-030
TITLE: Exercise compiled cron authentication through database reconciliation
PARENT_REQUEST: Owner's continuous-completion instruction; TASK-028 independently identified missing actual cron entrypoint evidence.

GOAL: Verify the compiled GET /api/jobs/reconcile authenticates before mutation and performs its authored database reminder/recovery/pruning behavior on exclusively owned fictional records.

## Evidence and bounded scope

TASK-028 proves actual local durable reminder execution, but did not call the cron endpoint. Existing direct helper tests and historical unauthenticated hosted denial do not establish the authenticated compiled HTTP-to-database boundary. The endpoint also mutates database-wide stale uploads/unbound jobs and expired authentication/rate records. TASK-028's thirteen-model inventory proves the shared verification database contains unrelated rows; it must not be this global test's mutation target.

- Read latest AGENTS/PRD/CTO-role context and the Auditor's boot files/persona before execution. Mandatory open-source Vercel Plugin guidance is available from skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1; use relevant cron-jobs, workflow and verification guidance and installed Next16.3.8/Workflow5.0.1 documentation. Keep root ICM and authored apps/web/workflows.
- Reconcile workers and shared build ownership first. TASK-028 must release its browser/server/run resources. Reuse the optimized artifact only after its source-map contents match the exact reviewed relevant route/services. Build only if that provenance cannot be established; do not repeat unrelated passing suites.
- Create a dedicated owned loopback database named dripwell_task030_verification at127.0.0.1:55432, or an equivalently isolated explicitly named schema whose isolation is independently proved. Guard equal explicit DATABASE_URL and TEST_DATABASE_URL before every fixture/server operation. Never select hosted .env.local or mutate the shared dripwell_verification database. Record the selected target and before-fixture empty inventory without credentials.
- Prefer copying only reviewed schema DDL into the fresh disposable target. Do not copy existing fixture/authentication rows or reapply migrations to shared/hosted databases. If isolated initialization is unavailable, record that exact blocker before making a global endpoint request.
- Use an owned local server and private local CRON_SECRET, literal ALLOW_REAL_CLIENT_DATA=false, all model/Blob/email/Stripe keys blank and no OIDC provider identity. Independently confirm actual running selection; retain proxy/certificate controls. Do not log the secret or fixture tokens.
- Confirm missing/incorrect bearer authentication denies before mutations, comparing the owned database inventory. Exercise one correctly authenticated actual GET through the compiled endpoint; direct invocation of a helper or imported route is not that proof.
- Choose a small fixture set that demonstrates an overdue in-app reminder plus at least one authored database recovery/prune effect. Inspect actual source predicates before creating legitimate fictional overdue/expired dates. Record real HTTP status, response readiness/counters and exact database before/after effects. Use a second valid request only when needed to verify endpoint-level idempotence; do not rerun all already-passing helper predicates.
- With storage keys blank, preserve the authored unavailable boundary, including uploadCleanup=null and retentionStorageReady=false where returned. No Blob deletion, inference, transcription, email, Stripe or provider-ready claim is permitted. Avoid recoverable generation fixtures that could launch a provider request. Do not substitute a fake provider result.
- Inventory every possible global mutation before calling the endpoint. All affected rows must be owned by this disposable target; preserve shared database counts/digests across the test. Clean owned fixtures/database/schema, server/run state and private resources, retaining evidence outside Git. Do not drop an unidentified/preexisting target.

This is a bounded independent verification task, with no application edits. If a source defect is reproduced, report the exact boundary and route a separate Coder repair through CTO. No hosted cron invocation, scheduler/plan change, migration on an existing target, account purchase, new feature, external message or real client data.

## Acceptance criteria

1. Explicit isolated target, empty initial inventory, compiled source provenance and actual false-gate/blank-provider environment are demonstrated before global mutations, or a precise setup blocker is recorded.
2. Missing/bad authentication denies without database mutation; real correctly authenticated compiled HTTP invocation drives the scoped authored reminder plus recovery/prune effects, or a precise independent runtime/source blocker is recorded.
3. Readiness/storage/provider limitations and any bounded retry/idempotence evidence are accurate. Local HTTP execution does not establish hosted15-minute scheduling, actual Blob retention or the full pilot.
4. Shared state is preserved, exclusively owned resources are cleaned, and there is no prohibited provider/hosted action.
5. Independent verdict/learning/CHANGELOG/STATE and reviewed publication preserve exact evidence boundaries.

Auditor owns docs/AUDIT_CRON_RECOVERY.md and append-only learning/CHANGELOG/SESSION_LOG. CTO owns STATE/briefs. Plan co-sign precedes execution; no concurrent worker may use the owned server/build/database.

2026-10-02 plan co-sign: Independent Auditor PASS for isolated target, authentication before mutation, blank-storage boundaries and global-row inventory. Verification only, no new feature/source/runtime execution. Dispatch follows reviewed closing publication and worker reconciliation.

2026-10-02 outcome: Independent Auditor PASS attempt1 for actual compiled401/401/200 authentication/database execution on50 initially empty schema-only tables. One valid request produced the exact scoped reminder/recovery/pruning effects; other44 tables unchanged, storagefalse/null/zero. Owned server/database/profile removed and all50 shared digests/container preserved. P-015,CHANGELOG/SESSION_LOG and33 private checksums are complete. No source edit, provider call, hosted mutation, scheduler success or full-pilot completion is claimed. See [audit](../docs/AUDIT_CRON_RECOVERY.md); separately co-signed TASK-031 addresses the selected-store retention boundary.
