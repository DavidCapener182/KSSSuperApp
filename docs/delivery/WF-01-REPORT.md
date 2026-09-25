# WF-01 — Workforce Scheduling Experience

**Status:** implemented in isolated local branch `wf-01-scheduling-experience` from frozen application source `4d38aa4cf4457fa90743e0bfc969520d3655b6b5`; pending David's review and authenticated visual acceptance. Date: 25 September 2026. The shared dirty checkout, frozen Candidate 1, synthetic database, migrations, grants, fixtures, staging and production were not changed.

## Delivered scope

- **P1A manager coverage/source journey:** Workforce keeps the selected week, day, Client/Site/Event/role/open filters and exact Event or Site duty ID in an allowlisted return URL. The source page receives the exact focus and displays a return link. Event staffing and Site Service actions remain on their existing guarded APIs/RPCs. Site Service opens the selected week so a future dated shift can be focused. Returning re-reads authoritative Workforce counts and reselects the duty if still in the authorised result; a missing or filtered-out duty is reported instead of showing stale counts. Event staffing and deployment actions no longer present success when a follow-up source read fails.
- **P1B manager Person calendar v1:** existing `workforce_person_week_08a` allocations are grouped into a seven-day desktop week and one-day-per-row mobile agenda. Each duty retains Event/Site identity, response, time, availability warning, approved Time Away conflict flag and source link. The client reads all bounded pages consistently (up to 300 entries) before claiming an empty day. An empty day states “No active allocation. This does not mean available.” No full leave interval or private note is read.
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

The first build without local Supabase environment failed while prerendering the unrelated `/staging-access` route; rerunning with the existing synthetic environment passed. No secret values were printed or committed.

## Evidence limit and review needed

The browser opened the local build and showed the sign-in page. It had no synthetic authenticated session; no credentials were copied into browser automation or logs. Therefore a desktop/390px authenticated screenshot and click-through of the exact duty return journey **were not completed**. The old synthetic `tests/workforce.test.mjs` creates records in the shared Dev project, so it was not run under this no-database-change scope. The read-only route check proves access boundaries but does not prove visual layout or a successful source mutation. Before accepting WF-01, use an authorised synthetic browser session to check Event and Site focus/return after a guarded source action at desktop and 390px, Person day agenda and Staff offer/return flow. Do not infer production readiness from the build.
