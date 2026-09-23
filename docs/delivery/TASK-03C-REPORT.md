# TASK-03C delivery report — controlled terms acknowledgement

**Status:** implemented and development verified on 23 September 2026; awaiting David's acceptance. **Scope:** TASK-03C only. **Project:** dedicated synthetic Supabase development project `dnfhkmmnlbiabqypclqg`. No deployment or live KSS data.

## Delivered

- Added a reusable controlled-document identity with immutable numbered PDF versions and `DRAFT → PUBLISHED → SUPERSEDED` publication history. A published version keeps its object key, SHA-256, byte size, MIME type and title; a correction creates another version. Unresolved active assignments block supersession.
- Created a separate **private** `enterprise-controlled-documents` Storage bucket (PDF only, 1 MiB limit, no public or signed URLs). Server-authorised file routes and independent Storage RLS enforce the exact publisher/assignment audience. Files remain labelled `NOT_SCANNED`.
- Added a narrowly scoped, time-bounded `ONBOARDING_TERMS_SYNTHETIC` publisher grant. Super Admin grants/revokes it; Office A needs both the grant and ownership of an active case to assign a version. Other Office users, Operations and Staff cannot publish. Publication capability alone does not reveal cases.
- Added one immutable case-specific assignment for the existing Staff A Template V2 `CONTRACT_TERMS` requirement. The published V2 requirement definition still reads `NOT_AVAILABLE`; no V3, case replacement or generic provider override was created.
- Added typed exact-version access and immutable Staff-only acknowledgement business records. The server records an authorised open request before serving PDF bytes. The acknowledgement RPC requires that access row, the exact active assignment, the actual Staff Person and an affirmative server request. Opening alone never acknowledges. Access is **not** proof of reading; acknowledgement is **not** a signature, legal agreement, compliance decision or deployment approval.
- Added Office synthetic document creation/upload/preview/publish and exact-case assignment UI, plus Staff open/acknowledge UI. The existing Staff A V2 case moved from **3 of 6** to **4 of 6**. Identity Evidence remains Not configured, induction remains Not connected, and the case remains In progress.
- Published a second synthetic version **after** v1 acknowledgement. Readback showed v1 `SUPERSEDED` with unchanged hash/assignment/acknowledgement, and v2 `PUBLISHED` with no assignment or acknowledgement. No re-acknowledgement policy was invented.

## Source-controlled database and Storage changes

Four additive migrations were applied, in this order:

1. `20260923052335_controlled_documents_03c.sql`: seven tables, indexes/constraints, RLS and guarded RPCs, private bucket and Storage policies, version/history triggers and audit entity types.
2. `20260923052843_fix_controlled_history_guard_03c.sql`: publication-event trigger handles records without a case ID.
3. `20260923052959_fix_controlled_catalog_rls_03c.sql`: exact controlled-document and version read policies use the correct row IDs.
4. `20260923053548_serialize_controlled_authority_03c.sql`: document-row locks serialize publication with assignment, person-row locks serialize grant with revocation, and direct Staff Storage retrieval requires the typed exact-version access record.

Tables: `controlled_publisher_grants`, `controlled_documents`, `controlled_document_versions`, `controlled_publication_events`, `onboarding_controlled_assignments`, `controlled_document_accesses`, `controlled_acknowledgements`. Their business rows are distinct from `audit_events`. Seven controlled-table SELECT policies, guarded RPC writes, and separate Storage object policies were read back. The controlled bucket read back as `public = false`; the V2 Contract definition read back as `NOT_AVAILABLE`; Staff A's existing V2 case had one exact acknowledgement.

The two one-page, synthetic PDF fixtures are in `output/pdf/`. They contain no real contract clauses or personal data. The browser demonstration document has v1 hash `e1bad5f61b169cb4b729ef724d704a1640035991bdec8efcbecfc9e59143da7c` (2,230 bytes) and v2 hash `b67601b5e5389ba3ca181a2a8e621dd21cb54dfbd0c8974dd5612dbc3e7c9447` (2,229 bytes). The v1 assignment and acknowledgement remained bound to version `b1f29e5e-6a4e-43fc-bcd9-52cd75b6c5fb`; v2 `d576027f-0904-40e6-8e8e-c7995cb3c5ab` had neither.

