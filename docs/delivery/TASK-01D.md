# TASK-01D — authenticated application shell and honest navigation

**Status:** approved by David and implemented locally on 22 September 2026. TASK-01C is accepted at `54cb354`. See `TASK-01D-REPORT.md` for actual results and remaining limits.

## Exact outcome

A mapped, currently authorised synthetic user signs in and lands in a coherent KSS Enterprise shell. The shell shows the user's stable Person identity, currently active database roles, sign-out and only entry points backed by implemented capabilities. It works on desktop and a 390px mobile viewport. Navigating by URL remains subject to server checks: hiding a link never grants or removes access. The shell reports development status and current capabilities, with no invented business metrics or empty ERP sections.

The scope is navigation, page framing and permission routing around the existing Person and Site records. No new business-data domain or integration is included.

## Current implementation and boundaries

- `/` is the existing synthetic Supabase Auth sign-in and 01B access-proof page. `/sites` is the existing 01C Site journey. `/api/me`, `/api/people/[id]`, `/api/sites` and `/api/sites/[id]` already apply the established identity and Site rules; role and Site assignment actions exist as APIs.
- `getPrincipal()` resolves `AuthIdentity → Person` and active roles from database rows on each request. Supabase Auth user ID remains distinct from `people.id`. JWT/user metadata is not role authority. The Site server policy and PostgreSQL RLS remain authoritative.
- `SUPER_ADMIN` can review all Sites and has existing access-management APIs, but there is **no current administrative page**. `OPERATIONS` has no Site capability. No verified, approved URL/configuration exists in this repository for Footasylum Audits, MagSecure or the training platform.
- The 01C technical debt remains separate: legacy null-end synthetic assignments, already-expired “Expire now” UI action, one non-reproducing HTTP 400, existing GraphQL schema discoverability warning and webpack/Turbopack issue. Do not repair these merely while building 01D.

## Smallest proposed route/page change

| Route | Proposed 01D behaviour | Gate |
|---|---|---|
| `/` | Keep sign-in as the public entry. After successful sign-in, route to the safe internal destination requested before login or to `/app`. A signed-in mapped user visiting `/` may continue to `/app`. | No Enterprise shell for anonymous or unmapped Supabase Auth users. |
| `/app` | New minimal authenticated Home: Person display name, active roles, development notice and links to currently permitted capabilities. An authorised Site count may be shown only through the existing scoped Site API; it is optional and is not an operational KPI. | Fresh mapped Person and at least one active database role. |
| `/sites` | Preserve the URL and current Site behaviour while placing it inside the shared shell. Preserve existing Site deep links/API IDs. | `SUPER_ADMIN`, `OFFICE_ADMIN` or `SECURITY_STAFF` with an active role. All Site rows/actions retain their existing scope checks; `OPERATIONS` alone receives 403/404. Staff with zero assigned Sites may open the empty Sites page. |
| `/profile` | New read-only self page using the already authorised Person fields (`id`, `display_name`) and current role names. No HR, contact, vetting or account editing. | Fresh mapped Person and active role; self only. |
| Existing `/api/*` | Preserve current endpoints and RLS. Any shell bootstrap response may be extended minimally with server-computed capability identifiers; it must not become a separate authority store. | Existing per-route checks remain. |

Do **not** create `/admin`, `/people`, `/apps`, `/tasks` or module pages in 01D merely to populate a menu. The existing Super Admin mutation APIs remain usable for their current proof/testing workflow; an administrative UI requires a later bounded brief. If a verified app URL and authorised audience are supplied before implementation approval, revise this brief explicitly before adding an Apps route or launcher.

A practical implementation shape is a protected App Router route group with a shared server-rendered shell layout, an `/app` page, a `/profile` page and the existing `/sites` page moved under that group **without changing its public pathname**. Split the existing Site client interaction from a server page guard if needed. The shared layout authenticates and resolves the current principal; `/sites` also applies its own capability guard. The exact component split can be adjusted during implementation while preserving these route and security contracts.

## Role-to-navigation matrix

A tick means the link is shown **and** the route's server gate allows the role. Site records inside `/sites` remain further limited by 01C policies.

