-- TASK-08A hard gate: both source adapters use this Person overlap authority under the same people-row lock.
create function private.person_allocation_overlap_08a(p_person uuid,p_start timestamptz,p_end timestamptz,
 p_exclude_event uuid default null,p_exclude_site uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select p_person is not null and p_start is not null and p_end>p_start and (
  exists(select 1 from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
   where a.person_id=p_person and a.status in ('ALLOCATED','ACCEPTED') and (p_exclude_event is null or a.id<>p_exclude_event)
    and r.report_at<p_end and p_start<r.shift_ends_at)
  or exists(select 1 from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
   where a.person_id=p_person and a.status in ('ALLOCATED','ACCEPTED') and (p_exclude_site is null or a.id<>p_exclude_site)
    and d.report_at<p_end and p_start<d.shift_ends_at))
$$;
revoke all on function private.person_allocation_overlap_08a(uuid,timestamptz,timestamptz,uuid,uuid) from public,anon,authenticated;

create function private.person_allocation_impact_08a(p_person uuid,p_start timestamptz,p_end timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
 select private.person_allocation_overlap_08a(p_person,p_start,p_end,null,null)
$$;
revoke all on function private.person_allocation_impact_08a(uuid,timestamptz,timestamptz) from public,anon,authenticated;

create function private.site_shift_candidate_08a(p_demand uuid,p_person uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d public.site_shift_demands%rowtype; s public.site_services%rowtype; role_code text;
 has_staff boolean; has_clash boolean; availability text; check_enabled boolean; passed boolean;
 result_code text; reasons text[]:=array[]::text[];
begin
 select * into d from public.site_shift_demands where id=p_demand;
 select * into s from public.site_services where id=d.service_id;
 select code into role_code from public.operational_role_definitions where id=d.role_id;
 has_staff:=exists(select 1 from public.role_assignments ra where ra.person_id=p_person and ra.role_code='SECURITY_STAFF'
  and ra.revoked_at is null and ra.effective_from<=now() and (ra.effective_until is null or ra.effective_until>now()));
 availability:=private.availability_assessment_07a(p_person,d.report_at,d.shift_ends_at);
 has_clash:=private.person_allocation_overlap_08a(p_person,d.report_at,d.shift_ends_at,null,null);
 reasons:=array_append(reasons,case availability when 'DECLARED_AVAILABLE' then 'DECLARED_AVAILABLE'
  when 'DECLARED_UNAVAILABLE' then 'DECLARED_UNAVAILABLE' when 'NOT_FULLY_COVERED' then 'AVAILABILITY_NOT_FULLY_COVERED'
  else 'AVAILABILITY_NOT_DECLARED' end);
 if not has_staff then reasons:=array_append(reasons,'ACTIVE_SECURITY_STAFF_ROLE_REQUIRED'); end if;
 if has_clash then reasons:=array_append(reasons,'RECORDED_ALLOCATION_CLASH'); end if;
 if d.id is null or d.state<>'PLANNED' or s.state not in ('ACTIVE','PAUSED') or
  d.service_date<s.effective_from or (s.effective_until is not null and d.service_date>=s.effective_until) or
  exists(select 1 from public.site_service_pauses p where p.service_id=s.id and p.starts_on<=d.service_date and d.service_date<p.ends_before)
  then reasons:=array_append(reasons,'DEMAND_NOT_ACTIVE'); end if;
 if not has_staff or has_clash or availability='DECLARED_UNAVAILABLE' or d.id is null or d.state<>'PLANNED' or
  s.state not in ('ACTIVE','PAUSED') or d.service_date<s.effective_from or
  (s.effective_until is not null and d.service_date>=s.effective_until) or
  exists(select 1 from public.site_service_pauses p where p.service_id=s.id and p.starts_on<=d.service_date and d.service_date<p.ends_before)
  then result_code:='BLOCKED';
 elsif role_code='SIA' then
  select exists(select 1 from public.operational_role_check_policies x where x.role_id=d.role_id
   and x.rule_code='SYNTHETIC_SIA_SECURITY_GUARDING' and x.development_only and x.enabled) into check_enabled;
  if not check_enabled then result_code:='BLOCKED';reasons:=array_append(reasons,'SIA_SYNTHETIC_RULE_DISABLED');
  else
   passed:=private.synthetic_sia_check_06c(p_person);
   if not passed then result_code:='BLOCKED';reasons:=array_append(reasons,'SYNTHETIC_SIA_CHECK_NOT_SATISFIED');
   else result_code:=case when availability='DECLARED_AVAILABLE' then 'SYNTHETIC_CHECKS_PASSED_WITH_WARNINGS' else 'REVIEW_REQUIRED' end;
    reasons:=array_append(reasons,'SYNTHETIC_SIA_CHECK_SATISFIED'); end if;
  end if;
 else result_code:='REVIEW_REQUIRED';reasons:=array_append(reasons,'ROLE_QUALIFICATION_RULE_NOT_CONFIGURED'); end if;
 return jsonb_build_object('result',result_code,'availability',availability,'reasons',reasons,
  'policy_version',case when role_code='SIA' then 1 else null end);
end $$;
revoke all on function private.site_shift_candidate_08a(uuid,uuid) from public,anon,authenticated;

create function public.site_shift_candidates(p_service uuid,p_demand uuid,p_search text default '',p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_search is null or length(p_search)>80 or p_search ~ '[[:cntrl:]]'
  or p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50
  or not exists(select 1 from public.site_shift_demands where id=p_demand and service_id=p_service) then
  raise exception 'Candidate search denied'; end if;
 with scoped as materialized (
  select p.id,p.display_name from public.people p where exists(select 1 from public.role_assignments ra
   where ra.person_id=p.id and ra.role_code='SECURITY_STAFF' and ra.revoked_at is null and ra.effective_from<=now()
    and (ra.effective_until is null or ra.effective_until>now()))
   and (trim(p_search)='' or position(lower(trim(p_search)) in lower(p.display_name))>0)
 ), page as (select * from scoped order by lower(display_name),id offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,
   'role','SECURITY_STAFF','check',private.site_shift_candidate_08a(p_demand,p.id))
   order by lower(p.display_name),p.id) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.site_shift_candidates(uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.site_shift_candidates(uuid,uuid,text,integer,integer) to authenticated;

create function public.site_shift_allocate(p_service uuid,p_demand uuid,p_person uuid,p_expected_revision integer,
 p_acknowledge_warnings boolean default false,p_reason text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); s public.site_services%rowtype; d public.site_shift_demands%rowtype;
 assessment jsonb; active_count integer; result uuid;
begin
 if actor is null or not private.operational_authorised() or p_person=actor then raise exception 'Allocation denied'; end if;
 select * into s from public.site_services where id=p_service for update;
 select * into d from public.site_shift_demands where id=p_demand and service_id=p_service for update;
 if s.id is null or d.id is null or d.revision is distinct from p_expected_revision or d.state<>'PLANNED'
  then raise exception 'Allocation denied'; end if;
 -- This exact people row is also locked by accepted 06C Event allocate and 07A availability writes.
 perform 1 from public.people where id=p_person for update;
 if not found then raise exception 'Allocation denied'; end if;
 select count(*) into active_count from public.site_shift_allocations where demand_id=p_demand and status in ('ALLOCATED','ACCEPTED');
 if active_count>=d.required_quantity then raise exception 'Requirement capacity reached'; end if;
 assessment:=private.site_shift_candidate_08a(p_demand,p_person);
 if assessment->>'result'='BLOCKED' then raise exception 'Candidate blocked'; end if;
 if assessment->>'result'='REVIEW_REQUIRED' and
  (p_acknowledge_warnings is distinct from true or p_reason is null or length(trim(p_reason)) not between 3 and 300
   or p_reason ~ '[[:cntrl:]]') then raise exception 'Warnings require acknowledgement and reason'; end if;
 perform set_config('kss.write_08a','allowed',true);
 insert into public.site_shift_allocations(demand_id,person_id,demand_revision_at_allocation,allocated_by_person_id)
 values(p_demand,p_person,d.revision,actor) returning id into result;
 insert into public.site_shift_allocation_events(allocation_id,demand_id,person_id,kind,new_status,new_revision,
  actor_person_id,reason) values(result,p_demand,p_person,'ALLOCATED','ALLOCATED',1,actor,
  case when assessment->>'result'='REVIEW_REQUIRED' then trim(p_reason) else null end);
 return result;
end $$;
revoke all on function public.site_shift_allocate(uuid,uuid,uuid,integer,boolean,text) from public,anon,authenticated;
grant execute on function public.site_shift_allocate(uuid,uuid,uuid,integer,boolean,text) to authenticated;

create function public.site_shift_cancel_allocation(p_service uuid,p_demand uuid,p_allocation uuid,p_expected_revision integer,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); old public.site_shift_allocations%rowtype;
begin
 if actor is null or not private.operational_authorised() or p_reason is null or length(trim(p_reason)) not between 3 and 300
  or p_reason ~ '[[:cntrl:]]' or not exists(select 1 from public.site_shift_demands where id=p_demand and service_id=p_service)
  then raise exception 'Allocation cancellation denied'; end if;
 select * into old from public.site_shift_allocations where id=p_allocation and demand_id=p_demand for update;
 if old.id is null or old.revision is distinct from p_expected_revision or old.status not in ('ALLOCATED','ACCEPTED')
  then raise exception 'Allocation cancellation denied'; end if;
 perform set_config('kss.write_08a','allowed',true);
 update public.site_shift_allocations set status='CANCELLED',cancelled_at=transaction_timestamp(),
  updated_at=transaction_timestamp(),revision=old.revision+1 where id=old.id;
 insert into public.site_shift_allocation_events(allocation_id,demand_id,person_id,kind,old_status,new_status,
  old_revision,new_revision,actor_person_id,reason)
 values(old.id,p_demand,old.person_id,'CANCELLED',old.status,'CANCELLED',old.revision,old.revision+1,actor,trim(p_reason));
 return old.revision+1;
end $$;
revoke all on function public.site_shift_cancel_allocation(uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.site_shift_cancel_allocation(uuid,uuid,uuid,integer,text) to authenticated;

create function public.site_shift_respond(p_allocation uuid,p_expected_revision integer,p_response text,
 p_reason_code text default null,p_note text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); old public.site_shift_allocations%rowtype; d public.site_shift_demands%rowtype;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_response not in ('ACCEPTED','DECLINED')
  or (p_response='DECLINED' and p_reason_code not in ('CANNOT_ATTEND','TIMING_CONFLICT','OTHER'))
  or p_note is not null and (length(p_note)>300 or p_note ~ '[[:cntrl:]]') then raise exception 'Deployment response denied'; end if;
 select * into old from public.site_shift_allocations where id=p_allocation and person_id=actor for update;
 select * into d from public.site_shift_demands where id=old.demand_id;
 if old.id is null or old.status<>'ALLOCATED' or old.revision is distinct from p_expected_revision
  or d.state<>'PLANNED' then raise exception 'Deployment response denied'; end if;
 perform set_config('kss.write_08a','allowed',true);
 update public.site_shift_allocations set status=p_response,responded_at=transaction_timestamp(),
  updated_at=transaction_timestamp(),revision=old.revision+1 where id=old.id;
 insert into public.site_shift_allocation_events(allocation_id,demand_id,person_id,kind,old_status,new_status,
  old_revision,new_revision,actor_person_id,reason_code,reason)
 values(old.id,old.demand_id,actor,p_response,'ALLOCATED',p_response,old.revision,old.revision+1,actor,
  case when p_response='DECLINED' then p_reason_code else null end,nullif(trim(p_note),''));
 return old.revision+1;
end $$;
revoke all on function public.site_shift_respond(uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.site_shift_respond(uuid,integer,text,text,text) to authenticated;

-- Keep the accepted 06C candidate policy, switching only its overlap source to the shared authority.
create or replace function private.candidate_check_06c(p_requirement uuid,p_person uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare req public.event_staffing_requirements%rowtype; ev public.operational_events%rowtype;
 role_code text; has_staff boolean; has_clash boolean; check_enabled boolean; passed boolean;
 result_code text; availability text; reasons text[]:=array[]::text[];
begin
 select * into req from public.event_staffing_requirements where id=p_requirement;
 select * into ev from public.operational_events where id=req.event_id;
 select code into role_code from public.operational_role_definitions where id=req.role_id;
 has_staff:=exists(select 1 from public.people p join public.role_assignments ra on ra.person_id=p.id
   where p.id=p_person and ra.role_code='SECURITY_STAFF' and ra.revoked_at is null
   and ra.effective_from<=now() and (ra.effective_until is null or ra.effective_until>now()));
 availability:=private.availability_assessment_07a(p_person,req.report_at,req.shift_ends_at);
 reasons:=array_append(reasons,case availability when 'DECLARED_AVAILABLE' then 'DECLARED_AVAILABLE'
  when 'DECLARED_UNAVAILABLE' then 'DECLARED_UNAVAILABLE' when 'NOT_FULLY_COVERED' then 'AVAILABILITY_NOT_FULLY_COVERED'
  else 'AVAILABILITY_NOT_DECLARED' end);
 has_clash:=private.person_allocation_overlap_08a(p_person,req.report_at,req.shift_ends_at,null,null);
 if not has_staff then reasons:=array_append(reasons,'ACTIVE_SECURITY_STAFF_ROLE_REQUIRED'); end if;
 if has_clash then reasons:=array_append(reasons,'RECORDED_ALLOCATION_CLASH'); end if;
 if req.id is null or req.state<>'PLANNED' or ev.status not in ('PLANNING','CONFIRMED','LIVE') then
   reasons:=array_append(reasons,'REQUIREMENT_NOT_ACTIVE'); end if;
 if not has_staff or has_clash or availability='DECLARED_UNAVAILABLE' or req.id is null or req.state<>'PLANNED' or ev.status not in ('PLANNING','CONFIRMED','LIVE') then
   result_code:='BLOCKED';
 elsif role_code='SIA' then
   select exists(select 1 from public.operational_role_check_policies p where p.role_id=req.role_id
     and p.rule_code='SYNTHETIC_SIA_SECURITY_GUARDING' and p.development_only and p.enabled)
     into check_enabled;
   if not check_enabled then result_code:='BLOCKED';reasons:=array_append(reasons,'SIA_SYNTHETIC_RULE_DISABLED');
   else
     passed:=private.synthetic_sia_check_06c(p_person);
     if passed then result_code:=case when availability='DECLARED_AVAILABLE' then 'SYNTHETIC_CHECKS_PASSED_WITH_WARNINGS' else 'REVIEW_REQUIRED' end;
       reasons:=array_append(reasons,'SYNTHETIC_SIA_CHECK_SATISFIED');
     else result_code:='BLOCKED';reasons:=array_append(reasons,'SYNTHETIC_SIA_CHECK_NOT_SATISFIED'); end if;
   end if;
 else
   result_code:='REVIEW_REQUIRED';reasons:=array_append(reasons,'ROLE_QUALIFICATION_RULE_NOT_CONFIGURED');
 end if;
 return jsonb_build_object('result',result_code,'availability',availability,'reasons',reasons,'policy_version',case when role_code='SIA' then 1 else null end);
end $$;

-- Availability changes use the same cross-source Person impact authority.
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
 select case when private.person_allocation_impact_08a(actor,p_starts,p_ends) then 1 else 0 end into conflict_count;
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
create or replace function public.availability_cancel_ack(p_declaration uuid,p_expected_revision integer,
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
 if old.state='AVAILABLE' and p_acknowledge_deployment_conflict is distinct from true and private.person_allocation_impact_08a(actor,old.starts_at,old.ends_at)
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

create or replace function public.availability_preview(p_starts timestamptz,p_ends timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_starts is null or p_ends is null or
  p_ends<=p_starts then raise exception 'Availability preview denied'; end if;
 select jsonb_build_object(
  'revision',coalesce((select revision from public.staff_availability_versions where person_id=actor),0),
  'replaced',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'state',d.state,'starts_at',d.starts_at,'ends_at',d.ends_at)
   order by d.starts_at,d.id) from public.staff_availability_declarations d where d.person_id=actor and d.lifecycle='CURRENT'
   and d.starts_at<p_ends and p_starts<d.ends_at),'[]'::jsonb),
  'deployments',coalesce((select jsonb_agg(to_jsonb(w) order by w.report_at,w.id) from (
   select a.id,e.name as event_name,'EVENT'::text as source,r.report_at,r.shift_ends_at,a.status
   from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
    join public.operational_events e on e.id=r.event_id
   where a.person_id=actor and a.status in ('ALLOCATED','ACCEPTED') and e.status not in ('COMPLETED','CANCELLED')
    and r.report_at<p_ends and p_starts<r.shift_ends_at
   union all
   select a.id,s.name as event_name,'SITE_SHIFT'::text as source,d.report_at,d.shift_ends_at,a.status
   from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
    join public.site_services s on s.id=d.service_id
   where a.person_id=actor and a.status in ('ALLOCATED','ACCEPTED') and d.state='PLANNED'
    and d.report_at<p_ends and p_starts<d.shift_ends_at
  ) w),'[]'::jsonb)) into result;
 return result;
end $$;
