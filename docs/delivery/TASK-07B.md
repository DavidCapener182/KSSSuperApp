# TASK-07B — Workforce Schedule / Rota (approved design)

**Status:** Approved by David and implemented in synthetic development. See `TASK-07B-REPORT.md` for delivered behaviour and verification limits.

**Starting point:** TASK-07A accepted at `7f46f1b`. Synthetic development only; protected staging remains unchanged.

## Purpose and boundaries

Give active Office Admin and Operations a week-based operational view of Event staffing demand, named allocations, Staff response, declared availability and unresolved gaps. The schedule composes current authoritative records. It does not store a second rota, create placeholder Staff, decide eligibility, or imply that allocated or accepted work was attended or worked.

Authoritative sources remain `operational_events`, `event_staffing_requirements`, `event_staff_allocations` and `staff_availability_declarations`, with existing Site/Client safe projections and operational role definitions. Existing Event, staffing, deployment and availability guards remain the only mutation paths. A later attendance or timesheet feature may join to stable allocation IDs; 07B introduces neither state.

## Proposed product shape

### Manager weekly schedule

- New authorised **Workforce** destination at `/workforce`, separate from the Event record. Europe/London weeks begin Monday and end before the following Monday. Previous, This week, Next and date picker controls all resolve to one canonical `week_start` London date. Reject out-of-range/invalid dates rather than silently shifting weeks.
- Default to current operational demand: planned requirement lines under Planning, Confirmed or Live Events. Completed/Cancelled Event and cancelled requirement history stays in existing detail/history views; an explicit historical filter can be considered later. An Event with no planned requirement line may appear in Events but contributes no workforce demand. A static Site without an Event remains outside this Event-based 07B schedule; a future static-service requirement model should be designed deliberately.
- Group requirement lines by their authoritative `service_date`, not Event start date. One multi-day Festival remains one Event while its Friday/Saturday/Sunday demand appears on those days, including weeks crossed. Cross-midnight duties appear once on their report/service date; show the next-day finish clearly. Do not split or copy allocation identity.
- Each day shows concise Event groups and exact requirement rows. Event/day counts sum only that day's planned lines; whole-week counts sum each included line once. A festival appearing on three days is one distinct Event in the **Events this week** count.
- An Event group shows Client safe display name, Site, Event name/status and factual `required · allocated · remaining · accepted` totals, plus explicit availability-conflict count. Requirement rows show role, area, report/shift times and the same factual counts. `remaining > 0` is a staffing gap. No “fully staffed”, “ready”, “compliant”, utilisation percentage or performance score.
- Active allocation rows show Staff display name, `ALLOCATED` versus `ACCEPTED`, and separate safe availability/conflict labels. Declined/Cancelled allocations do not consume capacity or appear in the active schedule; retained history remains on the exact requirement/Event.
- Selecting a requirement opens its existing Event staffing line and **Allocations** Sheet/candidate workflow. Use canonical Event/requirement URLs or an anchor/query hint; the target rechecks authority. No rota-specific allocation, reassignment, cancellation or stage-mutation endpoint. No drag between lines and no automatic gap filling.

### Staff-centric manager view

Provide a second authorised tab, **Staff schedule**, with bounded search for an active Security Staff Person and a week list of that Person's active allocations. Show only operational fields needed for staffing: Event, Site, role, area, report/shift window, allocation response and safe availability assessment/conflict. Search uses a minimal operational Person projection; do not return Profile/contact details, private SIA/evidence, availability notes, onboarding comments or CRM pipeline data.

The selected Person does not become a new authority scope: active Office/Operations role and exact operational source access are checked for every row. Guessed Person IDs return the same generic unauthorised/empty outcome as the authorised search contract permits, without revealing private identity or records. Limit result count and paginate at the server. No free-form global Person data dump.

### Staff self view

Include a small **My Schedule** at `/my-schedule` for active Security Staff. It composes only their own upcoming `ALLOCATED`/`ACCEPTED` work and their own current declarations, grouped by London day. These remain separately labelled; a declared Available interval is not an assigned shift. Link to **My Deployments** for accept/decline and **My Availability** for declaration changes. Do not show peer names, staffing totals, Event administration, Client contacts or the full plan. No new Staff confirmation operation or Task adapter.

