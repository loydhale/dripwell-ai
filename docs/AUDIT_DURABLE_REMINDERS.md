# Durable in-app reminder audit

AUDIT: TASK-028
VERDICT: PASS, bounded local execution
ATTEMPT: 1
DATE: 2026-10-02

FINDINGS:
- `apps/web/workflows/reminders.ts:76` Actual registered Workflow execution slept until a future due time, resumed the authored database step and persisted an in-app notification visible to the intended staff.
- `apps/web/workflows/reminders.ts:8` Five retained sleeping runs reconciled current archive, wellness decision and staff assignment state after supported Local World lifecycle recovery. Two runs for one visit produced one notification.
- Installed Workflow5.0.1 Local World startup, observed limitation: restarting the optimized Next process alone did not recover the five outstanding waits. Explicit supported `World.start()` initialization recovered the original runs. Automatic Next startup recovery and hosted scheduling are not PASS claims.

PATTERN_VIOLATIONS: None.
GOTCHA_HITS: G-011, discovered in this task.
PRD_AUDIT: PASS, existing F-09 and section8 criterion5 verification. No scope change.
REQUIRED_FIXES: None within this verification task. The local lifecycle initialization requirement remains explicit.

## Runtime and fixture boundary

Published repository checkpoint was `b3705e72eedd0c5d0e3d706137b715bf34f15ba3`. Its application source matches reviewed `b61f6aa0f7fa3ca5fa85540bcd1051db87cd4cd7`. The retained optimized Next16.3.8 artifact, BUILD_ID `UmqaGyv5g5R-vdPJyvBd6`, was reused only after checking that source-map `sourcesContent` matched both current files and the immutable reviewed source for:

- `workflows/reminders.ts`
- `lib/clinic.ts`
- `app/api/clinic/route.ts`
- `components/app-shell.tsx`
- `components/clinic-context.tsx`

The actual artifact registered `workflow//./workflows/reminders//consultationReminderWorkflow` and `step//./workflows/reminders//reconcileConsultationReminders`. Private `runtime-provenance.json` retains exact source and map hashes. No rebuild, package change, migration or repeat of passing source suites was necessary.

The private launcher parsed `/workspace/dripwell-verification.env` and rejected any database target except `127.0.0.1:55432/dripwell_verification`. The running process environment was independently read and confirmed this target, literal `ALLOW_REAL_CLIENT_DATA=false`, all listed provider/storage/email/Stripe keys empty, `WORKFLOW_TARGET_WORLD=local`, an owned private `WORKFLOW_LOCAL_DATA_DIR`, callback URL `http://127.0.0.1:4177` and `WORKFLOW_LOCAL_RECOVER_ACTIVE_RUNS=true`. Hosted `.env.local` was never selected.

One explicitly fictional tenant, one location, two staff, one active configuration and five regular consultation fixtures were created. `isTest=false` was intentional because authored reminders exclude `isTest=true`; this does not authorize real data. All visits initially had `archivedAt` set. No notifications were seeded. One empty fictional wellness plan and matching revision values supplied the pending/TBD predicate without any generation or clinical approval claim. Due dates were legitimate future timestamps, measured with the actual clock.

Each kickoff used a staff browser session, fetched the current compiled clinic state and POSTed `consultation.restore` to the existing `/api/clinic` route. HTTP200, `reminderPending=false`, persisted version and actual registered run identity were checked. This exercised `lib/clinic.ts:945` rather than a test kickoff API, uncompiled `start(workflowFn)` or a direct reminder helper. The compiled archive route was also used. Reassignment and accepted-wellness changes were explicitly disclosed fixture database injections before wake-up, not proof of their clinical mutation APIs.

## Actual sleep and delivery

The first restore returned HTTP200 at `16:50:29.723Z`. Actual run `wrun_01M3YRCGCVZK6P7DW6GN82CMXA` was created at `16:50:29.555Z`; its first database step completed at `16:50:29.703Z`. The runtime persisted `wait_created` at `16:50:29.711Z` with future `resumeAt=16:50:58.967Z`. A read at `16:50:43.245086Z` observed the run still running and its wait still waiting.

The run then persisted the real sequence `wait_completed`, second database step creation/start/completion and `run_completed`, following the original five startup/step events and `wait_created`. The resulting `CARE_OUTCOME_NEEDED` notification was created at `16:50:59.879Z`, 912ms after due time. Run completion was `16:50:59.896Z`. The actual app refreshed its clinic state, showed one unread notification and rendered the correct visit link; screenshot inspection confirmed it. This proves actual render after refresh, not background polling or push delivery.

## Current state, duplicate runs and measured restart

Five additional original runs were created through the same compiled restore route. A repeated restore of one visit intentionally produced two sleeping runs. At `16:57:03.839092Z`, all five were running with persisted waits whose due times were still in the future.

| Fixture | Original run IDs | Due time, UTC | Final persisted effect |
| --- | --- | --- | --- |
| First delivery | `wrun_01M3YRCGCVZK6P7DW6GN82CMXA` | 16:50:58.967 | One care reminder for original staff |
| Restart and duplicate | `wrun_01M3YRREVSR41YMN2DC5WZD987`, `wrun_01M3YRRF3FB7A4AY3ZANDHJQT5` | 16:58:00.896 | One care reminder for original staff |
| Archived before wake | `wrun_01M3YRRFMDJDZZ2F2CWHH8G9ZA` | 16:58:01.728 | No notification |
| Reassigned before wake | `wrun_01M3YRRG582J9M10SHMFX2AGE5` | 16:58:02.259 | One care reminder for current second staff |
| Wellness accepted before wake | `wrun_01M3YRRGPHGQNV9VAZ0JX8KYJ5` | 16:58:02.810 | No notification |

