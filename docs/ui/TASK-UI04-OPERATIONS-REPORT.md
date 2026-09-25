# TASK-UI04 — Operations Workspace report

Status: **accepted by David for the bounded Control Room and Action Centre UI pass in synthetic development on 25 September 2026**. This is a partial UI04 implementation, not acceptance of the full Operations redesign.

Starting canonical main HEAD: `25dfb02dd5e1da087b0cc8034b2260d8c129122c`. Exact edited paths are in `TASK-UI04-OWNED-PATHS.md`.

## Source contracts and design direction

Read the UI01 product inventory, journey audit, design audit, roadmap and public competitor pattern review from the shared checkout, plus accepted 09B, 13A and 14A reports. The Control Room remains the bounded 13A read projection. It has no Site Book or asset facts and cannot present a combined source record or inferred risk score. Its Event and Site Shift cards retain exact source links and factual attendance links. Incident detail remains under the separate reviewer grant. Action Centre notifications retain the Staff-specific 08B/08C allocation source and link to My Deployments; reading or dismissing a notification does not respond to an allocation.

TrackTik, Guardhouse, Resolver and PagerDuty patterns in UI01 support an exception-first, source-labelled desk. This is a design inference from public material, not competitor task testing.

## Changed

- Restyled Control Room cards and attention rows with clearer hierarchy, source labels, separate staffing facts, readable time and stronger focus/44px action targets. Attention rows with attendance review or explicitly recorded no-show now link directly to the accepted source attendance route alongside the Event or Site Service link. Added a separate Site Book link and explicit boundary text; no Site Book fact is aggregated into Control Room.
- Action Centre notification state changes now show a success message only after server acceptance and a subsequent read projection confirms the requested read/dismissed state. If refresh or bounded confirmation fails, it says confirmation is unavailable and keeps the prior authoritative display. Increased section and action targets to 44px.
- No backend, migration, global style, shared component, 19A, 20E, UI03 or real data change.

## Deferred source and screen changes

The current 13A Control Room projection does not contain Site Book handover age, responsible owner or a cross-source priority; those cannot be added as UI-only facts. Incident, Site Book and attendance composition needs a separately approved bounded screen pass with authenticated source-specific scenario checks. Static worked time remains outside accepted 10B. No new severity, risk or urgency ranking was introduced.

## Checks and evidence

- Scoped ESLint passed on the two edited TSX files.
- Webpack production build passed with the existing development environment configuration; it compiled and generated the operations routes. The first build attempt without `.env.local` compiled but stopped at `/staging-access` prerender because the Supabase URL/key were absent. No credentials were printed.
- `tsc --noEmit` passed after Next generated its route types; `git diff --check` passed.
- A local preview server started on `127.0.0.1:3104` with approved sandbox escalation. Playwright CLI did not return a snapshot within 35 seconds and was stopped. Desktop, genuine 390px layout, keyboard/focus operation and authenticated source readback are **not verified** in this run. CSS breakpoints and focus selectors are implementation, not visual evidence.
- David accepted this bounded domain-local UI pass with the checks actually recorded above. Authenticated desktop, genuine 390px, keyboard/focus and authoritative browser readback remain unverified and are not retrospectively counted as passes. The acceptance does not cover the broad UI04 brief, shared UI02 integration, other Operations modules, staging, production or deployment.

## Follow-up UI04 pass — accepted in synthetic development

David directly accepted this bounded Incident, Site Book and attendance follow-up in synthetic development on 25 September 2026. This acceptance is separate from the first Control Room/Action Centre pass. It covers the domain-local UI changes and checks recorded below; it does not establish acceptance of the full Operations redesign or convert missing browser evidence into a pass.

### Source-specific changes

- Incident reviewer cards now separate category, current status, linked context, occurred time and reporter, with a direct route to exact report/version and reviewer history. Empty copy no longer says all unavailable reports are awaiting review. Incident detail actions handle failed refresh without returning a confirmed outcome; correction keeps the form open until the source detail reload succeeds.
- Site Book cards, handover and item controls have clearer line height, 44px controls and visible focus. An accepted write waits for a fresh book read before its success notice; if that read fails, the UI says acceptance occurred but the current book could not be refreshed. Its history, acknowledgement revision binding and authorisation remain with Site Book.
- Event and static Site attendance manager actions wait for the source read and a later attendance revision on the exact allocation before showing confirmation. The Staff attendance view now links an unresponded allocation to its exact My Deployments focus. Attendance remains distinct from schedule, allocation response, Site Book and worked/payable time. Factual history and corrections remain visible. Mobile attendance facts are presented in one column with full-width actions.
- No new Control Room fact source, Incident scoring, source business rule, backend route, migration, Supabase change, shared UI component or deployment was added.

### Verification and gaps for this follow-up

- Webpack production build passed with the existing synthetic Dev environment file. Next generated all relevant routes and passed its TypeScript stage.
- A separate `tsc --noEmit`, scoped ESLint and `git diff --check` passed after the build. The first standalone TypeScript invocation overlapped with the build's regenerated `.next/types` and reported missing generated files; the sequential rerun passed.
- The local preview opened in the in-app browser at 1280px and a 390px viewport was set. Protected API requests then failed with Next's `cookies was called outside a request scope` error; the browser fell back to the access page. That page measured 390px document/viewport width, but it is **not** an Operations layout check. Authenticated Incident detail, Site Book service detail, Event/Site attendance, their action readback, 390px overflow and keyboard/focus behavior remain unverified in the browser. No screenshot or user timing evidence was obtained.
- UI03's accepted prototype uses a 390px day agenda and explicit pending → readback → confirmed transition; this follow-up retained those distinctions without editing UI03 paths.

The broader Incident/Site Book/attendance task journey still needs an authenticated source-specific browser pass, including a current Event, one static Site duty, a report with reviewer history and an open handover. Any missing cross-source read contract or new business logic remains a separate product proposal.

The accepted follow-up remains limited to synthetic development. Site Book service detail, Event/static attendance action readback, their 390px layouts and full keyboard operation were not browser verified in this pass. No staging, production, deployment or real data work is accepted.

## Additional bounded UI04 check and change — pending review

The Incident queue now announces loading, then renders authorised records or a true empty state. A failed initial list request no longer displays a contradictory empty-state message. This change is limited to the existing Incident client; the source query and reviewer authority are unchanged.

The rebuilt production preview used the existing synthetic Super Admin development session. At 390px, the Incident queue first exposed the `Loading incident reports…` status and then 25 source-linked report cards; document `scrollWidth` and viewport width were both 390px. At the default 1280px the queue also rendered 25 cards with document width 1280px. One source Incident detail was opened at 390px: exact report version, occurred time, context, narrative and reviewer action were present, with 390px document width. A keyboard Tab focused the brand link with a computed solid 3px outline. These observations cover only those inspected screens and focus target, not the entire Incident action flow or all role personas.

The first browser attempt in this worktree used `next dev` and its protected API requests failed with Next's request-context error. A rebuilt `next start` preview subsequently loaded the authorised synthetic Incident queue/detail; this later evidence supersedes that specific queue/detail visibility gap but does not verify Site Book service detail, attendance action readback, their 390px layouts or full keyboard operation. Scoped ESLint, `git diff --check`, Webpack build and post-build TypeScript passed for this additional change.
