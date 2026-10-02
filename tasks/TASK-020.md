# TASK-020 — Reach and restore older archived consultations

TASK_ID: TASK-020
TITLE: Search and paginate the full retained consultation archive
PARENT_REQUEST: Owner authorized finishing DripWell and a continuous work loop; independent TASK-019 review found an existing F-08 acceptance gap.

GOAL: Let authorized staff find and restore retained archived consultations beyond the first 250 records and beyond one year.

## Evidence and scope

Independent Auditor found `apps/web/lib/clinic.ts:316` caps consultation fetches at 250; `apps/web/components/dashboard.tsx:34-42` searches only the fetched subset and limits created dates to at most the last 365 days. `/api/clinic` provides no server search/cursor. A retained older archived record cannot be found/restored from the app.

- Implement bounded server-backed search and pagination using the existing database and verified tenant/location scope.
- Keep ordering/cursors deterministic, bound query/page sizes and validate input. A foreign cursor/search must not expose or mutate another clinic's records.
- Make archive browsing include all retained ages, with optional date filtering if useful. Search/restore must be reachable for an older-than-one-year record.
- Retain existing stage, reversible archive reason/history and restore authority. Preserve reporting-period/date denominators; archive browsing is not a change to commercial metrics.
- Wire usable search and pagination/load-more controls with loading/error/empty behavior. Do not merely raise the server limit or fetch all history into the browser.
- Write a meaningful actual-database regression for older retained results beyond 250, stable pages and tenant boundaries; verify the restore path remains usable.

No new feature scope, provider changes, migration reset, real client data, account upgrades or email sends. Coder chooses the smallest API change consistent with existing callers and patterns.

## Likely files

- `apps/web/lib/clinic.ts`: bounded scoped query.
- `apps/web/app/api/clinic/route.ts` or existing consultation collection route: query validation and response.
- `apps/web/components/dashboard.tsx`: full archive server search/pagination.
- Existing actual-PostgreSQL test suite: retained archive and boundary regression.

## Guidance

Read AGENTS boot sequence and Coder persona. Required Vercel Plugin skills source is c12; load relevant Next.js/React/current installed documentation. Follow P-008 and existing query scoping. G-005: use pinned pnpm. G-008: retain proxy/TLS. Explicitly load `/workspace/dripwell-verification.env` for disposable PostgreSQL fixtures; do not use the hosted preview `.env.local` as a test target.

## Acceptance criteria

1. A legitimate archived consultation outside newest 250 and older than one year is searchable and can be restored from the interface.
2. Requests stay bounded; pages/search do not silently omit matching retained records, repeat records or lose tenant/location scope.
3. Invalid input and foreign scope cannot expose records. Reporting counts/period filters preserve their established meaning.
4. Existing board triggers, archive/restore auditing and authority remain intact.
5. Relevant tests/types pass; independent Auditor checks changes and meaningful synthetic behavior before commit/publication.

Coder owns application/test edits only. CTO owns task briefs, STATE and orchestration docs; Auditor owns review/learning evidence. Do not commit or publish before independent review.
