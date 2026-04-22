# TASK-001 — Scaffold monorepo, set up tooling, create project skeleton

```
TASK_ID: TASK-001
TITLE: Scaffold monorepo, set up tooling, create project skeleton
PARENT_REQUEST: Loyd approved PRD v1.0. Need project scaffold before any feature work.

GOAL (one sentence):
Set up the complete monorepo structure with all tooling (TypeScript, pnpm, ESLint, Prettier) so the team can immediately start building features.

SCOPE:
In scope:
- Set up pnpm workspace monorepo (pnpm-workspace.yaml)
- apps/web: PWA scaffold (Vite + TypeScript + vanilla/TS, no heavy framework for v1)
- apps/admin: Desktop admin panel scaffold (Vite + TypeScript)
- packages/shared: shared types, utils, constants (TypeScript library)
- Root: TypeScript config, ESLint, Prettier, .editorconfig
- Configure build scripts for all packages
- Set up Prisma client package (shared types + schema location)
- Create basic directory structure within each app/package
- Add READMEs for each app/package explaining its purpose
- Install core dependencies (Fastify for future backend, though backend scaffold is TASK-004)

Out of scope (do NOT do these even if tempting):
- Do NOT build any actual UI pages (that's TASK-002)
- Do NOT write any backend API routes (that's TASK-004)
- Do NOT set up database or run migrations (that's TASK-003)
- Do NOT configure production deployment
- Do NOT add testing framework yet (add when first test-worthy code exists)

FILES LIKELY INVOLVED:
- pnpm-workspace.yaml — workspace definition
- package.json (root) — workspace root config
- tsconfig.json (root + packages) — TypeScript configuration
- apps/web/package.json — PWA dependencies (Vite, workbox for PWA)
- apps/web/vite.config.ts — Vite + PWA configuration
- apps/web/tsconfig.json — web app TypeScript config
- apps/web/src/main.ts — entry point
- apps/web/index.html — HTML entry
- apps/web/manifest.json — PWA manifest
- apps/web/sw.ts — service worker (basic scaffold)
- apps/admin/package.json — admin dependencies
- apps/admin/vite.config.ts — admin build config
- apps/admin/tsconfig.json — admin TypeScript config
- apps/admin/src/main.ts — admin entry
- apps/admin/index.html — admin HTML
- packages/shared/package.json — shared package config
- packages/shared/tsconfig.json — shared TypeScript config
- packages/shared/src/index.ts — shared exports
- .eslintrc.cjs — lint config
- .prettierrc — format config
- .editorconfig — editor consistency

RELEVANT MEMORY ENTRIES:
- PRD: Stack decisions — Node.js + TypeScript, PWA, PostgreSQL + Prisma
- PRD: F-13 — Landing page will be built in apps/web
- PRD: Anonymous patient model — no PII, photos never stored locally

ACCEPTANCE CRITERIA (Auditor will check these):
- [ ] `pnpm install` runs successfully from root
- [ ] `pnpm dev` starts web app (apps/web) on localhost
- [ ] `pnpm dev:admin` starts admin app on localhost
- [ ] `pnpm build` builds all packages without errors
- [ ] PWA manifest is valid and registerable (check via Chrome DevTools)
- [ ] Service worker scaffold present (can be empty, just needs registration setup)
- [ ] TypeScript compiles in all packages with `tsc --noEmit`
- [ ] Shared package exports at least one type (e.g., TenantId type)
- [ ] Directory structure matches monorepo convention
- [ ] README at root explains how to run dev and build

NOTES / HINTS:
- Keep it lightweight. Vite is the right choice for both web and admin — fast dev, good PWA support.
- For PWA: use vite-plugin-pwa (workbox-based). Don't over-engineer the service worker yet.
- The landing.html from Loyd's files is in apps/web/landing.html — don't overwrite it, we'll convert it in TASK-002.
- Use pnpm catalog feature for shared dependency versions.
- Consider turborepo for task orchestration, but only if it doesn't add complexity. Plain pnpm scripts are fine for v1.
- The project is at: /Users/loydhale/.openclaw/workspace/openclaw-cto/projects/dripwell-ai/
```
