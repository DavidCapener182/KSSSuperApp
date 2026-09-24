# TASK-10B — Worked Time / Timesheets

**Status: Accepted by David in synthetic Dev on 24 September 2026.** The delivered first slice is Event-only: exact allocation, pinned attendance evidence, Staff draft and explicit WORK/BREAK submission, manager review/return, Staff correction as a new revision, worked-time approval and immutable history. See [TASK-10B-REPORT.md](TASK-10B-REPORT.md) for the migrations, security readback, 53/53 serial regression, build/smoke and authenticated browser evidence. The manager 390px screenshot timed out, but its authenticated DOM/layout check passed. No staging, production or real data was used.

## Purpose and source boundary

The approved design direction is an exact Event allocation plus pinned attendance evidence, Staff-submitted worked-time proposal, manager review/return/correction, worked-time approval, and immutable revision history. The first implementation slice stops at worked-time approval. Payable-minute approval, chargeable-minute approval, static shifts, rates, money, payroll and invoicing are deferred from that slice.

The state distinctions are mandatory:

`scheduled ≠ attended ≠ proposed worked time ≠ approved worked time ≠ payable time ≠ payroll paid`

`chargeable time ≠ invoiced`

Attendance facts are evidence, not a timesheet, a continuous-work assertion, a manager approval, or an automatic duration. Check-in minus check-out is not worked time. Attendance may later prefill or suggest timestamps for Staff to review, but must never automatically create intervals or worked time; Staff explicitly proposes every interval. Submitted and approved worked time do not become payable or chargeable without their own scoped approval decisions. Payable is not proof of payroll payment; chargeable is not proof of invoice issue/payment.

## Exact typed source identity and Person binding

Use one worked-time model with explicit source adapters and one immutable case per exact allocation. No bare polymorphic `(source_type, source_id)` and no identity based on a template line, display name, duty date, Site, Event, or recurring Service.

| Source | Exact allocation identity | Exact source context and Person binding |
| --- | --- | --- |
| Event | `public.event_staff_allocations.id` | Resolve `requirement_id` → `event_staffing_requirements.id`; derive Event and its schedule through that requirement. Bind the allocation's immutable `person_id` to the case and every revision. |
| Static Site shift | `public.site_shift_allocations.id` | Resolve `demand_id` → `site_shift_demands.id`; derive Site Service and historical Site/Client context through the demand. Bind the allocation's immutable `person_id` to the case and every revision. |

08A was accepted at `40277b7`. Its verified `site_shift_allocations` identity has stable `id`, `demand_id`, `person_id`, `demand_revision_at_allocation`, `status` and `revision`; allocation history is separately typed. Event and static allocators use the shared Person row lock and `private.person_allocation_overlap_08a`. The TASK-09A delivered migration defines `attendance_cases.event_allocation_id` + `person_id`, and append-only `attendance_events` with `attendance_case_id`, exact allocation/person binding, revision, factual type, actual/corrected timestamp, `recorded_at`, actor/method, idempotency and correction/resolution references. Its factual types include `CHECK_IN`, `CHECK_OUT`, exception/review facts and `CORRECTION`. Current 09A attendance covers Event allocations only; it does not provide a static attendance adapter. These delivered identities are the design inputs. Before any implementation, verify against the final accepted report and schema; do not infer that a proposed static attendance link already exists.

Propose one work-time case per exact allocation, with source-specific foreign keys (`event_allocation_id` or `site_shift_allocation_id`) and an exactly-one-source constraint. Derive `person_id` server/database-side from that immutable allocation. Enforce allocation-plus-Person equality using the verified composite FKs/guards or a narrowly scoped forward constraint after schema review; never trust only UI/API validation. Pin evidence to the same source allocation and Person. For Event, bind exact 09A attendance case/event IDs and observed revisions to the same Event allocation. For static shifts, do not create a timesheet evidence adapter until a static attendance source exists and is separately approved; then bind its immutable facts to the exact `site_shift_allocations.id`. A source correction, replacement allocation, or cancellation must not retarget the case or rewrite pinned evidence.

