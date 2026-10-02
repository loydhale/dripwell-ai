# TASK-028: Verify durable local in-app reminder delivery

TASK_ID: TASK-028
TITLE: Exercise Workflow sleep/resume through staff notification delivery
PARENT_REQUEST: Owner requires missing-outcome/TBD reminders and authorized continuous completion. TASK-025 Auditor identified a feasible provider-independent gap beyond passing direct helper tests.

GOAL: Verify the actual authored consultationReminderWorkflow durable boundary produces scoped in-app reminders after sleep/resume and reconciles changed consultation state correctly.

## Evidence and bounded scope

Existing real-PostgreSQL clinic tests call reconcileConsultationReminders directly. They establish ordinary archive/restore/state predicates but do not establish actual local Workflow sleep/resume followed by database notification and browser delivery. The Auditor confirmed this boundary can run without external model, email or billing access. This is PRD F-09/section8 criterion5 verification, not an added feature or authorization to weaken production scheduling.

- Read the latest AGENTS boot files/personas/AUDITOR.md, mandatory c12 Vercel Plugin workflow/verification/browser guidance and version-matched installed Workflow5.0.1/Next16 docs. Preserve root ICM and authored apps/web/workflows.
- Inspect actual runtime prerequisites before mutations. Use the real authored workflow/local WDK runtime and supported APIs; do not replace sleep with a direct helper call, fabricate a provider result or call a fixture a successful hosted scheduler.
- Use explicitly fictional owned fixtures on the guarded loopback dripwell_verification database from /workspace/dripwell-verification.env. Never select hosted .env.local. The verified source excludes every isTest=true row from reminder reconciliation, so use owned fictional regular fixtures with isTest=false and keep ALLOW_REAL_CLIENT_DATA=false. The existing compiled consultation.restore route can preserve a preseeded future careOutcomeDueAt and call startConsultationReminder without enabling new-client starts. Verify that actual route before assuming the run launched; do not add a test kickoff API or bypass compiled workflow registration.
- Installed Workflow5.0.1 documentation supports WORKFLOW_TARGET_WORLD=local, an explicit owned WORKFLOW_LOCAL_DATA_DIR and WORKFLOW_LOCAL_BASE_URL. Use a dedicated run-state directory and measured startup recovery; the local queue is in memory, so restart durability must be observed rather than inferred from filesystem existence. Plain uncompiled direct start(workflowFn) is not a valid substitute.
- Verify a real outstanding care outcome or approved wellness pending/TBD state reaches the authored durable sleep/resume and produces a scoped notification visible to the intended staff in the real app. Keep timings bounded with legitimate fictional fixture due dates; do not wait for a real business day.
- Verify that current decision/archive/reassignment state prevents stale delivery and retries/reconciliation cannot duplicate a reminder, to the extent not already established by passing helper tests. Exercise the durable transition rather than unnecessarily repeating all existing predicate cases. Distinguish any injected fixture event from actual persisted Workflow execution.
- Attempt supported local process restart/resume only when current WDK docs expose a reliable way to retain owned run state. If unavailable, report exactly which durability proof remains open; no unsupported PASS.
- Capture run identity/state, real timestamps, persisted notification and actual browser receipt; no credentials or client data in Git. Count and clean owned fixture/run/browser/server resources, preserve unrelated verification rows and coordinate shared build/database use.

No application fixes within this Auditor task. If a source defect appears, stop at an exact reproducible boundary and route a bounded Coder task through CTO. No model/transcription/email/Stripe calls, external messages, hosted clinical records, migrations, provider switches, new notification features, plan upgrade or real data.

## Acceptance criteria

1. Actual local Workflow run, sleep/resume and persisted scoped in-app notification are demonstrated, or an exact independent runtime/source blocker is recorded.
2. Real app renders the intended notification; stale-state/deduplication authority is preserved and clearly distinguished from prior direct-helper evidence.
3. Any restart/resume proof and its limits are accurate; local timing does not establish the unavailable hosted 15-minute scheduler.
4. Owned fixtures/runs/browser/server are cleaned, shared state preserved, no prohibited provider/hosted action occurred.
5. Independent verdict/learning/CHANGELOG/STATE and reviewed publication carry precise evidence boundaries.

Auditor owns docs/AUDIT_DURABLE_REMINDERS.md and append-only learning/CHANGELOG/SESSION_LOG as warranted. CTO owns STATE/briefs. Start only after the recording repair/control review releases shared build and fixtures, and reconcile all active workers first.

2026-10-02 plan co-sign: Auditor PASS for bounded scope, with actual local runtime feasibility still to be proved. No PRD change.

2026-10-02 outcome: Auditor PASS attempt1 for bounded actual local execution; see docs/AUDIT_DURABLE_REMINDERS.md. Six registered runs, real future sleep/resume, three persisted reminders/two correct staff inboxes and current-state/deduplication behavior are proved. Explicit Local World.start recovered the original five retained waits; plain optimized Next startup did not do so automatically. All owned resources cleaned and unrelated digests preserved; G-011/CHANGELOG/SESSION_LOG recorded. Hosted scheduling, automatic Next recovery and the full pilot remain open. TASK-030 isolates the next justified global endpoint verification.
