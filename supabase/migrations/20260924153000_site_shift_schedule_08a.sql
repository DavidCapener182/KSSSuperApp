-- TASK-08A combined read projections. One guarded Workforce and Staff experience; source identities stay exact.
select set_config('kss.write_06b','allowed',true);
insert into public.operational_role_definitions(code,display_name,description)
 values('SECURITY_GUARD','Security Guard','Operational role only; qualification policy is not configured')
 on conflict(code) do nothing;

create function public.workforce_week_08a(p_week date,p_event uuid default null,p_site uuid default null,
 p_client text default null,p_role uuid default null,p_owner uuid default null,
 p_gaps boolean default false,p_conflicts boolean default false,p_offset integer default 0,p_limit integer default 40)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_week is null or extract(isodow from p_week)<>1
  or p_week<date '2020-01-01' or p_week>current_date+interval '2 years'
  or p_limit is null or p_limit<1 or p_limit>80 or p_offset is null or p_offset<0 or p_offset>10000
  or length(coalesce(p_client,''))>80 or coalesce(p_client,'') ~ '[[:cntrl:]]'
  then raise exception 'Workforce read denied'; end if;
 with scoped as materialized (
  select 'EVENT'::text as source,r.id as requirement_id,r.event_id,null::uuid as service_id,
   r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,r.required_quantity,r.area_label,r.revision,
   rd.display_name as role_name,rd.code as role_code,e.name as event_name,e.status as event_status,
   e.site_id,e.organisation_id,e.owner_person_id,s.name as site_name,o.name as client_name
  from public.event_staffing_requirements r join public.operational_events e on e.id=r.event_id
  join public.sites s on s.id=e.site_id join public.crm_organisations o on o.id=e.organisation_id
  join public.operational_role_definitions rd on rd.id=r.role_id
  where r.state='PLANNED' and e.status in ('PLANNING','CONFIRMED','LIVE')
   and r.service_date>=p_week and r.service_date<p_week+7
   and (p_event is null or e.id=p_event) and (p_site is null or e.site_id=p_site)
   and (p_role is null or r.role_id=p_role) and (p_owner is null or e.owner_person_id=p_owner)
   and (nullif(trim(p_client),'') is null or o.name=trim(p_client))
  union all
  select 'SITE_SHIFT'::text,d.id,null::uuid,sv.id,d.service_date,d.report_at,d.shift_starts_at,d.shift_ends_at,
   d.required_quantity,d.area_label,d.revision,rd.display_name,rd.code,sv.name,sv.state,
   sv.site_id,sv.organisation_id,sv.owner_person_id,s.name,o.name
  from public.site_shift_demands d join public.site_services sv on sv.id=d.service_id
  join public.sites s on s.id=sv.site_id join public.crm_organisations o on o.id=sv.organisation_id
  join public.operational_role_definitions rd on rd.id=d.role_id
  where d.state='PLANNED' and sv.state in ('ACTIVE','PAUSED')
   and d.service_date>=p_week and d.service_date<p_week+7
   and (p_event is null) and (p_site is null or sv.site_id=p_site)
   and (p_role is null or d.role_id=p_role) and (p_owner is null or sv.owner_person_id=p_owner)
   and (nullif(trim(p_client),'') is null or o.name=trim(p_client))
 ), active as materialized (
  select 'EVENT'::text as source,a.id,a.requirement_id,a.person_id,a.status,p.display_name as person_name,
   private.availability_assessment_07a(a.person_id,r.report_at,r.shift_ends_at) as availability,
   private.availability_allocation_indicator_07a(a.person_id,r.report_at,r.shift_ends_at) as conflict,
   private.person_allocation_overlap_08a(a.person_id,r.report_at,r.shift_ends_at,a.id,null) as clash
  from public.event_staff_allocations a join scoped r on r.source='EVENT' and r.requirement_id=a.requirement_id
   join public.people p on p.id=a.person_id where a.status in ('ALLOCATED','ACCEPTED')
  union all
  select 'SITE_SHIFT'::text,a.id,a.demand_id,a.person_id,a.status,p.display_name,
   private.availability_assessment_07a(a.person_id,r.report_at,r.shift_ends_at),
   private.availability_allocation_indicator_07a(a.person_id,r.report_at,r.shift_ends_at),
   private.person_allocation_overlap_08a(a.person_id,r.report_at,r.shift_ends_at,null,a.id)
  from public.site_shift_allocations a join scoped r on r.source='SITE_SHIFT' and r.requirement_id=a.demand_id
   join public.people p on p.id=a.person_id where a.status in ('ALLOCATED','ACCEPTED')
 ), lines as materialized (
  select r.*,count(a.id)::integer as allocated,
   count(a.id) filter(where a.status='ACCEPTED')::integer as accepted,
   count(a.id) filter(where a.conflict='UNAVAILABLE_CONFLICT')::integer as unavailable_conflicts,
   count(a.id) filter(where a.conflict='COVERAGE_NO_LONGER_DECLARED')::integer as coverage_conflicts,
   count(a.id) filter(where a.availability='NOT_DECLARED')::integer as not_declared,
   count(a.id) filter(where a.availability='NOT_FULLY_COVERED')::integer as partial_coverage,
   count(a.id) filter(where a.status='ALLOCATED')::integer as awaiting_response,
   count(a.id) filter(where a.clash)::integer as clashes,
   coalesce(jsonb_agg(jsonb_build_object('id',a.id,'person_id',a.person_id,'person_name',a.person_name,
    'status',a.status,'availability',a.availability,'availability_conflict',a.conflict,'allocation_clash',a.clash)
    order by a.person_name,a.id) filter(where a.id is not null),'[]'::jsonb) as allocations
  from scoped r left join active a on a.source=r.source and a.requirement_id=r.requirement_id
  group by r.source,r.requirement_id,r.event_id,r.service_id,r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,
   r.required_quantity,r.area_label,r.revision,r.role_name,r.role_code,r.event_name,r.event_status,
   r.site_id,r.organisation_id,r.owner_person_id,r.site_name,r.client_name
 ), filtered as materialized (
  select *,required_quantity-allocated as remaining from lines
  where (not coalesce(p_gaps,false) or required_quantity>allocated)
   and (not coalesce(p_conflicts,false) or unavailable_conflicts+coverage_conflicts>0)
 ), page as (
  select * from filtered order by service_date,report_at,source,requirement_id offset p_offset limit p_limit
 )
 select jsonb_build_object('week_start',p_week,
  'static_horizon_covered',p_week+7<=private.uk_today()+(select horizon_weeks*7 from public.site_shift_settings where singleton),
  'total_lines',(select count(*) from filtered),
  'totals',(select jsonb_build_object('events',count(distinct event_id),
   'services',count(distinct service_id),
   'required',coalesce(sum(required_quantity),0),'allocated',coalesce(sum(allocated),0),
   'remaining',coalesce(sum(remaining),0),'accepted',coalesce(sum(accepted),0),
   'gap_lines',count(*) filter(where remaining>0),
   'availability_conflicts',coalesce(sum(unavailable_conflicts+coverage_conflicts),0),
   'unavailable_conflicts',coalesce(sum(unavailable_conflicts),0),
   'coverage_conflicts',coalesce(sum(coverage_conflicts),0),
   'allocation_clashes',coalesce(sum(clashes),0)) from filtered),
  'items',coalesce((select jsonb_agg(to_jsonb(page) order by service_date,report_at,source,requirement_id)
   from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.workforce_week_08a(date,uuid,uuid,text,uuid,uuid,boolean,boolean,integer,integer) from public,anon,authenticated;
grant execute on function public.workforce_week_08a(date,uuid,uuid,text,uuid,uuid,boolean,boolean,integer,integer) to authenticated;

create function public.workforce_person_week_08a(p_person uuid,p_week date,p_offset integer default 0,p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_week is null or extract(isodow from p_week)<>1
  or p_week<date '2020-01-01' or p_week>current_date+interval '2 years'
  or p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50
  then raise exception 'Workforce Person read denied'; end if;
 if not exists(select 1 from public.role_assignments ra where ra.person_id=p_person
  and ra.role_code='SECURITY_STAFF' and ra.revoked_at is null and ra.effective_from<=now()
  and (ra.effective_until is null or ra.effective_until>now())) then return jsonb_build_object('total',0,'items','[]'::jsonb); end if;
 with scoped as materialized (
  select 'EVENT'::text as source,a.id,a.status,r.event_id,r.id as requirement_id,null::uuid as service_id,e.site_id,
   r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,r.area_label,rd.display_name as role_name,
   e.name as event_name,s.name as site_name,
   private.availability_assessment_07a(a.person_id,r.report_at,r.shift_ends_at) as availability,
   private.availability_allocation_indicator_07a(a.person_id,r.report_at,r.shift_ends_at) as availability_conflict
  from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
   join public.operational_events e on e.id=r.event_id join public.sites s on s.id=e.site_id
   join public.operational_role_definitions rd on rd.id=r.role_id
  where a.person_id=p_person and a.status in ('ALLOCATED','ACCEPTED') and r.state='PLANNED'
   and e.status in ('PLANNING','CONFIRMED','LIVE') and r.service_date>=p_week and r.service_date<p_week+7
  union all
  select 'SITE_SHIFT'::text,a.id,a.status,null::uuid,d.id,sv.id,sv.site_id,d.service_date,d.report_at,
   d.shift_starts_at,d.shift_ends_at,d.area_label,rd.display_name,sv.name,s.name,
   private.availability_assessment_07a(a.person_id,d.report_at,d.shift_ends_at),
   private.availability_allocation_indicator_07a(a.person_id,d.report_at,d.shift_ends_at)
  from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
   join public.site_services sv on sv.id=d.service_id join public.sites s on s.id=sv.site_id
   join public.operational_role_definitions rd on rd.id=d.role_id
  where a.person_id=p_person and a.status in ('ALLOCATED','ACCEPTED') and d.state='PLANNED'
   and d.service_date>=p_week and d.service_date<p_week+7
 ), page as (select * from scoped order by service_date,report_at,source,id offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),
  'items',coalesce((select jsonb_agg(to_jsonb(page) order by service_date,report_at,source,id) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.workforce_person_week_08a(uuid,date,integer,integer) from public,anon,authenticated;
grant execute on function public.workforce_person_week_08a(uuid,date,integer,integer) to authenticated;

create function public.my_schedule_08a(p_week date,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb; week_from timestamptz; week_until timestamptz;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_week is null
  or extract(isodow from p_week)<>1 or p_week<date '2020-01-01' or p_week>current_date+interval '2 years'
  or p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50
  then raise exception 'My Schedule denied'; end if;
 week_from:=p_week::timestamp at time zone 'Europe/London';
 week_until:=(p_week+7)::timestamp at time zone 'Europe/London';
 with work as materialized (
  select 'EVENT'::text as source,a.id,a.status,r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,
   r.area_label,rd.display_name as role_name,e.name as event_name,s.name as site_name,s.reporting_point,
   private.availability_assessment_07a(actor,r.report_at,r.shift_ends_at) as availability,
   private.availability_allocation_indicator_07a(actor,r.report_at,r.shift_ends_at) as availability_conflict
  from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
  join public.operational_events e on e.id=r.event_id join public.sites s on s.id=e.site_id
  join public.operational_role_definitions rd on rd.id=r.role_id
  where a.person_id=actor and a.status in ('ALLOCATED','ACCEPTED') and r.state='PLANNED'
   and e.status in ('PLANNING','CONFIRMED','LIVE') and r.service_date>=p_week and r.service_date<p_week+7
  union all
  select 'SITE_SHIFT'::text,a.id,a.status,d.service_date,d.report_at,d.shift_starts_at,d.shift_ends_at,
   d.area_label,rd.display_name,sv.name,s.name,d.reporting_point,
   private.availability_assessment_07a(actor,d.report_at,d.shift_ends_at),
   private.availability_allocation_indicator_07a(actor,d.report_at,d.shift_ends_at)
  from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
   join public.site_services sv on sv.id=d.service_id join public.sites s on s.id=sv.site_id
   join public.operational_role_definitions rd on rd.id=d.role_id
  where a.person_id=actor and a.status in ('ALLOCATED','ACCEPTED') and d.state='PLANNED'
   and d.service_date>=p_week and d.service_date<p_week+7
 ), declarations as materialized (
  select d.id,d.state,d.starts_at,d.ends_at from public.staff_availability_declarations d
  where d.person_id=actor and d.lifecycle='CURRENT' and d.ends_at>week_from and d.starts_at<week_until
 )
 select jsonb_build_object('week_start',p_week,'work_total',(select count(*) from work),
  'work',coalesce((select jsonb_agg(to_jsonb(w) order by w.service_date,w.report_at,w.source,w.id)
   from (select * from work order by service_date,report_at,source,id offset p_offset limit p_limit) w),'[]'::jsonb),
  'availability',coalesce((select jsonb_agg(to_jsonb(d) order by d.starts_at,d.id) from declarations d),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.my_schedule_08a(date,integer,integer) from public,anon,authenticated;
grant execute on function public.my_schedule_08a(date,integer,integer) to authenticated;

create function public.my_deployments_08a(p_offset integer default 0,p_limit integer default 25,p_focus uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_offset is null or p_offset<0 or p_offset>10000
   or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Deployment self read denied'; end if;
 with scoped as materialized (
  select 'EVENT'::text as source,a.id,a.status,a.revision,a.allocated_at,r.service_date,r.report_at,
   r.shift_starts_at,r.shift_ends_at,r.area_label,o.display_name as role_name,e.name as event_name,
   e.status as event_status,s.name as site_name,s.reporting_point,
   case when a.status in ('ALLOCATED','ACCEPTED') then
    private.availability_allocation_indicator_07a(a.person_id,r.report_at,r.shift_ends_at) else null end as availability_conflict,
   case when a.status in ('ALLOCATED','ACCEPTED') and e.status not in ('COMPLETED','CANCELLED') then 0 else 1 end as history_rank
  from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
  join public.operational_role_definitions o on o.id=r.role_id
  join public.operational_events e on e.id=r.event_id join public.sites s on s.id=e.site_id
  where a.person_id=actor and (p_focus is null or a.id=p_focus)
  union all
  select 'SITE_SHIFT'::text,a.id,a.status,a.revision,a.allocated_at,d.service_date,d.report_at,
   d.shift_starts_at,d.shift_ends_at,d.area_label,o.display_name,sv.name,
   d.state,s.name,d.reporting_point,
   case when a.status in ('ALLOCATED','ACCEPTED') then
    private.availability_allocation_indicator_07a(a.person_id,d.report_at,d.shift_ends_at) else null end,
   case when a.status in ('ALLOCATED','ACCEPTED') and d.state='PLANNED' then 0 else 1 end
  from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
  join public.operational_role_definitions o on o.id=d.role_id
  join public.site_services sv on sv.id=d.service_id join public.sites s on s.id=sv.site_id
  where a.person_id=actor and p_focus is null
 ), page as (select * from scoped order by history_rank,report_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),'items',coalesce((select jsonb_agg(to_jsonb(p)-'history_rank'
  order by p.history_rank,p.report_at desc,p.id desc) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.my_deployments_08a(integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.my_deployments_08a(integer,integer,uuid) to authenticated;

create function public.workforce_filter_choices_08a(p_week date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_week is null or extract(isodow from p_week)<>1
  or p_week<date '2020-01-01' or p_week>current_date+interval '2 years'
  then raise exception 'Workforce filters denied'; end if;
 with scoped as materialized (
  select e.id as event_id,e.name as event_name,s.id as site_id,s.name as site_name,
   o.name as client_name,rd.id as role_id,rd.display_name as role_name,
   p.id as owner_id,p.display_name as owner_name
  from public.event_staffing_requirements r join public.operational_events e on e.id=r.event_id
  join public.sites s on s.id=e.site_id join public.crm_organisations o on o.id=e.organisation_id
  join public.operational_role_definitions rd on rd.id=r.role_id join public.people p on p.id=e.owner_person_id
  where r.state='PLANNED' and e.status in ('PLANNING','CONFIRMED','LIVE')
   and r.service_date>=p_week and r.service_date<p_week+7
  union all
  select null::uuid,null::text,s.id,s.name,o.name,rd.id,rd.display_name,p.id,p.display_name
  from public.site_shift_demands d join public.site_services sv on sv.id=d.service_id
  join public.sites s on s.id=sv.site_id join public.crm_organisations o on o.id=sv.organisation_id
  join public.operational_role_definitions rd on rd.id=d.role_id join public.people p on p.id=sv.owner_person_id
  where d.state='PLANNED' and sv.state in ('ACTIVE','PAUSED') and d.service_date>=p_week and d.service_date<p_week+7
 )
 select jsonb_build_object(
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',event_id,'name',event_name) order by event_name,event_id)
    from (select distinct event_id,event_name from scoped where event_id is not null) q),'[]'::jsonb),
  'sites',coalesce((select jsonb_agg(jsonb_build_object('id',site_id,'name',site_name) order by site_name,site_id)
    from (select distinct site_id,site_name from scoped) q),'[]'::jsonb),
  'clients',coalesce((select jsonb_agg(client_name order by client_name)
    from (select distinct client_name from scoped) q),'[]'::jsonb),
  'roles',coalesce((select jsonb_agg(jsonb_build_object('id',role_id,'name',role_name) order by role_name,role_id)
    from (select distinct role_id,role_name from scoped) q),'[]'::jsonb),
  'owners',coalesce((select jsonb_agg(jsonb_build_object('id',owner_id,'name',owner_name) order by owner_name,owner_id)
    from (select distinct owner_id,owner_name from scoped) q),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.workforce_filter_choices_08a(date) from public,anon,authenticated;
grant execute on function public.workforce_filter_choices_08a(date) to authenticated;
