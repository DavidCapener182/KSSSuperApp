# TASK-04B report — unified Staff Record consolidation

**Date:** 23 September 2026

**Environment:** dedicated synthetic development project only

**Status:** implemented and development-verified; David's acceptance pending. No staging deployment.

## Delivered

- `/people/[id]` now presents one read-only Staff Record from the existing stable `people.id`: safe Overview, Personal Details, authorised onboarding cases, synthetic SIA credential state, authorised Document requests, Training connection state, Site assignments and an honest deferred Activity section.
- The 04A safe directory projection still owns discovery and the initial record header. A server-only section composer runs only after that Person has been authorised. It uses the signed-in ordinary Supabase client and existing case, Profile, Document and Site readers/RLS. No service-role read, general Office HR capability or private directory column was added.
- Office A can see current Profile and exact case-sourced details where its existing owner/source rules allow them. Office B can still discover the Person through the safe directory but receives restricted private sections. Operations receives the narrow safe Overview and does not issue private source reads. Staff can open only self and retain `/profile` editing.
- Current Personal Details are distinguished from the latest authorised immutable submission where available. The SIA card shows category, synthetic expiry and requirement/evidence state without printing the SIA reference or claiming licence authenticity. Document cards show only source-authorised request titles/statuses and link back to protected routes; denied viewers see no count or filename.
- Onboarding queries only the selected Person's RLS-visible case IDs, then previews up to three selected authorised cases, keeping active, V1 and cancelled history distinct when available, with a link to the full authorised onboarding workflow. Staff Documents preview at most four recent authorised requests with a link to `/documents`. Site history preview is limited to four source-visible assignments. These caps keep regression-heavy development fixtures readable without deleting or rewriting history.
- Activity stays explicitly unavailable; `audit_events` was not used as a pseudo-timeline. Training remains `NOT_CONNECTED`. No compliance score, deployability result, legal RTW/SIA/identity claim or new business state was introduced.

## Access and security review

The 04B composer is entered only after the 04A exact Person projection permits the viewer. Operations-other exits before querying Profile, cases, Documents or assignment history. Office detail requires an existing readable case and source-specific RLS; a safe directory row alone is insufficient. Document links still traverse the original metadata/file routes and Storage RLS. Historical completed evidence remains subject to the existing case/cover rules. SiteAssignment is shown as context only and is never consulted as private-Profile or Document authority.

The focused test confirmed that Office A's case-authorised Profile value appears in its Staff Record, while unrelated Office B and Operations receive no contact/address values or Document request links in the raw rendered HTML. Office B direct Profile RLS returns no Staff A row; Operations direct SIA RLS returns no Staff A row. Staff B and Staff A cannot open each other's record. The existing private `/api/people/[id]` remains separately guarded. The source card deliberately omits SIA reference/number entirely, including for authorised viewers, because 04B needs a useful status summary rather than a duplicate credential editor.

No schema, RPC, view, index, Storage policy, Auth configuration or environment variable changed. The 04A database projection and all private RLS policies remain intact. Source and staged-diff reviews found no new secret value or intentional green UI styling.

## Verification actually run

| Check | Result |
|---|---|
| `npm ci --prefer-offline --no-audit` | Pass; clean install of 673 packages |
| `npm run lint` and `npm run build` | Pass after final UI change; Webpack production build |
| `npm run smoke` | Pass after final build |
| `tests/people-directory.test.mjs` | Pass after updating the old 04A rendering assertion to account for authorised 04B detail |
| `tests/staff-record.test.mjs` | Pass: Office A exact-authorised profile, Office B/Operations denial in HTML and RLS, Staff self/peer isolation |
| Phase 01 access, Sites and shell suites | Pass |
| Phase 02 Documents, exact review and My Work suites | Pass |
| Phase 03 onboarding, Profile/SIA, controlled documents, Identity Evidence and team queue/cover suites | Pass |
| Actual Chrome: Office desktop 1440px; Staff, Office and Operations at 390px | Pass; no horizontal page overflow; section data/denials rendered as expected |
| Local detailed-record browser timings | Office desktop 1.1 s; Office mobile 1.0 s; Staff mobile 0.9 s; restricted Operations mobile 0.2 s on the final synthetic development run |

Browser evidence: [Office desktop Staff Record](../../output/playwright/people-04b/office-record-1440.png), [Office mobile Staff Record](../../output/playwright/people-04b/office-mobile-record-390.png), [Staff mobile self record](../../output/playwright/people-04b/staff-self-mobile.png), [Operations mobile restricted record](../../output/playwright/people-04b/operations-record-390.png). These are development screenshots; staging was not used.

## Remaining limits and next recommendation

- The record previews selected authorised history rather than replacing full source workflows. A broader Office personnel-administration role was not introduced. Unrelated Office users continue to see safe directory data and restricted private sections.
- Development Staff A still reflects whatever the regression-mutated source records currently say; the observed record showed **1 of 6**. No fixture reset, direct SQL completion or immutable-history change was made to improve screenshots. The separate staging 5-of-6 case was untouched.
- Site history is limited to assignments currently visible through existing Site/assignment RLS. Activity needs a later cross-module event whitelist, not a People-only 04C. The LMS provider/interface remains unknown.
- Real-data security, privacy, malware scanning, retention, backup/recovery and production policy gates remain open. TASK-04B does not authorise live personnel data.

**Recommended next task:** prepare/approve TASK-05A CRM Foundation — Organisations, Contacts and Opportunities. Do not start CRM or deploy 04B to staging automatically.
