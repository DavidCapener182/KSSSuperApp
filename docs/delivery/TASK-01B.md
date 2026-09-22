# TASK-01B — identity and scoped access foundation

Status: implemented in dedicated development project `dnfhkmmnlbiabqypclqg`; acceptance evidence is in `TASK-01B-REPORT.md`. Awaiting review before TASK-01C.

## Outcome

In a development environment with synthetic accounts, one Office/Admin user and one Security Staff user sign in and receive different authorised views. Direct requests for another person's or an unassigned site's test record are denied server-side. This is an identity and access proof, not a full personnel module.

## Confirmed decisions and prerequisite

- Use Supabase Auth with synthetic development users. Entra remains a later provider; email and Supabase Auth user ID are never the permanent Person identifier.
- Role codes: `SUPER_ADMIN`, `OFFICE_ADMIN`, `OPERATIONS`, `SECURITY_STAFF`. `SUPER_ADMIN` alone initially grants/revokes roles and scopes and owns access review. Delegated administration is deferred.
- KSS roles, scopes and dated assignments live in the application database. JWT/user metadata is not authoritative for KSS authorisation.
- David provided and authorised dedicated development project `dnfhkmmnlbiabqypclqg`. Do not use ForeKingHell, KSS Platforms or another project. The 01B schema uses clean domain table names without an `ent_` prefix.

## In scope

- Supabase Auth for synthetic development users, with explicit server session checks.
- Minimum `Person`, `AuthIdentity`, `RoleAssignment`, `Site`, `SiteAssignment` and privileged-change audit schema. Use stable internal UUIDs. `AuthIdentity` stores provider plus unique provider subject so an Entra identity can later attach to the same Person.
- Effective dates/status for role and site assignments. Server-side authorisation and deny-by-default PostgreSQL RLS both enforce the defined self/assigned-site scope. Do not treat UI hiding, JWT claims or RLS alone as sufficient.
- Minimal sign-in/sign-out and permission-aware test views; audit role/site grants and revocations with actor, affected Person, change, scope, dates and timestamp, without credentials or tokens.
- Browser-safe Supabase configuration is distinct from normal authenticated access and server-only privileged credentials. A service-role key must never reach browser code; its RLS bypass is not evidence of authenticated-user policy correctness.

## Out of scope

Production identities, live staff import, Entra integration, delegated administration, custom role editor, client accounts, document storage, all-module navigation, payroll/HR detail, deployment or provider migration. `OPERATIONS` is a defined role code; its full permission implementation is deferred.

## Ownership and acceptance

One lead owns migrations, policy, auth adapter, route handling and integration tests. A separate targeted security review should inspect session, RLS and direct-ID denial before acceptance. No parallel writer changes shared schema or policy.

Acceptance requires a fresh install, lint, build, automated permission and RLS tests through a normal authenticated Supabase client, a browser demonstration, and targeted security review. Test anonymous denial of Person/Site records; staff self versus other Person; active assigned versus unassigned/expired Site; an explicitly permitted Office path without blanket bypass; expired roles; self-grant denial; provider mapping retaining Person ID; and no service credential in browser assets. Check direct IDs, search/count/error disclosures and sign-out. Service-role operations must be tested separately from the authenticated RLS path. Record exact evidence and stop before TASK-01C.
