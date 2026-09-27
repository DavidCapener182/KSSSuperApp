# CLIENT-01 / CLIENT-TFS-01 implementation candidate

Date: 27 September 2026. Isolated worktree: `client-cw01-build`, starting `origin/main` `1bafa6464f3ae549b8c3b5c1f4ce7b70cf24bc31`.

## Implemented source boundary

- `/client-workspaces` lists only workspaces returned by the exact `cw_directory()` Person grant guard. Super Admin access management lives at `/client-workspaces/manage`; being Super Admin does not itself reveal issue content.
- One workspace is bound by unique FK to an existing CRM Organisation with `CLIENT` relationship. `LOSS_PREVENTION` is an explicit module registration. Three finite Person permissions are `VIEW`, `OPERATE`, `MANAGE`; reasoned grant/revocation is recorded. The guard checks effective/revoked times, current Person, active Client relationship, active workspace and enabled module on every RPC call.
- Six source TFS states remain distinct. The board has source region, search, priority, unproven internal-theft review marker, evidence summary and next action. Issue detail has source note, next action and immutable revision history. Narrow view uses a single selected lane and 44px controls. Updates use revision checking, pending state and server readback before confirmation.
- `tfs_lp_issues` stores exact text store number, nullable Site/Person mapping fields, human source labels, and optional source-system/key/snapshot hash provenance. No source record or invented prototype card is seeded. `tfs_lp_issue_events` preserves before/after snapshots. Direct table grants to `anon`/`authenticated` are revoked and RLS is enabled. Only guarded authenticated RPCs expose the data.
- A real import path is reserved by `(workspace_id, source_system, source_key)` uniqueness and snapshot hash. Import implementation and actual data movement remain pending inventory and exact mapping readback.

## Checks run

- Installed locked dependencies and read the installed Next 16.3.6 page/route-handler guidance before coding.
- Scoped ESLint passed for all new route/component/module files.
- `npx tsc --noEmit` passed after the Next build generated route type definitions.
- PostgreSQL parser accepted all 32 statements in the migration. `node --check` passed for the new synthetic security regression; that regression has not been executed against Dev.
- Next Webpack production build passed with nonfunctional placeholder public Supabase values, including the Client Workspace directory, management, board, detail and API routes. The first build without any public Supabase settings compiled and passed TypeScript but failed while prerendering the existing `/staging-access` page; placeholder values resolved that local environment issue.

## Not yet verified

- Migration `20260927190000_client_workspace_tfs_cw01.sql` has **not** been applied to synthetic Dev due to concurrent migration sequencing. Thus SQL execution, authenticated grant/denial, cross-client guessed UUIDs, revocation readback, write/readback and browser visual checks against data remain open. Do not deploy this candidate before these checks.
- The CRM Organisation link and global navigation require the coordinator's shared shell/CRM ownership. They must use exact workspace grant checks, not `CRM_USE` or a role alone.
- Existing TFS browser-local state and Outlook group have not been imported or represented in this build. The standalone source inventory and private-data mapping gates must close before import. An empty board is expected until then.
- No real evidence attachments, Visits contract, Reports projection, generic workflow engine, real KSS/TFS data or production connection is part of this candidate.