## Derived facts and attention ordering

| Fact | Derivation / display |
| --- | --- |
| Required | Sum `required_quantity` for `PLANNED` requirement lines in scope. |
| Allocated | Count allocations in `ALLOCATED` or `ACCEPTED` on those lines. |
| Accepted | Count `ACCEPTED` allocations; never call all Allocated “confirmed”. |
| Remaining | Required minus Allocated, guarded by existing strict capacity. |
| Staffing gaps | Lines with Remaining > 0; show positions remaining and number of affected lines separately. |
| Explicit unavailable conflict | Active allocation whose exact duty overlaps current `UNAVAILABLE`. The allocation remains active/accepted. |
| Coverage no longer declared | Existing 07A safe allocation indicator where earlier available coverage was removed/shortened. Keep separate from explicit Unavailable. |
| Not declared / partial | Current exact-duty availability assessment, informational warning; do not count as an explicit unavailable conflict. |
| Allocation clash | Exact `[report_at, shift_ends_at)` overlap if detected for one Person. Existing 06C guards should prevent new clashes; surface any legacy/inconsistent data as an urgent anomaly, never infer from a cross-midnight display split. |

Prioritise attention within a day by: (1) hard allocation clash, (2) explicit unavailable conflict, (3) staffing gap, (4) coverage no longer declared, (5) allocated awaiting Staff response, (6) no declaration. This orders the UI only. It is not a compliance, readiness or risk score; labels remain explicit and independently visible. Partial coverage should appear with the availability warning group, not masquerade as a gap. No automatic Tasks for gaps or conflicts.

## Filters, counts and privacy

Manager filters: week/date, Event, Site, safe Client label, operational role, Event owner, gaps only, and explicit availability conflicts only. Default week and filters apply **inside** the guarded server/database projection before rows, counts or pagination are returned. Client filtering uses the already approved operational Client identifier/label; it never requires Operations access to raw CRM Organisation, Contact or Opportunity tables.

Distinguish **weekly totals before display filters** from **filtered totals** in the API and UI. Prefer showing filtered totals with a clear “for this view” label so a gaps-only filter does not imply there is no other demand. All totals use the identical authorisation and filter predicate as the corresponding list. Search and guessed IDs cannot disclose excluded records through counts, errors or timing-sensitive separate existence checks.

The Staff-centric selector is restricted to active Security Staff display identity and operational schedule data, with server-side pagination. Managers receive no raw availability intervals or note text in the weekly/candidate projection. Staff self reads derive Person from AuthIdentity, ignore browser-supplied Person IDs, and return own records only. SiteAssignment alone gives neither manager workforce access nor another Staff member's schedule. Operations has no CRM pipeline, private People/Profile, Documents, onboarding or SIA reference through this screen.

## Query and schema proposal

Add a narrow guarded **read-only** `workforce_week` RPC/projection for Office/Operations/Super Admin, plus a guarded `workforce_person_week` read and `my_schedule` self read if existing exact-source reads cannot do bounded composition efficiently. These are scoped output contracts, not new authoritative tables. `SECURITY DEFINER` functions use a fixed search path, authenticated Person resolution, active role checks, exact source joins and explicit result fields; ordinary direct table/history grants remain unchanged. The application route independently checks capabilities before calling them.

`workforce_week` takes canonical week, controlled filters, offset and limit and returns one bounded page of day/Event/requirement rows plus scoped counts. Build from a single filtered set of planned requirement IDs; left join grouped active allocations and safe conflict assessments only for that set. Use grouped aggregates/windowing or a small fixed number of set-based queries, never one RPC per Event/line/Person. Enforce a server maximum page size and bounded date window. Prefer keyset pagination when the ordering/grouping remains stable; if offset is used, include a deterministic `(service_date, report_at, event_id, requirement_id)` order and document concurrent-edit pagination behaviour. Counts and rows must share one transaction snapshot or a single SQL statement to avoid contradictory totals during concurrent allocation.

`workforce_person_week` checks manager role and returns only active allocations for the selected Person and week, each joined to an authorised Event/requirement. `my_schedule` resolves the caller's Person and active Security Staff role and composes own allocations and current availability declarations. Do not invoke the broader Staff self-history endpoint in the manager path.

