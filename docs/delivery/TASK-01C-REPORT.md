# TASK-01C report — shared Site journey

Date: 22 September 2026. Status: **implemented and verified in `KSS Enterprise - Dev` (`dnfhkmmnlbiabqypclqg`); awaiting David's acceptance**. TASK-01D was not started. No production deployment or live KSS data.

## Delivered

A synthetic Office Admin can create a Draft Site, edit the approved location and reporting fields, activate it, assign Security Staff for a finite reasoned period, expire or revoke that assignment, review assignment/audit history, and retire the Site. An authorised Security Staff Person can list, search, count and open an active assigned Site. Unassigned staff, another Office Admin, and unauthenticated users cannot discover the protected Site. The same stable `people.id` remains the assignment subject; Supabase Auth IDs are only provider subjects in `auth_identities`.

The Site fields are `id`, immutable `site_reference`, `name`, `address_line1`, `town_city`, `postcode`, `reporting_point`, `status`, immutable `created_by_person_id`, `created_at`, and `updated_at`. The original synthetic Site A/B UUIDs were preserved and deterministically backfilled. SiteAssignment gained `change_reason`; new grants require finite start/end dates. Legacy 01B null-end assignments remain for compatibility and are documented as technical debt; no new null-end grants are permitted.

Office authority requires creator ownership of an active Site, Office's own grant actor, a different target Person, an active `SECURITY_STAFF` role covering the **entire** proposed period, a finite assignment, and a reason. `SUPER_ADMIN` retains override and access-review authority. `OPERATIONS` gained no Site capability. Role grants remain Super Admin-only. The Site lifecycle only permits `DRAFT → ACTIVE → RETIRED`; retirement instantly removes staff reads without deleting assignment history.

## Migrations and database objects

All DDL was applied to the dedicated project from source-controlled migrations. Remote migration history readback:

| Version | Source file | Purpose |
|---|---|---|
| `20260922221737` | `supabase/migrations/20260922221737_shared_site_journey.sql` | Add Site fields/constraints/backfill, assignment reason/finite date check, Site audit target, RLS and guard/audit triggers |
| `20260922221814` | `supabase/migrations/20260922221814_fix_shared_assignment_audit.sql` | Forward repair to shared audit trigger after first Office B fixture write exposed a role-table field access error |
| `20260922222600` | `supabase/migrations/20260922222600_narrow_site_preflight_and_index.sql` | Switch exposed boolean RPC to security-invoker and index `site_assignments.site_id` |

The 01C policies replaced `sites_read`, `sites_insert`, `sites_update`, `site_assignments_read`, `site_assignments_insert`, `site_assignments_update`, and `audit_events_read`. Added private helpers: `office_owns_site`, `site_is_active`, `staff_role_covers_period`, `office_may_write_site_assignment`, `guard_site_change`, `guard_site_assignment_change`, `audit_site_change`. Replaced `private.audit_assignment_change`. Added public read-only boolean RPC `can_delegate_site_assignment` for server preflight. Added `guard_site_change`, `audit_site_change`, and `guard_site_assignment_change` triggers; retained the existing `audit_site_assignment_change` trigger using the repaired shared function. Added `sites_created_by_idx`, `audit_events_site_at_idx`, and `site_assignments_site_id_idx`, plus Site/assignment constraints and `audit_events.site_id`/`reason` columns. Existing six tables remain; no new domain table was created. SQL catalog readback confirmed all listed policies, functions and triggers.

`audit_events` records actor Person, entity and Site/affected Person IDs, before/after JSON, reason for assignment changes, and database timestamp. Guard triggers make Site reference/ownership and assignment identity immutable, prevent status reactivation, require a fresh assignment-change reason, prevent revocation from rewriting periods, and set revocation time in the database. Authenticated clients have no audit write or table-delete grant.

The first Office B fixture write failed because the shared trigger accessed `new.change_reason` on a role row. The fixture transaction rolled back. The forward repair changed optional field extraction to `to_jsonb(new) ->> ...`; the fixture and subsequent role updates then passed. No destructive rollback was used.

`supabase/seed-01c.sql` documents the synthetic Office B Person/AuthIdentity/role fixture. Its Auth account was created in the dedicated development project only. Credentials are in ignored local environment files and are not committed.

## Checks actually run

