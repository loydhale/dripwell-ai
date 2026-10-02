# STATE.md

## Current status

2026-10-02: Owner requested "get the software finished" and completed Vercel device authentication, then explicitly requested "Please create a loop so that you don’t stop working on this until it’s down ." Continuous work is authorized until the approved pilot definition of done is verified or the Owner cancels it. V2 source and local runtime are implemented and independently reviewed in `/workspace/dripwell-build`, branch `feat/dripwell-consultation-v2`. CTO routes Coder implementation and independent Auditor review per AGENTS.md.

## Continuous work loop

CONTINUOUS_MODE: ON
Started: 2026-10-02T12:09:13Z
Started by: "Please create a loop so that you don’t stop working on this until it’s down ."
Execution status: WAITING_ON_DEPENDENCIES
Tasks completed this run: 6
Consecutive escalations this run: 0
Consecutive tasks without learning or meaningful changes: 0
Recurring continuation: ENABLED, `Finish DripWell`, hourly, automation `6abf9f5e25c08191b939bb96222f1f13`. Creation confirmed 2026-10-02T12:11:10Z. A continuation arrived during the active pass on 2026-10-02T13:09Z; actual workers/runtime were reconciled and the same pass continued without duplicate work. See [continuous-work contract](../docs/CONTINUOUS_WORK.md).

Private lookup confirms actual `last_run_time=2026-10-02T13:07:43.452905+00:00`. Independently co-signed prompt maintenance now marks the old `90b0565`/79-check baseline as historical and directs subsequent runs to current STATE/audits; a fresh lookup verified the exact replacement, enabled status and unchanged hourly schedule. Every other instruction remains intact.

The Owner's until-done instruction persists across resumptions of this project. Finishing source code alone does not finish the pilot. Use PRD section 8 and actual service verification as completion criteria. Account-dependent tasks are parked with specific unblock conditions; the loop advances independent work, then waits for a continuation if none remains. Never fabricate activity, retry a known account denial indefinitely or turn a blocked pilot into a completion claim. Owner stop cancels the loop. Repeated audit failures/no-op work pause the affected execution for recovery, with an explicit resume point.

### TASK-019 — Continuous-loop completion gap review
Status: DONE
Assigned: AUDITOR
Attempt: 1
Brief: [TASK-019](../tasks/TASK-019.md)
PRD refs: F-01 through F-12; section 8
Last update: 2026-10-02T12:19:44Z — Independent Auditor PASS for the corrected work-loop contract, all F-01 through F-12 and section 8 evidence matrix; two guarded actual-PG source defects reproduced and routed. Learning L-026, CHANGELOG and SESSION_LOG recorded.
Next step: [Gap review](../docs/CONTINUOUS_GAP_REVIEW.md) preserves the source-versus-live boundary. Complete TASK-020 then TASK-021 and integrated owner improvement lifecycle verification; no full-product PASS claimed.

### TASK-020 — Reach and restore older archived consultations
Status: DONE
Assigned: AUDITOR
Attempt: 1
Brief: [TASK-020](../tasks/TASK-020.md)
PRD refs: F-08 archive search/restore; F-12 period reporting
Last update: 2026-10-02 — Independent Auditor PASS for scoped source, two new actual-PG regressions and optimized browser search/pages/retry/stale responses/500-day restore/reporting/location boundaries. Coder's 15 clinic tests/types/build passed; fixtures/browser/server cleaned. P-013 and CHANGELOG/SESSION_LOG recorded.
Next step: [Audit evidence](../docs/AUDIT_CONTINUOUS_REPAIRS.md) retains the runtime proof. This repair is included in reviewed source `5307fda`, whose fresh CI passed 87 checks and whose protected preview is READY; TASK-023 completes independent hosted verification.

### TASK-021 — Return saved results for completed generation jobs
Status: DONE
Assigned: AUDITOR
Attempt: 1
Brief: [TASK-021](../tasks/TASK-021.md)
PRD refs: F-05; F-07; F-12 addressable generations
Last update: 2026-10-02 — Independent Auditor PASS, attempt 1: six actual-PG real-route/poller regressions, unchanged saved history, canonical new status, hidden unfinished/failed/upload results and exact existing authority. Ordinary Vitest discovery and diff checks passed; L-013/CHANGELOG/SESSION_LOG updated. Coder clinic 15/15 and types also passed.
Next step: Saved-result repair is included in reviewed source `5307fda`, whose fresh CI passed 87 checks and whose protected preview is READY; TASK-023 completes independent hosted verification. TASK-022's independent owner lifecycle proof is complete.

