# My Work deadline calendar

Date: 16 October 2026. Baseline: `184795739c4b66a43c6727072e684aecb94de4b3`.
Independent checkout: `/tmp/kss-work-calendar-20261016`. Original dirty checkout and earlier frozen artifacts were preserved.
Scope approved by parent/coordinator from [Dashboard & My Work](https://trello.com/c/hNHU0Uqf) and the existing task/deadline contract. The broader page-system and workflow cards remain incomplete.

## Delivered behavior

List stays the default. The new Deadline calendar view uses the same source/status/search-filtered, server-returned tasks. View switching, month navigation, day selection and filters make no additional requests and do not persist metadata or navigation in storage, cookies or URLs. The existing TaskCard, exact task/TFS source links, list/history/covering groups and TFS priority functions are unchanged.

The month calendar uses Monday-first Europe/London civil dates, previous/next month and Today controls. Day buttons expose full date and Open/Covering/Done/Cancelled counts. A selected day has an agenda ordered by actual deadline instant, then stable task ID. Arrow keys move focus and selection by one day or seven days, including across month/year boundaries. There is no separate week view. Today updates from the London date and remains independently marked while browsing another date.

Only existing CRM Opportunity/Organisation `dueAt` timestamps create dated entries. The parser requires a full offset-bearing ISO timestamp and validates civil fields before Date parsing, rejecting impossible dates, missing offsets, invalid times and offset ranges rather than silently normalising them. Agenda due times include GMT/BST and Europe/London, preserving the two distinct repeated-hour instants at the autumn DST change.

Done and Cancelled dates remain factual history: month/day counts identify those states separately and agenda headings say Historical due date. Covering stays distinct from assigned Open work. Counts describe returned tasks rather than complete organisational workload. Calendar dates do not represent shifts; My Schedule remains their source.

Document/TFS work stays in Undated work, as do absent/invalid CRM deadlines. No date is inferred from creation time, priority, title or source metadata. An unusable CRM deadline is passed as null to the unchanged card renderer in this view, so its generic Date label cannot invent a normalised deadline. IDs, links and source task objects remain unchanged. Undated work remains available in every browsed month, subject to the same filters.

No matching results, initial loading, unavailable source and empty day/month/undated states are explicit. A source failure shows no calendar or stale facts. No task editing, rescheduling, completion, drag/drop, export, notifications or task kinds were added.

## Source and test scope

Product files: existing `src/components/work-client.tsx` (type export and view integration only), new `src/components/work-calendar.tsx`, new `src/components/work-calendar.module.css`, new pure `src/lib/tasks/calendar.ts`.

New tests: `tests/work-calendar-local.test.mjs`, `tests/work-calendar-browser.spec.mjs`. Coordinator additionally approved exactly three dependency paths added to the existing `tests/work-filters-browser.spec.mjs` fixture-copy list: Calendar TSX, CSS and helper. Its assertions and synthetic boundaries are unchanged. Existing Work filter CSS, task API/policy/TFS resolver, authentication/capabilities, global CSS, packages and migrations remain unchanged.

## Verification

- Focused local suite: **33/33 pass**. New Calendar 7, existing Work filters 4, CRM due 2 and TFS assignment/source 20. Covers strict timestamp rejection, leap day, month/year bounds, Monday grids, day/week moves, UK DST, host-independent London dates, deterministic ordering, no row loss/duplication, no metadata-derived dates, historical/covering counts, filtered integration and loading/error behavior.
- Browser suite: **8/8 Node test results pass** (three Calendar journeys plus parent; three existing filter-regression journeys plus parent). Real Chromium uses byte-identical product component/CSS/helper copies and synthetic `/api/tasks` projections. Tests cover keyboard/month/year/Today/day agenda, exact Document/CRM/TFS navigation, filters and clearing, undated and historical/covering access, empty/error/loading, no filter/navigation requests or persistence, and invalid date suppression. Calendar cases run with an America/Los_Angeles browser timezone while asserting London dates/times.
- Calendar: **13 layout captures**, plus **9 existing filter-regression captures**; every `scrollWidth` equals its 390px/1280px viewport and no controls extend off-screen. Source-manifest hashes match final product files. Mobile month/agenda and desktop DST captures were visually inspected.
- Full production Webpack build: **pass, 76 pages**. The first clean-checkout build stopped at an existing sign-in page because no Supabase URL/key was configured. Final build used only `NEXT_PUBLIC_SUPABASE_URL=https://synthetic-build.invalid`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-local-build-only` and disabled telemetry. These are compile-only placeholders, not credentials or a hosted connection.
- Serial `npx tsc --noEmit`: **pass** after build. Full ESLint: **0 errors**, one existing unused `officeId` warning in `tests/site-horizon-maintenance.test.mjs`. Existing built localhost smoke: **1/1 pass**. Final diff check passes.
- The first Calendar browser failure was an assertion missing the Intl weekday comma. Visual inspection then found the unchanged generic card could normalise an invalid deadline in Undated work; the Calendar render now suppresses that unusable value, and a specific browser assertion verifies it. Final captures also use singular task wording where appropriate.

Evidence is under `output/work-calendar-20261016/`: logs, layout results, source manifest and PNGs. Existing filter-regression results were copied under its `filter-regression/` subdirectory, then the tracked previous evidence directory was restored to the baseline. That old fixture retains its original historical baseline label; its captured source hashes match this candidate.

## Limits and handoff

These are local projection/component and build checks. The fixtures have no authentication and do not establish live task/source authorization, database/RLS behavior, role acceptance or human acceptance. Hosted `tests/work.test.mjs` and mutation-dependent CRM/document suites were not run: existing test-persona credentials were reported failing, and no authentication attempt, reset or workaround was made. Source authority code did not change.

No remote database, migration, permission, credential or Trello change was made. No push, merge or deployment was performed. The coordinator owns independent review/integration and any publication; parent owns the existing card update. This lane provides an immutable local commit/patch, not a claim of production acceptance.
