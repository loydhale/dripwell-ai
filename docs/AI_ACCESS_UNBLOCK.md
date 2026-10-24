# AI access needed to finish DripWell

TASK-032, checked October 2, 2026, 4:23 to 4:28 p.m. Central (21:23 to 21:28 UTC). Application source remains `b61f6aa`; this investigation changes no application code, account funding or selected model.

**There is a partial route forward now:** the currently selected transcription model is listed for Gateway's free tier, and the existing owner voice-upload workflow can complete transcription without calling the blocked language model. Full consultation summaries and setup chat still require language-model access. No new transcription or inference request has been made by TASK-032.

## What was actually checked

Normal authenticated Vercel CLI62.1.0 reads identify `loyd-1222` and the selected `loyd-1222s-projects` team on Hobby. Both the team's Gateway budget list and default-budget list returned empty arrays. No Gateway spending budget is configured. The CLI's npm update-check warning is separate from those successful reads.

The current official [Gateway model listing](https://vercel.com/ai-gateway/models?freeTier=true) contains these exact selected entries:

| Selected model | Public free-tier flag | Capability | Boundary |
| --- | --- | --- | --- |
| `openai/gpt-6-luna` | `false` | Text/image input, structured text output | The retained actual setup request failed with HTTP403 `RestrictedModelsError`, zero provider attempts and null usage. No changed execution entitlement was established. |
| `openai/gpt-4o-transcribe` | `true` | Audio input, text transcription | A candidate for a bounded synthetic check, not proof that this account has successfully transcribed audio. |

Both public entries currently have `hasHipaaCompliantProvider=false`; transcription also has no ZDR provider in that listing. These flags and catalog presence do not establish an agreement or approval for health data. Preserve deployment protection and `ALLOW_REAL_CLIENT_DATA=false`.

The team read does not expose Gateway credit balance. The documented [credit-balance endpoint](https://vercel.com/docs/ai-gateway/sdks-and-apis/rest-api) is at the Gateway origin; installed SDK documentation requires Gateway API-key or OIDC authentication for its helper. No saved token file was read or new key issued. A current balance or successful model response is therefore not claimed.

## The immediately useful next check

Route a separate, reviewed verification brief for consented synthetic owner voice capture, upload and transcription using the existing protected preview and selected OIDC/Blob connection. `/api/setup/upload` with `purpose=voice` runs `SETUP_TRANSCRIPTION`; `apps/web/workflows/recordings.ts` saves an editable transcript and completes that path without language-model extraction.

First confirm the selected account's normal supported authentication and free-credit readiness without extracting credentials into evidence. Then execute one small synthetic operation and require actual transcript, completed job and usage evidence. Ordinary consultation transcription continues to a `gpt-6-luna` summary, so it should wait for supported language access. Do not repeat the unchanged Luna403 or substitute another model.

## Lowest published route for the existing language model

[Current Gateway pricing](https://vercel.com/docs/ai-gateway/pricing) says free credits cover only a subset of models. A credit purchase enables the paid tier; monthly free credits then stop. BYOK through Gateway also requires purchased credits.

The [official credit-purchase documentation](https://vercel.com/docs/agent-resources/vercel-mcp/tools/billing/buy_credits) allows whole-dollar purchases from **$1 to $1,000** and explicitly says AI Gateway credits have **no Pro prerequisite**. This is a published minimum, not a live checkout quote or a guarantee that $1 completes the entire pilot. Applicable payment-processing fees must be reviewed at checkout. No purchase has been authorized or made by this task.

If the Owner chooses this route, the concrete action is to open the selected team's [AI Gateway dashboard](https://vercel.com/loyd-1222s-projects/~/ai-gateway), inspect the balance, select a one-time credit amount, review the total and confirm payment. Keep auto top-up disabled. Do not buy a Vercel plan upgrade to solve this language-model gate; production scheduling remains a separate decision.

Before running paid synthetic verification, agree the spend allowance and set a custom **project budget for `dripwell-ai`**, which covers its deployed OIDC requests. [Gateway budgets](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets) have a $1 minimum and are **soft caps**: the crossing request can complete, changes take time, and a budget is not an exact maximum charge. API-key and user budgets do not cap deployed OIDC traffic. A team budget affects all projects, so it should not be substituted silently. No budget, alert or auto-top-up setting was changed here.

## Preserving the ChatGPT subscription preference

Subscription use is supported for eligible Plus/Pro accounts in participating applications. The current [developer overview](https://developers.openai.com/siwc/token-sharing-open-source) directs paid or remotely hosted apps to an interest form, and [commercial registration](https://developers.openai.com/siwc/request-client-id) remains limited to selected partners. DripWell has no approved registration. No application was submitted.

The [SIWC terms](https://openai.com/policies/sign-in-with-chatgpt-terms/) require user-controlled requests and local user-controlled persistent token storage, prohibit using one user's plan for another user's requests, and require access to plan use without paying for that capability. A future approved integration would need each applicable user's authorized plan and its actual allowed architecture, not the Owner's personal credentials pooled for clinic staff.

[Current limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) exclude audio input and transcription. Thus eligible subscription access would still need a separate transcription route and compatibility work for the required Responses streaming/parameters. [HIPAA eligibility](https://help.openai.com/en/articles/20001069-hipaa-eligible-products-and-functionality) does not list personal Plus/Pro SIWC as the intended clinical service path. Neither paid credits nor partner approval alone establishes health-data eligibility.

The Owner can preserve the subscription requirement and authorize pursuit of the commercial program plus a compatible transcription service, or choose separately funded access for the existing selected Gateway models. Until that choice and actual account setup exist, full model-dependent pilot verification remains blocked. Keep the historical failed jobs, current source checks and protections intact.

## Evidence and scope

Public responses, exact model-entry extraction and selected-team/CLI metadata are retained privately under `/workspace/dripwell-task032-private`, directory0700 and files0600, for independent Auditor review. Catalog rates are public metadata, not measured visit cost. No credentials were inspected, model requests retried, provider switched, purchase made, partnership submitted, email sent, migration applied, source suite repeated or test resource left running. PRD section8 remains incomplete.
