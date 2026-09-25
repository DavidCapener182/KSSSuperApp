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

## Next bounded UI06 pass — Event dialog review pending

After David accepted the bounded CRM pipeline pass, the existing Event create/change dialogs received the same basic keyboard treatment: focus enters the dialog on open, Tab remains within enabled controls, Escape closes when idle, and close/cancel or a confirmed change returns focus to the initiating control. Error messages appear inside the open dialog. The previously added exact Event readback still governs success after create or change. This does not change Event lifecycle authority, staffing, attendance, source IDs, API or database behaviour.

Focused ESLint on `events-client.tsx`, Next.js 16.3.6 production Webpack build with placeholder public Supabase settings, `git diff --check` and edited-file no-green scan passed. Authenticated desktop, genuine 390px, keyboard tab order, screen-reader response and normal Event action readback were not tested in a browser. This new pass is pending David’s review. Earlier accepted UI06 work and its evidence remain separate; no deployment or live data use occurred.
