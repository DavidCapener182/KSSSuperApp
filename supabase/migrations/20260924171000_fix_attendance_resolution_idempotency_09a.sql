-- Reject altered payloads when a manager retries a committed late-arrival resolution.
create or replace function public.attendance_manager_resolve_no_show(
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
    select * into checkin from public.attendance_events where resolution_event_id=prior.id and event_type='CHECK_IN';
    if prior.event_type<>'CORRECTION' or prior.corrects_event_id<>p_no_show_event
      or prior.correction_code<>'RESOLVE_NO_SHOW_FOR_CHECK_IN' or prior.reason is distinct from trim(p_reason)
      or checkin.id is null or checkin.actual_at is distinct from p_actual_at then
      raise exception 'Attendance idempotency conflict';
    end if;
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

-- Keep free-text operational reason notes in the manager projection only.
create function private.attendance_summary_staff_09a(p_allocation uuid,p_person uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare projection jsonb;
begin
  projection:=private.attendance_summary_09a(p_allocation,p_person);
  return (projection-'events') || jsonb_build_object('events',coalesce((
    select jsonb_agg(item-'reason' order by ordinality)
    from jsonb_array_elements(coalesce(projection->'events','[]'::jsonb)) with ordinality as e(item,ordinality)
  ),'[]'::jsonb));
end $$;
revoke all on function private.attendance_summary_staff_09a(uuid,uuid) from public,anon,authenticated;

create or replace function public.my_event_attendance(p_offset integer default 0,p_limit integer default 25)
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
  ), page as (select * from scoped order by report_at desc,id desc offset p_offset limit p_limit)
  select jsonb_build_object('total',(select count(*) from scoped),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'allocation_id',p.id,'status',p.status,'allocation_revision',p.allocation_revision,
      'service_date',p.service_date,'report_at',p.report_at,'shift_starts_at',p.shift_starts_at,
      'shift_ends_at',p.shift_ends_at,'area_label',p.area_label,'role_name',p.role_name,
      'event_name',p.event_name,'event_status',p.event_status,'site_name',p.site_name,
      'reporting_point',p.reporting_point,'attendance',private.attendance_summary_staff_09a(p.id,p.person_id))
      order by p.report_at desc,p.id desc) from page p),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.my_event_attendance(integer,integer) from public,anon,authenticated;
grant execute on function public.my_event_attendance(integer,integer) to authenticated;
