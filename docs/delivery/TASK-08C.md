# TASK-08C proposal — Static Allocation Action Centre

**Status: ACCEPTED — SYNTHETIC DEV.** David formally accepted the bounded TASK-08C implementation on 24 September 2026. Implementation evidence is recorded in [TASK-08C-REPORT.md](TASK-08C-REPORT.md). Staging, deployment and real-data use remain outside this acceptance.

## David's acceptance — 24 September 2026

The accepted slice is the immutable initial Site Shift `ALLOCATED` event → one idempotent, exact-Person in-app Action Centre notification → independently reauthorised `source=SITE_SHIFT` focus in My Deployments. Event and static sources remain explicitly typed and isolated. Read and dismiss affect presentation only; Accept/Decline remains solely in guarded My Deployments. Cancelled or inactive allocations retain truthful notification history without an active response action.

David accepted the three synthetic Dev migrations and readback, concurrent replay and single-history proof, the focused 08C test, existing 08B and 08A regressions, lint, Webpack build, and authenticated desktop/390px browser proof. Existing project-wide advisor findings and pre-existing Event-source notification-history FK index findings do not block this acceptance; the new static FKs have covering indexes.

This acceptance authorises no other static notification kind, Task, external delivery channel or provider, scheduler, card-level response, staging, production, or real KSS data. The implementation lane stops here.

## Scope and outcome

When a static Site shift allocation commits, create exactly one informational in-app notification for the exact Staff Person bound to that allocation. Present it in the existing Action Centre. Its open link goes to the exact static allocation in existing My Deployments, which reloads current data and authorises access independently. Staff accept or decline only on My Deployments, through the existing guarded 08A response operation.

First slice is limited to the immutable `ALLOCATED` event for a newly created static allocation (`old_status IS NULL`, `new_status='ALLOCATED'`, `new_revision=1`). Do not notify on template generation, horizon refresh, demand change, allocation response, cancellation, retry, availability, attendance, or staffing gaps. There is no Task, card-level Accept/Decline, email/SMS/push, external provider, scheduler, preference, group audience, or second notification store.

The event is informational and never claims acceptance, attendance, work, eligibility, payability or compliance. Notification read/dismiss changes only that recipient's presentation state. The exact action remains on the current allocation page.

## Inspected source contracts

08A's delivered report records acceptance at `40277b7`. The exact source is:

- `public.site_shift_allocations`: stable UUID `id`; exact `demand_id`, `person_id`, status and monotonic `revision`; allocation creation starts in `ALLOCATED`, revision 1.
- `public.site_shift_allocation_events`: immutable UUID `id`; exact allocation, demand and Person; typed `kind`; old/new status and revision; actor and `occurred_at`; unique `(allocation_id,new_revision)`. The initial event is `ALLOCATED`, old status null, new status `ALLOCATED`, revision 1.
- Allocation and event writes are guarded; authenticated users have no direct table write grant. `site_shift_allocate` verifies demand/service, capacity, person and shared cross-source conflict authority, and appends allocation plus history within one transaction. The candidate work-title/availability checks do not grant notification recipient authority.
- Demand and allocation IDs remain stable through reconciliation and response. Cancellation appends `CANCELLED` history. Current projections join demand → service → Site and role. The source contract is materially compatible with 08B's immutable source-event identity, exact recipient, closed event and source-authoritative deep-link model.

08B's delivered implementation is narrower than its overall architecture: `staff_in_app_notifications.source_allocation_event_id` currently has an Event-only FK, its history table has the same Event-only FK, and the check constraint admits only `DEPLOYMENT_CREATED`. It explicitly has no static producer. The architecture is compatible; the schema needs the additive extension below. Preserve existing Event rows and behaviour. Do not replace this with a generic polymorphic registry, outbox, parallel Action Centre, or new source-owned notification lifecycle.

## Proposed source event and idempotency contract

Use `site_shift_allocation_events.id` as the immutable event identity. A private trigger/function on insert accepts only the exact initial transition described above. In the same database transaction as `site_shift_allocate`, it validates all of the following before deriving the recipient:

