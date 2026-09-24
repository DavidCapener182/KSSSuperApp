# TASK-09A approved scope — Live Operations, Attendance and Check-In

**Status:** Approved by David for TASK-09A implementation in synthetic Dev, Event allocation first. The decision lock below supersedes proposal alternatives and open questions. Staging remains protected.

**Scope owner:** TASK-09A. TASK-08A was accepted at `40277b7`; its exact static allocation identity and shared Person guard have been inspected in `TASK-08A-REPORT.md` and its delivered migrations. This delivery enables Event attendance only; no static adapter is guessed or wired into this Event-first slice.

## David’s binding approval — 24 September 2026

1. Staff self check-in requires the exact allocation to be `ACCEPTED`. `ALLOCATED` is not sufficient and check-in never accepts an allocation. Manager exception handling remains separate and attributable.
2. Initial operational authority uses existing active Office Admin, Operations and Super Admin roles with operational source access. Do not build named-supervisor permissions. Work-position labels do not grant application authority. Managers record observations as themselves and never impersonate Staff.
3. The immutable factual event set is `CHECK_IN`, `CHECK_OUT`, `NO_SHOW_RECORDED`, `EXCUSED_ABSENCE_RECORDED`, `CHECK_IN_NOT_POSSIBLE`, `REVIEW_REQUIRED` and `CORRECTION`. No timer or missed check-in creates a no-show.
4. A check-in after explicit no-show requires manager resolution; preserve the original event and correction lineage. Cancellation after check-in preserves attendance and raises review.
5. Store planned and actual times separately. Do not add punctuality labels, thresholds or grace periods. Persist UTC instants and database receipt time; display Europe/London. A 60-second future client-time guard is input integrity only, never a lateness rule.
6. First method is authenticated online Staff check-in/out. No offline, location, QR/NFC, biometrics, device trust or background tracking. Failed submission must clearly say attendance was not recorded and permit same-key retry.
7. Do not calculate worked, payable or chargeable time, breaks/payroll deductions, pay, client charge or invoice values. Attendance is evidence for a later separately approved worked-time record.
8. No attendance notifications. Coordinate source identity seams with 08B; do not register or emit producers in 09A.
9. Keep Staff projections own-person only; operational projections source scoped and minimal. Do not expose profile/contact, address, SIA/onboarding evidence, CRM, availability, HR or rate data.
10. Preserve explicit source FKs/adapters and exact allocation identity. Event first; static is enabled only after 08A delivery and inspection of its exact allocation and shared Person guard. Do not use weak polymorphic IDs.
11. Preserve E-01 Auth session reuse, synthetic Dev only, no protected staging. Use at most one bounded stronger architecture/security review and no GPT-6 Astra without David’s explicit approval.
12. Required verification is clean install, lint, typecheck, Webpack production build, smoke, focused attendance/RLS/concurrency tests, relevant 06C/07A/07B regressions, 08A regression only if static is enabled, migration/object/grant readback, secret scan, no-green audit, Staff 390px flow, Office/Operations views and direct denial tests. Create the delivery report, commit TASK-09A separately, then stop for David’s review.

## Purpose and boundary

Add a factual attendance layer after demand, named allocation and Staff response:

**Requirement → Allocation → Staff response → Attendance facts → Worked-time proposal → Worked-time approval → Payable/chargeable calculation**

Each stage has its own authority and state. The feature answers who checked in/out, when, how and against which specific duty. It does not prove that the person continuously worked, approve hours, decide pay, certify qualifications, or establish operational readiness. Attendance is neither availability nor an allocation response.

First slice: authenticated Staff self check-in and check-out, plus existing operational role oversight and attributable exception/correction actions. Store actual facts only. Do not add QR, NFC, location, biometrics, timesheets, breaks, payroll, client billing, push notifications or static attendance to this Event-first implementation.

Use synthetic examples only. No real personal or location data, no staging, deployment or provider connection. Existing synthetic SIA-to-role checks remain synthetic and unrelated to attendance permission.

## Identity and source adapters

