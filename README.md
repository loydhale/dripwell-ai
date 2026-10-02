# DripWell.ai

IV consultation recording, guided recommendations, staff review, and owner-controlled improvement.

## Product direction

[PRD v2](PRD.md) and the [implementation plan](docs/IMPLEMENTATION_PLAN.md) describe the owner-requested consultation workflow, exact Kanban triggers, shareable wellness documents, referrals, and 14-day trials with 10 initial consultations.

The application preserves the ICM project context/memory conventions and uses eve's authored agent layout beside the Next.js application. A separate owner-provided ICM example has not been supplied; the observed repository conventions remain authoritative.

**Implementation status:** v2 source includes clinic setup, consented recording and structured intake, catalog-grounded recommendations, tracked staff review, care and wellness outcomes, the six-stage board, owner improvements, trials/referrals, billing, and verified-recipient documents. Independent source/local-runtime audit PASS, all 79 checks, Next/eve builds and production-mode browser/PDF checks are complete. A [protected Vercel preview](https://dripwell-ai-preview-loyd-1222s-projects.vercel.app) is READY with isolated PostgreSQL/private Blob and verified hosted authentication. Actual AI inference is blocked by the account's free-tier model restriction until paid Gateway credits are added. Billing/email, production scheduling and real-client data eligibility remain release gates. See [verification evidence](docs/VERIFICATION_REPORT.md), [development state](memory/STATE.md) and [audit evidence](docs/AUDIT_V2.md).

[View the desktop and mobile screens](docs/PREVIEW.md), captured from a fictional verification clinic in the running application.

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
