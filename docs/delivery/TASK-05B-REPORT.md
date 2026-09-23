# TASK-05B delivery report — Operational CRM

**Date:** 23 September 2026

**Environment:** synthetic development Supabase only
**Status:** implemented and development-verified; David's acceptance pending. No staging deployment or real CRM data.

## Delivered

- Five-column active Opportunity board, with Won/Lost in a separate Closed view. Desktop drag/drop and keyboard/touch stage controls call the existing guarded 05A transition, await the server, and reload authoritative state. Forward skips, backward reasons and terminal rules are unchanged.
- Immutable, typed manual CRM activities with exact Organisation/Opportunity/Contact checks. Corrections create a new linked activity; the original remains. Email and proposal activities describe an Office entry, not verified dispatch.
- Shared `tasks` now has an explicit `CRM_FOLLOW_UP` source branch for exact Opportunity or Organisation. Office can create real follow-ups, assign eligible Office/Super people, complete their own Task without a reason, and explicitly reassign, reschedule or cancel with reason and typed history. Multiple CRM follow-ups may reference one source. Document-review Task uniqueness and review-driven completion remain separate.
- My Work includes assigned CRM follow-ups with source link and London-local due status. Opportunity next action derives from the earliest open Task; undated Tasks follow dated Tasks. Completing a Task does not move the pipeline or fabricate an activity. Stage movement does not complete a Task. Opportunity owner changes do not move Task assignees.
- Opportunity/Organisation pages present follow-ups, manually recorded activity and a bounded curated timeline. CRM Overview adds sourced due-today, overdue, no-future-follow-up and upcoming-decision counts. Mobile uses a single selected stage with stacked cards, including Closed history.
- Active Office/Super CRM authority is enforced in API, RLS and guarded database operations. Staff, Operations, anonymous, unmapped and expired roles cannot use the CRM Task adapter. CRM creates no new People/Profile/Document/Storage permission.

## Database and migration readback

1. `20260923193000_operational_crm_05b.sql`: `crm_activities`, `crm_task_events`, Task CRM branch, source-specific RLS/guards, guarded RPCs and partial DocumentVersion uniqueness.
2. `20260923195000_crm_operational_summary_05b.sql`: sourced operational CRM counts.
3. `20260923200500_document_task_conflict_05b.sql`: forward correction of the existing document Task insertion conflict target to the partial DocumentVersion unique index. This was found by the real document upload regression; the regression passed after the correction.

Applied to the dedicated development Supabase project in source order. Object readback found the partial document index, CRM/document Task read policies and six enabled relevant triggers. Synthetic readback contained 7 CRM Tasks, 3 activities and 19 typed Task events at verification time. Staging schema/data was not changed.

## Verification

- Clean `npm ci`: pass (673 packages). ESLint, TypeScript and Webpack production build: pass. Smoke: pass. `git diff --check`: pass.
- Focused CRM operational database/server/RLS suite: 2 passed. London DST and controlled-clock due suite: 2 passed. Existing 05A CRM suite: 2 passed.
- Existing access, Sites, shell, Documents, document review, My Work, onboarding, profile/SIA, controlled documents, identity evidence, People directory and Staff Record suites: passed. The first My Work document upload failed because of the conflict target above; a source-controlled forward correction was applied and the full suite then passed. No regression was waived.
- Independent bounded Sol review found three issues: My Work's global row limit could omit assigned CRM Tasks, Organisation search had a 100-row cap, and next-action ordering had a nondeterministic tie. All three were corrected and checked. It found no direct authority bypass in the reviewed CRM Task branch.
- Synthetic Office browser: desktop five-column board displayed, a New Lead → Qualified forward skip completed through the guarded action, and the card appeared in Qualified after server refresh. At 390px, the stage selector and Opportunity follow-up/activity/timeline sections were usable; measured document width equalled the 390px viewport. Screenshots: `output/playwright/crm-05b/pipeline-desktop.png`, `pipeline-mobile-390.png`, `opportunity-mobile-390.png`.
- Source audit of new CRM UI/CSS found no intentional green, emerald, lime, mint or green-teal treatment. Secret scan of staged task-owned files found no embedded credential values.

## Boundaries and next decision

The board shows the first 50 opportunities per stage and points users to the paginated Opportunities search for the remainder. Task due labels are in-app status, not an SLA or notification. No email, tender portal, Client/Site/Venue/Event, staffing, forecasting or production data was added. The protected staging deployment and pending Staff password handoff remain separate.

Recommend a separately approved Client → Site/Venue → Event design/build stream next, then Staffing Requirement and Deployment. Do not begin it or deploy 05B automatically.
