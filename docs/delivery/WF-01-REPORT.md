# WF-01 — Workforce Scheduling Experience

**Status:** implemented in isolated local branch `wf-01-scheduling-experience` from frozen application source `4d38aa4cf4457fa90743e0bfc969520d3655b6b5`; pending David's review and authenticated visual acceptance. Date: 25 September 2026. The shared dirty checkout, frozen Candidate 1, synthetic database, migrations, grants, fixtures, staging and production were not changed.

## Visual correction after David's review

### In-place scheduling correction after app review

David's app screenshot exposed two further gaps. First, 275 open positions generated a very tall unassigned lane and pushed Staff rows out of view. The lane now has a visible per-day duty/position count and an independently scrollable height; Staff rows remain reachable without traversing every open card. A read-only inventory of eight nearby synthetic Development weeks found zero active allocations in every week checked, so switching weeks cannot produce the populated rota scene. The local-only `KSS_ENABLE_LOCAL_SYNTHETIC_PREVIEW=1` flag now offers **Review populated example** inside the actual Schedule component. It uses the same grid and duty panel with 12 visibly synthetic Staff, 17 assignments and eight open positions, but disables all source writes and labels the view as an example. This is not a fixture write or an authenticated proof of live scheduling.

Second, clicking a duty previously required a different page to assign Staff or alter times. The duty panel now reads its exact Event requirement or Site demand and revision, searches candidates through the existing guarded source route, requires warning acknowledgement and reason where the source assessment requires it, and calls the existing source allocation endpoint. It also offers reasoned allocation cancellation and a London-local time form that calls the source's Event amendment or Site `CHANGE_TIME` action. No generic Workforce write API was added. The source rules reject time changes with active allocations; the panel explains that reconciliation and supports explicit cancellation before editing. Successful actions require an exact source readback and a refreshed Workforce week/Staff read. A failed readback gives an error rather than optimistic success. These action controls have passed static build checks but **have not been exercised as authenticated writes** against the shared synthetic Development data; no fixture write was authorised for this lane.

David rejected the demand-first screen as the primary rota. The revised `/workforce` now defaults to **Schedule**: an unassigned/open-demand lane above multiple authorised Staff rows across Monday–Sunday. Each assignment block names Site, time, role/area, source and Accepted or Awaiting response. An empty Staff cell states only that there is no active allocation in the current read. The prior demand matrix remains under **Coverage**; the grouped day planner remains under **Day**. At narrow widths, Schedule becomes a selected-day agenda. Staff search uses the guarded Staff choices read and pages 20 people at a time; each visible Person week is read completely before being shown. The complete guarded Workforce week still supplies demand and the exact source duty. Shift/open-demand selection opens the same duty panel, with a selected allocation highlighted where present. Source return now carries Schedule/Coverage/Day state as well as week, filters and duty.

The current Development week has inadequate allocations for a meaningful rota review. No fixture or database write was authorised for this lane. A clearly labelled [static synthetic scheduling scene](../ui/prototypes/wf01-visual-correction/index.html) was created with 12 Staff, Event and Site shifts, open demand, multiple-day and overnight work, response states, warning examples and click/focus interactions. Its records and counts are illustrative only; they do not prove authenticated app behaviour or source acceptance. Browser security policy rejected opening the local `file:` prototype in the in-app browser and prohibited alternate browser workarounds, so no screenshot or visual acceptance is claimed for this correction.

The existing guarded week endpoint supports Client, Site, Event, role and open-position predicates. Staff search uses the separate guarded choices endpoint. Exact Site Service, source, area, awaiting-response and distinct issue/status filters lack matching server predicates and have not been fabricated over a partial result. The Schedule pages 20 authorised Staff at a time; the open lane covers the complete authorised, filtered week, while each visible Person row has a complete bounded Person-week read. This is a scale and filter distinction to review before acceptance.

### Benchmark mapping

| Researched interaction | KSS correction | Deliberate difference / still missing |
|---|---|---|
| PARiM Smart Schedule: people by time, open shifts above assignments | Schedule defaults to Staff rows by day with a separate open-demand lane | Open demand is unfilled source capacity, not Staff-published work; no drag assignment or open-work application. |
| Deputy Schedule: Person and area context, visible warnings | Staff search focuses multiple authorised rows; source-safe warnings stay on allocations and duty panel | Empty cells do not claim availability; full approved-leave intervals need a separate read contract. |
| Planday Positions and open shifts | Coverage remains a role/demand view; Schedule shows open positions above people | Position capacity is distinct from an application or accepted allocation. |
| Connecteam Job Schedule: assigned work and issue indicators | Named shift blocks show response and safe warning presence | No generic eligibility score, automatic resolution or broader private records. |

