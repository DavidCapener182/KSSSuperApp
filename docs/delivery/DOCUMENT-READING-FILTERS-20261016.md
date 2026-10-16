# Staff My Documents reading filters

Date: 16 October 2026. Baseline: `a216616cb41899f6476b2788219f63eb0de7b5fe`.
Checkout: `/tmp/kss-my-documents-filters-20261016` (new independent Git checkout). The original dirty checkout and frozen My Work artifact were preserved.

This is the parent/coordinator-approved presentation slice of [Documents / Knowledge / Apps](https://trello.com/c/2Cot8fT5), within the existing TASK-19A controlled-document contract. The broader card remains incomplete. No new document domain, duty feature or access authority is included.

## Behavior

Staff can search the titles and context labels already displayed in their returned reading list and combine that search with a reading-status filter. Search trims surrounding whitespace and ignores case. IDs, target identifiers, dates and undisplayed metadata are not searched. It makes no additional API requests.

The existing exact document/version grouping runs before filters. Multiple returned assignments for one exact version still produce one card, with the same selected current/opened assignment ID, context aggregation, required/opened/acknowledgement facts and ordering. Counts describe returned document-version cards rather than assignment rows or organisation-wide totals.

Status options are mutually exclusive, using this precedence:

1. Conflicting versions: any conflict flag in the exact-version group.
2. Historical: no current assignment remains in the group, including acknowledged history.
3. Acknowledged: a current group has the existing aggregated acknowledgement fact.
4. Opened, not acknowledged: a current group has an opened fact and no acknowledgement.
5. Not opened: a current group has neither fact.

All reading statuses is the default. Optional reading is not described as requiring acknowledgement by the new filter. The existing card wording and action logic remain unchanged. A current older/superseded version is not invalidated by its number or inferred publication state: the returned current/conflict facts remain authoritative.

Clear filters restores the full returned list. A filtered zero result has a specific No matching documents message. Initial loading and failed source refreshes do not show empty-success wording or stale reading cards/counts. Current exact PDF links, conflict restrictions, historical access-ended wording, explicit checkbox confirmation and exact-assignment acknowledgement handlers remain unchanged. The manager forms and operational-context sections are byte-identical to the baseline.

Filters use transient component state only. No document metadata or search text is persisted in localStorage, sessionStorage, a URL, a cookie or a new service. Existing guarded source APIs still determine list/file/acknowledgement access on each request.

## Checks executed

- `node --test tests/document-reading-filters-local.test.mjs`: **7/7 pass**. Runs the real pure projection and client handlers with synthetic boundaries. Covers exact grouping and selected identity, status precedence, title/context intersections and metadata exclusion, loading/denial presentation, clear/no-match states, no filter-driven requests or acknowledgements, failed reading refresh after an acknowledgement, and absence of Staff filters/reads from a non-Staff view.
- `KSS_PLAYWRIGHT_MODULE=/Users/davidcapener/.npm/_npx/e41f203b7505f1fb/node_modules/playwright node --test tests/document-reading-filters-browser.spec.mjs`: **3/3 Chromium subtests pass** (**4/4 Node test count** including the parent). The fixture copies actual product component/helper/CSS files and returns synthetic API projections. It checks each status/count, combinations, grouped-context search, clearing, no metadata-driven queries, restricted/empty responses, keyboard tab/Enter, no browser persistence, exact selected file navigation, deliberate exact-version acknowledgement, and no file/ack actions for conflict/history.
- **16 layout captures** at 390px/1280px have `scrollWidth == viewport` and no off-screen inputs/selects/buttons/links. The grouped-context mobile capture was visually inspected. See `output/document-reading-filters-20261016/layout-results.json`, PNG captures and SHA-256 source manifest.
- `npx next typegen`, `npx tsc --noEmit`, focused ESLint on changed TypeScript/client/tests, and `git diff --check`: **pass**. Node reports its existing module-type inference warning when directly loading the pure TypeScript helper; package configuration was not changed.
- A source comparison confirmed the entire manager JSX region and original exact file/acknowledgement action region match the baseline. Only Staff reading state/projection/UI and new scoped filter styles were changed.

## Limits

The browser fixture has no authentication and does not prove live RPC/RLS, private PDF bytes, actual version access or server acknowledgement acceptance. It simulates file/action responses using synthetic assignments. No credentials were loaded or attempted, no live acknowledgement was sent, and no auth workaround/reset was performed. Authenticated acceptance remains pending authorised working access. No full production build or remote regression was run in this worker lane; coordinator integration checks remain separate.

No API, auth, capability, policy, RPC, migration, package, global CSS or existing operational document stylesheet changed. No push, merge, deployment or Trello write was performed. Parent/coordinator owns integration and the existing card update.