An Event or Site shift cancelled, changed, or no longer current after time submission does not erase or rewrite the allocation, attendance, evidence snapshot, or work-time history. Surface the affected proposal/decision as requiring review under a typed event. A new allocation is a new source identity and cannot inherit the old work-time case. Any source state that makes new time submission invalid must be checked transactionally by the guard; already submitted history stays available to authorised reviewers.

## Proposed records and immutable history

Names are logical proposal names, not authorised migration names. Prefer typed revisions and decisions over a mutable row that overwrites the original submission:

- `work_time_cases`: stable UUID; exactly one typed allocation FK; allocation-bound `person_id`; current revision pointer/number; created/updated database timestamps. It is the concurrency anchor, not another schedule or editable Person assignment.
- `work_time_revisions`: case and revision number; exact interval segments submitted for the duty; explicitly declared unpaid/paid break intervals or `no_breaks_declared` (never inferred); computed integer **proposed worked minutes** from the submitted segments; submitter and server time; status/event reference; reason and superseding/correction link. Store instants in UTC and retain the displayed Europe/London wall-time/date context where useful for review. A submitted revision is immutable.
- `work_time_evidence`: revision ID plus exact source allocation, Person, attendance case and `attendance_events.id` with the event revision observed. Pin the specific check-in/out, correction, resolution and other relevant factual events used, including the 09A case revision/snapshot. Evidence links are immutable and exact; later attendance events/corrections do not silently change what the reviewer saw.
- `work_time_events`: append-only attributed `SUBMITTED`, `WITHDRAWN`, `REVIEWED`, `REJECTED`, `CORRECTED`, `SUPERSEDED`, `REOPENED`, `SOURCE_REVIEW_REQUIRED`, and period/cut-off review events as approved. Each identifies the exact prior/new work-time revision and actor, database time, reason, and expected revision.
- Append-only review/decision history binds each exact submitted revision to the manager's review (approve as worked time, return for correction, or reject), and to two independent decisions: `PAYABLE_MINUTES_APPROVAL` and `CHARGEABLE_MINUTES_APPROVAL`. Each minute decision stores approved integer minutes, including explicit zero, or a reasoned non-approval; actor, capability/scope, time and supersession link are recorded separately. Neither decision implies the other, and neither is implied by worked-time review. A change requires a new revision and linked decision lineage, never an in-place edit. Both payable and chargeable minute approvals are within proposed 10B scope; money, rates and downstream payment/invoice states are not.

Breaks are explicit entries and are never automatically deducted. Do not infer a break or apply a default break deduction. Whether breaks are required, paid or unpaid, editable, or separately evidenced; rounding, minimums, maximum duration, time-entry windows and DST ambiguity rules all require David/KSS approval before implementation. Do not invent them. Compute proposed integer minutes only from the Staff-submitted work intervals and explicitly entered breaks, using UTC instants rather than rounded display strings. Overnight duty is one exact allocation and may contain multiple submitted work segments.

## Staff submission and correction

Staff may read and submit only their own exact allocation's work-time revision, resolved by authenticated AuthIdentity → stable Person. Ignore caller-supplied actor or Person IDs. The eligible source state and submission window must be reconciled to accepted allocation/attendance rules before implementation; an old event, declined/cancelled allocation, or merely scheduled interval is not permission to assert worked time. Incomplete or missing attendance evidence does not block Staff submission: allow the explicit proposal and visibly flag missing or inconsistent evidence for manager review. Never fabricate a check-in/out, prefill worked intervals as accepted, or derive a proposal from attendance.

A submitted proposal can be withdrawn or corrected only by appending an attributable event/new revision under an approved policy. After a manager decision, changes require an explicit reopen/correction authority and reason; no silent edits. Where a pinned attendance fact is later corrected, or source cancellation/change affects the exact allocation, mark the linked work-time revision and any dependent decision `REVIEW_REQUIRED` through a durable append-only event. Do not silently alter submitted/approved minutes. Approval of an older version must be visibly superseded or under review before any later payable/chargeable decision can rely on it.

