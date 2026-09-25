# TASK-UI03 Workforce Planning Grid — synthetic Development report

**Date:** 25 September 2026. **Status: ACCEPTED — SYNTHETIC DEVELOPMENT** by David on 25 September 2026. This closes the bounded UI03 implementation. Acceptance does not mean deployed or production ready. No database migration, new write API, scheduling rule, live data connection, or TASK-19A/20E change was made.

**Accepted manager path:** **Workforce → week coverage matrix → day planner → contextual duty panel → authoritative source workflow.** The matrix remains read-only; Event and Site Shift identities, allocations and response states stay distinct. Required, Allocated, Awaiting response, Accepted and Open are independent coverage facts. Accepted does not mean attended, worked or payable. Availability and approved Time Away remain separate. There is no readiness, compliance or staffing score.

## Delivered

`/workforce` now gives Office and Operations a seven-day Monday–Sunday matrix at 1280px and wider, a selectable day planner, and a contextual duty panel. Rows follow Client → Site → source Event/Site Shift → role/area. Cells show duty start, required, open, awaiting and accepted, with at most two named current allocations then `+N`. The panel shows exact source, client/site, Event or Site Service, date and London times, separate coverage facts, named current allocations, safe warning categories, and the exact guarded source link. Review candidates enters the existing Event or Site Service workflow. The matrix has no write controls.

At 390px the matrix is hidden. The page shows a seven-day strip, selected-day grouped agenda and full-height duty panel. Week/date selection remains when filters or view change. The Staff schedule tab remains available. Event and Site Shift source labels use text as well as colour. The UI uses blue, graphite and neutral tones; it has no inferred readiness, compliance, traffic-light or green success score.

The week RPC returns at most 40 rows per call. The planner reads all authorised pages for the chosen week, compares each page's `total_lines` and `totals` with the first, and withholds the matrix if the pages disagree or are incomplete. It stops with a clear error above 2,000 rows rather than displaying a partial week. Thus Saturday is not lost merely because it falls beyond page one. This is UI composition over the existing guarded read, not a second rota ledger. A source action is handled on its source page; returning focus to the planner triggers a fresh guarded read. The planner does not claim action success.

## Source-contract map and capability gate

| UI fact/capability | Accepted read | Classification / result |
| --- | --- | --- |
| Source identity, Client, Site, Event/Service, date, report/start/end, role/area, current allocation names and statuses | `/api/workforce` → `workforce_week_08a` rows | A — displayed directly; exact source IDs drive existing links. |
| Required, Allocated, Accepted, Open | Same guarded row and `totals` fields; Open is server `remaining` | A — independent factual values. |
| Awaiting response | Row `awaiting_response`; full-week summary `totals.allocated - totals.accepted` | A — arithmetic over the same active-allocation server aggregate; no response-state predicate is recreated for a row. |
| Client, Site, Event choices | Distinct IDs/names from the fully read authorised filtered rows | A — fixes a discovered mismatch where `workforce_filter_choices_08a` can omit an Event returned by the week read. |
| Role choice | `/api/workforce/choices` role ID/name; week RPC accepts `role` | A with a contract caveat: choice RPC's owner join can omit an otherwise visible role. See B gap below. |
| Open filter | Week RPC `gaps=true` | A — server predicate and totals. |
| Safe Availability, approved Time Away and allocation-clash warning fields in panel | Week RPC row and allocation fields | A — displayed as separate source facts; generic allocation clash is **not** relabelled as an Event/static clash. |
| Event/Site Shift/Both filter | No server source predicate | B — withheld; needs `source` predicate applied in scoped week read before totals and rows. |
| Site Service filter and area filter | No service/area predicate or complete ID choice contract | B — withheld; needs guarded service ID and area predicates and matching choices. Event and role filters are available separately. |
| Awaiting-only, Availability-issue, approved-Time-Away-conflict, Event/static-clash filters | No individual server predicates; current `conflicts` combines only some conditions, and `clashes` is not cross-source-specific | B — withheld; needs separate exact predicates before totals/page materialisation and a source-defined cross-source clash field. Do not filter only loaded rows. |
| Fully reliable role choices | Existing choice RPC joins owner Person, while week rows need not | B — read-only choice correction or row role ID is needed before claiming every authorised role is selectable. |
| Person search | Existing guarded Staff schedule context tab | A — retained as a name search within Workforce, without broadening People access. |

A minimal future read-only contract would add the missing predicates and matching filtered choice IDs to the existing guarded Workforce population, with totals and rows calculated from one identical scoped set. It must preserve Event and Site Shift identities and source authorization. This report is **not** approval to implement that contract or a Supabase migration.

## Authenticated synthetic Development checks

