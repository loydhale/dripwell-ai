# PROJECT_CONTEXT.md

## Project

DripWell.ai, owned by Loyd Hale.

## Authorized product direction

Consultation-centered IV clinic PWA: consented recording, visible question guidance, location-catalog recommendations, tracked staff edits, provider approval, actual care outcomes, post-treatment wellness documents, the specified six-stage board, owner-controlled improvements, referrals, and 14-day trials including 10 initial consultations. See PRD.md.

## Observed implementation

- Language: TypeScript.
- Runtime: Node.js >=22 in existing package.json.
- Package manager: pnpm workspaces.
- Frontend: Vite PWA in apps/web/; Vite admin in apps/admin/.
- Backend: Fastify in apps/api/.
- Database: PostgreSQL/Prisma contracts under packages/shared/prisma/.
- v2 migration, deployment service configuration, and installed framework compatibility are not implemented or verified in this documentation task.

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
