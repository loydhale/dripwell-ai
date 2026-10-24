# ChatGPT plan usage for DripWell

Checked against current official documentation on 2026-10-02. Owner prefers their existing ChatGPT subscription, authorized continuing Stripe setup, and selected Resend for email. No AI credits, paid plan, credentials or provider switch were purchased/configured in response.

## What is supported

OpenAI now supports eligible Plus/Pro subscription requests in participating third-party applications through official Sign in with ChatGPT. The earlier blanket statement that subscriptions cannot be used in applications was too broad. Ordinary OpenAI API billing remains separate from ChatGPT billing; this new, explicitly authorized subscription-sharing flow is a distinct integration.

- [Using your ChatGPT plan in other apps and sites](https://help.openai.com/articles/20001542)
- [Separate ChatGPT and API billing](https://help.openai.com/en/articles/9039756-billing-settings-in-chatgpt-vs-platform)

## Why this is not a drop-in for the hosted SaaS

The published developer flow covers open-source and locally hosted applications. Paid or remotely hosted applications are directed to an interest form. Commercial client IDs are offered to selected partners through a waitlist; DripWell has no registered/approved commercial SIWC integration. No interest form or external partnership message has been submitted.

The current SIWC terms expressly prohibit “Using one user's subscription to fulfill another user's requests.” They also require user-controlled runtime origin and local, user-controlled persistent token storage, and prohibit pooling/reselling/sharing usage or authentication tokens. Do not put the Owner's personal ChatGPT credentials in Vercel to fund other clinics, or disguise the existing commercial shared service as the self-service OSS flow. The SIWC terms also state: “Users must be able to use their ChatGPT plan through SIWC without paying you or upgrading to a paid version of your application.” The Help article separately permits charges for an app's subscription, infrastructure, services or premium features; this does not mean every DripWell feature must be free, but the plan-use feature must satisfy its applicable access terms. An approved commercial arrangement would need its actual allowed architecture, access/billing terms and healthcare eligibility verified; approval must not be assumed to permit pooling or a plan-use paywall.

- [Plan-usage overview and eligibility](https://developers.openai.com/siwc/token-sharing-open-source)
- [Commercial client registration](https://developers.openai.com/siwc/request-client-id)
- [SIWC terms](https://openai.com/policies/sign-in-with-chatgpt-terms/)

The current preview still uses the reviewed Gateway model and remains blocked by its actual free-tier HTTP403. Gateway is one model access/billing route, not an additional ChatGPT subscription. A direct OpenAI API connection is another technical route with separate usage billing, but has not been configured or authorized as a replacement for the Owner's preferred subscription route.

## Capability and release boundaries

The documented ChatGPT plan flow expressly excludes audio/video input and the transcription API. Even an eligible plan integration would not cover the current recorded-consultation transcription path. It also imposes request/streaming/tool restrictions, so the existing AI SDK/eve behavior needs version-matched compatibility work and exact completed-response verification after any supported integration is available.

- [Current feature limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
- [Supported model discovery and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)

No plan entitlement, sign-in success, `store:false` setting or partner registration establishes healthcare/service eligibility. Personal Plus/Pro SIWC is not listed as an eligible HIPAA path in the current [eligibility documentation](https://help.openai.com/en/articles/20001069-hipaa-eligible-products-and-functionality); applicable [BAA guidance](https://help.openai.com/en/articles/8660679-how-can-i-get-a-business-associate-agreement-baa-with-openai-for-the-api-services) must be satisfied for the actual service. Keep the existing real-client-data gate disabled until the intended service, agreements and data paths pass the clinic's release review.

## Current independent setup work

Stripe installation was retried with a named sandbox resource and preview/development targets. Vercel returned `integration_terms_acceptance_required`; the Owner must [accept the actual Marketplace terms](https://vercel.com/loyd-1222s-projects/~/integrations/accept-terms/stripe?source=cli) before installation can finish. No billing resource, price or webhook is claimed connected.

Resend is the Owner's selected email provider. Live Marketplace discovery confirms `resend/resend-email`, a free plan, and required owned sending domain/region metadata. The sending-domain question is pending. Use the free plan for isolated setup when the owned domain is supplied; verify its DNS and sender before recipient delivery. No example domain, test sender or invented subscription price is a production binding.

“Reminders” means the requested staff notifications for missing care outcomes or absent/pending wellness decisions. The current implementation's background reconciliation also handles recording cleanup/retention and interrupted processing. It runs every 15 minutes, which Vercel rejects on Hobby. This is a scheduling/hosting limitation, not a separate reminders subscription. The repository cadence is unchanged; this protected preview excludes production cron. Do not interpret the Owner's question as authorization to purchase Pro or alter their reminder requirements.

- [Current Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

## Resume

Retain the deployed reviewed preview, actual failure evidence, protected sessions and source CI PASS. Obtain a supported AI access decision/eligible integration, then route any code change through Coder and independent Auditor. Do not purchase Gateway credits, extract ChatGPT session cookies, reuse another application's OAuth client or submit a commercial-partnership request without explicit authorization. Continue the authorized Stripe install after browser terms completion and Resend provisioning after owned-domain input. Subscription/referral commercial terms and complete live synthetic verification remain outstanding.

## Independent documentation review

AUDIT: V2-SERVICE-PREFERENCE-DOCS
VERDICT: PASS
PRD_AUDIT: pass; this records current service preferences and verified integration gates without changing product scope or runtime.

The Auditor independently read the current official SIWC Help, developer eligibility, model/inference, preview-limitations and September 29 terms, plus current OpenAI HIPAA eligibility/BAA guidance. The assessment correctly distinguishes supported participating-app subscription usage from the commercial registration, user-control, no-charge, cross-user and audio restrictions. Read-only Vercel CLI 62.1.0 discovery and Resend product help independently confirm its slug, free plan and required owned-domain/region metadata. The actual Stripe retry's emitted browser-terms gate is recorded without claiming a resource or repeating an installation. Reminder source confirms the missing-outcome/decision notifications and cleanup/recovery meaning; cadence and preview exclusions remain unchanged. No app code, provider credentials, clinical data or partnership submission changed. Documentation-only review required no source-test rerun.
