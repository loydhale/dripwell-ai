# TASK-025: Verify recording controls independently of provider access

TASK_ID: TASK-025
TITLE: Resolve the remaining browser capture-control verification gap
PARENT_REQUEST: Owner's standing instruction to finish DripWell, followed by repeated questions about idle coding agents.

GOAL: Determine and execute the provider-independent portion of consented browser recording verification without claiming transcription or full pilot completion.

## Why this task is in scope

PRD F-03/F-09 and section 8 criterion 2 require recording controls and interruption/error handling. The saved completion matrix says actual recording remains unverified; the prior browser evidence covers consent-disabled recording and manual intake, not actual MediaRecorder capture. Recheck that narrow gap before concluding that every remaining verification task requires external accounts.

## Scope

- Read the latest AGENTS boot files, Auditor persona, relevant Vercel Plugin verification/browser guidance and installed Next.js documentation. Guidance source is `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`.
- First map the actual recorder's prerequisites and existing evidence. If the independent controls already have sufficient runtime proof, cite it; do not rerun passing checks.
- When feasible, verify the real local Next/browser component's foreground consent/start, permission denial/error, duration, pause/resume/stop, captured segments and interruption/unmount cleanup with explicitly synthetic media. Chromium synthetic-device evidence is not a physical iPad or live-provider result.
- Use an explicitly guarded disposable local database only if fixtures are necessary: explicit TEST_DATABASE_URL, loopback port 55432 and database dripwell_verification. Never select hosted `.env.local` as a fixture target. Reuse established private fixture helpers/configuration safely.
- Keep every hosted setting, protection and ALLOW_REAL_CLIENT_DATA=false unchanged. Prefer isolated synthetic test visits; any required local regular-visit flag is process-scoped, explicitly fictional and restored/terminated, as in TASK-022.
- Do not initiate transcription/model, email or billing requests, or alter hosted clinical rows. If a control necessarily couples to a provider operation, record that exact boundary and verify only the independently runnable portion. A controlled failure/interception may test an error path, but cannot be reported as successful upload/transcription/model execution.
- If a reproducible source defect appears, return file/line evidence and a bounded Coder brief to CTO. Do not edit application code or weaken authority/gates yourself.

## Acceptance and handoff

1. Existing versus missing recording-control evidence is explicit and traceable.
2. Every claimed new runtime check actually executes through the real component; simulated device/I/O boundaries are disclosed, and blocked portions remain blocked.
3. No provider request, hosted clinical mutation, migration, spending, administrator bootstrap or fabricated completion occurs.
4. Fixtures, browser processes and test servers are cleaned; private material stays outside Git.
5. Return independent PASS for the completed scoped verification or exact BLOCKED/FAIL evidence. Record learning or no new learning, and co-sign any final CTO checkpoint before publication.

Auditor owns `docs/AUDIT_RECORDING_CONTROLS.md` and append-only learning/CHANGELOG/SESSION_LOG. CTO owns STATE and briefs. This does not reopen the already-passing archive/job/billing suites, change the PRD or declare the approved pilot done.
