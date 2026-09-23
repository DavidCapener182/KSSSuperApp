# TASK-05B — Operational CRM proposal

**Status:** Proposal for David's approval. TASK-05A is accepted at `eab0192`. No 05B implementation, migration, fixture, staging change or deployment is authorised by this document.

## Goal and boundary

Make the accepted Organisation → Contact → Opportunity CRM usable for daily Office work through a visual pipeline, attributable activities, accountable follow-ups and a curated timeline. Keep the 05A Organisation, Contact, Opportunity, ownership, transition and Prospect → Client rules authoritative. Existing Sites stay unlinked. No email or tender portal integration, forecasts, campaigns, contracts, Client/Site/Event model or automatic Task per Opportunity.

## Decisions for this slice

| Area | Proposed rule |
| --- | --- |
| Active board | Five open-stage columns: New Lead, Contacted, Qualified, Proposal / Tender, Negotiation. Won and Lost appear in a separate Closed view/filter, with counts; closing remains available through the guarded 05A transition. This keeps daily work visible without terminal cards crowding it. |
| Movement | Drag/drop calls the existing guarded 05A stage transition. Forward skips are valid; a backwards drop opens a required-reason dialog; Won needs confirmation and Lost needs a reason. The board refreshes from the server after the result. Keyboard-accessible stage controls invoke the same operation. Terminal stages cannot move. |
| Activities | Immutable, manually entered, typed commercial business records. Editing or deletion is not offered in 05B; a correction is a new attributable activity referring to the prior record, if needed. No automatic ingestion of email content. |
| Follow-ups | An `OPEN` Task in the existing `tasks` table, linked to exactly one CRM Opportunity or Organisation. A task is created deliberately, never because an Opportunity exists. It is the source for next action and due status. |
| Task completion | Only changes the Task to `DONE` and records actual actor/time. It does not create an activity, move the pipeline, or mark Won. The curated timeline includes the Task lifecycle directly. |
| Opportunity owner change | Leaves existing open CRM Task assignees untouched. Show them in a review prompt; authorised Office may explicitly reassign selected Task IDs with a reason. No cascading or rewriting completed work. |

## Kanban and daily CRM experience

The pipeline reads the existing seven controlled 05A stages and applies server-authorised filters before pagination/counts: My Opportunities, All Opportunities, type, owner and Organisation. Each active card shows title, Organisation, owner, optional estimated GBP value (labelled **estimate**), expected decision date, optional primary Contact and the earliest open follow-up. Due, upcoming and overdue labels appear only when a real due time exists. No win probability or forecast is invented.

At desktop widths, render five restrained blue/graphite/neutral columns with readable cards, clear empty states and drag targets. Provide a visible stage action menu for keyboard, touch and non-drag use. On a 390px screen use a stage selector plus stacked cards, not a seven-column horizontal board. The Closed view shows Won/Lost history without reopening controls. Loading, failed transitions and concurrent updates show a truthful status and refresh; a failed drop never persists as an apparent successful stage change.

The CRM Overview gains only sourced operational summaries: CRM Tasks due today, overdue Tasks, open Opportunities without a future open follow-up, and upcoming expected decision dates. The last category remains a decision-date view, not a promise or forecast. Search, board cards, counts and filters share the same Office/Super authorisation predicate and bounded pagination. An Opportunity with several open Tasks shows one deterministic primary next action (earliest `due_at`, then creation time and ID; undated Tasks last) and a count of other open follow-ups. With none, show **No follow-up planned**, not an editable shadow field.

## CRM activity model

