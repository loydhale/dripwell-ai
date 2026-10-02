# DripWell hosted-preview audit

Date: 2026-10-02. Source reviewed for the initial preview: `d4239d597368b58f9f0f4cfac8f6186e2e60473d`.

## Hosted runtime review, attempt 1

AUDIT: V2-HOSTED-PREVIEW
VERDICT: FAIL
ATTEMPT: 1

This review covers the actual isolated Vercel preview, its database migration, deployment controls, hosted authentication and eve transport. The previous source/local-runtime audit and 75 passing checks are not evidence of a completed live-provider journey.

FINDINGS:

- `apps/web/app/api/setup/route.ts:75`: Prisma `$queryRaw` attempts to deserialize the `void` result of `pg_advisory_xact_lock`. An authenticated synthetic setup POST returns HTTP 500 before creating a setup conversation or generation job. Exact-query reproduction using the installed Prisma 6.19.3 against the reviewed PostgreSQL 17 database returns P2010, “Failed to deserialize column of type 'void'.” Severity: blocking.
- `apps/web/lib/platform.ts:297`: Referral-policy publication uses the same unsupported advisory-lock query result. Acquire the transaction lock through an operation that does not deserialize `void`, and cover the actual publication operation against PostgreSQL. Hosted platform publication was not attempted because no platform administrator was bootstrapped. Severity: blocking.

REQUIRED_FIXES:

- Preserve both transaction-scoped advisory locks using a supported Prisma operation and verify the setup preflight/publication operations against actual PostgreSQL.
- Redeploy the reviewed patch and repeat the real synthetic owner setup request. Health/readiness responses alone do not establish successful model execution.

### Completed infrastructure checks

- The dedicated Vercel project is `dripwell-ai`, project ID `prj_fF0yFggYVFN9pI5dQN33glG2wPyW`, on `loyd-1222s-projects`. Its root is `apps/web`, with Node 24 and workspace files enabled.
- Deployment `dpl_2WVRZQRDFQaYq9Gtu3b4NWCn3GJk` reached actual **READY**, target preview. Next.js and eve service builds completed, including actual sandbox initialization. Its stable protected alias is <https://dripwell-ai-preview-loyd-1222s-projects.vercel.app>, matching `APP_URL`.
- The Hobby plan rejected the authored 15-minute cron schedule, including preview submissions. A private `--local-config` override alone did not remove the authored cron from the assembled output. The successful preview used an isolated source archive: all 293 tracked files were compared directly with the source Git blobs; the sole changed file was `apps/web/vercel.json`, and its sole semantic change was `crons: []`. The only extra file was the identical nonsecret project link. No environment files were present in that stage. The repository's production cadence remains unchanged.
- Neon and private Blob resources are connected to preview/development only. The real-client-data flag remains false and deployment protection remains enabled.
- Ten migrations were applied to a confirmed empty Neon database through its supported HTTPS SQL transport after native Prisma connectivity from the coding environment failed. Migration SQL bytes were unchanged; each migration and its successful Prisma ledger update committed in one atomic batch, without automatic mutation retries.
- Independent read-only verification confirms all ten source SHA-256 checksums, finished ledger entries, one successful step each, 50 public tables and exact agreement with the reviewed PostgreSQL 17 schema: 560 columns, 160 primary/foreign/check constraints, 204 indexes and all enum values. PostgreSQL 18's additional explicit NOT NULL constraint rows are excluded from the constraint representation while column nullability is compared directly. All 49 application tables were empty before hosted verification.

### Completed hosted checks

Requests used Vercel's authenticated protection bypass; protection was not disabled. Browser state and credentials remain in private files outside Git.

- Unauthenticated application identity, clinic, platform, setup and cron endpoints deny access with HTTP 401. Eve's public health endpoint returns HTTP 200 with `status: ready`; its protected info endpoint returns HTTP 401.
- A clearly fictional owner registered through the hosted API with HTTP 201. Its database-backed session returns HTTP 200, owner role, no clinical approval authority and no MFA enrollment. The real clinic dashboard and location-bound setup GET return HTTP 200. Owner access to platform administration returns HTTP 403.
- The actual trial is 14 days with ten starts and zero used. The dashboard disallows new starts. A start request without an activated configuration returns HTTP 422; no consultation was created. This checks the earlier setup prerequisite, not independent passage through the subsequent client-data gate.
- `/api/health` returns HTTP 503 `configuration-required` because billing/email configuration remains incomplete. It does not independently establish database unreachability; successful hosted registration/session/dashboard operations prove database access separately.
- Chromium opens the authenticated hosted dashboard with its six columns and disabled new-consultation action. There is visible content, no framework overlay, no browser JavaScript error and no ordinary localStorage entry. At a 390-pixel viewport, body width is 390 pixels. See [hosted mobile evidence](previews/hosted-mobile-dashboard.png).
- The installed Blob 2.8.0 SDK uploaded a tiny synthetic nonclinical text object to the real private store. Anonymous read returned HTTP 403; authenticated read returned HTTP 200 with exact expected bytes. The object was deleted in `finally`, and an uncached authenticated read then confirmed absence. Initial coding-environment Node requests timed out because they did not use the required HTTP proxy; Node 24 `--use-env-proxy` resolved transport without disabling TLS validation. A prefix inventory confirmed zero objects before retry. No clinical intake was used for this provider check.

PATTERN_VIOLATIONS: Prisma result typing at the two advisory-lock boundaries.
GOTCHA_HITS: Hobby cron limitations apply during preview assembly; nested authored configuration can survive a submission override.
PRD_AUDIT: pass for scope. The findings prevent the F-01 conversational-setup journey from passing hosted verification. No PRD expansion is proposed.

## Advisory-lock patch review

The focused source repair passes independent review. Both changes replace `$queryRaw` with `$executeRaw` while preserving the exact SQL, lock keys and transaction boundaries. The Prisma operation no longer attempts to deserialize the unused PostgreSQL `void` value.

Four new behavioral regressions passed independently against the isolated actual PostgreSQL 17 verification database, with no skips: authenticated setup creation and completed replay/conflict; an in-flight replay that retains one conversation/job; MFA-authorized platform publication, clearing and historical-version rejection; and concurrent publications producing one success, one conflict and one audit record. Database, current authority, location and rate-limit operations are real; only the external eve transport and framework cookie boundary are mocked. The suite rejects an unrelated database and adds no dependency. The Coder's web TypeScript check also passed.

This is a scoped source PASS for the two findings. A reviewed rebuilt preview and repeat real owner setup request are still required before the hosted-runtime verdict can change.

## Remaining release gates

This is a protected synthetic preview, not a production release or permission to process real client data. Production needs the supported reminder/recovery cadence, provider/data-path review and appropriate service agreements, live recording/transcription/model workflow checks, retention/deletion checks, a chosen platform administrator and representative-device verification. Stripe requires the account owner's integration terms/account connection, actual recurring price and signed webhook verification. Resend requires the actual verified sender/domain and recipient-code delivery verification. Referral-credit terms must be explicitly configured rather than invented. No actual purchases, recipient emails, clinical encounters or real-client data were used in this review.

Guidance reviewed: Vercel Plugin deployment, CLI, storage, eve and browser-verification skills, plus the installed eve 0.69.0 deployment/Next.js/authentication documentation and Blob 2.8.0 SDK types. Neon batching matches its official noninteractive transaction protocol.
