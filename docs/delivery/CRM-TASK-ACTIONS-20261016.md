# Exact CRM follow-up actions from My Work

Date: 16 October 2026. Baseline: `1139203851a025eb6cb9c7bb35126fa5794002c2`.
Independent checkout: `/tmp/kss-crm-task-actions-20261016`. The original dirty checkout and prior frozen handoffs were preserved. Scope follows the parent/coordinator-approved `/tmp/kss-next-crm-task-actions-20261016.md` plan and existing task/CRM contracts. Broader task/workflow and CRM cards remain incomplete.

## Delivered journey

The existing `/work/<taskId>` server page retains its UUID, principal, capability and source/Person checks. A resolved CRM Opportunity/Organisation follow-up now renders a dedicated workspace keyed by that exact task ID. Document Tasks retain their exact-version source redirect unchanged. No other task domain gains action controls.

The workspace shows the selected title, source, current state/deadline and canonical source link, with Back to My Work navigation. OPEN work offers Complete and Reschedule; Done/Cancelled work is factual history without those actions. Existing My Work list/calendar links, filters and task/source services are unchanged. No metadata or return state is newly persisted.

An explicit native review dialog names the task/source/current deadline. Completion needs a deliberate confirmation. Rescheduling needs a changed, unambiguous London date/time and a 3–300 character reason, or deliberate confirmation that the deadline will be removed. The unchanged London due-time helper rejects nonexistent and repeated DST times. Invalid/no-op forms cannot submit while Cancel/Escape remain available. Dialog focus cycles within its enabled controls and returns appropriately on close; pending submission blocks duplicate writes and cancellation.

Confirmation follows three steps:

1. Read the exact task through the existing guarded GET. Compare task/source identity, state, deadline and reviewed titles with the displayed snapshot. An observable stale change stops before writing and requires another deliberate review. Lost access or malformed/wrong identity clears details.
2. POST only the exact selected task ID and COMPLETE/RESCHEDULE intent to the existing guarded CRM action endpoint. No new action, API, RPC or database contract is added.
3. Read the same exact task again. Require matching identity/source/canonical link and the expected Done state with unchanged deadline, or OPEN state with the exact intended due instant (including null for deliberate removal). The POST receipt must also name the selected task. POST 200 alone never produces a success message.

A denied write, uncertain transport/server response or lost/mismatched readback clears task details/action controls and requires explicit Refresh follow-up. Refresh only reads; it never replays an action. A 5xx or lost POST response is described as unconfirmed, not definitely rejected. A new navigation/unmount during the preflight read prevents a later POST from that abandoned component.

## Concurrency boundary

The unchanged writer has a database row lock, current OPEN-state guard and action-specific authority checks. Neither its API nor the task projection supplies a revision/expected-due comparison, and the projection omits assignee/revision history. This client comparison detects only observable stale facts; it is **not server compare-and-swap or a new optimistic-lock guarantee**. Another change can occur between preflight and POST, or after POST before readback. The existing guarded writer remains authoritative. Readback verifies the current intended task facts; it does not independently prove a particular actor/event receipt beyond what these existing endpoints return.

## Scope

Changed: `src/app/(enterprise)/work/[taskId]/page.tsx`.
New: `src/components/crm-task-actions.tsx`, `crm-task-actions.module.css`, `src/lib/tasks/crm-action-readback.ts`, two dedicated tests, this report and evidence.

Authentication, capabilities, task API/policy, CRM module/API/RPC, shared dialogs, London helpers, calendar/filter components, global CSS, packages and migrations remain unchanged. No reassignment, cancellation, bulk/automatic action, new grant, source task edit, notification or new task kind is included.

## Verification

- **58/58 focused local tests pass:** new CRM action 25 plus existing Calendar 7, Work filters 4, CRM due 2 and TFS assignment/source 20. Tests execute the actual page branch, client handlers, readback helper and existing task policy with synthetic boundaries. They cover exact task key/source, anonymous/capability/Person/source denial, unchanged document redirect, intentional actions, reason/DST/no-op/removal validation, delayed/duplicate prevention, cancellation, stale preflight, wrong ID/source/state/due/receipt, denied/uncertain/lost updates, history, safe refresh and unmount-before-write.
- **New browser: 8/8 Node test results pass** (seven Chromium journeys plus parent). Actual component/helper/CSS copies use intercepted synthetic API responses. At 390px/1280px they cover completion, rescheduling/removal, held POST/readback, no early success, repeated submission/cancel guards, eleven stale/denied/wrong/lost modes, safe read-only refresh, canonical links, dialog keyboard/centering/focus and loading/history. Historical Done/Cancelled receive no action controls or writes. No local/session storage is used.
- **Existing Calendar/filter browser regressions: 8/8 Node test results pass** (six journeys plus two parents), with existing assertions/boundaries unchanged.
- **42 layouts/captures:** new workspace 20, Calendar 13, filters 9; all 390px/1280px page widths match their viewport and no controls extend off-screen. New dialog captures also verify horizontal centering. The mobile reschedule review and desktop uncertainty views were visually inspected. Source hashes match final files.
- Full production Webpack build: **pass, 76 pages**, using compile-only `https://synthetic-build.invalid` and `synthetic-local-build-only` public placeholders with telemetry disabled. Serial TypeScript and existing localhost smoke **1/1 pass**. Full lint: **zero errors**, one existing unused `officeId` warning in `tests/site-horizon-maintenance.test.mjs`. Final diff check passes.
- Browser discovery led to explicit Tab cycling and scoped dialog centering. The error assertions were scoped to the workspace because Next's separate route announcer also uses an alert role. POST-pending tests now wait for the actual intercepted response rather than assuming the visible busy state means the POST has replied.

Evidence: `output/crm-task-actions-20261016/` logs, PNGs, layout JSON and source manifests. Prior test evidence regenerated by the unchanged regression specs is archived under this directory's `regression/`; the original tracked evidence directories were restored afterward. Their inherited historical baseline labels are unchanged; fresh source hashes identify the files actually exercised.

## Remaining limits

All action writes in tests were synthetic intercepted responses or in-memory boundaries. Browser fixtures do not authenticate and do not execute the production server route or hosted RPC; the actual server page/policy functions are exercised separately by the local tests. No live task was changed, no credentials loaded, no authentication retry/reset/workaround performed and no hosted mutation suite run. Live RPC/RLS, real signed-in action acceptance and human acceptance remain open. SQL source guards were preserved, not newly proven by these mocks.

No push, merge, deployment or Trello write was performed. The coordinator owns independent integration/review and publication; parent owns existing-card updates. This is an immutable local handoff with the concurrency and acceptance limits above.