Add `crm_activities` with stable UUID, `organisation_id`, nullable `opportunity_id`, nullable `contact_id`, `actor_person_id`, controlled `activity_type`, bounded `subject` and optional bounded `summary`, database `occurred_at`, and optional `corrects_activity_id` for an explicit correction. Initial types: `PHONE_CALL`, `EMAIL`, `MEETING`, `NOTE`, `TENDER_UPDATE`, `PROPOSAL_SENT`, `FOLLOW_UP`. These describe manually logged activity; `EMAIL` does not imply an Outlook/Gmail sync or message delivery proof. `PROPOSAL_SENT` is a user-recorded claim, not a verified dispatch. Text is plain, length-limited, sanitised for display and unavailable to non-CRM roles. No email bodies, attachments or bulk notes import.

The database must check that any referenced Opportunity and Contact belong to the same Organisation as the activity. `actor_person_id` and timestamp come from the authenticated database context, not client input. Ordinary clients cannot update/delete activities or write another actor's record. If a correction is entered, preserve both records and present the link in the timeline. A manually logged activity may offer **Create follow-up** as a separate, deliberate action; the activity itself is not a Task and its optional date cannot become a second competing source of due state. For 05B, a follow-up date is held by the Task only.

## Existing Task integration and schema conflict

The current `tasks` table is one shared Task system, but its constraints, `private.guard_task`, `tasks_read` policy, and TypeScript `resolveTask` recognise only `DOCUMENT_REVIEW` backed by `DOCUMENT_VERSION`. Document-review completion is tied to an exact `document_reviews` event; `CANCELLED` currently has the specific reason `ONBOARDING_CASE_CANCELLED`. `task_assignment_changes` is also tied to an onboarding ownership event. Therefore a CRM task **cannot** be added by simply inserting another `source_kind`. A narrow, explicit forward migration must extend each of those guards and readers by source branch while preserving the document branch byte-for-byte in behaviour. If implementation inspection finds this impossible without relaxing document protections or replacing the Task model, stop before migration and return the exact conflict.

Proposed `task_type = CRM_FOLLOW_UP` with `source_kind = CRM_OPPORTUNITY` or `CRM_ORGANISATION`; `source_id` is the exact corresponding CRM UUID. Retain `unique(source_kind,source_id)` only for document versions; CRM needs multiple follow-ups per source, so replace that uniqueness with a partial unique index for `DOCUMENT_VERSION`. Add only Task fields needed for CRM: nullable `due_at timestamptz`, bounded title for CRM, `created_by_person_id`, and source-specific terminal metadata for `CRM_MANUAL_COMPLETION` and `CRM_MANUAL_CANCELLATION`. The existing document title, automatic creation, review-linked `DONE`, onboarding cancellation and history must keep their exact checks. Do not create a second CRM Task table or generic unvalidated source IDs.

The CRM adapter validates the exact source table and active Office/Super CRM authority at creation, read, reassignment, completion and cancellation. Task assignee must be an active Office/Super Person; Opportunity owner and Task assignee may differ. An Organisation-linked Task is allowed when there genuinely is no Opportunity, and the form explains that choice. Task creation stores authenticated creator and database time. A CRM Task title is a short action (for example, “Call about synthetic festival enquiry”), not a freeform email dump. Source UUID and assignee IDs are never blindly trusted from the browser. Document-review tasks remain automatically source-created and cannot be manually completed via CRM controls.

Add an immutable typed CRM Task lifecycle/assignment event record, or a narrow source-specific extension to the existing assignment history, storing Task ID, event kind, prior/new assignee or state as applicable, actor, reason where required, and database time. Reassignment of an `OPEN` CRM Task requires an explicit authorised operation and reason; completion records the actual actor, not merely the assignee. The assignee normally completes their own Task; Super Admin may perform an explicit audited administrative cancellation/reassignment, but may not impersonate a completion. Completed/Cancelled Tasks cannot be edited or reopened in 05B. Cancellation requires a reason and does not imply a sales outcome. Preserve every earlier Task event. No direct client writes to Task state, history or audit.

