# Owner login needed for selected services

Checked October 2, 2026. The application remains the protected synthetic preview at reviewed source `b61f6aa`; no billing/email resource is connected yet.

## Open these two links

Log into the selected Vercel team and review/accept the provider terms:

- [Stripe sandbox setup](https://vercel.com/loyd-1222s-projects/~/integrations/accept-terms/stripe?source=cli)
- [Resend setup](https://vercel.com/loyd-1222s-projects/~/integrations/accept-terms/resend?source=cli)

CLI62.1 explicitly requires human acceptance: “Term acceptance cannot be performed by an AI agent. Run this command directly in your terminal.” The browser verification link is its supported alternative. Owner login and acceptance cannot be completed by impersonating the Owner or bypassing that guard. These links review terms; the continuation separately verifies the actual selected account/resource connection.

The Owner already authorized Stripe sandbox setup and selected Resend. Normal selected-team reads in this active pass returned empty Stripe and Resend installation lists. The bounded Resend free-plan install returned `integration_terms_acceptance_required` and created no resources. The Owner has received both links; acceptance is still pending. Do not resend an unchanged question on every continuation.

## Work ready after acceptance

- Resume the already-authorized Stripe **sandbox** connection for `dripwell-ai`, preview/development only. Do not create live charges or fabricate platform subscription/referral terms.
- Resume Resend's verified **free** plan for preview/development, candidate sender `dripwell.hudley.ai`, region `us-east-1`, without claim links, automatic environment pull or email delivery.
- `hudley.ai` is already in the selected team's owned-domain list. The inspected domain is attached to `hudley.ai-site`; current nameservers are Cloudflare. The dedicated sender subdomain is a setup candidate, not an approved public brand or a verified sender. No DNS, existing website, registrar or domain purchase was changed. After resource creation, obtain the actual provider DNS records and use the domain's authorized DNS controls; Cloudflare access and sender verification remain separate dependencies.
- Verify exact project/resource/environment bindings and secret names without exposing values. Then route any required application repair to Coder and independent Auditor; preserve real-data restrictions.

Exact guarded continuation and validation are in [TASK-034](../tasks/TASK-034.md). No message/email is authorized merely by provider provisioning. A synthetic intended-recipient verification needs an explicitly selected owned test recipient and the actual delivery boundary.

## AI access is a separate gate

[TASK-032's audited handoff](AI_ACCESS_UNBLOCK.md) identified the existing selected-model setup transcription path. [TASK-033](AUDIT_FREE_TRANSCRIPTION.md) separately passed actual protected API upload/transcription using the existing allowance, with the real job/result retained and owned audio deleted. The transcript needs review; provider cost/duration telemetry is null. [TASK-036](AUDIT_NATIVE_SETUP_VOICE.md) also passed actual native setup capture, completed callback and unsent composer editing; its partial/inaccurate transcription keeps explicit review and null provider metrics. Full setup chat and recommendations still have the retained actual `gpt-6-luna`403 restriction. Neither Stripe nor Resend login changes that entitlement.

The Owner's ChatGPT subscription preference remains in force. Eligible participating apps can use current Sign in with ChatGPT, but commercial registration, actual allowed architecture, cross-user terms and excluded transcription remain constraints. No partner application, model/provider switch or purchase is made silently. If the Owner later chooses existing Gateway funding, the [selected-team Gateway dashboard](https://vercel.com/loyd-1222s-projects/~/ai-gateway) is the action point. The audited published minimum is $1 with no Gateway Pro prerequisite; this is not a checkout quote or a pilot completion budget. No funding request is repeated here.

Official platform pricing/referral-credit policy, supported hosted reminder cadence, selected administrator/MFA, service/data lifecycle eligibility and the complete PRD section8 two-clinic story remain release gates. Keep protection enabled and `ALLOW_REAL_CLIENT_DATA=false`.