1. The event's allocation ID, demand ID and Person ID match the joined source rows.
2. The allocation is still revision 1 and `ALLOCATED`, its `person_id` equals the event `person_id`, and it points to that exact demand.
3. The demand belongs to one exact Site Service and its role/date/times are available for the safe current projection; the service is linked to the same Site through its accepted composite identity.
4. The event is an immutable committed initial `ALLOCATED` transition, not a caller-supplied ID, changed row, later revision, reconciliation event or replayed arbitrary payload.
5. Recipient is derived exclusively as `allocation.person_id`. No request parameter can set recipient, kind, template, text, URL or payload.

Logical identity is `(source='SITE_SHIFT', source_allocation_event_id, recipient_person_id, notification_kind='SITE_SHIFT_ALLOCATION_CREATED')`. Enforce one row per source-event and one initial notification per allocation/type with database unique constraints. Under concurrent trigger/replay, `INSERT ... ON CONFLICT` returns the existing logical notification and writes no second `CREATED` history event. Any replay must compare and validate the stored allocation and Person binding against the source event before returning the existing ID. No generated request UUID, mutable demand revision, wall-clock timestamp, or caller idempotency key participates in identity.

The source event and notification insert are one transaction: allocation failure rolls both back; a notification constraint failure fails allocation rather than committing an unnotified allocation. No queue or delayed dispatch is added, so a committed notification is not later silently suppressed as a send attempt. If an initial allocation is subsequently cancelled, the notification remains immutable history and its current projection says it is no longer active. If a demand or Service is later cancelled/ended under its separate guarded path, deep-link authorization and current projection expose only the safe terminal state and never revive or retarget the allocation.

## Reuse of 08B storage and migration impact

Use a forward, source-controlled migration extending only the delivered 08B tables and guarded producer/projection path. Do not edit the already delivered migration or backfill existing rows.

- Add nullable `site_shift_allocation_event_id` with FK to `site_shift_allocation_events(id)` to both `staff_in_app_notifications` and `staff_in_app_notification_events`.
- Retain `source_allocation_event_id` for existing Event rows. Add a constraint requiring exactly one of the Event or static source-event IDs on each row. Existing Event rows remain unchanged. Verify and preserve current Event uniqueness; add unique static source-event identity and the static allocation/type uniqueness analogue. Expand the closed kind check to include only `SITE_SHIFT_ALLOCATION_CREATED` alongside the existing `DEPLOYMENT_CREATED`.
- The static insert binds `allocation_id` to `site_shift_allocations.id` and recipient to the immutable event's `person_id`. Because the existing common `allocation_id` has an Event FK, add a nullable `site_shift_allocation_id` and enforce exactly one source allocation ID as well; preserve existing Event allocation IDs and FK. This maintains explicit referential integrity rather than overloading UUIDs across source tables.
- Extend notification history with the same typed nullable static event/allocation pair and XOR checks. Keep `CREATED`, `READ`, `DISMISSED`, exact actor and database time semantics; make history immutable. Read/dismiss updates remain through the existing guarded RPC and append one history row on first transition only.
- Add the private static producer function and `AFTER INSERT` trigger on `site_shift_allocation_events`, with no authenticated execute grant. Apply fixed empty `search_path`, exact source joins, closed transition/template, bounded safe output, RLS enabled, no direct authenticated table grants, and no service-role bypass of business validation.
- Extend the current self-only Action Centre RPC to safely union Event and static rows, binding actor `auth.uid()` → active AuthIdentity → stable Person, active `SECURITY_STAFF` role, exact recipient and exact source event/allocation/demand chain. Keep section filters, counts, ordering, pagination and current-state projection consistent over that authorized union. Recheck identity/scope on every read and presentation mutation.
- Add an additive typed focused-read RPC for both allocation sources; preserve the existing 08A RPC and its no-focus union, counts, limits and source discriminator. The route accepts an exact allocation UUID, but the shipped 08A SQL currently includes static rows only when `p_focus IS NULL`; the implementation must add exact static focus and pass the explicit `SITE_SHIFT` source discriminator from the Action Centre link. It must not accept a static demand or Event ID in place of an allocation ID.

