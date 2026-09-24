-- Add scoped expected-occurrence coverage to the reporting read.
create function private.reporting_missing_materialisation_23b(
 p_start date,p_end date,p_client uuid,p_site uuid,p_service uuid)
returns integer language sql stable security definer set search_path = '' as $$
 select count(*)::integer from public.site_shift_template_versions t
 join public.site_services sv on sv.id=t.service_id
 join public.sites s on s.id=sv.site_id
 cross join lateral generate_series(greatest(p_start,sv.effective_from,t.effective_from),
  least(p_end,coalesce(sv.effective_until,p_end),coalesce(t.effective_until,p_end)) - 1,interval '1 day') day_value
 where private.crm_authorised() and sv.state in ('ACTIVE','PAUSED')
  and (private.has_active_role('SUPER_ADMIN') or s.created_by_person_id=private.current_person_id())
  and (p_client is null or sv.organisation_id=p_client) and (p_site is null or sv.site_id=p_site)
  and (p_service is null or sv.id=p_service)
  and array_position(t.weekdays,extract(isodow from day_value)::integer) is not null
  and not exists(select 1 from public.site_service_pauses pause
   where pause.service_id=sv.id and day_value::date>=pause.starts_on and day_value::date<pause.ends_before)
  and not exists(select 1 from public.site_shift_demands d
   where d.template_line_id=t.line_id and d.service_date=day_value::date)
