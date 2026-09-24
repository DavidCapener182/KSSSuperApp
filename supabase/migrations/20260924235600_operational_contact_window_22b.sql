-- TASK-22B: shared exact duty-window predicate for authority and boundary proof.
create or replace function public.contact_duty_window_22b(report_at timestamptz,duty_end timestamptz,at_time timestamptz) returns boolean
 language sql immutable as $$
 select report_at is not null and duty_end is not null and at_time is not null
  and at_time>=report_at-interval '2 hours' and at_time<=duty_end+interval '2 hours'
$$;
create or replace function private.contact_staff_22b(k text,target uuid,allocation uuid,at_time timestamptz) returns boolean
 language sql stable security definer set search_path='' as $$
 select private.has_active_role('SECURITY_STAFF') and case k
 when 'EVENT' then exists(select 1 from public.event_staff_allocations a
  join public.event_staffing_requirements d on d.id=a.requirement_id
  join public.operational_events e on e.id=d.event_id
  where a.id=allocation and a.person_id=private.current_person_id() and a.status='ACCEPTED'
   and d.event_id=target and d.state='PLANNED' and e.status in ('PLANNING','CONFIRMED','LIVE')
   and public.contact_duty_window_22b(d.report_at,d.shift_ends_at,at_time))
 when 'SITE_SERVICE' then exists(select 1 from public.site_shift_allocations a
  join public.site_shift_demands d on d.id=a.demand_id
  join public.site_services x on x.id=d.service_id
  where a.id=allocation and a.person_id=private.current_person_id() and a.status='ACCEPTED'
   and d.service_id=target and d.state='PLANNED' and x.state='ACTIVE'
   and public.contact_duty_window_22b(d.report_at,d.shift_ends_at,at_time))
 when 'SITE' then exists(select 1 from public.site_shift_allocations a
  join public.site_shift_demands d on d.id=a.demand_id
  join public.site_services x on x.id=d.service_id
  where a.id=allocation and a.person_id=private.current_person_id() and a.status='ACCEPTED'
   and x.site_id=target and d.state='PLANNED' and x.state='ACTIVE'
   and public.contact_duty_window_22b(d.report_at,d.shift_ends_at,at_time))
 else false end
$$;
