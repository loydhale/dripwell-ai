# TASK149 evidence boundary

Captured after the13:01:24 UTC genuine static source acceptance on2026-10-14.

- New module: `apps/web/lib/owner-configuration-lifecycle.integration.test.ts`,489 lines/34768 bytes, SHA256 `b87bc87e8b7cfcf2502c2c79b9a609d41e5c327ddb2d9449964bd6970706e3e7`.
- Selected new case: “activates two owners' clinical catalogs, resets draft tests and restores immutable history”. Static review accepted; actual execution is UNRUN.
- Intended successful-path counts22 handlers/47 additional ORM and expected304 total unit tests/30 modules are source expectations only. They are not recorded runtime values.
- First ordinary changed-source CI must show the new case ran without an affected skip and the retained suite, types and workflow passed against the reviewed source. Checkout tree equivalence must be established; a queued run or summary alone is insufficient.
- No local test, typecheck, SQL, shared migration, provider request, browser action or client-data operation occurred in this source phase. Existing passing evidence is retained.

Actual new publication, readback, CI outcome and later learning are pending at capture. The earlier accepted saved-recording repair is separate evidence described in [its checkpoint](../../audits/task146/README.md). Original147 closing deadline miss, local146 failures/unrun correction, all nine pilot stories and production dependencies remain held. No raw fixture identities, secrets or private execution artifacts are projected here.


### R1 correction and verification, 2026-10-14

The first ordinary CI run [38571100290](https://github.com/loydhale/dripwell-ai/actions/runs/38571100290), attempt 1, failed the web build on source f2a3772778afae1c7b4822d18b01a09e89aa233a. Its synthetic PR checkout 25ce20354829b6b293b8166c3235b37077c902cb has the exact reviewed 6a71a136aca493d3ab6cf9de711d491775cbc0a7 tree. TypeScript first reported the extra closing parenthesis at test line 223, which the earlier static review missed. The new handler case never ran; the standalone typecheck and following test suites were skipped. That failed source and run remain recorded.

The correction removes exactly one parenthesis and preserves every lifecycle, history, isolation and cleanup assertion. Corrected test SHA256: 099986b7e4156e659d0fe5c93e4dabc85a536d8cdfc9c0b523b294a1eefb8a3b. Independent source and publication-helper review passed, with genuine Root adoption at 14:16:47 UTC. A separate local check attempt failed in installed pnpm's automatic dependency setup before TypeScript ran. No local compiler PASS or broader dependency/cache invariance is inferred. The failed private checker and its once are closed.

The reviewed repair may be published only with verification pending, after the complete current packet, fresh lease, full 1,200-second admission reserve and native PRE/CAS/POST readback. The first ordinary CI on the changed source must actually compile the web app, execute the named positive two-owner configuration case and retained suites, and pass the configured typecheck and builds. Independent actual review and separate learning must follow before this new coverage is verified. No manual CI rerun is authorized.

The original TASK149 ceiling remains 15:00 UTC, with latest publication admission 14:40 UTC. All nine pilot stories and twelve release gates remain open. Protected previews, requested ALLOW_REAL_CLIENT_DATA=false and default-disabled maintenance remain required. Current hosted source and effective guards are unverified. This checkpoint does not establish the required browser, recording/transcription, model, sharing, payment, roles, retention or full-story evidence.
