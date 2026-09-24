# TASK-23B — Management Reporting Foundation

**Status: ACCEPTED — SYNTHETIC DEV.** David approved TASK-23A as the Management Reporting architecture direction, separately approved this bounded TASK-23B implementation, and formally accepted its synthetic-Dev delivery on 24 September 2026. TASK-23A itself was not implemented from the architecture document. See `TASK-23B-REPORT.md` for delivered behaviour, actual checks and accepted limitations. No staging, production, real data or subsequent reporting task is authorised.

## Purpose and boundary

Answer four factual questions for Office and Super Admin: what operational work KSS had; how many positions were required and allocated; how many were accepted; and where explicit staffing or availability gaps were recorded. Reporting consumes source-owned facts through guarded reads. It never writes to Client, Site, Service, Event, staffing, allocation, attendance, availability, worked time, Incident, Site Book, Asset, Mobilisation, Service Delivery or finance records. UI labels and generic Tasks are not business-state sources.

The first route is **Management Reports → Overview**. It is deliberately a period report, distinct from 13A Control Room's live attention view. There is no executive score, readiness/compliance claim, generic formula builder, warehouse, analytics vendor, export or scheduled delivery.

## Audience and authority

Allow active `OFFICE_ADMIN` and `SUPER_ADMIN` only, subject to each source's accepted read scope. Deny `OPERATIONS`, `SECURITY_STAFF`, Client, anonymous and unmapped actors. Office/Super reporting access grants no private Incident, credential, document, Person or finance authority. Enforce role, action, exact record and Client/Site/Service/Event scope on the server and database before aggregation. Counts, rows, filter options/counts, drill-downs and pagination must derive from the same authorised population and query snapshot. A source link reauthorises at its destination. Do not share privileged results between users through a cache; simplest first implementation is uncached guarded reads.

## Proposed first measures

Publish an immutable, versioned definition for every measure before exposing it. The catalogue is controlled by source code/database migration, not user formulas. A definition includes stable code, display name, source module and owner, source identity/grain and guarded read interface, included/excluded states, unit, numerator and denominator where relevant, Event/Service date interpretation, effective/event time, recorded time, cancellation and correction rules, source coverage rule, timezone, definition version and publication time. Changes publish a new version; old versions remain identifiable. Do not reuse a code/version pair with different semantics.

| Measure family | First-slice meaning |
| --- | --- |
| Clients, Sites, Site Services, Events | Distinct exact source IDs by explicit current lifecycle state. Label **current-state counts**. `ACTIVE`, `CONFIRMED` and `LIVE` are factual states, not compliance, success or readiness. Historical lifecycle counts require reliable source transition history. |
| Required positions | Sum accepted source required quantity across typed Event requirements and **materialised** Site Shift demand, each with its exact UUID and explicit London service/event date. Recurring template rows are not dated demand. |
| Allocated positions | Count current `ALLOCATED` plus `ACCEPTED` allocations attached to included demand. This is not attendance. |
| Accepted positions | Count current `ACCEPTED` allocations attached to included demand. |
| Remaining positions | Per accepted source contract, `max(required - allocated, 0)` per demand, then sum contributing lines. Do not substitute an unrelated overall subtraction if anomalies or grouping could change the result. |
| Explicit availability conflicts | Count only 07A/07B source-defined explicit conflict states at the accepted active-allocation grain. Keep explicit unavailable and removed-coverage facts identifiable. Missing declaration and partial coverage, where exposed, remain separate factual states; missing declaration is unknown, never unavailable. |
| Static horizon coverage | Show accepted 08D materialisation health independently of demand/staffing totals. Missing or overdue materialisation is incomplete/unknown coverage, never zero demand. |

Before implementation, map each measure to its exact accepted source read interface, fields, state codes, owner and history capability. If any interface lacks the needed guarded facts, propose the narrow source-owned read projection and its authority tests within 23B; do not recreate state rules in reporting. No source mutation is authorised by this proposal.

## Current and historical product modes

**Current snapshot** answers “what does the source currently say?” and shows `Data as of [UTC timestamp]`, London display time, definition version and source coverage. Current lifecycle totals must not be presented as past-period lifecycle counts.

**Historical report** answers “what factual state/history was recorded for this period under definition version X?” Use immutable source transition/event/revision history where available, with source watermark, event/effective time, recorded time and a declared correction/restatement rule. Cancelled requirements and allocations remain in history while leaving current totals. Where a source cannot reliably reproduce historical state, render **Historical snapshot unavailable** for that measure; never backfill it from today's rows. Partial historical availability must be explicit per measure rather than rendered as zero. A historical measure cannot silently mix a current definition or current row state into its result.