## Verification actually run

| Check | Result |
|---|---|
| `npm ci` | Passed, 369 packages; existing optional `unrs-resolver` warning |
| `npm run lint` | Passed |
| `npm run build` | Passed with webpack and TypeScript |
| `npm run smoke` | Passed, 1/1 |
| Serial Phase 01/02/03A/03B plus 03C suite | Passed, 10/10 tests, 0 failures |
| 03C focused test | Passed. Exact access, immutable versions, scoped publication/assignment, direct Storage denial before access, unresolved supersession denial, v1 history after v2, RLS/direct-write denials, and grant revocation/restoration covered. |
| Migration/object readback | Four 03C migrations listed remotely; seven tables, seven policies, private bucket, unchanged V2 definition and exact acknowledgement confirmed. |
| Browser | Existing Staff A V2 case: Office published/assigned v1; Staff opened the private PDF, then explicitly acknowledged it; Office and Staff both showed 4 of 6 and v1 acknowledgement. Both roles were checked at 1280px and 390px, with document width equal to viewport width at 390px. |

The 03B regression intentionally changed Staff A's current synthetic profile and credential, temporarily lowering that shared case to 2 of 6. After the suites completed, Staff resubmitted Personal Details and a new synthetic SIA credential; Office issued a new protected evidence request, accepted the exact new version and separately reverified SIA through the normal routes. Final API and Office browser readback returned the **same V2 case to 4 of 6**, without rewriting its earlier revisions or v1 controlled-document acknowledgement.

Browser captures: [Staff desktop](../../output/playwright/task-03c-staff-desktop.png), [Staff 390px](../../output/playwright/task-03c-staff-390.png), [Office desktop](../../output/playwright/task-03c-office-desktop.png), [Office 390px](../../output/playwright/task-03c-office-390.png).

## Independent Sol review

One bounded GPT-6 Sol read-only review examined publication, immutable versioning, file audience and acknowledgement. It identified three issues; all were fixed before final verification:

1. Concurrent publication and case assignment could supersede a version just assigned. Both operations now serialize on the controlled-document row and recheck state under lock.
2. Direct Staff Storage GET could return an assigned object before the server's open/access event. Storage RLS now requires a typed access row for that exact assignment/version; the server writes it before serving bytes. The test proves denial before access and allowance after it.
3. Concurrent publisher grants could survive a revoke as a fresh active grant. Grant and revoke now serialize on the target Person row.

The access row records an authorised **open request**; it is not a claim that the PDF was fully read. After that event, repeated direct authenticated downloads are authorised while the case and Staff role remain active; those repeated byte requests are not individually recorded as new access events in 03C.

Supabase security advisor returned only its existing GraphQL table-discovery and guarded `SECURITY DEFINER` execute warnings, including new controlled objects. RLS and RPC authority were exercised directly in the test; GraphQL schema discoverability is not treated as permission to read rows. Performance-advisor fetch was unavailable on this run. These advisor warnings should be revisited before a live pilot.

## Remaining gates and next task

No real contract, passport, RTW/SIA evidence or employee data may be used. Malware scanning, production retention/deletion, privacy review, secrets, backup/recovery, pilot environment and operational ownership remain open. There is no e-signature, legal contract execution, document-reading proof, live policy re-acknowledgement campaign, SharePoint connection or deployment.

**Proposed TASK-03D for approval:** complete **Identity Evidence** on the existing versioned onboarding model using the established private personnel-evidence request → immutable version → Office evidence review → separate exact-version requirement verification pattern. The task should define the synthetic identity requirement and verifier authority before implementation, keep legal identity policy out of scope, and demonstrate 5 of 6 while induction remains disconnected. Office team queues, cover and reassignment remain required later in Phase 03; the current original-owner rule is temporary. Do not begin 03D without separate approval.
