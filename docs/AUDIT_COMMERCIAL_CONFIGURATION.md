# Commercial configuration and selected service audit

AUDIT: TASK-040; TASK-034 selected setup boundary

VERDICT: PASS for the reviewed source, compiled commercial UI, owned cleanup and selected sandbox readbacks

ATTEMPT: 1

DATE: 2026-10-03

The Owner-delegated starter offer is implemented and independently reviewed: USD199 per clinic account per month, quantity1, and a USD50 referral draft. Loading the draft does not activate rewards or billing. A selected platform administrator with current MFA must explicitly publish it. This audit does not complete TASK-034, billing verification or the approved pilot.

## Reviewed source and guidance

Base `2eb79df9f4b0d57c8a319a942c14ae78e2adc6c2`, branch `feat/dripwell-consultation-v2`, PR2. The Coder froze eleven paths in manifest `7ecb50ca2666b9c40a07b2f326652d10d2cb3dcdb94f666a565433acb3c033b1`: `.env.example`; the commercial, billing and platform libraries; subscription-terms, settings and platform components; three focused test files; and [COMMERCIAL_CONFIGURATION.md](COMMERCIAL_CONFIGURATION.md). All source bytes and the ten original proof pins remained unchanged through independent cleanup review. Exact private copies of those eleven source paths preserve compatibility when subsequent tasks edit the same files.