## Review authority and separation of duties

For the first slice, separate Staff own-time submission, exact-source work-time review/return, and worked-time approval. Each manager action requires an explicit capability grant scoped to the exact Event plus server-side Person, case, and revision checks. Do not infer an approval capability from Office, Operations, Super Admin, allocation/scheduling authority, or a work-role label. Super Admin may administer named, time-bounded Event-scoped grants through an audited grant path, but receives no approval capability automatically. Staff submission remains self-only. Payable-minute approval, chargeable-minute approval, correction/reopen and period close/cut-off authority are deferred decisions.

The submitter cannot approve their own worked, payable or chargeable time. A reviewer also cannot approve a payable/chargeable decision they submitted or originated if that would defeat separation of duties. The system records distinct actors for submission, review and each approval. Self-approval is prohibited under every dual role; there is no role-based exception. No exception path is proposed.

When payable-minute and chargeable-minute approvals are separately considered, their approvers are not presumed to be the same person or to share authority. Their exact capability owners, Office/Finance scope, source scope, coverage/delegation and escalation path remain future decisions. No broad Finance or client-facing access follows from this proposal.

## Period cut-off and lock seam

The proposal needs an approved cut-off model before implementation can write or approve time: period/calendar and timezone, submission deadline, who closes/reopens, treatment of late submissions, locked-period corrections, and whether corrections go to an open period or require a named reopen/adjustment. Do not create, infer, or mutate finance periods here. A lock must not delete or rewrite history. A late or changed record in a locked period is blocked or routed to an explicitly authorised exception decision; no silent backdating. Preserve the original actual instants, submitted-at and recorded-at separately.

## Concurrency, retries and direct-write denial

All writes go through narrow guarded server/database operations in one transaction. Lock the exact work-time case, verify expected case/revision and source state, bind actor from session, persist the revision/evidence/decision event, then return the committed result. Use a stable idempotency key scoped to actor + case + action and reject reuse with a different payload. Concurrent submit/correct/review/approve operations serialize; stale operations return the latest safe revision and require deliberate reload. Retrying a committed-but-lost response returns its same outcome. Unique constraints prevent duplicate case per exact allocation, duplicate revision number, duplicate decision for the same decision type/revision, and duplicate idempotency key.

Enable RLS and revoke direct authenticated table writes/reads unless a reviewed explicit policy proves them safe. Client access is through explicit private projections and guarded RPCs; server route checks repeat action/source scope. Service credentials remain server-only and cannot bypass the business guards. No direct inserts or updates to revisions, evidence, events or approvals; no guessed IDs, source-kind switching, evidence from a peer, cross-allocation correction or user-written audit events. Private projections return only the fields needed for the Staff's own record or the exact manager review task; never expose peer time, protected HR/evidence, rates, finance values, or unrestricted audit payloads.

## UI proposal

**Staff, 390px:** iOS-inspired shadcn/ui blue, graphite and neutral palette, no green; accessible labels and focus, large touch targets, no horizontal overflow. Show exact duty/site or event context, own scheduled/report/shift times, current Staff response, factual attendance evidence (with actual versus recorded time clearly named), editable proposed work segments and breaks, calculated proposed minutes with the calculation basis visible, source revision/evidence freshness, and a clear Save draft / Submit / Withdraw or correction state. Distinguish draft, submitted, returned, approved worked, payable decision and chargeable decision; provide a reasoned “needs review” state when evidence/source changed. Prevent double submits and explain whether the save/submit actually committed.

**Manager desktop and mobile:** scoped queue filtered to exact permitted Event/date/status; rows show minimum Staff identity, exact duty, submitted/revision status, proposed intervals/break declarations, minutes, linked attendance facts and corrections, and evidence/source change warnings. Detail shows immutable revision history and worked-time review controls. Payable-minutes and chargeable-minutes decisions are deferred. Require a reason for return. No rates, monetary totals, payroll, invoice or unrelated Staff records. Mobile layout must remain operable at 390px, keyboard accessible, and free of horizontal overflow.

