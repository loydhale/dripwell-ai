# TASK-068: Explicit fresh setup conversation after terminal failure

TASK_ID: TASK-068
PARENT_REQUEST: Owner: "You coding this. We need to be done." Standing until-done authorization, same review branch/PR #2.
STATUS: IN_PROGRESS from reviewed closing HEAD ddb2933a8acc700ee338ae85c0387b1b1a308909 after TASK067 closure.

## Goal and approved scope

Give an owner a reliable explicit way to start a fresh setup conversation when the existing eve session has ended, preserving their typed message and prior saved history.

Continuous-mode Tier2 known F01 gap, PRD8 criteria1/6/9. Source-only Coder assessment and independent installed eve documentation establish that session.failed is terminal, later send returns session_not_active409, attach never replaces it, and the UI always retains/reloads the same saved conversation with no restart control. TASK067 recovers usable-session transient failures; it does not fix this distinct terminal-session trap. No account change can revive that bound ID.

In scope:
- One production UI file: offer an explicit "Start a new setup conversation" action after failed setup; preserve typed input and persisted old history, clear selected conversation/messages/proposal/questions/request identity, then let the next explicit submit create a fresh conversation with a new key.
- The restart action makes no network or provider request and cannot run while busy or captureBusy. Pending initial GET callbacks, including failures, must not restore old state after restart.
- Meaningful actual-component DOM interactions and one actual-handler PostgreSQL recovery regression. No exported production test hooks or duplicated fake state machine.
- Add only exact-pinned dev jsdom if needed for the existing Vitest per-file environment, after checking its actual Node24 compatibility. Existing React19.3 act/createRoot and installed Vitest5 support this; no RTL, user-event, additional types, global config or Vite plugin.

Out of scope:
- Automatic replacement/revival of terminal eve sessions, resetting persisted jobs/messages, new chat architecture or silent model/provider changes.
- Clinical/configuration publication, prices, auth/role/real-data changes, purchases, outbound messages, deployment, migrations or Workflow changes.
- Local application imports/builds/types/tests/SQL/client generation, retained TASK066 node_modules/generated cache/report/target/process effects, and every consumed/permanent old task lane. Do not reopen TASK057.

## Exact Coder paths and roles

- apps/web/components/setup.tsx: explicit guarded action and stale-load invalidation.
- apps/web/lib/setup-conversation.test.ts: new real Setup component DOM interaction tests with controlled fetch and typed fictional clinic context; keep actual apiRequest/postJson.
- apps/web/lib/advisory-locks.integration.test.ts: actual POST failure on old terminal binding, then fresh conversation, preserving old state.
- apps/web/package.json: one exact dev jsdom dependency, no runtime package or other dependency drift.
- pnpm-lock.yaml: matching dependency resolution only.

CTO owns queue/brief/resume; separate Coder implements; independent Auditor reviews and owns learning. One production file and five declared paths is a necessary Tier2 bug repair, not broad quality work or PRD expansion.

## Allowed dependency preparation and guidance

Read the nine boot files/latest STATE, Coder persona and relevant installed docs before implementation. Apply G-005 (actual pinned pnpm, not auto-install shim), L-013/L-035 (persisted identity/status/test guards), P-010 (owner/location binding), L-042 (actual selected test helper boundaries). Use actual Vercel Plugin0.53.0/3b472643 verification and React best-practices guidance; installed Next16.3.8, React/ReactDOM19.3 and Vitest5 documentation/types govern APIs. Mandatory React review after TSX editing.

The sole allowed local dependency operation is lockfile-only, scripts-disabled resolution using the existing actual pnpm10.32.1 binary and inherited proxy/CA. Resolve an exact jsdom version with compatible Node24 engines; no package installation, postinstall, generation, app imports or node_modules changes. Preserve old cached-client holds. If this cannot be done as bounded lock-only work, report the concrete prerequisite rather than inventing or hand-editing dependency integrity.

## Acceptance and validation

1. Loaded existing conversation -> failed setup submit -> explicit restart -> same preserved text submitted with fresh key and omitted conversationId. UI no longer displays old proposal/history/questions; old saved database history remains intact.
2. Restart alone performs zero requests; no network side effect/clinic configuration activation follows the click. Busy/capture disables and guards the action.
3. Stale setup GET success and failure cannot reattach old conversation/proposal or overwrite the restarted error state; unmount/other request guards remain correct.
4. Actual handler on fresh CI PostgreSQL can create a new conversation/session/job after an old terminal-session failure; the old failed job, messages and session binding plus configuration are exactly preserved. This does not revive the old ID.
5. UI tests render the real exported Setup page and drive actual DOM handlers with installed React act/createRoot, mocked fetch leaves and real client request functions. Avoid test helpers that merely reimplement state transitions. Join pending fetches and unmount roots in finally.
6. Independent source PASS precedes same-branch publication. First ordinary changed-source CI on its new synthetic service must install the reviewed lockfile and pass builds/types/new UI and handler regressions/full existing checks. No passing old check/local SQL/migration is replayed independently.
7. Independent actual-result review, distinct learning, minor PRD evidence co-sign and STATE/CHANGELOG close the task. Actual browser/HTTP/model/clinical/hosted pilot and production gates remain separately unverified.

No TASK068 application, test, package or lockfile change may begin before TASK067's closing publication. Coder baseline will be the actual resulting branch head; old TASK067 route behavior and accepted regression cases remain preserved.

## Implementation admission

TASK067 reviewed documentary closure is published at ddb2933a8acc700ee338ae85c0387b1b1a308909/tree84c6bbae645fe67c930524ba290ec052c2976e69, local/origin/remote/open PR2 confirmed equal and Git clean. Its source is unchanged from accepted b4aef87a/first CI37791656066. CTO adopted independent final PASS and L-043 learning; count41 applied once.

Coder selected exact dev jsdom27.4.0 using actual registry engines ^20.19.0 || ^22.12.0 || >=24.0.0 and its packaged README. Version30.1.1 requires Node24.15+, so the compatible selected pin avoids relying on an unverified minor runtime. Existing actual pnpm10.32.1 entry /home/agent/.npm/_npx/9ca9742ac2b5f389/node_modules/pnpm/bin/pnpm.cjs, SHA256b276da51dc8ca5b0d3ee3371695b50fc8b3244b281b091c63a3f082a88dadeb9, is read-only confirmed; bare fallback is not selected. Sole admitted dependency operation uses direct installed Node, NODE_DISABLE_COMPILE_CACHE=1, --lockfile-only and --ignore-scripts, with inherited proxy/CA. No local application import/check or retained target/client effects are authorized.
