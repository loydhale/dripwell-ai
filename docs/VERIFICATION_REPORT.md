# DripWell v2 verification evidence

Updated: 2026-10-02. Branch: `feat/dripwell-consultation-v2`.

Verification uses an isolated PostgreSQL 17 database and an explicitly fictional clinic. No patient data, real treatment, customer purchase, or live provider charge was used. Test environment bindings and authenticator material remain outside the repository.

## Current evidence, 2026-10-02

Reviewed deployed source `90b0565ebdcc7759dacbf84586c6c7b67a461f17` passed [fresh CI](https://github.com/loydhale/dripwell-ai/actions/runs/36950177151), including 79 checks, all 10 migrations, types and both builds. The protected Vercel preview is READY, with isolated Neon PostgreSQL and private Blob connected to preview/development. Actual hosted registration/session/database, role gates, private Blob, mobile layout and authenticated Eve/Workflow transport passed; exact evidence is in [AUDIT_DEPLOYMENT.md](AUDIT_DEPLOYMENT.md).

The independently reviewed archive repair is published as `84a5c147304c6fc66ef0a148c7f71fba702e6dc3`. Its [fresh CI](https://github.com/loydhale/dripwell-ai/actions/runs/37008021662) passed all 81 checks, migrations, types and both builds. Independent optimized-browser verification covers retained records older than one year/beyond 250, bounded pagination, retry/stale responses, scope checks and actual restore; [repair evidence](AUDIT_CONTINUOUS_REPAIRS.md) records the results. This source repair has not yet been deployed, so the protected preview still uses the earlier implementation above.

Actual hosted model inference remains blocked by Gateway account entitlement: HTTP403 for the configured model, no provider attempt and no completed response. Stripe account terms, a verified Resend sender/domain, platform price/referral terms, supported production scheduling, selected platform administrator/MFA and the full live synthetic story remain open. The Owner prefers supported ChatGPT subscription use; [current SIWC eligibility and limitations](CHATGPT_PLAN_ASSESSMENT.md) are recorded. Protection and `ALLOW_REAL_CLIENT_DATA=false` remain enabled.

The Owner enabled continuous work until verified completion. [TASK-019's independent matrix](CONTINUOUS_GAP_REVIEW.md) maps all approved features and pilot criteria; it reproduced inaccessible retained archive records and hidden successful deterministic job results. Their bounded repairs and further owner-lifecycle verification are tracked in [STATE](../memory/STATE.md). The enabled hourly continuation is saved in [the work contract](CONTINUOUS_WORK.md). Neither source implementation nor scheduling establishes full pilot completion.

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
