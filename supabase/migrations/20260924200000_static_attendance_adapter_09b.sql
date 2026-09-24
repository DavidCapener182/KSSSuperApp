-- TASK-09B: one factual attendance domain, with exact Event or Site Shift source.
-- Existing Event case/event IDs and public Event RPC contracts are retained.
alter table public.attendance_cases alter column event_allocation_id drop not null;
alter table public.attendance_cases add column site_shift_allocation_id uuid;
alter table public.attendance_cases add constraint attendance_case_site_source_fk
  foreign key (site_shift_allocation_id) references public.site_shift_allocations(id);
alter table public.attendance_cases add constraint attendance_case_source_xor
  check ((event_allocation_id is not null) <> (site_shift_allocation_id is not null));
alter table public.attendance_cases add constraint attendance_case_site_unique unique (site_shift_allocation_id);
alter table public.attendance_cases add constraint attendance_case_site_person_unique
  unique (id, site_shift_allocation_id, person_id);

-- 08A makes demand and Person immutable for a static allocation. The composite
-- key lets the database enforce the Person equality, not merely the wrapper.
alter table public.site_shift_allocations add constraint site_shift_allocation_person_unique
  unique (id, person_id);
alter table public.attendance_cases add constraint attendance_case_site_person_fk
  foreign key (site_shift_allocation_id, person_id)
  references public.site_shift_allocations(id, person_id);

alter table public.attendance_events alter column event_allocation_id drop not null;
alter table public.attendance_events add column site_shift_allocation_id uuid;
alter table public.attendance_events add constraint attendance_event_source_xor
  check ((event_allocation_id is not null) <> (site_shift_allocation_id is not null));
alter table public.attendance_events add constraint attendance_event_site_case_person_fk
  foreign key (attendance_case_id, site_shift_allocation_id, person_id)
  references public.attendance_cases(id, site_shift_allocation_id, person_id);
create index attendance_case_site_person_idx on public.attendance_cases(person_id, site_shift_allocation_id);
create index attendance_event_site_revision_idx on public.attendance_events(site_shift_allocation_id, revision desc);

create or replace function private.guard_attendance_09a() returns trigger
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
      if new.event_allocation_id is not null and not exists(select 1 from public.event_staff_allocations a
        where a.id=new.event_allocation_id and a.person_id=new.person_id) then
        raise exception 'Attendance allocation binding denied';
      end if;
      if new.site_shift_allocation_id is not null and not exists(select 1 from public.site_shift_allocations a
        where a.id=new.site_shift_allocation_id and a.person_id=new.person_id) then
        raise exception 'Attendance allocation binding denied';
      end if;
    elsif tg_op='UPDATE' then
      if new.id is distinct from old.id or new.event_allocation_id is distinct from old.event_allocation_id
        or new.site_shift_allocation_id is distinct from old.site_shift_allocation_id
        or new.person_id is distinct from old.person_id or new.revision<>old.revision+1
        or new.created_at is distinct from old.created_at or new.updated_at<old.updated_at then
        raise exception 'Attendance case identity/history cannot be changed';
      end if;
    end if;
  end if;
  return new;
end $$;

create function private.attendance_ensure_site_case_09b(p_allocation uuid,p_person uuid)
returns public.attendance_cases language plpgsql security definer set search_path='' as $$
declare c public.attendance_cases%rowtype;
begin
  perform set_config('kss.attendance_write_09a','allowed',true);
  insert into public.attendance_cases(site_shift_allocation_id,person_id)
    select a.id,a.person_id from public.site_shift_allocations a
    where a.id=p_allocation and a.person_id=p_person
    on conflict(site_shift_allocation_id) do nothing;
  select * into c from public.attendance_cases
    where site_shift_allocation_id=p_allocation and person_id=p_person for update;
  if c.id is null then raise exception 'Attendance allocation denied'; end if;
  return c;
end $$;
revoke all on function private.attendance_ensure_site_case_09b(uuid,uuid) from public,anon,authenticated;

