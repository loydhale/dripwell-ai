# Audit: Normal owner commercial settings

AUDIT: TASK-044

VERDICT: PASS for the bounded normal fictional-owner signup, commercial settings UI and exact fixture compensation.

ATTEMPT: 1, with the original failed tooling phase and separately reviewed correction/continuation preserved.

DATE: 2026-10-04

A normal fictional clinic owner reached the protected deployed app, saw the current USD199 per clinic account monthly offer and unused 14-day/10-consultation trial, and was removed through exact conditional compensation. This verifies the owner commercial settings story. It does not complete the clinical pilot or production rollout.

## Source and authority

App source `80729f2f2352fa55b1e0ba911082ab52eeca8032`, tree `f61dbdd0e3e23f0988112b988e4134bc5ef5ab2b`, was the source already deployed by [TASK-043](AUDIT_PROTECTED_COMMERCIAL_PREVIEW.md) to protected READY deployment `dpl_AsLremfTJcQ5ew7Cukxn3Ed7n9dJ`. The normal stable origin was `https://dripwell-ai-preview-loyd-1222s-projects.vercel.app`. The existing 181-case source CI/build evidence belongs to that deployment; source suites, migrations and provider checks were not replayed for this task.

CTO/Coder/Auditor remained separate. The mandatory open-source [Vercel Plugin](https://github.com/vercel/vercel-plugin) CLI, browser, verification, auth and environment guidance was used with installed native agent-browser 0.38.1. Existing ICM roots and authored `apps/web/agent` and `apps/web/workflows` were retained. No application source changed. The three explicitly held Markdown paths were hash-guarded throughout; report and learning preparation remained private until closure review.

The fixture used ordinary registration, yielding `SUPER_USER` with `canApproveClinical=false` and MFA disabled. No platform administrator, clinical approval, active protocol, model call, paid enrollment, credit-policy activation or real-client permission was created. Preview protection and the previously verified literal false real-data gate remained the required controls.

## Actual normal story

| Boundary | Observed result |
| --- | --- |
| Fictional native protocol checks | Four bounded parser cases produced expected exits 0/1/1/1 before any daemon or hosted request |
| Known APP_URL selector | One normal selected CLI read established the approved stable mutation origin; no environment pull or credential output |
| Normal `/api/auth/register` | HTTP201 with `ok:true` and `/setup` redirect; nonce/email SQL reconciliation identified exactly five normal signup rows |
| `/api/auth/me`, `/api/clinic`, `/api/referrals` | Three intentional authenticated GETs returned HTTP200, private/no-store, no-cache and nosniff |
| Actual trial and offer | 14-day activation window, limit10, used0, remaining10; 19900 minor units, USD199 per clinic account per month; checkout unavailable |
| Actual owner `/settings` | Real DOM and independently viewed 1280x1299 screenshot matched price/trial, disabled checkout, no automatic enrollment and unconfigured referral credit terms |
| Browser errors and cookie visibility | Retained console messages/page errors were empty; normal HttpOnly app cookie was invisible to document.cookie |

The actual settings DOM checkpoint was 04:45:40.532782Z. All eleven commands in the successful fresh context exited0 without timeout. The screenshot is 202,907 bytes, SHA256 `36844612d0d7160dfe2d3a6aea8a9820033a300f471d649379925cc0763cb5a0`. Disabled checkout and HttpOnly visibility are DOM checks, rather than inferences from its pixels.

[Owner settings screenshot](screenshots/owner-settings-2026-10-04.png), fictional verification data only. The visible task-owned referral link is inert after the verified fixture cleanup; no client or authentication secret is visible.

Normal project OIDC tokens and the trusted navigation header were kept in memory, out of argv, environment, files and retained logs. The reviewed native implementation scopes the header to the selected origin. The only new app-cookie input was the fictional session in one owned0600 file. Supported batch import supplied exact origin/path/expiry/Secure/HttpOnly/SameSite attributes, and echoed credential values were redacted before persistence. The input was removed after database compensation. No independent network-egress capture or unseen browser-engine argument claim is made.

## Preserved tooling failure and meaningful correction

Independent preparation review caught unsupported `Config.defaultTimeout`; the corrected tool used documented nonsecret `AGENT_BROWSER_DEFAULT_TIMEOUT=20000` with a separate45-second outer bound. Original preparation bytes and finding are retained.

The first actual browser successfully opened/waited at login and imported the normal cookie. Its verification collector then failed by requiring result data to equal only `set:true`; the native successful result also contained source-traced lifecycle metadata. A second identical equality site was never reached. This is a collector failure, not an app/cookie failure. No settings or screenshot command ran in that first context. Its original FAILED result, initial peer PASS, successful native output and full-data/browser closure remain preserved.

A separate pure checker extracted only the corrected predicate through restricted AST compilation, without importing the operational helper/common/main. It executed the actual saved safe native result plus fourteen meaningful fictional variants: fifteen expected outcomes passed, three accepted and twelve rejected. The later distinct context necessarily obtained fresh normal token/header/cookie bootstrap because the original context was closed. It was not a replay of the failed entry or an unattempted-cookie claim. That context completed the owner UI checks above.

The initial story plan described45 complete unrelated/non-rate tables; the actual partition is44 plus original row sets in the five owned tables, totaling49 non-rate tables. The original typo is retained, and reviewed results use the exact50-table controls.

## Actual conditional compensation

Registration changed the total from32 to37 rows through exactly one Tenant, User, Location, Subscription and AuthSession. Before/after API and browser checkpoints preserved all original row sets and every other rate bucket. Four existing generation jobs, two expired recording segments and ten migration-ledger rows remained intact.

A separately reviewed two-context derivative retained the entire original4,676-byte single-statement transaction and post-database checks unchanged. Fresh checks before mutation and again before input removal required both exact recorded PID/start identities, absent namespace sockets and no active matching namespace processes. Both stopped PIDs were observed as same-start zombies, distinct from absent processes. No broad kill or namespace cleanup was used.

One locked nonce/UUID/canonical-row/FK barrier restored only the exact changed registration bucket through compare-and-swap and deleted only the identified tenant with the proved five-row cascade. Its actual HTTP200 reply at05:12:43.124486Z was guard1/deletedTenantCount1/rateChangeCount1. Nine captured SQL HTTPS POSTs comprise that one mutation plus necessary SELECT observations; no transaction retry occurred.

The final50-table snapshot completed05:12:43.620104Z and exactly matched every original pre-register count and whole-row digest at32 rows. All original rate rows were restored and the fixture nonce was absent. Three hash-owned inputs, the new synthetic cookie and both nonsecret configs, were individually removed with unique receipts. Their absence was independently checked; the fixed original mixed cookie jar was preserved by the enforced source guard. Evidence and image were retained. Final source/input/context closure was05:12:43.648105Z, followed by actual PASS and outer exit0.

Auditor's read-only result collector initially assumed every SQL intent exposed `mutation`; inherited SELECT snapshots expose `noMutation`. That KeyError and the earlier truncated metadata display are retained. Typed-schema correction reused the already saved artifacts, without any SQL or cleanup replay. Exact helper/source/public-path guards and all207/65/127 frozen descriptors still matched after compensation.

## Scope, evidence and learning

Principal independent reviews are registration `66621ac1`, corrected pure/live readiness `bab685ac`, actual UI/data/both-context `ef5b5138`, compensation plan `148b685f` and actual compensation `6219ca19`. The deduplicated private `TASK044_FINAL_EVIDENCE_MANIFEST.json` preserves compatible source, plans, GOs, failed phase, actual pure/UI/data/cleanup receipts, screenshot and review evidence. Removed authentication inputs are excluded. Actual helper timestamps are retained; absent outer-shell start/finish UTC values are not invented. Captured PostgreSQL hashes, transport replies and enforced source guards do not imply raw clinical rows were retained or another fresh Auditor SQL query was run.

Learning updates L040/G012 retain the extensible native-response and memory-only origin-header lessons, meaningful pure correction, both-context release and typed metadata distinction. No blocking application finding remains within TASK044. PRD audit passes this bounded F11/F12 verification scope; no PRD feature or authority change was made. The report receives a separate factual Coder co-sign before publication.

TASK043's original-owner check remains PARTIAL; this new fictional owner does not refresh that person's unavailable login. Live signed Stripe checkout/payment/referral credit, selected administrator MFA/policy publication, Resend sending setup/delivery, eligible hosted inference, actual clinical activation/start/recording/model/approval/sharing/PDF/board/reminder/trial-concurrency/retention and physical-device gates retain their own evidence requirements. Desktop settings does not establish a mobile/offline PWA or full two-clinic story. The separately reviewed two-clinic draft/question/saved-test verification is feasible next under TASK045; it has not executed here. The approved pilot remains incomplete.
