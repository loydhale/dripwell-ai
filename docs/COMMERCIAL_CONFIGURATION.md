# DripWell starter commercial configuration

Loyd delegated the initial commercial choices on 2026-10-03. The starter platform plan is USD 199 per clinic account per month, quantity 1, with no location metering. The referral proposal is USD 50 once on the first qualifying paid platform subscription, a 30-day attribution window, refund reversal, no expiry, future invoice credit and no cash payout. The normal trial remains 14 days including 10 unique initial consultations and never automatically converts to paid billing. These starter choices authorize configuration work, not real customer charges or purchases of AI/provider plans.

## Canonical source and future price edits

`apps/web/lib/commercial.ts` is the canonical starter source. Empty server overrides retain its amount and currency. `PLATFORM_SUBSCRIPTION_CENTS` sets a positive integer amount in the currency's smallest units; `PLATFORM_SUBSCRIPTION_CURRENCY` sets an uppercase supported ISO currency. The interval remains monthly with an interval count of 1, licensed and per clinic account. The empty `.env.example` entries document these optional overrides; do not put secrets in it.

`STRIPE_PRICE_ID` must select a real active fixed per-unit recurring Stripe price with that exact amount, currency and monthly interval, licensed quantity 1, no custom amount or quantity transform and an active expanded Product. Owner settings and platform operations show the configured offer for new subscriptions. Missing service configuration or failed verification disables checkout without hiding trial or referral records. Checkout independently retrieves and validates the actual selected price before customer creation, account-credit application or checkout writes. The browser cannot supply a price ID or amount. Owner MFA remains required, and a webhook signing secret must be configured before checkout.

Future price changes require a new provider price, matching explicit server configuration and reviewed environment bindings. Stripe price edits do not automatically reprice existing subscriptions. Existing subscriptions, saved credit balances and historical referral snapshots are not rewritten or converted by this task. The current protected preview is synthetic only and has no paid clinics; no live rotation or production billing is claimed.

## Retained prices and safe offer rotation

`STRIPE_PRICE_HISTORY` is server-only JSON, available to webhook recognition and never to a client price selector or checkout fallback. Blank history authorizes no additional prices. Each entry pins the original provider price ID, Product ID, positive integer minor-unit amount, uppercase supported currency and monthly interval/count. For example, an authorized operator can supply actual verified IDs in this shape:

```json
[{"priceId":"price_VerifiedOldId","productId":"prod_VerifiedProductId","amountCents":19900,"currency":"USD","interval":"month","intervalCount":1}]
```

The example illustrates the format, not real provider resources to install. Confirm each actual original contract through the selected Stripe account before binding it. Entries must contain exactly those six fields, have unique price IDs and exclude the current `STRIPE_PRICE_ID`. Unknown fields, duplicate/conflicting IDs, invalid terms or a current/history overlap fail explicitly. Amounts are JSON integer values, without string coercion; ordinary JSON numeric notation resolves to its integer value. Historical provider decimal text must represent the exact integer or a zero fraction, including rejection of fractions that JavaScript Number would round away.

An archived Price can remain recognized because its active flag governs new purchases. Retained recognition still requires the exact saved price/Product/amount/currency/monthly licensed per-unit contract, null custom amount and quantity transform, quantity1, matching subscription item ownership, and exactly one recognized item in a complete subscription item list. The existing customer, subscription, tenant, invoice-line/item/Product/currency/service-period, event-order, settlement and referral safeguards remain in force. Zero-cash settled invoices can restore paid access without qualifying for a referral award. Positive-payment qualification continues to use the referral's original policy snapshot. No history entry activates a policy, changes a trial, awards a retroactive credit or reprices a subscription.

Use a separately reviewed provider and deployment procedure for an actual rotation:

1. Create and verify the new fixed monthly licensed price through the selected account. Confirm its exact amount/currency, active Product and checkout eligibility; leave existing subscriptions at their original prices.
2. Prepare one coherent deployment tuple: new `STRIPE_PRICE_ID`, matching `PLATFORM_SUBSCRIPTION_CENTS`/`PLATFORM_SUBSCRIPTION_CURRENCY`, and all still-needed retired contracts in `STRIPE_PRICE_HISTORY`, including the old current price and excluding the new current ID. Validate the whole tuple and old-price settlement/status plus new-price checkout checks before rollout. Environment edits must apply together in a new reviewed deployment, not as a partially configured running release.
3. Retain contracts while their existing subscriptions or delayed events need recognition. A retired price is not a purchasable alternative. Archive only through a separately authorized operator action after verifying retention; this source change does not perform it.
4. For rollback, prepare another coherent tuple with the restored current offer and verified checkout eligibility. Remove that current ID from history and retain the superseded new price if any subscriptions were created on it. Restore matching amount/currency with that tuple. Rolling code/configuration back without preserving every needed contract can recreate the original missed-event problem.

Malformed history blocks checkout before provider/customer/account-credit/session or database side effects. Known billing events that encounter the invalid configuration fail with `BILLING_PRICE_HISTORY_INVALID` and remain retryable through the existing webhook handling after configuration is corrected. Trial and existing records remain visible when checkout cannot be verified. An event already marked PROCESSED under the previous current-only code stays processed; this repair does not reset it or backfill missed access, status or credits. Such events require separately authorized review and recovery based on verified original billing evidence. No live rotation, remote environment change, provider payment or historical event recovery occurred in this source task.

## Referral review and activation

The existing platform administrator page receives an editable starter draft with the next version derived from both the current policy and historical publications. Loading starter terms is explicit; it does not save, activate, replace an existing policy or promise an unpublished reward. Disabled policies stay disabled on reload. A selected platform administrator with current MFA must publish through the existing `/api/platform` PATCH boundary. No platform administrator was bootstrapped for this handoff.

Custom active amounts, currencies, attribution, refund and expiry choices remain populated until explicitly changed. Disable preserves audit history; reenabling uses a new version rather than reusing a cleared version. Each attributed referral retains its policy snapshot, so later edits do not change earned-credit terms. Existing first-paid qualification, event replay, one-award and refund-ledger handling remain separate from policy publication; real sandbox paid conversion and refund verification is still required.

## Actual service setup boundary

CTO's actual selected Stripe sandbox setup on 2026-10-03 produced product `prod_VNJvkxq3tEki23` and price `price_1UMZHUECTnhgX9UT9BTCFALy`, with active 19900 minor units, USD 199 per month, interval count 1, licensed, per-unit billing, an active Product, null custom amount and quantity transform, and `livemode=false`. The resource is `ir_WKeIBgBxmVampeYA`, installation `icfg_ZjwwL4xPqtcbyk5QQpguMhwU`, attached only to preview and development on the dedicated DripWell project. The private setup receipt is owned by CTO. This records real resource and price creation, not a checkout, paid invoice, referral award, webhook delivery or the pilot passing.

Only CTO handles real provider resources and environment bindings. Independent Auditor review precedes branch publication or a newly compiled synthetic preview. Keep deployment protection and `ALLOW_REAL_CLIENT_DATA=false`; no real clients, charges, emails or provider purchase are enabled by starter terms.
