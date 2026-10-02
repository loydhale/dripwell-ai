# Continuous source repairs

Date: 2026-10-02. Branch: `feat/dripwell-consultation-v2`.

## TASK-020, retained archive search and restore

AUDIT: TASK-020
VERDICT: PASS
ATTEMPT: 1
BASE PARENT: `d88de29b16d13e8eb4e1ed50b5d5e75310ebb3a5`

The five-file app/test patch addresses the reproduced F-08 gap without migrations or provider changes. Server queries validate the search, archive flag, UUID cursor and page size, use the current verified tenant and selected active location, and return at most 50 records by default or 100 when explicitly requested. Immutable creation time plus UUID provides deterministic keyset ordering across equal timestamps. Cursor anchors must belong to the same tenant, location, archive and search/date filters. Search escapes literal SQL wildcard characters and matches visit references or staff-name words. Archive browsing includes all retained ages; report denominators still use the selected date period and include archived visits.

The browser sends debounced search to the server, starts a new bounded page when filters change, deduplicates appended pages and rejects stale request responses. Pagination errors preserve existing cards and expose retry. Stage and archive/restore mutations retain their existing authority, audit history and reminder reconciliation.

Independent evidence:

- Both new regressions passed against the explicitly selected isolated PostgreSQL database, 2/2 with zero skips. They walk all 251 retained rows through bounded pages with equal creation timestamps, find the 500-day-old target, preserve the report denominator, search staff names, restore with the expected actor/stage event, and reject foreign-tenant, foreign-location, unknown, mismatched-search and malformed cursors. Invalid sizes/search and report periods fail appropriately. The Coder additionally reported the full clinic suite 15/15, web types and optimized Next build PASS; those broader checks were not repeated without a new concern.
- The actual optimized Next.js 16.3.8 artifact started separately on localhost:4175, with the guarded localhost:55432 `dripwell_verification` database, trusted local APP_URL and `ALLOW_REAL_CLIENT_DATA=false`. Model/email keys were empty; no provider request or email was made. The homepage and authenticated workspace rendered, with no framework overlay or recorded browser errors.
- A dedicated fictional browser fixture contained 251 archived records, one recent active record and a separate second location. Real database-backed staff session authentication was used. The archive initially rendered 50 of 251; Load more rendered 100 unique cards. Server search returned the 500-day-old target as one matching card despite the prior 250-record cutoff. The report denominator remained 251 throughout search and after changing the reporting range to seven days.
- A deliberate browser fetch failure on one pagination request retained all 50 existing cards and displayed an error; the visible retry recovered to 100 unique cards. A deliberately delayed older, actual search response could not overwrite the newer target search after both responses completed. These are isolated client error/ordering injections, not fabricated application/provider output.
- The target's actual Restore visit button completed in the real browser. A separate scoped database read confirmed `archivedAt:null`, preserved `WELLNESS_RECOMMENDATION_TBD` stage and `TBD` decision, and a `consultation.restore` event with the correct staff actor and expected after-state. Subsequent archive search showed zero matches and the archive total fell to 250. Switching to the second location and opening its archive returned only its single location-specific record and denominator 1.
- Actual authenticated HTTP reads of `pageSize=0`, `cursor=invalid` and `archived=invalid` returned 400 `VALIDATION_ERROR`. The actual-PG regressions independently cover valid-but-foreign scope.
- The dedicated browser fixture was removed, with tenant count zero confirmed; the named browser session and separate production server were closed. No unrelated records were truncated, application code edited by the Auditor, hosted resource mutated or real-data flag enabled.

During automation, agent-browser's empty fill did not fire the expected React clear transition. Real Control+A/Backspace correctly cleared and refreshed the results; this was not classified as a product defect. Verification used fresh snapshots and the rendered Restore visit control rather than assuming a button label.

Guidance: Vercel Plugin verification, agent-browser and agent-browser-verify from c12; installed agent-browser 0.38.1 core documentation, Next.js 16.3.8 route-handler documentation and the existing version-matched app contracts. The root ICM development folders and authored Eve/application Workflow folders remain unchanged.

FINDINGS: none blocking in TASK-020.
PATTERN_VIOLATIONS: none.
GOTCHA_HITS: G-005 explicit pinned/local tooling and synthetic database selection.
PRD_AUDIT: PASS, repair fulfills existing archive search/restore and reporting requirements.

The CTO's accompanying `docs/VERIFICATION_REPORT.md` factual correction also passes review: it leads with the actual October 2 connected preview/79-check/deployment evidence and Gateway denial, and dates the superseded October 1 absence of live bindings. It preserves historical evidence and makes no new runtime or provider-success claim.

This PASS covers source and isolated synthetic runtime behavior. The repair has not yet been deployed. Actual AI/transcription/email/billing/scheduler and full hosted pilot verification remain subject to the documented gates; TASK-021 and the full owner improvement lifecycle are next in the approved queue.
