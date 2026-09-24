-- Keep approved worked-time history closed when a later source change flags it.
-- A separate reopen authority is intentionally outside TASK-10B.
create function private.event_work_time_prevent_approved_reopen_10b()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status='REVIEW_REQUIRED' and new.status='RETURNED' and exists(
    select 1 from public.event_work_time_events e
    where e.case_id=old.id and e.kind='WORKED_TIME_APPROVED'
  ) then raise exception 'Approved worked-time history requires separate reopen authority'; end if;
  return new;
end $$;
revoke all on function private.event_work_time_prevent_approved_reopen_10b() from public,anon,authenticated,service_role;
create trigger event_work_time_prevent_approved_reopen_10b
before update of status on public.event_work_time_cases
for each row execute function private.event_work_time_prevent_approved_reopen_10b();
