# ChatGPT CLI and application access review

Reviewed on 2026-10-03 after the Owner requested a ChatGPT CLI login link. This is a current, read-only route investigation, not a successful application-model request or an approval of a new inference service. The prior [plan assessment](CHATGPT_PLAN_ASSESSMENT.md) remains historical evidence.

## What the Owner is right about

ChatGPT subscriptions do support Codex CLI sign-in. Current official documentation also supports programmatic Codex execution, structured output, SDK integration and custom app-server clients. Subscription usage is not limited to an interactive terminal. The noninteractive examples include formatting supplied data and producing summaries, so describing every supported CLI use as exclusively writing code would be inaccurate.

The actual managed workspace has `/opt/codex/bin/codex`, version `0.159.0-alpha.3`. Normal `codex login status` exited0 and reported `Logged in using ChatGPT`. Normal help confirms `--device-auth`, `exec --json`, `--output-schema` and experimental app-server transports. No login, logout, device authorization or inference was started. No auth file, cookie or token was inspected. This proves the existing CLI's authentication method, not the Owner's account identity, plan, remaining allowance, selected-model entitlement or eligibility for DripWell's application.

There is no missing ChatGPT login step for the current coding work. If that permitted developer login later expires, the documented headless flow is `codex login --device-auth`: the CLI generates a fresh verification URL and one-time code, the user signs in, and normal status verifies completion. A static link alone cannot complete that flow. No redundant login request is needed now.

## The boundary for the hosted DripWell app

The [current official app-server authentication documentation](https://developers.openai.com/codex/app-server/#auth-endpoints) expressly states:

> App-server authentication has never been permitted for commercial or hosted services.

The same paragraph permits continued use by local or open-source applications and recommends migrating to Sign in with ChatGPT (SIWC). The [SDK documentation](https://developers.openai.com/codex/sdk/) describes programmatic local Codex agents, internal tools, applications and coding automation. Its technical embedding support does not remove the explicit authentication restriction. Wrapping the installed signed-in CLI or SDK in a paid shared Vercel endpoint would not establish supported subscription access for that endpoint.

For the separately documented SIWC route, [current eligibility](https://developers.openai.com/siwc/token-sharing-open-source) covers open-source and locally hosted apps. Paid or remotely hosted apps are directed to the commercial program; [commercial client registration](https://developers.openai.com/siwc/request-client-id) is currently offered to selected partners. No approved commercial DripWell client or partner acceptance was established in this review. No application or external message was submitted.

The [September29 SIWC terms](https://openai.com/policies/sign-in-with-chatgpt-terms/) require the connected app's own identity and supported flow, user-controlled runtime, requests for the authenticated user's activity or expressly authorized automation, and local/user-controlled persistent token storage. They explicitly prohibit:

> Using one user’s subscription to fulfill another user’s requests.

They also require users to be able to use their plan through SIWC without paying for or upgrading the app. The [Help article](https://help.openai.com/en/articles/20001542) separately permits app charges for infrastructure, services or premium features; it does not remove the plan-use access requirement. A personal subscription cannot be pooled across clinic staff or other clinic owners under these terms.

## Concrete supported options

| Purpose | Current supported path | What remains to verify |
| --- | --- | --- |
| Develop and review DripWell | Existing ChatGPT-authenticated Codex CLI in this managed coding workspace | No new login needed; normal account limits still apply |
| Owner-controlled synthetic local application work | A separately scoped local/open-source app using its own SIWC registration and the Owner's consent; direct eligible Responses requests or the documented stdio app-server adapter | Eligibility, local/user-controlled credential handling, exact app identity, completed inference and no other-user triggers; this is not the paid shared PWA |
| Shared paid DripWell subscription integration | An actually approved commercial SIWC arrangement, with each user's permitted account connection and its actual allowed architecture | Approved client, applicable usage/access terms, per-user boundaries and feature/service eligibility; no approval inferred |
| Existing Gateway application inference | The current deployed route remains unchanged | Its retained ordinary-language-model HTTP403 is still unresolved; this CLI status did not retry or authorize Gateway |

The local SIWC path is technically concrete. Its [official sign-in flow](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) prepares a persistent opaque host ID, state, nonce and PKCE; registers the app under its own name; exchanges the code using its issued client ID; validates the ID token and granted plan scope; and protects the app's own credentials. It must not reuse the coding assistant's OAuth identity or auth cache as the app's integration.

The [official SIWC app-server adapter](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server) supplies that app-authorized access token only to a local child process, sets the Responses provider, uses stdio, initializes with the app's own stable name/title/version, and checks `turn/completed` with `turn.status=completed`. The documentation cautions that `model/list` can return a bundled catalog and is not an entitlement check. The app owns token renewal and restarts the child before resuming its saved thread. A later implementation would need a separate bounded Coder task and independent verification; none was executed here.

The [self-hosted VM guidance](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms) applies to an open-source app's own selected user/workspace and stable VM host ID. Together with the terms, it does not authorize a shared managed multi-tenant token pool. No credentials were transferred.

## Capability and real-data boundaries

The [current SIWC limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) expressly exclude audio/video input, the Files upload API and transcription. Eligible inference uses `store:false`, `stream:true`, supported input/context and tool shapes; unsupported fields and hosted tools must be omitted. A CLI sign-in cannot establish recorded-consultation transcription or visual-video processing. The existing selected setup-transcription evidence remains a distinct provider boundary.

Current [HIPAA eligibility](https://help.openai.com/en/articles/20001069-hipaa-eligible-products-and-functionality) and [Codex configuration guidance](https://developers.openai.com/codex/hipaa-configuration) do permit eligible local Codex clients with an eligible Healthcare/Regulated workspace, applicable BAA, required access and managed controls. This is more precise than saying all subscription-based health workflows are impossible. An ordinary ChatGPT login does not establish those conditions, does not cover third-party services, and does not authorize PHI in Codex cloud. Keep the protected preview and `ALLOW_REAL_CLIENT_DATA=false` until all applicable service and full-story gates pass.

## Evidence and handoff

Eighteen first-party documentation GETs returnedHTTP200 on 2026-10-03 between19:55:33Z and19:57:17Z. Raw responses, extracted relevant text, requested/final URLs, status, timestamps and hashes are retained privately under `/workspace/dripwell-task041-private`. The Codex auth/SDK/app-server/noninteractive/pricing and HIPAA URLs redirected normally from `developers.openai.com` to `learn.chatgpt.com` documentation; both addresses are recorded. No API entitlement is inferred from those GETs.

The read-only CLI result and boot/source provenance are retained separately. Research produced this document only; no application dependency, provider/model, auth profile, hosted fixture, deployment, account charge, message or email changed. The existing `b61f6aa` protected preview's ordinary-model denial and full pilot gaps remain unchanged. Independent review of this authored report is required before publication; the investigator does not self-audit it.

Learning for the CTO: verify the exact CLI and normal status before asking for another sign-in; distinguish technical SDK embedding from authentication permission; and evaluate coding, one-user local work, shared commercial service, audio/video and healthcare eligibility as separate boundaries. Existing L-025/P-017 remain relevant. Do not turn a valid developer login into a blanket application entitlement or dismiss supported subscription integration altogether.
