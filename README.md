# DripWell.ai

IV consultation recording, guided recommendations, staff review, and owner-controlled improvement.

## Product direction

[PRD v2](PRD.md) and the [implementation plan](docs/IMPLEMENTATION_PLAN.md) describe the owner-requested consultation workflow, exact Kanban triggers, shareable wellness documents, referrals, and 14-day trials with 10 initial consultations.

The application preserves the ICM project context/memory conventions and uses eve's authored agent layout beside the Next.js application. A separate owner-provided ICM example has not been supplied; the observed repository conventions remain authoritative.

**Implementation status:** v2 source includes clinic setup, consented recording and structured intake, catalog-grounded recommendations, tracked staff review, care and wellness outcomes, the six-stage board, owner improvements, trials/referrals, billing, and verified-recipient documents. Independent source/local-runtime audit PASS, all 93 current CI checks, Next/eve builds and synthetic production-mode browser/PDF checks are complete. Reviewed recording source `b61f6aa` is READY in the [protected Vercel preview](https://dripwell-ai-preview-loyd-1222s-projects.vercel.app) with isolated PostgreSQL/private Blob; its independent deployment review passed six targeted hosted checks. The earlier source's 19-case deployment audit is retained as historical evidence. Ordinary consultation language-model inference returned HTTP403 with no successful language-model response. A supported AI route honoring the Owner's ChatGPT subscription preference remains unresolved under current eligibility/terms; no paid credits or provider switch are authorized. Billing/email, production scheduling, service/data eligibility and the full two-clinic live-provider pilot remain release gates. Real-client intake stays disabled. See [verification evidence](docs/VERIFICATION_REPORT.md), [development state](memory/STATE.md) and [recording/deployment evidence](docs/AUDIT_RECORDING_CONTROLS.md).

[View the desktop and mobile screens](docs/PREVIEW.md), captured from a fictional verification clinic in the running application.

October3 commercial work adds the Owner-delegated USD199/account/month offer, explicit editable USD50 qualifying paid-referral draft, actual Stripe-price validation and safe versioned policy reload. Forty focused checks, five isolated database checks and a fresh production build passed, followed by independent compiled form/owner verification and owned cleanup with shared data preserved. Final exact closing publication is being reviewed. Stripe sandbox and the matching price have independent setup readback. The protected preview remains atb61f6aa pending reviewed deployment; actual billing/referral and the full pilot are still open. See [commercial configuration](docs/COMMERCIAL_CONFIGURATION.md), [current CLI eligibility review](docs/CHATGPT_CLI_ROUTE_REVIEW.md) and [remaining owner actions](docs/OWNER_SETUP_ACTIONS.md).

The [native recording follow-up](docs/AUDIT_RECORDING_CONTROLS.md) additionally found and repaired paused-duration and shell-navigation defects. Local synthetic capture/real 60-second rollover, desktop navigation/retry and targeted mobile warning/recording visibility passed independent review. Exact published-source CI passed all 93 checks without skips, and the reviewed 317-file preview stage passed protected deployment/runtime verification. [Actual local reminder evidence](docs/AUDIT_DURABLE_REMINDERS.md) demonstrates Workflow sleep/resume, persisted staff notifications, deduplication and reassignment. Saved runs recovered after explicit supported Local World initialization; a plain optimized Next restart did not resume them automatically. Ordinary consultation model output, email/billing, global recovery cadence and representative physical-device evidence retain separate gates.

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
