# TASK-18A delivery report — explicit Mobilisation

Date: 24 September 2026. **Status:** accepted by David in synthetic Dev on 24 September 2026 at implementation commit `8b0bf9e`. This report records actual checks, not a staging or production readiness claim. No real Client data, staging deployment, production deployment, notification, finance, contract, PO, asset integration, Control Room integration or Site Book integration was added by 18A.

## David's acceptance — TASK-18A

David accepted TASK-18A Explicit Client Mobilisation in synthetic Dev on 24 September 2026. Mobilisation is a distinct operational coordination domain connecting CRM handover to subsequent Site/Event/Service setup. CRM Opportunity state, Mobilisation actions and action counts do not establish operational readiness.

The accepted first slice includes explicit Office/Super authorisation, separate Static Site and Event V1 templates, actions, dependencies, blockers, decisions, exact guarded source links, owner and target-date management, explicit go-live review and handover, and immutable history. CRM `WON` does not automatically create Mobilisation. Source records remain authoritative and retain their independent permissions.

Mobilisation does not establish contract approval, staffing readiness, training completion, asset availability, compliance, billing authority or operational eligibility. David accepted the synthetic integration/security tests, relevant source regressions, production Webpack build and authenticated desktop/390px Office browser evidence recorded below. This acceptance authorises no staging, production, real KSS data, finance, notifications, Asset, Control Room or Site Book integration.

## Approved boundary and delivery

David approved a standalone stable Mobilisation ID and an explicit Office/Super authorisation action. A CRM Opportunity moving to `WON` still creates no Mobilisation. A Client Organisation may start one without an Opportunity. A second named scope may be started deliberately; reuse of a Won Opportunity requires a different title and a reason. Mobilisation is neither source authority nor a readiness verdict.

The first slice adds:

- Two immutable published V1 templates, **Static Site Mobilisation** (13 actions) and **Event Mobilisation** (12 actions), bound by exact template ID/version at creation. Existing instances are not rewritten when a future template version is published.
- Stable Mobilisation, action, dependency, blocker, decision, source link and typed history identities. Named active Office/Super owners; explicit target go-live date; `PLANNING → IN_PROGRESS → GO_LIVE_REVIEW → HANDED_OVER` and reasoned `CANCELLED`. Terminal records are read-only. No clock-driven state change.
- Guarded, actor-derived, revision-checked and idempotent create/change/unlink RPCs. Dependencies must stay within one Mobilisation and cannot cycle; completion is blocked while prerequisites remain incomplete. First-class blockers and decisions remain independent of source module state.
- Exact source references to Contact, Site, Site Service, Event, same-Client CRM follow-up Task and submitted DocumentVersion. No shadow Client, Site, Person, Task or Document. Link removal preserves the source and typed link history. Site, Service and Event creation continues through their existing source routes; the Mobilisation UI only navigates/prefills Client context and links an exact returned ID.
- An Office/Super `/mobilisations` list and `/mobilisations/[id]` detail, with a Client/Won Opportunity CRM entry link. Separate Client and eligible Office/Super owner choices avoid an Operations owner in the creation form. The review page shows action counts and unresolved items, open blocker details, current source states and `external / not connected` Training. Handover requires an attributable note and snapshots factual outstanding actions, blockers and source states. It never states that a service is safe, compliant, contracted, fully staffed or billable.
- Server route gates and no direct authenticated table grants. RLS is enabled on every new public table. The guarded projections mask private DocumentVersion IDs from current links, link history, status history and handover decisions when the reader lacks the document's original permission. A linked private file gains no wider audience. Staff, Operations and Client roles receive no Mobilisation access.

The source file set is the six `supabase/migrations/*mobilisation*_18a.sql` migrations; `/api/mobilisations` routes; `/mobilisations` pages; `mobilisation*` components/styles; the narrow capability, return-target, CRM entry-link and shell-test edits; and `tests/mobilisation.test.mjs`. Unrelated shared-tree work was preserved.

## Synthetic Dev migration and readback

Dedicated target was rechecked as Supabase project `dnfhkmmnlbiabqypclqg` (`KSSNWLTD's Project`, `eu-west-1`) before the 18A migration. The MCP assigns remote history versions independently of local source filenames; this project already uses that pattern (see accepted 09B report). Exact mapping:

| Local source version | Dev history version | Name |
|---|---|---|
| `20260924222000` | `20260924174558` | `mobilisation_18a` |
| `20260924222100` | `20260924174950` | `mobilisation_handover_facts_18a` |
| `20260924222200` | `20260924175927` | `mobilisation_choices_18a` |
| `20260924222300` | `20260924180257` | `mobilisation_safe_projection_18a` |
| `20260924222400` | `20260924180450` | `mobilisation_unlink_18a` |
| `20260924222500` | `20260924181601` | `mobilisation_private_facts_18a` |

