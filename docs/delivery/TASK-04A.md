# TASK-04A — People Directory and unified staff record

**Status:** Approved by David on 23 September 2026; implemented in synthetic development. See `TASK-04A-REPORT.md` for verification and remaining limits.

## Outcome

Give authorised Office users a searchable People workspace and one coherent staff record built from the existing stable `people.id`. A user can open a synthetic staff member, understand their current role/site context and onboarding progress, then follow authorised links to the existing Profile, Documents, credentials, Tasks and onboarding records. This is an operational directory and record view, not a new HR database or a new identity.

David's 23 September direction chooses **People & HR as the next build stream** while retaining the master plan as the product reference. The task label 04A identifies this bounded People work; it does not rewrite the historical phase map. Relevant master requirements include R01, R02, R05 and R07.

## Existing foundation to reuse

`people` is the stable Person identity, separate from `auth_identities` and Supabase Auth. `role_assignments` and `site_assignments` are effective dated. `person_profiles` holds current contact/address details, with protected submitted revisions. The existing private Document, SIA credential, onboarding, Task and audit systems each retain their own authoritative records and permissions. `sites` are currently operational records without a commercial Organisation/Client parent. TASK-03E added case team queue, ownership and cover; those rights do not grant blanket People or private-file access.

The current `/profile` serves self-service. TASK-04A should add a distinct Office People directory and staff detail, while preserving the Staff self view and the existing iOS-inspired, shadcn-based, blue/graphite/neutral, no-green design standard.

## Proposed bounded implementation

1. Add a **People** destination for authorised Office, Operations and Super Admin users. Show a responsive, paginated directory with synthetic display name, active role labels, safe current work/site context where authorised, and a clear record link. Search/filter/count must run under the same server-side scope. No private contact, address, SIA reference, document filename or review comment appears in a directory row.
2. Add a unified staff record header keyed by `people.id`: display name, permitted role/site context, record navigation and clear source labels. Build read-only sections from existing services: onboarding summary, document/credential summaries, site assignments and accountable work. A summary never grants access to its underlying private record or bytes; each deep link rechecks its own authority.
3. Keep full Profile, historical revisions, evidence and verification details behind their existing exact-case/owner/cover and self-access rules. Where the directory viewer lacks detail authority, show a restrained unavailable state rather than leaking counts, filenames, sensitive status or guessed IDs.
4. Use existing Person and profile data. Do not copy it into a `staff` table, overwrite `people.display_name` from profile edits, or derive employee identity from Supabase Auth IDs. Do not build general HR attributes, emergency contacts, pay/bank/NI/medical data, training completion, eligibility or deployability in 04A.
5. Provide useful desktop table and 390px card views, loading/empty/error states, safe back navigation and role-scoped links. Add no green status styling.

## Approved access distinction

Directory visibility is separate from private personnel access. Active `OFFICE_ADMIN` may discover all KSS People through a safe organisation-wide projection. Active `OPERATIONS` receives a narrower organisation-wide operational projection. `SUPER_ADMIN` may discover all People with audited privileged detail only where separately authorised. `SECURITY_STAFF` sees self only. Neither onboarding ownership nor SiteAssignment limits Office directory discovery or grants private detail. Full Profile, historical revisions, evidence and verification details remain behind their own exact authority rules.

## Data and implementation shape

Prefer server-owned scoped directory queries and aggregation over new tables. Any new SQL view/RPC must return an explicit safe projection, have RLS/guard coverage, and use the same access predicate for search, pagination and counts. Existing source records remain authoritative; audit consequential read/access where the present policy requires it. If a new durable People permission or materially broader schema is necessary, return the design for approval first. No new external integration is needed.

## Acceptance proof

- Office A finds an authorised synthetic Staff A by name and opens a useful unified record. The record links to the existing exact onboarding case, Profile and permitted Document/credential views without duplicating data.
- Active Office B can find Staff A through the organisation-wide safe directory, while guessed IDs and directory discovery cannot reveal Staff A's private Profile or file metadata/bytes.
- Staff B cannot read Staff A's record; Operations cannot obtain private contact/address/SIA/evidence through People APIs or direct database access. SiteAssignment alone does not widen private access. Expired role/team/cover removes the corresponding access.
- A profile edit and onboarding status change appear from their authoritative source, while immutable submitted revisions and evidence versions remain unchanged. Search, counts, exports (if any) and deep links apply the same server and RLS boundaries.
- Desktop Office and 390px Office/Staff views have no horizontal overflow and retain accessible labels, focus and text status cues. Run clean install, lint, Webpack build, smoke, relevant Phase 01–03 regressions, focused server/RLS tests, migration readback if a migration exists, staged secret scan and browser evidence. Record actual results, not planned results.

## Boundaries and next task

Synthetic identities only; no real employee import, LMS connection, production deployment, new HR fields or access expansion by inference. TASK-04B may later provide a consolidated documents/credentials/training view, with training honestly `NOT_CONNECTED` until the provider/interface is known. TASK-05A is planned separately and does not wait for the staging password handoff. One bounded security review is appropriate if directory discovery or private-record authority changes. No GPT-6 Astra without explicit approval.

**Stop:** TASK-04A ends after its separate commit and report. Do not begin TASK-04B or TASK-05A automatically.