Attendance belongs to one immutable allocation identity, not to a name, event label, Site or date string. One attendance aggregate/event model accepts a typed source reference:

| Source kind | Authoritative duty identity | Resolution |
| --- | --- | --- |
| `EVENT_ALLOCATION` | Existing `event_staff_allocations.id` | Join through its requirement and Event using current Event and allocation guards. Do not duplicate Event, requirement, role or shift fields as mutable authority. |
| `SITE_SHIFT_ALLOCATION` | Future allocation ID from `site_shift_allocations.id` | Resolve through exact `site_shift_demand_id` → stable `site_shift_demands.id` → Site Service → Site/Client relation. Confirm final field names against 08A's implementation and report. Do not bind directly to a mutable template line or Service. |

Use a database FK where both allocation sources can share a common allocation parent; otherwise use a discriminated source pair with database-enforced same-source foreign keys (for example, exactly one of `event_allocation_id` or `site_allocation_id`). Do not use unconstrained polymorphic text IDs. A common typed adapter/read contract must resolve the exact Person and duty context, enforce allocation state and expose a safe display projection. The Person must equal the allocation's Person. A reassignment, if later designed, is a new/corrected allocation operation governed by allocation policy; it cannot silently transfer attendance.

Do not create a parallel shift/person master or a second attendance system. Preserve one fact lifecycle for both source kinds. This Event-first implementation enables only the Event adapter and keeps the static adapter a documented future seam.

Cross-source Event/static Site clash and availability remain allocation/scheduling concerns owned by 06C/07A/08A. The 08A shared Person lock and cross-source guard are hard prerequisites before a static attendance adapter can be enabled. Attendance reads the final, exact allocation identity; it does not combine or override those policies. A SiteAssignment alone grants neither attendance nor workforce access.

## Keep the domains separate

| Domain | Meaning | Example display |
| --- | --- | --- |
| Requirement | Demand for a role and quantity at a time/place | 2 Stewards required |
| Allocation | Named Person assigned to one demand slot | Allocated to Sam |
| Staff response | Person's decision on that allocation | `ALLOCATED`, `ACCEPTED`, `DECLINED` under existing allocation policy |
| Attendance | Actual check-in/out and explicit factual exception records | Checked in 09:57; checked out 18:04 |
| Worked-time proposal | Reconciled time submitted for review, potentially adjusted with reasons | Proposed 7h 37m, pending review |
| Approved worked time | Explicit authorised decision on a proposal/revision | Approved 7h 30m by named reviewer |
| Payable/chargeable time | Separate finance calculation/rules, rates, breaks and adjustments | Out of scope; must not be derived or displayed by attendance |

Never rename `ACCEPTED` as attended/confirmed-to-work. A recorded attendance fact does not alter allocation response, requirement counts, eligibility, allocation capacity, deployment history or an approved timesheet. The Event's `COMPLETED` state also does not assert a given Person attended or worked.

## Minimal attendance lifecycle

Avoid a single mutable `EXPECTED / CHECKED_IN / CHECKED_OUT / NO_SHOW / EXCUSED / CANCELLED` state machine. Expected is derived from an active allocation and schedule. Allocation cancellation/decline remains in its own source. Excused and no-show are supervisor judgements, not sensor states. Keep a small attendance case with immutable fact events and derive its current factual summary:

- **No attendance fact yet** — active allocation exists; display “Not yet checked in” only while relevant. It is not a no-show and should not imply failure before a shift.
- **Checked in** — one accepted check-in event records actual instant, actor, method and server/database receipt time.
- **Checked out** — a matching accepted check-out records actual instant, actor/method and server receipt time. This does not establish worked duration or approval.
- **Exception recorded** — explicit attributable operational manager event such as `NO_SHOW_RECORDED`, `EXCUSED_ABSENCE_RECORDED`, `CHECK_IN_NOT_POSSIBLE`, or `REVIEW_REQUIRED`. These are facts about the manager's recorded decision/observation. A later explicit correction supersedes the derived current label while preserving history.
- **Correction recorded** — a typed append-only correction references the exact event/case and reason; current projection incorporates the correction and retains the original unaltered. Never edit or delete the original event.

