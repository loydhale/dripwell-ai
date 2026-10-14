# TASK-023 — Deploy and verify the reviewed continuous-loop repairs

TASK_ID: TASK-023
TITLE: Verify the immutable preview stage and updated protected deployment
PARENT_REQUEST: Owner's until-done loop; independently reviewed TASK-020/TASK-021 repairs should reach the reviewable synthetic preview.

GOAL: Deploy the exact reviewed application source to the existing protected preview with the documented Hobby-only cron adaptation and confirm its runtime boundaries.

## Scope

- Use the reviewed fixed-head commit published after TASK-024's test-target repair; resolve the full SHA from the CTO handoff and successful CI. Do not deploy `0b97022`, whose actual CI failed the local-only test guard. No application edits by this Auditor; CTO owns deployment operations.
- Independently compare every tracked stage file directly against the chosen Git blobs. Permit only `apps/web/vercel.json` with `crons: []` for this preview and one identical nonsecret `.vercel/project.json` link. Reject any environment file, token, fixture helper or unrelated difference.
- Confirm original production cron, project/team/root/Node24/OIDC and protected synthetic-only settings stay intact. Do not reapply the already-verified ten migrations.
- Require successful source CI at the selected commit before deploying. Inspect actual READY/build output, native bundle guard and alias assignment; never equate a queued deployment with success.
- Use the existing retained fictional owner/location/protection session if needed for scoped web reads. Verify updated archive paging response and job-result status compatibility using existing synthetic jobs; do not run a paid model request, create actual patients or alter hosted clinical records.
- Preserve all known Gateway, email/billing/scheduler/service eligibility gates. This operation does not promote production or enable real data.

## Guidance and acceptance

Read the AGENTS boot sequence and Auditor persona. Use Vercel Plugin deployment/CLI/verification guidance from c12 and current framework/CLI docs. Follow P-011/P-012, G-007/G-008/G-009 and L-024. Credentials, private fixture sessions and helper scripts stay outside Git.

PASS requires exact stage/source comparison, no secret uploads, actual deployment READY and authenticated scoped response evidence. Record deployment/source/URL and any limited checks separately from the still-unverified full live-provider pilot. If a provider or technical failure occurs, return exact actionable evidence without silently changing source, protection, model or plan.

Auditor owns `docs/AUDIT_CONTINUOUS_DEPLOYMENT.md` and may append learning/CHANGELOG/SESSION_LOG. CTO owns STATE/briefs/deploy configuration. Coordinate append-only memory with the owner-lifecycle Auditor to avoid concurrent overwrite.
