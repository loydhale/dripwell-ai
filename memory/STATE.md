# STATE.md

## Current status

2026-10-02: Owner requested "get the software finished" and completed Vercel device authentication, then explicitly requested "Please create a loop so that you don’t stop working on this until it’s down ." Continuous work is authorized until the approved pilot definition of done is verified or the Owner cancels it. V2 source and local runtime are implemented and independently reviewed in `/workspace/dripwell-build`, branch `feat/dripwell-consultation-v2`. CTO routes Coder implementation and independent Auditor review per AGENTS.md.

## Continuous work loop

CONTINUOUS_MODE: ON
Started: 2026-10-02T12:09:13Z
Started by: "Please create a loop so that you don’t stop working on this until it’s down ."
Execution status: ACTIVE
Tasks completed this run: 2
Consecutive escalations this run: 0
Consecutive tasks without learning or meaningful changes: 0
Recurring continuation: ENABLED, `Finish DripWell`, hourly, automation `6abf9f5e25c08191b939bb96222f1f13`. Creation confirmed 2026-10-02T12:11:10Z; no future execution or coding result claimed. See [continuous-work contract](../docs/CONTINUOUS_WORK.md).

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
Next step: Commit/publish the reviewed repair with [audit evidence](../docs/AUDIT_CONTINUOUS_REPAIRS.md), then complete TASK-021. This repair has not yet been deployed.

### TASK-021 — Return saved results for completed generation jobs
Status: IN_PROGRESS
Assigned: CODER
Attempt: 1
Brief: [TASK-021](../tasks/TASK-021.md)
PRD refs: F-05; F-07; F-12 addressable generations
Last update: 2026-10-02 — TASK-020 independently passed; Coder is tracing current job writers/readers and then implementing the bounded completion/result fix. Mutations held only for the reviewed TASK-020 commit checkpoint.
Next step: Make successful completion/result handling consistent while preserving previously saved status values, then independently verify scoped job reads and unsuccessful-job behavior.

### TASK-022 — Verify the complete owner improvement lifecycle
Status: QUEUED
Assigned: AUDITOR
Attempt: 1
Brief: [TASK-022](../tasks/TASK-022.md)
PRD refs: F-10; section 8 criterion 6
Last update: 2026-10-02 — Independent gap review identified missing recorded integrated proof of the full evidence/proposal/test/activation/rollback sequence.
Next step: After TASK-021 review, verify the real existing paths with isolated synthetic data, owner-only authority and unchanged historical snapshots; route any defect to Coder before continuing.

### Parked release work

- AI inference/transcription: supported access honoring the Owner's ChatGPT subscription preference; commercial SIWC eligibility and audio remain unresolved. No paid credits/provider switch authorized.
- Stripe: Owner accepts the existing Marketplace browser terms gate, then continue the already-authorized sandbox connection and real billing verification.
- Resend: obtain the already-requested owned sending domain, verify the sender and complete synthetic recipient verification. Do not repeat the question while it remains pending.
- Commercial policy: actual recurring platform price and explicit referral-credit terms; prepare reviewable configuration without inventing prices.
- Scheduler: supported production cadence/plan; no Pro purchase authorized. Account for reminder, cleanup and recovery processing together.
- Platform administrator: selected identity and MFA before bootstrap.
- Full pilot verification: two-clinic recording/transcription, actual model response, exact approvals, secure sharing, billing/referral credit, reminders and retention under the selected live services; maintain synthetic-only protection until eligibility is verified.