A check-in after a recorded no-show is not silently accepted into a contradictory sequence. Require an attributable manager correction/resolution before the check-in enters the current factual projection. Preserve all prior events and show the case as requiring review until resolved.

Do not require a check-out to call a check-in valid; open attendance is a factual state. Do not infer check-out at scheduled shift end. Allocation cancellation after attendance starts must leave the facts and create a visible manager exception; the allocation lifecycle governs cancellation and does not erase attendance.

### No-show boundary

No check-in, a missed report time, a reminder threshold, failed device submission or elapsed schedule time is never enough to record `NO_SHOW`. It remains **Not yet checked in** / **No check-in recorded**. Only an authorised operational manager can record a no-show after confirming the applicable process, identifying the exact allocation/Person, supplying a reason and recording their own action time. No automatic no-show escalation is included. Any future escalation requires a separately approved policy, responsible recipient, grace/tolerance, evidence requirements and appeal/correction path. A no-show record is an explicit attributed operational record, not proof of misconduct or payroll consequence.

## Scheduled times and actual facts

Keep planned `report_at`, `shift_starts_at` and `shift_ends_at` from the exact allocation source. Store actual event occurrence time separately from `recorded_at`/database time. Record client/server time provenance and method; server receipt time is authoritative for audit ordering but must not overwrite an explicitly captured actual time. Reject malformed or implausibly future timestamps under a bounded clock-skew rule; retain a denied attempt only in security telemetry without exposing sensitive payloads.

Do not label early/on-time/late, punctuality or missed check-in until KSS approves exact role/source-specific thresholds, time zone and edge-case policy. The first slice stores the facts and can show planned and actual times adjacent. Use UTC instants for persistence and Europe/London for product display; service date and daylight-saving handling come from the source duty. Do not recompute a historical actual time from a changed shift or browser timezone.

## First check-in method and actions

Use only authenticated Staff self check-in/check-out for the first slice. The server resolves the actor from the active AuthIdentity → stable Person mapping; ignore browser-supplied Person and actor IDs. Staff can view and act on only their own allocation and current safe attendance summary. A self-action is permitted only while the allocation is in a policy-approved active state (initial proposal: `ALLOCATED` or `ACCEPTED`); declined/cancelled allocations and ended/unauthorised identities are denied. If KSS decides only `ACCEPTED` can check in, that is an approval decision before implementation.

A dual-role Office/Operations/Supervisor account cannot manufacture Staff self-check-in or check-out. Managers can record an explicit supervisor-observed check-in/out only as themselves, with actor type, exact allocation, actual observed time, method `SUPERVISOR_OBSERVED` and reason. Do not offer “check in as Staff”. Self-allocation prohibition in 06C remains.

Actions:

- Staff: view own allocated work/time/reporting point and own attendance facts; submit own check-in/out; request a correction using a reason; view pending/rejected correction status.
- Operations: view safe operational attendance summaries for authorised Event and, if approved, Site-service duties; inspect exceptions; record their own observation/no-show/excused event; resolve/correct only within the exact operational scope and reason policy. No private HR/profile/evidence/rate or payroll data.
- Office Admin: view the same safe operational data where current Event/Site operational source policy grants it; record/resolve factual exceptions only with explicit attendance supervisor capability and reason. Office's personnel, onboarding or finance access does not arise from attendance.
- Designated supervisor: must have an active explicit attendance-supervisor capability scoped to an authorised source record or operational area, with action and time limits. A role label such as `Stand Manager` is a work role and never application permission. Do not infer supervisory authority from allocation to a particular operational role.
- Super Admin: audited oversight and correction access under the same record/action guards; no unlogged proxy self-actions.

Initially do not invent a broad “all supervisors” role or infer exact site/team delegation. If current role/scope records cannot express an explicit supervisor authority, only existing narrowly authorised Operations/Office actions can be proposed; implementation must stop pending an approved authority model rather than treating a work title or SiteAssignment as permission.

