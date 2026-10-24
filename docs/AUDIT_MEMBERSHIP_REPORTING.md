# TASK049 client membership reporting audit

PASS for the reviewed source, affected checks, type check and current-source build. This is an F06/F12 reporting change based on `abb4ec3d3bc5` (tree `4ea7a44f2b26`), with seven application/test paths reviewed before publication.

Dashboard and the owner overview now show staff-confirmed client enrollments, explicit non-enrollment and unrecorded outcomes. Full actual-care validation keeps missing or invalid records unknown. All three counts come from the same complete tenant/location consultation cohort in the existing Serializable transaction. Reporting includes archived visits, excludes setup tests and uses consultation creation dates in an inclusive-from/exclusive-to interval. Board search and pagination do not change these totals; repeat client visits count separately.

The summary distinguishes enrollment count over all consultations from the rate among recorded outcomes. For 20 visits with five true, five false and ten unknown outcomes, it shows 5/20, a 50% recorded-outcome rate and ten not recorded. Empty and all-unknown cohorts show no percentage; recorded false-only outcomes correctly show 0%. Wellness acceptance, service purchase, collected payment and DripWell account billing remain separate meanings.

Reviewed source paths:

- `apps/web/lib/clinic.ts`
- `apps/web/lib/membership-metrics.ts`
- `apps/web/lib/membership-reporting.test.ts`
- `apps/web/components/clinic-context.tsx`
- `apps/web/components/dashboard.tsx`
- `apps/web/components/owner.tsx`
- `apps/web/components/membership-outcomes.tsx`

| Actual check | Retained outcome |
| --- | --- |
| First affected test run | 11 passed, 1 failed, 0 skipped; original FAILED preserved |
| Corrected affected case | 1 passed, 11 deliberately filtered/skipped; all 12 original titles retained |
| Combined distinct coverage | 12 passed cases: retained first 11 plus corrected one |
| Type check | `tsc --noEmit --incremental false`, child/outer exit 0 |
| Current-source build | Installed Next16.3.8 `build --webpack`, child/outer exit 0, no timeout |

The sole first-run failure expected lowercase `datetime` in static HTML. Installed React19.3.0 emitted `dateTime`; only the two expected attribute literals changed. Eleven unaffected cases were not replayed. Their bodies and production bytes stayed unchanged. The focused selector and reporter retain one executed pass and eleven explicit exclusions, rather than relabeling the original failed run.

The build produced `CSZLi10VDKbb2jx5k6JpB`, 43 routes and raw integrated compiler output of 26 steps/3 workflows. Type, build and final source guards passed with the declared seven source files and held Root documents unchanged. Independent review found no blocking source issue.

The tests execute the real aggregator through mocked Prisma transport and render synchronous React markup. They cover complete-cohort query predicates, foreign scope, half-open date edges, archives, setup-test exclusion, board independence, full actual-care validation, missing outcomes, rate arithmetic, both UI placements and the existing owner role gate. They do not prove real SQL execution, live enrollment/payment data, browser hydration, visual/device behavior, assistive-technology behavior or performance under load. Packaging has no full network capture; its log reports `.env.local` while the runner blanks listed DB/provider/auth/hosted selectors. No environment or credential body was inspected by the Auditor.

Webpack and integrated packaging success do not establish default-Turbopack behavior, native workflow execution, deployment or new CI. Preview807, the protected false-data gate and all prior partial/failed histories remain separate evidence. No live conversion, payment, satisfaction, TASK050 or full-pilot completion claim follows this audit.

TASK049 displays43 routes. The installed Workflow5.0.1 adapter deliberately retires the separate step endpoint and generates a combined flow handler with one workflow queue trigger; retained current route/config manifests agree. Historical TASK04744 remains its original build observation. This static contract comparison does not add runtime or hosted delivery proof.
