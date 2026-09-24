-- Current Staff work precedes historical test/allocation rows on every page.
create or replace function public.my_deployments(p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_offset is null or p_offset<0 or p_offset>10000
   or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Deployment self read denied'; end if;
 with scoped as materialized (
  select a.id,a.status,a.revision,a.allocated_at,r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,
   r.area_label,o.display_name as role_name,e.name as event_name,e.status as event_status,s.name as site_name,
   s.reporting_point,
   case when a.status in ('ALLOCATED','ACCEPTED') and e.status not in ('COMPLETED','CANCELLED') then 0 else 1 end as history_rank
  from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
  join public.operational_role_definitions o on o.id=r.role_id
  join public.operational_events e on e.id=r.event_id join public.sites s on s.id=e.site_id
  where a.person_id=actor
 ), page as (select * from scoped order by history_rank,report_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),'items',coalesce((select jsonb_agg(to_jsonb(p)-'history_rank'
  order by p.history_rank,p.report_at desc,p.id desc) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
