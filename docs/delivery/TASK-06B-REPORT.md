# TASK-06B delivery report — Event Staffing Requirements

Status: implemented and development-verified, pending David's acceptance. Starting point `a7333b3`. Synthetic Dev project only (`dnfhkmmnlbiabqypclqg`); staging was not changed.

## Delivered

- Seeded eight stable operational planning roles: Deployment Manager, Stand Manager, Stand Supervisor, SIA, Steward, Response, Search and Gate Security. The SIA position label does not establish a Person's licence or eligibility. Catalogue management UI is deferred under the approved fixed-catalogue option.
- Added stable Event staffing requirement lines with exact role, service date, positive required quantity, reporting/shift instants, area, bounded instructions, `PLANNED`/`CANCELLED` state and revision. No Person, allocation, pay, rate, availability or eligibility columns/rows were added.
- Added immutable typed revision snapshots for creation, amendment and cancellation. Optimistic expected-revision checks prevent stale saves. Cancellation keeps history and removes the line from current totals. Direct authenticated table/history mutation is denied.
- Guarded Office and Operations create/amend/cancel/read for an exact Event. Staff, anonymous and non-Event roles are denied. Authenticated callers can execute only the explicit confirmed create/amend wrappers, which enforce reason and explicit confirmation for quantity above 100, shift over 24 hours and reporting over 12 hours early. 14-day duty and 7-day report-lead limits are technical nonsense guards, not workforce policy.
- Service date is the Europe/London report date and must fall inside the Event's London calendar-date span. Reporting before exact Event start and finish after exact Event end are valid with a UI warning. Cross-midnight duty is valid. Invalid/ambiguous DST local input is rejected. Event date edits that would orphan planned staffing are rejected without moving timestamps.
- Added Staffing Plan to Event detail: date groups, daily and overall required totals, desktop table, 390px cards, add/edit/cancel Sheets, duplicate confirmation, outside-hours warning, loading/errors and revision history. The UI says `Allocation not connected`, never `0/N filled` or `vacancies`.

## Migrations and objects

Applied in source order to Dev only:

1. `20260923233000_event_staffing_requirements_06b.sql` — catalogue, requirement, revision, guards, RLS, audit integration, exact read/write RPCs and Event date protection.
2. `20260923234500_staffing_exception_confirmation_06b.sql` — explicit exceptional-demand confirmation wrappers and revoke of direct helper execution.
3. `20260923235500_staffing_guard_dispatch_06b.sql` — forward correction for table-specific trigger field dispatch, found by the first direct test before a line was committed.
4. `20260924000500_staffing_existing_duplicate_edit_06b.sql` — allow a quantity edit on an already intentionally duplicated line without a fresh duplicate confirmation when match-defining fields remain unchanged.
5. `20260924003000_staffing_fk_indexes_06b.sql` — four foreign-key indexes flagged by the Dev performance advisor.

Readback confirmed all three new tables have RLS enabled and no authenticated direct SELECT/INSERT/UPDATE grants. The eight role definitions exist. Security advisor's `RLS enabled no policy` notice reflects deliberate RPC-only tables; new-index `unused` notices are expected immediately after creation.

Security review: the new read/write RPCs check active Office/Super/Operations authority inside the database; public helpers are not callable by authenticated clients; direct table grants remain absent; exact Event and requirement IDs are checked before history/amend/cancel; and ordinary users cannot write typed history or audit. The first trigger-dispatch test revealed a table-field error, fixed by the forward migration before fixture creation. No remaining 06B access defect was found in the focused direct-call and existing regression checks.

## Synthetic proof

- One Northshore multi-day Festival Event contains Friday/Saturday/Sunday requirement lines under the same Event; 10 current lines require 108 positions. One Search line was amended then cancelled and is excluded from current demand while remaining in typed history.
- A separate 15:00 football-style fixture contains Stand Manager, Stand Supervisor, two Turnstile SIA, South/North Stand Stewards and a Response requirement. Reporting at 12:30 and shift 13:00–18:00 are valid around the Event window. Current total is 27 after an Operations user added the Response line through the browser.
- Focused tests cover cross-midnight, long-duty/early-report/high-quantity confirmation, same-role lines, duplicate warning, DST gap/overlap, stale revision conflict, cancellation, confirmed amendment reason, terminal Event rejection and Event date integrity.

## Checks and browser evidence

- `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (Webpack): passed.
- Focused `tests/staffing.test.mjs` and updated `tests/shell.test.mjs`: passed together (4 tests).
- Existing Phase 01–06A suites passed: access, Site journey, shell, Documents, document review, My Work, onboarding, Profile/SIA, controlled documents, Identity Evidence, onboarding queue, People directory, Staff Record, CRM, operational CRM, controlled-clock CRM due dates and Events. The first rapid run reached the known synthetic Supabase Auth rate limit at document review; that suite passed independently, then remaining suites passed with short spacing. A sandbox-only `fetch failed` and loopback `EPERM` were resolved by running the approved Dev regression and smoke checks with network/loopback permission; they were not product failures. `npm run smoke` then passed.
- Office desktop Festival and 390px mobile Event journeys checked through authenticated local production server. Mobile viewport/document scroll width: 390/390.
- Operations 390px fixture journey checked; Operations added an exact Response line through the UI. No CRM navigation was exposed. Mobile viewport/document scroll width: 390/390.
- The final build's accessible Staffing Sheet was rechecked in the authenticated Office browser: focus lands on the operational-role selector; Escape closes the Sheet.
- Screenshots: `output/playwright/staffing-06b/office-festival-desktop.png`, `office-festival-mobile.png`, `operations-fixture-mobile.png`.
- Source audit found no green/emerald/lime/mint/teal classes in changed staffing UI. Existing blue/graphite/neutral and amber/red tokens are reused. A scoped source scan found no embedded secret values; only environment-variable references to synthetic test credentials. `git diff --check` passed. The unrelated pre-existing synthetic staging PDFs were excluded from this task and commit.

## Remaining boundary

No Staff deployment, qualification determination, SIA licence conclusion, availability/clash check, task, pay/charge rate or timesheet. 06C should attach actual `people.id` allocations to the stable `event_staffing_requirements.id`, with separate guarded eligibility, availability, clash and allocation-state rules. Existing staffing revisions must remain historical when demand changes. Staging remains separate and unchanged; real personnel, live policy and training integration gates remain open.
