# TASK-019 — Continuous-loop completion gap review

TASK_ID: TASK-019
TITLE: Find the next unblocked gap in the approved consultation pilot
PARENT_REQUEST: Owner: "Please create a loop so that you don’t stop working on this until it’s down ."

GOAL: Independently compare the implemented v2 app and verification evidence with the approved PRD and produce a concrete next-task queue.

## Scope

- Read the AGENTS boot sequence and Auditor persona.
- Inspect all F-01 through F-12 source acceptance paths and PRD section 8, prioritizing unfinished functionality and known source findings.
- Confirm which earlier claims are covered by meaningful tests/runtime evidence. Identify a reproducible in-scope source defect or missing acceptance behavior before recommending a change.
- Produce a bounded, prioritized queue with file references, expected behavior, verification and dependency status. Separate unblocked implementation from external account/domain/commercial decisions.
- Review the saved continuous-work instructions for a truthful stop/resume contract.

Do not change application code, introduce new scope, run paid requests, send emails, submit partnership forms, reapply hosted migrations or use real client data. No speculative hygiene work solely to keep the loop busy.

## Relevant guidance

Vercel Plugin skills are available from `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`; read the relevant verification/framework skills and version-matched installed docs when applicable. Root ICM/eve structure stays intact. Important prior lessons: L-020 through L-025; patterns P-008 through P-012; gotchas G-005 through G-010.

## Acceptance criteria

1. Evidence-backed completion matrix maps every approved feature to source/verification and outstanding work.
2. At least one concrete source gap is routed if found; otherwise explicitly state that none was found and preserve the unresolved live-provider gates.
3. Scheduled continuation does not imply an always-running worker, unavailable coding capabilities or completed live verification.
4. Findings are returned to CTO before changes; source remains untouched. Auditor may write `docs/CONTINUOUS_GAP_REVIEW.md` and append learning/CHANGELOG/SESSION_LOG, but CTO owns STATE and orchestration documents.