Use an optional `due_at` absolute timestamp entered as a local Europe/London date and time, converted server-side and stored as `timestamptz`; ambiguous/nonexistent DST local times require validation rather than silent reinterpretation. An undated Task has no due/overdue label. **Overdue** means an open Task with `due_at < now`; **Due today** and **Upcoming** use the viewer's Europe/London calendar date. These are display classifications, not SLAs. A Task can be rescheduled only through a guarded explicit edit with typed old/new due-time history; completed Task due dates remain historical.

`My Work` adds a discriminated CRM task card/detail branch and exact source link, retaining its document-review branch. The 05A CRM page may show related Tasks and create them, but there is no second CRM inbox. My Work shows the assigned Office person's active CRM Tasks; Office users can also see CRM-linked Tasks in CRM under their general 05A commercial authority. An Opportunity ownership change does not rewrite Task assignees; the UI identifies open Tasks still assigned to someone else and offers a deliberate individually listed reassignment action. Role expiry removes an actor's CRM/Task authority immediately; an orphaned open Task remains visible to authorised Office/Super in CRM for reassignment.

## Timeline and Organisation context

Opportunity detail combines, in a curated reverse-chronological timeline, existing typed stage/owner/value events, 05B activity records, and CRM Task create/reassign/reschedule/complete/cancel events. Show actor, database time, concise event label and permitted summary, with bounded pagination and deterministic ordering. No raw `audit_events` JSON. Task completion is labelled **Follow-up completed**, not a call/email/proposal event. An Organisation activity view may combine its own CRM activities, linked Opportunity history and Task lifecycle; Contact-added metadata may appear only if a safe authoritative event exists. Contact business email/phone never enters generic event payloads. Avoid an unbounded cross-Organisation feed.

## Authority and data boundaries

Active `OFFICE_ADMIN` and `SUPER_ADMIN` retain organisation-wide CRM visibility and guarded commercial actions. `OPERATIONS`, `SECURITY_STAFF`, anonymous and unmapped users receive no CRM activity, pipeline or CRM Task source data. Active Office/Super role is checked on server and in database/RLS for list, count, guessed-ID read and every mutation. Role expiry immediately removes authority. CRM ownership means accountability, not exclusive visibility. Direct Task reads must not expose a CRM source to a user without CRM authority, even if they can access a different Task type. CRM links do not grant Staff Profile, onboarding, private Documents or Storage rights. CRM Contact-to-Organisation and Activity-to-Contact/Opportunity relationships are exact and database guarded.

Read grants and RLS must return only authorised CRM rows; mutation remains guarded RPC/transactions. Typed history is immutable and generic audit is owner-written with IDs/action/field names only, not activity summaries or Contact values. No client-forged actor, source, Task completion event or audit insertion. Keep source errors generic enough not to reveal guessed records. Server-authorised pagination/count/filter predicates must match the board and My Work projections.

## Routes and UI changes

- `/crm`: retain Overview, Organisations, Contacts and Opportunities; add an active Pipeline view and Closed view. Add grounded follow-up summaries.
- `/crm/opportunities/[id]`: show exact next action, related open/history Tasks, activity-entry form and curated timeline; retain the existing guarded 05A stage controls.
- `/crm/organisations/[id]`: show bounded CRM activity and Organisation-linked follow-ups; preserve Contacts/Opportunities and future Site/Event placeholders.
- `/work` and `/work/[taskId]`: show CRM source, assignee, actual due state and guarded complete/cancel/reassign actions alongside existing document work. Distinct source labels and links prevent confusion.

Use established shadcn/ui primitives, accessible drag/drop alternative, text statuses, focus handling, form validation, loading/error states and touch targets. Keep the accepted iOS-inspired blue/graphite/neutral styling and **no green**, including Won. Desktop board and 390px stage-list must not overflow horizontally. Stage changes and Task mutations announce success/failure; they do not visually claim success before the server confirms.

## Proposed migration and implementation order

