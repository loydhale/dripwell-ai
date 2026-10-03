# TASK-034: Connect selected sandbox billing and free email

TASK_ID: TASK-034
PARENT_REQUEST: Owner "please figure it out and do it" and "Just send me the link and I'll log in if you need me to."
PRD refs: F-07/F-11/F-12; section8 sharing/billing/referral boundaries.
GOAL: Finish the already-selected Stripe sandbox and Resend free-plan preview/development setup after actual human Marketplace terms/account completion, without purchasing services or sending messages.
STATUS: BLOCKED, human acceptance pending.

## Ownership and current evidence

CTO owns normal service provisioning and root handoff/STATE. Coder authors any needed application repair under a separately scoped brief; independent Auditor reviews exact setup evidence, source changes, meaningful checks and learning before publication. Do not overlap the current TASK033 worker or mutate its provider/profile/test resources.

Actual actor `loyd-1222`, team `loyd-1222s-projects`/`team_ATVYA30szlVoy5XxAIiaf2OD`, project `dripwell-ai`/`prj_fF0yFggYVFN9pI5dQN33glG2wPyW`, existing root `.vercel/project.json`. Normal CLI62.1 selected installation lists are empty in this active pass. Bounded Resend free-plan add returned `integration_terms_acceptance_required`, `userActionRequired:true`, zero created resources. Private sanitized result is `/workspace/dripwell-provider-setup-private/resend-setup-result.json`, mode0600. No owner completion has been received. The two exact links and human-only requirement are in docs/OWNER_SETUP_ACTIONS.md. Do not repeat the pending question or treat an asynchronous question-tool acknowledgment as acceptance.

## Authorized continuation

Only after actual Owner completion or independent changed account evidence, verify selected team/project and resume normal CLI commands from the root-linked workspace:

```sh
npx --yes vercel@62.1.0 integration add stripe --name dripwell-preview-billing --plan sandbox --environment preview --environment development --no-claim --no-env-pull --non-interactive --scope loyd-1222s-projects
npx --yes vercel@62.1.0 integration add resend/resend-email --name dripwell-preview-email --plan free --metadata domain=dripwell.hudley.ai --metadata region=us-east-1 --environment preview --environment development --no-claim --no-env-pull --non-interactive --json --scope loyd-1222s-projects
```

The `npx --yes` accepts tool invocation only; do not add an integration `--yes` or bypass provider terms. Keep CLI interactive/account requirements as genuine Owner steps. Verify current documented plan/schema before provisioning; any changed paid plan or account requirement is parked rather than accepted silently.

`hudley.ai` is an existing selected-team domain, registrar Third Party, Cloudflare nameservers and attached existing `hudley.ai-site` apex/www. `dripwell.hudley.ai` is a candidate dedicated sender, not verified or a selected official brand; its availability and existing DNS must be checked before any DNS change. Obtain actual provider DNS records after creation; use only authorized dedicated-subdomain DNS controls and preserve existing services. Never invent DNS records, purchase a domain or alter nameservers to bypass unavailable Cloudflare access.

Verify actual created installation/resource IDs, exact dripwell project/environment associations, sender status and nonsecret env names; do not expose credentials or import the full hosted environment into a local test profile. Normal supported SDK/CLI selected bindings are allowed only within a concrete next verification brief. Secret presence is not successful email delivery, sandbox payment, referral credit or runtime health. Protected preview webhook delivery may need a separately verified supported access route; do not disable protection to make a callback pass.

## Exclusions and completion

No live payments, official platform/referral prices, charged plan, upgrade, credit purchase, unrelated account claim, production binding/promotion, actual email/message sending, admin bootstrap or real clinical data. Leave `ALLOW_REAL_CLIENT_DATA=false`. Do not reapply migrations or rerun existing passing source/deployment checks without a relevant change.

Record each actual boundary, cleanup and remaining human dependency. Setup completion requires independently reviewed real sandbox/free resources and exact environment binding; sender, delivery and billing/referral stories remain separately verified gates. Preserve mandatory open-source Vercel Plugin c12 payments/email/marketplace/env-vars/vercel-cli/vercel-api/verification guidance and installed CLI62.1 plus relevant pinned framework docs. Learn and update STATE/CHANGELOG before publishing only reviewed changes to the same review branch.
