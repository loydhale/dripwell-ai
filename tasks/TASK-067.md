# TASK-067: Retry a failed owner setup message

TASK_ID: TASK-067
PARENT_REQUEST: Owner: "You coding this. We need to be done." Standing until-done authorization on feat/dripwell-consultation-v2 / PR #2.
STATUS: IN_PROGRESS, source implementation followed by independent review and first ordinary changed-source CI.

## Goal and approved scope

Allow an owner to retry the same failed conversational setup message after a temporary failure, preserving its durable conversation and idempotency identity.

Continuous-mode Tier 2, PRD F01 and section 8 criteria 1, 6 and 9. The actual current source still reproduces PR review finding [4161485536](https://github.com/loydhale/dripwell-ai/pull/2#discussion_r4161485536): the UI retains the same message/key on HTTP503; POST replays the FAILED job as HTTP202; polling rejects that same job without another send. This is a necessary independent bug fix, not a new feature or a reset of any older task allocation.

In scope:
- Under the existing setup advisory-lock transaction, authorize exact owner, tenant, location, conversation, message and SETUP_CHAT identity before reclaiming a FAILED job.
- Atomically claim FAILED as RUNNING, clear terminal error/time, preserve job/conversation IDs, then run the existing message/session work outside the transaction.
- Preserve completed replay and in-flight replay. Concurrent retries produce one extra model send and one saved user message.
- Add focused actual-handler regressions to the existing isolated PostgreSQL integration module for unchanged retry recovery, concurrent retries and conflicting identity denial before reclaim.

Out of scope:
- UI redesign, new retry/status framework, automatic retries, provider changes, account provisioning, purchase, deployment or real data.
- Changes to schema, migrations, packages, CI, Workflow, authored agent instructions or clinical activation.
- Local application imports, builds, typechecks, tests, generated-client repair, SQL, inventory, cleanup or use of the retained TASK066 target/cache/report/process.
- Reopening permanent TASK057 or any consumed TASK052/TASK061R1/TASK064/TASK066 scope. Their historical unknowns and holds stay intact.

## Files and role split

Coder production scope: apps/web/app/api/setup/route.ts (one file).
Coder regression scope: apps/web/lib/advisory-locks.integration.test.ts (existing setup harness).
CTO owns this brief and current STATE/resume. Auditor independently reviews the patch and writes the audit, learning and CHANGELOG entry. No PRD requirement or completion criterion changes.

## Memory and framework guidance

Apply L-013 (status consumers), L-023 (executeRaw for void advisory locks), L-027/L-035 (actual schema and explicit disposable test guards), P-008/P-010 (current authority and selected owner/location), G-002 (native IDs). Read the required boot files and Coder/Auditor persona before work.

Actual open-source Vercel Plugin reference: /workspace/dripwell-vercel-plugin-reference, 0.53.0, commit 3b472643cbb1a42479d99b0c9a1d27b8bc84aaa7. Verification guidance already read by CTO and Coder. Apply it to the UI -> handler -> durable job/conversation -> response path, and read relevant installed Next/Prisma/eve documentation before any framework-specific decision. Reuse existing supported APIs and keep provider I/O outside transactions.

## Acceptance and meaningful validation

1. First transient setup failure leaves FAILED; identical resubmission can complete using the same job and conversation. Terminal error/completion metadata no longer poisons the running/successful result.
2. An overlapping identical retry observes the claimed RUNNING job and does not create a second job/conversation or send. Existing completed/in-flight behavior remains covered.
3. Different message, foreign owner/tenant/location, explicit different conversation or wrong job kind cannot reclaim or change the failed job. Authorization precedes mutation.
4. The persisted user message remains single despite failed/retried work; completion is replayable without another send. Active clinic configuration is untouched.
5. Tests exercise the actual POST handler against the existing CI disposable PostgreSQL service with fictional fixtures and intercepted eve leaves. All promises join before owned cleanup; no real provider calls or real-client enablement.
6. Independent Auditor source PASS before publication. Publish only reviewed source to the same branch with an expected-head non-forced update. The first ordinary changed-source CI generates its own client and migrates its fresh synthetic service; it is meaningful new validation, not a rerun of unchanged checks or reuse of retained local state.
7. Inspect that CI's actual result, obtain independent result review and separate learning, then update STATE/CHANGELOG. Keep pilot and production incomplete and all external dependencies individually parked.

Baseline: local/origin/remote/PR HEAD 1b5bff53a90401553b4274fb68c0ffa0078d8211; actual managed shell access native0 confirmed; no other active worker. Task completion count remains 40 until this task meets all requirements.
