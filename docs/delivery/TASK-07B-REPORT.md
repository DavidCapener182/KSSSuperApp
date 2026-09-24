# TASK-07B — Workforce Schedule / Rota delivery

**Status:** Implemented in synthetic development only, pending David's acceptance. Starting point `7f46f1b`. Protected staging was not changed or deployed.

## Delivered

- `/workforce` is a manager-only weekly view for active Office, Operations and Super Admin roles. London-local Monday weeks, date navigation, day/Event groups, filters and bounded pagination are backed by a guarded `workforce_week` read RPC. The rota has no mutable table or action API.
- Counts derive from current planned requirements and active allocations: Required, Allocated, Remaining and Accepted. A multi-day Event counts once per week but its requirements appear on each authoritative service date. Cross-midnight duty appears once, with next-day finish shown.
- Explicit availability-conflict headline counts include active allocations overlapping `UNAVAILABLE` and declarations that no longer cover an allocation. Not-declared and partial coverage are shown separately as warnings. No readiness, attendance, eligibility or pay conclusion is produced.
- Requirement links open the exact existing Event allocation Sheet. All allocation, response and availability changes continue through their established guarded source operations.
- Manager **Staff schedule** uses a paginated active Security Staff selector and a narrow operational schedule projection. `/my-schedule` resolves the authenticated Staff Person and composes only their own active deployments and availability, with links to My Deployments and My Availability.
- Desktop uses a week list with compact Event/requirement rows. At 390px, managers get selected-day cards and Staff get own day-grouped cards. Text labels carry every status; the new UI contains no intentional green.

## Data and authority

Source migrations are `20260924130000_workforce_schedule_07b.sql`, `20260924131500_workforce_filter_choices_07b.sql` and `20260924133000_workforce_client_exact_07b.sql`. They add five guarded read functions and a partial service-date index; they add no rota records or raw table write grants. They were applied in order to dedicated Dev project `dnfhkmmnlbiabqypclqg` and read back there as security-definer functions with fixed empty search path, authenticated execution and no anonymous execution. The third migration makes Client-label filtering literal rather than wildcard matching. No staging migration was applied.

The server routes check active role capabilities before RPC calls. Manager functions return explicit safe columns, never availability notes, private Profile/SIA/evidence, CRM pipeline or Contact details. Staff self reads resolve identity from AuthIdentity and accept no Person ID. Search, rows and scoped totals use the same authorised filter set. A weekly read uses one SQL statement/snapshot; pages use deterministic offset order. Concurrent edits between separate page requests can change page membership, which is a documented offset-pagination limit. On the small synthetic fixture, `EXPLAIN ANALYZE` used the new service-week index and ran in about 4.4 ms; this is not a production-scale performance claim.

## Verification

- Clean `npm ci --ignore-scripts --no-audit --no-fund`: passed.
- ESLint, `tsc --noEmit`, Next.js 16 Webpack production build: passed.
- Focused Workforce and London-week tests: 2/2 passed against synthetic Dev. They checked a football Event, multi-day Festival, cross-midnight duty, 11 required / 2 allocated / 1 accepted / 9 remaining, one explicit conflict, gaps/conflict filters, manager Staff schedule, own schedule, role denials and safe-column absence.
- Smoke passed. The serial broad regression suite passed **32/32** tests in 324.6 seconds, including the controlled-document fixture, shell route/return-target checks and 07B tests. It recorded 10 synthetic Auth sign-ins across 146 session requests with no Auth throttling. The separate session-reuse engineering commit is `97d4b30`.
- Database migration/function readback and index explain: passed on Dev. Existing RPC-only tables still produce the pre-existing Supabase advisor `rls_enabled_no_policy` informational finding; no new table or permissive policy was added.
- Browser: Office desktop 1280px week and exact allocation Sheet, Office 390px week/Staff schedule tab, Operations desktop 1280px and 390px week/detail, and Staff 390px My Schedule/detail. Observed Office/Operations totals matched the RPC fixture. Operations detail separated one explicit unavailable conflict from one not-declared warning. Staff viewed only own accepted deployment and own unavailable declaration. Staff `/workforce` and Operations `/crm` returned 404. Both manager 390px views measured 390px body width with no horizontal page overflow. Keyboard/focus sanity and text status labels were checked in the browser. Manager Staff search/selection is covered by the focused RPC test; the final mobile browser capture shows its search surface, not a selected Person.
- New UI source no-green audit, staged diff whitespace check and literal-secret pattern scan: passed; zero potential literal-secret matches.

Representative captures: `output/playwright/workforce-07b/office-1280.png`, `office-exact-sheet-1280.png`, `office-390-final.png`, `office-staff-schedule-390.png`, `operations-1280-final.png`, `operations-390-detail.png`, `staff-390-detail.png`.

## Security findings and limits

The initial return-target UUID matcher was corrected so exact Event/requirement links can round-trip safely. A browser fetch race was also corrected so an older week response cannot overwrite a newer selected week. The separate test-auth/session engineering task is committed as `97d4b30`; it is not part of this business migration. The final serial run passed without Auth throttling and with the controlled-document fixture passing.

No static guarding demand, recurring rota, notifications, attendance, worked hours, timesheets or finance was added. Training and live operational eligibility remain unconfigured. The recommended next step is a product walkthrough of CRM → Client → Site → Event → Staffing Plan → Allocation → Availability → Workforce → Staff self-service, then a separately approved priority decision.
