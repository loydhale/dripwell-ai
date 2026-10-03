# TASK-042: Preserve billing events across reviewed platform price changes

TASK_ID: TASK-042
STATUS: QUEUED, after TASK040 independent source/UI/cleanup closure
ASSIGNED: CODER, independent AUDITOR review required
PARENT_REQUEST: Owner delegated initial pricing with later edits; continuous mode requires addressing justified in-scope gaps.
PRD refs: F-11/F-12, versioned commercial terms and preserved subscription/credit history.

## Problem and scope

TASK040 identified an existing billing limitation: subscription and invoice processing recognizes only the current STRIPE_PRICE_ID. Switching that configuration for a later new-customer price can cause events for an existing older-priced platform subscription to be ignored and marked processed. The price-edit documentation currently requires a separately verified recognition/migration plan; it does not promise safe automatic rotation.

Reproduce that exact old-subscription/current-price change with owned actual-PostgreSQL input and the existing disclosed Stripe transport fixtures. If reproduced, implement the smallest explicit server-authorized price-recognition path for retained platform subscriptions. Current checkout must still select and validate only the current configured new-subscription offer. A retired price requires explicit trusted platform configuration or persisted provenance; never accept an arbitrary positive recurring price merely because a subscription has tenant metadata. Do not change existing subscriptions' provider prices, amounts or billing cadence, or award retroactive credits.

This is existing billing correctness for the Owner's approved editable pricing, not a new pricing tier, live rotation, migration replay, location metering or permission to spend. Preserve verified customer/subscription/tenant binding, invoice-line/product/period/currency checks, out-of-order status handling, active-settled entitlement and separate positive-payment referral qualification. Current trial and pinned referral snapshots remain unchanged.

## Ownership and safeguards

Read latest AGENTS/PRD/CTO-provided task queue, boot memory and CODER persona. Use mandatory Vercel Plugin payments/env-vars/verification guidance and installed Stripe23 documentation. Respect root ICM and authored apps/web/agent/apps/web/workflows.

Wait for TASK040 source/UI/cleanup PASS and an exact parent/source handoff before implementation. Do not overlap the existing browser/server/database worker, alter its frozen source or reuse a removed test profile. Root owns provisioning, STATE/PRD/CHANGELOG/session and reviewed publication; Coder does not commit, deploy or change remote environment variables. New provider-price creation is unnecessary. No Gateway/Resend/Stripe request, actual administrator bootstrap, live checkout, email, customer mutation, production promotion or real client data.

Database checks need an explicitly approved owned target and full shared-record preservation, following P-015 and known container/nonce/OID guards. Do not source hosted apps/web/.env.local, run global maintenance, replay migrations or truncate shared fixtures. Keep ALLOW_REAL_CLIENT_DATA=false. Preserve original failure and disclose transport fixtures separately from actual billing evidence.

## Acceptance and handoff

- A meaningful regression first proves the existing missed historical-price event, then verifies settled renewal and cancellation/past-due handling for explicitly authorized retained platform prices after a current-offer change.
- Unconfigured, free, unrelated-product/line/customer/subscription/tenant prices still cannot grant access; current checkout cannot choose a retired or client-provided price.
- Replays and positive-payment qualification retain one referral award and immutable policy/trial/credit history. Existing proven cases need repeat only where the repair changes their relevant branch.
- Invalid or ambiguous price-history configuration fails explicitly and cannot silently broaden recognition. Document the concrete safe rotation procedure and remaining provider/operator action; no automatic migration or repricing claim.
- Report exact paths, focused checks, owned cleanup/shared preservation and learning; independent Auditor reviews source and meaningful results. Update reviewed CTO closure docs and publish only reviewed changes to the same PR2 branch.

If no minimal safe repair fits existing authority/schema, document the reproduced boundary and narrow prerequisite instead of expanding architecture. This task cannot declare PRDsection8 or production complete.
