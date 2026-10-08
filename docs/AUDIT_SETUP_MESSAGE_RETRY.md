# TASK067: Failed setup-message retry

AUDIT: TASK067  
REVIEWER: /root/setup_retry_auditor, independent of CTO and Coder  
DATE: 2026-10-08  
VERDICT: PASS, source review only; first changed-source CI pending  
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
