# Recording diagnostic setup stop and cleanup

The TASK078 diagnostic stopped because two containment checks tried to create the same immutable receipt. This is our test-controller defect and an independent static-review miss. It does not identify or fix the application recording failure. The original case never ran.

Independent actual-result review returned **CHANGES_REQUIRED** for the controller and accepted its truthful setup STOP and exact-owned cleanup. Root read the whole 10,584-byte audit in native74377d, then genuinely adopted it in593ab9 at2026-10-11T07:24:54.856543Z. The frozen audit SHA256 is7da068c8c0972501708b6ff9fb52e9fb494b4f7116e026dee95d40205437ede9; Root receipt is786bytes/b7fb8d800fd82968a9a3dad7e045a528c3e6e28a4de33f6600db7fa23adf8c70. Raw source, logs and database captures remain private.

## What actually ran

The separately admitted operation used the unchanged frozen077 driver42561bytes/SHA2563a860e2f3018b5a4785f68d43dc980d2e1ad6519ac06f83f0bf915502f758e7d and handoff20883/383ae0b1. Origin077 and execution078 are different phases, not a reset of an earlier allocation. Its exclusive intent consumed the sole operation at07:13:30.306217Z. It finished07:14:03.837740Z, within the fixed07:12:10.041613Z–07:32:10.041613Z clock and07:29:10.041613Z reserve cutoff. Remaining elapsed time grants no second invocation.

| Boundary | Actual evidence |
| --- | --- |
| Current-source gate | Local HEAD0e97ff15; application diff empty |
| Newly owned PostgreSQL | Initial public tables empty; new target identity remained stable |
| Runtime compatibility | Actual owned container exit0, Node24.19.0/native runtime loaded |
| Fresh Prisma generation | Actual owned container exit0, Prisma6.19.3 |
| Post-generation containment | First immutable containment-050.json created |
| Fresh-identity entry | Second consecutive containment call raises FileExistsError for that same receipt |
| Helper/full fresh schema and types | Never reached; no generated-current-client.json |
| Shared emit, migrations, recording case | Never reached; zero original-case entries |
| Owned cleanup | All59 native children reaped and all three exact CIDs terminal/PID0/removed |

The outer native command exited0 because the controller caught and reported its failure. Logical result isSETUP_OR_OBSERVATION_FAILURE_STOP, reproduction_entries0, original_sql_causeUNKNOWN and fixture_restorationUNVERIFIED. RESULT.json is905bytes/SHA256ef7271257e03f39450587f955aa973aff51b99f0b2c7b817785601421200a8fe. The immutable result is not rewritten to PASS.

## Required correction

The frozen source calls containment immediately after generation, then immediately again inside fresh_identity. Both derive the receipt filename from native-command serial50. No native command runs between them, so exclusive creation of the second receipt fails. The observed first-error timestamp07:14:03.159975Z, existing391-byte receipt3c87a38c and source chain407→345→244→50 establish this controller cause. No exception traceback was retained; this source chain and first-error evidence are the available trace.

Give each containment invocation its own exclusive receipt identity, independent of the native command serial. Preserve both checks and both witnesses. A separately admitted correction must test consecutive calls at an unchanged native serial, distinct immutable receipts, preservation of an existing-path collision, and negative path containment before dependent helper/application entry. Overwriting receipts, skipping a check, deleting the consumed intent or retrying the failed source would weaken evidence rather than repair the defect.

That necessary source correction remains an engineering task under the standing until-done scope. This report grants no new source/runtime allocation. Root actual-verdict adoption, distinct later learning and final reviewed documentary publication precede a separate concrete correction disposition.

## Cleanup evidence and limits

The Auditor inspected all59 retained native receipts and their118 stdout/stderr captures. All capture hashes and0600 regular-file identities match. Fifty-seven children exited0; two readiness probes exited2 before the later accepted-ready probe. Every child has source-bound wait/reap evidence and no timeout or output-cap reason. Largest capture16009bytes is below the8MiB cap.

Only the three newly created PostgreSQL, compatibility and generation containers were closed. Exact CID creation/label/network/mount identities match retained wait, terminal inspection and removal captures. Each has wait0, Runningfalse, terminal exited status, PID0 and matching exact-CID removal output; closure_errors is empty. This is owned closure evidence, not a new global process inventory or resolution of old retained-target holds.

Initial and final owned PostgreSQL CSV snapshots are each4115bytes/SHA256048432ac1fe766f069e9594119f6639aaa42a106129ca475ec5bf9c2616181a6, byte-identical19LOG/00000 rows. There is no observed ERROR in this setup window. It cannot explain the historical eleven-of-twelve recording failure or unobserved later output. Private PGDATA is retained, not disposed or declared a restored shared fixture.

The source review's original PASS77fff5de and subsequent077 NO_NEW_LEARNING remain intact. The077 overly broad filename-search deviation is also retained separately; this execution's limited old_resources_touchedfalse field does not erase it or establish globally zero old metadata access.

## Project state

Application source9bd84b463405fa57d755c9929a826751902319b5 and wholeCI38080612363 remain failed:11 completed publication bodies/rollbacks and remaining1 against required12/12/0. No application code, retry oracle, schema, package, CI or governance change occurred in this diagnostic. Count42/L035Seen8, all nine PRD8 pilot criteria and production gates remain held.

Protected previews and requestedALLOW_REAL_CLIENT_DATA=false remain. Current deployed source and effective hosted guard are unverified. Selected AI eligibility/inference, Resend sender/key/DNS authority, platform-admin MFA/authentic paid-referral proof and ordinary full-story gates stay individually parked; clinic catalogs/prices/reviewers are onboarding inputs. No purchases, provider changes, external messages, admin bootstrap or real data were enabled.

Distinct later learning refined existing G-018 after genuine actual-verdict adoption. Root fully read report5281bytes/f975b524 and exact5570-byte diff6dda38bc in1a8c9a, then genuinely adopted it. No new lesson/pattern/gotcha number or L035Seen8/count42 advance. The TASK077 original learning diff is preserved; the new exact diff uses a separately owned task078-learning path. Final new documentary co-sign and publication remain separate.
