-- TASK-07B: treat a selected Client label literally in Workforce filters.
create or replace function public.workforce_week(p_week date,p_event uuid default null,p_site uuid default null,
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
  select r.id as requirement_id,r.event_id,r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,
   r.required_quantity,r.area_label,r.revision,rd.display_name as role_name,rd.code as role_code,
   e.name as event_name,e.status as event_status,e.site_id,e.organisation_id,e.owner_person_id,
   s.name as site_name,o.name as client_name
  from public.event_staffing_requirements r
  join public.operational_events e on e.id=r.event_id
  join public.sites s on s.id=e.site_id
  join public.crm_organisations o on o.id=e.organisation_id
  join public.operational_role_definitions rd on rd.id=r.role_id
  where r.state='PLANNED' and e.status in ('PLANNING','CONFIRMED','LIVE')
   and r.service_date>=p_week and r.service_date<p_week+7
   and (p_event is null or e.id=p_event) and (p_site is null or e.site_id=p_site)
   and (p_role is null or r.role_id=p_role) and (p_owner is null or e.owner_person_id=p_owner)
   and (nullif(trim(p_client),'') is null or o.name=trim(p_client))
 ), active as materialized (
  select a.id,a.requirement_id,a.person_id,a.status,p.display_name as person_name,
   private.availability_assessment_07a(a.person_id,r.report_at,r.shift_ends_at) as availability,
   private.availability_allocation_indicator_07a(a.person_id,r.report_at,r.shift_ends_at) as conflict,
   exists(select 1 from public.event_staff_allocations other_a
    join public.event_staffing_requirements other_r on other_r.id=other_a.requirement_id
    join public.operational_events other_e on other_e.id=other_r.event_id
    where other_a.person_id=a.person_id and other_a.id<>a.id
     and other_a.status in ('ALLOCATED','ACCEPTED') and other_r.state='PLANNED'
     and other_e.status in ('PLANNING','CONFIRMED','LIVE')
     and other_r.report_at<r.shift_ends_at and r.report_at<other_r.shift_ends_at) as clash
  from public.event_staff_allocations a join scoped r on r.requirement_id=a.requirement_id
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
  from scoped r left join active a on a.requirement_id=r.requirement_id
  group by r.requirement_id,r.event_id,r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,
   r.required_quantity,r.area_label,r.revision,r.role_name,r.role_code,r.event_name,r.event_status,
   r.site_id,r.organisation_id,r.owner_person_id,r.site_name,r.client_name
 ), filtered as materialized (
  select *,required_quantity-allocated as remaining from lines
  where (not coalesce(p_gaps,false) or required_quantity>allocated)
   and (not coalesce(p_conflicts,false) or unavailable_conflicts+coverage_conflicts>0)
 ), page as (
  select * from filtered order by service_date,report_at,event_id,requirement_id offset p_offset limit p_limit
 )
 select jsonb_build_object('week_start',p_week,'total_lines',(select count(*) from filtered),
  'totals',(select jsonb_build_object('events',count(distinct event_id),
   'required',coalesce(sum(required_quantity),0),'allocated',coalesce(sum(allocated),0),
   'remaining',coalesce(sum(remaining),0),'accepted',coalesce(sum(accepted),0),
   'gap_lines',count(*) filter(where remaining>0),
   'availability_conflicts',coalesce(sum(unavailable_conflicts+coverage_conflicts),0),
   'unavailable_conflicts',coalesce(sum(unavailable_conflicts),0),
   'coverage_conflicts',coalesce(sum(coverage_conflicts),0),
   'allocation_clashes',coalesce(sum(clashes),0)) from filtered),
  'items',coalesce((select jsonb_agg(to_jsonb(page) order by service_date,report_at,event_id,requirement_id)
   from page),'[]'::jsonb)) into result;
 return result;
end $$;
