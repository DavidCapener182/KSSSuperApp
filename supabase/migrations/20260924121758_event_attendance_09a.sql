-- TASK-09A: factual Event allocation attendance only.
-- Static Site shift attendance remains disabled until 08A delivery and its
-- shared cross-source Person guard have been independently verified.

create table public.attendance_cases (
  id uuid primary key default gen_random_uuid(),
  event_allocation_id uuid not null unique references public.event_staff_allocations(id),
  person_id uuid not null references public.people(id),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (id, event_allocation_id, person_id)
);
create index attendance_case_person_idx on public.attendance_cases(person_id, event_allocation_id);

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  attendance_case_id uuid not null,
  event_allocation_id uuid not null,
  person_id uuid not null,
  revision integer not null check (revision > 0),
  event_type text not null check (event_type in (
    'CHECK_IN','CHECK_OUT','NO_SHOW_RECORDED','EXCUSED_ABSENCE_RECORDED',
    'CHECK_IN_NOT_POSSIBLE','REVIEW_REQUIRED','CORRECTION')),
  actual_at timestamptz,
  corrected_actual_at timestamptz,
  recorded_at timestamptz not null default clock_timestamp(),
  actor_person_id uuid not null references public.people(id),
  actor_mode text not null check (actor_mode in ('STAFF_SELF','MANAGER_OBSERVED','MANAGER_DECISION')),
  method text not null check (method in ('AUTHENTICATED_ONLINE','MANAGER_OBSERVED','ALLOCATION_CANCELLATION')),
  reason_code text check (reason_code is null or reason_code in (
    'NO_SHOW','EXCUSED','CHECK_IN_NOT_POSSIBLE','OTHER','ALLOCATION_CANCELLED_AFTER_CHECK_IN')),
  reason text check (reason is null or (length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]')),
  idempotency_key uuid,
  corrects_event_id uuid,
  correction_code text check (correction_code is null or correction_code in (
    'CORRECT_TIMESTAMP','RESOLVE_NO_SHOW_FOR_CHECK_IN','RESOLVE_CANCELLED_ALLOCATION_REVIEW')),
  resolution_event_id uuid,
  unique (attendance_case_id, revision),
  unique (id, attendance_case_id),
  unique (attendance_case_id, actor_person_id, idempotency_key),
  foreign key (attendance_case_id, event_allocation_id, person_id)
    references public.attendance_cases(id, event_allocation_id, person_id),
  foreign key (corrects_event_id, attendance_case_id)
    references public.attendance_events(id, attendance_case_id),
  foreign key (resolution_event_id, attendance_case_id)
    references public.attendance_events(id, attendance_case_id),
  check (
    (event_type in ('CHECK_IN','CHECK_OUT') and actual_at is not null and corrected_actual_at is null
      and correction_code is null and corrects_event_id is null)
    or (event_type='CORRECTION' and actual_at is null and corrects_event_id is not null
      and correction_code is not null and reason is not null
      and ((correction_code='CORRECT_TIMESTAMP' and corrected_actual_at is not null)
        or (correction_code<>'CORRECT_TIMESTAMP' and corrected_actual_at is null)))
    or (event_type not in ('CHECK_IN','CHECK_OUT','CORRECTION') and actual_at is null
      and corrected_actual_at is null and correction_code is null and corrects_event_id is null)
  ),
  check (event_type='CHECK_IN' or resolution_event_id is null)
);
create index attendance_event_allocation_revision_idx
  on public.attendance_events(event_allocation_id, revision desc);
create index attendance_event_case_type_idx
  on public.attendance_events(attendance_case_id, event_type, revision desc);

alter table public.attendance_cases enable row level security;
alter table public.attendance_events enable row level security;
revoke all on public.attendance_cases, public.attendance_events from public, anon, authenticated;

