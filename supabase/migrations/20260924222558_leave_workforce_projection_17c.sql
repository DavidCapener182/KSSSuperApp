-- TASK-17C: safe factual approved-time-away conflict; no leave category or request identity.
create or replace function public.workforce_week_08a(p_week date,p_event uuid default null,p_site uuid default null,
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
   private.person_allocation_overlap_08a(a.person_id,r.report_at,r.shift_ends_at,a.id,null) as clash,
   private.approved_time_away_overlap_17c(a.person_id,r.report_at,r.shift_ends_at) as leave_conflict
  from public.event_staff_allocations a join scoped r on r.source='EVENT' and r.requirement_id=a.requirement_id
   join public.people p on p.id=a.person_id where a.status in ('ALLOCATED','ACCEPTED')
  union all
  select 'SITE_SHIFT'::text,a.id,a.demand_id,a.person_id,a.status,p.display_name,
   private.availability_assessment_07a(a.person_id,r.report_at,r.shift_ends_at),
   private.availability_allocation_indicator_07a(a.person_id,r.report_at,r.shift_ends_at),
   private.person_allocation_overlap_08a(a.person_id,r.report_at,r.shift_ends_at,null,a.id),
   private.approved_time_away_overlap_17c(a.person_id,r.report_at,r.shift_ends_at)
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
   count(a.id) filter(where a.leave_conflict)::integer as approved_time_away_conflicts,
   coalesce(jsonb_agg(jsonb_build_object('id',a.id,'person_id',a.person_id,'person_name',a.person_name,
    'status',a.status,'availability',a.availability,'availability_conflict',a.conflict,'allocation_clash',a.clash,
    'approved_time_away_conflict',a.leave_conflict)
    order by a.person_name,a.id) filter(where a.id is not null),'[]'::jsonb) as allocations
  from scoped r left join active a on a.source=r.source and a.requirement_id=r.requirement_id
  group by r.source,r.requirement_id,r.event_id,r.service_id,r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,
   r.required_quantity,r.area_label,r.revision,r.role_name,r.role_code,r.event_name,r.event_status,
   r.site_id,r.organisation_id,r.owner_person_id,r.site_name,r.client_name
 ), filtered as materialized (
  select *,required_quantity-allocated as remaining from lines
  where (not coalesce(p_gaps,false) or required_quantity>allocated)
   and (not coalesce(p_conflicts,false) or unavailable_conflicts+coverage_conflicts+approved_time_away_conflicts>0)
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
   'allocation_clashes',coalesce(sum(clashes),0),
   'approved_time_away_conflicts',coalesce(sum(approved_time_away_conflicts),0)) from filtered),
  'items',coalesce((select jsonb_agg(to_jsonb(page) order by service_date,report_at,source,requirement_id)
   from page),'[]'::jsonb)) into result;
 return result;
end $$;

create or replace function public.workforce_person_week_08a(p_person uuid,p_week date,p_offset integer default 0,p_limit integer default 30)
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
   private.availability_allocation_indicator_07a(a.person_id,r.report_at,r.shift_ends_at) as availability_conflict,
   private.approved_time_away_overlap_17c(a.person_id,r.report_at,r.shift_ends_at) as approved_time_away_conflict
  from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
   join public.operational_events e on e.id=r.event_id join public.sites s on s.id=e.site_id
   join public.operational_role_definitions rd on rd.id=r.role_id
  where a.person_id=p_person and a.status in ('ALLOCATED','ACCEPTED') and r.state='PLANNED'
   and e.status in ('PLANNING','CONFIRMED','LIVE') and r.service_date>=p_week and r.service_date<p_week+7
  union all
  select 'SITE_SHIFT'::text,a.id,a.status,null::uuid,d.id,sv.id,sv.site_id,d.service_date,d.report_at,
   d.shift_starts_at,d.shift_ends_at,d.area_label,rd.display_name,sv.name,s.name,
   private.availability_assessment_07a(a.person_id,d.report_at,d.shift_ends_at),
   private.availability_allocation_indicator_07a(a.person_id,d.report_at,d.shift_ends_at),
   private.approved_time_away_overlap_17c(a.person_id,d.report_at,d.shift_ends_at)
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
