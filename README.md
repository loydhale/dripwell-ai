# DripWell.ai

IV consultation recording, guided recommendations, staff review, and owner-controlled improvement.

## Product direction

[PRD v2](PRD.md) and the [implementation plan](docs/IMPLEMENTATION_PLAN.md) describe the owner-requested consultation workflow, exact Kanban triggers, shareable wellness documents, referrals, and 14-day trials with 10 initial consultations.

The application preserves the ICM project context/memory conventions and uses eve's authored agent layout beside the Next.js application. A separate owner-provided ICM example has not been supplied; the observed repository conventions remain authoritative.

**Implementation status:** v2 source includes clinic setup, consented recording and structured intake, catalog-grounded recommendations, tracked staff review, care and wellness outcomes, the six-stage board, owner improvements, trials/referrals, billing, and verified-recipient documents. Reviewed application `80729f2f` passed181 CI tests with no skips, schema/types and Next/eve builds. It is READY in the [protected Vercel preview](https://dripwell-ai-preview-loyd-1222s-projects.vercel.app); the independent [commercial preview audit](docs/AUDIT_PROTECTED_COMMERCIAL_PREVIEW.md) verifies exact source/stage, both remote native-runtime bundles, protection and the stable alias. The earlier retained-owner authentication check remains PARTIAL: its expired app cookie was omitted by the normal client and the app returned401. The existing coding CLI is already signed in using ChatGPT; that login does not establish hosted app eligibility. Initial and wellness matching and explanations use deterministic clinic rules. Setup assistant/catalog extraction and structured consultation summaries require the selected language model, whose hosted route retains its documented HTTP403 and no successful language response. Billing/email, global scheduling, service/data eligibility and the full two-clinic pilot remain release gates. Keep `ALLOW_REAL_CLIENT_DATA=false`. See [verification evidence](docs/VERIFICATION_REPORT.md) and [development state](memory/STATE.md).

[Actual normal owner signup and settings](docs/AUDIT_NORMAL_OWNER_COMMERCIAL_SETTINGS.md) passed the deployed USD199 offer and14-day/10-start trial display. The original cookie-result collector failure is retained; a reviewed new-context correction completed the actual screen. Exact compensation restored all50tables and the registration-rate state, closed both browser contexts and removed three owned inputs. This verifies onboarding and commercial presentation, with checkout still unavailable. Two-clinic inactive draft/test persistence, required questions, own-clinic UI and explicit cross-clinic404 checks have actual independent API/UI PASS. Independent exact cleanup restored the original50-table/32-row and seven-rate baseline, removed both fictional owners and four temporary inputs, and confirmed both contexts inactive. See [the two-clinic audit](docs/AUDIT_TWO_CLINIC_SETUP.md).

[View the desktop and mobile screens](docs/PREVIEW.md), captured from a fictional verification clinic in the running application.

The Owner-delegated platform offer is USD199 per clinic account/month, with an explicit editable USD50 qualifying paid-referral draft. The [commercial configuration](docs/COMMERCIAL_CONFIGURATION.md) preserves versioned policy history and trial terms. The [retained-price repair](docs/AUDIT_BILLING_PRICE_HISTORY.md) independently passed40 new unit and6 actual-PostgreSQL cases; actual source807 CI passed181 tests with zero skips. Exact owned cleanup preserved shared data. Stripe sandbox and its matching test price have independent setup readback, but policy activation, checkout/payment and paid-referral evidence remain separate. Current [CLI eligibility](docs/CHATGPT_CLI_ROUTE_REVIEW.md) and [owner setup actions](docs/OWNER_SETUP_ACTIONS.md) identify the remaining service gates. The14-day/10-consultation trial does not automatically enroll into paid billing.

The historical [native recording follow-up](docs/AUDIT_RECORDING_CONTROLS.md) additionally found and repaired paused-duration and shell-navigation defects. Local synthetic capture/real 60-second rollover, desktop navigation/retry and targeted mobile warning/recording visibility passed independent review. That historical recording source passed93 checks without skips and its317-file stage/runtime review; the current807 deployment and181-test CI are recorded above. [Actual local reminder evidence](docs/AUDIT_DURABLE_REMINDERS.md) demonstrates Workflow sleep/resume, persisted staff notifications, deduplication and reassignment. Saved runs recovered after explicit supported Local World initialization; a plain optimized Next restart did not resume them automatically. Ordinary consultation model output, email/billing, global recovery cadence and representative physical-device evidence retain separate gates.

[Native owner setup voice](docs/AUDIT_NATIVE_SETUP_VOICE.md) passed one actual protected browser capture/upload, selected-model transcription, completion callback and unsent composer correction. The partial/inaccurate transcript requires review; optional provider cost/duration metrics remain null. Its owned audio was removed while preserving the addressable result and prior records. [Hosted per-visit timer verification](docs/AUDIT_HOSTED_REMINDER_TIMER.md) now passes the actual future-wait capture before browser closure, natural same-run resume, correctly scoped staff notification, ordinary private/no-store inbox and exact nine-row cleanup with prior records preserved. The [first](docs/AUDIT_HOSTED_REMINDER.md) and [second](docs/AUDIT_HOSTED_REMINDER_CAPTURE.md) cases retain their original partial evidence; their missing captures are not replaced retrospectively. Per-visit Workflow delivery is verified separately from the still-required global recovery/retention cadence. The full two-clinic pilot remains incomplete.

[Compiled recovery evidence](docs/AUDIT_CRON_RECOVERY.md) additionally verifies unauthorized requests preserve every table and one authorized request performs reminder, interrupted-record and expired-authentication cleanup. The test used a fresh owned database, preserved all50 shared table digests and cleaned its resources. Storage was deliberately unavailable in that check. [Selected-store retention](docs/AUDIT_BLOB_RETENTION.md) subsequently proved the compiled endpoint physically deletes an expired synthetic object and clears its stored path while preserving an unexpired control. Both owned objects and the fresh test database/server were cleaned; hosted scheduling and broader retention-policy eligibility remain open.

## Current development

Use Node.js 24 and pnpm 10.32.1. The committed lockfile pins the framework versions. Provision the actual services and follow [deployment guidance](docs/DEPLOYMENT.md); credentials belong in the linked environment, never in source.

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @dripwell/shared build
pnpm dev
pnpm build
pnpm typecheck
pnpm --filter @dripwell/shared test
pnpm --filter @dripwell/web test
```

## Current layout

- apps/web/: Next.js PWA, same-origin API, accounts, clinic/owner/platform screens.
- apps/web/agent/: authored eve setup agent, scoped tools, instructions and approved-context memory.
- apps/web/workflows/: application transcription, summary and reminder workflows.
- apps/web/evals/: extraction and audio validation checks.
- packages/shared/: browser-safe domain contracts/rules/pricing and additive Prisma schema/migrations.
- legacy/web/: retained v1 Vite source; apps/admin/ and apps/api/ remain legacy references.
- personas/, memory/, tasks/, templates/, workflows/: project development instructions, state, learning, and procedures.

Root memory/ and development workflows/ remain development-only. The application agent cannot change active clinic rules; an owner reviews, tests and activates immutable configuration versions. All clinical products and prices must come from the clinic's validated configuration, not demonstration protocols.

The previous [v1 PRD](docs/archive/PRD-v1.md) is retained for historical context.
