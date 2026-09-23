# TASK-06B proposal — Event Staffing Requirements

**Status:** approved by David on 23 September 2026 with a revised long-duty rule; implementation evidence is in `TASK-06B-REPORT.md`. TASK-06A was accepted at `a7333b3`. Staging and Person allocation remain outside 06B.

## Objective and boundary

Give an authorised Office/Operations user a real staffing plan beneath an existing `operational_events.id`: **which operational roles, how many, where, and at what reporting and shift times**. One multi-day Event holds different requirement lines on different service dates. A line defines demand, not an individual shift assignment. TASK-06B does not select `people.id`, establish qualification/eligibility, check availability or clashes, create payroll/timesheets, or calculate pay/charge rates. Those are later decisions, especially 06C.

Preserve the accepted Client → Site/Venue → Event identity and 06A lifecycle. A requirement points to one Event and inherits its exact Client/Site context through that link; it does not copy CRM, Site or Contact data. Existing Events, Sites, assignments, Staff onboarding, CRM and Tasks stay valid.

## Operational role catalogue

Add a small controlled `operational_role_definitions` catalogue with stable UUID, unique immutable code, display name, short description, active flag and creation/retirement actor/time. Initial **synthetic planning roles** should cover `DEPLOYMENT_MANAGER`, `STAND_MANAGER`, `STAND_SUPERVISOR`, `SIA`, `STEWARD`, `RESPONSE`, `SEARCH`, and `GATE_SECURITY`. These are work-position labels, distinct from authentication role assignments and SIA credential categories. The `SIA` label alone must never claim a Person is licensed, competent or deployable.

Only Super Admin should add/rename/retire catalogue entries in 06B through a guarded admin operation; Office and Operations select active definitions but cannot enter arbitrary new role text. Code and historical meaning are immutable once used; a material correction creates a new role definition or an explicitly audited label correction rule. Retired roles remain readable on historical plans and cannot be selected for a new line. Do not build a generic taxonomy/custom-field engine. If a fixed seeded catalogue is sufficient for the first implementation, defer the admin editor while keeping the schema and authority rule explicit.

## Requirement identity and fields

Use a stable `event_staffing_requirements.id` UUID for a line, with `event_id` FK and `operational_role_definition_id` FK. Core typed fields:

| Field | Meaning |
| --- | --- |
| `service_date` | Europe/London operational date used to group the plan; it is not a separate Event. |
| `required_quantity` | Positive whole number of positions required on that line. |
| `report_at`, `shift_starts_at`, `shift_ends_at` | Exact `timestamptz` instants, displayed/entered in Europe/London. |
| `area_label` | Bounded plain-text operational area, e.g. South Stand or Turnstiles. |
| `instructions` | Optional short bounded plain-text requirement instructions; no attachments/HTML or private Staff information. |
| `state` | `PLANNED` or `CANCELLED`; planned means current demand, not filled/approved/deployable. |
| `created_by_person_id`, `created_at`, `updated_at`, `revision` | Attribution, database timestamps and optimistic concurrency. |

Allow multiple lines for the same role on one date when area or times differ. Do **not** enforce uniqueness by `(event_id, service_date, role_id)`; that would erase a real need such as Turnstile SIA and South Stand SIA. Provide a soft duplicate warning for identical role/date/time/area before save, with a deliberate confirm path; exact accidental duplicates should not silently appear. An optional bounded line label may help distinguish same-role lines but should not replace the controlled role FK.

`PLANNED` lines contribute to the current required total. Cancellation requires a reason and removes the line from current demand while retaining it in plan history. A cancelled line cannot be silently reactivated; create a new line or design a later explicit restoration process. Event `COMPLETED`/`CANCELLED` locks normal requirement mutations. `PLANNING`, `CONFIRMED` and `LIVE` Events may need genuine operational amendments; after Event confirmation, require an amendment reason for quantity, role, date, times, area or instructions, and during LIVE require a reason for any change. A reason is always required for line cancellation. This does not claim that the Client approved the change.

## Time rules

Validate local input before conversion and again in the guarded operation. `report_at <= shift_starts_at < shift_ends_at`; all instants must be finite. **24 hours is a warning threshold, not a workforce-policy maximum:** a longer requirement needs explicit confirmation and a reason. Reporting more than 12 hours early likewise needs confirmation and a reason. A 14-day shift/7-day report-lead bound is only a technical guard against nonsensical input, not an approved duty-length policy. The `service_date` equals the Europe/London date of `report_at`; the shift may cross midnight. Event start/end remain the overall Event record; do not overwrite them when requirement times change.

