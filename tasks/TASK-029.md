# TASK-029: Guard every visit-exiting shell link during capture

TASK_ID: TASK-029
TITLE: Preserve active/unsaved recordings across shell navigation
PARENT_REQUEST: Owner authorized complete consented recording. TASK-025 attempt2 found an actual SPA navigation path that discards access to captured unsaved audio.

GOAL: Apply the established captureBusy navigation prevention and visible explanation to all visit-exiting AppShell links, preserving normal idle navigation.

## Independent reproduction and scope

TASK-026's active-duration repair independently passed native duration/paused-stop/immutable-retry and real60-second rollover. During the remaining actual-browser unmount check, clicking the header `dripwell .` Link at apps/web/components/app-shell.tsx:55 navigated to /dashboard while the recorder was active. Unmount correctly stopped the microphone and produced a9001-byte final segment, but the deliberately intercepted upload failed after unmount and no retry/discard UI remained. beforeUnload does not intercept SPA Links. The notification Open consultation Link at app-shell.tsx:208 is also unguarded by independent source inspection.

In scope:

- Audit the AppShell's existing visit-exiting Links against its established captureBusy guard used by sidebar/signout/location controls. Use that same authority/state and visible warning for the wordmark, notification links and any equivalent shell route exits.
- Cover active capture, pause and unsaved/pending segments as defined by the existing captureBusy contract; do not weaken that contract or introduce parallel state that becomes stale.
- Prevent SPA navigation before recorder unmount and preserve its usable controls/queued retry/discard state. A controlled failed upload must remain actionable after a blocked navigation attempt.
- Preserve successful idle navigation, intended link targets, keyboard accessibility and normal shell behavior. Follow current patterns; a small shared guard within the shell is acceptable if it prevents bypasses without broad refactoring.
- Run required shared/web types and optimized Next build. Use existing meaningful tests if applicable; the decisive independent regression is the real browser attempted wordmark and notification navigation while recording/paused/unsaved versus successful idle navigation. Do not add tests that merely mirror a click-handler implementation.

Out of scope: new offline-storage/navigation features, auto-saving by fabricated upload, provider/AI/server-policy changes, schema/migrations, clinical authority, new prices/settings, hosted data, purchases or production promotion. TASK-026's reviewed timing behavior must stay intact. Keep ALLOW_REAL_CLIENT_DATA=false and protection.

## Context and ownership

Read latest AGENTS/PRD, full memory boot sequence and personas/CODER.md. Load mandatory open-source c12 Vercel Plugin nextjs/react-best-practices/browser guidance and installed version-matched framework docs. Preserve ICM root and authored apps/web/agent and apps/web/workflows.

Coder owns apps/web/components/app-shell.tsx plus only a narrowly necessary existing test adaptation if meaningful. CTO owns STATE/briefs; Auditor owns independent evidence/learning. Do not edit timing files, docs/memory or publish/commit/deploy. Use explicit npx --yes pnpm@10.32.1 and the established guarded private build wrapper; never use hosted .env.local as a fixture binding. Coordinate release of the shared localhost4177 build with Auditor before rebuilding.

Relevant memory: L-028 active capture time; L-007 helper ordering can hide warnings; L-020 pending evidence release authority; G-001 user-gesture media permissions; G-005 pnpm shim. No unavailable role-model invocation is claimed.

## Acceptance criteria

1. All equivalent AppShell route exits preserve the active/paused/unsaved consultation and show the established explanation; no unexpected recorder stop/unmount or logout occurs.
2. Actual wordmark and notification-link attempts are independently tested in the real repaired app; failed-upload retry/discard remains available. Idle links navigate successfully.
3. Types/build and any meaningful existing affected tests pass; independent source/native-browser Auditor PASS, learning and checkpoint precede reviewed publication.
4. No provider/data/safety-policy change; fresh source CI and TASK-027 exact-stage protected deployment remain required after recording verification.

## Attempt2 correction

2026-10-02 independent actual390x844 test: the guarded notification link preserved native capture and the visit, but the still-open notification panel completely hid the main warning. Its alert rect was x18/y83/w354/h71 underneath that panel. Close presentation overlays on a blocked exit so the existing warning and capture controls remain visible. Preserve captureBusy/native/visit/unsaved state and idle link behavior. This is the existing visible-warning acceptance, not a new feature. Existing desktop active/paused/pending/failed guard, retry, keyboard and idle targets passed; retest changed visibility/sharedguard behavior without repeating unaffected timing/provider suites.