create function private.attendance_append_site_09b(
  p_case uuid,p_allocation uuid,p_person uuid,p_type text,p_actual_at timestamptz,
  p_actor_mode text,p_method text,p_reason_code text,p_reason text,p_key uuid,
  p_corrects_event uuid default null,p_correction_code text default null,
  p_corrected_actual_at timestamptz default null,p_resolution_event uuid default null
) returns public.attendance_events language plpgsql security definer set search_path='' as $$
declare c public.attendance_cases%rowtype; result public.attendance_events%rowtype;
begin
  if private.current_person_id() is null or current_setting('kss.attendance_write_09a',true) is distinct from 'allowed' then
    raise exception 'Attendance write denied';
  end if;
  select * into c from public.attendance_cases where id=p_case and site_shift_allocation_id=p_allocation
    and person_id=p_person for update;
  if c.id is null then raise exception 'Attendance write denied'; end if;
  update public.attendance_cases set revision=c.revision+1,updated_at=clock_timestamp() where id=c.id;
  insert into public.attendance_events(attendance_case_id,site_shift_allocation_id,person_id,revision,event_type,
    actual_at,actor_person_id,actor_mode,method,reason_code,reason,idempotency_key,corrects_event_id,
    correction_code,corrected_actual_at,resolution_event_id)
  values(c.id,p_allocation,p_person,c.revision+1,p_type,p_actual_at,private.current_person_id(),p_actor_mode,p_method,
    p_reason_code,nullif(trim(p_reason),''),p_key,p_corrects_event,p_correction_code,p_corrected_actual_at,p_resolution_event)
  returning * into result;
  return result;
end $$;
revoke all on function private.attendance_append_site_09b(uuid,uuid,uuid,text,timestamptz,text,text,text,text,uuid,uuid,text,timestamptz,uuid)
  from public,anon,authenticated;

-- The existing summary is case-local. Reuse its factual projection without
-- deriving any work duration; static Staff receives the same note redaction.
create function private.attendance_summary_site_09b(p_allocation uuid,p_person uuid,p_staff boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.attendance_cases%rowtype; projection jsonb;
begin
  select * into c from public.attendance_cases where site_shift_allocation_id=p_allocation and person_id=p_person;
  with facts as (
    select e.*, case when e.event_type in ('CHECK_IN','CHECK_OUT') then coalesce(
      (select x.corrected_actual_at from public.attendance_events x where x.corrects_event_id=e.id
       and x.attendance_case_id=e.attendance_case_id and x.correction_code='CORRECT_TIMESTAMP'),e.actual_at)
      else null end as effective_actual_at
    from public.attendance_events e where e.attendance_case_id=c.id
  ), chosen as (
    select
      (select f.effective_actual_at from facts f where f.event_type='CHECK_IN' order by f.revision limit 1) as checked_in_at,
      (select f.effective_actual_at from facts f where f.event_type='CHECK_OUT' order by f.revision limit 1) as checked_out_at,
      exists(select 1 from facts n where n.event_type='NO_SHOW_RECORDED' and not exists(
        select 1 from facts x where x.corrects_event_id=n.id and x.correction_code='RESOLVE_NO_SHOW_FOR_CHECK_IN')) as no_show,
      exists(select 1 from facts f where f.event_type='EXCUSED_ABSENCE_RECORDED') as excused,
      exists(select 1 from facts f where f.event_type='CHECK_IN_NOT_POSSIBLE') as impossible,
      exists(select 1 from facts r where r.event_type='REVIEW_REQUIRED' and not exists(
        select 1 from facts x where x.corrects_event_id=r.id and x.correction_code='RESOLVE_CANCELLED_ALLOCATION_REVIEW')) as review
  )
  select jsonb_build_object('revision',coalesce(c.revision,0),
    'state',case when chosen.checked_out_at is not null then 'CHECKED_OUT'
      when chosen.checked_in_at is not null then 'CHECKED_IN'
      when chosen.no_show then 'NO_SHOW_RECORDED' when chosen.excused then 'EXCUSED_ABSENCE_RECORDED'
      when chosen.review then 'REVIEW_REQUIRED' when chosen.impossible then 'CHECK_IN_NOT_POSSIBLE'
      else 'NOT_YET_CHECKED_IN' end,
    'check_in_at',chosen.checked_in_at,'check_out_at',chosen.checked_out_at,
    'no_show_recorded',chosen.no_show,'review_required',chosen.review,
    'exception_recorded',chosen.no_show or chosen.excused or chosen.impossible or chosen.review,
    'events',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'revision',f.revision,
      'type',f.event_type,'actual_at',f.actual_at,'effective_actual_at',f.effective_actual_at,
      'recorded_at',f.recorded_at,'actor_name',p.display_name,'actor_mode',f.actor_mode,'method',f.method,
      'reason_code',f.reason_code,'reason',case when p_staff then null else f.reason end,
      'corrects_event_id',f.corrects_event_id,'correction_code',f.correction_code,
      'corrected_actual_at',f.corrected_actual_at)
      order by f.revision) from facts f join public.people p on p.id=f.actor_person_id),'[]'::jsonb))
    into projection from chosen;
  return projection;