Deployed implementation source is `90b0565ebdcc7759dacbf84586c6c7b67a461f17` in [PR #2](https://github.com/loydhale/dripwell-ai/pull/2). Fresh [CI run 36950177151](https://github.com/loydhale/dripwell-ai/actions/runs/36950177151) passed all 79 checks with no skips, all 10 migrations, TypeScript and optimized Next/eve builds. Independent source/local audit PASS includes synthetic browser consultation, exact approvals/outcomes, archive, owner review and authenticated PDF. See `docs/AUDIT_V2.md` and `docs/VERIFICATION_REPORT.md`.

The dedicated Vercel project `dripwell-ai` is authenticated on `loyd-1222s-projects`. Node 24, root `apps/web`, workspace files and project OIDC are enabled. Isolated Neon PostgreSQL 18.6 and private Blob connect to preview/development only. All 10 exact migration checksums, Prisma ledger and schema inventory passed independent verification. The protected preview is READY at https://dripwell-ai-preview-loyd-1222s-projects.vercel.app, deployment `dpl_5fcJdVWXje4EbbGScPnDRYoStbB6`. All 297 staged files match the reviewed commit except preview-only `crons=[]`; the production 15-minute schedule remains unchanged. Hobby rejects that cadence, so production needs Pro.

Hosted registration, database-backed sessions/dashboard, owner/platform separation, private Blob authenticated bytes/anonymous denial/deletion, and 390px mobile layout passed. `/api/health` reports configuration-required for missing billing/email, separately from the proven database connection. Advisory-lock and native-engine repairs independently pass. Both packaged Vercel Eve clients queried isolated PostgreSQL; missing-engine rejection, schema, types and four lock regressions pass. The remote build passed unchanged default Sandbox prewarming and the two-bundle engine guard.

Actual hosted setup now creates the authenticated Eve session, binds it to the retained fictional owner/location and starts Workflow processing. The bound NDJSON stream returns 200, unauthenticated stream 401 and unbound-owner stream 403. Saved conversation GET returns 200; failed-request replay returns 202 without duplicate jobs and conflicting replay returns 409. Hosted consultation, active configuration and trial-usage counts remain zero, allowance 10 and used 0. Gateway inference is BLOCKED by account entitlement: HTTP 403 `RestrictedModelsError` / `no_providers_available` for `openai/gpt-6-luna`, requiring paid credits, with providerAttemptCount 0. The durable job records failure and usage remains null. No successful hosted model response is claimed. Owner subsequently stated a preference for using their existing ChatGPT subscription; do not treat the earlier Gateway-credit question as funding authorization. Current SIWC supports eligible participating apps, but the hosted commercial route requires partner eligibility and published terms prohibit one user funding another user's requests. Audio/transcription is excluded. No credits, alternate credentials or model/provider change were made. See docs/CHATGPT_PLAN_ASSESSMENT.md.

Provider release gates remain: a supported AI access/billing route compatible with the Owner's subscription preference; Owner acceptance of Stripe Marketplace terms/account connection; owned Resend sending domain and verified sender; actual recurring platform price and referral-credit policy; Pro plan for the authored schedule; selected platform administrator/MFA; and service/data-path eligibility plus actual hosted recording/transcription, sharing, billing and retention verification. Deployment protection and `ALLOW_REAL_CLIENT_DATA=false` remain enabled. No production promotion or Git connection to the old main branch occurred.

Vercel Plugin guidance is available from `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`. Relevant skills and version-matched installed documentation are used by Coders and Auditor. Preserve root ICM instructions/personas/memory/tasks and authored `apps/web/agent`/`apps/web/workflows` layout. The Owner's separate ICM example remains unconfirmed.

## Deliverables

- PRD.md: v2 requirements, six exact Kanban triggers, archive, 14-day/10-consultation trial, owner-only improvement.
- docs/IMPLEMENTATION_PLAN.md: source-verified eve layout, preserved project context conventions, migration/work packages/validation.
- docs/archive/PRD-v1.md and STATE-v1.md: preserved historical requirements/state.
- README.md and PROJECT_CONTEXT.md distinguish actual runtime from target architecture.
- Complete source retained on `feat/dripwell-consultation-v2`; main and the existing v1 deployment were not silently switched.
- Published implementation: [PR #2](https://github.com/loydhale/dripwell-ai/pull/2), source commit `90b0565ebdcc7759dacbf84586c6c7b67a461f17`, with all 79 checks and both builds passing in fresh CI. Earlier documentation-only PR #1 is closed as superseded.
- docs/AUDIT_V2.md: independent source/local-runtime PASS; docs/VERIFICATION_REPORT.md and PREVIEW.md: exact checks, screenshots and live-service boundary; docs/DEPLOYMENT.md: real service/bootstrap/release steps.

## Next resume point

Continue the active continuous-work queue before waiting on provider accounts: TASK-020 is independently verified, TASK-021 is in implementation and TASK-022 integrated owner-lifecycle evidence follows its review. The account gates below are parked and do not block these source/verification tasks.

The source/runtime repairs, independent audit, exact publication, 79-check CI and protected remote deployment are complete. Hosted inference awaits a supported AI access decision after the Owner requested their ChatGPT subscription. Ordinary API billing is separate; approved SIWC is a real alternative for eligible apps, not a generic shared SaaS entitlement. No commercial registration has been submitted. Once valid access is configured and any source changes independently reviewed, Auditor reuses the retained fictional owner/location and protection session with a fresh idempotency key to verify a real assistant response, durable completed job and measured usage, then replay/continuation. Current failed jobs and their evidence stay intact. Do not reapply migrations or repeat passing source/Blob/mobile checks without a relevant change.

Owner authorized Stripe and selected Resend. Retried named Stripe sandbox installation still returns the actual browser terms acceptance gate; follow its saved link before retrying. Live Resend metadata requires an owned domain; that single clarification is pending. Pro is not authorized by the Owner's “Reminder?” question. Remaining input also covers actual platform subscription/referral terms and selected platform administrator. After those arrive, provision the actual services and verify billing/email, hosted synthetic recording/transcription, retention and complete two-clinic workflow before production. Keep protection and `ALLOW_REAL_CLIENT_DATA=false`; do not purchase an upgrade/credits, invent commercial terms, bootstrap an unselected administrator or promote the preview without those gates.

Native Git push failed in this environment; the private Git Data API publication helper publishes exact reviewed trees/commits non-force and verifies remote heads. Credentials, fixture sessions and provider helpers stay outside Git. Local PostgreSQL 17 fixtures are at port 55432; explicitly load `/workspace/dripwell-verification.env` before integration checks. `apps/web/.env.local` is the actual hosted preview database and must never be a disposable test target. Prior local port 3000 is synthetic verification only. Do not resume the superseded photo-assessment queue. Continuous mode is ON; resume the active queue above, then parked release work when its specific inputs arrive.

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
