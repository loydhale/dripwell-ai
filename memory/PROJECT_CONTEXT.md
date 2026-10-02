# PROJECT_CONTEXT.md

## Project

DripWell.ai, owned by Loyd Hale.

## Authorized product direction

Consultation-centered IV clinic PWA: consented recording, visible question guidance, location-catalog recommendations, tracked staff edits, provider approval, actual care outcomes, post-treatment wellness documents, the specified six-stage board, owner-controlled improvements, referrals, and 14-day trials including 10 initial consultations. See PRD.md.

## Implemented v2 and hosted verification, 2026-10-02

Owner authorized completing v2. The active build workspace is `/workspace/dripwell-build` on `feat/dripwell-consultation-v2`, based on the reviewed v2 documentation. Next.js replaces the deployed web entry point; same-origin route handlers use the existing Prisma identity/schema with additive v2 records. Opaque server-side cookie sessions replace the old browser JWT storage for the v2 app. The Vercel Next.js SaaS Starter at `6e33e58b1e553a41fe22e6b941a7229a002de361` is inspected as a dashboard/team/billing reference, keeping one ORM.

Installed framework versions reported by foundation: Next.js 16.3.8, React 19.3.0, AI SDK 7.0.127, eve 0.69.0, Workflow 5.0.1, Prisma CLI 6.19.3. The committed pnpm lock is authoritative; versions and compatibility require final build checks. Use `npx --yes pnpm@10.32.1` in this execution environment because the bare pnpm shim may attempt an unintended auto-install.

Vercel CLI authentication is verified as `loyd-1222`, team `loyd-1222s-projects`, on 2026-10-02. Dedicated `dripwell-ai` project uses `apps/web` and Node24. Separate Neon PostgreSQL18.6 preview and private Blob resources connect to preview/development only; all ten reviewed migrations and exact schema/ledger were independently verified over supported HTTPS and were not reapplied. A separate local PostgreSQL17 database remains synthetic verification only. Reviewed recording source b61f6aa passed93checks/types/both builds and exact317-file stage review; protected preview dpl_232QhM74EuWYYnq1vSfAEaqNDo57 independently passed READY/source/tree/alias/build and six targeted hosted reads with unchanged false gate/zero clinical counts. CI's native guard covers one bundle, normal remote build covers two. Earlier registration/sessions/database/private Blob/Eve and19-case archive/job checks remain scoped historical proof. TASK-028 demonstrates actual local Workflow sleep/resume, persisted staff inbox delivery, deduplication and current-state handling. Five retained runs recovered after explicit supported Local World initialization; a plain optimized Next restart did not automatically initialize recovery. Local World is development-only, so this does not establish hosted scheduling. Gateway inference returned HTTP403 account restriction with no actual model response; the Owner's supported ChatGPT-subscription preference remains unresolved. Production15-minute reminder/recovery scheduling requires a supported plan; Stripe terms and verified Resend sender are pending. Production secrets must come from the linked service environment. No fallback test credentials or fabricated AI outputs may be used for the deployed product.

TASK-030 independently passed actual compiled cron authentication/database recovery on a fresh schema-only owned target:401/401 preserve all50 tables, one valid200 changes exactly6 expected tables and preserves44 controls. All50 shared digests/container remain intact after target/server/profile cleanup. P-015 records safe global-maintenance isolation. Storage was deliberately unavailable in030. TASK-031 independently verifies actual compiled deletion of one expired tiny nonclinical object in the already-selected private Blob store, with unchanged unexpired bytes/metadata and all other49 table digests. Only owned control/server/fresh target/profile were cleaned and all50 shared digests/container preserved. No hosted scheduling, successful capture/transcription or full transcript/document/backup/service-policy completion is inferred; those retain explicit external gates.

## Legacy implementation retained during migration

- Language: TypeScript.
- Runtime: Node.js >=22 in existing package.json.
- Package manager: pnpm workspaces.
- Frontend: Vite PWA in apps/web/; Vite admin in apps/admin/.
- Backend: Fastify in apps/api/.
- Database: PostgreSQL/Prisma contracts under packages/shared/prisma/.
- These legacy applications remain available as source references; they are not the v2 deployment entry point. V2 source/local verification has passed. An isolated hosted preview is READY; hosted AI/provider verification and production release gates are tracked in STATE and docs/AUDIT_DEPLOYMENT.md.

## Target architecture

Next.js PWA on Vercel using a suitable SaaS starter, eve, AI SDK, Workflow, PostgreSQL and private artifacts. Target Node.js 24; pin compatible versions and retain one ORM/identity model during foundation work.

## Latest service preference, 2026-10-02

Owner prefers their ChatGPT subscription over purchasing Gateway credits, authorized Stripe and chose Resend. Current official SIWC now supports eligible subscription usage in participating apps; commercial hosted access is partner-gated, and published terms prohibit one subscriber funding another user. Its flow excludes transcription. See docs/CHATGPT_PLAN_ASSESSMENT.md. No provider switch or spending occurred. Stripe retry remains browser-terms blocked; Resend requires the Owner's sending domain. Reminders are the requested missing-outcome/TBD staff notifications; the current 15-minute schedule exceeds Hobby limits.

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
- Implementation is published in PR #2 on the reviewable v2 branch. The hosted synthetic preview is separate from production; main and the earlier production deployment are not switched.

## References

- OpenScribe: loydhale/openscribe-scribe-template- at dddf1c30fcf8313e4452915ddd9189baa5a3762b.
- eve project structure: official source at ac77188ad0bd16edd20a590ec93e2d26306b9bd0.
- Candidate SaaS shell: nextjs/saas-starter; tenant-routing reference: vercel/platforms.
