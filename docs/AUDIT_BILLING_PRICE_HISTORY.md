# Audit: retained platform billing prices

Task: TASK-042

Review date: 2026-10-03 UTC

Published parent: `7dd003dfb320189ab80c541e096209082380d680`, PR #2, `feat/dripwell-consultation-v2`

Verdict: **PASS for the reviewed source repair, 40 focused unit cases, six cases against owned PostgreSQL, TypeScript validation and owned-resource cleanup.** Provider transport in these checks is explicitly intercepted. Actual paid Stripe checkout, webhook delivery and referral credit, the latest protected deployment and the complete pilot remain separate verification gates.

## Result and scope

Changing the current platform offer previously caused settlement and status events for an existing older-priced subscription to be ignored. The repair recognizes explicitly retained server-authorized price contracts while new checkout continues to use only the current configured, validated provider offer. It preserves existing subscription, trial, referral-policy and credit history.

`STRIPE_PRICE_HISTORY` is a server-only JSON array of six-field contracts: `priceId`, `productId`, positive integer `amountCents`, supported uppercase `currency`, `interval: "month"` and `intervalCount: 1`. Unknown or missing fields, unsupported values, repeated IDs and overlap with the current price fail configuration validation. Ordinary JSON numeric values are used; no string coercion is accepted.

A retained item must match its original price and product identity, exact minor-unit amount and currency, monthly licensed per-unit billing, quantity one and subscription ownership. Custom amounts, transformed quantities and nonzero decimal fractions cannot match. Integer or up to twelve all-zero fractional digits match exactly, avoiding `Number` precision loss. Archived price or product availability may still match a specifically retained contract. A complete subscription item list must contain exactly one recognized current or retained item; incomplete or ambiguous lists cannot grant access.

Malformed or conflicting history produces typed HTTP 503 `BILLING_PRICE_HISTORY_INVALID` before checkout price, customer, credit, session or database side effects. A relevant webhook event remains `FAILED` and retryable. Repairing configuration allows the same event to succeed. Unconfigured or mismatched provider items remain ineligible.

The existing customer, tenant, subscription, invoice-line, product, currency, settlement, period and event-order checks remain effective. A settled zero-cash invoice can grant entitlement; referral qualification still requires positive payment. Concurrent qualifying events and replay produce one award using the original referral snapshot. Refund processing is unchanged.

The environment example adds only a blank server variable. No remote history configuration, price rotation, provider repricing, subscription migration or retroactive credit occurred. [Commercial configuration](COMMERCIAL_CONFIGURATION.md) describes coherent deployment and rollback tuples for future reviewed changes. Already-`PROCESSED` missed events are not reset; any recovery requires a separate reviewed action.

## Exact reviewed source

The corrected source manifest is `34680c489c2545ed81f63ce2e127870c513efa32a202fd060438d07e9d16f64e`. These six paths were unchanged throughout focused verification and cleanup. Compatible private snapshots preserve their bytes for later publication and subsequent tasks.

| Path | SHA-256 |
| --- | --- |
| `.env.example` | `33c36b6eac228b2423536d9bf0dba2950879f235b46624fd16d398d034502f0e` |
| `apps/web/lib/commercial.ts` | `819aed56cb2d7968021893a3c8e05ea6271ec26ae5d2d05ff73f09a08d843f38` |
| `apps/web/lib/billing.ts` | `c715e66ff290008f41e59bca105a5472ff413929f03342cd2a8c0dde01ea9497` |
| `apps/web/lib/price-history.test.ts` | `b4e18cd1cecf525f3703d49fb288fd9c96acce45dd250cfd831c69bbe1332258` |
| `apps/web/lib/billing-price-history.integration.test.ts` | `9fd60ea47384bea7ad5fb35fc28be4cebf5c4bf53a99b3df88486147f4cbe47f` |
| `docs/COMMERCIAL_CONFIGURATION.md` | `ed126e95e954d71d4d2b63930511a67eefdf9614bb0c9d6cd7e9fd7d80cee4cb` |

The original six-case regression was newly authored before the repair and remained unchanged during red and green verification. It was absent from published parent `7dd003df`. Four other preserved source snapshots were independently compared to their actual parent Git blob bytes and IDs. The initial final-manifest label grouped the untracked regression with published snapshots; original metadata remains preserved, and the corrected manifest separates actual Git-base provenance from the original authored regression. This correction changed no source or execution bytes.

## Observed regression and checks

The first baseline invocation exited zero with all six cases skipped. It proved no business behavior. Initial Coder and Auditor plan review missed two installed Vitest 5.0.3 contracts: CLI `fullTestName` joins suite and leaf with ` > `, while JSON `fullName` joins with spaces; filtered JSON assertions have status `skipped`, not `pending`. The failed invocation, original helper and reviews remain retained.

A separately reviewed selector-and-collector recovery ran once against the same owned database and unchanged parent behavior. It exited one with precisely two intended assertion failures and four deliberate exclusions: a settled zero-cash invoice left `TRIAL` instead of `ACTIVE`, and an update left `ACTIVE` instead of `PAST_DUE`. No fixture, hook, signature or selection failure caused those results. Later referral, renewal and cancellation assertions were not reached in red; the final green cases reached them.

After independent source and final-plan review, the same Coder ran the three approved phases sequentially. Raw outputs, actual exit receipts, structured assertion reports, source hashes and ownership controls were retained. Each phase passed without timeout or unexpected stderr.

