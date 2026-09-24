-- The 31-day safeguard follows the London wall calendar, including DST days.
create or replace function public.availability_save(p_state text,p_starts timestamptz,p_ends timestamptz,
 p_note text,p_expected_revision integer,p_confirm_replace boolean default false,
 p_acknowledge_deployment_conflict boolean default false) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); old public.staff_availability_declarations%rowtype;
 current_revision integer; next_revision integer; change_id uuid:=gen_random_uuid(); inserted_id uuid;
 conflict_count integer; overlap_count integer;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or
  p_state not in ('AVAILABLE','UNAVAILABLE') or p_starts is null or p_ends is null or
  p_starts<transaction_timestamp() or p_ends<=p_starts or
  p_ends>transaction_timestamp()+interval '12 months' or
  p_ends>(((p_starts at time zone 'Europe/London')+interval '31 days') at time zone 'Europe/London') or
  p_note is not null and (length(p_note)>300 or p_note ~ '[[:cntrl:]]') or
  p_expected_revision is null or p_expected_revision<0 then raise exception 'Availability save denied'; end if;
 perform 1 from public.people where id=actor for update;
 if not found then raise exception 'Availability save denied'; end if;
 perform set_config('kss.write_07a','allowed',true);
 insert into public.staff_availability_versions(person_id) values(actor) on conflict do nothing;
 select revision into current_revision from public.staff_availability_versions where person_id=actor for update;
 if current_revision is distinct from p_expected_revision then raise exception 'Stale availability revision'; end if;
 select count(*) into overlap_count from public.staff_availability_declarations d where d.person_id=actor
  and d.lifecycle='CURRENT' and d.starts_at<p_ends and p_starts<d.ends_at;
 if overlap_count>0 and p_confirm_replace is distinct from true then raise exception 'Availability replacement confirmation required'; end if;
 select count(*) into conflict_count from public.event_staff_allocations a
  join public.event_staffing_requirements r on r.id=a.requirement_id
  join public.operational_events e on e.id=r.event_id
  where a.person_id=actor and a.status in ('ALLOCATED','ACCEPTED')
   and e.status not in ('COMPLETED','CANCELLED') and r.report_at<p_ends and p_starts<r.shift_ends_at;
 if conflict_count>0 and (p_state='UNAVAILABLE' or overlap_count>0) and
  p_acknowledge_deployment_conflict is distinct from true then
  raise exception 'Deployment conflict acknowledgement required'; end if;
 next_revision:=current_revision+1;
 for old in select * from public.staff_availability_declarations d where d.person_id=actor and d.lifecycle='CURRENT'
  and d.starts_at<p_ends and p_starts<d.ends_at order by d.starts_at,d.id for update loop
  update public.staff_availability_declarations set lifecycle='SUPERSEDED',updated_by_person_id=actor,
   updated_at=transaction_timestamp() where id=old.id;
  insert into public.staff_availability_history(declaration_id,person_id,change_set_id,kind,old_state,
   old_starts_at,old_ends_at,old_lifecycle,new_lifecycle,previous_revision,new_revision,actor_person_id)
   values(old.id,actor,change_id,'REPLACED',old.state,old.starts_at,old.ends_at,'CURRENT','SUPERSEDED',
    current_revision,next_revision,actor);
  if old.starts_at<p_starts then
   insert into public.staff_availability_declarations(person_id,state,starts_at,ends_at,note,origin_declaration_id,
    change_set_id,created_by_person_id,updated_by_person_id)
    values(actor,old.state,old.starts_at,p_starts,old.note,coalesce(old.origin_declaration_id,old.id),
     change_id,actor,actor) returning id into inserted_id;
   insert into public.staff_availability_history(declaration_id,person_id,change_set_id,kind,new_state,
    new_starts_at,new_ends_at,new_lifecycle,previous_revision,new_revision,actor_person_id)
    values(inserted_id,actor,change_id,'FRAGMENT_CREATED',old.state,old.starts_at,p_starts,'CURRENT',
     current_revision,next_revision,actor);
  end if;
  if old.ends_at>p_ends then
   insert into public.staff_availability_declarations(person_id,state,starts_at,ends_at,note,origin_declaration_id,
    change_set_id,created_by_person_id,updated_by_person_id)
    values(actor,old.state,p_ends,old.ends_at,old.note,coalesce(old.origin_declaration_id,old.id),
     change_id,actor,actor) returning id into inserted_id;
   insert into public.staff_availability_history(declaration_id,person_id,change_set_id,kind,new_state,
    new_starts_at,new_ends_at,new_lifecycle,previous_revision,new_revision,actor_person_id)
    values(inserted_id,actor,change_id,'FRAGMENT_CREATED',old.state,p_ends,old.ends_at,'CURRENT',
     current_revision,next_revision,actor);
  end if;
 end loop;
 insert into public.staff_availability_declarations(person_id,state,starts_at,ends_at,note,change_set_id,
  created_by_person_id,updated_by_person_id) values(actor,p_state,p_starts,p_ends,nullif(trim(p_note),''),
  change_id,actor,actor) returning id into inserted_id;
 insert into public.staff_availability_history(declaration_id,person_id,change_set_id,kind,new_state,
  new_starts_at,new_ends_at,new_lifecycle,previous_revision,new_revision,actor_person_id)
  values(inserted_id,actor,change_id,'CREATED',p_state,p_starts,p_ends,'CURRENT',current_revision,next_revision,actor);
 update public.staff_availability_versions set revision=next_revision where person_id=actor;
 return next_revision;
end $$;
