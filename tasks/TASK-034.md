# TASK-034: Connect selected sandbox billing and free email

TASK_ID: TASK-034
PARENT_REQUEST: Owner "please figure it out and do it" and "Just send me the link and I'll log in if you need me to."
PRD refs: F-07/F-11/F-12; section8 sharing/billing/referral boundaries.
GOAL: Finish the already-selected Stripe sandbox and Resend free-plan preview/development setup after actual human Marketplace terms/account completion, without purchasing services or sending messages.
STATUS: BLOCKED remaining email/billing boundaries; completed Stripe sandbox/price setup has independent scoped readback PASS, final reviewed publication pending.

## Ownership and current evidence

CTO owns normal service provisioning and root handoff/STATE. Coder authors any needed application repair under a separately scoped brief; independent Auditor reviews exact setup evidence, source changes, meaningful checks and learning before publication. Do not overlap the current TASK033 worker or mutate its provider/profile/test resources.

Actual actor `loyd-1222`, team `loyd-1222s-projects`/`team_ATVYA30szlVoy5XxAIiaf2OD`, project `dripwell-ai`/`prj_fF0yFggYVFN9pI5dQN33glG2wPyW`, existing root `.vercel/project.json`. Historical October2 selected installation lists were empty and the bounded Resend request returned `integration_terms_acceptance_required`, zero resources. That retained checkpoint is superseded by the actual October3 outcomes below, not erased. Do not repeat the old terms question or infer account readiness from screenshots alone.

## October3 changed authority and actual continuation

The Owner supplied two Vercel “Terms Accepted” screenshots and explicitly delegated starter commercial pricing. Current pinned CLI help and relevant Vercel Plugin guidance were checked before execution. One normal sandbox add actually returned ready connected resource `ir_WKeIBgBxmVampeYA` / installation `icfg_ZjwwL4xPqtcbyk5QQpguMhwU` for Preview and Development, with no claim or environment pull. Normal selected-project integration and environment reads confirmed the connection and nonsecret binding names.

The delegated USD199/month starter was created as actual sandbox Product `prod_VNJvkxq3tEki23` and Price `price_1UMZHUECTnhgX9UT9BTCFALy`; expanded provider readback confirmed active/test-mode/fixed 19900 minor units (USD199) per month/count1/licensed/per_unit with no quantity transform or custom amount. Deterministic product/price idempotency keys were preserved through one transport-only recovery: Stripe23's explicit HTTPagent initially ignored the inherited proxy, then the documented `httpAgent` option plus Node24 `--use-env-proxy` used the existing sidecar/TLS/auth. No application transport or identity changed. The initial combined exec output does not provide raw split streams or exact whole-CLI timestamps; observed chunks and actual result timestamps are retained without reconstructing missing evidence.

Normal CLI stdin added only the actual `STRIPE_PRICE_ID` to Preview and Development. Both operations exited0. Private setup artifacts are under `/workspace/dripwell-task034-resume-private`,0700/0600. Independent selected resource/project/protection readbacks PASS. Preview price ID was initially sensitive and omitted by normal CLI env run; pinned CLI rejects Secret-to-Config update, caught before execution. One independently approved exact preview-only remove/add --type config succeeded; the fresh-empty-cwd preview SDK then retrieved the actual Price/Product and literal false gate. New recordEMUIRkJauFTTU86Z isencrypted/config/preview-only with no branch; all26 other metadata records including Development match the immediate baseline, no Production binding. Earlier normal development SDK read retains its dotenv/process provenance limit. No webhook secret, checkout, paid invoice or referral credit is established by setup.

Current Resend Marketplace plans list paid Pro/Scale. One independently scoped explicitfree/no-connect/no-claim/no-env-pull request returned HTTP400 “Billing plan is disabled: free.” No paid fallback, project connection or email was made. Current direct Resend pricing offers a free account; the one new pending owner handoff is login at `https://resend.com/login` and direct entry of a free-account `RESEND_API_KEY` into the selected Vercel Preview/Development environment settings. Never enter keys in chat, repeat the unchanged failed request or purchase paid native plans. Actual sender DNS, authorized domain access and explicitly selected owned recipient remain separate gates.

## Authorized continuation

The following original guarded commands record the earlier plan. The Stripe add already completed and the explicit free Resend attempt already returned the changed plan blocker. Do not replay them. Resume only a changed remaining boundary through a separately reviewed exact plan:

```sh
npx --yes vercel@62.1.0 integration add stripe --name dripwell-preview-billing --plan sandbox --environment preview --environment development --no-claim --no-env-pull --non-interactive --scope loyd-1222s-projects
npx --yes vercel@62.1.0 integration add resend/resend-email --name dripwell-preview-email --plan free --metadata domain=dripwell.hudley.ai --metadata region=us-east-1 --environment preview --environment development --no-claim --no-env-pull --non-interactive --json --scope loyd-1222s-projects
```

The `npx --yes` accepts tool invocation only; do not add an integration `--yes` or bypass provider terms. Keep CLI interactive/account requirements as genuine Owner steps. Verify current documented plan/schema before provisioning; any changed paid plan or account requirement is parked rather than accepted silently.

`hudley.ai` is an existing selected-team domain, registrar Third Party, Cloudflare nameservers and attached existing `hudley.ai-site` apex/www. `dripwell.hudley.ai` is a candidate dedicated sender, not verified or a selected official brand; its availability and existing DNS must be checked before any DNS change. Obtain actual provider DNS records after creation; use only authorized dedicated-subdomain DNS controls and preserve existing services. Never invent DNS records, purchase a domain or alter nameservers to bypass unavailable Cloudflare access.

Verify actual created installation/resource IDs, exact dripwell project/environment associations, sender status and nonsecret env names; do not expose credentials or import the full hosted environment into a local test profile. Normal supported SDK/CLI selected bindings are allowed only within a concrete next verification brief. Secret presence is not successful email delivery, sandbox payment, referral credit or runtime health. Protected preview webhook delivery may need a separately verified supported access route; do not disable protection to make a callback pass.

## Exclusions and completion

No live payments, charged plan, upgrade, AI credit purchase, unrelated account claim, production binding/promotion, actual email/message sending, admin bootstrap or real clinical data. The October3 explicit pricing delegation authorizes the starter configuration in TASK040, without changing clinic medical catalog authority or spending restrictions. Leave `ALLOW_REAL_CLIENT_DATA=false`. Do not reapply migrations or rerun existing passing source/deployment checks without a relevant change.

Record each actual boundary, cleanup and remaining human dependency. Setup completion requires independently reviewed real sandbox/free resources and exact environment binding; sender, delivery and billing/referral stories remain separately verified gates. Preserve mandatory open-source Vercel Plugin c12 payments/email/marketplace/env-vars/vercel-cli/vercel-api/verification guidance and installed CLI62.1 plus relevant pinned framework docs. Learn and update STATE/CHANGELOG before publishing only reviewed changes to the same review branch.
