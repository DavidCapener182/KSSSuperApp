# TASK-01B — identity and scoped access foundation

Status: proposed; not authorised or started.

## Outcome

In a development environment with synthetic accounts, one Office/Admin user and one Security Staff user sign in and receive different authorised views. Direct requests for another person's or an unassigned site's test record are denied server-side. This is an identity and access proof, not a full personnel module.

## Required decisions before implementation

- KSS owner approves a development Supabase project and the non-production account setup; no production or paid resource is implied.
- Confirm who may create/disable pilot accounts and how Super Admin grants initial roles.
- Confirm the minimum Office/Admin and Security Staff test scopes and the access-review owner.
- Choose where the KSS Person and external authentication identity mapping live. Keep a stable Person ID independent of Supabase Auth; reserve provider/external ID fields so Entra office sign-in can be added without duplicate Person rows.

## In scope

- Supabase Auth for synthetic development users, with explicit server session checks.
- Minimum Person, AuthIdentity, dated RoleAssignment and SiteAssignment schema needed for the proof; one stable Person record per human.
- Server policy and PostgreSQL Row Level Security for self versus assigned site access. Deny by default on direct ID access.
- Minimal sign-in/sign-out and permission-aware test views; audit initial role/assignment changes.
- Tests for anonymous, cross-person, cross-site and expired-assignment denial, plus one permitted Office/Admin path.

## Out of scope

Production identities, live staff import, Entra integration, custom role editor, client accounts, document storage, all-module navigation, payroll/HR detail, deployment or provider migration.

## Ownership and acceptance

One lead owns migrations, policy, auth adapter, route handling and integration tests. A separate targeted security review should inspect session, RLS and direct-ID denial before acceptance. No parallel writer changes shared schema or policy.

Acceptance requires `npm ci`, lint, build, automated permission tests and a browser demonstration with synthetic accounts. Both application and direct database access paths must enforce the agreed scope. Demonstrate that an AuthIdentity can change provider while retaining its Person ID. Stop after reporting test evidence and unresolved identity decisions; do not proceed to shared-record TASK-01C automatically.
