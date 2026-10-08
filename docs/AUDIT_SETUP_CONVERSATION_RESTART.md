# TASK068: Explicit fresh setup conversation

AUDIT: TASK068
REVIEWER: /root/setup_retry_auditor, independent of CTO and Coder
DATE: 2026-10-08
SOURCE_VERDICT: PASS, first changed-source CI pending
ATTEMPT: 1

## Reviewed source

Baseline `ddb2933a8acc700ee338ae85c0387b1b1a308909`, tree `84c6bbae645fe67c930524ba290ec052c2976e69`, branch `feat/dripwell-consultation-v2`, open PR #2.

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| apps/web/components/setup.tsx | 40726 | a27b5287119d03b2ecb6fa82b543eeee4bdffae79da62c274a73a6fc9a3faa25 |
| apps/web/lib/setup-conversation.test.ts | 12859 | 9cbd64e65d8bbbbef3c3a88db1ba2b199a685d3297b0c887cb5f4b91a613314d |
| apps/web/lib/advisory-locks.integration.test.ts | 32451 | fa6c7018ee6f6358fc40733a8764e207bf11795f02dad91e82b860259fe2185f |
| apps/web/package.json | 1728 | c13124d18427e5a7a688c548e98fe0937a9ee0d0976e2f681f2c739ba05c3054 |
| pnpm-lock.yaml | 255639 | 16eba7d036e4f13127bf479a90dba23b35946ea292f8e1aeb5f364a076984af5 |

Actual files, frozen copies and manifest agree. Independently checked baseline bytes and Git blob identity. Removing only the added handler case reconstructs the exact prior integration module; the setup route remains byte-identical. Static whitespace validation passed. No application import, local test, build, typecheck, SQL, provider operation or deployment was executed for this review.

Retained Coder packet under `/workspace/dripwell-task068-coder-source-private`: SOURCE_MANIFEST.json5124bytes/SHA256`4fd0b5d1ae2773c9cf282cee6221c127046a180677607805c6b5cbe13ac43e2c`; SOURCE.diff47741bytes/`eb0d4a380f224ea0ce04b0a5894f3856f745d6b2497523a7ef885d2f7bc6e989`; DEPENDENCY_RECEIPT.json2672bytes/`676e70d155951d4bf3ad86d3d145556caa96a8b0aeaac722a7c350e40cdbc885`. Exact packet bytes/hashes were verified before interpretation.

## Findings

- `components/setup.tsx:137` guards the explicit action with busy/captureBusy, invalidates the current load generation, clears selected/ref conversation, display messages, proposal, missing questions and request identity. It preserves typed input and performs no request or persistence action. The next explicit Send obtains a fresh key; real postJson omits undefined conversationId, so the unchanged authorized route creates a fresh binding.
- `components/setup.tsx:80` binds each initial load to a ref generation. Both success and failure require the original effect to remain current and its generation unchanged. Restart invalidates both branches; effect cleanup also preserves unmount/location-change fencing. A late old result cannot restore old history/proposal or overwrite the new error.
- `components/setup.tsx:270` uses a named type=button action after load/send/upload failure, with busy/capture disabled state and explanatory saved-history/input text. Successful acceptance hides the action. Existing configuration save/test/activation, owner authority, uploads and provider request shapes are unchanged.
- `lib/setup-conversation.test.ts:1` opts this file into jsdom and renders the real exported Setup with React act/createRoot. Only the typed fictional clinic context and fetch leaves are intercepted; apiRequest/postJson, the parent proposal state and DOM handlers remain real. No production test hook or duplicate transition implementation is added.
- Four authored DOM identities cover loaded failure -> explicit restart -> preserved text/fresh omitted-conversation request; capture/in-flight disabled controls preserving the original retry request; and separate late initial GET success/failure after restart. Assertions reject old history/questions/proposal/error, require no click-triggered request or configuration mutation, and retain current request identity after the late result.
- Each DOM case has a finally that settles and joins pending fetch promises under act, then unmounts and removes its root. Global fetch/act flags and the original matchMedia/scroll descriptors are restored. These are source-enforced synthetic cleanup boundaries, not observed browser or process closure.
- `lib/advisory-locks.integration.test.ts:301` adds one actual-handler/Prisma scenario: intercepted old-session session_not_active409 becomes a failed job; an explicitly fresh request creates distinct conversation/session/job IDs. It asserts exact old conversation/messages/binding and both old jobs are unchanged, checks saved new message lineage/current owner-location binding and unchanged configuration rows, and requires two creates/three sends. Calls are awaited sequentially before existing owned cascade/rate/policy cleanup. All prior case bytes and guards remain unchanged.