end $$;
revoke all on function private.attendance_summary_site_09b(uuid,uuid,boolean) from public,anon,authenticated;

create function private.site_attendance_context_valid_09b(p_allocation uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.site_shift_allocations a
    join public.site_shift_demands d on d.id=a.demand_id
    join public.site_services sv on sv.id=d.service_id
    where a.id=p_allocation and a.status='ACCEPTED' and d.state='PLANNED'
      and d.service_date>=sv.effective_from
      and (sv.effective_until is null or d.service_date<sv.effective_until)
      and (sv.state<>'ENDED' or (sv.effective_until is not null and d.service_date<sv.effective_until))
      and not exists(select 1 from public.site_service_pauses p where p.service_id=sv.id
        and p.starts_on<=d.service_date and d.service_date<p.ends_before))
$$;
revoke all on function private.site_attendance_context_valid_09b(uuid) from public,anon,authenticated;

create function private.site_attendance_manager_authorised_09b(p_allocation uuid,p_service uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.operational_authorised() and exists(
    select 1 from public.site_shift_allocations a
    join public.site_shift_demands d on d.id=a.demand_id
    join public.site_services sv on sv.id=d.service_id
    join public.sites s on s.id=sv.site_id
    where a.id=p_allocation and d.service_id=p_service and s.id=sv.site_id)
$$;
revoke all on function private.site_attendance_manager_authorised_09b(uuid,uuid) from public,anon,authenticated;

create function public.attendance_site_self_action(
  p_allocation uuid,p_action text,p_actual_at timestamptz,p_expected_case_revision integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.site_shift_allocations%rowtype;
  c public.attendance_cases%rowtype; prior public.attendance_events%rowtype; result public.attendance_events%rowtype;
  checkin_actual timestamptz; v_demand uuid; v_service uuid;
begin
  if actor is null or not private.has_active_role('SECURITY_STAFF') or p_allocation is null
    or p_action not in ('CHECK_IN','CHECK_OUT') or p_actual_at is null
    or p_actual_at>clock_timestamp()+interval '60 seconds' or p_expected_case_revision is null
    or p_expected_case_revision<0 or p_idempotency_key is null then
    raise exception 'Attendance self action denied';
  end if;
  -- Match 08A lifecycle order: Service, demand, allocation. The preliminary
  -- read grants no authority; all source conditions are rechecked after locks.
  select a0.demand_id,d.service_id into v_demand,v_service
    from public.site_shift_allocations a0 join public.site_shift_demands d on d.id=a0.demand_id
    where a0.id=p_allocation and a0.person_id=actor;
  if v_service is null then raise exception 'Attendance self action denied'; end if;
  perform 1 from public.site_services where id=v_service for share;
  perform 1 from public.site_shift_demands where id=v_demand for share;
  select * into a from public.site_shift_allocations where id=p_allocation and person_id=actor
    and demand_id=v_demand for update;
  if a.id is null then raise exception 'Attendance self action denied'; end if;
  c:=private.attendance_ensure_site_case_09b(a.id,actor);
  select * into prior from public.attendance_events where attendance_case_id=c.id
    and actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prior.id is not null then
    if prior.event_type<>p_action or prior.actual_at is distinct from p_actual_at
      or prior.actor_mode<>'STAFF_SELF' or prior.method<>'AUTHENTICATED_ONLINE' then
      raise exception 'Attendance idempotency conflict';
    end if;
    return jsonb_build_object('event_id',prior.id,'revision',prior.revision,'replayed',true,
      'attendance',private.attendance_summary_site_09b(a.id,actor,true));
  end if;
  if c.revision<>p_expected_case_revision then raise exception 'Stale attendance revision'; end if;
  if not private.site_attendance_context_valid_09b(a.id) then
    raise exception 'Accepted active Site shift required';
  end if;
  if p_action='CHECK_IN' then
    if exists(select 1 from public.attendance_events e where e.attendance_case_id=c.id and e.event_type='CHECK_IN')
      or exists(select 1 from public.attendance_events n where n.attendance_case_id=c.id
        and n.event_type='NO_SHOW_RECORDED' and not exists(select 1 from public.attendance_events x
          where x.corrects_event_id=n.id and x.correction_code='RESOLVE_NO_SHOW_FOR_CHECK_IN')) then
      raise exception 'Resolve current attendance before check-in';
    end if;
  else
    select coalesce((select x.corrected_actual_at from public.attendance_events x
      where x.corrects_event_id=e.id and x.correction_code='CORRECT_TIMESTAMP'),e.actual_at)
      into checkin_actual from public.attendance_events e
      where e.attendance_case_id=c.id and e.event_type='CHECK_IN' order by e.revision limit 1;
    if checkin_actual is null or p_actual_at<checkin_actual or exists(
      select 1 from public.attendance_events e where e.attendance_case_id=c.id and e.event_type='CHECK_OUT') then
      raise exception 'Check-out requires a matching check-in';
    end if;
  end if;
  perform set_config('kss.attendance_write_09a','allowed',true);
  result:=private.attendance_append_site_09b(c.id,a.id,actor,p_action,p_actual_at,
    'STAFF_SELF','AUTHENTICATED_ONLINE',null,null,p_idempotency_key);
  return jsonb_build_object('event_id',result.id,'revision',result.revision,'replayed',false,
    'attendance',private.attendance_summary_site_09b(a.id,actor,true));
end $$;
revoke all on function public.attendance_site_self_action(uuid,text,timestamptz,integer,uuid) from public,anon,authenticated;
grant execute on function public.attendance_site_self_action(uuid,text,timestamptz,integer,uuid) to authenticated;

-- One static manager wrapper enforces source scope before dispatching any
-- factual or correction action. The UI does not grant authority.
create function public.attendance_site_manager_action(
  p_service uuid,p_allocation uuid,p_action text,p_actual_at timestamptz,p_reason_code text,
  p_reason text,p_target_event uuid,p_expected_case_revision integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.site_shift_allocations%rowtype;
  c public.attendance_cases%rowtype; prior public.attendance_events%rowtype; result public.attendance_events%rowtype;
  target public.attendance_events%rowtype; checkin public.attendance_events%rowtype;
  checkin_actual timestamptz; checkout_actual timestamptz; effective_actual timestamptz;
  correction_code text; target_type text; action_type text; observed boolean;
begin
  if actor is null or p_service is null or p_allocation is null or p_idempotency_key is null
    or p_expected_case_revision is null or p_expected_case_revision<0
    or p_action not in ('CHECK_IN','CHECK_OUT','NO_SHOW_RECORDED','EXCUSED_ABSENCE_RECORDED',
      'CHECK_IN_NOT_POSSIBLE','REVIEW_REQUIRED','RESOLVE_NO_SHOW_FOR_CHECK_IN',
      'CORRECT_TIMESTAMP','RESOLVE_CANCELLED_ALLOCATION_REVIEW') then
    raise exception 'Attendance operational action denied';
  end if;
  select * into a from public.site_shift_allocations where id=p_allocation for update;
  if a.id is null or not private.site_attendance_manager_authorised_09b(a.id,p_service) then
    raise exception 'Attendance operational action denied';
  end if;
  c:=private.attendance_ensure_site_case_09b(a.id,a.person_id);
  if p_action in ('CHECK_IN','CHECK_OUT','RESOLVE_NO_SHOW_FOR_CHECK_IN','CORRECT_TIMESTAMP') then
    if p_actual_at is null or p_actual_at>clock_timestamp()+interval '60 seconds' then
      raise exception 'Attendance actual time denied';
    end if;
  elsif p_actual_at is not null then raise exception 'Attendance actual time denied'; end if;
  if p_action in ('NO_SHOW_RECORDED','EXCUSED_ABSENCE_RECORDED','CHECK_IN_NOT_POSSIBLE','REVIEW_REQUIRED',
      'RESOLVE_NO_SHOW_FOR_CHECK_IN','CORRECT_TIMESTAMP','RESOLVE_CANCELLED_ALLOCATION_REVIEW')
    and (p_reason is null or length(trim(p_reason)) not between 3 and 300 or p_reason ~ '[[:cntrl:]]') then
    raise exception 'Attendance reason required';
  end if;
  if p_action in ('NO_SHOW_RECORDED','EXCUSED_ABSENCE_RECORDED','CHECK_IN_NOT_POSSIBLE') and
    (p_reason_code is null or p_reason_code not in ('NO_SHOW','EXCUSED','CHECK_IN_NOT_POSSIBLE','OTHER')) then
    raise exception 'Attendance reason code required';
  end if;
  if p_action not in ('NO_SHOW_RECORDED','EXCUSED_ABSENCE_RECORDED','CHECK_IN_NOT_POSSIBLE','REVIEW_REQUIRED')
    and p_reason_code is not null then raise exception 'Attendance reason code denied'; end if;
  if p_action in ('RESOLVE_NO_SHOW_FOR_CHECK_IN','CORRECT_TIMESTAMP','RESOLVE_CANCELLED_ALLOCATION_REVIEW') then
    if p_target_event is null then raise exception 'Attendance target required'; end if;
  elsif p_target_event is not null then raise exception 'Attendance target denied'; end if;
  select * into prior from public.attendance_events where attendance_case_id=c.id
    and actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prior.id is not null then
    action_type:=case when p_action in ('RESOLVE_NO_SHOW_FOR_CHECK_IN','CORRECT_TIMESTAMP',
      'RESOLVE_CANCELLED_ALLOCATION_REVIEW') then 'CORRECTION' else p_action end;
    correction_code:=case when action_type='CORRECTION' then p_action else null end;
    if prior.event_type<>action_type or prior.correction_code is distinct from correction_code
      or prior.corrects_event_id is distinct from p_target_event
      or prior.reason is distinct from nullif(trim(p_reason),'')
      or prior.reason_code is distinct from p_reason_code
      or (p_action<>'RESOLVE_NO_SHOW_FOR_CHECK_IN' and
        coalesce(prior.actual_at,prior.corrected_actual_at) is distinct from p_actual_at) then
      raise exception 'Attendance idempotency conflict';
    end if;
    if p_action='RESOLVE_NO_SHOW_FOR_CHECK_IN' then
      select * into checkin from public.attendance_events where resolution_event_id=prior.id
        and attendance_case_id=c.id and event_type='CHECK_IN';
      if checkin.id is null or checkin.actual_at is distinct from p_actual_at then
        raise exception 'Attendance idempotency conflict';
      end if;
      prior:=checkin;
    end if;
    return jsonb_build_object('event_id',prior.id,'revision',prior.revision,'replayed',true,
      'attendance',private.attendance_summary_site_09b(a.id,a.person_id,false));
  end if;
  if c.revision<>p_expected_case_revision then raise exception 'Stale attendance revision'; end if;
  if p_action in ('CHECK_IN','NO_SHOW_RECORDED','EXCUSED_ABSENCE_RECORDED','CHECK_IN_NOT_POSSIBLE')
    and a.status not in ('ALLOCATED','ACCEPTED') then raise exception 'Attendance operational action denied'; end if;
  if p_action='CHECK_IN' then
    if exists(select 1 from public.attendance_events e where e.attendance_case_id=c.id and e.event_type='CHECK_IN')
      or exists(select 1 from public.attendance_events n where n.attendance_case_id=c.id
        and n.event_type='NO_SHOW_RECORDED' and not exists(select 1 from public.attendance_events x
          where x.corrects_event_id=n.id and x.correction_code='RESOLVE_NO_SHOW_FOR_CHECK_IN')) then
      raise exception 'Resolve current attendance before another check-in';
    end if;
  elsif p_action='CHECK_OUT' then
    select coalesce((select x.corrected_actual_at from public.attendance_events x
      where x.corrects_event_id=i.id and x.correction_code='CORRECT_TIMESTAMP'),i.actual_at)
      into checkin_actual from public.attendance_events i
      where i.attendance_case_id=c.id and i.event_type='CHECK_IN' order by i.revision limit 1;
    if checkin_actual is null or p_actual_at<checkin_actual or exists(select 1 from public.attendance_events e
      where e.attendance_case_id=c.id and e.event_type='CHECK_OUT') then
      raise exception 'Check-out requires a matching check-in';
    end if;
  elsif p_action='NO_SHOW_RECORDED' then
    if exists(select 1 from public.attendance_events e where e.attendance_case_id=c.id
      and e.event_type in ('CHECK_IN','NO_SHOW_RECORDED')) then
      raise exception 'Attendance exception already recorded';
    end if;
  elsif p_action in ('RESOLVE_NO_SHOW_FOR_CHECK_IN','CORRECT_TIMESTAMP','RESOLVE_CANCELLED_ALLOCATION_REVIEW') then
    select * into target from public.attendance_events where id=p_target_event and attendance_case_id=c.id for update;
    if target.id is null or exists(select 1 from public.attendance_events x where x.corrects_event_id=target.id)
      then raise exception 'Attendance correction denied'; end if;
    if p_action='RESOLVE_NO_SHOW_FOR_CHECK_IN' then
      if target.event_type<>'NO_SHOW_RECORDED' or a.status not in ('ALLOCATED','ACCEPTED')
        or exists(select 1 from public.attendance_events e where e.attendance_case_id=c.id and e.event_type='CHECK_IN')
        then raise exception 'Attendance correction denied'; end if;
    elsif p_action='CORRECT_TIMESTAMP' then
      if target.event_type not in ('CHECK_IN','CHECK_OUT') then raise exception 'Attendance correction denied'; end if;
      if target.event_type='CHECK_OUT' then
        select coalesce((select x.corrected_actual_at from public.attendance_events x
          where x.corrects_event_id=i.id and x.correction_code='CORRECT_TIMESTAMP'),i.actual_at)
          into checkin_actual from public.attendance_events i
          where i.attendance_case_id=c.id and i.event_type='CHECK_IN' order by i.revision limit 1;
        if checkin_actual is null or p_actual_at<checkin_actual then raise exception 'Corrected check-out must follow check-in'; end if;
      else
        select coalesce((select x.corrected_actual_at from public.attendance_events x
          where x.corrects_event_id=o.id and x.correction_code='CORRECT_TIMESTAMP'),o.actual_at)
          into checkout_actual from public.attendance_events o
          where o.attendance_case_id=c.id and o.event_type='CHECK_OUT' order by o.revision limit 1;
        if checkout_actual is not null and p_actual_at>checkout_actual then raise exception 'Corrected check-in must precede check-out'; end if;
      end if;
    elsif target.event_type<>'REVIEW_REQUIRED' or a.status<>'CANCELLED' then
      raise exception 'Attendance review correction denied';
    end if;
  end if;
  observed:=p_action in ('CHECK_IN','CHECK_OUT');
  perform set_config('kss.attendance_write_09a','allowed',true);
  if p_action='RESOLVE_NO_SHOW_FOR_CHECK_IN' then
    result:=private.attendance_append_site_09b(c.id,a.id,a.person_id,'CORRECTION',null,
      'MANAGER_DECISION','MANAGER_OBSERVED',null,p_reason,p_idempotency_key,p_target_event,
      'RESOLVE_NO_SHOW_FOR_CHECK_IN');
    result:=private.attendance_append_site_09b(c.id,a.id,a.person_id,'CHECK_IN',p_actual_at,
      'MANAGER_OBSERVED','MANAGER_OBSERVED',null,null,null,null,null,null,result.id);
  elsif p_action in ('CORRECT_TIMESTAMP','RESOLVE_CANCELLED_ALLOCATION_REVIEW') then
    result:=private.attendance_append_site_09b(c.id,a.id,a.person_id,'CORRECTION',null,
      'MANAGER_DECISION','MANAGER_OBSERVED',null,p_reason,p_idempotency_key,p_target_event,
      p_action,case when p_action='CORRECT_TIMESTAMP' then p_actual_at else null end);
  else
    result:=private.attendance_append_site_09b(c.id,a.id,a.person_id,p_action,p_actual_at,
      case when observed then 'MANAGER_OBSERVED' else 'MANAGER_DECISION' end,'MANAGER_OBSERVED',
      p_reason_code,p_reason,p_idempotency_key);
  end if;
  return jsonb_build_object('event_id',result.id,'revision',result.revision,'replayed',false,
    'attendance',private.attendance_summary_site_09b(a.id,a.person_id,false));
end $$;
revoke all on function public.attendance_site_manager_action(uuid,uuid,text,timestamptz,text,text,uuid,integer,uuid)
  from public,anon,authenticated;
grant execute on function public.attendance_site_manager_action(uuid,uuid,text,timestamptz,text,text,uuid,integer,uuid)
  to authenticated;

create function private.flag_cancelled_site_attendance_09b() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.attendance_cases%rowtype; actor uuid:=private.current_person_id();
begin
  if old.status is distinct from 'CANCELLED' and new.status='CANCELLED' then
    select * into c from public.attendance_cases where site_shift_allocation_id=new.id for update;
    if c.id is not null and exists(select 1 from public.attendance_events e
      where e.attendance_case_id=c.id and e.event_type='CHECK_IN')
      and not exists(select 1 from public.attendance_events e where e.attendance_case_id=c.id
        and e.event_type='REVIEW_REQUIRED' and e.method='ALLOCATION_CANCELLATION') then
      if actor is null then raise exception 'Attendance cancellation review requires an attributed actor'; end if;
      perform set_config('kss.attendance_write_09a','allowed',true);
      perform private.attendance_append_site_09b(c.id,new.id,new.person_id,'REVIEW_REQUIRED',null,
        'MANAGER_DECISION','ALLOCATION_CANCELLATION','ALLOCATION_CANCELLED_AFTER_CHECK_IN',
        'Allocation cancelled after check-in; attendance retained for review.',null);
    end if;
  end if;
  return new;
end $$;
revoke all on function private.flag_cancelled_site_attendance_09b() from public,anon,authenticated;
create trigger flag_cancelled_site_attendance_09b after update of status on public.site_shift_allocations
  for each row when (old.status is distinct from 'CANCELLED' and new.status='CANCELLED')
  execute function private.flag_cancelled_site_attendance_09b();

create function public.my_attendance_09b(p_offset integer default 0,p_limit integer default 25,
  p_allocation_id uuid default null,p_source text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
  if actor is null or not private.has_active_role('SECURITY_STAFF')
    or p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50
    or (p_allocation_id is null and p_source is not null)
    or (p_allocation_id is not null and (p_offset<>0 or p_source not in ('EVENT','SITE_SHIFT'))) then
    raise exception 'Attendance self read denied';
  end if;
  with scoped as materialized (
    select 'EVENT'::text as source,a.id,a.status,r.report_at,
      case when a.status='ACCEPTED' and summary->>'check_in_at' is null
        and not coalesce((summary->>'no_show_recorded')::boolean,false) then 0
        when summary->>'check_in_at' is not null and summary->>'check_out_at' is null
          and a.status in ('ACCEPTED','CANCELLED') then 1
        when a.status='ALLOCATED' then 2 else 3 end as priority,
      jsonb_build_object('source','EVENT','allocation_id',a.id,'status',a.status,
        'allocation_revision',a.revision,'service_date',r.service_date,'report_at',r.report_at,
        'shift_starts_at',r.shift_starts_at,'shift_ends_at',r.shift_ends_at,
        'area_label',r.area_label,'role_name',role.display_name,'event_name',e.name,
        'event_status',e.status,'site_name',s.name,'reporting_point',s.reporting_point,
        'attendance',summary,'self_action_available',a.status='ACCEPTED') as item
    from public.event_staff_allocations a
    join public.event_staffing_requirements r on r.id=a.requirement_id
    join public.operational_role_definitions role on role.id=r.role_id
    join public.operational_events e on e.id=r.event_id
    join public.sites s on s.id=e.site_id
    cross join lateral (select private.attendance_summary_staff_09a(a.id,a.person_id) as summary) att
    where a.person_id=actor and a.status in ('ALLOCATED','ACCEPTED','CANCELLED')
      and (p_allocation_id is null or (p_source='EVENT' and a.id=p_allocation_id))
    union all
    select 'SITE_SHIFT'::text,a.id,a.status,d.report_at,
      case when a.status='ACCEPTED' and valid and summary->>'check_in_at' is null
        and not coalesce((summary->>'no_show_recorded')::boolean,false) then 0
        when a.status='ACCEPTED' and valid and summary->>'check_in_at' is not null
          and summary->>'check_out_at' is null then 1
        when a.status='ALLOCATED' then 2 else 3 end,
      jsonb_build_object('source','SITE_SHIFT','allocation_id',a.id,'demand_id',d.id,
        'service_id',sv.id,'status',a.status,'allocation_revision',a.revision,
        'service_date',d.service_date,'report_at',d.report_at,
        'shift_starts_at',d.shift_starts_at,'shift_ends_at',d.shift_ends_at,
        'area_label',d.area_label,'role_name',role.display_name,'event_name',sv.name,
        'service_name',sv.name,'service_state',sv.state,'demand_state',d.state,
        'event_status',case when valid then 'ACTIVE' else 'REVIEW_REQUIRED' end,
        'site_name',s.name,'reporting_point',d.reporting_point,
        'attendance',summary,'self_action_available',valid) as item
    from public.site_shift_allocations a
    join public.site_shift_demands d on d.id=a.demand_id
    join public.site_services sv on sv.id=d.service_id
    join public.sites s on s.id=sv.site_id
    join public.operational_role_definitions role on role.id=d.role_id
    cross join lateral (select private.attendance_summary_site_09b(a.id,a.person_id,true) as summary,
      private.site_attendance_context_valid_09b(a.id) as valid) att
    where a.person_id=actor and a.status in ('ALLOCATED','ACCEPTED','CANCELLED')
      and (p_allocation_id is null or (p_source='SITE_SHIFT' and a.id=p_allocation_id))
  ), page as (select * from scoped order by priority,report_at desc,source,id desc
    offset p_offset limit p_limit)
  select jsonb_build_object('total',(select count(*) from scoped),
    'items',coalesce((select jsonb_agg(item order by priority,report_at desc,source,id desc)
      from page),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.my_attendance_09b(integer,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.my_attendance_09b(integer,integer,uuid,text) to authenticated;

create function public.attendance_site_overview_09b(p_service uuid,p_demand uuid default null,
  p_offset integer default 0,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.operational_authorised() or p_service is null or p_offset is null or p_offset<0
    or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>100
    or not exists(select 1 from public.site_services sv join public.sites s on s.id=sv.site_id
      where sv.id=p_service)
    or (p_demand is not null and not exists(select 1 from public.site_shift_demands d
      where d.id=p_demand and d.service_id=p_service)) then
    raise exception 'Attendance operational read denied';
  end if;
  with scoped as materialized (
    select a.id,d.report_at,jsonb_build_object('allocation_id',a.id,'demand_id',d.id,
      'service_id',sv.id,'service_name',sv.name,'service_state',sv.state,
      'demand_state',d.state,'person_name',p.display_name,'status',a.status,
      'service_date',d.service_date,'report_at',d.report_at,
      'shift_starts_at',d.shift_starts_at,'shift_ends_at',d.shift_ends_at,
      'area_label',d.area_label,'role_name',role.display_name,
      'site_name',s.name,'reporting_point',d.reporting_point,
      'attendance',private.attendance_summary_site_09b(a.id,a.person_id,false)) as item
    from public.site_shift_allocations a
    join public.site_shift_demands d on d.id=a.demand_id
    join public.site_services sv on sv.id=d.service_id
    join public.sites s on s.id=sv.site_id
    join public.people p on p.id=a.person_id
    join public.operational_role_definitions role on role.id=d.role_id
    where sv.id=p_service and (p_demand is null or d.id=p_demand)
      and (a.status in ('ALLOCATED','ACCEPTED') or exists(
        select 1 from public.attendance_cases c where c.site_shift_allocation_id=a.id))
  ), page as (select * from scoped order by report_at desc,id desc offset p_offset limit p_limit)
  select jsonb_build_object('total',(select count(*) from scoped),
    'items',coalesce((select jsonb_agg(item order by report_at desc,id desc) from page),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.attendance_site_overview_09b(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.attendance_site_overview_09b(uuid,uuid,integer,integer) to authenticated;

notify pgrst,'reload schema';
