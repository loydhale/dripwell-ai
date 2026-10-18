# Current AI and transcription access handoff

TASK157, checked October 18, 2026, 05:14 to 05:23 UTC, against review-branch head `18c8f30f`. This updates the account handoff, without changing the application or selecting a new service.

**The immediate step is to inspect the existing selected team's access and balance. No purchase is needed to inspect them.** This session can read the connected Vercel user's identity, but cannot read the selected team's project or billing readiness through that connection. Application work can continue independently.

## What works, and what is still unknown

The normal Vercel connector user read succeeds for `loyd-1222`. Two independently dispatched metadata reads, `GET /v2/teams/{teamId}` for the known team and `GET /v9/projects/{idOrName}` for `dripwell-ai`, both return HTTP403 `forbidden` for scope `loyd-1222s-projects`. Those routes stopped without a retry. This is an authorization limitation of this connection, not proof the account has no project, credentials or funds. The response does not establish that signing in again will fix it.

The initial presence check found no Vercel CLI on PATH, in this repository's local executable directory, at TASK070's exact previously recorded cached executable, or through bounded executable globs in the two standard npm npx cache directories. Those checked old locations remain absent. We then restored the official previously used `vercel@62.1.0` into a new private scratch directory, with lifecycle scripts disabled and the exact official registry package, Node engine requirement and integrity verified. This changed no application dependency, lockfile or global installation. The package warns of a known self-upgrade bug; no self-upgrade was attempted.

After reading installed help, one normal `whoami --format json --non-interactive` returned exit1 with `{"loggedIn":false}` and empty stderr. The CLI route stopped before project inspection or login. The restored tool is usable, but its current normal authentication is absent. No auth file, credential value or token was read or copied, and no identity was manufactured. This is a specific tested client result, not absence of every credential. The successful October8 CLI route remains historical evidence.

The selected team's current plan, Gateway balance, payment-method verification, budgets and model entitlement remain **unknown**. The authenticated Gateway credit-balance endpoint was not called because no correctly scoped supported Gateway identity was established. October2's empty budget lists are historical and were never balance evidence. The retained actual `gpt-6-luna` HTTP403 remains unchanged; no inference or transcription request was made here.

## Exact account step