Staff never gets peers from a shared requirement/allocation. Manager projections return the minimum identity needed for assigned operational oversight and never reveal protected Person data. Every read and action re-checks active role, source scope, exact allocation, allocation-to-Person binding and current source state server-side and in RLS/guarded DB routines.

## Correction and immutable lineage

All accepted facts are append-only, attributable events. Record at minimum: stable event ID, source kind and exact allocation ID, subject Person ID resolved from that allocation, actor Person/auth identity, event type, captured actual instant (nullable only for correction metadata), server/database `recorded_at`, input method, reason/correction link, idempotency key, and source/allocation revision observed. Preserve original payload/version and actor; never update or delete accepted records through ordinary client access. A correction inserts a new typed event referencing exactly the original event and case, with old fact reference, corrected fact/value, reason, correcting actor and database time. A rejected request records no business attendance fact; security logs should be minimal and must not retain unnecessary location/device data.

Original `actual_at` remains readable in authorised history. The current projection applies only valid corrections in the same allocation stream; corrections cannot retarget another allocation or Person. Multiple concurrent correction attempts use an expected case revision and a row lock; one wins and the other receives a stale-revision response. A later correction may supersede an earlier correction only with explicit lineage. Ordinary service clients cannot write attendance tables/events/audit rows directly.

## Concurrency and idempotency

Enforce at database transaction boundary, not only in UI:

- One first check-in per allocation case, one compatible check-out after it, and one active unresolved factual exception of each policy-defined kind unless an explicit correction supersedes it.
- Unique `(actor, idempotency_key)` or stable client operation key scoped to allocation/action; retries return the exact prior result without duplicate check-in, checkout or notification source event.
- Row-lock the attendance case and recheck allocation/person/status/revision before append. Use a deterministic lock order compatible with allocation/event/site-demand guards; document it against 06C and any approved 08A allocator lock order.
- Simultaneous Staff and supervisor check-in: first valid transaction records the fact; the loser gets the current fact and a conflict requiring deliberate review, never a second check-in. Two supervisors recording conflicting outcomes serialize; the second must review current state and use correction flow if needed.
- Check-out without a matching check-in, repeat action with a different key, stale correction revision, allocation cancelled mid-request, or source/Person mismatch returns a safe conflict and no contradictory write.
- Avoid automatic history deletion or retry with a changed timestamp. A client retry must preserve the same idempotency key and captured timestamp.

## Manager live operations view

Add a live Event and static Site service attendance panel by composing authorised source allocations with attendance facts. Show factual, separately labelled counts: active allocations expected in the selected time window; checked in; checked out; not yet checked in; exception recorded; correction/review pending. State the filter/window and the denominator. Do not use “present”, “late”, “no-show”, “working”, “covered” or “complete” unless the corresponding fact/policy supports it. In particular no automatic no-show bucket; an explicit supervisor-recorded no-show may be shown as that exact recorded event.

Filter by source, Event or Site Service, service date, shift and safe status. Counts and rows must share one authorised, transactionally consistent source set and snapshot. No client-side filtering that leaks hidden rows through totals. A manager may open an exact allocation and see planned times adjacent to actual check-in/out, actor/method, exception and correction history. Minimise peer visibility to managers with operational source authority; Staff views remain strictly self-only. Do not include raw notes, phone/address, protected personnel evidence, availability notes, pay/charge rates or payroll values.

At 390px staff layout: own assignment name, Site/reporting point, planned reporting and shift times, response state, factual attendance state, and one large context-sensitive **Check in** / **Check out** button. Confirmation states show the actual time, saved/pending/error status and an explicit retry/review action. Prevent double taps with in-flight UI disablement plus server idempotency. Confirm the exact assignment before action where the Staff has overlapping display dates, while the backend still enforces exact allocation identity. Use the existing iOS-inspired shadcn blue/graphite/neutral system; no green.

## Offline and recoverable errors

