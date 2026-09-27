-- A later export of the same saved board must resolve to the original issue.
-- The export checksum is evidence metadata, not part of the card's identity.
create unique index tfs_lp_stable_source_key_idx
 on public.tfs_lp_issues(workspace_id,source_system,source_key)
 where source_key is not null;