create function private.guard_attendance_09a() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'Attendance history cannot be deleted'; end if;
  if current_setting('kss.attendance_write_09a',true) is distinct from 'allowed' then
    raise exception 'Attendance direct write denied';
  end if;
  if tg_table_name='attendance_events' then
    if tg_op<>'INSERT' then raise exception 'Attendance events are immutable'; end if;
    if new.actor_person_id is distinct from private.current_person_id() then
      raise exception 'Attendance actor mismatch';
    end if;
    if new.event_type='CHECK_IN' and exists (
      select 1 from public.attendance_events n
      where n.attendance_case_id=new.attendance_case_id and n.event_type='NO_SHOW_RECORDED'
        and not exists (select 1 from public.attendance_events c where c.corrects_event_id=n.id
          and c.attendance_case_id=n.attendance_case_id
          and c.correction_code='RESOLVE_NO_SHOW_FOR_CHECK_IN')
    ) and new.resolution_event_id is null then
      raise exception 'Resolve recorded no-show before check-in';
    end if;
    return new;
  end if;
  if tg_table_name='attendance_cases' then
    if tg_op='INSERT' then
      if not exists(select 1 from public.event_staff_allocations a
        where a.id=new.event_allocation_id and a.person_id=new.person_id) then
        raise exception 'Attendance allocation binding denied';
      end if;
    elsif tg_op='UPDATE' then
      if new.id is distinct from old.id or new.event_allocation_id is distinct from old.event_allocation_id
        or new.person_id is distinct from old.person_id or new.revision<>old.revision+1
        or new.created_at is distinct from old.created_at or new.updated_at<old.updated_at then
        raise exception 'Attendance case identity/history cannot be changed';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_attendance_09a() from public, anon, authenticated;
create trigger guard_attendance_cases_09a before insert or update or delete on public.attendance_cases
  for each row execute function private.guard_attendance_09a();
create trigger guard_attendance_events_09a before insert or update or delete on public.attendance_events
  for each row execute function private.guard_attendance_09a();

create function private.attendance_ensure_case_09a(p_allocation uuid, p_person uuid)
returns public.attendance_cases language plpgsql security definer set search_path='' as $$
declare c public.attendance_cases%rowtype;
begin
  perform set_config('kss.attendance_write_09a','allowed',true);
  insert into public.attendance_cases(event_allocation_id,person_id)
  select a.id,a.person_id from public.event_staff_allocations a
  where a.id=p_allocation and a.person_id=p_person
  on conflict(event_allocation_id) do nothing;
  select * into c from public.attendance_cases c0
    where c0.event_allocation_id=p_allocation and c0.person_id=p_person for update;
  if c.id is null then raise exception 'Attendance allocation denied'; end if;
  return c;
end $$;
revoke all on function private.attendance_ensure_case_09a(uuid,uuid) from public, anon, authenticated;

create function private.attendance_append_09a(
  p_case uuid, p_allocation uuid, p_person uuid, p_type text, p_actual_at timestamptz,
  p_actor_mode text, p_method text, p_reason_code text, p_reason text, p_key uuid,
  p_corrects_event uuid default null, p_correction_code text default null,
  p_corrected_actual_at timestamptz default null, p_resolution_event uuid default null
) returns public.attendance_events language plpgsql security definer set search_path='' as $$
declare c public.attendance_cases%rowtype; result public.attendance_events%rowtype; actor uuid:=private.current_person_id();
begin
  if actor is null or current_setting('kss.attendance_write_09a',true) is distinct from 'allowed' then
    raise exception 'Attendance write denied';
  end if;
  select * into c from public.attendance_cases where id=p_case and event_allocation_id=p_allocation
    and person_id=p_person for update;
  if c.id is null then raise exception 'Attendance write denied'; end if;
  update public.attendance_cases set revision=c.revision+1,updated_at=clock_timestamp() where id=c.id;
  insert into public.attendance_events(attendance_case_id,event_allocation_id,person_id,revision,event_type,
    actual_at,actor_person_id,actor_mode,method,reason_code,reason,idempotency_key,corrects_event_id,
    correction_code,corrected_actual_at,resolution_event_id)
  values(c.id,p_allocation,p_person,c.revision+1,p_type,p_actual_at,actor,p_actor_mode,p_method,
    p_reason_code,nullif(trim(p_reason),''),p_key,p_corrects_event,p_correction_code,p_corrected_actual_at,p_resolution_event)
  returning * into result;
  return result;
end $$;
revoke all on function private.attendance_append_09a(uuid,uuid,uuid,text,timestamptz,text,text,text,text,uuid,uuid,text,timestamptz,uuid)
  from public, anon, authenticated;

