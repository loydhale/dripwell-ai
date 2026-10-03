# DripWell starter commercial configuration

Loyd delegated the initial commercial choices on 2026-10-03. The starter platform plan is USD 199 per clinic account per month, quantity 1, with no location metering. The referral proposal is USD 50 once on the first qualifying paid platform subscription, a 30-day attribution window, refund reversal, no expiry, future invoice credit and no cash payout. The normal trial remains 14 days including 10 unique initial consultations and never automatically converts to paid billing. These starter choices authorize configuration work, not real customer charges or purchases of AI/provider plans.

## Canonical source and future price edits

`apps/web/lib/commercial.ts` is the canonical starter source. Empty server overrides retain its amount and currency. `PLATFORM_SUBSCRIPTION_CENTS` sets a positive integer amount in the currency's smallest units; `PLATFORM_SUBSCRIPTION_CURRENCY` sets an uppercase supported ISO currency. The interval remains monthly with an interval count of 1, licensed and per clinic account. The empty `.env.example` entries document these optional overrides; do not put secrets in it.

`STRIPE_PRICE_ID` must select a real active fixed per-unit recurring Stripe price with that exact amount, currency and monthly interval, licensed quantity 1, no custom amount or quantity transform and an active expanded Product. Owner settings and platform operations show the configured offer for new subscriptions. Missing service configuration or failed verification disables checkout without hiding trial or referral records. Checkout independently retrieves and validates the actual selected price before customer creation, account-credit application or checkout writes. The browser cannot supply a price ID or amount. Owner MFA remains required, and a webhook signing secret must be configured before checkout.

Future price changes require a new provider price, matching explicit server configuration and reviewed environment bindings. Stripe price edits do not automatically reprice existing subscriptions. The current webhook contract recognizes one configured platform price ID, so switching it also requires a separately verified migration or support plan for existing subscriptions before any live rotation. Existing subscriptions, saved credit balances and historical referral snapshots are not rewritten or converted by this task. The current protected preview is synthetic only and has no paid clinics; no live rotation or production billing is claimed.

## Referral review and activation

The existing platform administrator page receives an editable starter draft with the next version derived from both the current policy and historical publications. Loading starter terms is explicit; it does not save, activate, replace an existing policy or promise an unpublished reward. Disabled policies stay disabled on reload. A selected platform administrator with current MFA must publish through the existing `/api/platform` PATCH boundary. No platform administrator was bootstrapped for this handoff.

Custom active amounts, currencies, attribution, refund and expiry choices remain populated until explicitly changed. Disable preserves audit history; reenabling uses a new version rather than reusing a cleared version. Each attributed referral retains its policy snapshot, so later edits do not change earned-credit terms. Existing first-paid qualification, event replay, one-award and refund-ledger handling remain separate from policy publication; real sandbox paid conversion and refund verification is still required.

## Actual service setup boundary

CTO's actual selected Stripe sandbox setup on 2026-10-03 produced product `prod_VNJvkxq3tEki23` and price `price_1UMZHUECTnhgX9UT9BTCFALy`, with active USD 19900 minor units per month, interval count 1, licensed, per-unit billing, an active Product, null custom amount and quantity transform, and `livemode=false`. The resource is `ir_WKeIBgBxmVampeYA`, installation `icfg_ZjwwL4xPqtcbyk5QQpguMhwU`, attached only to preview and development on the dedicated DripWell project. The private setup receipt is owned by CTO. This records real resource and price creation, not a checkout, paid invoice, referral award, webhook delivery or the pilot passing.

Only CTO handles real provider resources and environment bindings. Independent Auditor review precedes branch publication or a newly compiled synthetic preview. Keep deployment protection and `ALLOW_REAL_CLIENT_DATA=false`; no real clients, charges, emails or provider purchase are enabled by starter terms.
