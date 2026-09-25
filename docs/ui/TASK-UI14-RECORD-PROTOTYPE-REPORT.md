# TASK-UI14 Event record prototype — revised visual pass

Status: Event-only refinement complete for David's screenshot review. Record-page anatomy is approved; this exact revised layout is not yet visually accepted. Cross-record rollout remains unauthorised.

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

UI01 identifies Organisation, Opportunity, Staff, Onboarding, Incident, Mobilisation, Service Delivery, Site Book and Site Service detail routes. They may share record identity, factual context, appropriate actions and section navigation, but each needs its own domain/role review before choosing geometry. UI14 changed none of them.
