# STATE.md

## Current status

2026-10-02: Owner requested "get the software finished" and completed Vercel device authentication. V2 source and local runtime are implemented and independently reviewed in `/workspace/dripwell-build`, branch `feat/dripwell-consultation-v2`. CTO routes Coder implementation and independent Auditor review per AGENTS.md. Continuous mode remains OFF.

Published source is `4a40b41d78fe89f1b4cc650029d8d16c9e617961` in [PR #2](https://github.com/loydhale/dripwell-ai/pull/2). Fresh [CI run 36947768772](https://github.com/loydhale/dripwell-ai/actions/runs/36947768772) passed all 79 checks with no skips, all 10 migrations, TypeScript and optimized Next/eve builds. Independent source/local audit PASS includes synthetic browser consultation, exact approvals/outcomes, archive, owner review and authenticated PDF. See `docs/AUDIT_V2.md` and `docs/VERIFICATION_REPORT.md`.

The dedicated Vercel project `dripwell-ai` is authenticated on `loyd-1222s-projects`. Node 24, root `apps/web`, workspace files and project OIDC are enabled. Isolated Neon PostgreSQL 18.6 and private Blob connect to preview/development only. All 10 exact migration checksums, Prisma ledger and schema inventory passed independent verification. The protected preview is READY at https://dripwell-ai-preview-loyd-1222s-projects.vercel.app, deployment `dpl_EdCKJWgdsdMBz5QxZ8n27PXmcRBr`. All 296 staged files match the reviewed commit except preview-only `crons=[]`; the production 15-minute schedule remains unchanged. Hobby rejects that cadence, so production needs Pro.

Hosted registration, database-backed sessions/dashboard, owner/platform separation, private Blob authenticated bytes/anonymous denial/deletion, and 390px mobile layout passed. `/api/health` reports configuration-required for missing billing/email, separately from the proven database connection. The advisory-lock setup/publication issue was repaired through parameterized `$executeRaw` with four actual-PG regressions and independent PASS. Hosted preflight now persists its conversation/job correctly. The next authenticated Eve request exposes a separate packaging failure: the standalone service omits Prisma's RHEL native engine. The four-file repair now passes independent review using Eve 0.69 supported external-dependency packaging and Prisma 6.19 binary targets. Both physical Vercel function bundles contain the RHEL engine and query isolated PostgreSQL through their own packaged clients; the fail-fast guard rejects a removed engine. Schema, types and four lock regressions pass. Local normal Sandbox prewarming has a bounded workspace transport failure; source prewarming is unchanged and must pass the actual remote rebuild. Publication and redeployment are next. No successful hosted model run is claimed yet.

Provider release gates remain: Owner acceptance of Stripe Marketplace terms/account connection; owned Resend sending domain and verified sender; actual recurring platform price and referral-credit policy; Pro plan for the authored schedule; selected platform administrator/MFA; and service/data-path eligibility plus actual hosted recording/transcription, sharing, billing and retention verification. Deployment protection and `ALLOW_REAL_CLIENT_DATA=false` remain enabled. No production promotion or Git connection to the old main branch occurred.

Vercel Plugin guidance is available from `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`. Relevant skills and version-matched installed documentation are used by Coders and Auditor. Preserve root ICM instructions/personas/memory/tasks and authored `apps/web/agent`/`apps/web/workflows` layout. The Owner's separate ICM example remains unconfirmed.

## Deliverables

- PRD.md: v2 requirements, six exact Kanban triggers, archive, 14-day/10-consultation trial, owner-only improvement.
- docs/IMPLEMENTATION_PLAN.md: source-verified eve layout, preserved project context conventions, migration/work packages/validation.
- docs/archive/PRD-v1.md and STATE-v1.md: preserved historical requirements/state.
- README.md and PROJECT_CONTEXT.md distinguish actual runtime from target architecture.
- Complete source retained on `feat/dripwell-consultation-v2`; main and the existing v1 deployment were not silently switched.
- Published implementation: [PR #2](https://github.com/loydhale/dripwell-ai/pull/2), source commit `4a40b41d78fe89f1b4cc650029d8d16c9e617961`, with all 79 checks and both builds passing in fresh CI. Earlier documentation-only PR #1 is closed as superseded.
- docs/AUDIT_V2.md: independent source/local-runtime PASS; docs/VERIFICATION_REPORT.md and PREVIEW.md: exact checks, screenshots and live-service boundary; docs/DEPLOYMENT.md: real service/bootstrap/release steps.

## Next resume point

The standalone Eve Prisma packaging repair and independent artifact/runtime audit PASS are complete. Publish the exact reviewed head, build an independently hash-checked staging archive with the same preview-only empty cron schedule, deploy READY and reassign the trusted stable alias. Auditor reuses the retained fictional owner to verify actual authenticated Eve session creation and setup/model execution. Do not reapply migrations or repeat passing Blob/mobile/auth checks without a relevant change.

Then update exact release evidence and remaining gates. Continue provider setup after pending Owner input arrives. Do not purchase an upgrade, invent commercial terms, bootstrap an unselected administrator, enable real-client intake or promote this preview to production. Native Git push failed in this environment; the private Git Data API publication helper publishes exact reviewed trees/commits non-force and verifies remote heads. Credentials, fixture sessions and provider helpers stay outside Git.

The isolated PostgreSQL 17 fixture database is available at port 55432. Load `/workspace/dripwell-verification.env` explicitly before integration checks; `apps/web/.env.local` binds the real preview database and must never become a disposable test target. Prior local `next start` on port 3000 is synthetic verification only. Do not resume the superseded photo-assessment queue.

## Open decisions

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