### TASK-022 — Verify the complete owner improvement lifecycle
Status: DONE
Assigned: AUDITOR
Attempt: 1
Brief: [TASK-022](../tasks/TASK-022.md)
PRD refs: F-10; section 8 criterion 6
Last update: 2026-10-02 — Independent actual-PG owner evidence/proposal/test/activation/rollback PASS at `0b97022`; both historical visits/revisions/jobs/approved price snapshots byte-equivalent, authority denials passed, three fictional regular starts/ten audit rows retained during verification. Zero fetch attempts; fixture tenants cleaned and process-local flag restored. Audit/CHANGELOG/SESSION_LOG recorded, no new learning.
Next step: [Integrated evidence](../docs/AUDIT_CONTINUOUS_REPAIRS.md) completes this local-source acceptance proof. Hosted full-provider owner story and remaining account gates remain separate; TASK-024 passed fresh CI and TASK-023 completes protected-preview verification.

### TASK-023 — Deploy and verify the reviewed continuous-loop repairs
Status: DONE
Assigned: AUDITOR
Attempt: 1
Brief: [TASK-023](../tasks/TASK-023.md)
PRD refs: F-08; F-12; synthetic preview verification
Last update: 2026-10-02 — Independent deployment/runtime PASS at fixed source `5307fdafd49aea4ddc7a884b9d6e1e03881ef886`: 308 tracked stage files/modes match exact Git blobs except preview `crons=[]`; actual READY/alias/source/tree and normal Sandbox/TWO-bundle native guard pass. All 19 bounded HTTP cases pass: retained owner/workspace, empty archive paging/validation/scope, both retained FAILED job nonresults, saved setup/bound Eve reads and anonymous/unbound denial. Private/no-store responses, synthetic-only gate and zero clinical/trial/configuration counts remain intact. Both failed jobs' whole-row digests are byte-equivalent, usage null; no model requests, clinical writes or migrations. Fresh CI `37011323655` passed 87 checks, zero skips, types and both builds. Audit/learning recorded; existing P-011/P-012 and G-007/G-009 apply, no new learning.
Next step: [Deployment audit](../docs/AUDIT_CONTINUOUS_DEPLOYMENT.md) retains the scoped evidence. Successful-result aliases and populated archive traversal are actual-PG/browser/CI proofs, not fabricated hosted successes. The remaining full pilot/provider gates below need changed external input; keep protection, production cadence and the hourly continuation unchanged.

### TASK-024 — Honor the documented isolated CI database in job regressions
Status: DONE
Assigned: AUDITOR
Attempt: 1
Brief: [TASK-024](../tasks/TASK-024.md)
PRD refs: F-12; required source verification
Last update: 2026-10-02 — Independent source/local PASS: exact authored guard accepts eight documented bindings and rejects seven malformed/unintended targets; six actual-PG cases under localhost spelling executed with zero skips. Published exact fix `5307fdafd49aea4ddc7a884b9d6e1e03881ef886` passed fresh CI `37011323655`: all 87 checks, migrations, types and both builds, no skips. Independent deployment Auditor also confirmed actual successful CI at that SHA. L-027/audit/CHANGELOG/SESSION_LOG recorded.
Next step: Guard repair complete; TASK-023 deploys only this reviewed successful source. Retain evidence of failed `37009796929` and do not deploy its old stage.

### Parked release work

- AI inference/transcription: supported access honoring the Owner's ChatGPT subscription preference; commercial SIWC eligibility and audio remain unresolved. No paid credits/provider switch authorized.
- Stripe: Owner accepts the existing Marketplace browser terms gate, then continue the already-authorized sandbox connection and real billing verification.
- Resend: obtain the already-requested owned sending domain, verify the sender and complete synthetic recipient verification. Do not repeat the question while it remains pending.
- Commercial policy: actual recurring platform price and explicit referral-credit terms; prepare reviewable configuration without inventing prices.
- Scheduler: supported production cadence/plan; no Pro purchase authorized. Account for reminder, cleanup and recovery processing together.
- Platform administrator: selected identity and MFA before bootstrap.
- Full pilot verification: two-clinic recording/transcription, actual model response, exact approvals, secure sharing, billing/referral credit, reminders and retention under the selected live services; maintain synthetic-only protection until eligibility is verified.