Use half-open `[period_start, period_end)` ranges, preserve UTC instants and Europe/London business dates, and group static demand by its source service date. An overnight duty stays attached to that service date. DST days retain their actual duration. Offer Today, Last 7 days, Last 28 days and a custom range of at most 90 London calendar days; these are query bounds, not retention policy. No lifetime query.

## Filters, drill-down and presentation

Filters: date range, Client, Site, Site Service, Event, and Event versus Site Shift source. Filter options and counts must be scoped before display; guessed or hidden IDs cannot reveal a hidden Client/Site through a facet, total, error or page. Use bounded page sizes and deterministic ordering. Each total opens its authorised contributing lines: source type, exact source UUID, service/event date, factual state and count. The sum of displayed plus paginated contributing lines must reconcile to its total. Each line's destination performs its own authorisation.

Overview shows selected period and mode; Clients/Sites/Services/Events; Required, Allocated, Accepted and Remaining positions; explicit availability conflicts; and separate source-coverage/static-horizon status. Below, provide factual Client, Site, Service/Event and date breakdowns using cards/tables. Show `Data as of`, definition versions, loading/error and incomplete-source states. Never silently turn a failed or incomplete source into `0`. Charts are optional only when they clarify a time trend. No red/amber/green score, no green styling. Follow the blue/graphite/neutral product design. At 390px use stacked summary cards, collapsible filters, readable drill-down rows and no horizontal page overflow; preserve keyboard, focus, labels and non-colour status cues.

## Explicit deferrals

Exclude Incident aggregates (TASK-12A grants no reporting authority), Staff attendance aggregates/rankings, credentials, leave, training, SOP acknowledgements, worked time, Person-level Asset fault/loss, finance, payroll and charge/invoice values. No Person names or rankings in reporting payloads. There is no universal small-cell threshold in 23B because person-sensitive measures are excluded pending a separate privacy decision.

Do not consume TASK-10B until David separately accepts its final delivery. A later approved definition may separately show submitted, returned and approved worked-time revisions and WORK/BREAK minutes; approved worked minutes never become payable, chargeable or payroll figures.

No CSV, Excel, PDF, scheduled email or external BI export. A later export task must approve purpose, exact source scope, field allowlist, row limits, retention, download audit and privacy/suppression. Dashboard visibility does not grant export authority.

Begin with direct guarded source reads/composition. Measure query latency and source load in synthetic tests. Only propose rebuildable, source-identity/history-based projections if those measurements demonstrate a need; projections cannot become master records.

## Acceptance proof for a separately approved implementation

1. Exact typed Event and Site Shift identities, date and factual states reconcile to source rows. Required, Allocated, Accepted and Remaining totals reconcile exactly to authorised contributing lines across filters and pages.
2. Cancelled requirements/allocations leave current totals but remain in reliable historical history. Current snapshots and historical definition versions never mix. Unsupported historical measures say **Historical snapshot unavailable**.
3. Missing 08D materialisation displays a coverage gap rather than zero demand. Missing Availability declaration is unknown; partial coverage and explicit conflict remain distinct. London overnight and both DST transitions group deterministically.
4. Hidden Clients/Sites do not leak through totals, filters, options, drill-down, pagination or cache. Office/Super first-slice access succeeds within source scope; Operations, Staff, Client, anonymous and unmapped access fails. Direct-table and write attempts fail. Source links reauthorise.
5. Payload inspection finds no Person names, private Incident, credential, contact or finance fields. Desktop and authenticated 390px journeys show no green, no overflow and accessible controls.
6. Run source regression checks and record actual results. Record query latency and source load for bounded 7-, 28- and 90-day synthetic cases, including filtered and drill-down queries; report the observed figures and any unresolved performance limit rather than inventing a pass threshold.

## Formal acceptance and stop condition

David accepted the delivered Office/Super-only, read-only and uncached foundation with 12 immutable version-1 definitions. Operational demand during the selected period remains distinct from the current operational estate. Typed Event and materialised Site Shift identities, separate Required/Allocated/Accepted/Remaining measures, per-line Remaining calculation, distinct Availability facts, incomplete static source coverage and explicit historical-unavailable results remain the accepted contract. Source links reauthorise; Person-level data and rankings remain excluded.

Acceptance applies only to synthetic Dev `dnfhkmmnlbiabqypclqg`. The evidence and accepted limitations are recorded in `TASK-23B-REPORT.md`. Protected Staging `kwpgjbxepxuhwxxydaca`, production and real KSS reporting data remain excluded. The TASK-23B implementation lane is closed after its separate acceptance commit; do not begin TASK-23C automatically.
