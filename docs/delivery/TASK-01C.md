# TASK-01C — one shared Site journey (proposal for approval)

Status: **proposal only**. No TASK-01C migration, policy, API, UI or fixture has been implemented. TASK-01B accepted baseline: `74c60fb`; see `TASK-01B-REPORT.md` for its separate close-out.

## Business outcome and boundary

Prove one useful internal journey with synthetic data: an Office Admin creates and maintains a Site, authorised administration assigns one synthetic Security Staff Person for a dated period, that staff member can find and open the Site, an unassigned staff member cannot discover or open it, expiry removes access, and each privileged change has an actor and before/after audit record. Reuse the existing `people`, `sites`, `role_assignments`, `site_assignments` and stable Person IDs. This is a Site access and location record, not a full Sites module or an operational briefing system.

## Decision required before implementation: who may assign staff?

TASK-01B grants **only `SUPER_ADMIN`** authority to create/revoke site assignments. The requested 01C journey says **Office assigns Security Staff**. Those rules differ. The recommended 01C change is a narrow delegation: `OFFICE_ADMIN` may grant, change expiry for and revoke a `site_assignment` **only** for a Site they created, **only** to a Person with an active `SECURITY_STAFF` role, with a recorded reason and finite effective period. It does **not** permit Office to grant roles, assign itself, alter another Office Admin's Site, or modify a Site assignment granted by another authority. `SUPER_ADMIN` retains full role and site assignment authority and access-review ownership. The server and RLS must enforce the identical predicates.

Approval of that specific delegation is required with TASK-01C. If it is declined, keep 01B authority unchanged: Office creates the Site and a Super Admin performs the assignment step. Do not silently give Office broader access to make the demonstration work.

## Record shape and ownership

Extend the existing `sites` table, preserving its UUID primary key and existing synthetic Site A/B rows. The exact Site fields in this task are:

| Field | Purpose / rule | Security Staff view |
|---|---|---|
| `id` (existing UUID) | Stable Site identity; never derive access from the ID | Yes, if authorised |
| `site_reference` | Unique short synthetic business code, immutable after creation | Yes |
| `name` (existing) | Human-readable Site name | Yes |
| `address_line1`, `town_city`, `postcode` | Minimum location needed to recognise and reach the Site; synthetic values only | Yes |
| `reporting_point` | Brief plain-text arrival point, not an SOP/RAMS or safety instruction | Yes |
| `status` | `DRAFT`, `ACTIVE`, or `RETIRED` | Only `ACTIVE` Sites visible |
| `created_by_person_id` | Stable Person who created it; Office ownership predicate | No |
| `created_at` (existing), `updated_at` | Record timestamps | No |

No client, contract, event, document, coordinates, pay rate, staffing plan or personal contact fields are added. Existing synthetic Site A/B rows require an explicit deterministic backfill for new required fields and owner, preserving their UUIDs. `site_assignments` continues to link `person_id` and `site_id`, with its existing effective dates and revocation status. Add a required reason for new assignment grants/changes if the audit design needs it; do not infer it from a free-text Site field.

## Actions and lifecycle

| Actor | Allowed in 01C | Denied in 01C |
|---|---|---|
| `OFFICE_ADMIN` | Create a `DRAFT` Site; read/list and edit Sites they created; set name, address and reporting point; move their Site `DRAFT → ACTIVE → RETIRED`; under the approved delegation above, grant/expire/revoke Security Staff assignments for their own active Site | Role grants, edits to others' Sites, changing `site_reference`, deleting a Site, assigning itself, creating permanent/unbounded grants |
| `SECURITY_STAFF` | List/search/count and open its own `ACTIVE` Sites while it has an active SiteAssignment and active role | Create/edit/retire Sites, grant/revoke assignments, view Draft/Retired or unassigned Sites, view other staff's assignment details |
| `SUPER_ADMIN` | Review all Sites, assignments and audit; retain existing override and role authority | No unaudited mutation |
| `OPERATIONS` | No new 01C capability; its later scope remains a separate decision | All 01C Site mutation paths |

