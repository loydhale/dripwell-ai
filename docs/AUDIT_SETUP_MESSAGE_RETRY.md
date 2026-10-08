# TASK067: Failed setup-message retry

AUDIT: TASK067  
REVIEWER: /root/setup_retry_auditor, independent of CTO and Coder  
DATE: 2026-10-08  
SOURCE_VERDICT: PASS, recorded before publication; actual CI review below
ATTEMPT: 1

## Reviewed source

Baseline: `1b5bff53a90401553b4274fb68c0ffa0078d8211`, branch `feat/dripwell-consultation-v2`, PR #2.

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| apps/web/app/api/setup/route.ts | 10639 | 764e46a9a133a2cbc2a2446ba36d69728e9545d251722d4827e50b4096013591 |
| apps/web/lib/advisory-locks.integration.test.ts | 28546 | 3fca85ad4f9706011c764ebe0b0597b2f7a3a44bbd2d811b2596ab45f0b5dc49 |

The actual files match the Coder's frozen source and two-file diff. Static whitespace validation passed. No application import, local build, typecheck, test, SQL, provider operation or deployment was executed for this review.

## Findings

- `components/setup.tsx:146` retains the same message/key after failure. Previously the handler returned that FAILED job, and `components/job-client.ts:18` rejected it without another attempt. The route now reclaims the authorized failed operation.
- `app/api/setup/route.ts:75` acquires the existing transaction advisory lock before lookup and claim. Lines 86-108 validate the canonical tenant, owner, selected location, optional explicit conversation, message hash and SETUP_CHAT kind before mutation. Conflicts fail with 409; foreign locations/conversations remain unavailable.
- `app/api/setup/route.ts:109` preserves nonfailed replay. The failed claim updates the same job to RUNNING, clears errorCode/completedAt and refreshes startedAt. Model/session work begins after the transaction returns, so an overlapping identical request observes RUNNING without a second send.
- `app/api/setup/route.ts:165` retains the stable job-derived user-message ID and existing atomic append dedupe. Conversation/session/job identity and completed replay are preserved. No configuration publication or clinical activation path changed.
- `lib/advisory-locks.integration.test.ts:267` adds two distinct recovery identities for transient session creation and transient send failure. Assertions cover same job/conversation/creation time, one stored user message, successful result/error clearing, completed replay without another operation and unchanged configuration rows.
- `lib/advisory-locks.integration.test.ts:301` holds the retry inside the intercepted send, observes RUNNING with cleared terminal metadata, submits an overlapping request and verifies one additional send, one job and no extra conversation. Its finally releases and joins the started handler before cleanup.
- `lib/advisory-locks.integration.test.ts:345` covers seven conflict variants, including two foreign-tenant paths and wrong kind. Exact failed job/conversation equality and unchanged send counts establish the intended denial assertions. Added fixture owners, tenant lineage and rate keys are included in the existing owned cleanup.

PATTERN_VIOLATIONS: none. P-008/P-010 authority and conversation binding are preserved. L-013 status consumers and L-023 supported void-lock operation remain unchanged. L-027/L-035 CI target/schema safeguards and G-002 database-generated fixture IDs are respected.

PRD_AUDIT: pass. TASK067 and current STATE additions correctly scope an existing F01 defect and section8 retry/tenant-boundary evidence. No PRD requirement, acceptance criterion, pricing, provider or role is changed. Count40 remains held pending actual validation and learning.

## Framework and validation boundary

Applied actual open-source Vercel Plugin0.53.0 (`3b472643cbb1a42479d99b0c9a1d27b8bc84aaa7`), verification and eve guidance. Reviewed the UI -> POST -> durable job/conversation -> response/polling story, authoritative Prisma schema, installed Next16.3.8 route-handler documentation and eve0.69.0 bundled client/session documentation. Existing framework APIs and credential-bearing redirect protection remain unchanged.

Installed eve's fixed session handle does not create a replacement for an unknown or terminal session. This change enables another attempt after a transient create/send failure when the bound session remains usable. It does not revive a terminal session, resolve uncertain remote message acceptance, grant hosted provider access or prove model output. The four new regression identities intercept eve leaves while exercising the actual handler and Prisma against the existing CI disposable service; simulated Next cookie context is not browser or live HTTP evidence.

The first ordinary changed-source PR CI must freshly install/generate the client and apply migrations to its new synthetic PostgreSQL service before builds/types/full tests. The unchanged workflow requests literal `ALLOW_REAL_CLIENT_DATA=false`. Source PASS admits reviewed same-branch publication; task DONE requires the actual CI result, independent result review and a distinct learning phase. No retained TASK066 target/cache/report/process is used and no old passing check or shared migration is replayed.

All nine pilot criteria and production gates remain incomplete. Protected-preview, real-data, default-disabled maintenance, external clinical/account/sharing/paid prerequisites, TASK066 local/historical unknowns and permanent TASK057 parking remain held. Publication supplies no current deployed-source evidence.

REQUIRED_FIXES: none for the reviewed source scope.

## Actual first changed-source CI, independently reviewed

ACTUAL_RESULT_VERDICT: PASS, /root/setup_retry_auditor, 2026-10-08.

Published source `b4aef87ac2d7db2a2f36a2abae87c1f5e251f434` is bound to PR #2, the same review branch and [run37791656066](https://github.com/loydhale/dripwell-ai/actions/runs/37791656066), run47/attempt1/job113360340309. Retained normal metadata reports completed SUCCESS for the run, job and all22 returned steps. The actual checkout `a3cc598250f4a90de83d786e323e2d2fade9bc4d` has tree `0090fb094954c7a567f8517a85a201a969cbf425`, equal to the published source/local HEAD tree. The two application/test hashes above remain exact.

