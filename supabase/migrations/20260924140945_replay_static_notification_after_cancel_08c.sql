-- TASK-08C correction: return the committed logical notification before
-- attempting an INSERT. This keeps retries idempotent after source state moves.
create or replace function private.ensure_site_shift_notification_08c(p_source_event uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare source_row public.site_shift_allocation_events%rowtype; created_id uuid;
begin
 select e.* into source_row from public.site_shift_allocation_events e
  join public.site_shift_allocations a on a.id=e.allocation_id and a.demand_id=e.demand_id and a.person_id=e.person_id
  join public.site_shift_demands d on d.id=e.demand_id
  where e.id=p_source_event and e.kind='ALLOCATED' and e.old_status is null
   and e.new_status='ALLOCATED' and e.new_revision=1;
 if source_row.id is null then return null; end if;

 select n.id into created_id from public.staff_in_app_notifications n
  where n.source_kind='SITE_SHIFT' and n.site_shift_allocation_event_id=source_row.id
   and n.site_shift_allocation_id=source_row.allocation_id and n.recipient_person_id=source_row.person_id;
 if created_id is not null then return created_id; end if;
 if exists(select 1 from public.staff_in_app_notifications n
   where n.site_shift_allocation_event_id=source_row.id) then
  raise exception 'Site shift notification binding mismatch';
 end if;

 perform set_config('kss.write_08b','allowed',true);
 insert into public.staff_in_app_notifications(source_kind,site_shift_allocation_event_id,
  site_shift_allocation_id,recipient_person_id,notification_kind)
 values('SITE_SHIFT',source_row.id,source_row.allocation_id,source_row.person_id,'SITE_SHIFT_ALLOCATION_CREATED')
 on conflict(site_shift_allocation_event_id) do nothing returning id into created_id;
 if created_id is not null then
  insert into public.staff_in_app_notification_events(notification_id,source_kind,
   site_shift_allocation_event_id,site_shift_allocation_id,recipient_person_id,action,actor_person_id)
  values(created_id,'SITE_SHIFT',source_row.id,source_row.allocation_id,source_row.person_id,
   'CREATED',source_row.actor_person_id);
 end if;
 return coalesce(created_id,(select n.id from public.staff_in_app_notifications n
  where n.source_kind='SITE_SHIFT' and n.site_shift_allocation_event_id=source_row.id
   and n.site_shift_allocation_id=source_row.allocation_id and n.recipient_person_id=source_row.person_id));
end $$;
revoke all on function private.ensure_site_shift_notification_08c(uuid) from public,anon,authenticated;
