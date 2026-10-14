# TASK-024 — Honor the documented isolated CI database in job regressions

TASK_ID: TASK-024
TITLE: Remove a local-only test database port assumption
PARENT_REQUEST: Until-done loop; actual source CI `37009796929` at `0b97022` failed before collecting the six new job-result regressions.

GOAL: Run the meaningful job-result regressions against both documented isolated local and CI databases while rejecting unintended database targets.

## Evidence and scope

GitHub's actual failed step is `test:unit`. `lib/job-results.integration.test.ts:21` requires hostname `127.0.0.1` and port `55432`; CI intentionally uses `localhost:5432/dripwell_verification`, with explicit identical `DATABASE_URL` and `TEST_DATABASE_URL`. The other 24 unit checks passed; all preceding migrations/builds/types/other suites passed. This is a test target guard problem, not a missing live provider.

- Fix only the new suite's target validation using the project's established explicit disposable-database convention.
- Accept documented local and CI loopback bindings and the verification database. Retain explicit `TEST_DATABASE_URL`, PostgreSQL protocol and rejection of remote/ordinary application databases; do not remove the guard or default to preview `.env.local`.
- Keep all six meaningful tests and their behavioral assertions. Do not skip CI cases or weaken application authority/data handling to make the suite pass.
- Run the suite under its normal project command using an explicitly guarded local fixture and, if useful, the localhost spelling. Independently review the target-boundary change, then require a fresh successful CI run at the published fixed commit.

No application behavior, schema, provider, hosted setting, or real-client data change. Coder owns this test-file edit only; CTO owns STATE/briefs; Auditor reviews and records learning.

## Acceptance criteria

1. Documented local and CI verification bindings are accepted; remote/unintended targets are rejected before connection/mutation.
2. The six new real-PostgreSQL job/result/poller checks actually execute and pass with zero skips.
3. Independent scope review passes and fresh source CI completes migrations, types, both builds and all suites. Do not deploy the failed `0b97022` stage.
