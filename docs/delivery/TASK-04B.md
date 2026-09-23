# TASK-04B proposal — unified Staff Record consolidation

**Status:** Approved by David and implemented in synthetic development on 23 September 2026. See `TASK-04B-REPORT.md` for verification and limitations.

## Outcome and boundary

Make `/people/[id]` a useful Staff Record that brings together existing authorised Person, Profile, onboarding, SIA, Document and Site information. Keep `people.id` as the stable Person identity and every source system authoritative. The accepted TASK-04A principle remains: **directory visibility does not grant private personnel access**.

This is the last planned People consolidation task before 05A CRM. It does not create a general HR database or add payroll, banking, NI, absence, medical, disciplinary, performance, expenses, availability, deployment eligibility, general HR notes or live staff data. Do not restore the development Staff A fixture merely for presentation.

## Current implementation to reuse

- TASK-04A already supplies a server/database guarded safe directory projection, `/people` and `/people/[id]`. Office discovery is organisation-wide; Operations discovery is narrower; Staff self only. The Staff Record currently has honest but mostly restricted sections.
- `person_profiles` and protected submitted revisions are the Personal Details source. Staff `/profile` is the self-service path. Profile reads currently have their own RLS and onboarding-case rules; they must be inspected again during implementation rather than inferred from a directory row.
- `onboarding_cases`, versioned requirements, Profile/SIA submissions, requirement verifications and controlled acknowledgements are authoritative for onboarding. Existing `readOnboardingCase` and `get_onboarding_case_access` already compose detailed case state under owner/cover/Super/staff rules.
- `person_sia_credentials` and immutable credential revisions are the synthetic SIA source; expiry is derived using the approved Europe/London date rule. A category or format is not proof of a genuine licence.
- Private `document_requests`, versions, reviews and bytes have their own metadata, server and Storage access checks. The controlled Terms document has a separate published-document model.
- `site_assignments` and `sites` are the Site source. Site membership never grants private personnel access.

## Detailed access model

| Viewer | Staff Record discovery/Overview | Private sections |
|---|---|---|
| Active `SUPER_ADMIN` | All People via the 04A safe projection | Existing bounded privileged source reads only; use current audited case/private-read paths where available. No unaudited blanket data fetch. |
| Active `OFFICE_ADMIN` | Organisation-wide safe record header and Overview | Profile, SIA, onboarding, document and historical details only through existing exact case owner/cover/source authority. An unrelated Office user sees a clear restricted state. |
| Active `OPERATIONS` | Narrow safe operational Overview from 04A | No private contact, profile revisions, SIA number/evidence, RTW/Identity, document metadata/bytes or private onboarding comments. |
| `SECURITY_STAFF` | Own record only | Own Profile, own authorised onboarding and own Document routes. No peer discovery or peer detail. |

Server composition must check each section separately, use the signed-in user's ordinary Supabase client, and preserve database RLS as defence in depth. A record link, a SiteAssignment, team triage or a guessed ID must never become a private-read permission. Do not use a service-role client to assemble the Staff Record. If KSS needs a durable wider personnel-administration capability beyond existing case/source authority, bring that permission model back for separate approval; do not add it implicitly in 04B.

For a denied section, return only a generic restricted state. Avoid leaking whether a specific private document, SIA reference, revision or review exists through counts, timing-oriented extra requests, filenames or hidden HTML. Source-specific links appear only when the source operation can independently authorise them.

## Record composition and section behaviour

**Header and Overview.** Use the 04A safe Person projection for display name, active roles, permitted current Site context and broad onboarding state. Where the viewer has exact detailed authority, add a compact current-case progress/blocker and a synthetic SIA status summary from existing records. Show the Training provider as `Not connected`. Use labels such as “Office action needed” only if derived from an authorised case. No compliance score, deployment-ready badge or legal RTW/SIA/identity conclusion. Preferred name may be shown only when the viewer can read the Profile; never infer it from sign-in identity.

**Personal Details.** For Staff self, display current authorised Profile information and retain `/profile` for editing, draft save and explicit submission. For an Office owner/cover or Super Admin, show approved fields only if the existing Profile/case-specific policy grants that exact read. Distinguish current values from the last submitted immutable revision and indicate “update needs submission” without rewriting history. Unrelated Office and Operations see “Private details restricted.” Do not expose Auth provider IDs or sign-in email as contact data.

**Onboarding.** List only cases the viewer can read under existing onboarding authority; include template/version, case state, progress count and the primary next action/blocker from the existing case service. Keep historical cases distinct from the current case; do not collapse V1 and V2 or show a cancelled case as active. A safe directory-level broad state can remain visible to Office/Operations without exposing exact private case details. Every deep link to `/onboarding/[id]` rechecks its own access.

**Credentials.** Initially compose SIA only. For Staff self or a case-authorised Office/Super viewer, show the controlled category, submitted/current distinction, synthetic expiry/current state and a link to the authorised evidence or case workflow. Show the reference/number and exact revision only where source RLS and server policy permit. Operations and unrelated Office receive at most the already-approved broad indicator, never the reference, evidence or an inferred licence-validity claim. Keep the section shape reusable for later separately approved qualifications.