The mandatory open-source [Vercel Plugin](https://github.com/vercel/vercel-plugin) guidance was available through `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`. Relevant payments, environment variables, CLI/API, Marketplace/email, Next.js, auth, React and browser/full-story verification guidance was read alongside installed Next16.3.8, Stripe23, Node24.19 and agent-browser0.38.1 documentation. Existing ICM root folders and authored `apps/web/agent` and `apps/web/workflows` were preserved. This uses plugin guidance with the existing coding assistant; no hosted coding service was purchased.

The canonical starter source and validated server overrides preserve a fixed monthly offer. Checkout independently retrieves the configured real Price and checks exact ID, active fixed per-unit recurring amount/currency, monthly count1, licensed billing, null custom amount/quantity transform and an active expanded Product before customer, credit or checkout writes. Missing configuration or verification failure keeps checkout unavailable while displaying trial and referral records. The browser cannot choose an amount or provider Price ID.

The referral form preserves custom active values, resets all editable state after a disabled-policy reload and derives the next version from current and historical publications. Explicit starter loading only edits a draft. The existing `/api/platform` PATCH boundary remains tenantless `SYSTEM_ADMIN` plus current MFA. No hosted platform administrator was selected or bootstrapped; verification used an owned synthetic identity. Policy attribution retains historical snapshots; trial accounting and existing credit-ledger semantics are unchanged.

## Meaningful checks

| Evidence | Observed result | Limit |
| --- | --- | --- |
| Commercial unit/render checks | 40 passed; TypeScript and scoped whitespace checks passed | Actual Coder tool outcomes retained; separate raw logs were not retrospectively fabricated |
| Focused actual PostgreSQL | Five passed in two files; ten unchanged cases intentionally unselected | Disclosed Stripe transport mocks, not real payment/refund evidence |
| Fresh optimized production build | One build passed, 20:49:56.821 to 20:50:28.271 UTC; build `gzPhT4Yo69iA9gDM395qj` | Owned synthetic runtime only; no newly deployed preview |
| Compiled administrator forms | Actual draft, publish, disable, full reload, reenable and maximum-version behavior passed | Normal compiled forms and read-only API/DB observations, no response stubs |
| Compiled owner settings | USD199/account/month, 14-day/10-consultation trial and referral terms displayed; unavailable checkout disabled | No checkout, charge, referral invitation or email sent |
| Cleanup | Both browsers closed, exact server/proxy stopped, ports free, fixtures and private inputs removed, owned DB/profile removed | Shared database/container preserved |

The five PostgreSQL cases cover checkout serialization, policy publication/history, concurrent publication, no-session/owner/staff denials and current administrator MFA, and explicit starter/override/disabled-history behavior. The retained owned target was `127.0.0.1:55432/dripwell_task040_verification`, OID20836, in the exact existing PostgreSQL17 container. It was initialized once from schema-only reviewed DDL. Ten reviewed migration checksums were inspected; migrations were not reapplied. All fifty shared table counts and whole-row digests were preserved throughout.

The compiled browser used matching production `APP_URL`/Origin `https://127.0.0.1:4178`, an owned loopback HTTPS proxy to Next on4177, fresh synthetic MFA/session inputs and an explicit synthetic encryption key. Provider keys were blank and `ALLOW_REAL_CLIENT_DATA=false`. The local certificate chain/IP/purpose were normally verified; the isolated browser used its documented native CA mechanism, with inherited external CA/proxy preserved. No source, production-origin or TLS guard was weakened. Actual secure-context navigation succeeded without certificate, page/console or framework-overlay errors. Administrator and owner screenshots were visually inspected. The recorded native daemon exposed no Chrome child, so unseen browser-engine launch arguments are not claimed.

| Successful persisted checkpoint | Current policy | Policy audit events |
| --- | --- | --- |
| Custom policy loaded | Version7, CAD75, 60-day attribution, no refund reversal, 90-day expiry | 1 |
| Starter draft loaded | Still version7; displayed draft8, USD50/30 days/refund/no expiry | 1 |
| Normal form published | Version8; next9 | 2 |
| Separate supported disable/save/full reload | Null; next9; checkbox unchecked | 3 |
| Manual reenable and normal publish | Version9; next10 | 4 |
| Maximum-version normal publish | Version2147483647; next/starter null; load/publish disabled | 5 |

Each successful DB checkpoint preserved both trial rows and the original version7 referral snapshot, with zero credits, billing events and trial-usage records. Owner settings separately showed three trial consultations used and seven remaining. These are commercial-flow synthetic fixtures; two fictional tenants do not establish the two-clinic clinical pilot story.

## Preserved verification failures and capture limits

- The original private fixture assumed nonexistent `AuditAction.UPDATE`; its transaction failed and rolled back. Independent recovery review also caught invalid UUID `AuditLog.entityId='global'`. The actual product writer uses `SETTINGS_CHANGED` and null entity ID. Separately reviewed create/snapshot/cleanup derivatives corrected those assumptions against the same owned target and build. Originals, failed outputs and co-signs remain retained. An idle owned Next server was mistakenly dispatched before the failed prerequisite result was inspected; no proxy/browser or second build was started from that failed phase.
- The first generated native socket path was148 bytes, exceeding the installed103-byte limit. It failed before launch or cookie import. A unique short naming input produced84-byte paths after collision checks, preserving the frozen helper, CA, domain and no-restore contract.
- `find ... uncheck` was unsupported. Dependent commands were incorrectly batched after that failure, causing overlapping waits/reload and one counter-named receipt overwrite. Observed tool-output copies remain, but the overwritten raw reply is not reconstructed. The mislabeled attempted-disabled snapshot actually shows policy8 and is excluded from disable PASS. A separately completed supported checkbox click/form/save/reload sequence produced the valid null-policy checkpoint. Subsequent dependent operations were completed and inspected sequentially.
- The read-only final receipt collector initially expected stdout success fields in the pre-cleanup snapshot file. It was corrected to inspect the actual captured success stdout and immutable snapshot separately. No mutation occurred from that reporting error.
- Browser replies retain actual arguments, exits and available streams, but no per-click UTC field. Snapshot/build/service timestamps are actual recorded times; missing timestamps or overwritten raw files are not invented. Failed phases are excluded from successful verification counts.

## Actual selected sandbox setup

CTO performed the authorized selected-service operations; Auditor performed independent readbacks. Actual Stripe sandbox creation produced resource `ir_WKeIBgBxmVampeYA`, installation `icfg_ZjwwL4xPqtcbyk5QQpguMhwU`, on dedicated project `prj_fF0yFggYVFN9pI5dQN33glG2wPyW`, scope `loyd-1222s-projects`, preview/development only. Product `prod_VNJvkxq3tEki23` and Price `price_1UMZHUECTnhgX9UT9BTCFALy` were actually retrieved as active, 19900 minor units, USD199 per month/count1/licensed/per-unit, null custom amount/transform, active expanded Product and `livemode=false`.

The first normal SDK attempt returned a connection error because Stripe's own HTTP agent did not inherit the sidecar proxy. Supported Node24 environment proxy plus explicit HTTPS agent recovery retained inherited TLS/proxy and the same deterministic product/price idempotency keys. The actual recovered API receipt spans20:11:39.778 to20:11:40.772 UTC. Original separate raw stdout/stderr and enclosing CLI-start timestamps were unavailable; observed merged tool transcripts preserve that limit. The first attempt is not falsely described as an account denial or proof that no provider write could have occurred.

The original Preview Price binding was sensitive and could not be read through the normal selected preview environment. Auditor rejected a proposed in-place type change because pinned CLI62.1 explicitly prohibits it; that update was never executed. A separately co-signed exact Preview remove/add with `--type config`, guarded by the original record ID/target/null branch and supplied only the actual nonsecret Price ID on stdin, succeeded once. New Preview record `EMUIRkJauFTTU86Z` is encrypted/config, preview only, with null branch/configuration. All twenty-six other environment metadata records, including Development, remained exactly unchanged. No Production binding was added.

An independent fresh-empty-directory read, with explicit project and ambient billing/gate override absence checks, used normal selected CLI/SDK access. Its actual20:57:27.525 to20:57:27.779 UTC receipt confirms the exact Price/Product and literal `ALLOW_REAL_CLIENT_DATA=false`; webhook configuration is absent. CLI exited0. An unrelated CLI self-update lookup warning was retained without replay. The earlier normal Development read passes its provider checks but allows local dotenv/process provenance, so it does not prove values originated exclusively from remote records. Corrected Preview evidence excludes that ambiguity. Project root/account and protection remained unchanged, including `ssoProtection.deploymentType='all_except_custom_domains'`.

One bounded explicit Resend Marketplace Free request failed with `Billing plan is disabled: free (400)`. Current public Free pricing does not make that disabled native Marketplace plan available. No paid fallback, duplicate attempt, sending-domain setup or email was performed. The separate direct-free-account authorization question remains pending.

## Closure, learning and remaining gates

Both exact owned browser sessions reported closed; their namespace sockets/PIDs/processes were absent. Exact Next PID153693/start19637104 and proxy PID166386/start19748630 stopped and ports4177/4178 were free. The stopped processes remained zombies, distinct from absent browser daemons. Corrected fixture cleanup checked immutable controls before removing only owned rows. Fifty owned tables were empty and fifty shared digests unchanged. Four owned auth/session/private TLS inputs were removed. Coder then dropped only the nonce/OID-bound empty database with zero connections and removed its profile. Fresh independent SQL confirms the owned database is absent, the exact shared container remains running and all fifty shared whole-table digests still match before/after.

Private final source audit is `22e7f19e41b13d6a11a28a0181d25dc3ab9c39e2986c71bf1d7dc49643d74011`. The227-entry final UI/source evidence manifest is `a2fc249d9a4030eff95b1e81e846ddcb62987ceb9de72a9688053c22f08a715b`, including eleven compatible source snapshots and the authored TASK041 report snapshot. Owned UI closure is `8d183c6c37107117b7ed4f276ecff5ee9aa8ea09317217decc27257e7b84ea2e`; independent database cleanup review is `04dba99f94f5c1753d4ea97d665557eff2a2f5fea87244369a3e0210b30ea0c7`. The49-entry selected-service manifest is `4920a3b81da813d97498f15f1d200f25fd17df586c90f2b169b346a8a4007b50`, with corrected Preview review `afd1bd36c3362d2d2ab48a6ee58cde90d805018a9e038990d637ebc17054a89a`. Evidence directories/files are0700/0600; removed owned secrets are excluded. No passing provider, timer, migration or unchanged source suite was replayed.

Learning was extracted for L016 disabled form/history reset, L025 actual local/hosted subscription eligibility, L035 whole fixture schema and completed prerequisites, L037 full Vitest title filtering, G008/G013 SDK-agent proxy behavior and G014 browser socket/command/capture contracts. Root owns the matching memory/CHANGELOG/PRD closure; its exact documentation co-sign is recorded separately before publication. Scope remains within F11/F12 and the Owner's delegated starter choices. No blocking application finding remains within TASK040.

FINDINGS: Existing single-current-Price webhook recognition can miss an older legitimate subscription after a future new-offer change. This remains explicitly documented and is queued in [TASK-042](../tasks/TASK-042.md), severity suggested for this starter task. Reproduction and a minimal trusted historical-price recognition repair are next; live rotation or automatic repricing is not approved by this audit.

Actual signed webhook/payment/referral award/refund evidence, sender/domain/email setup, supported hosted model/transcription access, selected real administrator/clinical configuration and the complete section8 two-clinic clinical story remain open. Current [ChatGPT CLI review](CHATGPT_CLI_ROUTE_REVIEW.md) recognizes supported coding/local capabilities while retaining exact hosted-auth/eligibility restrictions; no new login or model call was needed. Protected deployed source remains `b61f6aa`; its Gateway inference denial is unresolved. No new deployment, production promotion, real customer charge, external message or real client data is enabled. TASK040 PASS does not satisfy pilot or production completion.