create function private.attendance_summary_09a(p_allocation uuid, p_person uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with c as (
    select id,revision from public.attendance_cases
    where event_allocation_id=p_allocation and person_id=p_person
  ), facts as (
    select e.*,
      case when e.event_type in ('CHECK_IN','CHECK_OUT') then coalesce(
        (select c0.corrected_actual_at from public.attendance_events c0
         where c0.corrects_event_id=e.id and c0.attendance_case_id=e.attendance_case_id
           and c0.correction_code='CORRECT_TIMESTAMP'),e.actual_at)
      else null end as effective_actual_at
    from public.attendance_events e join c on c.id=e.attendance_case_id
  ), resolved_no_show as (
    select f.id from facts f where f.event_type='NO_SHOW_RECORDED'
      and exists(select 1 from facts c0 where c0.corrects_event_id=f.id
        and c0.correction_code='RESOLVE_NO_SHOW_FOR_CHECK_IN')
  ), current_facts as (
    select f.* from facts f where f.event_type<>'CORRECTION'
      and not (f.event_type='NO_SHOW_RECORDED' and f.id in (select id from resolved_no_show))
  ), chosen as (
    select
      (select f.effective_actual_at from facts f where f.event_type='CHECK_IN' order by f.revision limit 1) as checked_in_at,
      (select f.effective_actual_at from facts f where f.event_type='CHECK_OUT' order by f.revision limit 1) as checked_out_at,
      (select f.id from current_facts f where f.event_type='NO_SHOW_RECORDED' order by f.revision desc limit 1) as no_show_id,
      (select f.id from current_facts f where f.event_type='EXCUSED_ABSENCE_RECORDED' order by f.revision desc limit 1) as excused_id,
      (select f.id from current_facts f where f.event_type='CHECK_IN_NOT_POSSIBLE' order by f.revision desc limit 1) as impossible_id,
      (select f.id from current_facts f where f.event_type='REVIEW_REQUIRED'
         and not exists(select 1 from facts c0 where c0.corrects_event_id=f.id
           and c0.correction_code='RESOLVE_CANCELLED_ALLOCATION_REVIEW')
       order by f.revision desc limit 1) as review_id
  )
  select jsonb_build_object(
    'revision',coalesce((select revision from c),0),
    'state',case when chosen.checked_out_at is not null then 'CHECKED_OUT'
      when chosen.checked_in_at is not null then 'CHECKED_IN'
      when chosen.no_show_id is not null then 'NO_SHOW_RECORDED'
      when chosen.excused_id is not null then 'EXCUSED_ABSENCE_RECORDED'
      when chosen.review_id is not null then 'REVIEW_REQUIRED'
      when chosen.impossible_id is not null then 'CHECK_IN_NOT_POSSIBLE'
      else 'NOT_YET_CHECKED_IN' end,
    'check_in_at',chosen.checked_in_at,'check_out_at',chosen.checked_out_at,
    'no_show_recorded',chosen.no_show_id is not null,'review_required',chosen.review_id is not null,
    'exception_recorded',chosen.no_show_id is not null or chosen.excused_id is not null
      or chosen.impossible_id is not null or chosen.review_id is not null,
    'events',coalesce((select jsonb_agg(jsonb_build_object(
      'id',f.id,'revision',f.revision,'type',f.event_type,'actual_at',f.actual_at,
      'effective_actual_at',f.effective_actual_at,'recorded_at',f.recorded_at,
      'actor_name',p.display_name,'actor_mode',f.actor_mode,'method',f.method,
      'reason_code',f.reason_code,'reason',f.reason,'corrects_event_id',f.corrects_event_id,
      'correction_code',f.correction_code,'corrected_actual_at',f.corrected_actual_at)
      order by f.revision) from facts f join public.people p on p.id=f.actor_person_id),'[]'::jsonb)
  ) from chosen
$$;
revoke all on function private.attendance_summary_09a(uuid,uuid) from public, anon, authenticated;

create function public.my_event_attendance(p_offset integer default 0,p_limit integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
  if actor is null or not private.has_active_role('SECURITY_STAFF') or p_offset is null or p_offset<0
    or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50 then
    raise exception 'Attendance self read denied';
  end if;
  with scoped as materialized (
    select a.id,a.person_id,a.status,a.revision as allocation_revision,
      r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,r.area_label,
      role.display_name as role_name,e.name as event_name,e.status as event_status,
      s.name as site_name,s.reporting_point
    from public.event_staff_allocations a
    join public.event_staffing_requirements r on r.id=a.requirement_id
    join public.operational_role_definitions role on role.id=r.role_id
    join public.operational_events e on e.id=r.event_id
    join public.sites s on s.id=e.site_id
    where a.person_id=actor and a.status in ('ALLOCATED','ACCEPTED','CANCELLED')
  ), page as (
    select * from scoped order by report_at desc,id desc offset p_offset limit p_limit
  )
  select jsonb_build_object('total',(select count(*) from scoped),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'allocation_id',p.id,'status',p.status,'allocation_revision',p.allocation_revision,
      'service_date',p.service_date,'report_at',p.report_at,'shift_starts_at',p.shift_starts_at,
      'shift_ends_at',p.shift_ends_at,'area_label',p.area_label,'role_name',p.role_name,
      'event_name',p.event_name,'event_status',p.event_status,'site_name',p.site_name,
      'reporting_point',p.reporting_point,'attendance',private.attendance_summary_09a(p.id,p.person_id))
      order by p.report_at desc,p.id desc) from page p),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.my_event_attendance(integer,integer) from public, anon, authenticated;
