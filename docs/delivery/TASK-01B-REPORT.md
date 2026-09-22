# TASK-01B report — Supabase identity and scoped access

Date: 22 September 2026. Status: accepted by David as locally/development verified at commit `74c60fb`; the follow-up close-out below is recorded separately. TASK-01C has not started.

## Project boundary and implementation

- Dedicated project only: `dnfhkmmnlbiabqypclqg` (`https://dnfhkmmnlbiabqypclqg.supabase.co`, West EU/Ireland). No `KSS Platforms`, `ForeKingHell` or other Supabase project was changed for this implementation.
- One source-controlled migration: `supabase/migrations/20260922213315_identity_foundation.sql`; remote migration list confirms version `20260922213315`, name `identity_foundation`. The migration is additive and uses clean domain names without `ent_`.
- Six public tables created: `people`, `auth_identities`, `role_assignments`, `sites`, `site_assignments`, `audit_events`. All have RLS enabled. `auth_identities.person_id` references the stable Person UUID; the Supabase Auth UUID is stored separately as a provider subject.
- Private schema and four functions created: `private.current_person_id()`, `private.has_active_role(text)`, `private.has_any_active_role()`, `private.audit_assignment_change()`. The first three evaluate identity/dated roles from database records. The fourth records role/site assignment inserts and updates through `audit_role_assignment_change` and `audit_site_assignment_change` triggers. All use fixed empty search paths and qualified object references.
- RLS policies created: `people_read/insert/update`, `auth_identities_read/insert/update`, `role_assignments_read/insert/update`, `sites_read/insert/update`, `site_assignments_read/insert/update`, and `audit_events_read`. Public table grants were revoked from `anon`; `authenticated` has only required table operations, further constrained by RLS. There are no client delete policies. Only active `SUPER_ADMIN` can add or change access assignments. The initial access-review owner is `SUPER_ADMIN`.
- `supabase/seed-01b.sql` contains only synthetic Person, Site, role and assignment fixtures, including an expired Site B assignment and an expired role fixture. Synthetic Auth credentials are in ignored local `.env.test.local`, never in Git. The original Staff B credential failure was resolved in the close-out below.
- Browser code uses only the Supabase project URL and publishable key in ignored `.env.local`. No service/secret key is configured. Session identity is verified with `auth.getUser()` on the server; role and scope authority comes from database assignments on each request. Person and Site direct-ID routes enforce application checks before RLS. `/api/me` provides distinct Office and Security Staff proof views. Role/site mutation routes require `SUPER_ADMIN`. Responses are private/no-store.

## Acceptance evidence

| Check | Result |
|---|---|
| Fresh install | `npm ci` passed; 369 packages installed. npm noted an optional `unrs-resolver` postinstall script was not approved; build still passed. |
| Lint and production build | `npm run lint` passed; `npm run build` passed with Next.js 16.3.6 webpack and all API routes compiled. |
| HTTP smoke | `npm run smoke` passed after running outside the loopback-restricted sandbox. |
| Automated authenticated RLS and server tests | `npm run test:access` passed against the dedicated project through the browser-safe publishable credential and ordinary Supabase Auth sessions. |
| Anonymous access | `people` and `sites` table reads rejected; Person/Site API routes returned 401. |
| Staff A self and other Person | Staff A read its Person record (200); Staff B and a nonexistent Person ID both returned 404. RLS returned only Staff A's Person and count 1; Staff B query count 0. |
| Sites and expiry | Staff A saw assigned Site A (200) and could not read Site B (404). Site B's Staff A assignment was confirmed expired. Office saw assigned Site A but not unassigned Site B. |
| Expired role | Test temporarily expired Staff A's role through the ordinary authenticated Super Admin client. RLS then returned no Person/Site rows and the application returned 401. The test restored the role in a `finally` block; both changes were audited. |
| Self escalation | Staff A's direct role/site inserts failed under RLS, direct updates changed no rows, and app role POST returned 403. Office site POST returned 403. |
| Office path | Office's own Person and assigned Site A returned 200; another Person and Site B returned 404. No blanket Office bypass exists. |
| Provider mapping | An inactive synthetic `entra` provider-subject mapping was added to Staff A's existing Person ID; the Person ID stayed `10000000-0000-4000-8000-000000000003`. No Entra authentication was connected. |
| Browser | Local production app in Codex browser: Staff A signed in and saw `SECURITY_STAFF` plus Site A; Site B and Staff B Person checks showed “Not available to this account.” Sign-out returned to the form; Office signed in and saw `OFFICE_ADMIN` plus Site A. |
| Credential separation | `.env.local` and `.env.test.local` are Git-ignored. Built static assets contained no `sb_secret_...`, service-role token or synthetic test password. The package's own `sb_secret` warning string was present, without a key value. |

