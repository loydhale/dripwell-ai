# TASK-026: Count active recording time across pauses

TASK_ID: TASK-026
TITLE: Keep audio segment duration and limits consistent with active capture
PARENT_REQUEST: Owner authorized finishing the consultation workflow continuously. TASK-025's independent actual-browser recording verification reproduced incorrect paused-time metadata.

GOAL: Report and enforce active audio capture duration for each segment, excluding paused intervals and preserving the segment limit when capture resumes.

## Reproduction and scope

The Auditor ran the actual optimized Next16 application in Chromium with a synthetic microphone, a guarded isolated PostgreSQL fixture and an intercepted recording-upload boundary. After approximately two seconds of capture, a paused interval and one resumed second, the UI read `00:03` and MediaRecorder transitioned recording/paused/recording/inactive. The actual outbound FormData nevertheless contained `durationMs=24089` for the nonempty 26497-byte WebM. `apps/web/components/audio-recorder.tsx:126` used wall time from start, including pauses. `apps/web/lib/recordings.ts:105` rejects a segment over 600000ms, so a long pause can reject a short recording.

In scope:

- Repair recording duration accounting in the shared actual AudioRecorder component. UI duration and immutable captured-segment duration must reflect active capture only.
- Preserve the authored per-segment 60-second active capture budget across pause/resume. Repeated pauses/resumes must not reset elapsed capture or allow oversized active segments. Rollover starts a new ordered segment with its own active duration.
- Preserve retry metadata for an already captured segment, nonempty media delivery, ordered sequence, consent/disabled guards and track/timer cleanup. Stopping while paused must not count time after the pause.
- Add focused meaningful regression coverage for active time, long pauses, repeated resumes, stop while paused and segment rollover/timer cleanup. Follow the existing runner; test user-visible/output behavior or a reusable duration boundary, avoiding tests that merely mirror implementation.
- Run affected tests and TypeScript checks, then the required optimized build. Coordinate any shared build/server use with the Auditor.

Out of scope: provider/AI changes, server recording limits, schema/migrations, clinical authority, consent policy, new recording features, hosted credentials/settings, production scheduling, pricing/billing/email, purchases and real-client data. Keep deployment protection and hosted ALLOW_REAL_CLIENT_DATA=false.

## Context and ownership

Read the full AGENTS boot sequence and personas/CODER.md before choosing APIs. Mandatory open-source Vercel Plugin guidance is available through `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`, including nextjs, react-best-practices and browser verification as applicable. Read version-matched installed Next/React documentation. Preserve ICM root folders and authored apps/web/agent and apps/web/workflows.

Coder owns apps/web/components/audio-recorder.tsx and narrowly necessary timing helper/regression files. Do not edit STATE, task briefs, shared evidence or learning; CTO owns the checkpoint, Auditor owns independent review/learning. Do not commit, publish or deploy your own changes. Actual available Codex workers execute the roles; no unavailable roster-model invocation is claimed.

Relevant memory: L-020 pending recording evidence invalidates downstream authority; L-022 concurrent recording cleanup; G-001 user-gesture media permission; G-005 explicit pnpm; G-008 local proxy; P-011 exact reviewed preview staging. Do not alter those established boundaries.

Use `npx --yes pnpm@10.32.1`. If database verification is needed, explicitly use /workspace/dripwell-verification.env and the disposable loopback dripwell_verification database. Never use apps/web/.env.local as a fixture target. TASK-025 uses one isTest fictional fixture, the real-data gate remains false and provider keys are empty.

## Acceptance criteria

1. Actual component capture/pause/resume/stop yields UI and outgoing duration consistent with active audio, including a long pause and stop while paused.
2. Multiple resumes cannot reset the 60-second active segment budget; rollover yields correctly ordered nonempty segments with separate active durations. Retry retains the exact captured metadata.
3. Meaningful targeted regressions execute without skips, required types/build pass, and independent Auditor re-runs the real recording controls against the repaired app with disclosed synthetic-device/upload boundaries.
4. Consent, permission/error handling and microphone/timer release remain correct; no changes to provider, server authority or hosted safety gates.
5. Auditor PASS, learning, CHANGELOG, STATE and exact reviewed publication to the existing review branch precede any fresh preview deployment. Passing source CI is required before deploying changed application source.
