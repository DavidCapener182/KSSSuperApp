# TASK-05A report — CRM Foundation

**Date:** 23 September 2026

**Environment:** dedicated synthetic development Supabase project only
**Status:** implemented and development-verified; David's acceptance pending. No staging deployment or real CRM import.

## Delivered

- One stable `crm_organisations` record serves Prospect and Client relationships. `crm_contacts` are external business Contacts, separate from KSS People. `crm_opportunities` are linked to Organisations and optionally to an exact same-Organisation primary Contact. A Lead is a New Lead Opportunity, not another table.
- A controlled seven-stage pipeline permits forward skips. Backwards movement and Lost require a reason; Won requires deliberate UI confirmation. Won/Lost are terminal. The guarded Won transaction preserves the Organisation ID while promoting Prospect to Client and writing typed stage/relationship history. A later Lost Opportunity does not demote Client.
- Account and Opportunity owners are active Office/Super People. Ownership is accountable assignment, not a visibility partition: active Office and Super see organisation-wide CRM; Operations, Security Staff, anonymous and unmapped identities have no 05A CRM access.
- Typed immutable records preserve Opportunity stage, owner and estimated-value changes, Organisation account-owner changes, and Prospect → Client transition. Generic audit contains IDs and changed-field names, not Contact values, summary text or Lost reasons.
- CRM Overview, Organisations, Contacts, Opportunity list, Organisation detail, Opportunity detail and create/edit/stage forms are available through the authenticated shell. Search/filter/pagination and dashboard counts are server-authorised. The UI retains the blue/graphite/neutral design with no intentional green; Won is blue/neutral.
- Existing `sites`, Staff/People/Profile, private Documents, onboarding and Tasks were not connected to CRM or widened. No CRM Task adapter, Kanban, tender integration, real contact import or staging deployment was added.

## Schema and migration readback

Source-controlled additive migrations:

1. `supabase/migrations/20260923173000_crm_foundation_05a.sql` — three core tables, Opportunity and relationship events, constraints/indexes, RLS, narrow read grants, guarded create/edit/stage/owner/value operations and audit integration. Applied to development as migration `20260923173348 crm_foundation_05a`.
2. `supabase/migrations/20260923174500_crm_account_owner_history_05a.sql` — typed Organisation account-owner transition history and guarded update correction. Applied to development as `20260923174246 crm_account_owner_history_05a`.

Object readback returned exactly the six `crm_*` tables expected: Organisations, Contacts, Opportunities, Opportunity events, relationship events and Organisation owner events. Each has RLS. Ordinary authenticated clients have CRM SELECT only under active Office/Super policy; mutation comes through guarded functions that independently resolve stable Person identity and active role. Staff, Operations and anonymous direct reads/writes were denied in the focused test.

## Business/security review

The review checked direct table/RPC access, role expiry, exact Contact–Organisation binding, duplicate active email/primary Contact constraints, forged owner, terminal stage protection, direct history/audit denial and Prospect → Client atomicity. The first pass found that account-owner changes had only generic audit; the forward correction added typed old/new owner history. It also replaced an unbounded Overview stage read with scoped count queries and restricted search input before PostgREST filters.

Supabase security advisor after DDL reported no new CRM table missing RLS policy. Its project-wide GraphQL-schema visibility warning includes six CRM tables because authenticated users have SELECT grants; CRM row policies still return no rows to Staff/Operations. It also flags guarded security-definer functions as callable by authenticated users; each 05A public function rechecks active CRM authority and exact record rules. The inherited onboarding tables with RLS and no direct policies remain intentionally RPC-only. See [Supabase database linter](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed) for the schema-visibility advisory. This task did not modify the existing project-wide GraphQL exposure model.

## Verification actually run

| Check | Result |
| --- | --- |
| `npm ci` | Pass; clean install of 673 packages |
| `npm run lint`, `npx tsc --noEmit`, `npm run build` | Pass; Next Webpack production build |
| `npm run smoke` | Pass on loopback after production build |
| `tests/crm.test.mjs` | Pass: two tests covering guarded lifecycle, direct RLS/RPC, role expiry, exact Client identity/history, Contact integrity and protected routes |
| Phase 01 access/Sites/shell | Pass; shell expectation updated only for authorised CRM navigation |
| Phase 02 Documents/review/My Work | Pass |
| Phase 03 onboarding/Profile/SIA/controlled documents/Identity Evidence/team queue | Pass |
| Phase 04 People directory/Staff Record | Pass |
| Actual local browser, Office desktop and 390px | Pass; create Organisation/Contact/Opportunity, skip forward stage, confirm Won, same Organisation shows Client; mobile Organisation detail had 390px document width at 390px viewport |
| No-green source audit | No green/emerald/lime/mint/teal CRM styling found |

Browser evidence: [desktop Organisation list](../../output/playwright/crm-05a/organisations-desktop.png), [390px Organisation list](../../output/playwright/crm-05a/organisations-mobile-390.png), [390px Client Organisation](../../output/playwright/crm-05a/client-organisation-mobile-390.png), [desktop Client Organisation](../../output/playwright/crm-05a/client-organisation-desktop.png), [desktop Won Opportunity](../../output/playwright/crm-05a/won-opportunity-desktop.png). Screenshots show synthetic development data only.

The initial sandboxed test/smoke runs could not reach Supabase or bind loopback; the same checks passed with the required local/network permissions. A temporary synthetic Office browser state file was removed and its Playwright browser closed after verification. The Command Line Tools Git binary worked around the Mac's Xcode licence prompt, allowing repository status, staged diff and commit checks without changing system licence state.

## Remaining limits and next recommendation

- 05A does not define contract execution, active Client service, Site/Venue ownership, revenue, forecasts, tender portal integration or CRM Tasks. Won means a recorded commercial pipeline decision only.
- Contact relationships are one Organisation per Contact in 05A. A cross-Organisation relationship and duplicate merge process need explicit design before any real import.
- Development accumulated synthetic regression rows by design; the separate protected staging environment and its deferred Staff credential handoff were untouched.
- Production/live data still requires privacy, retention, malware, backup/recovery, policy and operational gates already recorded for the platform.

**Recommended next task, separately approved:** TASK-05B for an operational Kanban pipeline, attributable CRM activities/follow-ups and exact Task integration. Do not start it automatically.
