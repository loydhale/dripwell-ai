# STATE.md

## Current status

2026-10-01: Owner explicitly requested "get the software finished." V2 source and local runtime are complete and independently reviewed on `feat/dripwell-consultation-v2` at `/workspace/dripwell-build`, based on the reviewed documentation branch. CTO routed implementation to Coders and independent Auditor per AGENTS.md. Continuous mode remains OFF. Hosted checks now exposed a setup/referral-policy advisory-lock deserialization failure, and Coder repair and four actual-PostgreSQL operation regressions independently passed; patched hosted retry is next. Live launch also awaits the Vercel plan and remaining provider setup.

Vercel Plugin guidance is available from the connector skill source `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`. Skills read include bootstrap, marketplace, nextjs, auth, storage, eve, Workflow and AI SDK; Coders read task-specific skills and installed documentation before framework code.

Implementation source is complete across domain/schema, Next.js/auth/PWA, clinic transactions/UI, owner improvement, eve/AI/Workflow, and billing/referrals/sharing/platform. Independent foundation audit PASS and combined audit PASS, attempt 2. All findings, including pending-evidence release, recording cleanup concurrency and runtime PDF font resolution, are repaired and independently rechecked. PRD implementation notes are Auditor co-signed and learning/changelog updated.

Verification: frozen lockfile install PASS, 10 migrations applied to isolated PostgreSQL 17, 75 canonical tests PASS with no skips, Prisma validation and TypeScript PASS, actual eve 0.69.0 and optimized Next 16.3.8 builds PASS. Chromium walkthrough verifies owner registration/MFA, fictional catalog/test/activation, guided manual intake, tracked adjustment/exact approval, synthetic care record, wellness generation/approval/acceptance, PDF download, archive/restore, owner evidence review and 390px mobile layout. Production-mode dashboard and authenticated PDF are verified; both document traces include their fonts. See `docs/VERIFICATION_REPORT.md` and `docs/PREVIEW.md`.

Live-service progress, 2026-10-02: Owner completed fresh Vercel device authentication. CLI verifies `loyd-1222` and the sole team `loyd-1222s-projects` (Hobby). Created isolated `dripwell-ai` project `prj_fF0yFggYVFN9pI5dQN33glG2wPyW`, root `apps/web`, Node 24, workspace files enabled, OIDC enabled and default preview protection retained. New isolated Neon preview resource `store_HcpJtP2bHnw51Yys` (PostgreSQL 18.6) and private Blob `store_N8fvW5FNjKnYMPsx` connect to preview/development only. All 10 existing migration checksums, successful Prisma ledger rows and schema inventory independently match the reviewed local database; application tables initially empty. Hosted preview `dpl_2WVRZQRDFQaYq9Gtu3b4NWCn3GJk` is actually READY at https://dripwell-ai-preview-loyd-1222s-projects.vercel.app. Stable alias matches trusted APP_URL. Independently verified staging source equals reviewed `d4239d5` except preview-only `crons=[]`. Production repo schedule is unchanged. Next and eve remote builds pass; prior outputs were rejected by Hobby cron limit. Production reminder/recovery every 15 minutes requires Pro. Stripe requires Owner browser terms acceptance; verified Resend sender/domain and actual recurring platform price are pending. Hosted owner registration/session/database/dashboard and unauthenticated role gates passed. Eve health is ready. Setup chat POST returned 500 before creating conversation/job because `$queryRaw SELECT pg_advisory_xact_lock` materializes PostgreSQL void; the same source pattern affects platform referral-policy publication. Auditor reproduced P2010 on actual PG17. Both calls now use parameterized `$executeRaw`, preserving lock keys/transaction boundaries. Four real-PG operation regressions and web TypeScript pass, with independent patch Auditor PASS. Publish and redeploy this reviewed repair, then repeat real setup transport. No end-to-end AI, production launch or complete provider delivery is claimed yet.

## Deliverables

- PRD.md: v2 requirements, six exact Kanban triggers, archive, 14-day/10-consultation trial, owner-only improvement.
- docs/IMPLEMENTATION_PLAN.md: source-verified eve layout, preserved project context conventions, migration/work packages/validation.
- docs/archive/PRD-v1.md and STATE-v1.md: preserved historical requirements/state.
- README.md and PROJECT_CONTEXT.md distinguish actual runtime from target architecture.
- Complete source retained on `feat/dripwell-consultation-v2`; main and the existing v1 deployment were not silently switched.
- Published implementation: [PR #2](https://github.com/loydhale/dripwell-ai/pull/2), source commit `7dd6a26e1b407cad1b06f924e49e651d97875998`. The earlier documentation-only PR #1 is closed as superseded. [Fresh GitHub CI](https://github.com/loydhale/dripwell-ai/actions/runs/36940044025) PASS, including frozen install, all migrations, Next/eve builds, TypeScript and 75 checks.
- docs/AUDIT_V2.md: independent source/local-runtime PASS; docs/VERIFICATION_REPORT.md and PREVIEW.md: exact checks, screenshots and live-service boundary; docs/DEPLOYMENT.md: real service/bootstrap/release steps.

## Next resume point

Retain the reviewed source and PR #2. Vercel login is now verified. Link the new dedicated project, provision isolated preview PostgreSQL/private Blob and provider services, configure trusted keys/origin, migrate and deploy a synthetic preview. Vercel has confirmed `cron_jobs_limits_reached` for the original 15-minute schedule, including previews. Preview is READY and the trusted alias is assigned. Complete the two advisory-lock source repairs and actual-PG operation regressions, obtain independent Auditor PASS, publish updated source/docs to PR #2, stage that exact new commit with preview-only `crons=[]`, redeploy and retain the stable alias. Recheck hosted setup/Eve, private storage and the real-data gate, then record exact results and blockers. Complete provider, billing, sharing and retention verification before production. Preserve protection and `ALLOW_REAL_CLIENT_DATA=false`. Do not resume the superseded photo-assessment queue or rerun passing source checks without new changes/failures.

Local verification is available at port 3000 via a production `next start` session with an explicitly fictional database. This is not a published Vercel application or a permanent hosted service. Private test bindings/authenticator material remain outside git.

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
