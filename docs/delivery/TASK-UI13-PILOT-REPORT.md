# TASK-UI13 — controlled two-route integration pilot

Status: **implemented in synthetic Development; awaiting David's visual review**. UI13 primitives are used on `/management-reports` and `/assets` only. Broad rollout remains unauthorised. UI14 retains record-page anatomy. The accepted UI11 shell was merged at `f13d3d9` before this pilot; this change does not edit shell or navigation code.

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
- Browser checks are representative visual and safe read interactions, not full regression or human acceptance. David's review of the four screenshots is the next UI13 gate. No third route is authorised by these results.
