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