| Active database role | Home `/app` | Sites `/sites` | Profile `/profile` | Admin UI | Apps/launch links |
|---|---:|---:|---:|---:|---:|
| `SUPER_ADMIN` | Yes | Yes: all Sites/review under 01C | Yes: self | None exists; omit | Omit pending verified URLs/audience |
| `OFFICE_ADMIN` | Yes | Yes: creator-owned Sites and narrow assignment delegation | Yes: self | Omit | Omit pending verified URLs/audience |
| `OPERATIONS` | Yes | **No** | Yes: self | Omit | Omit pending verified URLs/audience |
| `SECURITY_STAFF` | Yes, labelled “My Work” entry | Yes: active assigned Sites only | Yes: self | Omit | Omit pending verified URLs/audience |
| No mapping or no active role | **No Enterprise shell** | No | No | No | No |

Home may use “My Work” as a label for Security Staff's Home entry, but it is **not** a Tasks or shifts module. No Expenses, Training, Documents, Questions, CRM, Finance, Events, Compliance, Reporting or incident links are shown. For multiple active roles, take the union of currently authorised route capabilities, deduplicate links and use the broadest *existing* Site rule only where that role truly grants it. A `SUPER_ADMIN`+`SECURITY_STAFF` user has Super Admin Site review; `OFFICE_ADMIN`+`OPERATIONS` does not gain new Operations permissions. Display all active role labels without implying new access.

## One authority for navigation and routes

Define a small server-side capability map over the existing `Principal` role codes, e.g. `HOME`, `PROFILE_SELF`, `SITES_VIEW`, `SITES_MANAGE`, `ACCESS_API_ADMIN`. Its role-to-capability mapping lives beside the existing server authorisation code, not as an independently maintained front-end permission table. Use it to generate navigation descriptors **and** guard each page route. Continue to call the 01C Site policy and RLS for record-level scope. `ACCESS_API_ADMIN` describes existing Super Admin APIs and creates no Admin menu page.

`getPrincipal()` must run for protected page requests and reads current `role_assignments` and AuthIdentity mapping. Do not cache roles or permitted Site IDs across requests or infer them from JWT/user metadata. Navigation responses/pages must use private, no-store handling. Client navigation should refresh the current capability view on route change or visibility return so a role that expires while the shell remains open does not leave a stale menu; server route/API checks remain the decisive denial on the next request. Sign-out clears the Supabase session, replaces the protected history entry with `/`, and refreshes; browser Back must not reveal protected content. A protected deep link opened while signed out should return through sign-in to that same internal path after authentication, then apply its current route gate. Accept only a validated local pathname/query as a return target; never redirect to an external or protocol-relative URL.

For an authenticated Supabase user with no active Enterprise AuthIdentity→Person mapping, or with no active database role, show a plain “No Enterprise access” state on the sign-in page and deny protected routes/API access. Do not show the shell, Person data or role-specific links. An expired role is removed on the next server request; if it was the user's only role, the same no-access behaviour applies. A failed or unavailable principal lookup fails closed.

## App-link configuration approach

Prepare an empty, typed server-owned catalogue/configuration boundary for possible Footasylum Audits, MagSecure and training-platform launch links, but render **no Apps navigation or launch link in 01D** because the project has no verified destination URLs, owner/audience decision or approved link mode. Do not copy URLs from another KSS project or infer a training provider. Before a later task activates any entry, record its owner, verified canonical HTTPS URL, allowed Enterprise roles/site scope, whether a destination sign-in is separate, and the date/source of verification. Reject arbitrary user-supplied URLs and open only allowlisted destinations. A launcher is labelled as an external app; it carries no SSO, API, sync or data-freshness claim. No secrets or tokens are placed in URLs.

This can be a zero-entry TypeScript config/interface in 01D; it needs no database table. If even that structure adds no value during implementation, document the deferred contract and omit the file.

## Desktop, mobile and accessibility contract