Do not queue an untrusted offline attendance claim as if accepted. If network is unavailable, clearly say the check-in/out was not recorded and offer retry; retain the same idempotency key and captured time for an explicit retry within a bounded short session. The authoritative database receipt time remains separate. On reconnect, re-read exact allocation/current attendance revision before retry. If another actor recorded a fact, display the resulting current state and ask for supervisor review rather than silently overwriting it. No offline badge/QR cache is part of the first slice. Generic errors must not disclose whether another Person's allocation exists.

## Data and authorisation proposal (not implementation)

Prefer a shared `attendance_cases` 1:1 per source allocation and append-only `attendance_events`; an alternative single append-only event table with a transactionally derived projection is acceptable if integrity and list performance are proven. The case is a concurrency/current-summary anchor, not a second schedule. Suggested fields:

- `attendance_cases`: UUID, typed exact source allocation FK/pair, source kind, allocation-bound Person, monotonic revision, derived current factual stage, created/updated database timestamps and actor provenance. No independently editable Person, Event, Site, scheduled-time or work-hour authority.
- `attendance_events`: UUID, case/allocation FK, typed event kind (`CHECK_IN`, `CHECK_OUT`, `NO_SHOW_RECORDED`, `EXCUSED_ABSENCE_RECORDED`, `CHECK_IN_NOT_POSSIBLE`, `REVIEW_REQUIRED`, `CORRECTION`), captured actual instant when applicable, database `recorded_at`, authenticated actor, method, controlled reason and minimal optional explanation, exact corrected-event reference and idempotency key. Immutable after insertion; one case revision order.
- Private guarded database functions for self read/action, authorised manager projection, supervisor observed action, exception and correction. Fixed search path, authenticated identity resolution, exact source joins, role/scope checks and explicit output fields. Server route repeats capability/scope checks. RLS denies direct broad table access and all client writes; privileged service credentials stay server-only and do not bypass business guards.
- Reuse generic `audit_events` for privileged access/configuration as appropriate, while typed attendance events remain the factual business history. Avoid duplicating every self-action into redundant timelines if the immutable typed event already supplies attribution; record sensitive manager correction/oversight access where policy requires.
- Index by source allocation, case/revision and authorised source/date path; do not add mutable counts or readiness caches. Keep source resolution as one of two explicit adapters. Count/page reads should use one bounded query/snapshot; ordinary direct filters must not permit source widening.

The Event allocation field/state names are implemented against the accepted schema. The static field/state names remain a future seam and must use the verified 08A schema before any static adapter is enabled.

## Worked-time, breaks and Finance seam

Do not calculate worked hours by subtracting check-in from check-out in this slice. That interval can include breaks, travel, gaps, errors or supervised non-work. Do not store `worked_minutes`, approved hours, payable status, billable hours, rates or totals in attendance. A later timesheet/worked-time proposal should reference exact allocation ID and attendance event IDs/revisions as evidence, record a separately attributable proposed interval/adjustment and approval decision, and preserve the distinction between raw attendance and submitted/approved time. Corrections to attendance after a proposal must flag the linked proposal for review without silently changing approved hours. The finance task (TASK-10A, when its owner/contract is known) must define payability, chargeability, breaks, rates, rounding, authorised approvers and source/version binding separately. No cross-task finance schema or calculation is specified here.

Breaks are deferred unless KSS requires break events for accurate operational safety in the first attendance slice. Any later break event still does not itself settle payable time.

## Notifications seam (08B coordination)

TASK-09A sends nothing. If a future 08B producer is approved, it must follow 08B's closed, versioned event registry and producer contract: exact source identity, committed immutable event/revision, allowed cause transition, deterministic recipient resolver version, safe template/typed parameters, and dedupe identity. An attendance event UUID is the preferred source event identity; otherwise use a guarded durable event ledger in the same transaction, never wall-clock time. No caller-supplied recipient, body, URL or payload JSON. Recheck source state and exact recipient at dispatch and suppress stale queued events when the allocation is cancelled or recipient authority expires.

