# TASK-UI14 Event record prototype — revised visual pass

Status: David visually accepted the revised Event, Organisation, Incident and Service Delivery studies on 25 September 2026 and authorised a controlled rollout to five named routes. The wider rollout is implemented and locally verified below; no hosted deployment or cross-record blanket migration is claimed.

## David's visual correction

The first authenticated screenshots showed a duplicated title/summary hierarchy and a 10.5rem section rail beside UI11's application sidebar. David rejected the rail as an Event default and requested one bounded revision. The original screenshots remain under `evidence/ui14/` as historical review evidence.

The revised `/events/[id]` page has one integrated factual header: Event name, source/type label, recorded state, Client, Site/Venue and Europe/London window. The redundant `Events | Sites / Venues` route switch is removed from detail only; the UI11 sidebar and breadcrumb already provide those destinations. A full-width horizontal section selector replaces the left rail. At mobile width it scrolls within its own viewport. The three independent links are now a visually secondary Related workflows group. Staffing Plan, Event context, operational actions, Attendance and History retain their existing source UI and authority. No backend, API, data, role, route-gate or business-state change was made.

Clicking a section sets `aria-current="location"` and preserves its useful URL hash. A `hashchange` listener restores selection on hash navigation. Natural-scroll section detection is deferred; the selected state represents the clicked/hash section, not live scroll position. The section state is presentation only.

## Revised browser evidence

The final UI11 implementation commit `5d77727` was cherry-picked into this isolated worktree for combined capture. A clean Webpack production build passed. The local production preview used an authenticated synthetic Office Admin account against synthetic Development data. It was not a hosted deployment. Earlier `next dev` request-scope cookie failures were left untouched.

Requested screenshots:

1. [1280px top](evidence/ui14/revised/event-1280-top.png)
2. [1280px scrolled to Staffing/History](evidence/ui14/revised/event-1280-history.png)
3. [genuine 390px full page](evidence/ui14/revised/event-390-top.png)
4. [390px selected Staffing and keyboard focus](evidence/ui14/revised/event-390-focus-selection.png)

An additional [390px longer Client/Site sample](evidence/ui14/revised/event-390-long-name.png) used a second authorised synthetic Event. The first Event name wrapped across two lines; the second had a longer Client label. Both remained within a 390px document. Neither sample proves an extreme 180-character Event name.

Browser measurements: the 390px document and body widths both equalled 390px. The section selector measured 358px visible and 378px scrollable without horizontal page overflow. All four section targets measured 44px high. Keyboard focus on Staffing had a computed 3px blue outline. Clicking Staffing produced `#event-staffing` and `aria-current="location"`; clicking History produced `#event-history` and its selected state. At 1280px scrolled to History, the horizontal section selector stayed at viewport top 0 and document width equalled 1280px. The full-width Staffing Plan retained its desktop table; no card conversion was made.

The sample has one staffing requirement and one History entry. A genuinely dense Event and David's final visual acceptance remain outstanding. UI12 and UI13 were not integrated in this lane's capture. No live data, staging, production or deployment is claimed.

## UI13 visual hierarchy coordination

David later approved UI13's desktop visual hierarchy for controlled shared-component implementation. This Event-only pass adds a narrow blue edge to the primary record identity and orders existing operational controls as primary lifecycle action, secondary owner/date changes, then an outlined destructive cancellation action. The Event's recorded `Planning` state remains source-labelled and blue/neutral; no amber attention treatment or new readiness state was inferred. Staffing counts and the dense desktop table remain owned by the Staffing Plan. UI13's shared primitives were still under implementation during this pass, so UI14 did not copy, import or alter them. Future use of committed UI13 primitives needs a separate compatibility and visual review.

The clean Webpack production build, TypeScript, targeted ESLint and diff check passed. The authenticated synthetic Office browser readback confirmed the unchanged four actions and their revised order. At 390px, document width equalled the 390px viewport. [Updated desktop top](evidence/ui14/ui13-aligned/event-1280-top.png) and [updated mobile top](evidence/ui14/ui13-aligned/event-390-top.png) are saved for David's visual review. The previous synthetic Staff test persona was restored after capture. This does not change UI14's visual acceptance gate or authorise cross-record rollout.

## Later record work

David then authorised exactly three record-family studies. Organisation, Incident and Service Delivery use integrated factual identity/context headers and horizontal section navigation. Their domain content and existing action controls remain in place. No Event section/action vocabulary was copied into them. The new presentation CSS is scoped to these three detail components; no UI13 shared primitive was imported or duplicated. These are review prototypes, not a record-route standard.

### Organisation entity record

`/crm/organisations/[id]` retains relationship status, accountable Office owner, commercial fields, contacts, opportunities, relationship history, work, and source links. The redundant generic CRM title/tabs and repeated four-step journey were removed on this detail route only. The header now gives the Organisation name and factual relationship context once; related workflow links follow the section selector. The synthetic example has a multiword name and linked Site/Event. The navigation order follows the existing content order. CRM list and Opportunity views remain unchanged.

### Incident operational case

`/incidents/[id]` keeps the submitted narrative central. The category, factual status, occurrence/context, report version and reporter are integrated above short case-specific sections. Earlier report versions and correction affordance appear only when present and permitted; operational follow-up remains reviewer-only. No severity, risk score, or new case state was added. The screenshot uses a reopened synthetic incident with a four-event reviewer history. The submitted report repeats no occurrence metadata that is already in its header.

### Service Delivery management workspace

