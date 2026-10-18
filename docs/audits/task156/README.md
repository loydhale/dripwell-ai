# TASK156: historical consultation configuration pinning

This is scoped regression evidence for existing F02/F10 and PRD section 8 criteria 1 and 6. It does not complete either pilot story.

## Reviewed change and actual result

Source commit [903cc2292068823701baae0e48611075743b9370](https://github.com/loydhale/dripwell-ai/commit/903cc2292068823701baae0e48611075743b9370) adds one 134-line case to `apps/web/lib/clinic.integration.node.test.ts`. No production code, previous test body, fixture, dependency, schema or workflow changed. The reviewed source publication also contains TASK156 and the operative STATE preamble. Its sole parent is `97c65233a38f3de46b26c62824bd79cc48743546`; tree is `33ae88c3d27f2914b78777e7912493bb17a011c5`. Independent remote/native readback matched all 903 leaves, including 900 unchanged leaves; PR #2 body, base and open state were preserved.

The new named case, **pins historical consultation artifacts through configuration replacement, rollback and regeneration**, passed in **669.508151 ms** in [first ordinary CI run 39097715187](https://github.com/loydhale/dripwell-ai/actions/runs/39097715187), attempt 1, job 117587495935. All 22 steps passed. Clinic 18, domain 23, authentication 8 and AI-boundary 11 cases passed without failures, cancellations, skips or TODOs. Vitest passed 309 cases across 31 modules; shared/web typechecks and both builds passed. The checked merge `63d69faaff9bc980f3fd7b7be0f23b5a23c2e754` had the identical reviewed tree. The Node clinic case is separate from the 309 Vitest count.

CI used a fresh dedicated PostgreSQL 17.11 target, Prisma 6.19.3 and 14 migrations in that disposable target. The service container and network were removed. Dependency caching and nonfailing diagnostics are disclosed; no older passing check or migration on a shared target was replayed. No application import, dependency restoration, test, build, SQL, browser or provider operation ran locally.

The test activates catalog A, saves visit A, activates changed catalog B, saves visit B and normally rolls back A as a distinct configuration version. It checks that both visits' configuration bindings, commercial facts, saved revisions and approval facts remain unchanged. An intentional non-safety summary correction invalidates approval normally; regeneration uses each visit's original configuration and official offer facts while preserving earlier revisions. Synthetic USD values are fixture facts, not platform prices.

## Independent review

The independent Auditor reviewed the recovered current checkpoint, specific missing coverage, exact source/documentary patch, remote publication and actual CI. Root fully read and accepted each phase before its dependent action. The accepted result verdict is `PASS_ACTUAL_PUBLICATION_AND_SCOPED_PINNING_REGRESSION`.

| Retained review | Bytes | SHA256 |
| --- | ---: | --- |
| Source/publication-plan review | 5353 | `cfd8924817d343e26c7a42865cf73ed2ad39c06036c46152b7a2220cf6daa0d2` |
| Source typed input manifest | 6507 | `1dd66b85d3d78b967ffc8cd1f70b211f06bdb20c9a042c2c0466d44e3c3ccd29` |
| Actual publication/CI review | 5848 | `0559c8e3a1ff9d1bc7fc848d38e550eb600ed9e41452ae627fac932de4569b74` |
| Actual typed input manifest | 7046 | `7d569d063ad5f8209138a038508b91c73e9398894e66832806a75d05223fd6ff` |
| Actual job log, fetched once | 215077 | `25a725ee7dc75f799810a1d6b0e64de3d2e7e4fb89cf96f80449b2b52482634a` |

These private retained files are under `/workspace/scratch/dripwell-156-auditor`. This public projection preserves the review identities and directly accessible source/CI references; future distinct work does not require reconstructing unrelated lost private receipts. Distinct post-result learning report `7276fd318b714b0a12c82a41b9df6dd256a00e5c5ca116a10dcc9f2400398e54` and exact patch `90d5902d7358a097a51e1c4fab64c8af5368166a62a8788c27c0a1a7e60556d1` were subsequently fully read and genuinely accepted. They refine L-044 once (Seen 1 to 2) and P-027; no new ID, gotcha or other counter change. The final documentary co-sign/publication is separate at this prepublication snapshot and completes through actual readback, without repeating checks or a closing-SHA-only commit.

## Evidence boundaries and remaining work

This case uses existing direct service calls, real stored sessions and seeded fictional MFA/clinical actors. It is in-process handler/disposable-database evidence, not normal browser signup, real clinical authority or deployed verification. Deterministic outputs are not live model inference; reminder kickoff is not a durable timer result. The isolated synthetic test process temporarily enables its existing fixture flag and restores it. The requested hosted setting remains `ALLOW_REAL_CLIENT_DATA=false`; actual hosted source and effective guards remain unverified.

All nine full pilot stories and twelve production gates remain open. Protected previews, default-disabled maintenance, ICM folders and authored agent/workflows remain required. TASK057's permanent release park and older closed attempts remain separate. Stripe sandbox is already complete. Owned Resend sender/domain, selected platform-admin MFA, eligible model/transcription service access, authentic paid-referral and retention evidence remain individual prerequisites. No purchase, provider switch, pooled personal subscription, partner application, outbound send, administrator bootstrap, production deployment or real-client enablement occurred.

## Current owner handoff, October 18

The internal status-only loop and missing checkout were team recovery problems. They did not require more general coding permission from the Owner. Shell/native Git access was restored and independently approved forward work proceeded despite unavailable historical private receipts. A finite rejected gap assessment never established that all independent approved implementation was exhausted.

Owner input still needed is the owned sending domain for the selected Resend sender and the email/person to hold platform-admin authority with MFA. Those choices do not block unrelated approved code. Existing Stripe sandbox completion needs no repeated setup question.

Separate AI service access remains unresolved. Fresh unauthenticated reads of the official documentation on October 18 confirm that [ChatGPT plan usage documentation](https://developers.openai.com/siwc/token-sharing-open-source) covers open-source and locally hosted apps and directs paid/remotely hosted apps to an interest form; DripWell's applicable commercial eligibility has not been established. [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) explicitly exclude audio/video input and transcription. [Terms](https://openai.com/policies/sign-in-with-chatgpt-terms/) prohibit using one user's subscription to fulfill another user's requests. An interest form was not submitted. No inference, account balance, spending quote or selected provider access was freshly tested by these public documentation reads, and no funded service or provider change is implied.
