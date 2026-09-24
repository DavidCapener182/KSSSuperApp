-- TASK-08B forward correction: bind every producer retry to the exact
-- allocation event, allocation, requirement and Person before resolving recipient.
create or replace function private.ensure_deployment_notification_08b(p_source_event uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare created_id uuid; source_row public.event_staff_allocation_events%rowtype;
begin
 select source_event.* into source_row from public.event_staff_allocation_events source_event
  join public.event_staff_allocations allocation on allocation.id=source_event.allocation_id
   and allocation.requirement_id=source_event.requirement_id and allocation.person_id=source_event.person_id
  where source_event.id=p_source_event and source_event.kind='ALLOCATED' and source_event.old_status is null
    and source_event.new_status='ALLOCATED' and source_event.new_revision=1;
 if source_row.id is null then return null; end if;
 perform set_config('kss.write_08b','allowed',true);
 insert into public.staff_in_app_notifications(
   source_allocation_event_id,allocation_id,recipient_person_id,notification_kind)
 values(source_row.id,source_row.allocation_id,source_row.person_id,'DEPLOYMENT_CREATED')
 on conflict (source_allocation_event_id) do nothing
 returning id into created_id;
 if created_id is not null then
   insert into public.staff_in_app_notification_events(
    notification_id,source_allocation_event_id,allocation_id,recipient_person_id,action,actor_person_id)
   values(created_id,source_row.id,source_row.allocation_id,source_row.person_id,'CREATED',source_row.actor_person_id);
 end if;
 return coalesce(created_id,(select n.id from public.staff_in_app_notifications n
   where n.source_allocation_event_id=source_row.id));
end $$;
revoke all on function private.ensure_deployment_notification_08b(uuid) from public,anon,authenticated;
