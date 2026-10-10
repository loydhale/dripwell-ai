# TASK-022 — Verify the complete owner improvement lifecycle

TASK_ID: TASK-022
TITLE: Verify evidence, proposal testing, activation and rollback together
PARENT_REQUEST: Owner's until-done loop; independent TASK-019 review identified missing integrated evidence for PRD section 8 criterion 6.

GOAL: Verify the existing owner-only improvement lifecycle end to end with isolated synthetic records and unchanged historical visit versions.

## Scope

- Use the actual current application functions/API paths and isolated PostgreSQL, with synthetic clinic/staff/owner/configuration/encounter fixtures.
- Create a meaningful tracked staff adjustment, have the authorized owner review/classify its evidence, propose an in-scope configuration correction, run required synthetic evaluation, activate and roll back.
- Verify the proposal keeps its evidence, evaluation and review history; only the authorized owner can act, with staff/foreign-clinic denial where authority changes.
- Verify historical visits and saved approved prices/configuration snapshots remain pinned across activation/rollback. A later version must not rewrite earlier output.
- Record exact steps, outcomes and environment in the verification evidence; clean synthetic fixtures reliably and do not truncate unrelated data.
- If a concrete defect appears, return a reproducible finding to CTO for a separately bounded Coder repair. Do not silently fix code as Auditor or replace a missing path with a mock.

This is integrated evidence for existing scope, not a new feature. No paid model call, email, hosted mutation, new medical rules, real client data or provider configuration change. Official clinical rules/prices are never invented for live clinics; disposable test values are explicitly synthetic.

## Guidance and acceptance

Read the AGENTS boot sequence, Auditor persona and required Vercel Plugin verification/framework guidance from c12. Explicitly load `/workspace/dripwell-verification.env`; actual preview `.env.local` is not a test target. P-008/P-009 and L-018 through L-020 remain applicable. Read installed docs before any framework-specific API assumption.

PASS requires the real evidence → proposal → test → activate → rollback sequence, owner-only authority, recorded provenance and unchanged historical snapshots. Report partial source/local evidence separately from the still-pending hosted full-provider journey. Append learning or an explicit no-new-learning record, CHANGELOG if files change, and give CTO the concrete next resume point.

Execute after TASK-020/TASK-021 source review. Auditor owns verification/learning documents only; CTO owns STATE/briefs and routes any application repair to Coder.