## Targeted security review

Reviewed session verification, cookie refresh, direct-ID routes, mutation routes, assignment parser, table grants, RLS policies, security-definer search paths, audit triggers, count responses, sign-out state and browser assets. No confirmed cross-person or cross-site access was found in the exercised paths. The review was performed locally by the implementation agent; it is not an independent second-agent review.

At initial 01B verification, the Supabase security advisor reported GraphQL table-name discoverability and disabled leaked-password protection. The close-out below records their current state. [Supabase lint 0027](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed), [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The local Supabase CLI was available but not logged in, so project linking through the CLI was not possible without a database credential. The project was accessed through the approved project-scoped Supabase tool; the local migration filename was aligned to the remote applied version. The migration and fixture SQL are reproducible source files. No Dashboard-only schema changes were made.

## Boundaries and next approval

No live KSS data was imported. Microsoft Entra, SharePoint, MagSecure, Footasylum Audits, training, PARiM, Finance, Vercel and production remain unconnected. `OPERATIONS` is a valid role code but its detailed permissions are still undefined. TASK-01C has not started.

The revised 01C proposal is in `TASK-01C.md` for approval only. It has not been implemented.

## TASK-01B close-out after acceptance

The accepted baseline remains commit `74c60fb`; this close-out is a separate follow-up. The dedicated project boundary and synthetic-only data rule remain unchanged.

**Staff B identity.** A replacement synthetic Auth user, `kss01b.staff-b2@example.test`, signed in successfully through ordinary Supabase Auth. The source-controlled seed now maps that Auth user to the original stable Staff B Person ID `10000000-0000-4000-8000-000000000004`. Database readback showed the original `kss01b.staff-b@example.test` Auth user has no Enterprise `auth_identities` mapping, while the replacement has an active mapping to that Person. The old Auth user is deliberately retired from Enterprise access; no password or reset token was exposed or committed. The expanded `npm run test:access` passed: replacement Staff B could read its own Person and Site B (database and application routes), could not read Staff A's Person, and Staff A still could not read Staff B's Person or Site B. The old Auth user remains in the development Auth user list as an unlinked synthetic account; removal is optional cleanup, not an active KSS identity.

**Leaked-password protection.** The organisation and project Dashboard show Pro. [Supabase's password-security documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) states this control is available on Pro and above. The project's Email provider offered an enabled toggle. `Prevent use of leaked passwords` was switched on and saved, then reopened and read back as on. A fresh Supabase security-advisor check no longer listed the leaked-password warning. No plan change or purchase was made. This is a project Auth setting, not a schema change.

**GraphQL warning.** The Next.js application uses Supabase's client Data API and does not call GraphQL; Phase 01 does not require GraphQL. The dedicated project has `pg_graphql` installed and its `/graphql/v1` endpoint responds. A synthetic Staff A session could introspect query fields named `audit_eventsCollection`, `auth_identitiesCollection`, `peopleCollection`, `role_assignmentsCollection`, `site_assignmentsCollection` and `sitesCollection`; an anonymous request saw only `node`. Staff A's GraphQL `peopleCollection` returned only Staff A's Person ID, and `sitesCollection` returned only Site A; the anonymous `peopleCollection` query was rejected as an unknown field. This is evidence of schema-name discoverability to signed-in users, and of RLS filtering the tested records. It does not prove every possible GraphQL operation safe. The advisor still reports six discoverability warnings. No table, grant, extension or API configuration was changed to silence it. Disabling GraphQL or changing grants would be a material API/schema decision for separate approval. [Supabase GraphQL security documentation](https://supabase.com/docs/guides/graphql/security) explains that role privileges and RLS govern field and row visibility.

**CLI and migration verification.** No database password was requested or stored. The migration remains in source control; the remote migration list reports `20260922213315 identity_foundation`, and database readback showed the six tables and an active Staff A role after tests. The local CLI remains unlinked; this does not affect the recorded migration or authenticated test evidence.
