# CLIENT-01 / CLIENT-TFS-01 implementation candidate

Date: 27 September 2026. Isolated worktree: `client-cw01-build`, starting `origin/main` `1bafa6464f3ae549b8c3b5c1f4ce7b70cf24bc31`.

## Implemented source boundary

- `/client-workspaces` lists only workspaces returned by the exact `cw_directory()` Person grant guard. Super Admin access management lives at `/client-workspaces/manage`; being Super Admin does not itself reveal issue content.
- One workspace is bound by unique FK to an existing CRM Organisation with `CLIENT` relationship. `LOSS_PREVENTION` is an explicit module registration. Three finite Person permissions are `VIEW`, `OPERATE`, `MANAGE`; reasoned grant/revocation is recorded. The guard checks effective/revoked times, current Person, active Client relationship, active workspace and enabled module on every RPC call.
- Six source TFS states remain distinct. The board has source region, search, priority, unproven internal-theft review marker, evidence summary and next action. Issue detail has source note, next action and immutable revision history. Narrow view uses a single selected lane and 44px controls. Updates use revision checking, pending state and server readback before confirmation.
- `tfs_lp_issues` stores exact text store number, nullable Site/Person mapping fields, human source labels, and optional source-system/key/snapshot hash provenance. No source record or invented prototype card is seeded. `tfs_lp_issue_events` preserves before/after snapshots. Direct table grants to `anon`/`authenticated` are revoked and RLS is enabled. Only guarded authenticated RPCs expose the data.
- A real import path is reserved by `(workspace_id, source_system, source_snapshot_sha256, source_key)` uniqueness within a frozen export and snapshot hash. Import implementation and actual data movement remain pending inventory and exact mapping readback.

## Checks run

- Installed locked dependencies and read the installed Next 16.3.6 page/route-handler guidance before coding.
- Scoped ESLint passed for all new route/component/module files.
- `npx tsc --noEmit` passed after the Next build generated route type definitions.
- PostgreSQL parser accepted all 32 statements in the base migration and the one-statement stale-revision followup. `node --check`, scoped ESLint and `git diff --check` passed after the followup.
- Next Webpack production build passed with nonfunctional placeholder public Supabase values, including the Client Workspace directory, management, board, detail and API routes. The first build without any public Supabase settings compiled and passed TypeScript but failed while prerendering the existing `/staging-access` page; placeholder values resolved that local environment issue.
- Synthetic Dev project `dnfhkmmnlbiabqypclqg` has migrations `20260927190000_client_workspace_tfs_cw01.sql` and `20260927192406_client_workspace_stale_revision_conflict.sql` applied. The latter changes a stale issue revision from retryable PostgreSQL `40001` to business error `P0001`; the API maps that exact error to HTTP 409. The first authenticated regression exposed a test-fixture error: direct CRM table insertion was denied. The fixture now uses the guarded CRM Prospect → Won → Client route.
- The root task ran the corrected authenticated regression against synthetic Dev: **1/1 passed in 2.68s**. It checked direct-table denial, exact grants, cross-client UUID denial, issue create/update/history readback, prompt stale-revision rejection and revocation. Earlier timed-out attempts left labelled synthetic CRM, workspace and issue fixtures; they are not TFS source records.
- Follow-up migration `20260927190100_client_workspace_active_grant_cw01.sql` is recorded in Dev as `20260927171902_client_workspace_active_grant_cw01`. Live function readback confirms a recipient must have a current active role before a Super Admin may grant workspace access. The authenticated regression also passed independently in this worktree; a Next 16.3.6 Webpack build and scoped ESLint passed.

## Not yet verified

- Authenticated browser visual checks and global navigation integration remain open. The coordinator owns shared shell changes. Navigation must point to the guarded `/client-workspaces` directory; `CRM_USE` or a role alone never authorises issue content.
- The synthetic test workspaces were created through CRM and grant RPCs for security proof. They do not establish a verified TFS Client/Site/Person mapping or complete the actual TFS board.
- Existing TFS browser-local state and Outlook group have not been imported or represented in this build. The standalone source inventory and private-data mapping gates must close before import. An empty board is expected until then.
- No real evidence attachments, Visits contract, Reports projection, generic workflow engine, real KSS/TFS data or production connection is part of this candidate.
