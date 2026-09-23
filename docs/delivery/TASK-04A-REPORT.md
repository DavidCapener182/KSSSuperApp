# TASK-04A report — People Directory and unified Staff Record

**Date:** 23 September 2026

**Environment:** dedicated synthetic development project `dnfhkmmnlbiabqypclqg` only

**Status:** implemented and development-verified; David's acceptance pending. No staging deployment.

## Delivered

- Added a People directory keyed by stable `people.id`, with one safe database projection for listing, filtering, pagination, counts and record lookup. No duplicate Staff master table or persisted UI summary was created.
- Active `OFFICE_ADMIN` can discover organisation-wide People. `OPERATIONS` can discover the narrower safe operational projection. `SECURITY_STAFF` can retrieve only self. `SUPER_ADMIN` can discover all People. These directory rights do not grant private record authority.
- The projection returns only Person ID, display name, active role labels, permitted Site names, broad current onboarding state, and a count for Office/Super/self. Operations does not receive the requirement count or case ID for other People. An onboarding case link is returned only for self, Super Admin or Office with existing exact-case authority.
- Added server-rendered `/people` search, role/state filters, pagination, desktop table and 390px cards. `/people/[id]` composes a safe read-only Staff Record with Overview, Personal Details, Onboarding, Credentials, Documents, Training, Sites and Activity sections. Restricted sections explain their boundary and route only to existing authorised source workflows. Training says the provider is not connected; Activity is an honest unconfigured section, not raw audit output.
- Added role-scoped People navigation for Office, Operations and Super Admin. Staff retain `/profile` and can open only their own `/people/[id]` record; they have no organisation-wide People navigation.
- Existing Profile, onboarding, Document metadata/file, Storage and Task policies were not widened. Existing private `/api/people/[id]` remains narrow; the new safe directory route is distinct.

## Schema and readback

Source-controlled migrations: `20260923150000_people_directory_04a.sql` and forward correction `20260923151500_people_directory_case_link_fix_04a.sql`. The correction carries `current_case_id` through the projected CTE; it does not alter private base-table RLS. Supabase recorded application versions `20260923140000` and `20260923140227` respectively under the same migration names.

Database readback confirmed one `public.people_directory_04a` function, `SECURITY DEFINER`, stable, owner `postgres`, `EXECUTE` for `authenticated`, and no `EXECUTE` for `anon`. The function resolves the stable Person from the authenticated provider mapping, checks active roles at query time, uses a fixed search path, bounds inputs and returns an explicit JSON projection. No new tables, Storage buckets, external integrations or real data were added.

## Verification actually run

| Check | Result |
|---|---|
| `npm ci --prefer-offline --no-audit` | Pass; clean install of 673 packages |
| `npm run lint` | Pass after final test change |
| `npm run build` | Pass; Next.js 16.3.6 Webpack production build |
| `npm run smoke` | Pass with local binding permission; sandbox-only first run returned `listen EPERM` |
| 04A focused server/RPC/RLS test | Pass: safe projection, Office discovery, narrow Operations, Staff self/other denial, old private route, anonymous denial, active role expiry |
| Phase 01 access, Sites and shell suites | Pass; Sites first run hit a transient Supabase Auth fetch failure and passed on individual rerun |
| Phase 02 Documents, review and My Work suites | Pass; review first run hit a transient Supabase connection timeout and passed on individual rerun |
| Phase 03 onboarding, Profile/SIA, controlled documents, Identity Evidence and queue/cover suites | Pass |
| Browser: Office at 1440px, Operations and Staff at 390px | Pass; rendered sign-in and record journeys, no horizontal overflow, safe directory content, Staff other-person/People listing denied |
| SQL migration/object readback and source diff check | Pass |

Browser evidence: [Office directory](../../output/playwright/people-04a/office-directory-1440.png), [Office Staff Record](../../output/playwright/people-04a/office-record-1440.png), [Operations mobile directory](../../output/playwright/people-04a/operations-directory-390.png), [Operations mobile record](../../output/playwright/people-04a/operations-record-390.png), [Staff self record](../../output/playwright/people-04a/staff-self-mobile.png). These are synthetic development views, not staging evidence.

## Security review

The new discovery boundary is a dedicated RPC rather than widened `people` RLS. Direct Office base-table reads remain self-only; direct Office/Operations private Profile reads of unrelated Staff return no rows. The new directory RPC does not return contact/address fields, credential references, document names or IDs, evidence comments, hashes, object paths or private revisions. A guessed Person ID through the safe route yields only the same directory projection; the existing private route remains denied. Search, counts and pagination share one authorised filtered query. Role expiry was exercised directly against the RPC and authority disappeared immediately. Existing Document/Storage and onboarding regression suites passed. No access-control expansion was made to private source services.

The new source and staged diff were checked for hard-coded secrets and intentional green UI styling. No secret values were added; the UI uses existing blue/graphite tokens. The People record Activity section deliberately exposes no generic `audit_events` payload. Published onboarding and evidence histories were not edited.

## Limits and next proposal

- Development regression suites continue to mutate synthetic cases; the Office screenshot shows a current Staff A development case at **1 of 6**. This is development fixture drift from normal test workflows, not a restoration or a change to the separate accepted staging 5-of-6 case. No history was reset or forged to alter the count.
- Office directory discovery is broad, while full personnel administration authority is still limited to existing case and source-specific policies. A general HR permission and unified detailed Staff Record remain for a separately approved task.
- The actual training provider/interface is still unknown. No LMS completion, compliance score or deployability status was added.
- Staff staging password handoff remains deferred; TASK-04A did not alter staging, Vercel protection or Auth settings.

**Recommended TASK-04B:** consolidate the authorised Staff Record's existing documents, credentials, onboarding and Site information into useful source-scoped sections, with a deliberate personnel administration permission design if KSS wants Office staff beyond case owners to see private detail. Keep CRM foundation as the following approved build stream. Do not start 04B or 05A without David's approval.