- `npm ci`: passed, 369 packages installed. npm reported the existing `unrs-resolver` allow-scripts warning and deprecated ESLint 9 warning; neither blocked the build.
- `npm run lint`: passed.
- `npm run build`: passed on the documented webpack path; all 01C pages/routes compiled.
- `npm run smoke`: passed with loopback permission. Its first sandboxed attempt failed to bind `127.0.0.1` (`EPERM`), then passed when rerun with local-network permission.
- `npm run test:access`: passed after updating 01B regression expectations for 01C's intentional staff-history visibility and the added Office B fixture.
- `npm run test:sites`: passed after the final migration and after adding the full-period, infinite-date, immutable-owner, and revocation-integrity negatives.
- One combined rerun briefly returned HTTP 400 on a valid synthetic Office grant after the 01B suite; the immediately following isolated and combined reruns passed with unchanged application/database code. The exact cause was not captured. It remains a test-stability observation for the next task; it did not reproduce in the final combined gate.
- Authenticated ordinary Supabase, GraphQL and application route tests used publishable key + synthetic user sessions, not a service-role bypass. GraphQL returned zero hidden Site rows for Staff B. An initial GraphQL test query used the wrong field spelling (`siteReference`); the test was corrected to the actual `site_reference` schema field and passed.

Negative checks cover anonymous list/search/count/detail/mutation, Office B Draft visibility/edit/assignment/assignment-change denial, Office role-grant denial, Office self-assignment denial, full Security Staff role-period coverage, finite dates and `infinity`, Site owner/reference immutability, Staff B list/search/count/direct-ID/ordinary Supabase/GraphQL denial, Staff B self-assignment denial, Staff A Site edit/assignment-detail denial, assignment expiry and revocation, expired Security Staff role, retirement, and preserved administrative history with before/after values. A direct Office revocation test proved date rewrites fail and caller-supplied `infinity` revocation timestamps are normalized to database event time.

## Browser demonstration

The built app ran locally on `127.0.0.1:3101`. In the browser, synthetic Office B created `DEV-01C-UI-B` as Draft with Site ID `77cf1de9-7de5-4dc6-b894-95bb80694d90`, activated it and assigned Staff A with dated access and a reason. Staff A signed in and opened that same Site's address/reporting detail. Staff B signed in and could not see it in the list; exact-reference search returned zero permitted Sites. Office B expired the assignment; Staff A's next signed-in list omitted the Site. Office B renewed access and retired the Site; Staff A's next list again omitted it, while Office history retained the Site and assignments. Browser sign-outs were verified.

At an explicit **390 × 844** viewport, both the Staff search page and populated Office management page reported `documentElement.scrollWidth = 390` and `innerWidth = 390`; the page remained usable with no page-wide horizontal overflow. The viewport override was reset afterward.

## Security review and advisors

One targeted read-only reviewer (`gpt-5.6-sol`, high reasoning) reviewed the migration, RLS and routes. It found four issues, all fixed before completion: infinite timestamp bypass, revocation rewriting dates, caller-controlled revocation time, and list/search/count plus `/api/me` relying on RLS alone. After fixes it found no remaining blocker; authenticated runtime tests passed. The lead implementation model is not exposed reliably in this environment; no GPT-6 Astra was requested or used.

The Supabase security advisor's existing [GraphQL authenticated-table schema warning](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed) remains for six tables, unchanged from the 01B baseline. GraphQL is unused by the app; authenticated row-isolation tests passed. The new public security-definer RPC warning appeared after the first migration and disappeared after switching that wrapper to security-invoker. The performance advisor's unindexed foreign-key count fell from four to three after indexing `site_assignments.site_id`; the remaining three are existing actor/granter references. The existing unused audit index and Auth connection allocation notices remain informational.

## Files changed

- Database: the three migrations above; `supabase/seed-01c.sql`.
- Server: `src/app/api/sites/route.ts`, `src/app/api/sites/[id]/route.ts`, `src/app/api/sites/[id]/assignments/route.ts`, `src/app/api/sites/[id]/history/route.ts`, `src/app/api/access/sites/route.ts`, `src/app/api/access/sites/[id]/route.ts`, `src/app/api/me/route.ts`, `src/lib/sites/policy.ts`, `src/lib/auth/assignment.ts`.
- UI: `src/app/sites/page.tsx`, `src/app/page.tsx`, `src/app/globals.css`.
- Tests/config: `tests/site-journey.test.mjs`, `tests/access.test.mjs`, `package.json`.
- Delivery: `docs/delivery/TASK-01C.md`, `docs/delivery/TASK-01C-REPORT.md`, `docs/delivery/STATUS.md`, `docs/delivery/DECISIONS.md`.

## Open items and proposed next task

The 01B legacy null-end synthetic SiteAssignments remain until an explicit cleanup task; all 01C grants are finite. The Office UI still offers an “Expire now” action for a row already expired, though access is already denied and the API/audit remain safe. Webpack remains the working build path; the earlier Turbopack development issue is unchanged. No Entra, other system integration, live data, Vercel or production work occurred.

**Proposed TASK-01D, for separate approval:** minimal authenticated navigation and app-link shell around the established Person/Site access pattern, with role-aware entry points and no new data domain or external integration. Prepare the exact 01D brief and acceptance tests for David's review before implementation. Stop after this 01C report.
