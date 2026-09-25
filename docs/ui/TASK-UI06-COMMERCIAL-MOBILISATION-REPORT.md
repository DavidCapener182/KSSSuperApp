# TASK-UI06 — Commercial to Mobilisation UI report

Status: David accepted this bounded, domain-local Mobilisation journey UI pass for synthetic development on 25 September 2026. This is not acceptance of the full UI06 brief, shared UI02 integration, staging, production or deployment. Starting canonical main HEAD: `25dfb02dd5e1da087b0cc8034b2260d8c129122c`.

## Scope and contracts

Reviewed `AGENTS.md`, delivery STATUS/DECISIONS, TASK-18A accepted report, UI01 inventory/research/journey/design-system/roadmap and Next.js 16.3.6 Client Components/CSS guidance. The changed path is the accepted, synthetic Office mobilisation flow. CRM Won stays separate from explicit mobilisation authorisation; the Client organisation ID remains stable. Site, Site Service and Event records remain distinct sources, and a handover is a human decision with outstanding facts, not a readiness result.

The CRM patterns in the UI01 research (HubSpot/Pipedrive/Salesforce) informed a visible next-step path. Project coordination patterns informed quick access to actions, blockers, decisions, source links and history. No vendor branding or new business rule was added.

## Changes

- Added a compact commercial-to-service path on the mobilisation list and detail. It links to existing CRM, Site and record sections, and labels the currently viewed stage in text.
- Added in-page section navigation, with 44px targets and focus indication, to the long mobilisation detail.
- Improved list status and empty state wording. The authorisation form remains an explicit action.
- After create, update or unlink, the UI now requires authoritative GET readback before showing a confirmation or navigating. Detail update/unlink also checks the returned revision; unlink checks that the exact current link is absent. A missing or inconclusive readback shows an error and avoids a success notice. Existing guarded API, exact identities and immutable history remain unchanged.
- Kept all styling in the existing mobilisation CSS module. No global styles, server policy, API, migration or shared component was edited.

## Verification and limits

- Focused ESLint on the two edited TSX files: passed.
- Production Webpack build with placeholder public Supabase settings: passed, including TypeScript and route generation. Initial build without environment settings failed on unrelated `/staging-access` prerender; the subsequent build used syntactically valid placeholder public settings only.
- `node --test tests/shell.test.mjs`: one read-only return-target case passed; the authenticated shell case failed at setup because synthetic credential environment files are absent from this isolated worktree. This is not an app assertion failure.
- Authenticated desktop and genuine 390px browser, keyboard focus and interactive workflow checks were not completed in this isolated worktree. CSS has one-column layout at 390px and explicit focus styles, but those source checks do not prove visual or assistive-technology acceptance. Authenticated visual and keyboard checks remain unverified under this scoped acceptance and are still needed before broader UI or release claims.

No staging, production, real data, readiness score, 19A/20E change or UI03 file was touched. The broader CRM/Client/Site/Service/Event redesign remains for a later owned slice with UI02 shared components and direct route verification.

## Acceptance record

David’s 25 September 2026 decision accepts only the changes and checks documented above in synthetic development. It does not turn unperformed desktop, genuine 390px, keyboard/focus or interactive workflow checks into passing evidence. Deferred source/read-contract, CRM/Client/Site/Service/Event and shared UI work remains deferred. No further feature work was started as part of this close-out.

## Follow-up UI06 pass — accepted in synthetic development

This section records a separate follow-up after the accepted Mobilisation-only pass. David accepted this latest bounded pass in synthetic development; the acceptance covers only the work and checks below, not the remaining UI brief or deployment. Latest main and the accepted UI03 Workforce planning report were rechecked before changes. The work stays in the exact owned paths listed in `TASK-UI06-OWNED-PATHS.md`.

### Presentation and workflow composition

- CRM overview, Organisation and Opportunity now show a short source-aware journey. Organisation detail links its exact sales work, explicit Mobilisation entry where the relationship is Client, and existing linked Site/Event projections. Opportunity detail labels its actual stage; only Won shows the separate Mobilisation authorisation link. The original guarded stage and ownership actions remain unchanged.
- Organisation and Opportunity detail gained in-page section navigation. Linked Sites are labelled as locations, with Services and Events explicitly remaining separate records.
- The Event list shows the existing Client → Site → Event → staffing path to Office users. Event detail gained section navigation for context, history, staffing and the separate attendance route. Event create/change feedback now requires an authoritative Event detail readback; status/owner/date changes are checked against returned source facts before a success notice.
- Sites gained a role-limited Client/Site/Event context trail. Site Service list and detail gained exact Site context links; the Service detail separates state, weekly template and dated demand sections. No demand, allocation, attendance or worked-time rule changed.
- Styling lives in `commercial-journey.module.css`, using existing blue/graphite/neutral tokens, text status, visible focus and 44px navigation targets. Its 390px rule is one column. No shared shell, global CSS or UI03 component changed.