## Synthetic positive and negative proof plan

No tests were run for this proposal. After separate approval and implementation, use synthetic data only and record actual DB/RLS plus authenticated browser evidence. Minimum cases:

- Positive: exact Event allocation and 09A attendance evidence; Staff submission; manager review/return/correction; worked-time approval; immutable history; retry after a committed-but-lost response returns the same result. Payable-minute and chargeable-minute approvals and static attendance are outside the first slice.
- Negative: Staff A cannot view/submit/correct Staff B by guessed Person, allocation, case, revision or evidence UUID; cross-source ID substitution and mismatched Person; event evidence from another allocation/case; modified caller actor/Person; Staff, manager or dual-role self-approval; unauthorized scheduling role attempting approval; payable approver attempting chargeable decision without capability or vice versa; duplicate/different-payload idempotency key; concurrent stale submit/review/decision; allocation reassignment or cancellation race; later attendance correction/source change silently rewriting pinned evidence or approved minutes; direct table/RLS and service-key business-guard bypass; locked-period mutation; peer/private data leaking in row, count, error or pagination.
- Policy validation: zero/negative/reversed intervals, overlap and duplicate segments, declared versus undeclared break, DST gap/repeated local time, midnight/overnight, duration boundary, minute arithmetic and rounding. Expected outcome stays undecided until the named policy is approved; tests must not invent the rule.
- UX: Staff 390px end-to-end save/submit and correction; manager desktop and 390px review; focus/keyboard/screen-reader checks, no green, no horizontal overflow, exact saved/pending/error language and duplicate-submit protection.

## Smallest later implementation slice

Approved first slice design: `Event allocation → pinned 09A attendance facts → Staff draft and explicit submission → manager review/return → Staff correction as a new revision → worked-time approval → immutable history`. Payable-minute and chargeable-minute approval are deferred. Never derive or auto-submit work intervals from check-in/out. No static adapter or static timesheet. Add narrow Event-scoped explicit capability grants; broad app roles do not confer approval authority. Preserve a future cut-off/period seam without inventing periods, deadlines, or lock policy. Exclude rates, money, payroll, invoices, expenses, VAT, integrations, external payment states, staging and real data.

## Explicit exclusions

This proposal excludes rates, money, payroll, invoices, VAT, accounting, payment, expenses and staging. It also excludes calculations of payable or chargeable amounts, provider connections, real KSS data, notifications, changing attendance, changing allocations/schedules, automatic time inference, location/device evidence, production deployment and migration. There are no monetary values or payroll/invoice records in scope.

## Open decisions for David/KSS before implementation

1. Submission/correction windows, rounding/limits and a period/cut-off policy remain future business decisions; this slice uses exact user-entered instants and explicit segments and does not create a period or infer a cutoff.
2. Missing or incomplete attendance is permitted at Staff submission and visibly flagged for manager review. Attendance changes flag existing dependent history and never rewrite a submitted or approved revision.
3. Explicit break intervals are stored; no automatic break deduction or policy-based paid/unpaid classification is applied.
4. Work-time review, worked-time approval, payable-minute approval and chargeable-minute approval each require a separate, exact-Event capability grant. Self-approval is denied under every dual role.
5. Static timesheets remain excluded. Any static attendance/timesheet adapter is a separate future task using the accepted 08A identity.

**Accepted implementation boundary.** The Event worked-time journey is accepted and this lane is stopped. Payable/chargeable approvals and static timesheets remain excluded. Any future Static Site Shift Worked Time or Payable/Chargeable Minute Decisions task needs separate approval. The suggested 10C/10D labels require reconciliation with `phase-map.json` before use because those identifiers already name different roadmap tasks. No money, payroll, invoicing, staging, production or real data is authorised.
