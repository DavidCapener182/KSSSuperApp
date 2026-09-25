# TASK-UI08 Management Reporting UI batch

Status: implemented locally on the isolated `task-ui08-reporting` branch; not accepted, integrated or deployed. Baseline `eb65cfcf8b740338523db41a170d98c2fd3f307d`. The saved project checkout was not edited.

## Scope and design basis

Read `AGENTS.md`, delivery status and decisions, accepted TASK-23B brief/report, the UI01 inventory, competitive research, journey audit, design-system audit and roadmap in the saved project, and Next 16 client-component/page guidance. The work stays inside the accepted Office/Super reporting route and its existing guarded, uncached read contract. No data or authority contract changed.

The interaction review used [Power BI's documented drillthrough](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-drillthrough) for labelled movement from summary to source context and its [accessibility guidance](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-accessibility-creating-reports) for keyboard-visible, non-tooltip facts. UI01 also identified Tableau and Geckoboard as pattern comparators. These are public documentation patterns, not hands-on product benchmarks. KSS retains its own factual terms and scope.

## Implemented

- Each period measure now has an explicit, keyboard-accessible source-line link. The selected measure is visually indicated, while the line list keeps Required, Allocated, Accepted and Remaining visible separately. The page states that totals span all authorised lines and the displayed list is paginated.
- Filter disclosure shows the active filter count and provides a clear action. Date and source controls now meet a 44px minimum; local focus styling remains visible.
- A loading transition hides the previous snapshot so stale figures are not presented as the new selection. Empty breakdowns and source-line pages have explicit wording. Historical-unavailable and incomplete coverage remain separate from zero demand.
- Changes are local to the Management Reports client and CSS module. No new aggregate, score, export, status colour, source write or role grant was added.

## Checks and limits

- `next typegen`, TypeScript `--noEmit`, focused ESLint and `git diff --check`: passed after linking the existing dependency installation into this isolated worktree.
- Webpack build compiled but failed while prerendering the unrelated `/staging-access` page because this isolated worktree has no Supabase URL/key environment. It is not a reporting compile failure; no credentials were copied.
- Authenticated desktop, genuine 390px viewport, keyboard traversal and source-record readback have **not** been run in this worktree. CSS review shows one-column cards/rows at <=600px, 44px controls and wrap rules, but does not establish measured overflow or focus behaviour. These checks remain necessary before acceptance.
- No fresh source aggregate reconciliation was run because the read contract and query implementation were unchanged. TASK-23B's accepted synthetic-Dev evidence remains the contract baseline, not a new UI08 acceptance result.

## Deferred contracts and handoff

A frozen multi-page snapshot, historical reconstructability, new measure/version, export, saved view, aggregate facet or source read requires a separate bounded product proposal. UI02 may consider a shared filter/metric-card pattern after reviewing this local implementation; this task did not edit shared primitives, shell or navigation. TASK-19A and TASK-20E boundaries were untouched.
