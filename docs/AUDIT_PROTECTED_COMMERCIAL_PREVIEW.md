# Audit: Protected commercial preview

Date: 2026-10-04
Task: TASK-043
Verdict: PARTIAL. Deployment, source identity, protection and read-check cleanup PASS. The original clinic-owner settings story stopped at normal application authentication.

## Exact published and deployed source

Published source is `80729f2f2352fa55b1e0ba911082ab52eeca8032`, parent `7dd003dfb320189ab80c541e096209082380d680`, tree `f61dbdd0e3e23f0988112b988e4134bc5ef5ab2b`. Independent normal GitHub readback verified all 21 changed remote blobs and modes, the exact open/unmerged PR #2 branch, title and 7,680-byte body. The publication wrapper initially received a stale PR head after the successful branch publication. A bounded GET-only readback established the actual new head; publication and PR PATCH were not repeated.

Actual new-source CI run `37164636989`, job `111324946837`, attempt 1, completed successfully. All 22 steps succeeded. Full decoded logs establish 181 passing cases with zero skipped, failed, cancelled or todo cases: Node groups 23, 8, 15 and 11, plus 124 Vitest cases across nine files. These include the 40 new price-history unit cases and six new actual-PostgreSQL cases. The checked-out PR merge has the exact reviewed source tree. Shared/web types, Prisma generation/validation, ten migrations on the fresh CI database, optimized Next 16.3.8 and Eve builds passed. CI migrations were not reapplied to a retained or hosted database. Source/fixture checks do not establish a live Stripe webhook or payment.

The isolated stage was compared against every immutable source blob and Git mode: 353 tracked files, 354 actual leaves, no symlinks. Its only source adaptation was `apps/web/vercel.json` with preview `crons=[]`; its only added file was the established nonsecret Vercel project link. It contained no environments, credentials, fixtures, private verification tools or generated build outputs. Root ICM and authored `apps/web/agent` and `apps/web/workflows` were retained.

## Protected preview deployment

One reviewed normal remote preview deployment exited 0, from 00:51:56.503236Z to 00:53:35.357255Z. Subsequent supported metadata readback, separately from the command exit, confirmed READY:

- Deployment: `dpl_AsLremfTJcQ5ew7Cukxn3Ed7n9dJ`
- Unique URL: https://dripwell-fgv2zynes-loyd-1222s-projects.vercel.app
- Stable URL: https://dripwell-ai-preview-loyd-1222s-projects.vercel.app
- Project: `prj_fF0yFggYVFN9pI5dQN33glG2wPyW`, team `team_ATVYA30szlVoy5XxAIiaf2OD`
- Exact deployed source/tree: `80729f2f` / `f61dbdd0`, non-production deployment

Actual full remote build logs show `/vercel/path0/apps/web`, Next 16.3.8, 31 static pages, 20 durable steps, two workflows, one initialized Eve sandbox template and two physical Eve runtime bundles with the Prisma RHEL query engine verified. The CI standalone artifact's one native-engine bundle is a separate observation. The ancillary npm worker-version lookup failed, but the actual build and deployment succeeded; the lookup and deployment were not retried or hidden.

The archive deployment initially left the existing manual stable alias on the older `b61f6aa` deployment. That original observation is retained. One separately reviewed normal same-project preview alias assignment then exited 0 at 01:01:35.175729Z. Its subsequent actual changed-alias readback at 01:02:21.394721Z points to the new READY deployment and unique URL above. There was no second deployment, production promotion or domain/protection change.

Fresh selected controls before deployment verified `apps/web`, Node 24.x, team-issued project OIDC and Vercel authentication protection. All 27 environment metadata records were Preview/Development only, with no Production, branch-specific or custom overrides. The selected nonsecret flag was literally `ALLOW_REAL_CLIENT_DATA=false`. Native deployment output retained Vercel authentication, and the later anonymous request observed the protected boundary. Optional deployment fields projected with `.get()` as null lack retained raw field-presence evidence; they do not establish disabled OIDC/protection or an explicitly null project root. The separate actual project settings and build path establish those facts.

No hosted migration, provider inference/transcription, Stripe payment, Resend message, billing-policy publication, real-client enablement, upgrade or forced cache-bypass operation was performed in this deployment task.

## Original-owner read check and retained failure