No new notification architecture or channel tables are required. No static notification history backfill: existing static allocations predate this producer and receive no retroactive item. Migration must be additive and preserve every existing Event notification, state, history ID and unique rule. If this forward shape cannot preserve existing Event constraints and function signatures without destructive rewrite, stop and return for contract review.

## Safe content and exact views

Persist only the typed source IDs, exact recipient, closed kind/template, safe template parameters if required (none preferred), and created/read/dismissed timestamps already used by 08B. Do not snapshot arbitrary source JSON, free-text reason, availability note, personnel evidence, profile/SIA data, phone/address, CRM details, provider data, credentials or private comments. The minimal card text is: **“A Site shift has been allocated to you. Review the current details in My Deployments.”**

The authorized server projection may return current Service name, Site name, operational role label, service date, reporting point, area, report time, shift start/end, allocation status, current demand state and current message. Include only if each value is already safe in the current Staff own-allocation projection; never expose the Service owner or Client pipeline/contact/private data. Persisted notice content never substitutes for that projection.

Link only to `/my-deployments?allocationId=<exact site_shift_allocations.id>`. The existing Action Centre has Unread, Requires action, Recent and Dismissed/history. Static items appear in the same sections/counts and use a source label such as “Site shift”. `Requires action` derives from current allocation `ALLOCATED`, current planned demand and applicable active source state, not unread state. Accepted/declined/cancelled or otherwise stale items remain available in history with truthful current wording. Dismissing does not remove or alter the allocation and does not authorize future access.

The deep link authenticates afresh and performs exact self authorization: current actor maps to the active Staff Person, allocation `person_id` is that Person, source kind is static, and allocation→demand→service→Site joins are intact. Load current status/revision/source state; never trust a notification's saved title/status or the URL UUID alone. If source was cancelled, changed so it is no longer actionable, relationship is stale, role/identity expired, or access is otherwise revoked, deny source detail or show the existing generic no-longer-available state without revealing whether another Person's record exists. A currently authorized recipient may see the terminal allocation as history. Accept/Decline stays on the existing static My Deployments row and invokes 08A's guarded endpoint with current expected revision.

## Authorization, integrity and direct-write denial

- RLS stays enabled for both 08B tables; revoke all direct `PUBLIC`, `anon` and `authenticated` read/write privileges. Authenticated access is limited to the existing narrow RPCs; private producer/trigger routines are not callable by clients.
- On Action Centre read and read/dismiss change, bind `auth.uid()` through the active identity to the stable Person, require current Staff role and exact recipient equality. Never accept a Person/recipient/source kind from browser input. Operations/Office access to Site Services does not grant access to Staff notification rows.
- Validate same-source event/allocation/demand/Person and demand/service/site identity on insert and every projection. Reject cross-source UUID substitution, mismatched recipient, missing FK chain, invalid initial event, or unsupported kind/version. Database constraints are authoritative; route checks are additional.
- Deny authenticated direct insert/update/delete against notification and notification-history rows, including guessed IDs and direct REST access. Triggers reject modification/deletion of immutable identities/history; only the guarded in-app presentation operation may set read/dismiss and append its attributed history event.
- Keep event producer privilege narrowly scoped. A service key or SECURITY DEFINER function must not bypass source validation or act as an arbitrary-recipient insertion route. Use fixed `search_path`, schema-qualified objects and database-derived actor/time.
- Read/dismiss races serialize on the notification row. Repeated same action is an idempotent no-op and must not append duplicate presentation-history rows; incompatible or unauthorized actions fail without side effects. Notification state does not change allocation revision/status, demand state, Task state or any source history.

## UI proposal

Reuse the current Action Centre navigation, section tabs, count badge, cards, pagination, error/retry and presentation-only Mark read/Dismiss actions. A static card names “Site shift”, shows the current safe Service/Site/role and London report/shift times, states whether response is required or the allocation is no longer active, and offers one **Open in My Deployments** link. It has no Accept/Decline controls. Mark read and Dismiss use existing endpoints and their own status announcements.