The service date must fall within the Event's Europe/London calendar-date span. Reporting may precede the Event's exact start time on its first day, and shift finish may follow its exact end time on its last day; this supports realistic football reporting and post-event close-down without falsifying the Event's published window. Show a visible **outside Event hours** warning when reporting or finish falls outside exact Event start/end. Do not prevent a legitimate pre-opening/post-close line solely because of that warning. Setup/tear-down on a date outside the Event date span would require an explicit Event-window or future service-day rule, not an unrecorded exception.

Europe/London DST gaps and overlaps must be rejected as ambiguous/non-existent local input unless the user deliberately selects an unambiguous offset under a later approved UX. Never silently normalize a local time. Store only exact instants and the explicit service date; render local date/time with timezone context. Validate the same rules for creates and amendments, including an Event date change that could leave existing planned lines outside the Event date span. The 06A date-change operation should either deny that change with a useful conflict or require an explicit safe plan amendment sequence; it must not silently move requirement lines. Historical Event/requirement records remain intact.

## 06C-ready allocation boundary

Future 06C allocation will reference the stable `event_staffing_requirements.id` and a specific `people.id`, with its own status, authority, qualification and clash rules. Keep current line revisions/history so 06C can know what demand existed when an allocation was made. 06B must not create Person allocation columns, placeholder allocation rows or synthetic filled counts.

For 06B, show **Required: N** from current planned lines and **Allocation not connected**. Do not display `0/N filled`, `N vacancies`, staffing fulfilled, or deployable when there is no allocation source. Define the later calculation seam: filled/unfilled is derived from eligible active 06C allocations against exact active requirement IDs and current quantity, with over-allocation and changes handled by explicit 06C rules. Requirement quantity/role/time amendments after allocations exist will need conflict/reconciliation rules before 06C ships; do not assume automatic movement of People.

## Typed history and audit

Add immutable `event_staffing_requirement_events` (or equivalently narrow typed history), recording exact requirement ID, event ID, kind (`CREATED`, `AMENDED`, `CANCELLED`), actor Person, database time, previous/new revision, previous/new controlled fields, and required reason where applicable. The current row may change only through guarded functions that lock the Event and line, validate state and revision, then atomically write current state, typed event and an `audit_events` ledger entry. Preserve historical role IDs and timestamps. No silent updates, delete or client-written history. Do not copy full instructions into generic audit JSON; audit holds IDs/action/field names/actor/time.

For detailed plan readback, render a curated typed change history, not raw `audit_events`. Show revisions in sequence with actor/time and controlled reason. Do not infer approval from a change record.

## Authority and data protection

| Actor | 06B access |
| --- | --- |
| Super Admin | Full bounded Event staffing-plan oversight and role-catalogue administration, audited. |
| Active Office Admin | Read/create/amend/cancel plans for authorised Events; no blanket private People/document access. |
| Active Operations | Read/create/amend/cancel operational plans for authorised Events. This is genuine operational action authority, not CRM access. |
| Security Staff | No general Event staffing plan in 06B. Deployed Staff views belong to 06C. |
| Anonymous/unmapped/expired role | Denied. |

The 06A Event scope is the starting predicate. Every list/count/detail/action must recheck active role and exact Event relationship server-side and in guarded database operations. Role catalogue read for Office/Operations exposes only operational labels/descriptions, never access-role assignments. A guessed requirement ID or Event ID cannot widen scope. SiteAssignment grants no plan management, CRM, private People, Profile, Document or Storage access. Operations receives no CRM Opportunity/Contact email/phone through plan responses. Notes/instructions must not become a covert location for private Staff or client-sensitive attachments; synthetic plain text only in 06B. No 06B file bucket is needed.

RLS on new tables should deny ordinary direct authenticated writes and raw reads if a narrow projection/RPC is used; SECURITY DEFINER functions need explicit search path, current mapped Person, active role and exact source checks. Define execution grants explicitly. Client-supplied actor, Event organisation, Site or owner values must never determine authority. Direct history/audit writes remain denied. Keep existing Event and Site RLS untouched except the smallest guarded Event-date validation required for plan integrity.

## Product and UI

Replace the Event detail's honest “Staffing Requirements — Not built yet” section with a real **Staffing plan** section. Group planned lines by local service date, with role, quantity, area, report time, shift window and concise instructions. Header: total required positions and number of current lines; do not imply actual staffing fulfilment. Show cancelled lines in a separate history area. For multi-day Festivals, present Friday/Saturday/Sunday under one Event with per-day totals.

