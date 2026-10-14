# Authenticated cron database recovery audit

AUDIT: TASK-030
VERDICT: PASS, bounded local compiled HTTP execution
ATTEMPT: 1
DATE: 2026-10-02

FINDINGS:
- `apps/web/app/api/jobs/reconcile/route.ts:9` Missing bearer and an incorrect same-length bearer returned401 `UNAUTHENTICATED`. All50 table counts and whole-row digests were unchanged after each request.
- `apps/web/app/api/jobs/reconcile/route.ts:23` One correctly authenticated actual compiled GET returned200 and performed the authored reminder, abandoned-record recovery and expired-auth/rate pruning on an exclusively owned database.
- `apps/web/app/api/jobs/reconcile/route.ts:26` With every provider key blank, the actual response retained `uploadCleanup=null`, `expiredAudioDeleted=0` and `retentionStorageReady=false`. No storage deletion or hosted scheduler success is claimed.

PATTERN_VIOLATIONS: None.
GOTCHA_HITS: G-007 and G-011 boundaries retained, hosted scheduling is separate from local invocation and this task created no Workflow run.
PRD_AUDIT: PASS, existing F-09/F-12 and section8 criteria5/9 entrypoint verification. No scope change.
REQUIRED_FIXES: None. No application defect was reproduced.

## Story and actual prerequisites

The tested story is an authenticated scheduled-maintenance GET entering the compiled Next route, reconciling reminders and stale records in PostgreSQL, and returning truthful readiness/counters. This task covers the previously missing HTTP authentication-to-database boundary, not a direct helper import, a fabricated Workflow run, the production scheduler or the full clinic pilot.

Published checkpoint was `ff39bf66f6fd1fc941e1914bd2a331e91deaf102`. Its application code remains reviewed `b61f6aa0f7fa3ca5fa85540bcd1051db87cd4cd7`. Existing optimized Next16.3.8 BUILD_ID `UmqaGyv5g5R-vdPJyvBd6` was reused after actual source-map contents matched current files and immutable reviewed Git bytes for `app/api/jobs/reconcile/route.ts`, `workflows/reminders.ts`, `lib/db.ts`, `lib/http.ts`, `lib/errors.ts` and `lib/recording-uploads.ts`. One transformed identifier contains `workflows/workflows/reminders.ts`; exact content comparison resolved that private selector assumption without rebuilding.

Mandatory c12 Vercel Plugin `cron-jobs`, `workflow` and `verification` guidance was read, along with installed Workflow5.0.1 and Next16.3.8 documentation. Version-matched Workflow docs explicitly permit a step function to execute as an ordinary function outside a Workflow. The cron invoked the real compiled application logic in that supported context, creating no durable runs. Cloud runtime/Docker/network guidance was also read. Actual managed status was current/connected/running revision109 with enforced policy; explicit local-socket Docker health passed.

The existing PostgreSQL17.11 container `7d80582265023d9bdd13bb561f812eb8bca2c4427d4e4522f251af179edde627` mapped only `127.0.0.1:55432` to its5432 port. Host PostgreSQL clients were absent; its installed `psql`/`pg_dump` were used without package installation, container replacement or daemon restart. Proxy and certificate controls were preserved.

## Isolated schema and guarded ownership

The global endpoint was never run against shared `dripwell_verification` or hosted data. A pre-create database-catalog read confirmed `dripwell_task030_verification` absent. The new exclusively owned database used template0, a recorded OID, a unique database comment marker and the same independently checked container identity. Every fixture/server operation required explicit equal `DATABASE_URL` and `TEST_DATABASE_URL`, exact hostname `127.0.0.1`, port55432 and this database name, plus matching ownership metadata.

Only schema DDL was copied, using `pg_dump --schema-only --no-owner --no-privileges --schema=public`; no `COPY`/`INSERT` row data appeared. All50 copied public tables, including the empty Prisma ledger table, started with zero rows. The source schema's ten successfully applied migration checksums matched immutable reviewed SQL bytes. Its extra historical rolled-back ledger record was preserved rather than mistaken for another applied migration or reapplied. No migration ran against any existing database.

Private setup guards stopped before fixture/server operations while correcting metadata assumptions: PostgreSQL OID JSON is compared numerically, and a database comment is read with supported `shobj_description` shared-object metadata. The already-created owned target remained empty, its recorded OID/nonce matched and no replacement database was created. `initialization-recovery.json` records this bounded private instrumentation recovery. It is not an application fix.

All50 shared public-table counts and whole-row digests were frozen before isolation and matched after initialization and final cleanup. This includes unrelated application/authentication rows and the complete migration ledger, not merely the task's tables.

## Synthetic fixtures and runtime selection

One explicitly fictional tenant, location, staff member, configuration and regular `isTest=false` consultation supplied one overdue pending care outcome. The false real-data flag remained in force; this is a fixture, not a successful client-start API or consumed trial consultation. No notification was seeded.

The remaining fixtures were an old incomplete upload with empty Blob path; one old unbound queue record of deliberately non-executable kind `CRON_AUDIT_NO_PROVIDER`, null run/result/usage and no provider output; expired/fresh authentication challenges; a session expired31 days ago and another expired only one day ago; and old/fresh rate buckets. Legitimate fictional dates satisfied the actual database constraints. There was no media capture, uploaded object, transcription, clinical approval, actual generation or platform-admin bootstrap.

Actual production-mode Next server PID76725 became ready in106ms at `127.0.0.1:4177`. Its running process environment independently confirmed the isolated `DATABASE_URL=TEST_DATABASE_URL`, literal `ALLOW_REAL_CLIENT_DATA=false`, every listed model/Blob/email/Stripe/Eve/OIDC provider key empty and its private local `CRON_SECRET` matching the owned profile. Hosted `.env.local` was never selected. The fixture's sole purpose was database predicates; its seed created13 owned rows and zero trial units.