The first authorized smoke stopped on a verification-cookie assertion before any anonymous request, project-token issuance or application-auth request. Its original helper and peer PASS are retained. The fixed original 667-byte Netscape jar contained two entries: an expired `dripwell_session` and a still-valid `_vercel_jwt`. The verification tool incorrectly asserted that the entire jar contained one cookie. This is a tooling failure, not an application denial or owner UI result.

The first attempt nevertheless captured two successful SELECT-only snapshots across all 50 public tables, including the migration ledger. Counts and full-row digests matched, with four retained generation jobs and two expired recording segments unchanged. It preserved the original cookie, removed its owned copy and left clean source `80729f2f`.

A separately reviewed continuation selected the named application cookie and excluded the stored Vercel cookie in memory. Twelve offline fictional-cookie cases checked the selection/normal-expiry contract. Independent peer review also caught a missing clean-source closure assertion before execution. The revised continuation records and enforces clean exact HEAD/tree plus original-cookie/owned-input cleanup before allowing a PARTIAL result. The original continuation draft, finding and corrected review remain preserved.

The continuation executed only previously unattempted boundaries, once each:

| Boundary | Actual result |
| --- | --- |
| Anonymous unique-origin `/api/auth/me` | 302 to Vercel `/sso-api`, 02:02:48.411841Z; zero followed redirects or credentials |
| Normal selected CLI `project token` | Exit 0 at 02:02:54.435009Z; exact project/team claims, transient token in memory, no credential argv/file or protection-bypass write |
| Stable-origin application `/api/auth/me` | 401 `UNAUTHENTICATED` at 02:02:56.156891Z; JSON, `private, no-store, max-age=0`, `Pragma: no-cache`, `nosniff` |

The standard client omitted and cleared the expired app cookie. The stored Vercel cookie was never transmitted. The actual 401 establishes unavailable normal owner authentication; it does not prove that an expired token was sent or rejected. Local OIDC claim inspection was not represented as signature verification; the destination verifies the normal first-party token. Native token issuance is a normal authenticated POST interface, not an assertion that every wire request was GET-only. Raw token, request headers and response bodies were not retained.

No authorized normal-login input selector for that original owner was available. The check stopped at the actual auth boundary: zero owner UI, pricing/trial/referral API, browser, login-refresh or account-bootstrap operations. A later separately approved fresh fictional clinic-owner verification can address those remaining checks without erasing this original-owner limitation.

## Data and execution closure

The continuation performed one final SELECT-only 50-table snapshot at 02:02:57.665950Z, compared to the preserved original checkpoint from 01:37:57.194111Z. Every table count/full-row digest matched; the same four jobs and two expired recordings remained. This comparison spans the intervening pause. It is not a newly captured before-request baseline and cannot attribute any hypothetical mismatch to an individual request. The original before snapshot and first smoke were not replayed.

Actual closure at 02:02:57.708017Z established the unchanged original cookie, absent owned copy, no active owned token processes, zero started browser processes and clean exact source/tree. One native descendant had recorded zombie state; no running worker or browser was inferred from it. The continuation's actual result at 02:02:57.708206Z is PARTIAL with no failure. The first smoke remains FAILED. Tool exec streams were merged; helper operation timestamps are preserved without inventing a separate outer-shell completion time.

## Scope and evidence

This audit proves the reviewed commercial/billing source reached the protected preview with its source identity, actual CI/build, same-project alias and safe read-check closure. It does not verify the original owner's rendered offer/trial settings. It does not complete live signed webhook/payment/referral qualification, delivery, eligible hosted inference, recording/transcription, two-clinic approvals/sharing/PDF/board/reminder/trial/role/retention story, or the approved pilot/production gates.

The 14-day/10-consultation trial and current USD199-per-clinic-account monthly offer remain the separately reviewed source contract. No subscription enrollment or referral credit was created here. Protected previews and the literal false real-data gate remain in force.

Private compatible source/plan/GO/peer, full CI/build, actual deployment/alias, original failed smoke, continuation and cleanup artifacts are pinned in `TASK043_FINAL_EVIDENCE_MANIFEST.json`. Principal independent receipts are publication/CI `9aa2c294`, actual stage `ea0de6c6`, selected controls `667237b6`, READY/build `31ed2779`, changed alias `5e550997`; continuation peer `d003aee2`, CTO GO `575f16d1` and actual result `13e761f8`. The complete public report receives a separate factual Coder co-sign before reviewed documentation publication.
