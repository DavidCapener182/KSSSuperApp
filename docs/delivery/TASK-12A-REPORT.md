# TASK-12A implementation report

**Status:** Technical implementation and regression evidence accepted by David. Desktop-sized authenticated browser acceptance checks are recorded below. Final acceptance remains pending genuine 390px Staff and Operations proof. No staging or production work was performed.

**Date:** 24 September 2026

## Delivered

- Staff can submit context-free or correctly linked operational incident reports. The reporter is resolved server-side from AuthIdentity to the stable Person record.
- External people use a controlled relationship and neutral descriptor only. The UI and database reject common contact, address, date-of-birth and name-shaped values; the report form also tells Staff to omit identity and medical detail.
- Staff can read their own report versions and lifecycle status. Correction snapshots append without replacing earlier narrative. Restricted operational actions and reopen reasons are hidden from Staff.
- Operations review requires both an active Operations role and an active, time-bounded `INCIDENT_REVIEWER` grant. Super Admin manages grants with a reason, attribution and revocation history. Office and ungranted Operations do not receive queue access.
- Operational review supports acknowledgement, controlled action codes, close and reasoned reopen. No attachments, severity, Tasks, notifications, analytics, medical/safeguarding/HR workflow or real data were added.
- The emergency guidance appears on the Staff form. The reporting flow is one column at 390px, uses the blue/graphite/neutral palette and has no green color values in its stylesheet.
- A reporter-only idempotency lookup lets Staff resolve an ambiguous submission response without returning report content.

## Synthetic Dev evidence

Applied and read back in the confirmed KSS Dev project:

- `task_12a_incident_reporting_foundation`
- `task_12a_submit_result`
- `task_12a_action_event_mapping`
- `task_12a_fk_indexes`
- `task_12a_external_descriptor_privacy`

All eight Incident tables have RLS enabled and deny direct `authenticated` SELECT and INSERT privileges. Reads and writes use fixed-search-path, server-authorized RPCs. The security advisor reports “RLS enabled, no policy” as an informational finding for these tables; this is the intentional fail-closed configuration. It also identifies the guarded `SECURITY DEFINER` RPCs as callable by `authenticated`, which is intentional: each RPC performs its own role, identity, scope and action checks. The performance advisor no longer reports unindexed Incident foreign keys after the covering-index migration.

The test inserted synthetic-only incident rows. Because report versions and event history are immutable, those test rows were not deleted.

## Checks run

- `npx tsc --noEmit` — passed.
- Focused ESLint on TASK-12A source and tests — passed.
- `npm run build` — passed.
- `npm run smoke` — passed.
- `tests/incidents.test.mjs` against authenticated synthetic Dev accounts — passed. It covered role-only denial, Office denial, grant/revoke authority, self-only reporting, direct-table denial, exact context links and invalid links, descriptor restrictions, exact-payload retry, correction history, concurrent actions, lifecycle close/reopen, and immediate grant revocation.
- `tests/incidents-navigation.test.mjs` — both permission-based navigation and safe return-target tests passed.
- `tests/incidents-routes.test.mjs` — authenticated Next route checks passed for Staff, ungranted Operations, Office and Super Admin.
- `npm run test:shell` — passed 2/2 after the TASK-11A owner updated its temporary-role fixture to use the guarded access API and aligned navigation expectations. No Incident security or role-table policy was changed.
- `npm run test:regression` — passed 45/45 serial tests against synthetic Dev, including the focused 12A incident tests and the 08A/08B/08C/08D, 09A, 07A/07B, 03A/03C/03D/03E, 04A, 05A/05B and 06A/06B/06C suites. The run used E-01 Auth session reuse: 10 sign-ins, 181 session requests and 10 cached personas. The first overlapping attempt was not counted; after its 08B local-server connection failure was isolated and the exact leftover synthetic allocation/Event were cancelled through guarded RPCs, the clean serial run passed.

## Evidence still required

- Desktop authenticated browser evidence is recorded below. Final David acceptance remains pending the requested genuine 390px Staff and Operations walkthrough plus mobile overflow, touch-target and focus checks; these were not verified and are not claimed.
- Retention, legal hold and final privacy policy remain pre-live gates. Do not enter real incident data until KSS approves them.
- Final David acceptance remains pending until the walkthrough is recorded. This report does not claim production readiness.

