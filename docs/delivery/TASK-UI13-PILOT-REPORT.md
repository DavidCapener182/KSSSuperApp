# TASK-UI13 — controlled two-route integration pilot

Status: **ACCEPTED by David in synthetic Development on 25 September 2026**. David reviewed the shell-framed study and the authenticated Management Reports and Assets pilot at `f4a6d28`. UI13's shared visual direction and primitives are accepted; controlled rollout in reviewable route groups is authorised. This acceptance does not approve a mechanical whole-repository replacement, staging, production, live data or a new business interpretation. UI14 retains record-page anatomy and UI11 remains the accepted shell. The shell was merged at `f13d3d9` before this pilot; the pilot did not edit shell or navigation code.

## David's acceptance and rollout boundary

David approved the compact Management Reports metric strip and drill-down, the dense Assets register, the factual condition label, the secondary history/action control, and the collapsed administrative grants. The two routes retain distinct layouts within one KSS visual language. The genuine 390px checks and saved mobile screenshots below satisfy this pilot's mobile engineering gate. The actual visual review is now complete; no further gate is needed before a separately scoped rollout group.

Controlled groups may cover suitable lists/workspaces, Staff self-service, then Operations/admin routes. Each group must be reviewed for source contracts, permissions, exact terminology, write/readback behaviour, desktop and genuine 390px usability, focus, practical targets and page overflow. Keep the accepted Workforce planner, UI11 shell and UI14 record anatomy intact. Escalate domain conflicts instead of forcing a primitive. No additional route was changed in this acceptance update.

The accepted source-card contract is identity, context and factual state, with freshness, metrics and action optional. Blue is reserved for selected/primary/source context; amber for attention; red for rejection, error and destructive meaning. No generic green success styling or derived readiness/compliance/performance score is authorised. Reporting Required, Allocated, Accepted and Remaining remain distinct; incomplete coverage and historical unavailable do not mean zero. Asset custody, location, condition, repair, exception, expected return and availability to issue remain separate.

David noted that “Measure definitions and versions” looks visually orphaned. Its reporting meaning stays unchanged; review its visual hierarchy in a later Management Reports integration touch. It does not block this acceptance.

## Scope and source boundaries

- Management Reports keeps the existing `/api/management-reports` read, filters, pagination, source links and measure definitions. The five period measures remain separate. Incomplete static coverage retains its explicit text and is not presented as zero demand. Historical unavailable is rendered as an unavailable state, without a zero total. No readiness or compliance score was added.
- Assets keeps its existing `/api/assets` read, authority and guarded write handlers. The register, selected asset card and mobile list present custody, last location, condition, repair, exception, expected return and availability separately. No asset was created or changed for this pilot. `/my-equipment` and other routes were not migrated.
- Both desktop tables and mobile rows map the same authorised arrays (`report.lines` and `visibleItems` respectively). The UI13 wrappers decide no access or business state.

## Browser evidence

The local production build was opened through the authorised localhost browser in an authenticated synthetic Super Admin session. The 390px captures are genuine browser viewport changes, not CSS simulation. The report mobile capture uses Today, one Site Service filter and the Accepted measure selection. The Assets mobile capture searches one existing synthetic asset and opens its read-only history. These narrower views make source fields readable in a full-page capture; the desktop captures show the default dense views.

| Route | 1440px desktop | 390px mobile |
| --- | --- | --- |
| Management Reports | [Screenshot](../ui/evidence/ui13/management-reports-1440.png) | [Screenshot](../ui/evidence/ui13/management-reports-390.png) |
| Assets | [Screenshot](../ui/evidence/ui13/assets-1440.png) | [Screenshot](../ui/evidence/ui13/assets-390.png) |

Browser readback found `document.documentElement.scrollWidth === innerWidth` at both 1440px and 390px for each route. At 390px, the desktop table wrapper computed to `display: none` and the mobile list displayed. Management Reports showed 30 desktop source rows in its default page and two mobile rows after the authorised source filter. Assets showed 59 desktop register rows and one mobile row after search. The report mobile rows retained source and parent UUIDs, date, source state, definition version and all four staffing measures; Assets mobile retained custody, last location, condition, repair, exception, expected return and availability. The Assets visible main controls had a minimum measured height of 44px. Route CSS and shared shell CSS provide 44px minimums and visible `:focus-visible` outlines for the relevant controls; the focused Assets search control was visibly outlined during browser inspection. Long source labels wrap, and the mobile status label is kept intact. No horizontal overflow was observed.

The synthetic browser session changed to a Staff persona during one filter attempt, making the report unavailable. Signing in again as the authorised synthetic Super Admin restored the report; the same filter then returned two source lines. This was an access-session interruption, not a zero-data result. No password or session token was saved in this report or the screenshots.

## Checks and limits

- `npm run build` passed with production Webpack and TypeScript; `/management-reports` and `/assets` built as dynamic routes.
- Focused ESLint, standalone `tsc --noEmit` and `git diff --check` passed.
- No API, role-policy, database, migration, staging, production, live-data or other-route change is part of this pilot.
- Browser checks are representative visual and safe read interactions, not a full regression. David subsequently accepted the visual direction and this two-route pilot. Further migration must remain grouped and reviewable.