### Checks and gaps for follow-up

- Focused ESLint on edited TSX components: passed.
- Next.js 16.3.6 production Webpack build with placeholder public Supabase settings: passed, including TypeScript. Placeholder settings support compilation only; this was not an authenticated integration check.
- `git diff --check` and edited-file no-green scan: passed.
- Authenticated desktop, genuine 390px browser, keyboard/focus and action readback journeys could not be exercised in this isolated worktree without synthetic credentials. The CSS and source review do not establish visual, responsive or accessibility acceptance. These remain review gates.

The accepted APIs provide exact CRM, Site, Service, Event and Mobilisation records for the links shown. No cross-domain readiness read contract, curated exact-source picker, combined commercial timeline or automatic Won-to-Mobilisation business rule was added. Any future cross-domain facts need a separate permission-aware read contract and approval. This pass does not authorise staging, production, real data, Supabase changes or deployment.

### Follow-up acceptance clarification

David approved the bounded commercial/source-record follow-up after its report. The authenticated desktop, genuine 390px, keyboard/focus and action readback journeys listed above were not run and remain unverified. This acceptance does not cover new work below this section.

## Next bounded UI06 pass — CRM pipeline accepted in synthetic development

After David accepted the previous commercial/source-record follow-up, this separate pass refined the existing CRM pipeline stage-change interaction. The modal now moves focus inside when opened, traps Tab within its enabled controls, closes on Escape when idle, and returns focus to the initiating control after cancel or a confirmed change. After the guarded transition responds, the client reads the exact Opportunity again and checks its ID and stage before closing the modal. A readback failure keeps the dialog open with an error and does not display a false confirmation. This introduces no new stage transition, drag operation, business rule, API or database change.

Focused ESLint, the Next.js production Webpack build with placeholder public Supabase settings, `git diff --check` and the owned-file no-green scan are the available local checks. Authenticated desktop, genuine 390px, keyboard tab order and normal stage-change readback have not been exercised in a browser in this worktree. David accepted this bounded pipeline interaction pass in synthetic development. The unperformed browser and live action checks remain unverified; this acceptance does not cover later UI work. No staging, production or live data action occurred.

## Next bounded UI06 pass — Event dialog accepted in synthetic development

After David accepted the bounded CRM pipeline pass, the existing Event create/change dialogs received the same basic keyboard treatment: focus enters the dialog on open, Tab remains within enabled controls, Escape closes when idle, and close/cancel or a confirmed change returns focus to the initiating control. Error messages appear inside the open dialog. The previously added exact Event readback still governs success after create or change. This does not change Event lifecycle authority, staffing, attendance, source IDs, API or database behaviour.

David accepted this bounded UI pass on 25 September 2026. At that decision, focused ESLint on `events-client.tsx`, Next.js 16.3.6 production Webpack build with placeholder public Supabase settings, `git diff --check` and edited-file no-green scan had passed. Authenticated desktop, genuine 390px, keyboard tab order, screen-reader response and normal Event action readback had not been tested in a browser. Acceptance did not convert those gaps into passes; no deployment or live data use occurred.

## Next bounded UI06 pass — source feedback accepted in synthetic development

CRM activity and follow-up creation now keep their entered values until the returned exact ID appears in the authorised CRM work read. Site Service creation keeps the draft name until the returned exact Service ID appears in that Site’s refreshed Service list. The existing generic Site Service action path now requires a successful authorised Service detail refresh before showing feedback and describes only that refresh; its message directs users to dated history for the exact change. This avoids calling a server response alone a verified change. Source guards, stable identities, immutable history and all business transitions remain server-owned.

David accepted this bounded UI pass on 25 September 2026. Focused ESLint on the three edited components, Next.js 16.3.6 production Webpack build with placeholder public Supabase settings, `git diff --check` and edited-file no-green scan had passed. A normal authenticated write/readback and desktop, genuine 390px and keyboard/browser checks had not been obtained at acceptance. No backend, shared design-system, Supabase, staging, production or real-data change occurred.

## Next bounded UI06 pass — CRM record feedback accepted in synthetic development

The existing CRM Organisation/Opportunity form and stage/owner/value actions now wait for the authorised source read after a guarded server response. New Organisation and Opportunity creation check the returned exact ID before navigation. Existing record changes check the refreshed record; stage, owner, value, Organisation name and Contact presence receive source-specific checks. The form stays open with an in-dialog error when readback is missing or inconclusive. This changes feedback and navigation only; the accepted server guards and terminal Won/Lost rules remain authoritative.

David accepted this bounded UI pass on 25 September 2026. Focused ESLint, production Webpack build/TypeScript with placeholder public Supabase settings, `git diff --check` and no-green scan had passed. Authenticated desktop, genuine 390px, keyboard/browser and normal write/readback journeys had not been obtained at acceptance. No backend, shared CSS/primitive, migration, staging, production or live-data change occurred.