PATTERN_VIOLATIONS: none. P-008/P-010 current authority/location binding remain in the unchanged handler. The ref-generation fence follows the existing stale-response approach in P-013 without broadening it. G-005's bare pnpm shim is avoided; L-042 copied-helper boundaries and L-035 authoritative fixture fields were reviewed.

PRD_AUDIT: pass. The brief and implementation admission repair an existing F01 terminal-session trap within PRD8 criteria1/6/9. Current STATE accurately retains count41 and TASK068 in progress. No feature, numbered criterion, clinical rule, price, provider, role, real-data authority or completion definition is changed.

## Framework and dependency review

Applied actual open-source Vercel Plugin0.53.0 (`3b472643cbb1a42479d99b0c9a1d27b8bc84aaa7`), verification and the mandatory React review after TSX editing. Reviewed event-handler/ref/primitive-effect/functional-state/import/conditional-render guidance. The explicit event handler has no network effect, the generation lives in a ref, existing state-based display updates remain ordinary React hooks, the new button has native accessible semantics, and no production dependency or broad bundle change is introduced.

Reviewed installed Next16.3.8 client-boundary and Vitest guidance, React/ReactDOM19.3 README and act/createRoot types, actual app react-jsx configuration and Vitest5.0.3 per-file environment convention. Synchronous client component DOM testing is supported; no async server component, additional test library, types package, global environment or Vite plugin is added. Existing installed eve0.69.0 fixed-handle semantics require fresh session creation rather than revival of a terminal bound ID. The handler and authored agent/workflow directories retain their current interfaces and authority.

Package scope is one exact dev jsdom27.4.0 pin. The lockfile matches that importer, its transitive dependency closure and the corresponding Vitest optional peer binding; no unrelated package version or runtime dependency changes. Locked jsdom engines `^20.19.0 || ^22.12.0 || >=24.0.0` support the selected Node24 target.

The retained normal dependency receipt records the sole direct pinned pnpm10.32.1 operation with NODE_DISABLE_COMPILE_CACHE=1, --lockfile-only and --ignore-scripts; native exit0, Done in6.9s, downloaded0/added0. No installation or script/generation was requested. This bounded command/result evidence does not prove full retained node_modules/client/cache/report/process/target byte equality; those old holds are not reopened.

## Validation boundary and next step

Source PASS admits reviewed same-branch publication. The first ordinary changed-source CI must freshly install the reviewed lockfile, generate from the current schema and apply migrations only to its new synthetic service before both builds/typechecks and full tests. The four DOM cases and new handler case are authored, not executed here. Expected256 Vitest/25files and handler11 are selection expectations only; actual counts, skips, failures and results require the normal CI evidence and independent result review. Separate learning and CTO adoption/documentary closure still precede TASK068 DONE or any count advancement.

Trace reviewed: failed saved setup -> explicit local restart -> next Send with fresh identity -> current owner/location route -> fresh eve binding -> saved response/UI, with old history untouched. jsdom and intercepted eve leaves do not establish an actual browser, live terminal/provider recovery, eligible hosted inference, clinical activation or any complete pilot criterion. Protected previews/requested `ALLOW_REAL_CLIENT_DATA=false`, current deployed source/effective hosted guard unknowns, default-disabled maintenance, all nine pilot/production gates, external dependencies, TASK066 retained unknowns and permanent TASK057 parking remain held. No passing check/shared migration replay or old allocation reset is authorized.

REQUIRED_FIXES: none for the frozen source scope.
