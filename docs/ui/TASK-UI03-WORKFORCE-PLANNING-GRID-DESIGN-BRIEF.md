# TASK-UI03 — Office/Operations Workforce Planning Grid: design and interaction brief

**Status:** **ACCEPTED — SYNTHETIC DEVELOPMENT** by David on 25 September 2026 for the bounded UI03 implementation. The design proposal and prototype below are retained as decision history; the accepted implementation and its actual evidence are in [the UI03 close-out report](../delivery/TASK-UI03-WORKFORCE-PLANNING-GRID-REPORT.md). Acceptance does not authorise deployment, live KSS data, business writes, a Supabase migration or a broader Workforce read contract. TASK-19A and TASK-20E remain separate backend close-outs.

**Prototype evidence:** [Open the standalone synthetic prototype](prototypes/ui03-workforce-planning-grid/index.html) and [read the ten-scenario review pack](TASK-UI03-WORKFORCE-PLANNING-GRID-PROTOTYPE-REPORT.md). These supported the approved direction; the report distinguishes prototype results from real authenticated UI03 checks.

## Decision to make

Design a manager workspace in which Office and Operations can see **where coverage is needed, who is assigned, who has accepted, and which source action to take next** across Event and ongoing Site Shift work. Preserve the existing `/workforce` guarded week projection and exact Event/Site Service workflows as the starting point. This is an interaction design for review, not authority to add a new combined data contract, candidate rule, bulk mutation, or scheduling engine.

The first proposed version uses a **week coverage matrix**, a focused **day planner**, and a **contextual staffing panel**. Selecting a vacancy or allocation opens its exact source context and existing guarded action. No drag-and-drop or bulk assignment in the first version. This recommendation should be tested with synthetic scenarios and reviewed by David before code.

## Evidence and benchmark

The [UI01 competitive research](TASK-UI01-COMPETITIVE-RESEARCH.md), [journey audit](TASK-UI01-JOURNEY-AUDIT.md), [route inventory](TASK-UI01-PRODUCT-INVENTORY.md), [07B Workforce design](../delivery/TASK-07B.md) and [Staff pilot report](../delivery/TASK-UI02-UI03-STAFF-SHIFT-PILOT-REPORT.md) establish the local baseline. Today's `/workforce` already reads Event and static Site Shift lines, shows required/allocated/remaining/accepted totals, filters, safe conflict summaries, a Staff schedule view, and exact source links. Its current week is a vertical list, so the new hypothesis is whether a denser spatial view reduces finding and filling gaps without hiding state.

