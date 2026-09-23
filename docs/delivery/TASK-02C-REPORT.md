# TASK-02C delivery report — connected document review Tasks and My Work

**Date:** 23 September 2026. **Scope:** approved TASK-02C only. **Environment:** local Next.js and dedicated `KSS Enterprise - Dev` Supabase project `dnfhkmmnlbiabqypclqg`. **Data:** synthetic only. No deployment, live evidence or external integration.

## Delivered

- Added `public.tasks` for controlled `DOCUMENT_REVIEW` work only. The record uses a stable UUID, stable assignee Person ID, one immutable `DOCUMENT_VERSION` source pair, generic title, OPEN/DONE, timestamps and an exact `document_reviews.id` completion event. The unique source pair prevents duplicates. No file name, object path, hash, rejection comment, arbitrary URL, due date, priority or future domain handler is stored in Tasks.
- Added an atomic source adapter: the existing guarded upload finalisation transitions a version to SUBMITTED and its trigger creates one assigned Task in the same transaction. Inserting an authorised immutable review decision resolves that exact Task in the same transaction. The review remains the business decision. Task state alone never creates or proves a review.
- Added a database Task guard, SELECT-only authenticated grant, Task RLS, and server-side capability, source and assignee checks. No ordinary Task write or manual Done endpoint exists. Existing document RLS and private Storage policies remain independent. Task creation/completion audit entries contain controlled IDs and state metadata; the source document/review audit entries remain intact.
- Added Office/Super `My Work` with Open first and Done history. Open and Done are fetched separately so a large completed history cannot hide older open work. Each card resolves source context only after Task and document authority checks. The Task link rechecks authority, then opens the exact document version. Historical Version 1 is highlighted after Version 2 exists, with no stale review controls. Staff/Operations do not gain the Office queue.
- Added a source-controlled owner-only reconciliation function for selected pre-02C synthetic versions. It refuses older submitted undecided versions when a later submitted version exists, verifies any existing source/assignee pair, and reuses the exact review when resolving historical work. No blanket backfill was run.

## Database objects and migration record

`20260923003042_connected_tasks_02c.sql` created `public.tasks`, unique source pair, `tasks_assignee_state_created_idx`, `tasks_read` RLS, Task guard, source visibility and source-event functions/triggers, a narrow Task addition to existing audit constraints, and owner-only reconciliation. `20260923003818_fix_task_reconciliation_02c.sql` corrected an ambiguous column reference in that owner-only function found by its first actual reconciliation call. Both additive migrations are source controlled and appear in the dedicated project's migration history. The correction was kept as a forward migration; prior migrations were not rewritten. This is the one deviation from the proposal's expected single migration, with no extra table or widened permission.

Readback: Task RLS enabled; `tasks_read` is SELECT-only for authenticated users; authenticated has only SELECT on the table; submission, review and Task guard triggers are present. New Task-specific database objects are the table/index/policy and `private.task_source_readable`, `private.guard_task`, `private.ensure_document_review_task`, `private.task_after_document_submission`, `private.resolve_reconciled_document_review_task`, `private.task_after_document_review`, and `private.reconcile_document_review_task`, plus their three triggers. Only the source-event trigger path and owner can run Task mutation functions. Existing document and Storage objects were not changed by 02C.

## Reconciliation and synthetic data

Before reconciliation the inventory found 16 latest submitted undecided historical versions with no Task, seven reviewed versions with no Task, and no older submitted undecided anomaly in the inspected synthetic data. The reconciliation proof selected **one** already-reviewed synthetic Version (`8d925022-c541-4de1-9711-b17485f37ac9`), created one Done Task linked to its exact review, and called the same function again. Both calls returned Task `61c13ac1-8977-4c1d-9972-2aaf0cd102e6`; the Task had exactly one creation and one completion audit row. No bulk historical run was made. New test submissions created additional synthetic Tasks in the development project; at final readback there were 12 Done and four Open Tasks, including fixtures from repeated and regression runs.

The atomic failure proof used a synthetic pending version whose private Storage object already existed. A forced exception after finalisation inside a PostgreSQL subtransaction rolled the version back to `PENDING_UPLOAD` with zero Tasks; retry produced one submitted version and one Open Task. A forced exception after review similarly left zero review rows and the Task OPEN; retry produced one review and a DONE Task. Two concurrent owner calls to each idempotent creation/completion function returned the same Task and left one Task with two Task audit events total. These failure injections were transaction-local and left no database object behind. They prove rollback and convergence at the transaction boundary; they do not simulate a persistent infrastructure outage.

## Verification executed

| Check | Result |
|---|---|
| `npm ci` | Pass; 369 packages installed. |
| `npm run lint` and `npm run build` | Pass after the Sol review fix; webpack and TypeScript passed. |
| `npm run smoke`, `test:access`, `test:sites`, `test:shell`, `test:documents` | Pass sequentially. |
| `npm run test:document-review`, `npm run test:work` | Pass sequentially on the final build. New test exercises exact Version 1/2 Tasks, review IDs, RLS/API denials, immutable fields, no manual Done/audit write, source links, role expiry and audit metadata. |
| Atomic failure/retry, concurrent idempotency and bounded reconciliation | Pass by dedicated development database readback as described above. |
| Migration, Task RLS, grants and trigger readback | Pass. |
| Desktop and 390px in-app browser | Office queue Open/Done and exact Version 1 history confirmed; at 390px viewport and document scroll width were both 390. Staff direct `/work` showed 404. |
| Independent bounded GPT-6 Sol review | Found one queue limit issue: newer Done records could hide an older Open item. Fixed by separately fetching Open and Done. No authorization bypass found in its read-only review. |

The first smoke attempt could not bind localhost under the filesystem sandbox; the permitted rerun passed. A combined regression run later hit Supabase Auth request rate limiting before 02B assertions; 02B and 02C passed on sequential rerun. Neither interruption is counted as a pass. The browser document page initially showed an empty loading state while the existing Documents list resolved its recent requests; after loading, it displayed the exact highlighted Version 1 and current Version 2. This is a usability latency observation, not an access failure.

Supabase's security advisor reported the existing GraphQL schema discoverability warning, now including the new RLS-protected `tasks` table because authenticated users have SELECT, and intentional guarded SECURITY DEFINER RPC warnings from prior phases. It reported no new Task-specific executable public RPC warning. Performance advice marked the new Task index unused in the small synthetic dataset. Those findings do not override the direct RLS/negative-access results; GraphQL surface and production sizing remain pre-live review items.

## Remaining boundary and proposed first Phase 03 task

Phase 02 is ready to **propose for closure** on this synthetic development evidence, subject to David's acceptance of TASK-02C. The private evidence bucket still labels files `NOT_SCANNED`. Malware scanning, retention, privacy, backup/restore, real personnel data and production access remain separate live-pilot gates. Turbopack remains technical debt; webpack passes. No Vercel deployment was made.

**Proposed TASK-03A for review, not implementation:** establish one synthetic new-starter onboarding record and a versioned checklist for one explicitly selected role and Site, linked to a stable existing or newly created `Person` record without using the Supabase Auth ID as employee identity. Define requirement owners, validity dates and independent states such as requested, supplied, under review, rejected, verified and expired. Reuse the protected document service and exact review history as evidence pointers, but do not treat `ACCEPTED_AS_EVIDENCE` as verification or eligibility. Include a policy/authority proposal and negative tests before schema work. Confirm the pilot role, Site, requirement list and authorised verifier with KSS; record the LMS interface as unknown. Training integration, eligibility calculation and any employment decision belong to later separately approved 03C/03D work. Stop before implementing Phase 03.
