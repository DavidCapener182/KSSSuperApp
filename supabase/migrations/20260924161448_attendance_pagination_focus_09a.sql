drop function public.my_event_attendance(integer,integer);

create function public.my_event_attendance(
  p_offset integer default 0,
  p_limit integer default 25,
  p_allocation_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_person_id();
  result jsonb;
begin
  if actor is null
    or not private.has_active_role('SECURITY_STAFF')
    or p_offset is null or p_offset < 0 or p_offset > 10000
    or p_limit is null or p_limit < 1 or p_limit > 50
    or (p_allocation_id is not null and p_offset <> 0) then
    raise exception 'Attendance self read denied';
  end if;

  with scoped as materialized (
    select
      a.id, a.person_id, a.status, a.revision as allocation_revision,
      r.service_date, r.report_at, r.shift_starts_at, r.shift_ends_at, r.area_label,
      role.display_name as role_name,
      e.name as event_name, e.status as event_status,
      s.name as site_name, s.reporting_point,
      att.attendance,
      case
        when a.status = 'ACCEPTED'
          and att.attendance->>'check_in_at' is null
          and not coalesce((att.attendance->>'no_show_recorded')::boolean, false) then 0
        when att.attendance->>'check_in_at' is not null
          and att.attendance->>'check_out_at' is null
          and a.status in ('ACCEPTED', 'CANCELLED') then 1
        when a.status = 'ALLOCATED' then 2
        else 3
      end as action_priority
    from public.event_staff_allocations a
    join public.event_staffing_requirements r on r.id = a.requirement_id
    join public.operational_role_definitions role on role.id = r.role_id
    join public.operational_events e on e.id = r.event_id
    join public.sites s on s.id = e.site_id
    cross join lateral (
      select private.attendance_summary_staff_09a(a.id, a.person_id) as attendance
    ) att
    where a.person_id = actor
      and a.status in ('ALLOCATED', 'ACCEPTED', 'CANCELLED')
      and (p_allocation_id is null or a.id = p_allocation_id)
  ), page as (
    select * from scoped
    order by action_priority, report_at desc, id desc
    offset p_offset limit p_limit
  )
  select jsonb_build_object(
    'total', (select count(*) from scoped),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'allocation_id', p.id,
        'status', p.status,
        'allocation_revision', p.allocation_revision,
        'service_date', p.service_date,
        'report_at', p.report_at,
        'shift_starts_at', p.shift_starts_at,
        'shift_ends_at', p.shift_ends_at,
        'area_label', p.area_label,
        'role_name', p.role_name,
        'event_name', p.event_name,
        'event_status', p.event_status,
        'site_name', p.site_name,
        'reporting_point', p.reporting_point,
        'attendance', p.attendance
      ) order by p.action_priority, p.report_at desc, p.id desc)
      from page p
    ), '[]'::jsonb)
  ) into result;

  return result;
end $$;

revoke all on function public.my_event_attendance(integer,integer,uuid) from public, anon, authenticated;
grant execute on function public.my_event_attendance(integer,integer,uuid) to authenticated;
notify pgrst, 'reload schema';
