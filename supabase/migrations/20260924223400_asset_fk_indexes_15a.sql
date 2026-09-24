-- TASK-15A covering indexes for new foreign-key checks and scoped lists.
create index asset_grant_store_fk_idx on public.asset_capability_grants(store_id) where store_id is not null;
create index asset_grant_site_fk_idx on public.asset_capability_grants(site_id) where site_id is not null;
create index asset_grant_service_fk_idx on public.asset_capability_grants(site_service_id) where site_service_id is not null;
create index asset_grant_event_fk_idx on public.asset_capability_grants(event_id) where event_id is not null;
create index asset_grant_creator_fk_idx on public.asset_capability_grants(granted_by);
create index asset_grant_revoker_fk_idx on public.asset_capability_grants(revoked_by) where revoked_by is not null;
create index asset_item_creator_fk_idx on public.asset_items(created_by);
create index asset_item_home_store_fk_idx on public.asset_items(home_store_id);
create index asset_item_location_site_fk_idx on public.asset_items(location_site_id) where location_site_id is not null;
create index asset_item_location_event_fk_idx on public.asset_items(location_event_id) where location_event_id is not null;
create index asset_item_pending_person_fk_idx on public.asset_items(pending_person_id) where pending_person_id is not null;
create index asset_stock_creator_fk_idx on public.asset_stock(created_by);
create index asset_stock_event_issue_fk_idx on public.asset_stock_events(issue_id) where issue_id is not null;
create index asset_stock_event_person_fk_idx on public.asset_stock_events(person_id) where person_id is not null;
create index asset_stock_issue_stock_fk_idx on public.asset_stock_issues(stock_id);
