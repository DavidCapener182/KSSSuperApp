# TASK-UI03 Workforce Planning Grid — synthetic prototype review pack

**Status:** Prototype ready for David's design review, 25 September 2026. **Production UI03 implementation is not authorised.** This is a standalone local HTML/CSS/JavaScript artifact at [prototypes/ui03-workforce-planning-grid/index.html](prototypes/ui03-workforce-planning-grid/index.html). Open that file in a browser and use **Scenario guide** to step through the ten cases. It has synthetic fixture data only, no KSS account, no Supabase connection, no source writes and no product-route integration.

## What the prototype tests

- Office/Operations doorway: seven-day coverage matrix at desktop, separate Day planner, and selected-duty contextual panel. The hierarchy is Client → Site → Event or Site Service → role/area duty. Event and Site Shift names and synthetic source identities stay distinct.
- At 390px: week strip → selected day → grouped duty agenda → full-height duty panel. The seven-column matrix is not rendered at this width.
- Factual summary: **Required 24, Allocated 17, Awaiting 6, Accepted 11, Open 7** in the unfiltered fixture. Open and Awaiting are clickable attention filters; no readiness percentage or score is calculated.
- Primary Client, Site, Event/Site Service, role/area and source filters; one attention selector for open, pending response, availability, approved Time Away and Event/static clash. Staff name search opens a synthetic preview of the existing authorised Staff schedule concept. No Owner or arbitrary free-text filter was added.
- Vacancy selection opens exact duty context, then a candidate **visual fixture**. The candidate control makes no allocation. Source-workflow links show route shapes only. Pending, simulated server acceptance, simulated guarded readback, confirmation and rejection are explicitly labelled as simulations and never change the fixture's counts.

## Ten scenario walkthroughs

These were automated browser interaction checks of the prototype, not observed Office user tests or PARiM task-time measurements.

| # | Scenario | Browser observation |
|---:|---|---|
| 1 | Saturday Event vacancy | Stadium Entry Steward panel showed 3 required, 2 allocated, 1 accepted and 1 open. Review candidates opened a safe visual candidate list. Simulated accepted flow showed pending, then readback, then confirmation; no confirmation during either earlier stage. |
| 2 | Declined response | Community Expo Patrol showed an open position and a separate retained-decline history note; the declined Person was absent from active coverage. |
| 3 | Approved Time Away | Lantern Festival Gate Steward showed the named accepted allocation and a distinct safe approved Time Away conflict, without a leave reason. |
| 4 | Static Site duty | West Gate Security Officer showed `SITE_SHIFT` and a distinct synthetic Service/demand identity. |
| 5 | Event/static clash | West Gate allocation displayed a cross-source clash warning; the Event counterpart remained a separate source. No cancellation or reassignment occurred. |
| 6 | Awaiting versus Accepted | Stadium Stand Security showed Jane as Accepted and Owen as Awaiting response. The panel explicitly said acceptance is not attendance or worked time. |
| 7 | Stale action/rejection | Simulated rejection showed pending then error. The coverage counts stayed unchanged and no success confirmation appeared. This is a visual simulation, not a live guarded rejection test. |
| 8 | 390px journey | Scenario opened a full-width duty panel from the day agenda. The document and scroll width were both 390px; the matrix was absent. |
| 9 | High-volume Saturday | Fixture contained 3 Clients, 5 Sites and 10 Saturday duty lines across Events and ongoing Site Services. At 1280px, the matrix had one hierarchy column and all seven day columns; document and scroll width were both 1280px. A wider 1600px capture was also taken. |
| 10 | Overnight duty | Friday Night Watch showed `Fri 18:00–Sat 06:00` once on Friday, with the next-day finish repeated in the panel. |

Additional interactions checked: clickable Open summary filter; Day view switch; Staff context name search and selection; modal Tab containment, Escape close and return focus to the originating duty. The browser recorded no JavaScript page errors. Requests went only to the temporary local prototype server (`127.0.0.1:4077`) for the HTML, CSS and JavaScript; the standalone file was separately opened via `file://` and rendered 13 duty rows without a server.

## Captures

- [High-volume Saturday at 1280px](../../output/playwright/ui03-prototype/09-saturday-1280.png)
- [High-volume Saturday at 1600px](../../output/playwright/ui03-prototype/09-saturday-1600.png)
- [390px day agenda](../../output/playwright/ui03-prototype/08-mobile-agenda-390.png)
- [390px duty panel](../../output/playwright/ui03-prototype/08-mobile-panel-390.png)
- [Contextual panel and simulated accepted feedback at 1280px](../../output/playwright/ui03-prototype/01-panel-1280.png)
- [Overnight duty at 1600px](../../output/playwright/ui03-prototype/10-overnight-1600.png)

## Decisions still needed before implementation

1. David reviews the prototype in the browser and tests whether the 1280px density is readable during the Saturday case. Seven days remain visible; if actual use exposes a problem, test fixed hierarchy plus an internally scrollable schedule canvas while keeping no horizontal **page** overflow.
2. Confirm that the source workflow handoff feels natural and that the vacancy/pending/accepted wording is clear to an Office planner. The prototype's candidate list is illustrative, not an eligibility or ranking contract.
3. Determine whether the approved first-version filters can be backed by the existing guarded `/workforce` read and exact source endpoints. Any missing source, area or attention predicate needs a separate bounded read-contract decision. Summary, filter options, rows and pagination must share the same authorised population.
4. Use an authorised PARiM demo or synthetic account, if available, to compare equivalent scheduler tasks. This pack uses current public PARiM/Deputy/Planday/Connecteam documentation; **no hands-on competitor account was accessed** and no KSS data was shared with a competitor.
5. Run observed Office/Operations user walkthroughs to measure elapsed time, clicks, backtracks and misunderstandings. Automated playback confirms interaction mechanics and layout, not human task efficiency or acceptance.

**Stop gate:** Review this prototype and evidence with David. Do not turn its fixture data, simulated feedback, source links or client-side filter logic into production authority. No drag/drop, bulk mutation, inline demand/shift edits, candidate ranking, automatic fill, AI scheduling, Supabase migration or backend contract change was made.