grant execute on function public.my_event_attendance(integer,integer) to authenticated;

create function public.attendance_event_overview(p_event uuid,p_offset integer default 0,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.operational_authorised() or p_event is null or p_offset is null or p_offset<0
    or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'Attendance operational read denied';
  end if;
  if not exists(select 1 from public.operational_events where id=p_event) then
    raise exception 'Attendance operational read denied';
  end if;
  with scoped as materialized (
    select a.id,a.person_id,a.status,a.revision as allocation_revision,
      r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,r.area_label,
      role.display_name as role_name,p.display_name as person_name,
      s.name as site_name,s.reporting_point
    from public.event_staff_allocations a
    join public.event_staffing_requirements r on r.id=a.requirement_id
    join public.operational_role_definitions role on role.id=r.role_id
    join public.people p on p.id=a.person_id
    join public.operational_events e on e.id=r.event_id
    join public.sites s on s.id=e.site_id
    where e.id=p_event and a.status in ('ALLOCATED','ACCEPTED','CANCELLED')
      and (a.status<>'CANCELLED' or exists(select 1 from public.attendance_cases c
        where c.event_allocation_id=a.id))
  ), enriched as materialized (
    select x.*,private.attendance_summary_09a(x.id,x.person_id) as attendance from scoped x
  ), page as (
    select * from enriched order by report_at,id offset p_offset limit p_limit
  )
  select jsonb_build_object(
    'total',(select count(*) from enriched),
    'counts',jsonb_build_object(
      'expected',(select count(*) from scoped where status in ('ALLOCATED','ACCEPTED')),
      'checked_in',(select count(*) from enriched where attendance->>'check_in_at' is not null),
      'checked_out',(select count(*) from enriched where attendance->>'check_out_at' is not null),
      'not_yet_checked_in',(select count(*) from enriched where status in ('ALLOCATED','ACCEPTED')
        and attendance->>'check_in_at' is null),
      'exceptions',(select count(*) from enriched where coalesce((attendance->>'exception_recorded')::boolean,false)),
      'review_pending',(select count(*) from enriched where coalesce((attendance->>'review_required')::boolean,false))),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'allocation_id',p.id,'person_name',p.person_name,'status',p.status,
      'allocation_revision',p.allocation_revision,'service_date',p.service_date,
      'report_at',p.report_at,'shift_starts_at',p.shift_starts_at,'shift_ends_at',p.shift_ends_at,
      'area_label',p.area_label,'role_name',p.role_name,'site_name',p.site_name,
      'reporting_point',p.reporting_point,'attendance',p.attendance)
      order by p.report_at,p.id) from page p),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.attendance_event_overview(uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.attendance_event_overview(uuid,integer,integer) to authenticated;

create function public.attendance_self_action(
  p_allocation uuid,p_action text,p_actual_at timestamptz,p_expected_case_revision integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.event_staff_allocations%rowtype;
  c public.attendance_cases%rowtype; prior public.attendance_events%rowtype; result public.attendance_events%rowtype;
  checkin_actual timestamptz; checkin_event uuid;
begin
  if actor is null or not private.has_active_role('SECURITY_STAFF') or p_allocation is null or p_action is null
    or p_action not in ('CHECK_IN','CHECK_OUT') or p_actual_at is null
    or p_expected_case_revision is null or p_expected_case_revision<0 or p_idempotency_key is null
    or p_actual_at>clock_timestamp()+interval '60 seconds' then
    raise exception 'Attendance self action denied';
  end if;
  select * into a from public.event_staff_allocations where id=p_allocation and person_id=actor for update;
  if a.id is null then raise exception 'Attendance self action denied'; end if;
  c:=private.attendance_ensure_case_09a(a.id,actor);
  select * into prior from public.attendance_events where attendance_case_id=c.id
    and actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prior.id is not null then
    if prior.event_type<>p_action or prior.actual_at is distinct from p_actual_at
      or prior.actor_mode<>'STAFF_SELF' or prior.method<>'AUTHENTICATED_ONLINE' then
      raise exception 'Attendance idempotency conflict';
    end if;
    return jsonb_build_object('event_id',prior.id,'revision',prior.revision,'replayed',true,
      'attendance',private.attendance_summary_09a(a.id,actor));
  end if;
  if c.revision<>p_expected_case_revision then raise exception 'Stale attendance revision'; end if;
  if p_action='CHECK_IN' then
    if a.status<>'ACCEPTED' then raise exception 'Accepted allocation required for self check-in'; end if;
    if exists(select 1 from public.attendance_events e where e.attendance_case_id=c.id
      and e.event_type='CHECK_IN') then raise exception 'Check-in already recorded'; end if;
    if exists(select 1 from public.attendance_events n where n.attendance_case_id=c.id
      and n.event_type='NO_SHOW_RECORDED' and not exists(select 1 from public.attendance_events x
        where x.corrects_event_id=n.id and x.correction_code='RESOLVE_NO_SHOW_FOR_CHECK_IN')) then
      raise exception 'Manager resolution required after recorded no-show';
    end if;
  else
    select e.id,coalesce((select x.corrected_actual_at from public.attendance_events x
      where x.corrects_event_id=e.id and x.correction_code='CORRECT_TIMESTAMP'),e.actual_at)
      into checkin_event,checkin_actual from public.attendance_events e
      where e.attendance_case_id=c.id and e.event_type='CHECK_IN' order by e.revision limit 1;
    if checkin_event is null or exists(select 1 from public.attendance_events e
      where e.attendance_case_id=c.id and e.event_type='CHECK_OUT')
      or (a.status not in ('ACCEPTED','CANCELLED')) or p_actual_at<checkin_actual then
      raise exception 'Check-out requires a matching check-in';
    end if;
  end if;
  perform set_config('kss.attendance_write_09a','allowed',true);
  result:=private.attendance_append_09a(c.id,a.id,actor,p_action,p_actual_at,'STAFF_SELF',
    'AUTHENTICATED_ONLINE',null,null,p_idempotency_key);
  return jsonb_build_object('event_id',result.id,'revision',result.revision,'replayed',false,
    'attendance',private.attendance_summary_09a(a.id,actor));
end $$;
revoke all on function public.attendance_self_action(uuid,text,timestamptz,integer,uuid) from public, anon, authenticated;
grant execute on function public.attendance_self_action(uuid,text,timestamptz,integer,uuid) to authenticated;

create function public.attendance_manager_record(
  p_allocation uuid,p_action text,p_actual_at timestamptz,p_reason_code text,p_reason text,
  p_expected_case_revision integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.event_staff_allocations%rowtype;
  c public.attendance_cases%rowtype; prior public.attendance_events%rowtype; result public.attendance_events%rowtype;
  checkin_actual timestamptz; checkin_event uuid; manager_observed boolean;
begin
  if actor is null or not private.operational_authorised() or p_allocation is null
    or p_action not in ('CHECK_IN','CHECK_OUT','NO_SHOW_RECORDED','EXCUSED_ABSENCE_RECORDED','CHECK_IN_NOT_POSSIBLE','REVIEW_REQUIRED')
    or p_expected_case_revision is null or p_expected_case_revision<0 or p_idempotency_key is null
    or (p_action in ('CHECK_IN','CHECK_OUT') and (p_actual_at is null or p_actual_at>clock_timestamp()+interval '60 seconds'))
    or (p_action not in ('CHECK_IN','CHECK_OUT') and p_actual_at is not null)
    or (p_action in ('NO_SHOW_RECORDED','EXCUSED_ABSENCE_RECORDED','CHECK_IN_NOT_POSSIBLE','REVIEW_REQUIRED')
      and (p_reason_code is null or p_reason is null or length(trim(p_reason)) not between 3 and 300
        or p_reason ~ '[[:cntrl:]]')) then
    raise exception 'Attendance operational action denied';
  end if;
  select * into a from public.event_staff_allocations where id=p_allocation for update;
  if a.id is null then raise exception 'Attendance operational action denied'; end if;
  if not exists(select 1 from public.event_staffing_requirements r join public.operational_events e on e.id=r.event_id
    where r.id=a.requirement_id) then raise exception 'Attendance operational action denied'; end if;
  if p_action in ('CHECK_IN','NO_SHOW_RECORDED','EXCUSED_ABSENCE_RECORDED','CHECK_IN_NOT_POSSIBLE')
    and a.status not in ('ALLOCATED','ACCEPTED') then raise exception 'Attendance operational action denied'; end if;
  c:=private.attendance_ensure_case_09a(a.id,a.person_id);
  select * into prior from public.attendance_events where attendance_case_id=c.id
    and actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prior.id is not null then
    if prior.event_type<>p_action or prior.actual_at is distinct from p_actual_at
      or prior.reason_code is distinct from p_reason_code or prior.reason is distinct from nullif(trim(p_reason),'') then
      raise exception 'Attendance idempotency conflict';
    end if;
    return jsonb_build_object('event_id',prior.id,'revision',prior.revision,'replayed',true,
      'attendance',private.attendance_summary_09a(a.id,a.person_id));
  end if;
  if c.revision<>p_expected_case_revision then raise exception 'Stale attendance revision'; end if;
  if p_action='CHECK_IN' then
    if exists(select 1 from public.attendance_events e where e.attendance_case_id=c.id and e.event_type='CHECK_IN')
      or exists(select 1 from public.attendance_events n where n.attendance_case_id=c.id and n.event_type='NO_SHOW_RECORDED'
        and not exists(select 1 from public.attendance_events x where x.corrects_event_id=n.id
          and x.correction_code='RESOLVE_NO_SHOW_FOR_CHECK_IN')) then
      raise exception 'Resolve current attendance before another check-in';
    end if;
    manager_observed:=true;
  elsif p_action='CHECK_OUT' then
    select e.id,coalesce((select x.corrected_actual_at from public.attendance_events x
      where x.corrects_event_id=e.id and x.correction_code='CORRECT_TIMESTAMP'),e.actual_at)
      into checkin_event,checkin_actual from public.attendance_events e
      where e.attendance_case_id=c.id and e.event_type='CHECK_IN' order by e.revision limit 1;
    if checkin_event is null or exists(select 1 from public.attendance_events e
      where e.attendance_case_id=c.id and e.event_type='CHECK_OUT') or p_actual_at<checkin_actual
      or a.status not in ('ALLOCATED','ACCEPTED','CANCELLED') then
      raise exception 'Check-out requires a matching check-in';
    end if;
    manager_observed:=true;
  elsif p_action='NO_SHOW_RECORDED' then
    if exists(select 1 from public.attendance_events e where e.attendance_case_id=c.id and e.event_type='CHECK_IN')
      or exists(select 1 from public.attendance_events e where e.attendance_case_id=c.id and e.event_type='NO_SHOW_RECORDED') then
      raise exception 'Attendance exception already recorded';
    end if;
    manager_observed:=false;
  else
    manager_observed:=false;
  end if;
  perform set_config('kss.attendance_write_09a','allowed',true);
  result:=private.attendance_append_09a(c.id,a.id,a.person_id,p_action,p_actual_at,
    case when manager_observed then 'MANAGER_OBSERVED' else 'MANAGER_DECISION' end,
    'MANAGER_OBSERVED',p_reason_code,p_reason,p_idempotency_key);
  return jsonb_build_object('event_id',result.id,'revision',result.revision,'replayed',false,
    'attendance',private.attendance_summary_09a(a.id,a.person_id));
end $$;
revoke all on function public.attendance_manager_record(uuid,text,timestamptz,text,text,integer,uuid) from public, anon, authenticated;
grant execute on function public.attendance_manager_record(uuid,text,timestamptz,text,text,integer,uuid) to authenticated;

create function public.attendance_manager_resolve_no_show(
  p_allocation uuid,p_no_show_event uuid,p_actual_at timestamptz,p_reason text,
  p_expected_case_revision integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.event_staff_allocations%rowtype;
  c public.attendance_cases%rowtype; prior public.attendance_events%rowtype;
  correction public.attendance_events%rowtype; checkin public.attendance_events%rowtype;
begin
  if actor is null or not private.operational_authorised() or p_allocation is null or p_no_show_event is null
    or p_actual_at is null or p_actual_at>clock_timestamp()+interval '60 seconds'
    or p_reason is null or length(trim(p_reason)) not between 3 and 300 or p_reason ~ '[[:cntrl:]]'
    or p_expected_case_revision is null or p_expected_case_revision<0 or p_idempotency_key is null then
    raise exception 'Attendance correction denied';
  end if;
  select * into a from public.event_staff_allocations where id=p_allocation for update;
  if a.id is null or a.status not in ('ALLOCATED','ACCEPTED') then raise exception 'Attendance correction denied'; end if;
  c:=private.attendance_ensure_case_09a(a.id,a.person_id);
  select * into prior from public.attendance_events where attendance_case_id=c.id
    and actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prior.id is not null then
    if prior.event_type<>'CORRECTION' or prior.corrects_event_id<>p_no_show_event
      or prior.correction_code<>'RESOLVE_NO_SHOW_FOR_CHECK_IN' or prior.reason is distinct from trim(p_reason) then
      raise exception 'Attendance idempotency conflict';
    end if;
    select * into checkin from public.attendance_events where resolution_event_id=prior.id and event_type='CHECK_IN';
    return jsonb_build_object('event_id',checkin.id,'revision',checkin.revision,'replayed',true,
      'attendance',private.attendance_summary_09a(a.id,a.person_id));
  end if;
  if c.revision<>p_expected_case_revision or not exists(select 1 from public.attendance_events n
      where n.id=p_no_show_event and n.attendance_case_id=c.id and n.event_type='NO_SHOW_RECORDED')
    or exists(select 1 from public.attendance_events x where x.corrects_event_id=p_no_show_event)
    or exists(select 1 from public.attendance_events x where x.attendance_case_id=c.id and x.event_type='CHECK_IN') then
    raise exception 'Stale attendance correction';
  end if;
  perform set_config('kss.attendance_write_09a','allowed',true);
  correction:=private.attendance_append_09a(c.id,a.id,a.person_id,'CORRECTION',null,'MANAGER_DECISION',
    'MANAGER_OBSERVED',null,p_reason,p_idempotency_key,p_no_show_event,'RESOLVE_NO_SHOW_FOR_CHECK_IN');
  checkin:=private.attendance_append_09a(c.id,a.id,a.person_id,'CHECK_IN',p_actual_at,'MANAGER_OBSERVED',
    'MANAGER_OBSERVED',null,null,null,null,null,null,correction.id);
  return jsonb_build_object('event_id',checkin.id,'revision',checkin.revision,'replayed',false,
    'attendance',private.attendance_summary_09a(a.id,a.person_id));
end $$;
revoke all on function public.attendance_manager_resolve_no_show(uuid,uuid,timestamptz,text,integer,uuid)
  from public, anon, authenticated;
grant execute on function public.attendance_manager_resolve_no_show(uuid,uuid,timestamptz,text,integer,uuid) to authenticated;

create function public.attendance_manager_correct(
  p_allocation uuid,p_target_event uuid,p_correction text,p_corrected_actual_at timestamptz,
  p_reason text,p_expected_case_revision integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.event_staff_allocations%rowtype;
  c public.attendance_cases%rowtype; target public.attendance_events%rowtype;
  prior public.attendance_events%rowtype; result public.attendance_events%rowtype;
  effective_checkin timestamptz; checkout_at timestamptz;
begin
  if actor is null or not private.operational_authorised() or p_allocation is null or p_target_event is null
    or p_correction not in ('CORRECT_TIMESTAMP','RESOLVE_CANCELLED_ALLOCATION_REVIEW')
    or p_reason is null or length(trim(p_reason)) not between 3 and 300 or p_reason ~ '[[:cntrl:]]'
    or p_expected_case_revision is null or p_expected_case_revision<0 or p_idempotency_key is null
    or (p_correction='CORRECT_TIMESTAMP' and (p_corrected_actual_at is null
      or p_corrected_actual_at>clock_timestamp()+interval '60 seconds'))
    or (p_correction<>'CORRECT_TIMESTAMP' and p_corrected_actual_at is not null) then
    raise exception 'Attendance correction denied';
  end if;
  select * into a from public.event_staff_allocations where id=p_allocation for update;
  if a.id is null then raise exception 'Attendance correction denied'; end if;
  c:=private.attendance_ensure_case_09a(a.id,a.person_id);
  select * into prior from public.attendance_events where attendance_case_id=c.id
    and actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prior.id is not null then
    if prior.event_type<>'CORRECTION' or prior.corrects_event_id<>p_target_event
      or prior.correction_code<>p_correction or prior.corrected_actual_at is distinct from p_corrected_actual_at
      or prior.reason is distinct from trim(p_reason) then raise exception 'Attendance idempotency conflict'; end if;
    return jsonb_build_object('event_id',prior.id,'revision',prior.revision,'replayed',true,
      'attendance',private.attendance_summary_09a(a.id,a.person_id));
  end if;
  if c.revision<>p_expected_case_revision then raise exception 'Stale attendance correction'; end if;
  select * into target from public.attendance_events where id=p_target_event and attendance_case_id=c.id for update;
  if target.id is null then raise exception 'Attendance correction denied'; end if;
  if exists(select 1 from public.attendance_events x where x.corrects_event_id=target.id) then
    raise exception 'Attendance fact already corrected';
  end if;
  if p_correction='CORRECT_TIMESTAMP' then
    if target.event_type not in ('CHECK_IN','CHECK_OUT') then raise exception 'Attendance correction denied'; end if;
    if target.event_type='CHECK_OUT' then
      select coalesce((select x.corrected_actual_at from public.attendance_events x
        where x.corrects_event_id=i.id and x.correction_code='CORRECT_TIMESTAMP'),i.actual_at)
        into effective_checkin from public.attendance_events i
        where i.attendance_case_id=c.id and i.event_type='CHECK_IN' order by i.revision limit 1;
      if effective_checkin is null or p_corrected_actual_at<effective_checkin then
        raise exception 'Corrected check-out must follow check-in';
      end if;
    else
      select coalesce((select x.corrected_actual_at from public.attendance_events x
        where x.corrects_event_id=o.id and x.correction_code='CORRECT_TIMESTAMP'),o.actual_at)
        into checkout_at from public.attendance_events o
        where o.attendance_case_id=c.id and o.event_type='CHECK_OUT' order by o.revision limit 1;
      if checkout_at is not null and p_corrected_actual_at>checkout_at then
        raise exception 'Corrected check-in must precede check-out';
      end if;
    end if;
  elsif target.event_type<>'REVIEW_REQUIRED' or not exists(select 1
    from public.event_staff_allocations x where x.id=a.id and x.status='CANCELLED') then
    raise exception 'Attendance review correction denied';
  end if;
  perform set_config('kss.attendance_write_09a','allowed',true);
  result:=private.attendance_append_09a(c.id,a.id,a.person_id,'CORRECTION',null,'MANAGER_DECISION',
    'MANAGER_OBSERVED',null,p_reason,p_idempotency_key,target.id,p_correction,p_corrected_actual_at);
  return jsonb_build_object('event_id',result.id,'revision',result.revision,'replayed',false,
    'attendance',private.attendance_summary_09a(a.id,a.person_id));
end $$;
revoke all on function public.attendance_manager_correct(uuid,uuid,text,timestamptz,text,integer,uuid)
  from public, anon, authenticated;
grant execute on function public.attendance_manager_correct(uuid,uuid,text,timestamptz,text,integer,uuid) to authenticated;

create function private.flag_cancelled_attendance_09a() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.attendance_cases%rowtype; actor uuid:=private.current_person_id();
begin
  if old.status is distinct from 'CANCELLED' and new.status='CANCELLED' then
    select * into c from public.attendance_cases where event_allocation_id=new.id for update;
    if c.id is not null and exists(select 1 from public.attendance_events e
      where e.attendance_case_id=c.id and e.event_type='CHECK_IN') then
      if actor is null then raise exception 'Attendance cancellation review requires an attributed actor'; end if;
      perform set_config('kss.attendance_write_09a','allowed',true);
      perform private.attendance_append_09a(c.id,new.id,new.person_id,'REVIEW_REQUIRED',null,
        'MANAGER_DECISION','ALLOCATION_CANCELLATION','ALLOCATION_CANCELLED_AFTER_CHECK_IN',
        'Allocation cancelled after check-in; attendance retained for review.',null);
    end if;
  end if;
  return new;
end $$;
revoke all on function private.flag_cancelled_attendance_09a() from public, anon, authenticated;
create trigger flag_cancelled_attendance_09a after update of status on public.event_staff_allocations
  for each row when (old.status is distinct from 'CANCELLED' and new.status='CANCELLED')
  execute function private.flag_cancelled_attendance_09a();
