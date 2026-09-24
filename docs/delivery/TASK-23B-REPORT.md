# TASK-23B — Management Reporting Foundation delivery report

**Status:** Implemented in synthetic Dev on 24 September 2026; awaiting David's acceptance. Target project `dnfhkmmnlbiabqypclqg` was read back immediately before each migration. Protected Staging `kwpgjbxepxuhwxxydaca`, production and real KSS data were untouched.

## Delivered

- Added Office/Super-only **Management Reports → Overview** and a private, uncached API. Operations and Staff have no navigation or route access. The database RPC independently checks active Office/Super authority and limits Office to its source-authorised Sites.
- Kept **Operational demand during period** separate from **Current operational estate**. The latter is labelled current state at the displayed data-as-of time, independent of the selected period. Current reporting uses one guarded database statement for totals, breakdowns, filter options and a bounded line page.
- Added 12 controlled measure definitions, version 1, with source grain, state, unit, time, cancellation, correction, coverage, publication actor and timestamp. Published rows cannot be updated/deleted and have no direct authenticated table grant. No formula builder or export was added.
- Current Event requirements and materialised Site Shift demands retain typed IDs. Allocated counts `ALLOCATED` plus `ACCEPTED`; Accepted counts `ACCEPTED`; Remaining is clamped per source line before summing. Explicit unavailable and removed-coverage conflicts, missing declaration and partial coverage are separate counts. Payloads omit Person fields.
- Static source coverage uses 08D run/horizon status and compares expected forward published-template occurrences with persisted dated demand for the authorised scope. Missing or stale coverage is shown as **Incomplete source coverage**, independently of the demand total.
- Historical mode currently returns **Historical snapshot unavailable** for all version-1 measures. The accepted histories do not yet establish a complete, consistent cross-source point-in-time reconstruction, including corrections and lifecycle state. No current rows are presented as historical facts.
- Added bounded London-date presets and custom ranges up to 90 days, authorised Client/Site/Service/Event/source filters, factual breakdowns and paginated source lines. Source links go to existing routes, which reauthorise on open. The 390px layout uses stacked cards and collapsible filters.

## Verification actually obtained

| Check | Result |
| --- | --- |
| TASK-23B focused authenticated tests | 3 passed: combined/Event/static totals, paginated reconciliation, Office hidden-Site denial, Operations/Staff/anonymous RPC denial, direct-table denial, definition v1, historical-unavailable, Event allocation/acceptance/cancellation and retained source history, overnight autumn Site Shift source-date readback, spring date outside horizon. |
| Source regressions | 9 passed across Event, staffing, Availability time, Site Shift, Workforce and 08D maintenance tests. The source tests include London 23/25-hour DST handling and rejection of invalid local times. |
| Typecheck, lint, Webpack production build | Passed. Build includes `/management-reports` and `/api/management-reports` as dynamic routes. |
| Definition and access readback | 12 published definitions; `authenticated` can execute the guarded RPC, `anon` cannot. Direct authenticated catalogue read/write is denied. |
| Office browser | Authenticated desktop and 390px Overview showed period demand and current estate separately, data-as-of, definition versions and static coverage. A source link opened its existing Site Service destination. Historical selection displayed **Historical snapshot unavailable**. |
| Operations browser | Direct page URL returned 404; authenticated API request returned 403. Staff RPC denial was tested; Staff browser route was not separately opened. |
| Responsive/style check | At 390px, viewport and document scroll width both measured 390px. Visual readback showed stacked cards and collapsed filters. No green was found in the reporting surface's sampled computed colours or its CSS. Labels, headings, status text and focus styling were inspected; a full automated accessibility audit was not run. |

Browser images: [desktop](../../output/playwright/task-23b-office-desktop.png), [390px final](../../output/playwright/task-23b-office-390-final.png). The desktop image predates the small improvement that collapsed the definition-version list; the 390px image shows the final layout.

## Observed query latency and source load

Five sequential authenticated synthetic-Dev queries after the final migration gave these client-observed wall times:

| Query | Wall time | Lines in scope | Returned lines | Payload |
| --- | ---: | ---: | ---: | ---: |
| 7 days | 600 ms | 22 | 22 | 107,016 bytes |
| 28 days | 315 ms | 22 | 22 | 107,016 bytes |
| 90 days | 322 ms | 22 | 22 | 107,015 bytes |
| 28 days, one Site | 103 ms | 2 | 2 | 2,957 bytes |
| Same Site, one-line drill-down page | 108 ms | 2 | 1 | 2,272 bytes |

Across that five-call window, `pg_stat_statements` increased by **5 calls, 596.18 ms database execution, 25,860 shared-buffer hits, 0 shared-buffer reads and 0 temporary-block writes** for reporting RPC statements. These are observations on a small synthetic population, not a performance acceptance threshold or a production capacity claim. The broad unfiltered response is dominated by authorised filter options; direct source composition did not require a materialised layer in this sample.

## Limits and follow-ups requiring separate approval

- All historical version-1 measures are explicitly unavailable. A future historical definition needs source-owner agreement on point-in-time event/revision replay, correction restatement and lifecycle inclusion before publication as a new immutable version.
- The coverage detector was exercised with real synthetic forward rows and a stale/locked 08D run. A deliberately deleted expected occurrence was not created, because source guards prohibit deleting dated demand through reporting. The detector's missing-occurrence branch therefore has no destructive fixture proof.
- The spring DST report date was checked as a bounded period with incomplete future source coverage; no March 2027 Site Shift has been materialised. Autumn overnight grouping was read back against a persisted 25 October 2026 demand.
- Pagination is a new database snapshot on each request. The UI states that totals apply to the current filtered snapshot; concurrent source changes between page requests can change later totals/pages. There is no frozen multi-page report or export.
- No Person/sensitive reporting, TASK-10B worked time, export, warehouse, reporting projection, staging or production work is included.

**Stop:** Await David's TASK-23B acceptance. No TASK-23C is authorised.
