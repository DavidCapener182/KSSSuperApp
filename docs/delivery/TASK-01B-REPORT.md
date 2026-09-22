# TASK-01B report — Supabase identity and scoped access

Date: 22 September 2026. Status: implemented and locally verified in the dedicated development project; awaiting David's review. TASK-01C has not started.

## Project boundary and implementation

- Dedicated project only: `dnfhkmmnlbiabqypclqg` (`https://dnfhkmmnlbiabqypclqg.supabase.co`, West EU/Ireland). No `KSS Platforms`, `ForeKingHell` or other Supabase project was changed for this implementation.
- One source-controlled migration: `supabase/migrations/20260922213315_identity_foundation.sql`; remote migration list confirms version `20260922213315`, name `identity_foundation`. The migration is additive and uses clean domain names without `ent_`.
- Six public tables created: `people`, `auth_identities`, `role_assignments`, `sites`, `site_assignments`, `audit_events`. All have RLS enabled. `auth_identities.person_id` references the stable Person UUID; the Supabase Auth UUID is stored separately as a provider subject.
- Private schema and four functions created: `private.current_person_id()`, `private.has_active_role(text)`, `private.has_any_active_role()`, `private.audit_assignment_change()`. The first three evaluate identity/dated roles from database records. The fourth records role/site assignment inserts and updates through `audit_role_assignment_change` and `audit_site_assignment_change` triggers. All use fixed empty search paths and qualified object references.
- RLS policies created: `people_read/insert/update`, `auth_identities_read/insert/update`, `role_assignments_read/insert/update`, `sites_read/insert/update`, `site_assignments_read/insert/update`, and `audit_events_read`. Public table grants were revoked from `anon`; `authenticated` has only required table operations, further constrained by RLS. There are no client delete policies. Only active `SUPER_ADMIN` can add or change access assignments. The initial access-review owner is `SUPER_ADMIN`.
- `supabase/seed-01b.sql` contains only synthetic Person, Site, role and assignment fixtures, including an expired Site B assignment and an expired role fixture. Four synthetic email Auth users were created in the dedicated project. Their credentials are in ignored local `.env.test.local`, never in Git. The Staff B Auth account exists, but the locally recorded test password did not authenticate; acceptance tests use the Staff B protected Person record without signing in as B. This fixture credential should be reset or replaced before any future use of that account.
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

The Supabase security advisor reports two warnings. Its GraphQL warning lists all six public tables as discoverable by signed-in users because those tables require `SELECT` grants for this proof; RLS still filters row access, as the authenticated tests show. [Supabase lint 0027](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed). Leaked-password protection is disabled at project level; this is an Auth configuration follow-up before any production identity pilot. [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Neither warning is represented as a passed hardening check.

The local Supabase CLI was available but not logged in, so project linking through the CLI was not possible without a database credential. The project was accessed through the approved project-scoped Supabase tool; the local migration filename was aligned to the remote applied version. The migration and fixture SQL are reproducible source files. No Dashboard-only schema changes were made.

## Boundaries and next approval

No live KSS data was imported. Microsoft Entra, SharePoint, MagSecure, Footasylum Audits, training, PARiM, Finance, Vercel and production remain unconnected. `OPERATIONS` is a valid role code but its detailed permissions are still undefined. TASK-01C has not started.

Proposed **TASK-01C** for approval: implement one synthetic shared-record journey and audit trail across an Office user and an assigned Security Staff user, beginning with a minimum Site-linked work record. Define record ownership, fields, status changes, assignment scope, read/write policy and audit events in the task brief before migration. Verify the same record appears only within each user's authorised scope, with direct-ID, search/count and expired-assignment negative tests. Do not add live integrations or production data.
