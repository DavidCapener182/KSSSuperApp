# TASK-01D implementation report

**Date:** 22 September 2026
**Status:** implemented and verified in the local build and dedicated KSS Enterprise Dev project; awaiting David's acceptance. TASK-01E has not started.

## Delivered

- Added `/app` Home and read-only `/profile`; retained `/sites` and its 01C Site journey within one protected shell. No other business page or App launcher was added.
- The server capability map supplies Home, Profile and Site navigation and the Site page gate. Operations sees Home/Profile only; Super Admin, Office Admin and Security Staff see Sites. A pure Staff account's Home label is “My Work”. Site records still use the 01C server policy and PostgreSQL RLS.
- Every protected page resolves Supabase Auth → AuthIdentity → stable Person → current database roles. The sign-in entry distinguishes invalid authentication from signed-in users with no Enterprise access. `/api/me` returns only current self identity, roles and allowed navigation, with private no-store handling.
- Signed-out deep links retain only allowlisted local `/app`, `/sites` and `/profile` targets. The proxy overwrites caller-supplied return-target headers. Sign-out clears the Supabase session and replaces the protected history entry.
- The shell exposes identity, active roles, Development status, keyboard-accessible links with `aria-current`, and sign-out. It renders no invented operational metrics or external app links.

## Development project changes

Only project `dnfhkmmnlbiabqypclqg` was used. `supabase/seed-01d.sql` records DML for two new synthetic People, AuthIdentity mappings and roles: Operations (`...0007`) and Security Staff with zero SiteAssignments (`...0008`). A third confirmed synthetic Supabase Auth user is deliberately unmapped. Passwords are stored only in ignored `.env.test.local`. No live identity or KSS data was imported.

Readback found the two expected active roles, zero SiteAssignments for Staff Zero, and zero AuthIdentity mappings for the unmapped user. Migration readback remained exactly the four pre-01D versions: `20260922213315`, `20260922221737`, `20260922221814`, `20260922222600`. **No migration or database object was created in 01D.** A temporary synthetic Operations role on Office B was granted and expired by the multi-role test, leaving an audit trail and no active extra role.

## Verification

| Check | Result |
|---|---|
| `npm ci --ignore-scripts` | Pass; 369 packages installed, npm audit reported zero vulnerabilities. |
| `npm run lint` | Pass. |
| `npm run build` | Pass with webpack; `/`, `/app`, `/sites`, `/profile` are dynamic routes. |
| `npm run smoke` | Pass. |
| `npm run test:access` | Pass on retry. First run stopped at a Supabase Auth `fetch failed` before assertions; no code change was needed. |
| `npm run test:sites` | Pass, including 01C server, RLS, lifecycle, GraphQL and audit checks. |
| `npm run test:shell` | Pass: local-target validation, anonymous/unmapped/expired-role denials, exact role navigation, Operations direct Site denial, zero-site Staff, Office/Staff API negatives, temporary multi-role union without broader Site records, and forged return-header rejection. |

Browser demonstration used the local production build. Operations showed Home/Profile and no Sites. A signed-out `/sites` opened sign-in and returned to `/sites` after Super Admin authentication. Super Admin and Office showed Home/Sites/Profile; Office's populated Sites included the creation form. Assigned Staff showed “My Work”, one assigned active Site and its reporting-point detail. Zero-site Staff showed an empty Sites list. The unmapped Auth user showed “No Enterprise access” with no shell. On a 390px viewport, Home, Profile, Super Admin Sites, populated Office Sites and zero-site Staff Sites measured `scrollWidth=390` with `innerWidth=390`; active navigation reported `aria-current=page`. Sign-out followed by browser Back displayed sign-in, not protected content. The browser used synthetic accounts only.

## Targeted security review

Reviewed the changed sign-in, proxy, protected layout, Site page, capability map, `/api/me`, and Site policy. Route hiding does not stand in for authorisation: `/sites` checks `SITES_VIEW` on the server, while `/api/sites` retains its own check and row scope. `/app` and `/profile` require a fresh mapped Person with an active database role. Query and forged-header return targets cannot become external redirects. The browser client receives only the publishable Supabase credential; no service-role or secret key is referenced by the shell. `Person.id` remains distinct from the Supabase Auth subject. The 01C Site API/RLS regression suite passed after the route move.

No high-severity 01D issue was found. The existing webpack/Turbopack development-tool issue and previously recorded 01C debt remain open. The first Auth fetch failure was transient; it was followed by passing access, Site and shell suites. The 01D empty-state wording correction was made after the initial browser run and included in the final rebuild/check.

## Proposed TASK-01E for approval

Prepare a **bounded Site assignment review UI** for Super Admin and the already-authorised narrow Office delegation, using the existing SiteAssignment APIs, expiry/revocation rules and audit history. First write a brief that defines exact screens, fields, role/site scope and negative tests. Do not implement 01E until David approves that brief. No HR, shifts, external integrations, live data, new schema or deployment is proposed by this report.