## Authenticated browser close-out evidence

On 24 September 2026, the in-app browser used an isolated local production build based on accepted commit `795d9a0` (including the TASK-12A implementation in its parent), configured only for synthetic Development project `dnfhkmmnlbiabqypclqg`. No Staging or production session was opened. Screenshots of the visible pages below were captured inline in the browser session; no standalone screenshot files were saved.

- **Security Staff A, desktop-sized viewport:** emergency guidance appeared before entry. A context-free synthetic Safety hazard report was submitted; the browser showed “Submitting report…” and then receipt with stable ID `b63c8bd7-2fca-46da-9577-516d494f0e04`, status OPEN. Staff opened it and saw the original narrative, version 1 and status history. After Operations review, Staff saw the same original narrative, version 1 and lifecycle history through Reopened; Operations action details and reopen reason were absent. Correction instructions were visible, but no correction was submitted.
- **Security Staff A, linked context:** submitted a second synthetic report with exact optional context `07B Synthetic Fixture · Event · Synthetic Workforce Venue`. Receipt showed stable ID `79efbe81-92e3-4a43-8557-973bb9dde7f5`, OPEN status and the Event/Site context. Staff opened it and saw the original narrative and context. No external-party descriptor was included in either report.
- **Security Staff B:** own reports showed no Staff A entries. Opening the known Staff A ID returned “Incident unavailable”; no peer Incident details were exposed.
- **Operations without grant:** Development Synthetic Operations had no Incidents navigation link. Direct queue URL and the known Staff A Incident UUID both returned the same generic 404 page.
- **Super Admin grant and Operations lifecycle:** through the guarded UI, granted Synthetic Operations an `INCIDENT_REVIEWER` grant with last active date 25 September 2026 UK time and a TASK-12A synthetic-test reason. Grantor, reason, active status and expiry appeared in history. The granted Operations persona opened the context-free Incident detail; the queue later displayed the report and existing synthetic queue rows. Operations acknowledged it, recorded controlled action `FOLLOW_UP_REQUIRED`, closed it, then reopened it with reason “Synthetic acceptance check: additional operational follow-up is required.” The report stayed at version 1, and each state/action was attributed to Synthetic Operations in history. The review screen displayed the factual report and operational follow-up only; no HR, medical, safeguarding, disciplinary, police, finance, CRM or unrelated People data appeared.
- **Operations action-control defect fixed:** after lifecycle updates, the selected next action could display one command while the button submitted a stale command. The control now derives its selected/submitted action from the current lifecycle status. The updated authenticated browser showed `Record action` for the reopened report.
- **Staff B/Office denial:** Office Admin had no Incidents navigation link and received generic 404 for the queue and known Incident detail. Office also received 404 for the Incident Reviewer grant-admin page.
- **Grant revocation:** through the guarded Super Admin workflow, revoked the Operations grant with reason “TASK-12A walkthrough complete; synthetic Incident review grant revoked.” Grant history showed the revocation reason. Signing in again as Operations removed the Incidents navigation link; fresh queue and known-detail requests both returned generic 404. No privileged detail remained visible.
- **Grant revocation control defect fixed:** the existing native `window.prompt` did not expose a reason-entry control in the in-app browser. Replaced it with an inline required reason form in the same guarded grant workflow. The confirmed grant was then successfully revoked and read back.
- **Appearance:** desktop-sized captures used blue/graphite/neutral styling with no green status styling. The visible layouts were readable at the captured desktop width.

The requested 390px viewport proof remains outstanding. The available in-app Computer interface did not expose a viewport-size control; keyboard zoom did not change the viewport. Mobile overflow, 44px-class touch targets, mobile keyboard focus, and the 390px Operations queue/detail remain unverified. Context-linked Staff submission, self/peer access, Operations role-only denial, active grant lifecycle, reasoned reopen, Staff read-back, immediate revocation, post-revocation denial and Office denial are verified at the desktop-sized browser viewport. A true 390px run is required before final David acceptance.

## Focused checks after browser-discovered UI fixes

- `npm run build` — passed on the isolated TASK-12A close-out build.
- Focused ESLint on `incident-detail.tsx` and `incident-reviewer-admin.tsx` — passed.
- The previously recorded full serial regression remains 45/45 from the accepted technical run. It was not rerun after these narrow client UI fixes.