Retirement is a soft lifecycle change, not a delete. A retired Site stops appearing to Security Staff immediately, even if a SiteAssignment has time remaining. No reactivation in this task: correction or reopening requires a later policy decision. A Site cannot be assigned to staff while `DRAFT` or `RETIRED`. Assignment expiry and revocation must remove staff Site visibility on the next request, including existing direct-ID links and search/count.

## Authorisation, RLS and audit design

- Authenticate every request with the existing Supabase Auth server adapter. Resolve the stable Person and current database roles per request. Browser navigation is only a view of the same server policy.
- Add a minimal Site list/search/count and detail API plus Office create/edit/status and assignment actions. Restrict search to name/reference and return only permitted rows; return 404 for inaccessible direct IDs and zero/empty list/count for inaccessible search. Never return hidden Site details in error text.
- Update `sites` RLS so active Security Staff read requires an active role **and** active, unrevoked `site_assignment` **and** `sites.status = 'ACTIVE'`. An Office Admin may read/update only Sites where `created_by_person_id` is their stable Person ID. Super Admin retains review access. Do not use JWT role metadata as authority.
- Update `site_assignments` RLS consistently for the approved narrow Office delegation. Check target Person's active Security Staff role, creator ownership of an active Site, valid dates, and actor identity on both `USING` and `WITH CHECK`; staff must not see other users' assignments or expired assignment rows. Keep direct table access denied for anonymous users and unapproved roles.
- Reuse `audit_events` for Site insert/update/status transitions and SiteAssignment insert/update/revoke/expiry changes. Extend its schema minimally so a Site event can identify `site_id` without pretending a Site is an affected Person. Record actor Person, entity/ID, action, before/after, reason when relevant and timestamp through database triggers, including direct database writes that pass RLS. Do not log credentials or tokens. Prevent browser clients from writing audit rows directly.
- Do not alter the AuthIdentity/Person separation. An assignment continues to refer to `people.id`; changing authentication provider never changes Site ownership or access history.

## Acceptance tests and demonstration

Use ordinary authenticated synthetic accounts and a source-controlled migration. Test application routes and direct database RLS, not service-role bypass as proof. Required checks:

1. Anonymous Site list, detail, search/count and mutations denied.
2. Office creates synthetic Draft Site; only its creator/Super Admin can see it. Office activates and edits it; audit shows actor, before/after and status transition.
3. Under the approved assignment rule, Office assigns active Security Staff A with explicit start/end and reason; the assignment is audited. Staff A can find, count and open that **same Site UUID** on desktop and a 390px mobile browser.
4. Security Staff B cannot discover the Site by list, search, count, direct ID or GraphQL/ordinary Supabase table query; error shape reveals no Site name/address. Staff B cannot alter the Site or self-assign.
5. Expire and separately revoke the assignment in tests; Staff A then gets an empty search/list, zero count and 404 by direct ID on the next request. Restore only synthetic fixtures required for repeated tests and record the audit trail.
6. Retire a Site with an otherwise active assignment; staff access disappears while Office/Super Admin retain review access. Draft and retired rows remain hidden from staff.
7. Office B cannot edit Office A's Site or assign staff to it. `OPERATIONS` has no implied edit path. Role self-escalation and cross-person checks from 01B remain green.
8. Fresh install, lint, webpack build, smoke, automated authorisation/RLS tests, browser sign-in/sign-out and desktop/mobile demonstration, security review, migration inventory and database-state readback pass before declaring completion.

## Migration, rollback and exclusions

Prepare one reviewed additive migration for Site fields, constraints, RLS/policy changes and Site audit support. Include deterministic backfill for existing **synthetic** Site A/B rows without replacing IDs; test against the dedicated development project and record every object changed. Prefer a forward corrective migration if policy or audit design needs repair. Reversing an applied migration may remove Site data or audit evidence, so do not run destructive rollback without an explicit recovery plan and approval. Keep the TASK-01B commit intact and commit 01C separately if later approved.

Deferred: SOP/RAMS and document management, patrols, incidents, shifts, training, client CRM, finance, real Site addresses or staff imports, Office access outside its creator scope, delegated role grants, production identities, Entra, other integrations and deployment. TASK-01D navigation/app links remain separate. No live KSS data or external systems are used in this task.
