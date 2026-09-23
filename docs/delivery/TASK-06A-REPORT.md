# TASK-06A delivery report — Client, Site/Venue and Event foundation

**State:** implemented and development-verified on 23 September 2026; awaiting David's acceptance. Source starts from accepted `f479474`. No staging migration or deployment was performed.

## Delivered model

- `crm_organisations.id` remains the single Client identity. The existing `sites.id`, references, creator rule, SiteAssignments, onboarding references and Staff Site access remain intact. Existing Sites remain unlinked unless explicitly linked.
- Nullable `sites.site_type` supports the eight approved values without classifying existing records. `site_client_links` holds the exact Client relationship separately from Staff-visible Site rows. A partial unique index permits only one current Client per Site, while typed link history and effective fields leave room for a later approved transfer workflow. 06A exposes initial linking only; it does not permit casual relinking.
- `operational_events` stores the Client, exact Site link, one optional same-Client Contact, optional exact Won Opportunity provenance, eligible Office/Operations owner, controlled type/status and overall `timestamptz` start/end. One Event can span multiple days. Staffing/reporting/shift times and People allocation are absent.
- `operational_event_events` records creation, lifecycle, owner and date changes immutably with actor and database timestamp. `CONFIRMED` is operational planning confirmation only. Cancellation and owner changes require reason; date changes after Planning require reason; Completed/Cancelled remain terminal. No clock-driven status transition.

## Access and migration

Six additive, ordered SQL files implement the foundation and forward corrections. The initial private guard setting used an invalid PostgreSQL custom-setting name; the third migration corrects it forward to `kss.write_06a`. Another correction makes Event detail an explicit field projection rather than serialising a whole row. Final Dev readback confirms all four new tables have RLS enabled and no direct authenticated `SELECT` or `INSERT` grant. Existing `sites` and `site_assignments` grants remain in place.

Office/Super can create Events. Existing Site creator or Super can link a Site to a Client. Operations can discover safe operational Client/Site/Event fields and perform guarded Event status, owner and date actions; it receives no CRM pipeline, Opportunity value/history, Contact email/phone, Site administration, onboarding or private personnel-document access. Security Staff has no general Events workspace. Server routes enforce roles and use the guarded database operations; direct new-table access remains denied. The legacy `/api/sites` endpoint remains unavailable to Operations, which uses `/api/operational-sites` instead.

The six applied Dev migration names are `client_site_event_06a`, `operational_site_detail_06a`, `operational_guard_name_06a`, `operational_owner_choices_06a`, `event_detail_projection_06a` and `event_upcoming_06a`. `UPCOMING` is a derived list filter, not a stored lifecycle state.

## UI and synthetic proof

Added Events navigation, list/search/filter/pagination, responsive Event cards, a real Event detail with Client/Site/Contact/history and guarded operational actions. Office can explicitly create an Event from a Won Opportunity link; Won does not auto-create operational work. CRM Organisation detail now shows real linked Sites and Events. Existing Sites UI adds Site classification and exact Client linking while retaining its original Staff/admin journey. Operations gets a separate operational Sites view. Narrow mobile Events lists keep search/status visible and collapse secondary filters. All new UI follows blue/graphite/neutral status treatment, with no intentional green.

The guarded synthetic Dev seed created `Northshore Events Ltd` as a Client, `Riverside Arena` and a second linked Venue, `Alex Morgan` as the exact Northshore Contact, and `Northshore Live 2027` as one June 1–4 multi-day Festival Event. It moved Planning to Confirmed through the normal Event operation. An existing unlinked Site remains valid. The seed is idempotent and asserts the dedicated Dev project; it does not contain passwords or service keys.

## Verification actually run

- `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build` with Webpack, and `npm run smoke`: passed.
- Focused `tests/events.test.mjs`: passed. It covers one Client with two Sites, multi-day Event, Operations transition/date action, exact link, wrong Contact/Client, invalid dates, terminal transition, direct table denial and Office/Staff separation.
- Sequential accepted regressions passed: `access`, `site-journey`, `shell`, `documents`, `document-review`, `work`, `onboarding`, `profile-sia`, `controlled-documents`, `identity-evidence`, `onboarding-queue`, `people-directory`, `staff-record`, `crm`, `crm-operational`, and `crm-due`.
- Migration-name and table privilege/RLS readback performed against the dedicated Dev project. No new direct authenticated table writes were granted.
- Browser proof: Office Events and Event detail at desktop and 390px; Operations Event detail and Events list at 390px. Operations navigation omits CRM and exposes Events/Sites; Event detail omits Opportunity provenance and Contact email/phone. Office mobile Event detail measured 390px document width at 390px viewport with no horizontal overflow. Screenshots are in `output/playwright/events-06a/`.
- Source audit found no intentional `green`, `emerald`, `lime`, `mint` or `teal` styling in changed 06A UI. The final staged diff must also pass secret and whitespace checks before commit.

## Bounded security review and fixes

Reviewed the new SECURITY DEFINER operations, explicit projection fields, RLS/grants, Site creator rule, Operations role boundary and Event/Contact/Opportunity integrity. The review drove the explicit Event detail projection correction and a server correction that keeps Operations out of the legacy Sites API. Browser and direct Supabase checks confirmed the intended separation. The remaining limitations are deliberate: 06A has no Site transfer/correction process after Events, no live-data approval, and no staffing or deployment authority.

## Next separately approved task

Propose 06B Staffing Requirements: dated requirements within one Event, with role, quantity, reporting and shift windows. A multi-day Festival can therefore vary by day without fake daily Event records. Actual KSS Person allocation belongs to 06C. Training integration and production privacy/malware/retention/backup gates remain open. Protected staging and its deferred credential handoff remain unchanged.
