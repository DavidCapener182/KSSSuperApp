# My Work source, status and search filters

Date: 16 October 2026. Baseline: `13cce15060f0c561e43e71cfcf9aeecc7094ba16`.
Isolated checkout: `/tmp/kss-my-work-filters-20261016`; the original dirty checkout was inspected read-only and not changed.
Scope: coordinator-confirmed bounded slice of [Build tasks/workflow MVP](https://trello.com/c/fBFJ2II7). The broader card is not complete.

## Delivered behavior

- Source: All sources, Documents, CRM (both existing CRM source kinds), TFS.
- Status: All statuses, Open, Covering, Done, Cancelled. Covering remains distinct from assigned Open work. Existing historical states are not changed.
- Case-insensitive substring search trims surrounding whitespace and combines with both filters. It searches task titles plus already-displayed document subject/request labels or CRM source labels; TFS searches its title and TFS label. Undisplayed TFS source metadata, IDs, URLs, next-action text and source-status fields are not searched.
- Clear filters restores all three controls and the original grouping. Filtered zero results show one No matching work state; the original unfiltered open/completed empty states remain. Loading and unavailable states contain no filter/results controls.
- The result summary explicitly counts returned tasks, not all database/organisation work. Existing server result bounds still apply. Controls do not query another source or fetch additional records.
- Exact `/work/<taskId>` document/CRM links, TFS `sourceHref`, TFS priority ordering, separate covering and historical groups remain intact. Source guards continue to own authority, completion and exact-version resolution.
- Local state resets on reload/navigation. URL persistence, new task kinds, task actions, boards, comments and broader workflow remain outside this slice.

Only the existing WorkClient changed in product source, with one new CSS module. No API, task policy, auth/capability, database, migration, package, navigation or global CSS changed.

## Verification executed

- `node --test tests/work-filters-local.test.mjs`: **4/4 pass**. Actual filter execution covers both CRM kinds, separate covering/open/history, source/status/search intersection, whitespace/case, undisplayed metadata exclusion, empty input and non-mutation.
- `KSS_PLAYWRIGHT_MODULE=/Users/davidcapener/.npm/_npx/e41f203b7505f1fb/node_modules/playwright node --test tests/work-filters-browser.spec.mjs`: **3/3 browser subtests pass** (4/4 Node test count including their parent).
- Chromium uses byte-for-byte copied product component/CSS and a synthetic local `/api/tasks` response in an isolated fixture app. It checks keyboard tab/Enter, filters and clearing, exact Document/CRM/TFS link navigation, TFS ordering, no extra requests from changing filters, no page JavaScript errors, loading, empty and HTTP 503 states.
- Nine captured states at 390px/1280px all have `scrollWidth == viewport` and no off-screen input/select/button/link. Mobile all-work and covering screenshots were visually inspected. See `output/work-filters-20261016/layout-results.json`, PNG captures and the SHA-256 source manifest.
- `npx next typegen`, `npx tsc --noEmit`, focused ESLint on component and both tests, and `git diff --check`: **pass**. Type checking initially lacked generated Next route globals; generating them resolved that baseline setup issue. The first browser run exposed select labels containing their options; explicit label bindings fixed this and the final browser run passes. A brittle development-mode request-count assertion was replaced with checking that filters trigger no additional requests.
- The sandbox initially denied loopback listening (`EPERM`); the approved escalated local fixture run completed successfully. No remote service was contacted by the fixture, no credentials were loaded, and no authorization settings were altered.

## Evidence limits and remaining gates

This is local component/projection verification, not live authorization or human acceptance. Existing synthetic signed-in Staff/Office credentials were reported failing; this worker made no authentication attempt, reset or workaround. End-to-end authenticated `/work` and exact source authorization/version readback remain pending working authorised access. No remote database/RLS suite or full production build was run in this lane; the coordinator owns integration checks. No push, merge, deployment or Trello write was performed. Parent owns the existing card update and should retain its broader unfinished scope.
