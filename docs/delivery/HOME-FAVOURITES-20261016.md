# Home module favourites — 16 October 2026

Delivered the parent-authorized favourites slice of [PAGE SYSTEM – Dashboard & My Work](https://trello.com/c/hNHU0Uqf). The card's broader dashboard/KPI and My Work ambitions are outside this change. Implementation lives in `/tmp/kss-home-favourites-20261016`, an independent checkout of published `a216616cb41899f6476b2788219f63eb0de7b5fe`. The original dirty checkout and Reporting handoff were not modified. Coordinator owns integration and publication; no commit, push or deployment was performed here.

## Result and persistence contract

Home now offers a Favourites section after existing Quick access. Users choose modules through native checkboxes, follow ordinary module links, remove individual favourites or clear them all. The empty/default state has no chosen modules. Display follows the current navigation order; custom ordering is outside scope.

The existing server `navigationFor(principal)` output supplies the candidate module list and current labels. Home itself is excluded. Paths must match the supplied exact static navigation entries; custom URLs, record URLs, queries, external destinations, unknown and unauthorized entries are discarded. Existing Quick access, scoped tasks, training capability reads, learning links and external-app shortcuts remain intact. Only the existing Home page plus three new source files changed; no existing Home CSS, capabilities, auth, API, global CSS, package/lockfile or migration changed.

Preferences use browser localStorage, under `kss-home-favourites:v1:<stable opaque Person UUID>`. The value is an array of at most 64 allowlisted module paths, with no labels, names, private record identifiers or other metadata. There is no generic/account-wide fallback, backend or synchronization. UI copy states: “Module shortcuts for your account in this browser. They do not sync to other browsers.”

Every render intersects saved selections with current authorized entries. Identity changes cannot display another account's state; Home also keys the component by Person identity. On load/role changes malformed and stale entries are pruned from storage, so restoring a role does not resurrect an earlier removed preference. Storage events reconcile the current account key. Invalid identity keys do not use a shared fallback. When reads or writes fail, the current selection remains usable for this visit with an explicit storage-unavailable notice; reload cannot restore unsaved changes. Clearing favourites persists the empty default.

## Exclusive deliverables

- `src/app/(enterprise)/app/page.tsx` — import/render and reuse the existing server navigation result.
- New `src/components/home-favourites.tsx` and `home-favourites.module.css`.
- New `src/lib/home-favourites.ts` (sole helper path; no nested `src/lib/home/favourites.ts`).
- New `tests/home-favourites-local.test.mjs` and `tests/home-favourites-browser.spec.mjs`.
- This report and `output/home-favourites-20261016/`.

## Actual verification

- **14/14 Home local tests pass**: account-key isolation, no global fallback, bounded/malformed preferences, exact allowlist, deduplication, role removal, unsafe paths, and actual Home server-component wiring retaining training reads/Quick access/learning/external shortcuts.
- **111/111 selected combined local tests pass**: Home 14 + Reporting 36 + document audience 30 + Staff production handlers 7 + TFS Person 20 + existing My Work filters 4. See `local-tests.tap`.
- **5/5 browser results pass**: two genuine Home+EnterpriseShell journeys at 390×844 and 1280×844, two read/write-storage failure journeys, plus the parent test. Covered keyboard Enter/Space, add/remove, normal module-link navigation, reload, reset, malformed/unauthorized saved entries, same-account Staff/Office role changes and pruning, two-account isolation, blocked reads and quota/denied writes. See `browser-tests.tap`.
- **8/8 measured responsive states** have document width equal to viewport. Evidence includes full-page and viewport captures for all eight states (16 images), plus `layout-results.json`. Mobile selected/storage-failure screenshots and a mobile viewport were visually inspected. Full-page captures can composite the existing fixed shell skip link into the stitched image; recorded live bounding top is -64 and viewport capture confirms it is offscreen when unfocused. No shared shell repair was made.
- Fresh production build passes: Next **16.3.6/Webpack**, TypeScript, **76 pages**. Dummy loopback Supabase settings only; `build.log`.
- Fresh serial `tsc --noEmit --pretty false` passes; `types.log` is empty success output.
- Full lint: **0 errors, 1 existing unrelated warning** at `tests/site-horizon-maintenance.test.mjs:10` (`officeId` unused); `lint.log`. Focused changed-file lint and browser syntax check pass.
- Built localhost smoke: **1/1 pass**, `smoke.log`.
- `git diff --check` passes.

An initial browser storage-failure run omitted the synthetic `/api/me` response and therefore triggered the shell's existing session redirect. Adding the same synthetic boundary used by the main journeys resolved the harness failure. The final recorded run passes; no product change was made for that test error.

## Reproduction and evidence

```sh
node --test tests/home-favourites-local.test.mjs tests/management-report-navigation-local.test.mjs tests/document-audience-local.test.mjs tests/staff-shift-entry-local.test.mjs tests/tfs-person-assignment-local.test.mjs tests/work-filters-local.test.mjs
KSS_PLAYWRIGHT_MODULE=/Users/davidcapener/.npm/_npx/e41f203b7505f1fb/node_modules/playwright node --test tests/home-favourites-browser.spec.mjs
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-local-only VERCEL=0 NEXT_TELEMETRY_DISABLED=1 npm run build
./node_modules/.bin/tsc --noEmit --pretty false
npm run lint
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-local-only npm run smoke
```

Locked dependencies were reused from the prior isolated Reporting checkout via a `node_modules` symlink; no dependency files changed. The browser runner can use another installed Playwright module through `KSS_PLAYWRIGHT_MODULE`. It copies the current production Home/client/helper/styles and real shell into a temporary Next app. `source-manifest.json` records all copied hashes and synthetic boundaries. Localhost binding and macOS headless Chromium used narrowly scoped sandbox exceptions; no desktop UI or remote service was used.

`final-source-hashes.json` identifies the exact final owned source, tests and report. The review-only text patch is `/tmp/kss-home-favourites-20261016.patch`; the corresponding source/tests/report/evidence archive is `/tmp/kss-home-favourites-20261016-handoff.tar.gz`. Their immutable SHA256 values are supplied in the final handoff.

## Limits and handoff

Browser identities and task/training/session responses are synthetic; the linked Sites destination is a local boundary. Tests do not establish actual session behavior, server module permissions, RLS, live Home tasks/training or hosted browser acceptance. Current server navigation remains the only candidate authority and destination pages retain their own authorization. Local preferences contain no permission grants. These local checks are not human acceptance or production readiness.

No execution blocker remains. This exact source/test/report/evidence snapshot is ready for independent coordinator review and integration. No further edits will be made after the final snapshot handoff unless specifically requested. No independent publication is authorized.
