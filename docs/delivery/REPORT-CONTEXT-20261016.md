# Reporting context — 16 October 2026

Implemented the bounded Reporting context slice in `/tmp/kss-report-context-20261016`, based on published commit `13cce15060f0c561e43e71cfcf9aeecc7094ba16`. No commit, push or deployment was made. This checkout is independent of the dirty original and frozen release checkout.

## Behavior

Management Reports now keeps preset, mode, custom inclusive London dates, client/site/service/event UUID filters, source, 30-row page offset and selected measure in a validated canonical URL. Reload and browser Back/Forward restore that context. Custom API reads retain the existing exclusive end date. Selecting a measure retains its existing contributing-lines meaning and moves focus to the existing lines heading; it creates no new metric or server measure filter.

Malformed dates, IDs, unknown/duplicate parameters, unknown measures/modes/sources and invalid/out-of-range page offsets fail closed before report fetching. Invalid contexts expose a reset link. Runtime source values and IDs are checked before creating a source link.

Exact Event requirement and Site Shift demand links carry a validated report-only return context. Authorized Office/Super source pages offer the return link while preserving existing Control Room and Workforce return behavior. The validator rejects external/protocol-relative paths, encoded bypasses, hashes, nested/unknown parameters and repeated parameter arrays. Existing page/API authorization remains authoritative; the return link grants no access.

Requests clear prior report data on context changes or failure. Abort and sequence checks reject late bodies even when the fetch boundary ignores cancellation. Existing metrics, definition/version text, historical-unavailable behavior and current-versus-historical distinction remain intact.

## Owned deliverables

- `src/lib/reports/navigation.ts` (new shared report-only validator/serializer)
- `src/components/management-reports-client.tsx`
- `src/app/(enterprise)/management-reports/page.tsx`
- `src/app/(enterprise)/events/[id]/page.tsx`
- `src/app/(enterprise)/sites/[siteId]/services/[serviceId]/page.tsx`
- `tests/management-report-navigation-local.test.mjs`
- `tests/management-report-navigation-browser.spec.mjs`
- This report and `output/report-context-20261016/`

No report API, source detail client, auth helper, global CSS, package/lockfile, migration, permission or metric definition changed. Reporting CSS did not need modification.

## Actual verification

- Reporting helper and actual server-page mocked tests: **36/36 pass**. Includes duplicate/array returns, dates/DST/90-day boundaries, extreme-year end, scope gates, exact source identity and preserved existing navigation.
- Selected combined local regression: **93/93 pass** (Reporting 36 + document audience 30 + Staff handlers 7 + TFS Person 20). Log: `output/report-context-20261016/local-tests.tap`.
- Genuine headless Chromium at **390×844 and 1280×844**: **3/3 pass** (two journeys plus parent test). Real EnterpriseShell, report client/helper and source server pages; URL pagination/reload/Back/Forward, historical/current transition, measure focus, keyboard Enter to exact sources, return context, denied source response, completed late report body rejection, failed report clearing, malformed context with no report request, reset. Log: `browser-tests.tap`.
- **10/10 layout captures** have document width equal to viewport. Screenshots and `layout-results.json` are in the evidence directory; representative mobile report and desktop denied-source captures visually inspected.
- Production `npm run build`: **pass**, Next 16.3.6/Webpack, TypeScript and **76 pages**, with dummy loopback Supabase configuration.
- Subsequent serial `tsc --noEmit --pretty false`: **pass**.
- Full `npm run lint`: **0 errors, 1 existing unrelated warning** (`tests/site-horizon-maintenance.test.mjs:10`, unused `officeId`). Focused changed-file lint and browser syntax check pass.
- Built localhost sign-in smoke: **1/1 pass**, `smoke.log`.
- `git diff --check`: pass.

Browser development runs initially exposed harness issues: exact label matching on selects and navigating history before router URL commitment. Select role locators and explicit URL waits corrected these. The final recorded run passes; no product repair was made for these test failures.

## Reproduction

Install locked dependencies using the normal project setup. The browser runner needs Playwright available via `KSS_PLAYWRIGHT_MODULE` when it is not installed in this checkout. Recorded local command:

```sh
KSS_PLAYWRIGHT_MODULE=/Users/davidcapener/.npm/_npx/e41f203b7505f1fb/node_modules/playwright node --test tests/management-report-navigation-browser.spec.mjs
node --test tests/management-report-navigation-local.test.mjs tests/document-audience-local.test.mjs tests/staff-shift-entry-local.test.mjs tests/tfs-person-assignment-local.test.mjs
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-local-only VERCEL=0 NEXT_TELEMETRY_DISABLED=1 npm run build
./node_modules/.bin/tsc --noEmit --pretty false
npm run lint
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-local-only npm run smoke
```

The browser runner creates a temporary Next app and copies current owned production files plus the real shell/styles. `source-manifest.json` records the exact copied hashes and mocked boundaries; `final-source-hashes.json` records final owned source/test hashes. Localhost binding and macOS headless Chromium required the narrowly scoped sandbox exception; no desktop UI was used.

## Limits and handoff

All identities and API responses are synthetic. Browser principal/Supabase boundaries are stubbed; Event/Site detail client components are fixture boundaries so the test proves exact server-page props and return navigation, not their real authorized detail loading. Report and source API responses are intercepted locally; no database functions, RLS, actual historical facts, real sessions, credentials, grants or remote services were exercised. API source is unchanged. Local checks do not establish human acceptance or production readiness.

Coordinator owns independent stable-snapshot review, integration and any future publication decision. No new publication is authorized. No remaining execution blocker; files freeze after final handoff.