## Delivered scope

- **P1A manager scheduling/source journey:** Workforce keeps the selected week, day, Client/Site/Event/role/open filters and exact Event or Site duty ID in an allowlisted return URL. The source page receives the exact focus and displays a return link. Candidate search, assignment, reasoned cancellation and eligible duty-time amendment can now start and complete in the Workforce duty panel through those same guarded source APIs/RPCs. The full source record/history link remains. Site Service opens the selected week so a future dated shift can be focused. Returning or completing an inline action re-reads authoritative Workforce counts and reselects the duty if still in the authorised result; a missing or filtered-out duty is reported instead of showing stale counts. Event staffing and deployment actions no longer present success when a follow-up source read fails.
- **P1B manager Person calendar v1, revised:** existing `workforce_person_week_08a` allocations now form multiple Staff rows in the default seven-day Schedule and selected-day mobile agenda. Staff search narrows the authorised choices rather than requiring a Person before any rota appears. Each visible Person's bounded pages are read consistently (up to 300 entries) before rendering. Empty cells mean no active allocation in the current read, never availability. No full leave interval or private note is read.
- **P1C Staff offered-work entry:** My Schedule's allocated duty now says “Review offer” and deep-links to the exact own deployment with source and return week. My Deployments keeps the existing guarded accept/decline action, verifies the resulting source status on readback, and offers a return to the same My Schedule week, which fetches fresh data.
- **Manager week screen follow-up after David's preview:** duty cells now show legible shift times, required/open capacity, named active allocations with separate Accepted and Awaiting response labels, and a warning count. The Open positions summary applies the existing guarded `gaps=true` filter. A narrow desktop viewport scrolls the seven-day canvas within its frame; the 390px day agenda remains the mobile view. This is a UI/read interaction change, not a new assignment or publication contract. Authenticated visual acceptance of this revision remains outstanding.

No WF-02 publication/application contract, WF-03 leave block, WF-04 Site worked time, payable time, rates, payroll or payslip feature was added. “Open positions” in manager Workforce remains unfilled demand, not Staff-advertised work. Candidate warnings remain warnings, not legal or deployment eligibility.

## Checks performed

| Check | Result |
|---|---|
| Relevant Next.js 16.3.6 `node_modules/next/dist/docs` for async `searchParams` and Link navigation | Read before edits |
| Focused ESLint over changed TS/JS | Passed |
| `next typegen` and `tsc --noEmit` | Passed |
| `npm run build` with existing synthetic local environment | Passed (67 static pages; all dynamic routes compiled) |
| `git diff --check` | Passed |
| Follow-up week screen: focused ESLint, `tsc --noEmit`, production build, diff check | Passed after duty-card and summary changes; authenticated visual check remains open |
| `scripts/wf01-readonly-check.mjs` against local production server, using synthetic Office and Staff sessions | Passed: Office `/workforce` and `/api/workforce` 200, Staff 404/403; Staff `/my-schedule` and `/api/my-schedule` 200, Office 404/403. Only GET requests; no test fixture writes. |
| Revised Schedule build and guarded Staff route | Focused ESLint, TypeScript, production build and diff check passed. Local synthetic read-only route check: Office `/api/workforce/staff` 200; Staff 403. |
| Authenticated local browser, 25 September 2026 | Office session opened `/workforce?week=2026-09-21` on port 3118. A Site Shift card opened an in-page drawer at the same URL. Its exact source read returned candidate search, warning review, allocation control, and prefilled London time fields. The local sample toggle rendered 12 Staff, 17 active example allocations and eight open positions in the actual app. No action was submitted. |

The first build without local Supabase environment failed while prerendering the unrelated `/staging-access` route; rerunning with the existing synthetic environment passed. No secret values were printed or committed.

## Evidence limit and review needed

The authenticated local Office browser check confirms the in-page Site Shift controls and populated example, but no allocation, cancellation or time change was submitted to the shared Development database. The old synthetic `tests/workforce.test.mjs` creates records there, so it was not run under this no-database-change scope. Event inline controls, a 390px layout and post-write source readback remain unverified in the browser. Before accepting WF-01, verify those paths with an authorised synthetic test record. Do not infer production readiness from the build.
