-- Removing declared coverage cannot silently hide the impact on existing allocations.
create function public.availability_cancel_ack(p_declaration uuid,p_expected_revision integer,
 p_acknowledge_deployment_conflict boolean default false) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); old public.staff_availability_declarations%rowtype;
 current_revision integer; next_revision integer; change_id uuid:=gen_random_uuid();
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_expected_revision is null then
  raise exception 'Availability cancellation denied'; end if;
 perform 1 from public.people where id=actor for update;
 if not found then raise exception 'Availability cancellation denied'; end if;
 select revision into current_revision from public.staff_availability_versions where person_id=actor for update;
 if current_revision is distinct from p_expected_revision then raise exception 'Stale availability revision'; end if;
 select * into old from public.staff_availability_declarations where id=p_declaration and person_id=actor
  and lifecycle='CURRENT' and starts_at>=transaction_timestamp() for update;
 if old.id is null then raise exception 'Availability cancellation denied'; end if;
 if old.state='AVAILABLE' and p_acknowledge_deployment_conflict is distinct from true and exists(
  select 1 from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
  join public.operational_events e on e.id=r.event_id where a.person_id=actor
   and a.status in ('ALLOCATED','ACCEPTED') and e.status not in ('COMPLETED','CANCELLED')
   and r.report_at<old.ends_at and old.starts_at<r.shift_ends_at)
  then raise exception 'Deployment conflict acknowledgement required'; end if;
 next_revision:=current_revision+1;
 perform set_config('kss.write_07a','allowed',true);
 update public.staff_availability_declarations set lifecycle='CANCELLED',updated_by_person_id=actor,
  updated_at=transaction_timestamp() where id=old.id;
 insert into public.staff_availability_history(declaration_id,person_id,change_set_id,kind,old_state,
  old_starts_at,old_ends_at,old_lifecycle,new_lifecycle,previous_revision,new_revision,actor_person_id)
  values(old.id,actor,change_id,'CANCELLED',old.state,old.starts_at,old.ends_at,'CURRENT','CANCELLED',
   current_revision,next_revision,actor);
 update public.staff_availability_versions set revision=next_revision where person_id=actor;
 return next_revision;
end $$;
revoke all on function public.availability_cancel_ack(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.availability_cancel_ack(uuid,integer,boolean) to authenticated;
drop function public.availability_cancel(uuid,integer);
