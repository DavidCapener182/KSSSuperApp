# TASK-UI14 controlled record rollout — 25 September 2026

David accepted the Event, CRM Organisation, Incident and Service Delivery visual studies and authorised the shared record anatomy on five additional routes: Opportunity, Onboarding case, Mobilisation, Site Book and Site Service. The anatomy is identity, factual context, relevant existing actions, section navigation and domain-owned content. The five routes retain their different content layouts.

The owned implementation is limited to client presentation and scoped CSS. Existing APIs, source reads, write handlers, route gates, role checks and persisted state are unchanged. Staff Record, Event attendance detail and Event work-time detail remain outside this rollout. No staging, production or real data was used.

Verification in an authenticated local production preview with synthetic Development data: `npm run build` (Webpack/Next 16.3.6), `npx tsc --noEmit` and targeted ESLint passed. Each of the five routes loaded source content at 1280px and genuine 390px. At 390px, the document scroll width was 390px on each route; section links measured 44px high and scrolled inside their own viewport. A keyboard focused Site Service link had a computed 3px outline. Site Book History preserved the hash and selected state; natural page scroll selected Add a fact. Service Delivery's long management workspace showed only the chosen content section while keeping all sections available through links and hashes. Its deep-linked History selection remained visible within its mobile selector. Screenshots and exact route observations are in `docs/ui/TASK-UI14-RECORD-PROTOTYPE-REPORT.md`.

The Site Book sample was opened under Super Admin oversight. Synthetic Staff A had no current book in the list and the sampled direct record returned Not found under that persona. This is an access-boundary observation, not a Staff layout verification. No source mutation was used to fabricate a Staff book.

This is implementation and local browser evidence for the controlled rollout. David has not yet visually accepted the five new route captures, and this worktree has not been deployed or merged.

## Visual review and bounded refinement

David visually accepted Opportunity and Onboarding from the rollout captures. Mobilisation's header and anatomy were accepted, but its full continuous record was not. The detail now shows one of its seven existing sections at a time, with selected state and URL hash. Its workstream state buttons sit under native per-action disclosures; the current action state remains visible and the original guarded commands remain unchanged. Local Webpack build, TypeScript, ESLint and authenticated 1280px/390px browser checks passed; the final four focused images are linked in the UI14 report. Mobilisation awaits visual acceptance of this revision. Site Book and Site Service remain pending screenshot review. No other route was migrated.
