# Database maintenance control

`GET /api/jobs/reconcile` requires `Authorization: Bearer <CRON_SECRET>` and
returns state plus included/deferred families. It is a read only: no coordinator
insertion, native start, schema action or provider operation. The unchanged Cron
GET therefore reports status. It does not overcome the existing Hobby cadence
limit or enable scheduling. No worker starts on import, build or deployment.

An authenticated JSON POST accepts only `{ "command": "run-once" | "start" |
"stop" | "recover" }`. The request cannot choose deployment, project, branch or
scope. `run-once`/`start`/eligible `recover` return 202 with a durable reservation
state and the native dispatch result; `stop` returns 200. Authentication and
trusted server context are checked before writes and native dispatch. Invalid
input/context returns 400/503; an occupied claim or ineligible recovery returns
409. A native start with unknown outcome returns 503 and retains
`NATIVE_START_AMBIGUOUS`. Status omits the claim token and selected record IDs.

Vercel context uses its platform project, environment, preview branch and exact
deployment ID. Active generations stay on that immutable deployment. A changed
deployment must explicitly stop the previous generation before reserving its
own; it cannot adopt an old run or target `latest`. Local overrides on a Vercel
process are rejected. Multiple environment scopes sharing one physical database
cannot independently enable global maintenance there.

The additive migration creates an empty coordinator table with disabled
defaults and selection indexes. It neither starts work nor backfills business
data. A machine command first reserves `PENDING_START`, then records its native
dispatch intent before starting. Unknown starts are never automatically retried.
Duplicate native runs may exist, but exactly one current run claims a token.
Explicit `recover` requires a current-deployment expired reservation/lease and
advances the generation; elapsed time alone grants no write authority.

Every database effect, progress/cursor change, retry, completion and next
reservation locks the coordinator before domain rows and checks scope,
deployment, generation, ordinal, token and run ownership in that transaction.
`stop` waits for a currently locked transaction, advances the generation, and
fences all later old writes. Already committed effects remain committed. Stop
does not forcibly cancel a native run or sleeping timer; its eventual continuation
cannot reserve or start current work. A dispatch committed before stop may create
an extra native run that fails its claim without database effects.

Each ordinal processes one page of each family, with fixed eligible cutoffs:

| Family | Selected maximum | Current predicate at the write |
| --- | ---: | --- |
| Reminder visits | 20 | Current non-test visit, archive/outcome/decision/revisions, due time and recipient |
| Abandoned upload database state | 100 | Still `UPLOADING`, older than 15 minutes |
| Interrupted generation starts | 100 | Still `QUEUING`, no native run, older than 15 minutes |
| Expired authentication challenges | 50 | Expiry before iteration claim time |
| Old authentication sessions | 50 | Expired more than 30 days before claim time |
| Old rate buckets | 50 | Window older than two days before claim time |

Each reminder condition dismisses at most 20 selected stale notification IDs and
upserts its current due key. Across 20 visits/two conditions this is at most 800
dismissals and 40 upserts. Visits without a due need can still dismiss stale
notifications. Per-visit consultation reminder paths remain available.
Failed model jobs are not restarted; remote files/providers are not touched.

Immutable ID/key cursors and a captured sweep ceiling let later eligible rows
advance past the first page. New keys behind the cursor wait for the next sweep.
An ordinal caches its selected IDs and atomically committed per-item progress;
a retry does not select another page or multiply a committed effect. Failed or
budget-deferred IDs return in later sweeps rather than blocking progress. Each
family has a 20-second wall budget; each transaction has a two-second database
statement/lock limit and a ten-second total limit. Step retries are finite (two);
native dispatch has no Workflow step retry. Invalid stored progress fails closed.
Completion proves all six pages under the same fence and preserves
`ITERATION_PARTIAL` if a page failed/deferred work. A completed bounded iteration
does not mean the entire backlog was cleared.

Scheduled runs sleep using the installed Workflow timer until the next anchored
15-minute due slot, then reserve a new ordinal and start a new bounded run on the
same deployment. Late completion skips missed slots and schedules only the next
future slot; there is no catch-up loop or ever-growing run history. Manual runs
and enabled scheduled mode exclude each other, including while a timer waits.

Non-hosted verification alone requires `WORKFLOW_TARGET_WORLD=local`, explicit
`MAINTENANCE_LOCAL_PROJECT=local-...`, `MAINTENANCE_LOCAL_BRANCH` and a 64-hex
`MAINTENANCE_LOCAL_BUILD_ID` bound by the operator to the compiled artifact.
The locked Local World 5.0.1 identity is `dpl_local@5.0.1`; local hosting itself
has no immutable deployments. Only this non-host context permits an explicit
`MAINTENANCE_LOCAL_INTERVAL_MS` of 1000..900000 for owned recurrence verification.
Source PostgreSQL tests mock native start and prove database boundaries, not
native timers. Actual compiled natural recurrence belongs to separate TASK048.

There has been no hosted migration, opt-in start or recurring-cadence proof from
this source task. Existing protected previews and `ALLOW_REAL_CLIENT_DATA=false`
remain required. Dedicated Blob compensation/retention source paths are retained;
the new database coordinator explicitly lists both Blob families as deferred.