Readback after application found two templates, the four core RPCs, RLS enabled on checked Mobilisation tables and zero `authenticated` table grants for `mobilisation%` tables. The synthetic integration runs created disposable Mobilisation test records; no pre-existing CRM, Site, Service, Event or Document source row was changed by 18A. Historical test records remain in Dev as attributable synthetic data. No 13A, 14A or 15A migration/file was applied or edited on behalf of those tasks.

The Supabase security advisor readback reported the expected informational `RLS Enabled No Policy` entry for the RPC-only `mobilisation_requests` table and generic `authenticated_security_definer_function_executable` warnings for the six deliberately exposed, actor- and role-guarded Mobilisation RPCs. The latter are the app's controlled Data API operations; direct base-table grants remain absent. No 18A table appeared in its authenticated-table-exposure warning list.

## Verification

- `node --env-file=.env.local --env-file=.env.test.local --test tests/mobilisation.test.mjs`: **1/1 passed** after final privacy projection and a same-revision concurrent change race. It covered Static Site and Event templates, exact Won and no-Opportunity starts, idempotent retry and changed-key denial, one concurrent winner, Client/source mismatch denial, Site/Service/Event links, submitted exact DocumentVersion permission and cross-Office redaction, owner reassignment, target change, dependency cycle denial, blocker, handover with unresolved facts, immutable history, terminal denial, source unlink/relink preservation, direct-table denial, and Staff/Operations denial. The final test also verified that a second Office reader cannot extract the private version UUID anywhere in a handed-over detail JSON, while the authorised Office reviewer retains the exact version snapshot.
- Serial source regressions: `crm.test.mjs`, `crm-operational.test.mjs`, `events.test.mjs`, `site-shifts.test.mjs`, `documents.test.mjs` and `mobilisation.test.mjs` yielded **8/8 tests passed**, zero failures. `tests/shell.test.mjs` yielded **2/2 passed**, including Office-only Mobilisation routes, expected navigation and allowed local return targets.
- `npm run build` passed with Next.js 16.3.6 Webpack and TypeScript. Focused ESLint passed for owned routes, pages, components and tests. A source-only TypeScript run excluding stale duplicate `.next/dev/types/* 2.ts` generated files passed. The ordinary `tsc --noEmit` path initially reported only those duplicate generated type declarations; the later Webpack build's TypeScript pass is the release-relevant type check. `git diff --check` and an owned no-green token scan were clean.
- Authenticated synthetic Office browser on the built app: `/mobilisations` displayed eligible Client/Office owner choices and both templates; the normal form created an Event Mobilisation with an exact Won Opportunity and required duplicate-scope reason; its detail displayed the 12 actions and linked an exact existing Event with current `COMPLETED` state. Desktop 1440px and 390px list/detail screenshots were captured in `output/playwright/mobilisation-18a/`. At 390px, `document.documentElement.scrollWidth` equalled the 390px viewport on both list and handover detail. The static handover detail visibly retained 13 open actions and one unresolved blocker after an explicit decision. These checks do not prove every action form's visual state or human UX acceptance.

## Material limits and next decisions

V1 template actions are versioned and factual, but their due dates are entered per action; no unapproved relative deadline offsets or automatic rescheduling were invented. The handover review shows current states of linked Site, Service, Event and DocumentVersion records, but it does not infer staffing capacity, training completion, asset availability, contract approval or operational eligibility. Staffing demand/allocation aggregates, controlled SOP publication state and later 15A Asset links need separate source-specific read contracts if David wants those facts on the review screen. Exact source UUIDs can be entered manually for linking; a curated source picker is a later usability improvement. History displayed in the UI is limited to the latest 100 revisions; older immutable rows remain stored and would need a separate paginated history endpoint for long-lived Mobilisations.

The two existing templates serve distinct Static Site and Event scopes. Their actual workstream defaults and any target-relative due-date rules should be reviewed with KSS before live use. A handover decision is an attributable human record with outstanding items visible; it is not a release, compliance or contract approval.

## Follow-on backlog, not authorised by this acceptance

Keep 18A stable. After their source modules are stable, consider exact factual links from 15A Assets, Documents/SOP publication and acknowledgement, and native Training completion. Training remains `external / not connected` meanwhile. A future Control Room view may link back narrowly after explicit handover without displaying Mobilisation actions there. Curated, permission-aware Site/Event/Document source pickers are a high-priority usability improvement over manual UUID entry. Each integration needs its own bounded source contract and approval.

**Acceptance boundary:** TASK-18A is accepted only in synthetic Dev. No staging, production, real data or follow-on integration is authorised by this acceptance.