Use the existing visual language with a small shared KSS header, development indicator, Person/role context, active primary link and sign-out. Do not redesign the product. Desktop navigation can be horizontal/side navigation; at 390px use a compact labelled menu or stacked links that expose only current capabilities. The menu must be operable with keyboard and screen reader, have visible focus, sensible button labels, current-page state (`aria-current` or equivalent), Escape/close behaviour if it opens a disclosure, and no focus trap or hidden focusable links. Use text as well as colour for active/disabled/development states. Route changes and sign-in/sign-out should preserve browser Back and focus expectations. Measure `documentElement.scrollWidth <= innerWidth` on Home, Sites and Profile, including a populated Office Sites view.

## Tests and browser demonstration required for implementation acceptance

1. Fresh install by the documented method, lint, webpack build, smoke and the existing 01B/01C access suites pass. Verify no credential enters the client bundle or Git.
2. Normal synthetic account sign-in shows the matrix above. Create source-controlled **synthetic-only** fixtures as needed for `OPERATIONS`, a mapped multi-role user and an authenticated-but-unmapped Supabase user. Keep passwords in ignored local environment files. No live identities.
3. Anonymous and unmapped users cannot render `/app`, `/sites` or `/profile`; direct HTTP requests reveal no Enterprise shell or protected data. A signed-in account with an expired only role loses shell/navigation and API access on the next request. Multi-role union is tested without broadening record scope.
4. Security Staff's direct request to any Office/Super Admin-only action is denied; Office's direct request to Super Admin role APIs is denied. `OPERATIONS` alone cannot open `/sites`, use Site APIs or acquire Site navigation. Repeat direct-ID/list/search/count negatives from 01C where the shell changes routing.
5. Hidden navigation is tested as presentation, then routes and APIs are independently requested to prove server denial. A Staff member with zero Sites sees an honest empty Sites view rather than a fabricated module.
6. Deep-link round trip: signed-out `/sites` or `/profile` returns through sign-in to the original local path; a forbidden destination stays forbidden after sign-in. Reject an external `next` target. Sign-out and browser Back do not reveal protected shell content.
7. Browser demonstration at desktop and **390px**: Super Admin, Office, Operations and Staff menus/Home/Profile; Staff reaches its assigned Site; Office reaches Site management; unmapped user sees no shell; keyboard/focus and active-link states are inspected; no page-wide overflow on all three pages. Record actual browser results and any unresolved issue.
8. No new migration is expected. If implementation discovers a genuinely necessary configuration model, stop and request a revised 01D approval before schema changes. Read back the dedicated development project only for the access fixtures/roles used in tests; do not modify other Supabase projects.

## Expected files and rollback

Likely edits, subject to the approved implementation design: `src/app/page.tsx`, `src/app/layout.tsx` or a protected route-group layout, the existing `src/app/sites/page.tsx` (possibly moved without URL change), a small shell/navigation component, `/app` and `/profile` pages, `src/lib/auth/principal.ts` or an adjacent shared capability policy, `src/app/api/me/route.ts` only if a minimal capability readout is useful, `src/app/globals.css`, focused route/navigation tests, and delivery report/status/decision files. A zero-entry app-link configuration file is optional. Existing role/Site API implementations should change only if the shell exposes a concrete mismatch.

Prefer **no database migration**. Any synthetic Auth/role fixtures must be source-controlled without credentials and confined to `dnfhkmmnlbiabqypclqg`. A rollback is reverting the 01D UI/routes/config commit to the accepted `54cb354` application baseline; do not roll back 01B/01C migrations or delete audit records. Preserve deep links and document any fixture cleanup separately.

## Explicit exclusions and approval gate

No full dashboard, new business records, fake modules, real KSS data, HR/finance/incident/training metrics, Apps links without verified destinations, Entra/SSO, SharePoint, Footasylum Audits/MagSecure/training APIs, synchronisation, Vercel or production deployment. No opportunistic 01C debt repair. Use the economical implementation model for routine UI work; a bounded Sol security review is justified only for changed route/authorisation checks. No GPT-6 Astra without explicit approval and no unnecessary delegation.

**Approval gate:** David reviews this exact route matrix, sign-in/deep-link behaviour, Operations boundary, and empty Apps catalogue. Only a later explicit approval starts TASK-01D implementation. Implementation completion would require the tests and browser evidence above, a separate commit/report, and a stop before any next task.