Office and Operations can add a requirement, edit it with an explicit review of changed fields, or cancel with reason. The form chooses an active role, quantity, date, reporting/shift times and area; it gives DST/time/error feedback before submit, while the guarded server remains authoritative. Show a conflict if another user changed the line since it loaded, then reload current values. Use a concise role chooser, not arbitrary free-text job titles. Event status and plan state remain separate.

Desktop: compact day-grouped plan table with clear totals, row actions and a side panel/dialog for editing; usable when many lines exist. At approximately 390px: date groups and readable cards, touch-friendly form/sheet, no squeezed table or horizontal overflow. Loading, empty, error, permission-restricted and Event-terminal states must be truthful. Use the accepted iOS-inspired shadcn blue/graphite/neutral system with **no green**, text labels for every status, visible focus and accessible form errors. Do not build rota/Kanban/calendar views in 06B.

Optional Event-list summary may show `N required positions` when derived from current lines, but must not show vacancy/coverage percentages. Preserve existing 06A Event list/detail navigation and Operations projection; deep links re-authorise independently.

## Proposed additive schema and operations

Minimum anticipated schema: `operational_role_definitions`, `event_staffing_requirements`, immutable `event_staffing_requirement_events`, constraints/indexes, guarded create/amend/cancel/read operations, narrow role-catalogue operations, RLS/grants and audit entity-type additions. Index by Event/service date/state, role and history `(requirement_id, occurred_at, id)`; use bounded pagination for plan/history if needed. Do not add a universal requirement or shift engine. Existing 06A Event IDs and site links remain unchanged.

Routes could be `/api/events/[id]/staffing-requirements`, `/api/events/[id]/staffing-requirements/[requirementId]`, and a controlled role-choice route. These call the guarded operations, validate input and return narrow authorised projections. A future 06C allocation endpoint can attach to the exact requirement ID without replacing the 06B record. Recheck current Event status under lock for every mutation. No Task is created merely because a staffing line exists; accountability/workflow for gaps belongs to a later approved design.

## Synthetic acceptance proof

Use development-only synthetic records. Keep the accepted Northshore Event history intact; either add a deliberate synthetic plan to it through normal actions or use a separate synthetic Festival proof Event if isolation is clearer. Demonstrate one multi-day Event with differing Friday/Saturday/Sunday quantities, plus a football-style fixture with at least two lines of the same role in different areas/times. For example: Stand Manager 1, Stand Supervisor 1, Turnstile SIA 2, Steward 18, with reporting before a 15:00 Event start. Demonstrate an overnight line and accurate local/UTC readback. Operations creates/amends a line; Office sees the same authorised plan. Quantity edit and cancellation produce immutable, attributable history. Current totals exclude cancelled demand. No Person is assigned and UI says allocation is not connected.

## Negative and regression tests

- Wrong/nonexistent Event, forged requirement/role/actor, inactive role and guessed IDs denied; no cross-Event line mutation.
- Staff, anonymous, unmapped and expired-role access denied; Operations still cannot read CRM pipeline, Contact phone/email, private People/Profile/Documents or administer Sites. SiteAssignment grants nothing new.
- Direct table/RPC/history/audit writes cannot bypass authority; no client-side-only validation.
- Quantity zero/negative/implausibly large, invalid role/date, empty or overlong area/instructions, invalid ordering, excessive shift/report lead, DST gap/overlap, and invalid Event-date relationship denied.
- Identical role on different areas/times allowed; duplicate warning/confirmation path works; cancelled line cannot be silently edited/reactivated or counted.
- Normal mutation on Completed/Cancelled Event denied. Concurrent stale revision conflicts predictably; failed history/audit write rolls back current-row change.
- Event date change cannot silently orphan existing planned requirement times. Existing 06A Event status/site/client provenance, Operations projection, CRM, SiteAssignment, onboarding, Documents, People and shared Tasks regressions remain green.
- Future allocation readiness: stable requirement ID persists across valid amendments; revision/history shows exactly what changed. No fake filled/vacancy count or Person association appears.

Run clean install, lint, typecheck, Webpack build, smoke, focused server/database/RLS/time tests, existing Phase 01–06A regressions, migration/object readback, staged secret scan, no-green audit, Office/Operations desktop and 390px browser journeys. Use a bounded security review for Operations write authority and Event-date/requirement integrity. Report actual results, not inferred readiness.

## Stop and next decision

David approved implementation in synthetic development. After accepted 06B, propose 06C Deployment/Allocation with exact `people.id` assignment, eligibility, availability/clash, position status and Staff view rules. Training integration remains blocked on the actual provider/interface; production/live data gates remain open.
