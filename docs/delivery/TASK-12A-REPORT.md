# TASK-12A implementation report

**Status:** Synthetic Dev implementation complete; authenticated browser proof and David's acceptance remain outstanding. No staging or production work was performed.

**Date:** 24 September 2026

## Delivered

- Staff can submit context-free or correctly linked operational incident reports. The reporter is resolved server-side from AuthIdentity to the stable Person record.
- External people use a controlled relationship and neutral descriptor only. The UI and database reject common contact, address, date-of-birth and name-shaped values; the report form also tells Staff to omit identity and medical detail.
- Staff can read their own report versions and lifecycle status. Correction snapshots append without replacing earlier narrative. Restricted operational actions and reopen reasons are hidden from Staff.
- Operations review requires both an active Operations role and an active, time-bounded `INCIDENT_REVIEWER` grant. Super Admin manages grants with a reason, attribution and revocation history. Office and ungranted Operations do not receive queue access.
- Operational review supports acknowledgement, controlled action codes, close and reasoned reopen. No attachments, severity, Tasks, notifications, analytics, medical/safeguarding/HR workflow or real data were added.
- The emergency guidance appears on the Staff form. The reporting flow is one column at 390px, uses the blue/graphite/neutral palette and has no green color values in its stylesheet.
- A reporter-only idempotency lookup lets Staff resolve an ambiguous submission response without returning report content.

## Synthetic Dev evidence

Applied and read back in the confirmed KSS Dev project:

- `task_12a_incident_reporting_foundation`
- `task_12a_submit_result`
- `task_12a_action_event_mapping`
- `task_12a_fk_indexes`
- `task_12a_external_descriptor_privacy`

All eight Incident tables have RLS enabled and deny direct `authenticated` SELECT and INSERT privileges. Reads and writes use fixed-search-path, server-authorized RPCs. The security advisor reports “RLS enabled, no policy” as an informational finding for these tables; this is the intentional fail-closed configuration. It also identifies the guarded `SECURITY DEFINER` RPCs as callable by `authenticated`, which is intentional: each RPC performs its own role, identity, scope and action checks. The performance advisor no longer reports unindexed Incident foreign keys after the covering-index migration.

The test inserted synthetic-only incident rows. Because report versions and event history are immutable, those test rows were not deleted.

## Checks run

- `npx tsc --noEmit` — passed.
- Focused ESLint on TASK-12A source and tests — passed.
- `npm run build` — passed.
- `npm run smoke` — passed.
- `tests/incidents.test.mjs` against authenticated synthetic Dev accounts — passed. It covered role-only denial, Office denial, grant/revoke authority, self-only reporting, direct-table denial, exact context links and invalid links, descriptor restrictions, exact-payload retry, correction history, concurrent actions, lifecycle close/reopen, and immediate grant revocation.
- `tests/incidents-navigation.test.mjs` — both permission-based navigation and safe return-target tests passed.
- `tests/incidents-routes.test.mjs` — authenticated Next route checks passed for Staff, ungranted Operations, Office and Super Admin.
- `tests/shell.test.mjs` — the return-target test passed; the suite stopped at a concurrent TASK-11A external-shortcuts fixture that directly inserts into `role_assignments` (`permission denied for table role_assignments`, line 109). The full shell suite did not pass.
- The full regression suite was not run because TASK-08D and TASK-09A were active in this same checkout and Dev project. Avoided overlapping shared database and build-state mutations.

## Evidence still required

- The authenticated Staff 390px and Operations desktop/390px browser proof could not be completed: the desktop was locked and the in-app browser remained at sign-in. The unauthenticated return target was verified as `/?next=%2Fincidents` after correcting the allowlist. No authenticated browser result is claimed.
- Retention, legal hold and final privacy policy remain pre-live gates. Do not enter real incident data until KSS approves them.
- David's acceptance is pending. This report does not claim production readiness or human acceptance.
