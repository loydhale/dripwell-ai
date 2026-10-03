# Selected services and remaining owner actions

Updated October 3, 2026. The protected synthetic preview still runs reviewed source `b61f6aa`; the new commercial source is undergoing independent review before publication and deployment. Keep `ALLOW_REAL_CLIENT_DATA=false`.

## Stripe sandbox connected

The Owner supplied Vercel “Terms Accepted” screenshots. The subsequent normal CLI operation actually created and connected sandbox resource `ir_WKeIBgBxmVampeYA` to the selected `dripwell-ai` project for Preview and Development only. No new terms login is needed for this completed step.

The Owner also delegated initial commercial prices. The starter is USD199 per clinic account/month, quantity1, with a USD50 one-time referral credit on the first qualifying paid platform subscription. The trial remains14days/10initial consultations with no automatic paid enrollment. The [commercial configuration](COMMERCIAL_CONFIGURATION.md) describes editable settings, explicit versioned referral activation and the separate requirements for future price rotation. The [independent commercial audit](AUDIT_COMMERCIAL_CONFIGURATION.md) passes source/compiled forms/owned cleanup; reviewed publication/deployment and actual billing remain separate boundaries.

Actual Stripe sandbox Product `prod_VNJvkxq3tEki23` and Price `price_1UMZHUECTnhgX9UT9BTCFALy` returned active, test-mode,19900 minor units (USD199) per month/count1/licensed/per_unit. `STRIPE_PRICE_ID` was added through normal CLI stdin for Preview and Development. No checkout, payment or referral credit was executed. A webhook signing secret, protected callback access, selected platform administrator/MFA and actual payment/referral verification remain separate gates. Independent selected-project/protection and remote-only preview readback passed with the literal false gate. The nonsecret preview price ID was corrected from secret to config storage; all26 other environment metadata records including Development are unchanged, with no Production binding. Provisioning is not billing completion.

## Free Resend account handoff is pending

The supported Marketplace no-connect request for the explicit free plan returned HTTP400, “Billing plan is disabled: free.” Current native choices are paid Pro/Scale. No paid fallback was purchased and no email was sent. Do not repeat that unchanged free-plan request or the earlier terms links.

Resend still offers a direct free account. The one pending handoff is to log in at [Resend](https://resend.com/login), create a free-account API key and enter `RESEND_API_KEY` for Preview and Development in the selected [Vercel environment settings](https://vercel.com/loyd-1222s-projects/dripwell-ai/settings/environment-variables). Enter the key only in Vercel, never in chat. A successful account login alone is not a verified environment binding or delivered email.

The existing owned Cloudflare-managed `hudley.ai` supplies candidate dedicated sender `dripwell.hudley.ai`. Actual provider DNS records, authorized DNS access, sender verification and an explicitly selected owned test recipient are still required. Preserve the existing website and DNS; do not invent records or send email merely because a key exists. These are the remaining boundaries of [TASK-034](../tasks/TASK-034.md).

## ChatGPT CLI is already signed in

Normal installed Codex CLI status reports “Logged in using ChatGPT.” Another developer login link is unnecessary. The [current independently co-signed route review](CHATGPT_CLI_ROUTE_REVIEW.md) establishes supported local execution, including summaries and data formatting, while distinguishing it from app entitlement. Official app-server documentation expressly excludes commercial or hosted services from that authentication. Commercial Sign in with ChatGPT remains selected-partner access; an eligible app uses its own registered identity and each user's allowed connection. No partner application or credential transfer occurred.

Eligible local/open-source subscription integration and eligible local Healthcare/Regulated Codex are real supported paths under their applicable conditions. The current login method does not prove those conditions for DripWell. The reviewed SIWC flow excludes audio/video/transcription. [Actual protected API transcription](AUDIT_FREE_TRANSCRIPTION.md) and [native setup recording/editable review](AUDIT_NATIVE_SETUP_VOICE.md) passed separately, with partial text and null provider metrics; they do not establish ordinary consultation summaries or recommendations. The deployed ordinary-language-model HTTP403 remains unresolved. No AI credits were purchased or provider/model changed.

## Remaining release evidence

The full [PRD section8](../PRD.md) story still needs two clinics, actual consultation recording/transcription/model output, exact approvals, secure recipient sharing/PDF, board/outcomes, trials, paid referral credit, roles and retention evidence. The [hosted per-visit timer](AUDIT_HOSTED_REMINDER_TIMER.md) passes its own scoped story; required global recovery/retention cadence needs a supported plan and no upgrade is authorized. Actual service/data-path eligibility and transcript/document/backup lifecycle review remain required before real client data.

The October2 terms-only checkpoint and unsuccessful free Resend request are preserved in TASK034 and prior evidence. They are historical and do not supersede the actual connection and changed free-plan blocker above.
