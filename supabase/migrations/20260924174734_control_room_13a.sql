-- TASK-13A: bounded, read-only operational composition. No source mutation.
create function public.control_room_snapshot_13a(
  p_source text default null, p_site uuid default null, p_offset integer default 0, p_limit integer default 30
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_now timestamptz:=transaction_timestamp(); v_today date:=(transaction_timestamp() at time zone 'Europe/London')::date;
  v_result jsonb; v_incidents jsonb; v_horizon jsonb;
begin
  if not private.operational_authorised() or (p_source is not null and p_source not in ('EVENT','SITE_SHIFT'))
    or p_offset is null or p_offset<0 or p_offset>1000 or p_limit is null or p_limit<1 or p_limit>50 then
    raise exception 'Control Room read denied';
  end if;
  -- Incident scope remains the 12A reviewer rule; no narrative or Person projection.
  if private.incident_current_reviewer_12a(private.current_person_id()) then
    select jsonb_build_object('count',(select count(*) from public.incidents where status<>'CLOSED'),'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',q.id,'status',q.status,'created_at',q.created_at,
      'context_label',private.incident_context_label_12a(q.id)) order by q.created_at desc,q.id) filter(where q.id is not null),'[]'::jsonb))
    into v_incidents from (select id,status,created_at from public.incidents where status<>'CLOSED'
      order by created_at desc,id limit 25) q;
  end if;
  -- Narrow 08D facts only. The detailed administrator run ledger is not exposed.
  select jsonb_build_object('window_until',v_today+(s.horizon_weeks*7),
    'last_success_at',(select max(completed_at) from private.site_shift_maintenance_runs_08d where state='SUCCEEDED'),
    'overdue',coalesce((select max(completed_at) from private.site_shift_maintenance_runs_08d where state='SUCCEEDED'),'-infinity'::timestamptz)<v_now-interval '36 hours',
    'latest_partial',coalesce((select r.state<>'SUCCEEDED' or r.services_failed>0 from private.site_shift_maintenance_runs_08d r order by r.started_at desc limit 1),true))
  into v_horizon from public.site_shift_settings s where s.singleton;
  with contexts as materialized (
    select 'EVENT'::text as source,e.id as source_id,e.id as event_id,null::uuid as service_id,
      e.name as name,s.name as site_name,e.site_id,e.status as source_state,e.event_type as kind,
      e.starts_at as starts_at,e.ends_at as ends_at,null::date as service_date
    from public.operational_events e join public.sites s on s.id=e.site_id
    where (p_source is null or p_source='EVENT') and (p_site is null or e.site_id=p_site)
      and e.status<>'CANCELLED' and (e.status='LIVE' or
      (e.starts_at<v_now+interval '15 days' and e.ends_at>=v_now-interval '7 days'))
    union all
    select 'SITE_SHIFT',sv.id,null::uuid,sv.id,sv.name,s.name,sv.site_id,sv.state,sv.type,
      min(d.report_at),max(d.shift_ends_at),d.service_date
    from public.site_shift_demands d join public.site_services sv on sv.id=d.service_id
      join public.sites s on s.id=sv.site_id
    where (p_source is null or p_source='SITE_SHIFT') and (p_site is null or sv.site_id=p_site)
      and d.state='PLANNED' and sv.state in ('ACTIVE','PAUSED','ENDED')
      and d.service_date>=v_today-7 and d.service_date<=v_today+14
    group by sv.id,sv.name,s.name,sv.site_id,sv.state,sv.type,d.service_date
  ), lines as materialized (
    select c.source,c.source_id,c.service_date,r.id as line_id,r.required_quantity,r.report_at,r.shift_ends_at
    from contexts c join public.event_staffing_requirements r on c.source='EVENT' and r.event_id=c.event_id and r.state='PLANNED'
      and r.service_date>=v_today-7 and r.service_date<=v_today+14
    union all
    select c.source,c.source_id,c.service_date,d.id,d.required_quantity,d.report_at,d.shift_ends_at
    from contexts c join public.site_shift_demands d on c.source='SITE_SHIFT' and d.service_id=c.service_id
      and d.service_date=c.service_date and d.state='PLANNED'
  ), allocations as materialized (
    select l.source,l.source_id,l.service_date,l.line_id,a.id,a.status,
      private.availability_allocation_indicator_07a(a.person_id,l.report_at,l.shift_ends_at) as conflict,
      private.attendance_summary_09a(a.id,a.person_id) as attendance
    from lines l join public.event_staff_allocations a on l.source='EVENT' and a.requirement_id=l.line_id
      and (a.status in ('ALLOCATED','ACCEPTED') or (a.status='CANCELLED' and exists(
        select 1 from public.attendance_cases ac where ac.event_allocation_id=a.id)))
    union all
    select l.source,l.source_id,l.service_date,l.line_id,a.id,a.status,
      private.availability_allocation_indicator_07a(a.person_id,l.report_at,l.shift_ends_at),
      private.attendance_summary_site_09b(a.id,a.person_id,false)
    from lines l join public.site_shift_allocations a on l.source='SITE_SHIFT' and a.demand_id=l.line_id
      and (a.status in ('ALLOCATED','ACCEPTED') or (a.status='CANCELLED' and exists(
        select 1 from public.attendance_cases ac where ac.site_shift_allocation_id=a.id)))
  ), cards as materialized (
    select c.*,case when c.source='EVENT' and c.source_state='LIVE' then 'LIVE_NOW'
      when c.source='SITE_SHIFT' and c.source_state='ACTIVE' and c.starts_at<=v_now and c.ends_at>v_now then 'LIVE_NOW'
      when c.ends_at<v_now or (c.source='EVENT' and c.source_state='COMPLETED') then 'RECENT_OPERATIONS'
      else 'UPCOMING' end as area,
      coalesce((select sum(l.required_quantity) from lines l where l.source=c.source and l.source_id=c.source_id
        and (c.source='EVENT' or l.service_date=c.service_date)),0)::integer as required,
      (select count(*) from allocations a where a.source=c.source and a.source_id=c.source_id
        and (c.source='EVENT' or a.service_date=c.service_date) and a.status in ('ALLOCATED','ACCEPTED'))::integer as allocated,
      (select count(*) from allocations a where a.source=c.source and a.source_id=c.source_id
        and (c.source='EVENT' or a.service_date=c.service_date) and a.status='ACCEPTED')::integer as accepted,
      (select count(*) from allocations a where a.source=c.source and a.source_id=c.source_id
        and (c.source='EVENT' or a.service_date=c.service_date) and a.status='ALLOCATED')::integer as awaiting_response,
      (select count(*) from allocations a where a.source=c.source and a.source_id=c.source_id
        and (c.source='EVENT' or a.service_date=c.service_date)
        and a.status in ('ALLOCATED','ACCEPTED') and a.conflict in ('UNAVAILABLE_CONFLICT','COVERAGE_NO_LONGER_DECLARED'))::integer as conflicts,
      (select count(*) from allocations a where a.source=c.source and a.source_id=c.source_id
        and (c.source='EVENT' or a.service_date=c.service_date) and a.attendance->>'check_in_at' is not null)::integer as checked_in,
      (select count(*) from allocations a where a.source=c.source and a.source_id=c.source_id
        and (c.source='EVENT' or a.service_date=c.service_date)
        and coalesce((a.attendance->>'review_required')::boolean,false))::integer as attendance_reviews,
      (select count(*) from allocations a where a.source=c.source and a.source_id=c.source_id
        and (c.source='EVENT' or a.service_date=c.service_date)
        and coalesce((a.attendance->>'no_show_recorded')::boolean,false))::integer as recorded_no_shows
    from contexts c
  ), page as (select * from cards order by
      case area when 'LIVE_NOW' then 0 when 'UPCOMING' then 1 else 2 end,starts_at,source,source_id,service_date
      offset p_offset limit p_limit)
  select jsonb_build_object('as_of',v_now,'today',v_today,'upcoming_until',v_today+14,
    'recent_from',v_today-7,'source',p_source,'site_id',p_site,'total',(select count(*) from cards),
    'sites',coalesce((select jsonb_agg(jsonb_build_object('id',site_id,'name',site_name) order by site_name,site_id)
      from (select distinct site_id,site_name from contexts) sites),'[]'::jsonb),
    'attention_total',(select count(*) from cards where required>allocated or awaiting_response>0
      or conflicts>0 or attendance_reviews>0 or recorded_no_shows>0),
    'attention',coalesce((select jsonb_agg(to_jsonb(a) order by a.starts_at,a.source,a.source_id)
      from (select * from cards where required>allocated or awaiting_response>0 or conflicts>0
        or attendance_reviews>0 or recorded_no_shows>0
        order by starts_at,source,source_id limit 50) a),'[]'::jsonb),
    'cards',coalesce((select jsonb_agg(to_jsonb(page) order by
      case area when 'LIVE_NOW' then 0 when 'UPCOMING' then 1 else 2 end,starts_at,source,source_id,service_date) from page),'[]'::jsonb),
    'incidents',v_incidents,'horizon',v_horizon) into v_result;
  return v_result;
end $$;
revoke all on function public.control_room_snapshot_13a(text,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.control_room_snapshot_13a(text,uuid,integer,integer) to authenticated;