Likely indexes to evaluate with `EXPLAIN`: requirement `(service_date,event_id,state,report_at,id)`; active allocation `(requirement_id,status,person_id)` and `(person_id,status,requirement_id)`; current availability `(person_id,starts_at,ends_at)` already exists. Reuse existing indexes when sufficient. No new mutable summary table, cached coverage flag, rota identity or general scheduling engine. If count/query cost becomes material, benchmark the bounded weekly projection before proposing further schema.

The existing 07A `private.availability_assessment_07a` and `private.availability_allocation_indicator_07a` are exact-duty helpers; use only from the guarded operational projection. Existing 06C `deployment_requirement`, `deployment_candidates`, `deployment_allocate` and `deployment_cancel` remain authoritative for actions. Avoid returning full Staffing Plan `instructions` or private notes in broad week rows unless an explicit operational use is justified; the exact Event view already provides controlled detail.

## UI acceptance

Desktop: a stable week header and compact day sections or limited-width day columns, with Event groups, requirement rows and an attention rail/filter. The design must handle several Events per day and a large multi-day Festival without a giant spreadsheet or nested horizontal scroll. Week navigation should preserve filters and support an exact Event/requirement deep link. Loading, empty, no-results and recoverable-error states use existing product primitives.

At approximately 390px: selected-day navigation with Previous/Next day and date picker; stacked Event cards and requirement summaries; factual counts and conflict labels visible without tiny text or page overflow. The exact allocation Sheet remains the action surface. Staff **My Schedule** uses readable own-day cards and links to the separate response/declaration pages. Touch controls, visible focus, keyboard week/date navigation, labels and non-colour status cues are required. Preserve iOS-inspired shadcn blue/graphite/neutral styling; absolutely no green for Available, Accepted or complete counts.

## Acceptance proof and tests

Use separate synthetic Dev fixtures: a football Event with gaps; a multi-day Festival with varying daily demand; a fully allocated but partially accepted requirement; an accepted allocation followed by explicit Unavailable; a Person with no declaration; a cross-midnight duty. Prove week/day totals, distinct Event count, demand grouping by service date, accepted versus allocated labels, conflict priority, filtered totals and deep-link action reuse. Demonstrate Office and Operations desktop plus 390px views and Staff own **My Schedule**. No real KSS data or staging changes.

Negative tests: Staff denied manager rota and peer schedule; Operations cannot read CRM/private People/SIA/evidence/availability notes; guessed Event/requirement/Person IDs and filters do not widen results; expired roles lose access; SiteAssignment alone grants nothing; anonymous/unmapped denied; staff self cannot choose another Person; counts and pagination match authorised scope; cancelled/declined rows release capacity and do not inflate current totals; availability never mutates allocation; old allocations and histories remain authoritative; no direct write to rota/history is possible because no rota table/write RPC exists.

Regression checks should cover Events/Operations projections, 06B demand/history, 06C capacity/clash/Staff response/synthetic SIA, 07A availability and private People/Profile/Documents/CRM separation. Run clean install, lint, typecheck, Webpack build, smoke, focused projection/RLS tests, desktop/390px browser checks, accessibility and no-green checks, migration/object readback if a read RPC/index is added, and staged secret scan. Record the actual broad-suite result; do not call it green while Auth throttling or the controlled-document fixture denial persists.

The separate `ENGINEERING-TEST-AUTH-SESSIONS.md` follow-up should be approved and completed soon, ideally before a claimed full 07B regression pass. It must stay a separate engineering change/commit and cannot weaken Auth limits or silently rewrite the controlled-document fixture. This proposal does not implement that follow-up.

## Future seams and stop condition

Later attendance may add checked-in/no-show/actual shift facts against stable allocation identity and show them alongside, not in place of, allocation and Staff response. Timesheets/payroll remain separate approval domains. Static guarding demand without discrete Events, travel/rest policy, notifications, bulk scheduling, automatic gap filling and drag reassignment are deferred.

**Implementation boundary:** Synthetic development only. Do not deploy to staging or begin a later workforce feature on the strength of this task.
