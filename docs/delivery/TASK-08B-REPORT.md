# TASK-08B implementation report — synthetic Dev

Date: 24 September 2026. Scope: Event `DEPLOYMENT_CREATED` → exact allocated Staff Person → in-app Action Centre. This records synthetic development evidence, not human acceptance or production readiness.

## Delivered boundary

- An immutable Event allocation history row of kind `ALLOCATED`, revision 1, creates one `DEPLOYMENT_CREATED` notification for the exact `event_staff_allocations.person_id`.
- The notification deep-links to `/my-deployments?allocationId=<allocation UUID>`. My Deployments reloads the current source under its own authorization. The card has no Accept/Decline action.
- Notification read/dismiss history is independent of allocation state and Tasks. Only the recipient Staff user can read/change their personal Action Centre. Operations and Office do not gain access by managing the Event.
- Action Centre sections include unread, requires action, recent and dismissed/history with counts and pagination. Current allocation, requirement and Event state is projected at read time; cancelled allocations remain in history with current truthful wording.
- In-app only. No Task creation, external channel/provider, preferences, static source adapter, CRM/document/attendance producer, scheduler or staging change.

## Database and authority evidence

- Applied the source migrations to dedicated synthetic Dev project `dnfhkmmnlbiabqypclqg`: `20260924160000_staff_deployment_action_centre_08b.sql` and forward correction `20260924161000_validate_event_notification_recipient_08b.sql`. The correction binds source event, allocation, requirement and Person before inserting.
- Both tables have RLS enabled, no direct authenticated read/write grants, and are available through narrow authenticated RPCs. No public/anonymous execute grant is retained on those RPCs. The private producer is not executable by authenticated clients.
- Focused integration: `tests/action-centre.test.mjs` passed 1/1 against synthetic Dev. It verified one notification for each committed allocation, exact recipient projection, Staff B peer exclusion, Operations/Office denial, direct table denial, safe projection fields, no caller-provided recipient, read/dismiss source invariance, current cancellation/acceptance wording, guessed-ID denial, and exact authorized My Deployments deep link.
- Producer replay proof: two concurrent privileged Dev SQL calls to `private.ensure_deployment_notification_08b` for one committed immutable allocation event returned the same notification UUID. Readback showed one notification row, one `CREATED` history row and one logical ID for that source event.
- Test-created allocations were cancelled through the guarded Office RPC after the proof. Dev readback for the exact synthetic fixture showed zero active allocations; notification history was retained.

## Build, regression and UI checks

- `npm ci --ignore-scripts --no-audit --no-fund`: passed.
- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run build` (Next.js Webpack production build): passed.
- `npm run smoke`: passed after granting the local test process loopback bind access.
- `npm run test:regression` (serial, `--test-concurrency=1`): 30 passed, 5 failed. The 08B integration test passed in this run. Failures were TASK-09A attendance manager-resolution retry, 07A availability segment result, 03E missing team fixture, 08A candidate blocked, and 06B expected staffing count (9 vs 8). These failures are recorded without attributing them to 08B. A subsequent final focused 08B integration run passed 1/1 after adding guarded synthetic fixture cleanup.
- Authenticated browser walkthrough at 1200px and 390px showed Action Centre content and navigation. Both widths reported document/body width equal to viewport; the mobile computed-style scan found no green. At 390px, sections form a two-column layout and action/link controls are 44px tall.
- Screenshots: [desktop](../../output/playwright/task-08b-desktop.png) and [390px](../../output/playwright/task-08b-390px.png).
- ESLint/typecheck were rerun after the integration test corrections and passed. No staging or production environment was touched.

## Review and limits

The bounded read-only authority review found no additional recipient, RLS, deep-link or privacy issue. It identified missing direct proof of concurrent producer replay; that gap was closed with the Dev SQL replay and row/history readback above. The serial suite remains partially failing as listed, so no claim is made that all neighboring regressions are green.

Static Site shift notifications remain disabled. TASK-08A is separately accepted, but no 08A producer is included here. No additional notification source or external channel is implemented. Stop for David's review.
