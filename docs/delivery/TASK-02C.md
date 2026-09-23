# TASK-02C proposal — connected document review Tasks and My Work

**Status:** approved and implemented in development, pending David's acceptance. TASK-02B is accepted at `44eba7d`. See `TASK-02C-REPORT.md` for the delivered objects, tests and remaining gates. No deployment or live-data work was authorised.

## 1. Outcome and boundary

Prove one native, synthetic work chain: Staff A submits an exact DocumentVersion; one Task appears for the original authorised Office requester; the Task opens that version's authorised document review; a real `document_reviews` decision resolves the Task. A rejected Version 1 and its completed Task remain historical when Version 2 creates a separate Task. The Task has no Accept/Reject action.

**Platform rule:** Task state is distinct from business state. `document_reviews` is the decision; `tasks` is an accountable pointer to unfinished work. Task Done does not mean evidence accepted, verified, compliant or deployable. Task deletion/archival must never delete a source record. A Task never grants access to its source. These rules should be reused for later onboarding, mobilisation, incidents, audits, expenses and finance, with each source added by a separately reviewed adapter.

This task builds only a personal Office review queue, not a board, team inbox, general assignment system, notifications, comments, attachments, subtasks, checklists, dependencies, templates, SLAs, AI priority or manual Task completion. It uses synthetic people/documents in dedicated development project `dnfhkmmnlbiabqypclqg` only. Preserve every Phase 01 and 02A/02B migration, document, Storage, review, RLS and audit control.

## 2. Current repository facts

- `finalize_document_upload` currently locks the request/version, marks an exact version `SUBMITTED`, and appends a document-version audit event. It already has retry handling for Storage-success/database-finalisation failure. No Task is created today.
- `review_document_version` currently locks the request/version, inserts the immutable `document_reviews` decision and review audit in one database transaction. It accepts Office only for the original requester while the role is active, or Super Admin, and prohibits target/uploader self-review.
- `/app` is presently a generic Home page for Office; Security Staff alone see the label My Work, but it is not a Task queue. The capability map has no Task capability or `/work` route. The 02B UI primitives can be reused.
- The document request audience is target Staff, original Office requester with active role, and Super Admin. A SiteAssignment does not expand that audience. Document/Storage reads still need independent source checks even if a Task is visible.

## 3. Minimum Task record

Propose one `public.tasks` table. No domain-specific foreign-key column is added for each future module.

| Field | Rule for 02C |
|---|---|
| `id` | Database-generated stable UUID. |
| `task_type` | Controlled `DOCUMENT_REVIEW` only in this slice. Future types require an explicit migration and adapter. |
| `title` | Controlled generic text, e.g. “Review submitted personnel evidence”; no filename, comment, hash or private file detail copied into it. |
| `state` | `OPEN` or `DONE`. No `IN_PROGRESS` until an actual transition/use case needs it. |
| `assignee_person_id` | Stable `people.id` of the original Office requester at the submission event; never an Auth user ID. No arbitrary assignment or self-assignment API. |
| `source_kind`, `source_id` | Controlled `DOCUMENT_VERSION` plus the immutable `document_versions.id`. The pair is the deterministic source-event key and has a unique constraint. No arbitrary URL is stored. |
| `created_at`, `updated_at`, `completed_at` | Database times. `completed_at` is null until Done. |
| `completion_kind`, `completion_event_id` | Null while Open; when Done, controlled `DOCUMENT_REVIEW_DECISION` and the matching immutable `document_reviews.id`. |

The stored title is deliberately generic. The My Work API may return the scoped Staff display name, request title, version number and submitted time **only after** verifying the viewer's current Task and source-record authority. Do not persist those private details in a generic Task row or audit payload. `priority` and `due_at` are omitted because KSS has not set a review SLA or priority policy; no “Overdue” label is possible in 02C.

For future source types, add a controlled `source_kind`, relationship validation, visibility predicate, navigation resolver, completion rule and negative tests by migration. A generic `(source_kind, source_id)` pair cannot provide a universal foreign key; the 02C database guard must verify `DOCUMENT_VERSION` exists and is submitted, and future adapters must provide equivalent typed validation. Unknown kinds fail closed.