Deployed implementation source is `5307fdafd49aea4ddc7a884b9d6e1e03881ef886` in [PR #2](https://github.com/loydhale/dripwell-ai/pull/2). Fresh [CI run 37011323655](https://github.com/loydhale/dripwell-ai/actions/runs/37011323655) passed all 87 checks with no skips, all 10 isolated CI migrations, TypeScript and optimized Next/eve builds. The earlier `0b97022` CI failed its new test-target guard and was not deployed; TASK-024 corrected that guard with independently verified target protections. Independent source/local audit PASS includes synthetic consultation, exact approvals/outcomes, retained archive access, owner improvement/rollback and authenticated PDF. See `docs/AUDIT_V2.md`, `docs/AUDIT_CONTINUOUS_REPAIRS.md` and `docs/VERIFICATION_REPORT.md`.

The dedicated Vercel project `dripwell-ai` is authenticated on `loyd-1222s-projects`. Node 24, root `apps/web`, workspace files and project OIDC are enabled. Isolated Neon PostgreSQL 18.6 and private Blob connect to preview/development only. All 10 exact migration checksums, Prisma ledger and schema inventory previously passed independent verification and were not reapplied for this update. The protected preview is READY at https://dripwell-ai-preview-loyd-1222s-projects.vercel.app, deployment `dpl_2Df4RLG6e8agmaAbNPWA2Kwm3SJq`. All 308 staged tracked files match the reviewed commit except preview-only `crons=[]`; the identical nonsecret project link is the only extra file. The production 15-minute schedule remains unchanged. Hobby rejects that cadence; a supported production scheduling plan remains an unfunded release gate.

Hosted registration, database-backed sessions/dashboard, owner/platform separation, private Blob authenticated bytes/anonymous denial/deletion, and 390px mobile layout passed. `/api/health` reports configuration-required for missing billing/email, separately from the proven database connection. Advisory-lock and native-engine repairs independently pass. Both packaged Vercel Eve clients queried isolated PostgreSQL; missing-engine rejection, schema, types and four lock regressions pass. The remote build passed unchanged default Sandbox prewarming and the two-bundle engine guard.

The new protected preview independently passed 19 bounded actual HTTP cases and exact build/alias metadata checks. Retained fictional-owner access, archive paging/validation/scope, FAILED job-result suppression, saved setup and bound/unbound Eve authorization passed. Expired application authentication correctly denied access before only that existing fictional account's login was refreshed. Both retained failed jobs' whole-row digests and zero consultation/configuration/trial-use counts remained unchanged. This does not claim successful hosted generation, populated archive traversal, the complete two-clinic journey or scheduled preview reminders. See `docs/AUDIT_CONTINUOUS_DEPLOYMENT.md`.

Actual hosted setup now creates the authenticated Eve session, binds it to the retained fictional owner/location and starts Workflow processing. The bound NDJSON stream returns 200, unauthenticated stream 401 and unbound-owner stream 403. Saved conversation GET returns 200; failed-request replay returns 202 without duplicate jobs and conflicting replay returns 409. Hosted consultation, active configuration and trial-usage counts remain zero, allowance 10 and used 0. Gateway inference is BLOCKED by account entitlement: HTTP 403 `RestrictedModelsError` / `no_providers_available` for `openai/gpt-6-luna`, requiring paid credits, with providerAttemptCount 0. The durable job records failure and usage remains null. No successful hosted model response is claimed. Owner subsequently stated a preference for using their existing ChatGPT subscription; do not treat the earlier Gateway-credit question as funding authorization. Current SIWC supports eligible participating apps, but the hosted commercial route requires partner eligibility and published terms prohibit one user funding another user's requests. Audio/transcription is excluded. No credits, alternate credentials or model/provider change were made. See docs/CHATGPT_PLAN_ASSESSMENT.md.

Provider release gates remain: a supported AI access/billing route compatible with the Owner's subscription preference; Owner acceptance of Stripe Marketplace terms/account connection; owned Resend sending domain and verified sender; actual recurring platform price and referral-credit policy; Pro plan for the authored schedule; selected platform administrator/MFA; and service/data-path eligibility plus actual hosted recording/transcription, sharing, billing and retention verification. Deployment protection and `ALLOW_REAL_CLIENT_DATA=false` remain enabled. No production promotion or Git connection to the old main branch occurred.

Vercel Plugin guidance is available from `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`. Relevant skills and version-matched installed documentation are used by Coders and Auditor. Preserve root ICM instructions/personas/memory/tasks and authored `apps/web/agent`/`apps/web/workflows` layout. The Owner's separate ICM example remains unconfirmed.

## Deliverables

- PRD.md: v2 requirements, six exact Kanban triggers, archive, 14-day/10-consultation trial, owner-only improvement.
- docs/IMPLEMENTATION_PLAN.md: source-verified eve layout, preserved project context conventions, migration/work packages/validation.
- docs/archive/PRD-v1.md and STATE-v1.md: preserved historical requirements/state.
- README.md and PROJECT_CONTEXT.md distinguish actual runtime from target architecture.
- Complete source retained on `feat/dripwell-consultation-v2`; main and the existing v1 deployment were not silently switched.
- Published implementation: [PR #2](https://github.com/loydhale/dripwell-ai/pull/2), deployed source commit `5307fdafd49aea4ddc7a884b9d6e1e03881ef886`, with all 87 checks and both builds passing in fresh CI. Earlier documentation-only PR #1 is closed as superseded.
- docs/AUDIT_V2.md: independent source/local-runtime PASS; docs/VERIFICATION_REPORT.md and PREVIEW.md: exact checks, screenshots and live-service boundary; docs/DEPLOYMENT.md: real service/bootstrap/release steps.

## Next resume point

TASK-019 through TASK-024 are DONE: reviewed archive/job repairs, integrated owner-lifecycle evidence, actual 87-check CI and independent protected-preview update are retained. No further approved independent source/verification task remains from the saved completion review. Execution is WAITING_ON_DEPENDENCIES with the explicit parked unblock conditions above; continuous mode stays ON and the hourly continuation enabled. The next run must confirm its actual runtime/workers and latest GitHub state, then resume a changed external gate or newly evidenced approved source gap. Report only a changed blocker/action, not unchanged hourly status.

Source/runtime repairs, exact reviewed publication, 87-check CI and the independent protected-preview update are complete. The approved pilot is not complete. Hosted inference awaits a supported AI access decision after the Owner requested their ChatGPT subscription. Ordinary API billing is separate; approved SIWC is a real alternative for eligible apps, not a generic shared SaaS entitlement. No commercial registration has been submitted. Once valid access is configured and any source changes independently reviewed, Auditor reuses the retained fictional owner/location and protection session with a fresh idempotency key to verify a real assistant response, durable completed job and measured usage, then replay/continuation. Current failed jobs and their evidence stay intact. Do not reapply migrations or repeat passing source/Blob/mobile checks without a relevant change.

Owner authorized Stripe and selected Resend. Retried named Stripe sandbox installation still returns the actual browser terms acceptance gate; follow its saved link before retrying. Live Resend metadata requires an owned domain; that single clarification is pending. Pro is not authorized by the Owner's “Reminder?” question. Remaining input also covers actual platform subscription/referral terms and selected platform administrator. After those arrive, provision the actual services and verify billing/email, hosted synthetic recording/transcription, retention and complete two-clinic workflow before production. Keep protection and `ALLOW_REAL_CLIENT_DATA=false`; do not purchase an upgrade/credits, invent commercial terms, bootstrap an unselected administrator or promote the preview without those gates.

Native Git push failed in this environment; the private Git Data API publication helper publishes exact reviewed trees/commits non-force and verifies remote heads. Credentials, fixture sessions and provider helpers stay outside Git. Local PostgreSQL 17 fixtures are at port 55432; explicitly load `/workspace/dripwell-verification.env` before integration checks. `apps/web/.env.local` is the actual hosted preview database and must never be a disposable test target. Refreshed retained hosted cookies are private at `/workspace/dripwell-hosted-audit-private/cookies`; use normal authorized helpers without printing their contents. Prior local port 3000 is synthetic verification only. Do not resume the superseded photo-assessment queue or old failed deployment stage. Continuous mode is ON; resume parked release work only when its specific inputs arrive, or a new evidenced in-scope source gap.

## Open decisions

- Owner prefers ChatGPT subscription use, with current SIWC eligibility/terms/audio limits documented in docs/CHATGPT_PLAN_ASSESSMENT.md; paid model funding/provider replacement remains undecided. Stripe and Resend are selected; browser terms and owned domain remain actual setup gates.
- Separate owner ICM/eve example unconfirmed; preserve observed conventions and verified eve layout until compared.
- Implemented trial default: registration opens 14 days, each unique successfully started consultation consumes one of 10 units, synthetic setup tests consume none, and existing visits remain editable after expiry/exhaustion. Credits require an explicit versioned platform policy; amount/qualification/refund terms are not fabricated.
- Validate actual clinic protocols/prices, sharing verification, retention/reminder timing, and service eligibility before their rollout.

## Historical state

[Archived v1 state](../docs/archive/STATE-v1.md) retains the old task queue.

## Format reference (do not delete)

Each task entry:

```
### TASK-001 — <short title>
Status: QUEUED | IN_PROGRESS | IN_REVIEW | BLOCKED | DONE
Assigned: CTO | CODER | AUDITOR
Attempt: 1 | 2 | 3
Brief: <link to brief or inline summary>
PRD refs: <F-numbers from PRD this task fulfills>
Last update: <timestamp> — <what happened>
Next step: <concrete next action>
```

Escalation block:

```
ESCALATION: TASK-001
(see workflows/ESCALATION.md for format)
```

PRD approval block:

```
PRD_APPROVAL_PENDING: <id>
Drafted: <timestamp>
Summary: <one line>
Blocking tasks: <task IDs that depend on this>
Workaround active: <yes/no, description>
```

Continuous mode report (written when mode turns OFF):

```
CONTINUOUS_MODE_REPORT
(see workflows/CONTINUOUS_MODE.md for full format)
```