Office Admin and Operations were signed in separately through the real browser. On the week of 21 September, the guarded read returned **81 duty lines**, **161 Required**, **0 Allocated**, **0 Awaiting**, **0 Accepted**, **161 Open**: 80 Site Shift lines and one Event line. All 81 appeared in the composed matrix at 1280px, including 20 Saturday lines that were absent from the first 40-row response. A Site Shift duty panel showed the exact source, required 2, remaining 2, report/start/end and separate zero-state warnings. Its “Review candidates” link navigated to the exact Site Service URL with the demand ID. The week of 5 October returned 166 lines, including five Event lines; selecting a real Event filter produced a one-line Event-only result with Required 1 and Open 1. The open filter returned the same authoritative full-week totals when every current duty was open.

At 1280px and 1600px the matrix retained seven visible day columns and no horizontal page overflow. At 390px Office and Operations saw the day agenda, not the matrix; the document scroll width equalled the viewport width. A selected duty opened the full viewport-height panel. Keyboard focus had a visible 3px solid outline, Enter opened the panel, and Escape dismissed it. Visible mobile buttons, selects, date input and links met the 44px target; the 18px checkbox sits inside a 44px label target. The accessible duty button name includes source, context, role/area and exact open/awaiting counts. Loading, no-results, source-horizon warning, error/retry, and server-denied paths are represented; denied access remains enforced by the unchanged route/API guards.

Captures: `output/playwright/ui03-real/office-1280.png`, `office-390.png`, `operations-1600.png`, and `operations-390.png`. The source read was inspected through the authenticated browser. No client success state was mocked.

## Ten-scenario review against real source data

| Scenario | Real synthetic Development result |
| --- | --- |
| High-volume Saturday | **Observed:** 20 Saturday duty lines in 21 September week; full-page composition kept them visible. The prototype's specific 10-line/three-Client/five-Site fixture was not reproduced in the real source. |
| Overnight duty | **Observed:** 40 lines crossing a date in 21 September week; compact cells say “next day”, panel shows both full London datetimes. |
| Event vacancy | **Observed:** one Event line and open position in 21 September week; five Event lines in 5 October week, with a guarded Event filter. |
| Static vacancy | **Observed:** 80 Site Shift lines and open positions in 21 September week; exact Site Service source link opened. |
| Pending versus accepted | **Not re-observed in UI03 current weeks:** current allocations were zero. The accepted Staff pilot has a separate authenticated response proof, but it is not a UI03 matrix proof. |
| Declined history excluded from current coverage | **Not re-observed in UI03:** no suitable current synthetic allocation/history pair was used. The underlying accepted RPC excludes declined/cancelled from active coverage; this was not re-proved through this UI. |
| Approved Time Away conflict | **Not re-observed in UI03:** zero current conflict lines in inspected weeks. Panel reads its existing safe field without inference. |
| Availability issue | **Not re-observed in UI03:** zero current warning lines in inspected weeks. Distinct safe fields remain visible in the panel. |
| Event/static clash | **Not re-observed in UI03:** zero current clash lines; existing `clashes` is generic, so a cross-source-specific label/filter is withheld. |
| Guarded rejection and successful action/readback | **Not repeated from the planner:** UI03 has no write action. Exact links reach source workflows. The separately accepted Staff pilot proved pending → server → guarded readback → confirmation and rejection → error → unchanged state → no false success. Any later planner-triggered action must use that contract. |

No Office/Operations task timings were measured; observed friction was that the old 40-row page hid Saturday and the role/choice endpoint can omit visible demand. The first was corrected by guarded page composition. Hands-on PARiM comparison remains optional and was not performed. David explicitly accepted the bounded UI03 implementation with the listed evidence limitations; these scenarios are **not** recorded as UI03 passes. The separate accepted Staff Shift Pilot remains valid evidence for its own action-feedback contract.

## Candidate follow-on only: TASK-07C Workforce Planner Read Contract

This is a **future narrow read-contract proposal, not approved implementation**. Candidate scope: server predicates for Event/Site Shift/Both, exact Site Service, area where the source supports it, awaiting response, separate Availability issue, separate approved-Time-Away conflict and a genuinely source-defined Event/static clash; reliable role and matching filter choices. The guarded read must calculate **filter choices, rows, totals and pagination from the exact same authorised scoped population**. A generic allocation clash must not be renamed Event/static. Do not approximate these filters over loaded rows or broaden an RPC casually. TASK-07C requires separate authority and database/API review; no work starts automatically from UI03 acceptance.

## Verification and boundaries

`npx eslint src/components/workforce-client.tsx src/components/workforce-planner.tsx`, `npx tsc --noEmit`, and `npm run build` all passed. No new scheduling, candidate ranking, bulk, drag/drop, inline demand/shift, Availability, Time Away, attendance or worked-time mutation was added. No staging, production, real KSS data or deployment was used. Drag/drop, bulk mutation, inline scheduling writes, candidate ranking, automatic fill, AI scheduling, saved views and arbitrary free-text search remain deferred. **UI03 is closed after the UI03-only acceptance commit; TASK-07C and wider UI02 integration are separate decisions.**