## 4. Creation, completion and failure contract

Choose **atomic database coupling** for this first source, because both source events already occur inside guarded PostgreSQL transactions. On a `document_versions` transition from `PENDING_UPLOAD` to `SUBMITTED`, a narrow, source-controlled trigger/function inserts the `DOCUMENT_REVIEW` Task for that exact version using the unique `(source_kind, source_id)` key and the request's original requester. `ON CONFLICT` must return/verify the same task rather than silently accepting a different assignee/source. A retry, callback, refresh or concurrent execution cannot create a second row. Initial Version 1 and rejected replacement Version n+1 use the same rule; Version 1 is never reopened or recycled.

On insertion of the terminal `document_reviews` row, a narrow trigger/function marks **only** the matching source-version Task Done and stores that review ID as the completion event. It must validate the source pair and accept repeat processing of the same decision without changing history. If an authorised review acts on a pre-02C submitted version with no Task, the same transaction creates its one historical Task and immediately resolves it; it must not block the real review or silently omit Task history. It must not infer Done from upload or from a UI action. Ordinary clients receive no direct Task INSERT/UPDATE/DELETE or Task-audit write privilege; a system-resolved review Task has no manual Done endpoint. A database guard keeps source kind, source ID and assignee immutable after insert; rejects DELETE; requires null completion fields while Open; and requires the matching exact review ID and completion fields when Done.

The Task creation and source submission deliberately commit together. If Task creation fails, the database finalisation fails and the version remains pending; a Storage object already uploaded is handled by the existing same-file retry/reconciliation path. The user sees a failure/pending state, never a false submitted state. Likewise, if Task completion fails, the review insertion transaction rolls back, so no successful review is falsely reported with an Open Task; the reviewer can retry. These are explicit atomic choices, not a claim that a committed business decision was undone later. Test both failure paths and confirm the exact source state after each.

Existing 02A/02B synthetic versions predate Task triggers. Before any backfill, inventory them and define a bounded synthetic migration/reconciliation run: create one Open Task only for each selected **latest submitted, undecided** version per document, or one historical Done Task bound to an existing exact review. Flag an older submitted undecided version as an anomaly for review; do not create an Open Task that 02B's latest-version rule makes impossible to resolve. The unique source pair makes the run repeatable. Do not flood the live My Work queue with every old test fixture by default. Provide a source-controlled, guarded reconciliation query/function for missing or mismatched Task/source pairs and explicit counts; no external scheduler or notification engine is needed for 02C. Silent lost Tasks are not acceptable.

## 5. Authority, RLS and source link

An active Office Admin sees only Tasks assigned to their stable Person ID **and** whose source document remains readable under the existing requester/role rule. Office B cannot see Office A's Task through the shared role or SiteAssignment. Staff and Operations cannot list, guess or read Office review Tasks. Expiring the Office role removes both Task and source access on the next request. Super Admin may read a review Task only where existing document authority allows it; no duplicate Super Task is created and Super visibility is not a general people/task search. Super may review the source through existing 02B authority, resolving the Office-assigned Task; reassignment to another Office person is out of scope because it would conflict with 02B's original-requester rule.

Enforce this at both layers: server capability/record checks for `/work` and Task API, plus a Task SELECT RLS predicate that checks mapped Person, active role, assignment (or bounded Super authority), and the linked document's existing private classification/request audience. Do not use a privileged service key to bypass those user checks. Direct authenticated table/RPC access must obey the same rules. Any Task/source inconsistency returns an unavailable state/404 without revealing private title, staff identity or link.

The Task stores no URL. A server-owned resolver maps `DOCUMENT_VERSION` to `/documents/{requestId}?version={versionId}` only after independent document-request/version authorisation. The current Documents UI does not read that query parameter; 02C must add a bounded exact-version highlight in its history. A completed Version 1 Task must visibly land on Version 1 after Version 2 exists, without offering stale review controls. Review actions remain available only for the latest submitted undecided version. Following a guessed Task ID or changing either ID must not bypass the existing document route, RLS or Storage policy. The protected file remains a separate authorised attachment download.

## 6. Audit and proposed database objects