Candidate future kinds discussed with 08B: `CHECK_IN_REMINDER` to only the exact Staff Person on the allocation, only after a separately approved time threshold and scheduler; `ATTENDANCE_EXCEPTION` or `SUPERVISOR_ATTENTION` only to an explicit exact operational recipient under an approved resolver. 08B's current proposal says no attendance kinds are registered until 09A is reconciled, and its first in-app source still requires David's choice; this proposal does not select attendance as that source. Missed check-in alone cannot create no-show. Any escalation from a threshold is a separate policy and event transition, not an attendance mutation inferred from time. Payload must exclude private HR, finance and location data. No failed/uncommitted action emits an event, and no notification is sent in this proposal.

Coordination sent to TASK-08B task `01a0d33b-d06d-7f83-8116-caa573b48368` on 24 September 2026. Its proposal was updated to require 09A reconciliation before registering attendance kinds and uses committed source event identity, a controlled kind/version, deterministic exact recipient resolution, source recheck at dispatch and no arbitrary recipient/payload. Align to any David-approved 08B delivery contract before implementation; neither proposal authorises a producer or send.

## Synthetic approval proof and security test matrix

Use synthetic Event allocations for this Event-first implementation. The implementation report records which parts of the proof matrix passed and which browser/build/regression checks remain outstanding. Static adapter proof is deferred until the adapter is implemented.

Negative proofs required before any implementation acceptance:

- Staff A cannot enumerate allocations, cases, attendance or corrections for Staff B, even with guessed Person/allocation/case/event UUIDs, URL parameters or modified actor payloads.
- Staff cannot use a manager/supervisor route, switch Person ID, act on a peer's shared requirement, or continue after Auth mapping/Staff role expiry.
- Office/Operations without exact active source scope cannot read rows/counts/exceptions or mutate facts. SiteAssignment and work role labels alone cannot grant attendance permission. Super Admin reads/actions are audited and scoped.
- Cross-source ID substitution (Event ID for static allocation or reverse), mismatched Person, mismatched source allocation, cancelled/declined/terminal source, Event/Site scope change and stale allocation revision all deny without existence leaks or partial writes.
- Ordinary authenticated users cannot insert/update/delete cases, facts, corrections, audit rows or outbox rows directly or through guessed RPC parameters. A service key cannot bypass business checks.
- Check-out before check-in; duplicate conflicting check-in; concurrent duplicate requests; concurrent supervisor/self actions; stale correction; duplicate key with altered payload; retry after a committed-but-lost response cannot create contradictory or duplicate facts.
- Elapsed schedule time, missing device/network, reminder, failure to check out or no check-in never writes NO_SHOW, absence, worked time or a payroll consequence. Only explicit authorised actor creates a no-show fact.
- Corrections preserve original captured time, actor, Person, allocation, method and database timestamp; correction cannot retarget or erase. Managers cannot impersonate Staff.
- Rows, counts, pagination, errors and timing do not reveal peers/private People/Profile/SIA/evidence/CRM/pipeline/availability/pay data. Operations cannot use attendance to expand into private personnel or finance records.
- Attendance writes cannot alter allocation response, requirement capacity, availability, Site/Client/Event state, staffing status, Tasks, timesheets, payable/chargeable calculations or notifications before an independently authorised adapter.
- No green styling; mobile buttons prevent repeated submission; offline failure is explicit and never shown as accepted; event source adapters preserve Event/static clash separations.

Relevant regressions should include 06C stable allocation, response/cancel rules; 07A availability separation; 07B schedule projections; approved 08A identity/clash source if available; and Finance/timesheet read-only separation once TASK-10A is specified. Implementation report must distinguish source checks, authenticated browser evidence and database/RLS evidence; synthetic tests do not establish production readiness or human acceptance.

## Implementation boundary

This file records the approved scope and implementation decisions. It does not claim completion; see [TASK-09A-REPORT.md](TASK-09A-REPORT.md) for actual implementation and verification evidence. Worked time, payroll, location, QR/NFC, offline attendance, attendance notifications and staging remain outside this task.