Independently read the retained metadata and relevant raw log boundaries, without another GitHub fetch or test invocation. The log confirms fresh Prisma6.19.3 generation, valid schema and all14 migrations applied to the new disposable PostgreSQL service, followed by successful agent/web builds and typechecks. It repeatedly records `ALLOW_REAL_CLIENT_DATA: false` for this CI environment.

- Vitest:251/251 passing tests across24 passing files. The setup/policy handler module has10 passing identities in654ms, including the four new retry regressions. The recording consumer module has19 in11119ms. Both modules are subsets of251, not additional totals. New individual setup-case timings are unretained.
- Separate Node runs: domain23/23, authentication8/8, clinic15/15 and transcript/scope11/11; each explicitly reports fail0/skipped0. These are distinct runs, not part of the Vitest total.
- Actual complete module success corroborates the reviewed handler/real-Prisma assertions and source-enforced joined fixture cleanup. Full raw database rows and individual cleanup receipts are not retained; no independent live-row census is claimed.

Retained private evidence under `/workspace/dripwell-task067-ci-private`: RAW_CI.log211669bytes/SHA256`10ab12e33e646196bccbeccb764a57b79bd585a00dd0ebba567c046ceb8429ed`; CI_METADATA.json31837bytes/`97f1c44d055e4da8321f64e43f46a1d8193b2ecf32cea435b7ec33f28b44f163`; CHECKOUT_METADATA.json6110bytes/`276aee7162c440a20754972d3198714981173f9dd7e3d89aba3e68edea4406df`. Exact bytes/hashes were verified before interpreting their typed contents.

The TASK067 actual-check section, PRD8 component checkpoint and MINOR PRD_CHANGELOG are accurate evidence-only additions. Co-signed without changing any feature, numbered acceptance criterion or Owner authority. The2118-byte proposed PR body/SHA256`3cc2ccb968bc550838d58e0b0cd248883e97d2641d24fdb3b6e798c9ddbb69f0` is also approved: it describes the current fix/checks and preserves terminal-session, live-story and hosted-source limits.

This closes source/check review only. Distinct learning and CTO adoption/documentary closure still precede task completion/count advancement. No check was rerun, no retained local target/cache/process was used, and no provider/deployment/shared-migration operation occurred. Historical recording cause remains UNKNOWN; old internal parks, external inputs, current deployed source UNKNOWN and all pilot/production gates remain held.

## Distinct learning phase

Performed after the independent actual-result PASS above. Added L-043 for the previously undocumented FAILED idempotency replay trap and its explicit authorized retry transition. This is distinct from L-013's new-status consumer mismatch and L-020's downstream evidence/child-run gates; no existing Seen counter is incremented. Source/CI evidence supports the lesson's scoped claim, with terminal bound sessions explicitly separate.

No new pattern or gotcha: existing P-008/P-010 authority and conversation binding apply, and framework fixed-handle limits remain in this audit and the next confirmed task. PATTERNS/GOTCHAS and L-035 Seen7 are unchanged. Learning is complete; CTO must genuinely read/adopt this result and publish the final STATE/CHANGELOG/task checkpoint before advancing scoped count40 to41. Whole pilot/production and old internal/external holds remain unchanged.

## Final documentary closure

FINAL_DOCUMENTARY_VERDICT: PASS, /root/setup_retry_auditor, 2026-10-08.

CTO subsequently confirmed full reading and genuine adoption of the independent actual-result PASS and the distinct L-043 learning. Reviewed the final TASK067 closure, STATE, evidence-only MINOR PRD8/PRD_CHANGELOG checkpoint and limited current-resume clarification in AUDIT_PILOT_READINESS_GAPS. Scoped TASK067 DONE/count40 to41 is accepted once; L-043 Seen1 is the only new lesson, L-035 Seen7 and all old counters, allocations and holds are unchanged. The readiness matrix and all twelve features/nine pilot criteria remain intact; pilot and production remain incomplete.

TASK068 is admissible as the next separate F01 repair after this closing publication: one production UI file, real component DOM interactions and actual-handler/fresh-PG regressions, preserving typed input and saved old history while an explicit guarded action clears the bound selection and invalidates stale loads. Its five declared Coder paths include at most one exact dev jsdom dependency and matching lockfile resolution. Only scripts-disabled lockfile-only resolution with the existing actual pinned pnpm is allowed locally; Node24 compatibility remains for Coder to establish before selecting the exact version. No local install/node_modules change, application execution, generation, SQL, retained target use or old-task replay is admitted. Mandatory Vercel React review follows its TSX edit. Future implementation, first changed-source CI, independent result review and separate learning remain required; this brief supplies no terminal-session, live-model or pilot completion result.

Approved this ten-path documentary closure for the same branch/open PR #2 with [skip ci]; the accepted TASK067 source and first ordinary CI are unchanged, so no unchanged check replay is needed. The exact2118-byte PR body/SHA256`3cc2ccb968bc550838d58e0b0cd248883e97d2641d24fdb3b6e798c9ddbb69f0` remains approved. Publication is still the CTO's next action; it establishes neither deployment nor effective hosted safeguards. Protected previews/requested `ALLOW_REAL_CLIENT_DATA=false`, current deployed source/effective guard unknowns, full-story external inputs, retained TASK066 unknowns and permanent TASK057 parking remain held.