**Documents.** Show a small list of authorised request categories and workflow states only if the Document service itself permits metadata read for that Person and request. Link to the existing `/documents/[requestId]` route. Continue using the existing private file route and Storage RLS for bytes. Controlled Terms acknowledgement is shown through the exact authorised onboarding case; it is not a personnel upload or a signed contract. When no document detail authority exists, show “Documents restricted,” not a count or filenames. No second upload/review system or generic document library.

**Training.** Show “Training provider not connected.” No course, score, certificate, completion or manual tick. Keep a clear slot for later LMS data without creating an LMS table or inventing a provider in 04B.

**Sites / Assignments.** Show current permitted Site context using 04A's safe projection. If existing Site/assignment authority permits historical detail, show Site, effective period and current/ended status. Do not expose reason or actor where the viewer lacks the corresponding source authority. If historical assignment reads require a broader new policy, leave history restricted and document that limitation. SiteAssignment remains irrelevant to Profile/Document authority.

**Activity.** Do not dump `audit_events` or build a general timeline in 04B. Show a concise “Activity timeline not yet available” state with links to authorised source histories. A future safe cross-module timeline needs an explicit event whitelist and access model, and should be considered alongside later product modules rather than adding a 04C by default.

## UI and navigation

Keep one Staff Record route with a strong header, concise Overview and section navigation. Use section anchors or accessible tabs only where they improve orientation; avoid a stack of repeated links and identical cards. On desktop, show a restrained two-column layout with the most useful authorised information above the fold. At about 390px, sections become readable cards/stacked panels with no horizontal overflow, 44px-class controls and an understandable restricted state. Preserve keyboard/focus behaviour, text status labels, loading/empty/error states and the accepted iOS-inspired shadcn, blue/graphite/neutral, **no-green** design standard.

Do not fetch all private sections merely to decide which tabs to show. The page should load safe Overview first, then only exact authorised section data. Avoid serial per-case/per-document waterfalls; bounded parallel reads or a small guarded projection are acceptable if source policies remain intact. No new persistent summary table is proposed.

## Proposed technical shape

1. Extend the existing server-only People composition layer with explicit safe and detailed section types. Keep the 04A RPC as the directory source; do not add sensitive fields to it.
2. Reuse current Profile, onboarding, SIA, Document and Site read helpers/guarded RPCs. Add narrowly scoped adapters only where needed to turn an already-authorised source result into a Staff Record section. Client props must contain only fields authorised for that viewer.
3. Prefer no migration. A small guarded read RPC or index may be proposed during implementation if the existing source path cannot provide a performant authorised section; it must not widen RLS, return private values through the directory projection or create a durable access grant. Any materially broader schema/permission change requires David's approval before migration.
4. Keep read-only consolidation in 04B. Staff Profile edits continue through `/profile`; onboarding decisions and document actions continue through their existing routes. No People-specific mutation endpoint is needed.

## Required acceptance and negative tests

- Office A can discover any synthetic Person safely and open detailed sections only for the exact case/source it is authorised to manage; Office B can discover the same Person but cannot get A-only private values or counts.
- Active Operations sees the narrow record but cannot obtain contact/address, SIA reference/evidence, RTW/Identity metadata or bytes by page, API, guessed URL or direct database/Storage access.
- Staff A sees their own record/Profile and cannot list or open Staff B; dual-role and expired-role cases still follow the most restrictive applicable self-action and active-authority rules.
- Profile RLS remains authoritative for current and submitted revisions. A required-field change affects current Personal Details completion only through existing rules; historical submitted revision remains intact.
- SIA summary follows the exact current submitted revision, accepted evidence and expiry rule. An expired credential loses current completion without deleting its history; private reference cannot leak through safe JSON or rendered HTML.
- Onboarding case and Document deep links independently re-authorise. Directory visibility and SiteAssignment alone cannot reveal private filenames, comments, versions or bytes. Cover can see only its existing exact pending work scope; completed historical evidence remains protected.
- Current, V1/V2 historical and cancelled cases display distinctly without changing their business records. The development Staff A count remains whatever authoritative current state produces.
- Search/count/pagination retain the 04A safe scope. No server/API error accidentally serialises private source rows.
- Training remains `NOT_CONNECTED`; no compliance/deployability claim appears.
- Run clean install, lint, Webpack build, smoke, relevant Phase 01–04A regression suites, focused Staff Record server/RLS/Storage tests, desktop Office and 390px Staff/Office/Operations browser checks, staged secret scan and no-green source/UI check. Capture representative screenshots and report actual results. Do not run fixture-mutating suites against staging.

## Stop conditions and next stream

Use synthetic development data only. Do not alter staging, Vercel protection, Auth configuration or the deferred Staff password handoff. Do not import real Staff or connect the LMS, CRM or other integrations. If useful detailed Office access requires a new general personnel-administration permission, stop and return that exact access design rather than silently broadening `OFFICE_ADMIN`.

After accepted 04B, move to **05A CRM Foundation — Organisations, Contacts and Opportunities** under a separate approval. No automatic 04C/04D People expansion and no CRM implementation in this task.

**Stop:** TASK-04B ends with its separate development commit and report. TASK-05A CRM requires separate approval.