1. Inspect and preserve the final live development schema, current Task guard/policy/functions and 05A CRM functions before writing the forward migration.
2. Add `crm_activities` with exact relational constraints, indexes, immutable guard and RLS. Add source-specific Task fields/checks and partial document uniqueness so multiple CRM follow-ups can link to one Opportunity without weakening document idempotence.
3. Extend `private.guard_task`, Task RLS, guarded create/reassign/reschedule/complete/cancel operations, typed Task history and audit with explicit `DOCUMENT_REVIEW` and `CRM_FOLLOW_UP` branches. Preserve existing review-trigger and onboarding cancellation semantics. No universal Task workflow engine.
4. Extend server Task resolution/My Work with a CRM source adapter, then add activities, timeline, due queries and Kanban UI. Existing 05A stage RPC remains the sole pipeline mutation path.
5. Read back database objects/policies and run security/business regressions before browser verification. Development synthetic data only; staging and existing Sites remain untouched.

If a Task constraint/guard cannot safely distinguish CRM from document work, or if a material authority expansion is needed, stop before applying migration and seek an amended 05B design. No real KSS contacts or commercial information.

## Acceptance and test matrix

Positive proof with synthetic data:

1. Office sees authorised Opportunities in desktop Kanban and a usable 390px stage-list. A forward drag calls the existing guarded transition and produces exact stage history; a backwards move demands and records a reason. Won/Lost remain terminal and appear in Closed.
2. Office logs a Phone Call against exact Organisation, Opportunity and Contact. The immutable record and actor/time appear in the curated timeline.
3. Office deliberately creates a follow-up CRM Task due tomorrow for another eligible Office assignee. It appears in that assignee's existing My Work with exact CRM source and London-local due time; Opportunity owner stays unchanged.
4. Completing the Task records actual actor/time but leaves Opportunity stage unchanged. Stage movement leaves the Task state unchanged. The timeline shows both independent lifecycles.
5. Opportunity-owner change flags linked open Tasks without moving them. An explicit selected Task reassignment records old/new assignee, actor, reason and time; completed Task history is untouched.
6. Due today/upcoming/overdue and no-future-follow-up views reflect stored due times under a controlled clock. Organisation activity stays within authorised commercial records. Desktop and 390px journeys are accessible and have no green or horizontal overflow.

Negative proof: Staff/Operations/anonymous/unmapped and expired Office role denied at page/API/RPC/table levels; guessed source IDs denied; forged assignee/actor/source/history/audit denied; CRM Task cannot reference missing/wrong-type source; Activity Contact/Opportunity must belong to its Organisation; direct activity update/delete denied; invalid due time/DST input denied; backwards stage without reason and terminal reopening denied; Task completion cannot set Won or generate a fabricated Activity; stage move cannot complete Task; document-review Task cannot be created/completed/reassigned through CRM operations; CRM permissions grant no private People/Profile/Document/Storage access. Verify direct reads cannot reveal CRM task titles/summaries to denied roles, and search/count/pagination share authorisation.

Before claiming 05B implementation, run clean install, lint, typecheck, Webpack production build, smoke, focused CRM activity/Task/business/RLS tests, controlled-clock due tests, relevant Phase 01–05A regressions (especially Document review, onboarding Task reassignment/cancellation and My Work), migration/object readback, staged secret scan, no-green audit, and actual Office desktop/390px browser flows. Record results and failures rather than treating this proposal as completed proof. A bounded Sol architecture/security review is appropriate if the Task guard/RLS is extended; no GPT-6 Astra without explicit approval.

## Deferred and approval boundary

Later separately approved work may add email sync, reminders/notifications, tender portal integration, Client/Site/Venue/Event links, staffing/deployment and commercial reporting. 05B adds no automated email/SMS/push reminder; due status appears in app only. No staging deployment or real data import. Existing protected staging access handoff remains separate.

**Approval:** David approved implementation on 23 September 2026, clarifying that normal completion by the assigned Office user needs no extra reason. TASK-05B implementation and development evidence are recorded in `TASK-05B-REPORT.md`. No staging deployment or Client/Sites/Events work is authorised by this approval.