Reuse `audit_events` for Task creation and automatic completion, with task/source IDs, state transition and event type only. Set its required `affected_person_id` to the Task assignee (original Office requester); set `actor_person_id` to the Staff submitter on creation or the reviewer on completion, including when that reviewer is Super Admin. Indicate that the Task change itself was automatic. Extend the existing entity/target check narrowly and keep ordinary clients' audit access read-only under existing RLS. Do not copy document comments, filenames, hashes, object paths or file bytes. Existing document review/submission audit rows remain intact.

After approval, propose one additive source-controlled migration containing: `tasks` with primary/foreign/unique/check constraints and indexes for assignee/state/created time and source pair; Task SELECT RLS and narrow grants; a source-link validator and mutation guard; the two exact-event trigger functions/triggers; a minimal `audit_events` entity/target extension; and a bounded reconciliation function/query for pre-existing synthetic records. Keep SECURITY DEFINER functions on a fixed safe search path with authoritative checks. Do not rewrite/squash prior migrations, broaden Storage policies, create a bucket, or add an arbitrary public Task write RPC. If schema needs materially more objects, return for approval first.

## 7. My Work product scope

Add `/work` (or an equally clear route) as the first genuine Task destination for Office. Use the 02B page header, text status badge, accessible list/card and empty/feedback patterns. Show Open assigned Tasks first, with Done history accessible; generic title, independently authorised source context, exact version, created time, state and an **Open document review** link. No due date or priority is shown. The Task card has no Accept, Reject or Done button. The document page retains the actual decision controls.

Keep the Security Staff `/app` label/landing behaviour until a genuine Staff Task source exists. Staff Documents still shows their document requests and feedback. Do not invent Staff Tasks or relabel Office's old generic Home as a full board. Office navigation may add My Work; Operations gets no private Task navigation. Responsive desktop and 390px layouts should be usable without page overflow, with keyboard focus, labelled states and an honest empty state.

## 8. Acceptance and negative-access plan

**Browser journey:** Staff A submits Version 1; exactly one Office A Task appears in My Work; Office B, Staff and Operations do not see it; opening the Task reaches the authorised exact-version document; Office A rejects Version 1; its Task becomes Done and stays in history; Staff A submits Version 2; exactly one separate Open Task appears; Office A accepts Version 2 through `document_reviews`; its Task becomes Done; Staff A sees Evidence accepted, not compliant or deployable. Inspect Office and Staff at desktop and 390px.

**Automated tests:** verify source/Task distinct state, unique source pair under retry/concurrency, Version 1 and 2 separate IDs/history, exact review ID on completion, idempotent completion, immutable Task source/assignee, no Task DELETE or manual Done/forged review, no direct client Task/audit write, Staff/Operations/Office B/unmapped/anonymous denials, guessed/changed Task and source IDs, SiteAssignment non-access, role-expiry denial, direct RLS/RPC denial, source link rechecks, historical Version 1 link/highlight after Version 2 without stale controls, backfill exclusion of older undecided versions, Storage and document regressions, and both atomic failure/retry paths. Assert no Task ever changes `document_reviews` by itself. Run clean install, lint, webpack build, smoke, all Phase 01 and 02A/02B tests, migration/policy readback, staged secret scan, browser demonstration and one bounded independent Sol architecture/security review. Record failures and interrupted runs separately.

## 9. Decisions and stopping point

The first assignee is the **original Office requester**, not a dynamic team queue. A Super Admin can independently perform an authorised review without a duplicate personal Task. An expired original Office role can leave an Open Task inaccessible to that assignee until Super resolves the source; no Office B takeover is invented. This is a known operational edge for later delegated review policy, not permission to widen the 02B document audience.

Approval is requested for the minimal `OPEN`/`DONE` model, typed source pair and unique deduplication rule, atomic source-event coupling, narrow My Work UI and assignee/source access checks. Unknowns are the future review SLA/priority, general reassignment, other Task sources and whether KSS wants historical test-fixture backfill; none blocks the new synthetic journey.

**Implementation stopped for David's review.** TASK-02C was approved and implemented in the dedicated synthetic development project. Do not start TASK-02D/Phase 03, import live data, connect integrations or deploy without separate approval.
