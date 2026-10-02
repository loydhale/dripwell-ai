# DripWell v2 verification evidence

Updated: 2026-10-02. Branch: `feat/dripwell-consultation-v2`.

Verification uses an isolated PostgreSQL 17 database and an explicitly fictional clinic. No patient data, real treatment, customer purchase, or live provider charge was used. Test environment bindings and authenticator material remain outside the repository.

## Current evidence, 2026-10-02

### Recording follow-up, source publication pending

[TASK-025's independent native-browser audit](AUDIT_RECORDING_CONTROLS.md) found and routed two previously untested source defects: paused time inflated uploaded audio duration, and unguarded shell links could unmount capture without preserving a failed segment's retry UI. TASK-026 now gives each segment a monotonic active-time budget; six focused regressions, shared/web types and the optimized Next build passed. Native Chromium capture measured 4,148 ms outgoing duration versus 4,121 ms active capture across 14,522 ms wall time. Paused stop, unchanged retry bytes/metadata and a real 60-second rollover after repeated resumes passed without an accelerated clock.

TASK-029 applies the existing captureBusy guard to all three shell Link paths and closes presentation overlays when navigation is blocked. Desktop checks passed active, paused, pending and failed-local navigation, keyboard/sidebar behavior, immutable retry and correct idle destinations. Targeted 390x844 mobile checks passed active notification/menu-wordmark visibility, paused notification and failed-local warning/retry; pending behavior was established on desktop and was not separately repeated on mobile. Warning screenshots and center hit-tests agreed. Native permission denial passed; missing-API/device and interruption branches used explicitly disclosed event/API injection. The browser's microphone produced native synthetic audio; its recording POST was deliberately intercepted before transport. This establishes capture controls and failure/recovery UI, not successful upload, transcription, model response or physical iPad behavior. Owned browser/server/fixtures were cleaned, with zero remaining tenant/recording/job/trial rows.

These reviewed local repairs still require exact publication, fresh successful source CI and TASK-027 protected-preview verification. The currently deployed source/87-check baseline below remains unchanged until that operation succeeds. TASK-028's actual local Workflow sleep/resume/in-app reminder proof is separately queued and independent of provider accounts; the authored hosted 15-minute schedule remains unavailable on Hobby. Protection and ALLOW_REAL_CLIENT_DATA=false stay intact.

### Retained deployed baseline

Reviewed deployed source `5307fdafd49aea4ddc7a884b9d6e1e03881ef886` passed [fresh CI](https://github.com/loydhale/dripwell-ai/actions/runs/37011323655), including 87 checks with zero skips: 23 domain, 8 authentication, 15 clinic, 11 AI-boundary and 30 unit checks. All 10 isolated CI migrations, types, frozen installation and both builds passed. The earlier `0b97022` run failed its new disposable-database guard; the independently reviewed TASK-024 repair accepts the documented local/CI targets and rejects unintended databases. That failed stage was never deployed.

The protected Vercel preview is READY at [the stable URL](https://dripwell-ai-preview-loyd-1222s-projects.vercel.app), deployment `dpl_2Df4RLG6e8agmaAbNPWA2Kwm3SJq`, source `5307fda`. Independent stage comparison matched all 308 tracked files directly against immutable Git blobs and file modes, allowing only preview `crons=[]` and the identical nonsecret project link. Isolated Neon PostgreSQL and private Blob remain connected to preview/development only; the already-verified hosted migrations were not reapplied. [Independent deployment review](AUDIT_CONTINUOUS_DEPLOYMENT.md) passed exact READY/alias/source/tree, normal Sandbox initialization, the native guard in both Eve bundles and all 19 bounded HTTP cases. Authenticated owner/workspace, empty archive paging/validation/scope, retained FAILED job nonresults, saved setup and bound/unbound Eve access passed with private/no-store responses. The two failed jobs' whole-row digests and zero consultation/configuration/trial-use counts were unchanged; usage remains null. Only the existing fictional account's expired login was refreshed. No model request or clinical write occurred.

Both source repairs are included: scoped server-backed archive search/pages reach retained records older than one year/beyond 250, and addressable jobs expose saved successful results consistently for historical/current completion statuses. Independent actual-PostgreSQL and optimized-browser archive checks cover pagination, retry/stale responses, scope boundaries and actual restore. Six real-handler/poller regressions cover completed results, unfinished/failed/cancelled state, upload-pointer suppression and existing authority. The full owner improvement proposal/test/activation/rollback lifecycle also passed against isolated fictional records: both earlier visits and their approved prices/artifacts remained byte-equivalent, role/clinical/MFA denials passed, and zero provider requests occurred. [Repair evidence](AUDIT_CONTINUOUS_REPAIRS.md) records these scoped results.

Earlier hosted registration/session/database, role gates, private Blob, mobile layout and authenticated Eve/Workflow transport passed at `90b0565`; exact historical evidence is in [AUDIT_DEPLOYMENT.md](AUDIT_DEPLOYMENT.md). These passing checks were not repeated without a relevant change.

Successful completion aliases and populated archive traversal are supported by actual-PG/local-browser/CI evidence, not newly created hosted successes. The bounded deployment PASS does not finish the full two-clinic live-provider pilot or establish preview cron delivery.

Actual hosted model inference remains blocked by Gateway account entitlement: HTTP403 for the configured model, no provider attempt and no completed response. Stripe account terms, a verified Resend sender/domain, platform price/referral terms, supported production scheduling, selected platform administrator/MFA and the full live synthetic story remain open. The Owner prefers supported ChatGPT subscription use; [current SIWC eligibility and limitations](CHATGPT_PLAN_ASSESSMENT.md) are recorded. Protection and `ALLOW_REAL_CLIENT_DATA=false` remain enabled.

The Owner enabled continuous work until verified completion. [TASK-019's independent matrix](CONTINUOUS_GAP_REVIEW.md) maps all approved features and pilot criteria; its two reproduced defects are repaired and the integrated local owner lifecycle is verified. [STATE](../memory/STATE.md) retains the task outcomes and remaining gates. The enabled hourly continuation is saved in [the work contract](CONTINUOUS_WORK.md); its first delivered continuation reconciled the actual active workers and continued the same pass. Neither source implementation nor scheduling establishes full pilot completion.

The sections below preserve the initial 2026-10-01 local evidence. Later account connection and deployment evidence above supersede the initial absence of live bindings.

## Automated verification

On 2026-10-01, the canonical `pnpm test` command passed 75 checks with no skips: 23 shared-domain checks, 8 authentication/platform-bootstrap checks, 13 clinic transaction checks, 11 AI extraction/setup/upload-lifecycle checks, and 20 billing/sharing/credit checks. Database checks use real PostgreSQL; Stripe and email transports are fixtures. All 10 additive/baseline migrations applied successfully. Frozen-lock installation, Prisma validation and shared/web TypeScript checks passed.

The optimized Next.js 16.3.8 Turbopack build passed, including TypeScript and static page generation. `next start` became ready in 110 ms. Both takeaway and recipient-document function traces include Geist Regular and Bold font assets. The actual production-mode authenticated PDF response is HTTP 200, `application/pdf`, `%PDF-1.7`, 16,163 bytes, and private/no-store. The separate authored eve 0.69.0 compiler build also passed; live agent execution remains subject to the services below.

The published source commit `7dd6a26e1b407cad1b06f924e49e651d97875998` also passed [fresh GitHub CI](https://github.com/loydhale/dripwell-ai/actions/runs/36940044025): frozen installation, migrations, both builds, TypeScript and all 75 checks. Its GitHub tree was verified to match the audited local artifact before publication in [PR #2](https://github.com/loydhale/dripwell-ai/pull/2).

Four added recording regressions cover deferred upload followed by discard, failed deletion and recovery, remote objects arriving after early cleanup, competing cleanup/adoption locks and preservation of a newer accepted path. The concurrency check observes an actual blocked PostgreSQL row lock. Tests mutate only their owned fixture records.

Checks cover concurrent trial limits and idempotence, existing-visit access after trial exhaustion, required clinical screening, exact approval revisions, stale AI proposals, recording intake invalidation, tenant and role boundaries, archive/reminder reconciliation, setup location binding, signed billing events, credit-funded subscription entitlement, referral reversal, currency precision, and recipient access controls.

## Browser verification

The real Next.js application was exercised with Chromium through `agent-browser`:

- Clinic registration grants 14 days and 10 initial consultations. MFA enrollment and verified account security work.
- Owner enters an explicitly fictional catalog and required question, saves a draft, runs a synthetic test, reviews it, and activates configuration through the UI. Publishing a second tested version retains the original visit's configuration and does not consume trial units.
- A new visit consumes one unit. Manual intake keeps recording disabled until consent, shows the required question, and saves staff-reviewed facts.
- Initial generation produces catalog-priced items. Staff changes the client explanation with a recorded reason and approves the exact revision.
- A fictional care-start record is independent of wellness acceptance, enrollment, and payment. Wellness generation, approval and manual acceptance work.
- Archive removes the active card and disables edits; restore preserves the accepted stage. Owner insights show original and adjusted values with visit context and allow an evidence review.
- A real authenticated approved-document request returns `200 application/pdf`, `%PDF-1.7`, 16,163 bytes, and `private, no-store` after fixing a Turbopack font-path issue caught by the browser check.
- At a 390-pixel mobile viewport, body width remains 390 pixels, the board is navigable, and there is no framework error overlay. No private data is stored in localStorage. The service worker is active.
- Protected clinic responses are private/no-store. A clinic owner receives HTTP 403 from the platform API.
- The optimized production application preserves the accepted board card after restart, renders its navigation and controls, and reports no browser errors or framework overlay. Secure sharing without connected email delivery gives a clear unavailable message rather than creating a working-looking link.

## Initial live service boundary, 2026-10-01

At the initial local-verification point, Vercel's connector listed no accessible teams and its CLI was logged out; live service bindings were unavailable. Since then the Owner authenticated the CLI and the protected database/storage/agent preview passed the hosted checks listed above. Live transcription, a successful assistant response, recipient email delivery, checkout and the complete production workflow still require their actual service gates. The approved local PDF and ordinary clinic flow used no fabricated provider response.

Follow [deployment guidance](DEPLOYMENT.md) to provision the intended Vercel environment and complete the remaining live checks. Independent audit evidence is recorded in [AUDIT_V2.md](AUDIT_V2.md).
