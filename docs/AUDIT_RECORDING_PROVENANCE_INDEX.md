# Isolated recording provenance-index test, TASK056

Source checkpoint. Actual changed-source CI is unexecuted at this review; no passing result or pilot completion is claimed.

The existing cleanup test duplicated both the older tenant/path key and the newer immutable reason/sourceKind/sourceId tuple. Its P2002 result could not isolate the provenance index.

One added case uses two different schema-canonical setup and consultation/attempt paths for the same recording provenance. It requires the original real Prisma known P2002 and exact target columns reason, sourceKind and sourceId, requires a distinct-provenance control to insert successfully. It also checks no rejected row, two tracked successful rows, unchanged original intent and foreign recording control.

Three fresh IDs are tracked before writes. The fixtures are direct nonclinical intents with intentionally hypothetical source/target combinations and no new source-owner rows. They never enter adoption or provider I/O; valid database fixture identity does not establish real clinical ownership or a physical Blob.

All eight existing case bodies/titles, imports, helpers, guards, joins and exact nonce-owned teardown are preserved. Production, schema, migrations, CI, packages and other tests remain unchanged. Installed Prisma6.19.3, Vitest5.0.3 and open-source Vercel Plugin0.53.0 guidance informed the plan and review.

Verification uses the first ordinary automatic changed-source pull-request CI with fresh PostgreSQL17. No local passing-check replay, shared/hosted migration, manual CI or prior provider/helper replay is selected. Exact metadata and positive insertion must pass without a code-only fallback.

This is the existing F03/criterion9 coverage gap. Whole retention, hosted maintenance and all nine two-clinic pilot criteria remain open. Maintenance stays disabled, previews protected and ALLOW_REAL_CLIENT_DATA=false. Source publication is separate from deployment verification.
