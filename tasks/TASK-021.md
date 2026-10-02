# TASK-021 — Return saved results for completed generation jobs

TASK_ID: TASK-021
TITLE: Align successful generation status with addressable result reads
PARENT_REQUEST: Owner's until-done loop; independent TASK-019 real-database review found an existing generation-result gap.

GOAL: Return an authorized saved generation result when its job is successfully complete, including already-persisted deterministic jobs.

## Evidence and scope

Auditor reproduced deterministic initial generation storing `status: COMPLETED` and a real persisted result; `apps/web/app/api/jobs/[id]/route.ts:19` exposes the result only when the status is `COMPLETE`, producing a null result for that successful job.

- Trace current writers/readers for deterministic initial and wellness, AI/workflow generation, and their polling/UI consumers.
- Align successful status/result handling using the smallest consistent approach. Preserve readability of already-persisted `COMPLETED` and `COMPLETE` successes without a data reset.
- Keep tenant/location/identity checks intact and do not expose partial or failed job data as a successful result.
- Add meaningful regression evidence from actual scoped jobs, including deterministic success with saved result, a workflow-style successful record, unfinished/failed status and foreign-tenant denial.
- Keep response contracts compatible with current clients and preserve status/cost/audit provenance.

No fabricated AI/model response, paid provider call, real client data, schema reset, broad refactor or new scope.

## Guidance

Read the AGENTS boot sequence, Coder persona and relevant Vercel Plugin guidance from c12; use installed Next.js/Workflow docs as applicable. Follow L-013 status-filter tracing, L-024 actual provider evidence and P-008 verified identity. Explicitly load `/workspace/dripwell-verification.env` for isolated PostgreSQL verification; preview `.env.local` is not a disposable test database.

## Acceptance criteria

1. Authorized job GET returns the exact persisted result for existing successful deterministic generation rather than null.
2. Workflow-style completion and current consumers continue to work; unfinished/failed jobs do not become successes.
3. Foreign clinic/location/role cannot access job results. Existing verification and any meaningful added test pass.
4. Independent Auditor review and learning complete before commit/publication.

Execute serially after TASK-020 implementation. Coder owns source/tests; CTO owns STATE/briefs; Auditor owns review/learning. Do not commit or push directly.