$$;
revoke all on function private.reporting_missing_materialisation_23b(date,date,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.management_report_23b(
 p_start date,p_end date,p_mode text default 'CURRENT',p_client uuid default null,p_site uuid default null,
 p_service uuid default null,p_event uuid default null,p_source text default null,
 p_offset integer default 0,p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare report_json jsonb; as_of timestamptz := transaction_timestamp(); today_london date := (transaction_timestamp() at time zone 'Europe/London')::date;
begin
 if not private.crm_authorised() or p_start is null or p_end is null or p_start < date '2020-01-01'
  or p_end <= p_start or p_end > p_start + 90 or p_mode not in ('CURRENT','HISTORICAL')
  or (p_source is not null and p_source not in ('EVENT','SITE_SHIFT'))
  or p_offset is null or p_offset < 0 or p_offset > 10000 or p_limit is null or p_limit < 1 or p_limit > 50
 then raise exception 'Management report denied'; end if;

 -- Unknown or inaccessible filter identities have one indistinguishable denial.
 if (p_client is not null and not exists(select 1 from public.crm_organisations where id=p_client and relationship_status='CLIENT'))
  or (p_site is not null and not exists(select 1 from public.sites s where s.id=p_site
   and (private.has_active_role('SUPER_ADMIN') or s.created_by_person_id=private.current_person_id())))
  or (p_service is not null and not exists(select 1 from public.site_services sv join public.sites s on s.id=sv.site_id
   where sv.id=p_service and (private.has_active_role('SUPER_ADMIN') or s.created_by_person_id=private.current_person_id())))
  or (p_event is not null and not exists(select 1 from public.operational_events e join public.sites s on s.id=e.site_id
   where e.id=p_event and (private.has_active_role('SUPER_ADMIN') or s.created_by_person_id=private.current_person_id())))
 then raise exception 'Management report denied'; end if;

 if p_mode='HISTORICAL' then
  return jsonb_build_object('mode','HISTORICAL','period_start',p_start,'period_end',p_end,'data_as_of',as_of,
   'status','Historical snapshot unavailable',
   'reason','No complete cross-source point-in-time reconstruction is accepted for these definitions',
   'definitions',(select jsonb_object_agg(measure_code,definition_version) from public.reporting_measure_definitions_23b));
 end if;

 with scoped as materialized (
  select 'EVENT'::text source,r.id source_id,e.id parent_id,null::uuid service_id,
   e.organisation_id client_id,e.site_id,r.service_date,r.report_at,r.state source_state,
   r.required_quantity,e.name parent_name,s.name site_name,o.name client_name
  from public.event_staffing_requirements r join public.operational_events e on e.id=r.event_id
   join public.sites s on s.id=e.site_id join public.crm_organisations o on o.id=e.organisation_id
  where r.state='PLANNED' and e.status in ('PLANNING','CONFIRMED','LIVE')
   and (private.has_active_role('SUPER_ADMIN') or s.created_by_person_id=private.current_person_id())
   and r.service_date>=p_start and r.service_date<p_end
   and (p_client is null or e.organisation_id=p_client) and (p_site is null or e.site_id=p_site)
   and (p_service is null) and (p_event is null or e.id=p_event)
   and (p_source is null or p_source='EVENT')
  union all
  select 'SITE_SHIFT',d.id,sv.id,sv.id,sv.organisation_id,sv.site_id,d.service_date,d.report_at,d.state,
   d.required_quantity,sv.name,s.name,o.name
  from public.site_shift_demands d join public.site_services sv on sv.id=d.service_id
   join public.sites s on s.id=sv.site_id join public.crm_organisations o on o.id=sv.organisation_id
  where d.state='PLANNED' and sv.state in ('ACTIVE','PAUSED')
   and (private.has_active_role('SUPER_ADMIN') or s.created_by_person_id=private.current_person_id())
   and d.service_date>=p_start and d.service_date<p_end
   and (p_client is null or sv.organisation_id=p_client) and (p_site is null or sv.site_id=p_site)
   and (p_service is null or sv.id=p_service) and p_event is null
   and (p_source is null or p_source='SITE_SHIFT')
 ), active as materialized (
  select 'EVENT'::text source,a.requirement_id source_id,a.id,a.status,
   private.availability_assessment_07a(a.person_id,r.report_at,r.shift_ends_at) availability,
   private.availability_allocation_indicator_07a(a.person_id,r.report_at,r.shift_ends_at) conflict
  from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
   join scoped x on x.source='EVENT' and x.source_id=a.requirement_id
  where a.status in ('ALLOCATED','ACCEPTED')
  union all
  select 'SITE_SHIFT',a.demand_id,a.id,a.status,
   private.availability_assessment_07a(a.person_id,d.report_at,d.shift_ends_at),
   private.availability_allocation_indicator_07a(a.person_id,d.report_at,d.shift_ends_at)
  from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
   join scoped x on x.source='SITE_SHIFT' and x.source_id=a.demand_id
  where a.status in ('ALLOCATED','ACCEPTED')
 ), lines as materialized (
  select x.source,x.source_id,x.parent_id,x.service_id,x.client_id,x.site_id,x.service_date,x.report_at,
   x.source_state,x.parent_name,x.site_name,x.client_name,x.required_quantity required,
   count(a.id)::integer allocated,count(a.id) filter(where a.status='ACCEPTED')::integer accepted,
   greatest(x.required_quantity-count(a.id),0)::integer remaining,
   count(a.id) filter(where a.conflict='UNAVAILABLE_CONFLICT')::integer unavailable_conflicts,
   count(a.id) filter(where a.conflict='COVERAGE_NO_LONGER_DECLARED')::integer removed_coverage_conflicts,
   count(a.id) filter(where a.availability='NOT_DECLARED')::integer missing_declarations,
   count(a.id) filter(where a.availability='NOT_FULLY_COVERED')::integer partial_coverage
  from scoped x left join active a on a.source=x.source and a.source_id=x.source_id
  group by x.source,x.source_id,x.parent_id,x.service_id,x.client_id,x.site_id,x.service_date,x.report_at,
   x.source_state,x.parent_name,x.site_name,x.client_name,x.required_quantity
 ), page as (
  select *,1 as definition_version from lines order by service_date,report_at,source,source_id offset p_offset limit p_limit
 ), grouped as (
  select client_id,client_name,site_id,site_name,parent_id,parent_name,service_date,source,
   sum(required) required,sum(allocated) allocated,sum(accepted) accepted,sum(remaining) remaining
  from lines group by client_id,client_name,site_id,site_name,parent_id,parent_name,service_date,source
 ), visible_clients as (
  select distinct client_id from lines union select o.id from public.crm_organisations o
  where o.relationship_status='CLIENT' and p_site is null and p_service is null and p_event is null and p_source is null
   and (p_client is null or o.id=p_client)
 ), visible_sites as (
  select distinct site_id from lines union select s.id from public.sites s
  where p_service is null and p_event is null and p_source is null and
   (private.has_active_role('SUPER_ADMIN') or s.created_by_person_id=private.current_person_id()) and
   (p_site is null or s.id=p_site) and (p_client is null or exists
    (select 1 from public.site_client_links l where l.site_id=s.id and l.organisation_id=p_client))
 ), visible_services as (
  select distinct service_id id from lines where service_id is not null union select sv.id from public.site_services sv
   join public.sites s on s.id=sv.site_id
  where p_event is null and (p_source is null or p_source='SITE_SHIFT')
   and (private.has_active_role('SUPER_ADMIN') or s.created_by_person_id=private.current_person_id())
   and (p_client is null or sv.organisation_id=p_client) and (p_site is null or sv.site_id=p_site)
   and (p_service is null or sv.id=p_service)
 ), visible_events as (
  select distinct parent_id id from lines where source='EVENT' union select e.id from public.operational_events e
   join public.sites s on s.id=e.site_id
  where p_service is null and (p_source is null or p_source='EVENT')
   and (private.has_active_role('SUPER_ADMIN') or s.created_by_person_id=private.current_person_id())
   and (p_client is null or e.organisation_id=p_client) and (p_site is null or e.site_id=p_site)
   and (p_event is null or e.id=p_event)
 ), estate as (
  select jsonb_build_object(
   'clients',coalesce((select jsonb_object_agg(relationship_status,n) from
    (select o.relationship_status,count(*) n from public.crm_organisations o join visible_clients v on v.client_id=o.id group by o.relationship_status) q),'{}'::jsonb),
   'sites',coalesce((select jsonb_object_agg(status,n) from
    (select s.status,count(*) n from public.sites s join visible_sites v on v.site_id=s.id group by s.status) q),'{}'::jsonb),
   'services',coalesce((select jsonb_object_agg(state,n) from
    (select sv.state,count(*) n from public.site_services sv join visible_services v on v.id=sv.id group by sv.state) q),'{}'::jsonb),
   'events',coalesce((select jsonb_object_agg(status,n) from
    (select e.status,count(*) n from public.operational_events e join visible_events v on v.id=e.id group by e.status) q),'{}'::jsonb)) result
 ), coverage as (
  select jsonb_build_object('status',case
   when p_source='EVENT' or p_event is not null then 'NOT_APPLICABLE'
   when p_start<today_london or p_end>today_london+(select horizon_weeks*7 from public.site_shift_settings where singleton)
    then 'INCOMPLETE_SOURCE_COVERAGE'
   when coalesce((select state from private.site_shift_maintenance_runs_08d order by started_at desc,id desc limit 1),'NONE')<>'SUCCEEDED'
    then 'INCOMPLETE_SOURCE_COVERAGE'
   when coalesce((select completed_at from private.site_shift_maintenance_runs_08d order by started_at desc,id desc limit 1),'-infinity'::timestamptz)<as_of-interval '36 hours'
    then 'INCOMPLETE_SOURCE_COVERAGE'
   when private.reporting_missing_materialisation_23b(p_start,p_end,p_client,p_site,p_service)>0
    then 'INCOMPLETE_SOURCE_COVERAGE'
   else 'CURRENT_HORIZON_REPORTED' end,
   'latest_run_state',(select state from private.site_shift_maintenance_runs_08d order by started_at desc,id desc limit 1),
   'latest_run_at',(select completed_at from private.site_shift_maintenance_runs_08d order by started_at desc,id desc limit 1),
   'note','08D run and horizon status; missing dated source rows are never treated as zero demand') result
 )
 select jsonb_build_object('mode','CURRENT','period_start',p_start,'period_end',p_end,'data_as_of',as_of,
  'definitions',(select jsonb_object_agg(measure_code,definition_version) from public.reporting_measure_definitions_23b),
  'estate_current_state',(select result from estate),'static_coverage',(select result from coverage),
  'total_lines',(select count(*) from lines),
  'totals',(select jsonb_build_object('required',coalesce(sum(required),0),'allocated',coalesce(sum(allocated),0),
   'accepted',coalesce(sum(accepted),0),'remaining',coalesce(sum(remaining),0),
   'unavailable_conflicts',coalesce(sum(unavailable_conflicts),0),
   'removed_coverage_conflicts',coalesce(sum(removed_coverage_conflicts),0),
   'missing_declarations',coalesce(sum(missing_declarations),0),'partial_coverage',coalesce(sum(partial_coverage),0)) from lines),
  'breakdowns',coalesce((select jsonb_agg(to_jsonb(g) order by client_name,site_name,parent_name,service_date,source)
   from grouped g),'[]'::jsonb),
  'lines',coalesce((select jsonb_agg(to_jsonb(page) order by service_date,report_at,source,source_id) from page),'[]'::jsonb),
  'filters',jsonb_build_object(
   'clients',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name,o.id)
    from public.crm_organisations o join visible_clients v on v.client_id=o.id),'[]'::jsonb),
   'sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name,s.id)
    from public.sites s join visible_sites v on v.site_id=s.id),'[]'::jsonb),
   'services',coalesce((select jsonb_agg(jsonb_build_object('id',sv.id,'name',sv.name) order by sv.name,sv.id)
    from public.site_services sv join visible_services v on v.id=sv.id),'[]'::jsonb),
   'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name) order by e.name,e.id)
    from public.operational_events e join visible_events v on v.id=e.id),'[]'::jsonb))) into report_json;
 return report_json;
end $$;
revoke all on function public.management_report_23b(date,date,text,uuid,uuid,uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.management_report_23b(date,date,text,uuid,uuid,uuid,uuid,text,integer,integer) to authenticated;
