# TASK-12A implementation report

**Status:** **ACCEPTED — SYNTHETIC DEV** by David on 24 September 2026. Desktop and genuine 390px authenticated browser evidence are recorded below. No staging or production work was performed.

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

## Evidence record and pre-live gates

- Desktop authenticated browser evidence is recorded below. Genuine 390px Staff and Operations proof is recorded in the final section.
- Retention, legal hold, deletion/erasure handling, final privacy policy and operational governance remain pre-live gates. Do not enter real incident data until KSS approves them.
- This report does not claim production readiness.

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

## Final authenticated 390px browser proof

On 24 September 2026, Safari Responsive Design Mode was set to **390 × 956 CSS px at 100% zoom (3× device pixel ratio)** against the local synthetic Development build configured for project `dnfhkmmnlbiabqypclqg`. Only existing synthetic Incidents were opened; no report, correction, or lifecycle transition was created during this mobile close-out. Screenshot captures were returned inline in the browser session; no standalone image files were saved.

- **Security Staff A:** at 390px, the Staff Incident form/list and emergency guidance were visible before report entry. The existing own context-free Incident `b63c8bd7-2fca-46da-9577-516d494f0e04` and linked Incident `79efbe81-92e3-4a43-8557-973bb9dde7f5` opened with narrative/context wrapping inside the viewport. The own-report view showed original version and current lifecycle status. Restricted operational notes and reopen reason remained absent. The previously verified no-peer-access behavior is unchanged; this mobile pass did not create a peer report or repeat guessed-ID probing.
- **Operations without grant:** the direct queue and known Incident detail returned the generic 404 at 390px. This was checked before the temporary grant was created.
- **Granted Operations:** Super Admin granted the existing Synthetic Operations Person a finite `INCIDENT_REVIEWER` grant through 25 September 2026 UK time using the guarded workflow. Grant history showed the grantor, active status, expiry and reason `TASK-12A 390px acceptance; synthetic Dev only; revoke immediately after proof.` The granted Operations user opened the queue and existing linked and context-free detail at 390px. Queue cards, long Incident identifiers/context, factual narrative, status and lifecycle history wrapped without horizontal overflow. Existing history showed Acknowledged, Follow-up required, Closed and Reopened with actor and timestamps. On the OPEN linked report, the acknowledgement selector/button was present; on the Reopened context-free report, the controlled operational action selector and Record action button were present. No action was submitted during this mobile proof. No HR, medical, safeguarding, disciplinary, police, finance, CRM or unrelated People data appeared.
- **Mobile interaction and appearance:** the 390px Safari captures showed blue/graphite/neutral styling with no green status styling. Main content remained within the viewport on the Staff form/list/detail, Operations queue and Operations detail. Staff form controls were practically touch-usable; Operations action controls were approximately 48px tall. Keyboard navigation showed visible blue focus outlines on a Staff correction text field and the Operations action selector. Labels and lifecycle words were present in text, not conveyed by colour alone. No responsive defect was found.
- **Revocation and immediate denial:** Super Admin revoked the temporary grant through the guarded inline reason form with reason `TASK-12A 390px viewport proof complete; synthetic reviewer grant revoked.` Grant history showed “Grant revoked” and the recorded reason. After signing Operations back in, opening the previously known Incident detail URL returned the same generic 404, confirming access disappeared after revocation.

The external-party descriptor projection was not re-demonstrated in the browser; its omission/privacy behavior remains supported by the focused technical coverage recorded above. No separate mobile-specific lifecycle mutation was needed because this gate was visual and responsive evidence only. David formally accepted TASK-12A as **ACCEPTED — SYNTHETIC DEV** on 24 September 2026. The 45/45 serial regression was not rerun after the narrow client-only fixes; the subsequent production build and focused ESLint passed. Retention, legal hold, deletion/erasure handling, final privacy policy and operational governance for real Incident records remain explicit pre-live gates. No staging, production or real Incident data was used.

## Focused checks after browser-discovered UI fixes

- `npm run build` — passed on the isolated TASK-12A close-out build.
- Focused ESLint on `incident-detail.tsx` and `incident-reviewer-admin.tsx` — passed.
- The previously recorded full serial regression remains 45/45 from the accepted technical run. It was not rerun after these narrow client UI fixes.
