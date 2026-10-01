# STATE.md

## Current status

2026-10-01: Owner explicitly requested "get the software finished." V2 source and local runtime are complete and independently reviewed on `feat/dripwell-consultation-v2` at `/workspace/dripwell-build`, based on the reviewed documentation branch. CTO routed implementation to Coders and independent Auditor per AGENTS.md. Continuous mode remains OFF. Live launch is blocked by missing Vercel/provider access, not by an unresolved source finding.

Vercel Plugin guidance is available from the connector skill source `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`. Skills read include bootstrap, marketplace, nextjs, auth, storage, eve, Workflow and AI SDK; Coders read task-specific skills and installed documentation before framework code.

Implementation source is complete across domain/schema, Next.js/auth/PWA, clinic transactions/UI, owner improvement, eve/AI/Workflow, and billing/referrals/sharing/platform. Independent foundation audit PASS and combined audit PASS, attempt 2. All findings, including pending-evidence release, recording cleanup concurrency and runtime PDF font resolution, are repaired and independently rechecked. PRD implementation notes are Auditor co-signed and learning/changelog updated.

Verification: frozen lockfile install PASS, 10 migrations applied to isolated PostgreSQL 17, 75 canonical tests PASS with no skips, Prisma validation and TypeScript PASS, actual eve 0.69.0 and optimized Next 16.3.8 builds PASS. Chromium walkthrough verifies owner registration/MFA, fictional catalog/test/activation, guided manual intake, tracked adjustment/exact approval, synthetic care record, wellness generation/approval/acceptance, PDF download, archive/restore, owner evidence review and 390px mobile layout. Production-mode dashboard and authenticated PDF are verified; both document traces include their fonts. See `docs/VERIFICATION_REPORT.md` and `docs/PREVIEW.md`.

Live-service gap: Vercel connector lists no teams; CLI 62.1.0 reports logged out. Device authentication requested asynchronously from Owner. Managed runtime has no configured service secrets. Production provisioning and live release cannot be asserted until actual access is verified. Coders continue source/build/domain work without fake credentials or generated patient records.

## Deliverables

- PRD.md: v2 requirements, six exact Kanban triggers, archive, 14-day/10-consultation trial, owner-only improvement.
- docs/IMPLEMENTATION_PLAN.md: source-verified eve layout, preserved project context conventions, migration/work packages/validation.
- docs/archive/PRD-v1.md and STATE-v1.md: preserved historical requirements/state.
- README.md and PROJECT_CONTEXT.md distinguish actual runtime from target architecture.
- Complete source on `feat/dripwell-consultation-v2`, ready for its GitHub review PR; main and the existing v1 deployment were not silently switched.
- docs/AUDIT_V2.md: independent source/local-runtime PASS; docs/VERIFICATION_REPORT.md and PREVIEW.md: exact checks, screenshots and live-service boundary; docs/DEPLOYMENT.md: real service/bootstrap/release steps.

## Next resume point

Locate/publish the associated `feat/dripwell-consultation-v2` GitHub PR and retain the reviewed source. Recheck Vercel authentication after Owner completes the pending device sign-in, select the intended team, provision/link PostgreSQL/private Blob/Gateway/Workflow/eve/Stripe/Resend, migrate the intended database, and deploy a synthetic preview. Complete real provider, billing, sharing and retention checks before promotion. Last verified CLI status is logged out and connector teams empty; no live service verification is claimed. Do not resume the superseded photo-assessment queue or rerun passing source checks without new changes/failures.

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
