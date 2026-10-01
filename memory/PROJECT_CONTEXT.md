# PROJECT_CONTEXT.md

## Project

DripWell.ai, owned by Loyd Hale.

## Authorized product direction

Consultation-centered IV clinic PWA: consented recording, visible question guidance, location-catalog recommendations, tracked staff edits, provider approval, actual care outcomes, post-treatment wellness documents, the specified six-stage board, owner-controlled improvements, referrals, and 14-day trials including 10 initial consultations. See PRD.md.

## Implementation migration in progress, 2026-10-01

Owner authorized completing v2. The active build workspace is `/workspace/dripwell-build` on `feat/dripwell-consultation-v2`, based on the reviewed v2 documentation. Next.js replaces the deployed web entry point; same-origin route handlers use the existing Prisma identity/schema with additive v2 records. Opaque server-side cookie sessions replace the old browser JWT storage for the v2 app. The Vercel Next.js SaaS Starter at `6e33e58b1e553a41fe22e6b941a7229a002de361` is inspected as a dashboard/team/billing reference, keeping one ORM.

Installed framework versions reported by foundation: Next.js 16.3.8, React 19.3.0, AI SDK 7.0.127, eve 0.69.0, Workflow 5.0.1, Prisma CLI 6.19.3. The committed pnpm lock is authoritative; versions and compatibility require final build checks. Use `npx --yes pnpm@10.32.1` in this execution environment because the bare pnpm shim may attempt an unintended auto-install.

Vercel CLI is logged out and connector access returned no teams; live services are not provisioned here. A separate real PostgreSQL 17 database is for synthetic verification only. Production secrets must come from the actual linked service environment. No fallback test credentials or fabricated AI outputs may be used for the deployed product.

## Legacy implementation retained during migration

- Language: TypeScript.
- Runtime: Node.js >=22 in existing package.json.
- Package manager: pnpm workspaces.
- Frontend: Vite PWA in apps/web/; Vite admin in apps/admin/.
- Backend: Fastify in apps/api/.
- Database: PostgreSQL/Prisma contracts under packages/shared/prisma/.
- These legacy applications remain available as source references; they are not the v2 deployment entry point. V2 source implementation and verification are in progress, and live deployment has not been verified.

## Target architecture

Next.js PWA on Vercel using a suitable SaaS starter, eve, AI SDK, Workflow, PostgreSQL and private artifacts. Target Node.js 24; pin compatible versions and retain one ORM/identity model during foundation work.

## Standing development preference

Owner confirmed use of the open-source Vercel Plugin for coding. Verify available plugin skills/source, load relevant framework guidance for implementation and review, and use current installed documentation. Keep the existing coding assistant and team roles; hosted Vercel Agent is not required. Plugin guidance is development tooling; eve is the application runtime.

## ICM/eve structure

Keep AGENTS.md, personas/, memory/, tasks/, templates/, and root development workflows/. The separate owner-provided ICM example is unconfirmed; exact mapping must be checked before scaffolding.

Authored eve files target apps/web/agent/ with instructions/, channels/, skills/, tools/, and read-only approved-context memory/. Evals target apps/web/evals/. Application Workflow code targets apps/web/workflows/, separate from root development workflows/. See docs/IMPLEMENTATION_PLAN.md.

## Conventions and constraints

- Tenant/role derived from verified server identity; owner-only improvement publishing.
- Database configuration/version history is authoritative; conversation memory cannot publish policies.
- Repository memory contains no client data. PHI requires appropriate service agreements, controls, retention/deletion, and restricted traces.
- Prices are official owner data; existing schema lacks a price field and needs audited migration.
- Test consultations never count toward trial or conversion reporting.
- Documentation is published as a reviewable branch/PR; production/runtime remains unchanged.

## References

- OpenScribe: loydhale/openscribe-scribe-template- at dddf1c30fcf8313e4452915ddd9189baa5a3762b.
- eve project structure: official source at ac77188ad0bd16edd20a590ec93e2d26306b9bd0.
- Candidate SaaS shell: nextjs/saas-starter; tenant-routing reference: vercel/platforms.