## Actual HTTP and persisted effects

| Request | Actual UTC time | Response | Database evidence |
| --- | --- | --- | --- |
| Missing bearer | 17:54:03.087053 to17:54:03.467336 | 401 `UNAUTHENTICATED`, 380.31ms | All50 counts/full-row digests unchanged |
| Incorrect same-length bearer | 17:54:37.315947 to17:54:37.330416 | 401 `UNAUTHENTICATED`, 14.49ms | All50 counts/full-row digests unchanged |
| Correct private bearer | 17:55:05.466127 to17:55:05.550926 | 200, 84.88ms | Six expected tables changed; other44 unchanged |

Each real request was GET `/api/jobs/reconcile` through the compiled local server and returned `private, no-store, max-age=0`. Bearer values were neither printed nor retained in request evidence. There was exactly one valid invocation; no repeat was needed because TASK-028 already demonstrated deduplication across actual duplicate runs.

The authenticated response was exactly:

```json
{
  "reminders": { "checked": 1, "moreRemaining": false },
  "uploadCleanup": null,
  "expiredAudioDeleted": 0,
  "retentionStorageReady": false
}
```

Persisted results matched the actual request interval:

- One `CARE_OUTCOME_NEEDED` notification was created at `17:55:05.535Z`, with the correct owned tenant, current staff, consultation, due date and unique reminder key.
- The20-minute-old incomplete upload became `UPLOAD_FAILED`, updated at `17:55:05.542Z`, with its empty Blob path unchanged.
- The20-minute-old unbound fixture queue became `FAILED` with `PROCESSING_START_INTERRUPTED`, completed at `17:55:05.543Z`. Run ID, model result and usage stayed null. This was database recovery of an intentionally non-provider fixture, not execution of a model.
- The expired challenge was removed; its fresh counterpart remained. The31-day-expired session was removed; the recently expired session remained, demonstrating the authored30-day pruning threshold.
- The3-day-old rate bucket was removed; its fresh counterpart remained.

Only `Notification`, `RecordingSegment`, `GenerationJob`, `AuthChallenge`, `AuthSession` and `RateLimitBucket` changed. All other44 table digests were unchanged. Final owned row count was11; trial usage remained0. No Workflow run, provider request, fake result, second valid request or hosted call occurred. Staff inbox rendering remains the separately proved TASK-028 boundary; this task did not repeat that browser check.

## Cleanup and evidence

The owned server was sent SIGTERM only after its actual process environment was checked again. Exit143 was observed; PID76725 was absent and port4177 closed. No browser was started and no owned Workflow directory or run remained. After verifying zero target connections and the exact database OID/nonce/container, only the owned database was dropped. Its catalog entry was confirmed absent. The existing PostgreSQL container remained running and all50 shared baseline counts/full-row digests matched after cleanup. The private secret environment profile was removed.

Evidence is outside Git in mode0700 `/workspace/dripwell-task030-private`, with mode0600 files. Source/runtime provenance, schema-only DDL, successful/historical ledger metadata, empty-target/shared baselines, guarded isolation, three actual HTTP responses, whole-table inventories, exact persisted effects and cleanup/resource records are retained. Private fixture metadata contains no live provider result or client data. Exact inventories are `/workspace/dripwell-task030-auditor-evidence.json` and `/workspace/dripwell-task030-auditor-evidence.sha256`.

No app source, package, build, migration, deployed protection/flag, commercial policy, provider identity or hosting plan changed. Existing93-check source CI and protected deployment evidence were not rerun or redeployed.

## Remaining feasible retention boundary

This task deliberately left storage unavailable. That does not establish an external account blocker for every remaining retention check. Existing [selected private Blob evidence](AUDIT_DEPLOYMENT.md) records a real Blob2.8.0 synthetic upload, exact authenticated read, anonymous denial, physical deletion and uncached absence. Installed SDK remains2.8.0. Current `app/api/jobs/reconcile/route.ts:36` can perform actual retention deletion and clear database paths when the selected token is present.

A separately approved task can use fresh isolated data plus tiny nonclinical objects under a unique owned prefix, revalidate selected credential/transport, and exercise the compiled endpoint's physical deletion/database boundary. It must keep other providers/OIDC blank, exclude provider-launchable recording-upload jobs, use Node24's existing proxy/CA controls, verify uncached absence and compensate only owned objects. No Blob call or extra task occurred here. Actual hosted cadence, clinical service/data eligibility and full two-clinic pilot evidence remain open.

Learning extraction: P-015 captures disposable schema-only isolation for global maintenance verification. No separate new lesson or gotcha is required; private preflight mistakes were corrected before application execution.


## Subsequent closing checkpoint

TASK-031 subsequently completed the separately approved selected-private-store check described above. One compiled request physically deleted its expired owned synthetic object and cleared the recording path; an unexpired control's bytes/metadata/whole row and49 other table digests stayed unchanged. See [exact evidence](AUDIT_BLOB_RETENTION.md). This preserves TASK-030's original blank-storage/zero-provider boundary rather than attributing TASK-031's live storage operation to it. All owned resources were cleaned and both original evidence inventories remain compatible through exact pre-append snapshots. Current STATE contains13 DONE tasks and WAITING_ON_DEPENDENCIES with modeON/hourly continuation enabled. Remaining hosted scheduling, supported AI/transcription, recipient/billing and service/transcript/document/backup eligibility gates are explicit; no further runtime task or source change is justified without changed input.