| Phase | Actual result | Completion receipt, UTC |
| --- | --- | --- |
| `lib/price-history.test.ts` | One file, 40 passed, zero failed/skipped/pending/todo | 23:38:02.481937 |
| `lib/billing-price-history.integration.test.ts` | One file, six passed, zero failed/skipped/pending/todo | Process 23:38:47.145686; post-guards/result 23:38:53.497681 |
| Installed TypeScript 5.9.3 `--noEmit --incremental false --pretty false` | Actual exit zero, empty stdout/stderr | 23:40:04.506707 |

The 40 unit cases cover strict contract validation, ambiguity, current/history separation, archived identity, supported decimal text and the precision witness `99999999.000000000001`. They also verify configuration failure before provider or database side effects and refusal to substitute a retired offer for the current checkout quote.

The six PostgreSQL cases verify:

1. Settlement after offer rotation; zero-cash entitlement without reward; concurrent positive qualification and replay with one original-policy award; preserved trial, referral and ledger snapshots after discounted renewal and item-period clamping.
2. Past-due and canceled status handling with out-of-order event rejection, preserving period and trial history.
3. Rejection of unconfigured, free or altered contracts, unsupported billing shape or quantity, incomplete lists and multiple recognized items.
4. Invoice/customer/tenant/subscription/item/line/product/currency/payment/period guards and rejection of an unrelated retrieved customer.
5. Five invalid history configurations returning 503 with `FAILED`/null `processedAt`, followed by successful retry of each same event after repair.
6. Current-only validated checkout with quantity one, preserving the older clinic subscription.

The retired 9,000-minor-unit USD price and policy-version-three 2,500-minor-unit USD reward are disclosed historical fixtures. They do not change the Owner-delegated USD 199 per clinic account per month and USD 50 referral starter terms. All invoked Stripe transport methods are intercepted. These two synthetic fixture tenants do not constitute the ordinary two-clinic pilot story or an actual provider payment.

## Ownership, preservation and cleanup

Verification reused only owned loopback `127.0.0.1:55432/dripwell_task042_verification`, OID `22214`, marker `TASK-042 exclusively owned verification c011ca23-5193-4f2c-8b6d-7eac4012e0d6`, in the pinned existing container `7d80582265023d9bdd13bb561f812eb8bca2c4427d4e4522f251af179edde627`.

Initialization copied reviewed schema only. All 50 owned tables began empty; no shared rows were copied and no reviewed migration was replayed. The existing ten successful migration checksums and historical rolled-back entry were checked separately. Explicit child configuration kept the data gate literal false, provider/auth/admin/commercial keys blank before fixture mocks, and workflows local. Hosted `.env.local` was not sourced. The temporary secret profile was validated by hash and removed at cleanup; its contents were never copied to retained evidence.

Final PostgreSQL preflight recorded zero owned connections. Before and after fixtures, all 50 owned tables were empty and all 50 shared whole-row digests matched the original and actual-red inventories. The post-test zero-connection assertion completed before the final result, but no separate raw post-test count artifact exists; that evidence limit remains explicit.

After separate Root cleanup authorization, the original ownership-guarded helper ran once and exited zero. It freshly checked zero connections and 50 empty tables, dropped only the owned database, removed only its private profile, and preserved the existing container and shared database. Cleanup completed at 23:47:04.151346 UTC.

An independent, bounded GET-only Docker/SQL readback completed at 23:49:34.175619 UTC. It confirmed the exact running container and loopback port, owned-database absence, zero owned connections and profile absence. Every shared table digest and all 101 shared rows matched the original, final-PG and cleanup inventories. All six reviewed source hashes and published parent Git HEAD remained unchanged. Credentials and raw row values were neither printed nor retained. No test, migration, provider, build or cleanup action was repeated for this readback.

## Retained evidence and limits

Private evidence is kept under the task's protected Coder, Auditor and Root directories, with non-executable evidence files mode `0600` and private directories mode `0700`. Source-compatible snapshots exclude the removed secret runtime profile. Key independent receipts are:

| Receipt | SHA-256 |
| --- | --- |
| Actual two-failure baseline review | `0d775dbba0005afe4cbfbd103fc25c0e3577577df16dcf5ff3aafb23a2f94629` |
| Source and final-plan review | `d22f0a0e47e21c038e9b426898559a2e72bcea82587087abd5ae574adab6c711` |
| Actual focused-results review | `df3429ac149c047ffa380bd27f6de3b5bfd0da0c2d2935efae8874791c59e5d3` |
| Independent current cleanup readback | `f988b8e7fca8f066c9d79df6e84985f1830e6701eeb2fef4d386141ec5d087dd` |
| Cleanup and source-preservation review | `c7d1719edc6e4dad6fab60c78dff625c41761cfc5dbbc882595b7b9eb01fef38` |

Helper intent timestamps, Vitest reporter start times and actual completion receipts are distinct. Cleanup has a preserved unified exec completion receipt; separate raw cleanup stdout/stderr and direct process-start UTC are not fabricated. Original failed instrumentation, metadata-label corrections and read-only collector limitations remain preserved rather than replaced with successful evidence.

Learning preserves L-037 as Seen 2: verify installed matcher and reporter semantics separately, require explicit executed/skipped counts, and distinguish compatible source bytes from publication provenance. Retained contract recognition requires coherent future rotation and rollback configuration; precision-sensitive provider amounts require exact decimal comparison. Root owns final learning and queue closure, reviewed publication and TASK-043 deployment.

This scoped PASS does not establish actual paid billing/referral delivery, hosted model eligibility, a watched workflow video, the complete recording/transcription/model/approval/share/PDF/board/outcome/reminder/trial/role/retention story, or production eligibility. Protected preview and `ALLOW_REAL_CLIENT_DATA=false` remain required. Latest-source CI, remote preview build and bounded changed-settings smoke are subsequent reviewed work.