On My Deployments, render the exact focused static allocation with source clearly labelled “Ongoing Site shift”; preserve its existing Accept/Decline actions and current source checks. A cancelled/stale allocation appears with its current status and no active response action. No static detail is inferred from a same-UUID Event row; source identity is explicit.

Desktop: maintain the current readable content column, four sections/counts, safe card details and distinct action controls; avoid adding a dense source table. At 390px: cards stack into one column, dates wrap without horizontal scrolling, Open remains a clear 44px-minimum target, and state is conveyed by text/icon as well as colour. Use the existing iOS-inspired shadcn blue, graphite and neutral palette; no green. Maintain heading order, visible focus, keyboard access, descriptive link names, live status for save/error results, and adequate contrast. Do not alter another worker's UI files until its owner confirms the feature contract and ownership.

## Acceptance proof plan (for a separately approved implementation)

### Positive synthetic cases

- Create one static allocation through `site_shift_allocate`; assert one immutable initial history UUID and exactly one Action Centre notification for that event and exact Staff Person.
- Replay the private producer twice sequentially and concurrently for the same committed event; assert same logical notification ID, one row, one `CREATED` history entry. Replay a distinct revision/event and assert it creates no second creation notification.
- Staff recipient sees the item in Unread, Requires action and Recent with correct counts and source label; current safe Service/Site/role/date/times and exact My Deployments link are returned.
- Mark read and dismiss through the authenticated route; assert the per-recipient state/history updates once and source allocation, demand, Tasks and other recipients remain unchanged. Retry each action; assert idempotent result.
- Open exact deep link; verify My Deployments displays that exact static allocation, responds through the existing source-specific guarded operation, and reflects current state after refresh. A notification remains informational throughout.
- Cancel the allocation after notification creation; read the Action Centre and deep link as the recipient; assert retained historical item, current cancelled wording, no accept/decline action, and immutable notification/source history.
- At desktop and 390px inspect Action Centre and My Deployments for exact content, focus/keyboard and target sizing, no horizontal overflow, accessible status and no green. Use synthetic fixture names only.

### Negative, security and race cases

- Staff B cannot read Staff A's item, count, current source projection or deep link; test guessed notification, event, allocation, demand, Service and Person UUIDs and cross-Person URL/payload substitution.
- Expired/revoked AuthIdentity or Staff role denies Action Centre and My Deployments even with a retained notification. Operations, Office and Super Admin do not inherit this Staff self-view through their operational role.
- Direct authenticated SELECT/INSERT/UPDATE/DELETE on both notification tables and event history is denied. Caller cannot execute private producer or provide recipient, kind, title, preview, deep link, payload, actor or source JSON.
- Reject invalid source kind, wrong initial event transition, later revision, mismatched allocation/demand/Person, Event/static ID substitution, broken demand/service/site relation, cancelled/declined allocation at creation, stale/replayed forged event, and unknown template. No partial source or notification write.
- Race two producer calls and a presentation mutation against one event; exactly one notification/CREATED event and one READ or DISMISSED history transition result. Verify failed allocation rolls back its notification and producer validation failures cannot leave notification-only rows.
- Change/cancel current source after creation; projection uses current state, cannot retarget recipient, and cannot restore a cancelled allocation. Stale IDs and denied routes reveal no existence via response body/count/timing distinctions.
- Assert notification read/dismiss never accepts/declines/cancels allocation, creates a Task, mutates attendance/worked time/payroll, or affects Event allocation rows. No external channel call or real data is present.

### Evidence/report requirements

The implementation report must separate SQL constraint/RLS/direct-write evidence, authenticated API/browser flows, idempotency/concurrency readback, existing Event notification regression, My Deployments source-union regression, and desktop/390px accessibility evidence. Record known suite failures without attributing them to this task. No local or synthetic evidence proves human acceptance, staging access, live eligibility or production readiness.

## Implementation boundary

The approved slice covers only the additive migration and guarded static `ALLOCATED` producer, Action Centre union/projection, exact static My Deployments focus, UI rendering and synthetic integration/browser proof described above. No other event kind is registered and 08A source semantics remain unchanged. The implementation report records checkout coordination, migration versions, actual checks, evidence gaps and the acceptance boundary.