The original Next server PID68305 was sent SIGTERM at `16:57:36.531626Z`, before these due times; exit143 was observed. Browser closure and retained dedicated run directory were recorded. New Next PID69223 used the same artifact, safe environment and run directory. No new consultation kickoff occurred after restart.

At `16:58:38.814900Z`, all five outstanding runs were still running with waiting records, despite due times having passed and the recovery option being true. A GET to the existing compiled Workflow callback endpoint returned its actual HTTP400 `Missing request body`; it was not reported as a successful health check. Plain optimized Next startup did not invoke Local World's recovery lifecycle.

Installed version-matched documentation exposes supported `World.start()` initialization, which reenqueues retained active runs, and `World.close()` cleanup. A bounded private process used the installed `workflow/runtime` `getWorld()`, the same owned directory and callback URL, and awaited the actual World lifecycle. It started at `17:01:11.829Z` and finished at `17:01:12.566Z`. The five original runs completed at `17:01:12.503Z` through `17:01:12.529Z` via the real compiled callback and database steps. All six original run IDs remained unchanged; no replacement workflow start, direct helper call, fake sleep or fabricated result was used. The lifecycle process closed its World and exited0.

Final database state held exactly three `CARE_OUTCOME_NEEDED` notifications with three unique idempotency keys. The duplicated visit's notification was created at `17:01:12.491Z`; the reassigned visit's at `17:01:12.493Z`. The archived visit and accepted wellness visit had zero notifications. Current tenant and user binding matched the fixture records. This verifies supported retained-state recovery and database deduplication, while recording the negative automatic Next-restart result separately.

## Staff browser receipt

Two actual isolated staff browser sessions fetched `/api/clinic` and rendered the notification panel after recovery. The original staff saw exactly two unread rows for first delivery and restart. The reassigned staff saw exactly one unread row for the reassigned visit. API user IDs, notification user IDs and visit link destinations matched; center hit tests and inspected screenshots confirmed visible `.notification-row` elements with no Next overlay. Responses used `private, no-store, max-age=0`.

This is notification scoping proof. It does not introduce a claim that assignment limits ordinary same-clinic visit visibility. No notification was seeded, no email/push transport was invoked and no inference or transcription was performed.

## Cleanup and preserved state

Both owned browser sessions were closed. PID69223 was stopped with observed exit143; the explicit recovery process had already exited0. Port4177 was checked closed. All six runs completed and zero live waits remained. Only this task's owned World directory was archived, then removed. Private archive `owned-run-evidence.zip` has SHA256 `02ebfe769f215bfe47142066db1c4426df8756e9a5179e9f5a1a763b9a644c48` and contains owned Workflow state, not authentication fixture files.

Owned tenant identity and slug were checked before deleting only its rows. Cleanup left zero owned tenants. All thirteen initial unrelated model counts and whole-row digests matched the before-task baseline: tenant, location, user, authSession, clinicConfigurationVersion, consultation, notification, subscription, trialUsage, generationJob, recordingSegment, consultationEvent and auditLog. These unrelated rows were not empty. One explicitly identified own clinic-mutation rate-limit bucket was deleted, and unrelated rate-bucket digests matched immediately before and after cleanup; rate buckets were not part of the initial thirteen-model baseline.

Owned generationJobs, recordingSegments and trialUsage were zero throughout. No source edits, hosted records, provider calls, migrations, spending or external messages occurred. Private evidence/helper files are mode0600, private directory mode0700, outside Git. Cookie/token fixtures remain private and are not copied into the audit or public evidence.

## Evidence and remaining boundary

Private artifact directory: `/workspace/dripwell-task028-private`.
Exact private evidence inventory: `/workspace/dripwell-task028-auditor-evidence.json` and `/workspace/dripwell-task028-auditor-evidence.sha256`.

That original 36-entry inventory was checked before closing documentation notes were appended. Four exact original Auditor-document snapshots preserve its historical hashes in `/workspace/dripwell-task028-original-evidence-preserved.json` and `/workspace/dripwell-task028-original-evidence-preserved.sha256`; the other 32 private artifact/helper files are unchanged. The closing checkpoint separately freezes the final thirteen documentation/plan paths, without rewriting the original evidence inventory.

Relevant artifact groups are runtime/source provenance, actual compiled route responses, pre-due run/event state, pre-restart and negative post-restart observations, supported lifecycle recovery, final database/browser receipt, baseline-preserving cleanup and released resources. Screenshots were inspected. Operational run state was removed after the evidence archive was checked.

Actual hosted 15-minute scheduling, deployed-world restart semantics, provider-dependent audio retention and the full two-clinic clinical pilot remain unverified by this task. The protected preview omits cron, and its real-data flag remains false. Successful local lifecycle recovery is not evidence of automatic hosted scheduler operation.

One justified provider-independent entrypoint gap remains: `apps/web/app/api/jobs/reconcile/route.ts:23` authenticates cron, then performs reminder reconciliation and database recovery/pruning. Existing helper tests do not establish this compiled HTTP authentication-to-database boundary. With storage credentials blank, actual Blob deletion and storage-ready status must remain unproven. The endpoint also mutates database-wide stale upload/job rows and expired authentication/rate-limit records. A future bounded verification must isolate an owned disposable database or schema rather than run this global endpoint against unrelated rows in the shared verification database. No cron request was performed here and no separate task was started.

Learning extraction: no separate new lesson or pattern; G-011 records the measured Local World initialization requirement. Application source and the four previously reviewed recording/control hashes remain unchanged.
