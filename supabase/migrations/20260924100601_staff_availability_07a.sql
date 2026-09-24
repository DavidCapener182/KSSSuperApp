-- TASK-07A: Staff-owned declarations. No manager impersonation, attendance, or pay.
create table public.staff_availability_versions (
 person_id uuid primary key references public.people(id),
 revision integer not null default 0 check (revision>=0)
);
create table public.staff_availability_declarations (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.people(id),
 state text not null check (state in ('AVAILABLE','UNAVAILABLE')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 lifecycle text not null default 'CURRENT' check (lifecycle in ('CURRENT','SUPERSEDED','CANCELLED')),
 note text check (note is null or (length(note)<=300 and note !~ '[[:cntrl:]]')),
 origin_declaration_id uuid references public.staff_availability_declarations(id),
 change_set_id uuid not null,
 created_by_person_id uuid not null references public.people(id),
 updated_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 updated_at timestamptz not null default transaction_timestamp(),
 check (ends_at>starts_at)
);
create index staff_availability_current_idx on public.staff_availability_declarations(person_id,starts_at,ends_at)
 where lifecycle='CURRENT';
create index staff_availability_person_history_idx on public.staff_availability_declarations(person_id,created_at desc,id desc);
create table public.staff_availability_history (
 id uuid primary key default gen_random_uuid(),
 declaration_id uuid not null references public.staff_availability_declarations(id),
 person_id uuid not null references public.people(id),
 change_set_id uuid not null,
 kind text not null check (kind in ('CREATED','REPLACED','FRAGMENT_CREATED','CANCELLED')),
 old_state text check (old_state is null or old_state in ('AVAILABLE','UNAVAILABLE')),
 new_state text check (new_state is null or new_state in ('AVAILABLE','UNAVAILABLE')),
 old_starts_at timestamptz,
 old_ends_at timestamptz,
 new_starts_at timestamptz,
 new_ends_at timestamptz,
 old_lifecycle text,
 new_lifecycle text,
 previous_revision integer not null,
 new_revision integer not null check (new_revision=previous_revision+1),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default transaction_timestamp()
);
create index staff_availability_history_person_idx on public.staff_availability_history(person_id,occurred_at desc,id desc);
alter table public.staff_availability_versions enable row level security;
alter table public.staff_availability_declarations enable row level security;
alter table public.staff_availability_history enable row level security;
revoke all on public.staff_availability_versions,public.staff_availability_declarations,public.staff_availability_history from public,anon,authenticated;

create function private.guard_availability_07a() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_07a',true) is distinct from 'allowed' then raise exception 'Availability direct write denied'; end if;
 if tg_op='DELETE' then raise exception 'Availability history cannot be deleted'; end if;
 if tg_op='UPDATE' then
  if tg_table_name='staff_availability_history' then raise exception 'Availability history is immutable'; end if;
  if tg_table_name='staff_availability_declarations' and (
   new.id is distinct from old.id or new.person_id is distinct from old.person_id or
   new.state is distinct from old.state or new.starts_at is distinct from old.starts_at or
   new.ends_at is distinct from old.ends_at or new.note is distinct from old.note or
   new.origin_declaration_id is distinct from old.origin_declaration_id or
   new.change_set_id is distinct from old.change_set_id or new.created_by_person_id is distinct from old.created_by_person_id or
   new.created_at is distinct from old.created_at or old.lifecycle<>'CURRENT' or new.lifecycle not in ('SUPERSEDED','CANCELLED'))
   then raise exception 'Availability declaration is immutable'; end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_availability_07a() from public,anon,authenticated;
create trigger guard_staff_availability_versions before insert or update or delete on public.staff_availability_versions
 for each row execute function private.guard_availability_07a();
create trigger guard_staff_availability_declarations before insert or update or delete on public.staff_availability_declarations
 for each row execute function private.guard_availability_07a();
create trigger guard_staff_availability_history before insert or update or delete on public.staff_availability_history
 for each row execute function private.guard_availability_07a();

-- The Person row serialises this self-write with deployment_allocate's existing Person lock.
create function public.availability_save(p_state text,p_starts timestamptz,p_ends timestamptz,
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
  ((p_ends at time zone 'Europe/London')::date-(p_starts at time zone 'Europe/London')::date)>31 or
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
revoke all on function public.availability_save(text,timestamptz,timestamptz,text,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.availability_save(text,timestamptz,timestamptz,text,integer,boolean,boolean) to authenticated;

create function public.availability_cancel(p_declaration uuid,p_expected_revision integer) returns integer
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
revoke all on function public.availability_cancel(uuid,integer) from public,anon,authenticated;
grant execute on function public.availability_cancel(uuid,integer) to authenticated;

-- Exact-duty assessment only; this helper is never exposed as a general Staff directory endpoint.
create function private.availability_assessment_07a(p_person uuid,p_start timestamptz,p_end timestamptz)
returns text language plpgsql stable security definer set search_path='' as $$
declare covered boolean; touched boolean;
begin
 if p_person is null or p_start is null or p_end is null or p_end<=p_start then return 'NOT_DECLARED'; end if;
 if exists(select 1 from public.staff_availability_declarations d where d.person_id=p_person
   and d.lifecycle='CURRENT' and d.state='UNAVAILABLE' and d.starts_at<p_end and p_start<d.ends_at)
  then return 'DECLARED_UNAVAILABLE'; end if;
 select coalesce(range_agg(tstzrange(greatest(d.starts_at,p_start),least(d.ends_at,p_end),'[)'))
   @> tstzrange(p_start,p_end,'[)'),false),count(*)>0 into covered,touched
 from public.staff_availability_declarations d where d.person_id=p_person and d.lifecycle='CURRENT'
  and d.state='AVAILABLE' and d.starts_at<p_end and p_start<d.ends_at;
 if covered then return 'DECLARED_AVAILABLE'; end if;
 if touched then return 'NOT_FULLY_COVERED'; end if;
 return 'NOT_DECLARED';
end $$;
revoke all on function private.availability_assessment_07a(uuid,timestamptz,timestamptz) from public,anon,authenticated;

create function private.availability_allocation_indicator_07a(p_person uuid,p_start timestamptz,p_end timestamptz)
returns text language plpgsql stable security definer set search_path='' as $$
declare assessment text;
begin
 assessment:=private.availability_assessment_07a(p_person,p_start,p_end);
 if assessment='DECLARED_UNAVAILABLE' then return 'UNAVAILABLE_CONFLICT'; end if;
 if assessment<>'DECLARED_AVAILABLE' and exists(
  select 1 from public.staff_availability_declarations d where d.person_id=p_person and d.state='AVAILABLE'
   and d.lifecycle<>'CURRENT' and d.starts_at<=p_start and d.ends_at>=p_end)
  then return 'COVERAGE_NO_LONGER_DECLARED'; end if;
 return null;
end $$;
revoke all on function private.availability_allocation_indicator_07a(uuid,timestamptz,timestamptz) from public,anon,authenticated;

create function public.my_availability(p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or
  p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50
  then raise exception 'Availability self read denied'; end if;
 with scoped as materialized (
  select d.id,d.state,d.starts_at,d.ends_at,d.lifecycle,d.note,d.origin_declaration_id,d.change_set_id,
   d.created_at,d.updated_at from public.staff_availability_declarations d where d.person_id=actor
 ), page as (select * from scoped order by case when lifecycle='CURRENT' and ends_at>now() then 0 else 1 end,
  starts_at asc,id offset p_offset limit p_limit)
 select jsonb_build_object('revision',coalesce((select v.revision from public.staff_availability_versions v where v.person_id=actor),0),
  'total',(select count(*) from scoped),
  'items',coalesce((select jsonb_agg(to_jsonb(p) order by case when p.lifecycle='CURRENT' and p.ends_at>now() then 0 else 1 end,
    p.starts_at,p.id) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.my_availability(integer,integer) from public,anon,authenticated;
grant execute on function public.my_availability(integer,integer) to authenticated;

create function public.my_availability_history(p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or
  p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50
  then raise exception 'Availability history denied'; end if;
 with scoped as materialized (select id,kind,old_state,new_state,old_starts_at,old_ends_at,
  new_starts_at,new_ends_at,old_lifecycle,new_lifecycle,change_set_id,previous_revision,new_revision,
  actor_person_id,occurred_at from public.staff_availability_history where person_id=actor),
 page as (select * from scoped order by occurred_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),'items',coalesce((select jsonb_agg(to_jsonb(p)
  order by p.occurred_at desc,p.id desc) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.my_availability_history(integer,integer) from public,anon,authenticated;
grant execute on function public.my_availability_history(integer,integer) to authenticated;

create function public.availability_preview(p_starts timestamptz,p_ends timestamptz) returns jsonb
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
  'deployments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'event_name',e.name,
   'report_at',r.report_at,'shift_ends_at',r.shift_ends_at,'status',a.status) order by r.report_at,a.id)
   from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
   join public.operational_events e on e.id=r.event_id
   where a.person_id=actor and a.status in ('ALLOCATED','ACCEPTED') and e.status not in ('COMPLETED','CANCELLED')
    and r.report_at<p_ends and p_starts<r.shift_ends_at),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.availability_preview(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.availability_preview(timestamptz,timestamptz) to authenticated;

-- Extend the existing 06C evaluator; all other role/SIA/clash branches remain intact.
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
 has_clash:=exists(select 1 from public.event_staff_allocations a
   join public.event_staffing_requirements other on other.id=a.requirement_id
   where a.person_id=p_person and a.status in ('ALLOCATED','ACCEPTED')
   and req.report_at<other.shift_ends_at and other.report_at<req.shift_ends_at);
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

-- Own deployment cards show a derived conflict without changing allocation state.
-- Current Staff work precedes historical test/allocation rows on every page.
create or replace function public.my_deployments(p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_offset is null or p_offset<0 or p_offset>10000
   or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Deployment self read denied'; end if;
 with scoped as materialized (
  select a.id,a.status,a.revision,a.allocated_at,r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,
   r.area_label,o.display_name as role_name,e.name as event_name,e.status as event_status,s.name as site_name,
   s.reporting_point,
   case when a.status in ('ALLOCATED','ACCEPTED') then
    private.availability_allocation_indicator_07a(a.person_id,r.report_at,r.shift_ends_at)
    else null end as availability_conflict,
   case when a.status in ('ALLOCATED','ACCEPTED') and e.status not in ('COMPLETED','CANCELLED') then 0 else 1 end as history_rank
  from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
  join public.operational_role_definitions o on o.id=r.role_id
  join public.operational_events e on e.id=r.event_id join public.sites s on s.id=e.site_id
  where a.person_id=actor
 ), page as (select * from scoped order by history_rank,report_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),'items',coalesce((select jsonb_agg(to_jsonb(p)-'history_rank'
  order by p.history_rank,p.report_at desc,p.id desc) from page p),'[]'::jsonb)) into result;
 return result;
end $$;

-- Manager's exact requirement projection contains only a safe conflict code.
create or replace function public.deployment_requirement(p_event uuid,p_requirement uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or not exists(select 1 from public.event_staffing_requirements
   where id=p_requirement and event_id=p_event) then raise exception 'Deployment read denied'; end if;
 select jsonb_build_object('required',r.required_quantity,
  'allocated',count(a.id) filter(where a.status in ('ALLOCATED','ACCEPTED')),
  'accepted',count(a.id) filter(where a.status='ACCEPTED'),
  'remaining',r.required_quantity-count(a.id) filter(where a.status in ('ALLOCATED','ACCEPTED')),
  'allocations',coalesce(jsonb_agg(jsonb_build_object('id',a.id,'person_id',a.person_id,'person_name',p.display_name,
   'status',a.status,'revision',a.revision,'allocated_at',a.allocated_at,
   'availability_conflict',case when a.status in ('ALLOCATED','ACCEPTED') then
    private.availability_allocation_indicator_07a(a.person_id,r.report_at,r.shift_ends_at) else null end) order by a.allocated_at,a.id)
   filter(where a.id is not null),'[]'::jsonb)) into result
 from public.event_staffing_requirements r left join public.event_staff_allocations a on a.requirement_id=r.id
 left join public.people p on p.id=a.person_id where r.id=p_requirement group by r.id;
 return result;
end $$;
