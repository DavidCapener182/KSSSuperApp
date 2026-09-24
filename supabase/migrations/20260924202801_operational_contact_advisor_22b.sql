-- TASK-22B advisor follow-up: fixed paths for pure predicates and narrow history indexes.
alter function public.contact_duty_window_22b(timestamptz,timestamptz,timestamptz) set search_path='';
alter function public.contact_london_window_22b(time,time,timestamptz) set search_path='';
alter function private.contact_windows_overlap_22b(time,time,time,time) set search_path='';
drop function private.contact_window_contains_22b(time,time,timestamptz);
create index operational_contact_event_history_22b on public.operational_contact_events_22b(route_id,occurred_at,id);
create index operational_contact_grant_history_22b on public.operational_contact_grant_events_22b(grant_id,occurred_at,id);
create index operational_contact_read_history_22b on public.operational_contact_history_reads_22b(route_id,occurred_at,id);
create index operational_contact_current_version_22b on public.operational_contact_routes_22b(current_version_id);