### Attempted authenticated check

A `tests/shell.test.mjs` run using the existing synthetic environment paths reached its read-only return-target case, then stopped before the authenticated case at local listener `EPERM` (`127.0.0.1`). Inspection of that test also showed it later grants and revokes roles in synthetic Dev, outside this UI-only lane, so it was not retried with elevated permissions. No authenticated UI or write readback was established by this attempt.

## Final Commercial → Mobilisation browser close-out — pending David’s decision

**Implementation freeze.** This close-out used the built production `next start` app at `127.0.0.1:3116`, the existing authorised synthetic Office persona and existing synthetic records. It did not run the role-mutating `tests/shell.test.mjs`, add a backend source, create business data, or deploy. The three bounded passes above were already accepted by David; this section records later browser evidence and two narrow presentation defects found during the walkthrough. **TASK-UI06 as a whole is not yet marked accepted and closed.**

### Browser journey and source boundaries

- At desktop 1280px and genuine 390px, inspected CRM overview, Organisation and Opportunity lists/details, Events list/detail, Sites list and a linked Site, Site Services list/detail, and Mobilisation list/detail. The Office persona could follow CRM → Organisation → Opportunity → Client/Site/Event → Mobilisation through the existing links. The linked synthetic Site showed its exact Client, Event and ongoing Site Service; the Event showed Client/Site context, separate staffing and attendance links, and history. The Service detail showed state, weekly template, dated demand and separate attendance links.
- Mobilisation detail showed the commercial-to-service path, exact CRM origin where present, actions, blockers, decisions, current source links, human handover and immutable history. The inspected handed-over synthetic record still displayed 13 unresolved actions and explicitly said its facts were **not** a safety, compliance, staffing or contract verdict. CRM `WON` still required separate Mobilisation authorisation. Site Service and Event remained separate source records; Event staffing and attendance remained separate.
- CRM list filters/search, Site search and source navigation were exercised read-only. The Site search narrowed 398 permitted Sites to 13 matching synthetic Sites and opened a linked exact Site. The pipeline showed current stage, owner, next action and a keyboard-equivalent stage selector.

### Responsive and keyboard evidence

- The built app used the system sans-serif stack. For the surveyed representative routes, `document.documentElement.scrollWidth === innerWidth` at 390px; no horizontal page overflow was observed. The original 390px survey found form/buttons at 32–42px and journey links around 20–21px. Domain-local CSS now gives visible practical buttons, fields and navigation links at least 44px at 390px. The recheck found zero sub-44px measured practical controls on 11 list/detail routes; Event and Site Service detail each also rechecked with one `main` landmark, no overflow and zero sub-44px measured practical controls at 390px.
- The initial Event and Site Service detail pages each exposed two `main` landmarks because a separate source-link wrapper preceded the detail client. Their operational links now sit in each existing detail navigation, leaving one `main` landmark. No attendance subroute was edited.
- In the existing CRM pipeline at 390px, a focused stage selector opened the dialog with focus inside; Shift+Tab wrapped within it; Escape closed it and returned focus to the selector. An in-browser simulated rejected POST left its error inside the open dialog. Event create and change dialogs each opened with focus inside, retained Shift+Tab in the dialog, closed with Escape and returned focus to the initiating control. Representative CRM, Event and Mobilisation navigation links had visible solid focus outlines (2–3px). These are targeted keyboard observations, not a full screen-reader audit.
- A browser-only simulated CRM activity POST followed by an inconclusive readback retained the entered subject, showed an error, and showed no success. The simulated POST did **not** reach the server or create a record. No suitable disposable existing record was identified for a normal CRM, Event, Site Service or Mobilisation write; real server acceptance → exact-record readback was therefore **not** demonstrated in this close-out. The implemented client and server contracts were inspected, but source tests and simulated responses are not a substitute for that readback.

### Defects corrected and limits

- Corrected only the observed mobile target-size and duplicate-main presentation defects in UI06-owned files. No global CSS, shared UI02 primitive, UI03 path, 19A/20E file, API, migration, Supabase state or business rule was changed.
- One synthetic Office browser session expired during an attempted readback simulation; the server returned a cookie-mutation error before that test ran. A fresh authorised session restored read-only page access, and the simulation was rerun successfully. This auth-expiry error was not fixed in this UI-only lane and was not counted as passing UI evidence.
- Screenshots and Playwright snapshots from the local browser session are in `.playwright-cli/`; a representative 390px Organisation screenshot was visually inspected. The controls and overflow checks were DOM measurements at exact widths. No formal screen-reader run, all-persona permission sweep, normal business write/readback, staging or production check was performed.

**Close-out decision requested:** David can review this evidence and the actual UI to decide whether to mark **TASK-UI06 — ACCEPTED AND CLOSED — SYNTHETIC DEVELOPMENT** with the normal write/readback and screen-reader limits retained. No further UI wave has started.
