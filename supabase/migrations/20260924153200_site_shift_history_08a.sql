-- Add exact Site route identity to mixed manager Person view.
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

create function public.site_service_history(p_site uuid,p_service uuid,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_offset is null or p_offset<0 or p_offset>10000 or
  p_limit is null or p_limit<1 or p_limit>100 or
  not exists(select 1 from public.site_services where id=p_service and site_id=p_site)
  then raise exception 'Service history denied'; end if;
 with entries as materialized (
  select 'SERVICE'::text as source,e.service_id as record_id,e.kind,e.new_revision as revision,
   e.occurred_at,e.actor_person_id,e.reason,e.snapshot
  from public.site_service_events e where e.service_id=p_service
  union all
  select 'TEMPLATE',e.line_id,e.kind,v.version,e.occurred_at,e.actor_person_id,e.reason,
   jsonb_build_object('version_id',e.version_id,'effective_on',e.effective_on)
  from public.site_shift_template_events e join public.site_shift_template_versions v on v.id=e.version_id
  where v.service_id=p_service
  union all
  select 'DATED_SHIFT',e.demand_id,e.kind,e.revision,e.occurred_at,e.actor_person_id,e.reason,e.snapshot
  from public.site_shift_demand_events e where e.service_id=p_service
  union all
  select 'ALLOCATION',e.allocation_id,e.kind,e.new_revision,e.occurred_at,e.actor_person_id,null::text,
   jsonb_build_object('demand_id',e.demand_id,'status',e.new_status)
  from public.site_shift_allocation_events e join public.site_shift_demands d on d.id=e.demand_id
  where d.service_id=p_service
 ), page as (
  select e.*,p.display_name as actor_name from entries e join public.people p on p.id=e.actor_person_id
  order by e.occurred_at desc,e.source,e.record_id offset p_offset limit p_limit
 )
 select jsonb_build_object('total',(select count(*) from entries),
  'items',coalesce((select jsonb_agg(to_jsonb(page) order by occurred_at desc,source,record_id) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.site_service_history(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.site_service_history(uuid,uuid,integer,integer) to authenticated;