| Benchmark | Verified public pattern | Proposed KSS lesson |
|---|---|---|
| [PARiM Smart Schedule](https://support.parim.co/en/articles/1745663-smart-schedule-overview), [shift statuses](https://support.parim.co/en/articles/70454-shift-statuses) | Event/status filters, timeline, open shifts, pending versus confirmed shifts, conflict indicators and a selection mode. PARiM also supports drag assignment. | Benchmark the ease of finding an uncovered role and an assigned Person. Preserve KSS's distinct demand, allocation and Staff acceptance labels; defer selection mode and drag until their validation and accessibility are proven. |
| [PARiM Event scheduling](https://www.parim.co/features/employee-shift-scheduling-software-for-workforce-management) | Event calendar and position coverage for large events. | Keep Event identity visible inside a cross-source week, with role/area coverage on each actual duty date. |
| [Deputy schedule overview](https://help.deputy.com/hc/en-au/articles/4688713423759-Schedule-overview), [filtering](https://help.deputy.com/hc/en-au/articles/4688801660175-Schedule-filtering-and-management), [leave display](https://help.deputy.com/hc/en-au/articles/4658289483023-Manager-s-awareness-of-leave) | Area and Person views, visible open shifts/warnings, useful filters, and separately displayed approved leave versus unavailability. | Offer both coverage and Person context; keep leave and availability distinct and label filtered totals. |
| [Planday Positions view](https://help.planday.com/en/articles/30411-scheduling-with-positions-and-sections), [open shifts](https://help.planday.com/en/articles/30399-open-shifts-shift-requests-and-shift-swaps-for-schedule-managers) | Role/position grouping and explicit open shifts. | Make a role/duty row the actionable unit and show remaining positions even when some Staff are already allocated. |
| [Connecteam schedule issues](https://help.connecteam.com/en/articles/9745134-job-schedule-issues), [time off versus unavailability](https://help.connecteam.com/en/articles/7323816-differences-between-time-off-and-unavailability) | Cross-schedule issue flags and separately named absence/unavailability. | Show Event/static clashes as an explanation attached to an affected allocation, not as an inferred cancellation or generic red badge. |

These are vendor documentation and product claims, not hands-on comparative timings. A PARiM demo or authorised synthetic account should be used for the final interaction benchmark; no KSS personnel or operational data should be uploaded to competitor systems.

## Proposed information model on screen

The planner is a **view of source facts**, not a second rota. Each visible duty carries a source label and stable source identity. Counting and language follow the existing Workforce contract:

| Label | Meaning in this view | Interaction consequence |
|---|---|---|
| Required | Positions on a planned Event requirement or static Site Shift demand line. | Opens the exact demand source; never creates a placeholder Person. |
| Allocated | Active `ALLOCATED` plus `ACCEPTED` assignment count. | Does not imply Staff has agreed. |
| Awaiting response | Named `ALLOCATED` assignment. | Show Person and pending state; do not call it confirmed. |
| Accepted | Named `ACCEPTED` assignment. | Still not attendance or approved worked time. |
| Remaining / open positions | Required minus active allocated count. | Display the number, not one fabricated shift card per vacancy. Declined/cancelled responses free capacity but remain in source history. |
| Availability warning | Explicit Unavailable, partial/no current declaration, or coverage changed, each with its own wording. | Inform candidate review; do not mutate assignment. |
| Approved Time Away conflict | Approved absence overlapping an existing or proposed duty, exposed only as a safe operational status. | Keep separate from availability; no leave category, notes or private evidence in the planner. |
| Event/static clash | One Person's actual duty intervals conflict across sources. | Show both exact source links and the current guarded resolution path; never silently reassign. |

Use `Europe/London` day boundaries and the line's authoritative service/report date. A cross-midnight duty appears once, with next-day finish explicit. A multi-day Event keeps one Event identity but appears on each day with its actual requirements. A static Site Shift remains labelled as ongoing Site work, not an Event.

## Layout and interaction proposal

### Desktop week: coverage matrix

1. Persistent header: week date, Previous/Today/Next, Week/Day switch, selected filters, “as of”/refresh state, and a clickable coverage summary: `Required · Allocated · Awaiting response · Accepted · Open`. The numbers are independent factual counts for the authorised filtered view; Open filters to remaining positions and Awaiting filters to pending responses. Never treat a partial page as whole-week coverage or calculate a readiness percentage, score or traffic-light verdict.
2. Left hierarchy: **Client → Site → Event or Site Service → role/area duty**. Distinguish Event and ongoing Site Shift with text and icon, not colour alone. Collapse at Client/Site/source levels; remember expansion locally only, without changing records.
3. Seven Monday–Sunday columns: a duty cell shows `required / remaining`, shift/report time, and compact named Staff blocks with explicit `Awaiting response` or `Accepted`. Show up to two Staff blocks in a collapsed cell, then “+N assignments”; expansion or the panel reveals every authorised assignment. An empty date cell means no demand on that day, not an unfilled duty.
4. Selecting a cell, vacancy count or Staff block opens the contextual panel without changing data. A fixed selected state, keyboard focus and exact day/source/role heading make the target clear. The week remains visible behind the panel so planners keep their place.
5. An attention strip can filter to gaps, pending responses, explicit conflicts or approved-leave conflicts. These are independent counts; there is no composite “ready” score or green completion verdict.

The matrix is for scanning coverage across days. **At 1280px and wider, all seven Monday–Sunday columns are the default** because weekend work is central to KSS. Collapse content inside a busy cell before hiding a day. If a high-volume Saturday makes the seven-column layout fail at 1280px, prototype a fixed hierarchy with an internally scrollable schedule canvas; never introduce horizontal **page** overflow. A five-day default is not approved.

### Day view: operational detail

The selected day shows the same Client → Site → Event/Service hierarchy as full-width duty rows. Each row exposes report/start/end times, `required / allocated / accepted / remaining`, all named active Staff blocks, and separate warning chips. Group changes and filters retain the selected date. A Person search can switch to the existing guarded Staff schedule view; it must not turn the planner into a raw personnel search.

### Contextual staffing panel

The panel header states source, Client/Site, Event or Service, duty date and times, role/area, exact source link and current requirement revision if available. It then separates:

- **Coverage:** required, active allocations, accepted and remaining positions.
- **Assignments:** named active allocations with `ALLOCATED` or `ACCEPTED`, safe availability/leave/clash indicators, and an exact link to the current source allocation workflow. Declined/cancelled history stays behind the source history link, not in current coverage.
- **Vacancy action:** “Review candidates” opens the existing guarded candidate workflow for the selected exact Event requirement or Site Shift demand. Candidate results retain existing safe status/reason wording. The panel does not invent ranking, eligibility or a new allocation endpoint.
- **Resolution:** a failed action leaves the previous authoritative state visible with a clear error. A successful existing action shows pending, waits for server acceptance and exact source readback, refreshes the affected week/day data, then shows confirmation. If readback fails, say that the action was sent but its current state is unconfirmed; never paint the assignment as accepted or resolved from client memory.

No requirement quantity, shift time, Person assignment, Staff response, availability or leave is edited directly in a matrix cell in version one. Filter changes, collapse/expand, date navigation and panel selection are safe inline UI actions. Source workflows retain their own permissions, confirmation, revisions, validation errors and audit history.

## Search, filters and scope

**First-version primary filters:** Client, Site, Event/Site Service, role/area and Source (`Event`, `Site Shift`, `Both`). **One attention control:** Open positions, Awaiting response, Availability issue, Approved Time Away conflict or Event/static clash. Selecting Open or Awaiting in the summary sets the matching attention filter. Person search enters the existing authorised Staff schedule context; it is not a broad People search. Defer Owner unless prototype evidence establishes its value. Defer arbitrary free-text search if it needs a new read contract. Saved filter views are desirable later, but outside UI03 v1. “Clear filters” restores the full authorised week and makes the count change explicit. Any filter absent from the current guarded projection remains a prototype interaction hypothesis until its separate source/read-contract review.

Office, Operations and Super Admin receive only records in their current server-authorised scope. Every week read, candidate read, exact source link and action must recheck authority. The planner must not expose raw CRM, Profile, private availability notes, Time Away reasons, credentials, certificates or document files. Link presence never extends access. Empty, denied and failed reads must be distinguishable without disclosing excluded records through counts.

## Mobile alternative at 390px

Use **week strip → selected day → grouped duty agenda → full-height duty panel**. The week strip shows each day and its factual gap count, then one selected day's Event and Site Shift cards. Each card shows source, Site/Event, role, times, `required / remaining`, and `ALLOCATED`/`ACCEPTED` blocks as text. Selecting it opens a full-height detail panel with one next action and source links. Filters live in a sheet; the active filter summary stays visible. **Do not render the matrix at 390px** or require horizontal page scrolling. Preserve a clear route back to the Staff view without mixing Staff self scheduling into the manager planner.

## Explicitly deferred choices

| Choice | Version-one recommendation | Decision required before adding |
|---|---|---|
| Drag-and-drop | Defer. Use select → contextual panel → existing guarded workflow. | Measured improvement over panel flow, keyboard/touch equivalent, source/revision revalidation, conflict handling, clear cancellation and no false success. |
| Bulk selection and actions | Defer all bulk mutations, including bulk assignment/cancel. Filtering and group expansion remain available. | Exact per-row authority, partial failure reporting, reason/audit rules, idempotency, rollback expectations and a separate product task. |
| Inline editing | Limit to view state (date, filters, expansion, panel). | Any demand/assignment write needs source-specific business and access review. |
| Candidate ranking or automatic fill | Defer. Show existing candidate check results only. | New decision policy, explanations, fairness review and separate approval. |
| Combined new server projection | Reuse `/workforce` and exact guarded source reads where correct. | Design proof of a specific information gap, explicit fields/scope, pagination and security review. |
| Saved filter views | Defer while testing whether the core filter model works. | Observed repeat use and a scoped persistence design; never share another manager's wider scope. |
| AI scheduling | Defer entirely. | Separate product, evidence, authority and audit decisions. |

## Scenario prototype and acceptance evidence before implementation

Create a **clickable, synthetic-only design prototype** or equivalent annotated interaction frames for David's review. Use the same scenario scripts in PARiM's authorised demo and in the KSS proposal where access permits. Record observation, not estimated time savings.

1. **Saturday Event vacancy:** find Client → Site → Event → role, read 3 required / 2 allocated / 1 remaining, open candidate panel, identify the exact guarded allocation path.
2. **Declined response:** distinguish retained declined history from current vacancy, replace via existing candidate workflow, and verify current counts do not include the declined Person.
3. **Approved Time Away:** show a safe absence conflict distinct from Unavailable or “not declared”; demonstrate that the planner does not expose leave details or silently remove an allocation.
4. **Static Site duty:** find an uncovered ongoing Site Shift beside Event work on the same day; preserve Service and demand identity in the panel.
5. **Event/static clash:** show the affected Person's two duty windows and two source links; make the corrective action a deliberate guarded workflow.
6. **Pending versus accepted:** show two named blocks with different response states and verify that accepted is not labelled attended or worked.
7. **Stale action and rejection:** change a synthetic source revision or trigger a guarded rejection; show pending/error, unchanged authoritative state and no success. Then prove server acceptance → exact readback → refreshed matrix/panel → confirmation.
8. **390px:** complete vacancy inspection and source navigation without overflow, clipped controls, unreadable status or a miniature rota.
9. **High-volume Saturday:** at least 3 Clients, 5 Sites, multiple Events, static duties, 8–10 role/duty lines, accepted and pending Staff, vacancies, one Event/static clash and one approved Time Away conflict. Test all seven days at 1280px before considering an internally scrollable canvas.
10. **Overnight security duty:** show a Friday 18:00 → Saturday 06:00 duty once on its authoritative Friday service/report date, with the Saturday finish unmistakable in both week and day/panel views.

For each scenario, record task completion, elapsed time, clicks/taps, backtracks, status interpretation mistakes, and any source-permission surprise. Include keyboard and screen-reader naming/focus checks, loading/empty/error states, and 1280px, wider desktop and genuine 390px captures. Compare PARiM on the same jobs where its authorised demo allows; note unavailable functions rather than guessing. Do not upload KSS data to any competitor. Deputy/Planday/Connecteam are pattern references, not KSS acceptance substitutes.

## David's decisions and remaining gate

David approved the week matrix, separate Day view, contextual panel and Client → Site → Event/Service → role/area hierarchy. The planner is the proposed primary Office/Operations doorway into staffing; Event staffing and Site Service demand remain reachable as authoritative source detail. He approved seven visible days at desktop, the 390px day agenda, the first-version filters above, the factual clickable coverage bar, and deferral of drag/drop, bulk mutation, ranking, automatic fill and inline editing.

**Close-out decision:** David accepted the bounded synthetic-Development planner on 25 September 2026. The established Office/Operations path is **Workforce → week coverage → day → duty panel → authoritative source workflow**. Desktop retains seven Monday–Sunday columns; genuine 390px uses week strip → selected-day agenda → full-height duty panel. The guarded Workforce read remains authoritative; the UI composes all pages, checks totals and completeness, and fails closed above 2,000 rows. Source workflows retain writes. The filters that need new exact server predicates remain withheld and are candidate scope for a separately reviewed **TASK-07C — Workforce Planner Read Contract**. No 07C implementation or deployment follows this acceptance.