`/service-delivery/[id]` retains the Client → Site → Service source chain, administrative state/owner, four existing management measures, review periods, exact source facts, meetings, actions/blockers, and history. Its longer section selector stays horizontal while the domain content stays a full-width management workspace. Existing source disclaimers and Site Service/Mobilisation links remain. The synthetic sample has one open review, one open action, one blocker and eight history events.

### Browser and build evidence

A clean Webpack production build, TypeScript, and targeted ESLint passed after the final presentation refinements. Authenticated synthetic Office/Super Admin local production-preview readback was used; no hosted deployment or production acceptance is claimed. At genuine 390px, all three documents measured 390px scroll width. Organisation's selector measured 358px visible / 614px scrollable, Incident's 358px / 358px, and Service Delivery's 384px / 771px. Their section links measured 44px high. At desktop 1280px, all three documents measured 1280px scroll width. All three section selectors showed a 3px keyboard focus outline. Organisation History preserved `#organisation-history`; Incident Operational follow-up preserved `#incident-follow-up`; Service Delivery History preserved `#history`, with its heading below the sticky selector. Each selector stayed at viewport top after its section jump. Focus and URL evidence is presentation-only; these three study selectors do not claim natural-scroll active-section tracking. The examples test realistic multiword identity/context, not extreme arbitrary-length names.

Final screenshots for visual review:

- [Organisation 1280px](evidence/ui14/three-records/organisation-1280.png) · [390px](evidence/ui14/three-records/organisation-390.png)
- [Incident 1280px](evidence/ui14/three-records/incident-1280.png) · [390px](evidence/ui14/three-records/incident-390.png)
- [Service Delivery 1280px](evidence/ui14/three-records/service-delivery-1280.png) · [390px](evidence/ui14/three-records/service-delivery-390.png) · [390px keyboard focus](evidence/ui14/three-records/service-delivery-390-focus.png)

David subsequently accepted all three studies as evidence for the shared record anatomy. The statements above describe the state of the earlier review pass. Staff Record, Event Attendance and Worked Time remain outside the controlled rollout.

## Controlled rollout, 25 September 2026

David authorised the anatomy for exactly five further detail routes. The rollout preserves each domain's content geometry and existing source reads, actions and route authority:

- **Opportunity:** one commercial identity header with stage/type, Organisation and owner; Overview, Stage and owner, Work and history; existing follow-up/activity controls and commercial timeline.
- **Onboarding case:** one case identity header with source case state, Site, template and created date. The selected case URL now gives the private case content full width; the queue and controlled-document publisher remain on `/onboarding`. The case's submitted information and requirements remain under their existing authority.
- **Mobilisation:** factual title, state, Client, owner, target and template; existing actions, blockers, decisions, guarded source links, review and history stay in the case workflow.
- **Site Book:** Service identity, Site and open-item count; Handover, Outstanding, Recent notes, History and Add a fact retain the two-column desktop workflow and single-column mobile order.
- **Site Service:** source state/type, Client, Site and effective period; existing state controls, weekly template, dated demand and history remain dense operational content.

The accepted Event and Organisation navigation, Incident navigation, and these five routes now share a small presentation-only section tracker. It updates `aria-current="location"` as the reader scrolls, keeps the selected link visible inside an overflowing mobile selector, and preserves anchor/hash navigation without changing source state. Service Delivery uses its own section-focused content view: only the chosen management section is shown, while all source cards and history remain available through the selector and deep links. Its selected link also scrolls into view within the mobile selector. A subtle edge fade cues mobile selector overflow; it adds no carousel control.

### Local browser evidence

The local Webpack production build, TypeScript and targeted ESLint passed. Authenticated synthetic Super Admin readback opened all five records. The Site Book record was read under Super Admin oversight; synthetic Staff A's current book list was empty and a direct ungranted book returned Not found, so no Staff book access was inferred. No write action was exercised. At 390px, every sampled document width equalled its 390px viewport and all section links measured 44px. The horizontally scrollable selector widths were Opportunity 358/390px, Onboarding 358/409px, Mobilisation 358/641px, Site Book 366/521px, and Site Service 358/482px (visible/scrollable). A keyboard Tab to a Site Service section link produced a computed 3px outline. Site Book History click set its exact hash and selected state; natural scrolling to the bottom updated selection to Add a fact. Service Delivery History and Source facts each set the exact hash, selected state and focused content; deep-linked History remained visible within the 384px mobile selector and the document stayed at 390px.

Desktop and genuine 390px full-page captures:

- [Opportunity desktop](evidence/ui14/rollout/opportunity-1280.png) · [mobile](evidence/ui14/rollout/opportunity-390.png)
- [Onboarding desktop](evidence/ui14/rollout/onboarding-1280.png) · [mobile](evidence/ui14/rollout/onboarding-390.png)
- [Mobilisation desktop](evidence/ui14/rollout/mobilisation-1280.png) · [mobile](evidence/ui14/rollout/mobilisation-390.png)
- [Site Book desktop](evidence/ui14/rollout/site-book-1280.png) · [mobile](evidence/ui14/rollout/site-book-390.png)
- [Site Service desktop](evidence/ui14/rollout/site-service-1280.png) · [mobile](evidence/ui14/rollout/site-service-390.png)
- [Service Delivery History desktop](evidence/ui14/rollout/service-delivery-history-1280.png) · [mobile](evidence/ui14/rollout/service-delivery-history-390.png)

The sampled names include multiword Event, Client, Service and Site labels, and the Site Book Service name visibly wraps at 390px. These are synthetic records and do not establish coverage of arbitrarily long source names. All evidence is local synthetic Development, not production, staging or human visual acceptance of the five new routes. Staff Record and Event attendance/work-time detail await separate review. No deployment, migration or backend permission change was made.