Open [the selected team's AI Gateway dashboard](https://vercel.com/loyd-1222s-projects/~/ai-gateway) in the normal browser session, confirm the team is `loyd-1222s-projects` and the application project is `dripwell-ai`, then inspect the **credit balance in the upper-right corner** and any account-verification notice. This establishes the actual starting point before a spending choice. Do not send tokens, payment details or credential values through chat.

For this assistant's separate connection, [Vercel's current authorization instructions](https://vercel.com/docs/agent-resources/vercel-mcp/tools#sign-in-and-grant-team-access) say the intended account must authorize access to the team that owns the project. Check the connection's selected account and team grant if restoring that route is desired. Existing Vercel permissions still apply; account identity alone does not grant project access. No new login, grant or permission change was attempted here.

A deliberately completed normal CLI sign-in, or a correctly scoped connector grant, would be new access evidence for this assistant. First verify the intended user and selected project after that change. Restoring the binary alone did not recover authentication, and a CLI sign-in would not establish that the separate connector403 is fixed. Do not supply a token through chat.

If the dashboard specifically reports `customer_verification_required`, the [current FAQ](https://vercel.com/docs/ai-gateway/faq) directs the team to add a valid payment method using the link in that error. Payment-method verification, purchasing credits and entitlement to a particular model are separate checks. This session did not observe that error for this account and does not diagnose the historical model403 as a payment-method problem.

## Existing Gateway option, if the Owner chooses to fund it

[AI Gateway is available on all Vercel plans](https://vercel.com/docs/ai-gateway), so a Pro upgrade is not a prerequisite for this option. The [current pricing page](https://vercel.com/docs/ai-gateway/pricing) says free credits cover only a subset of models; purchasing credits moves the team to the paid tier and ends its monthly free credit. BYOK through Gateway also requires purchased credits. None of these facts proves current access to either selected model.

The documented one-time dashboard flow is: click the displayed balance, choose a credit amount, select **Continue to Payment**, review the payment method and total, and confirm only if the Owner chooses to proceed. Keep **auto top-up disabled**. Its actual account setting was not inspected. Payment-processing fees may apply, purchased credits expire after one year, and no current checkout quote was obtained. No amount was chosen and no payment was made.

**The current credit-purchase minimum is unverified.** October2's handoff cited a published $1 minimum from the then-current `buy_credits` tool documentation. That URL now redirects to the general tools page's unavailable-tools section and no longer supplies that minimum. The current pricing and CLI pages read here do not establish a replacement purchase minimum. Do not represent the old $1 figure as today's checkout minimum or a price for completing the pilot. The separately documented $1 **budget** minimum is not a purchase minimum.

Before any separately authorized paid synthetic verification, agree its spending allowance and review a custom **project budget for `dripwell-ai`** under **AI Gateway > Budgets > Projects**. [Current budget documentation](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets) limits project budgets to that project's deployed OIDC traffic. API-key traffic is not attributed to the project; API-key and user budgets do not cap deployed OIDC traffic. A team budget affects the whole team and must not be silently substituted. Budgets are soft caps: the request crossing a limit may finish, and changes take a few minutes. They are not an exact maximum charge. No budget, default or alert was changed here.

## Selected models and the ChatGPT preference

One complete unauthenticated [public catalog response](https://ai-gateway.vercel.sh/v1/models), containing 476 entries, includes both exact selected IDs:

| Existing selection | Current public metadata | Unverified account fact |
| --- | --- | --- |
| `openai/gpt-6-luna` | Language model with text/image/PDF input and text output | Current free/paid eligibility and successful inference |
| `openai/gpt-4o-transcribe` | Transcription model with audio input and text output | Current free/paid eligibility and successful transcription |

This response has no account availability annotations or free-tier flags. October2's public flags, Luna false and transcription true, remain attributed historical evidence. Catalog presence and public rates do not establish usable balance, model entitlement, an actual response or health-data suitability. The [REST reference](https://vercel.com/docs/ai-gateway/sdks-and-apis/rest-api) distinguishes public catalog metadata, authenticated team eligibility and runtime account admission. None was substituted for actual execution.

Preserve the Owner's preference for ChatGPT subscription usage. Today's already-reviewed [OpenAI eligibility documentation](https://developers.openai.com/siwc/token-sharing-open-source) covers open-source and locally hosted apps and directs paid or remotely hosted apps to an interest form. DripWell's approval for its intended commercial hosted use is not established. No application was submitted and no subscription token was reused.

The [current SIWC limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) exclude audio/video input and the transcription API. Eligible subscription use would still need a separately eligible transcription service and compatible application integration. The [SIWC terms](https://openai.com/policies/sign-in-with-chatgpt-terms/) require each authenticated user's own authorized activity, user-controlled runtime and local user-controlled persistent token storage; another user's activity cannot use that person's subscription. Plan use must be available without charging for that capability. The Owner's personal subscription cannot serve other clinic users' requests. No provider, model or routing change was made.

## Resume boundary

After the selected account's relevant access or funding evidence changes, prepare a separately reviewed, bounded synthetic verification using the existing selected services. Do not repeat the unchanged denied model request or infer that this handoff completed a provider test. An account prerequisite parks its service lane; it does not stop independent approved application work or justify repeated status checks.

Protected previews, requested `ALLOW_REAL_CLIENT_DATA=false` and default-disabled maintenance remain required. Current hosted source and effective guards remain unknown. Clinical eligibility, all nine two-clinic pilot stories and all twelve production gates remain open. Stripe sandbox is already complete. Resend domain and platform-admin choices remain the once-requested separate inputs; this task does not ask them again. No purchase, upgrade, provider swap, subscription pooling, partner submission, email, account bootstrap, real-client enablement, application check, migration, merge or production rollout occurred.

Private typed primary responses and source identities are retained under `/workspace/scratch/dripwell-157-coder` for independent review. The existing historical handoffs are unchanged; this document does not certify its own audit, learning or publication.
