# DripWell.ai

IV consultation recording, guided recommendations, staff review, and owner-controlled improvement.

## Product direction

[PRD v2](PRD.md) and the [implementation plan](docs/IMPLEMENTATION_PLAN.md) describe the owner-requested consultation workflow, exact Kanban triggers, shareable wellness documents, referrals, and 14-day trials with 10 initial consultations.

The plan preserves the existing ICM project context/memory conventions and specifies eve's authored agent layout. The owner's separate ICM example still needs verification before scaffolding.

**Implementation status:** this repository currently runs the earlier Vite/Fastify assessment app. The documentation change does not implement the Next.js/eve migration or change deployment. See [development state](memory/STATE.md).

## Current development

Requires pnpm and Node.js 22+. The target eve runtime is Node.js 24, to be verified with pinned dependencies during migration.

```bash
pnpm install
pnpm dev
pnpm dev:api
pnpm dev:admin
pnpm build
pnpm typecheck
pnpm format
```

## Current layout

- apps/web/: Vite tablet PWA and landing page.
- apps/admin/: Vite admin panel.
- apps/api/: Fastify API.
- packages/shared/: shared types and Prisma schema.
- personas/, memory/, tasks/, templates/, workflows/: project development instructions, state, learning, and procedures.

The [target folder tree](docs/IMPLEMENTATION_PLAN.md#2-target-icmeve-folder-structure) places authored eve files in apps/web/agent/, evaluations beside that directory, and application Workflow code in apps/web/workflows/. Root memory/ remains development-only.

The previous [v1 PRD](docs/archive/PRD-v1.md) is retained for historical context.
