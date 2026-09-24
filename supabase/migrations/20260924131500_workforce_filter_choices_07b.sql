-- TASK-07B: safe week filter choices after the main read projection.
create function public.workforce_filter_choices(p_week date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_week is null or extract(isodow from p_week)<>1
  or p_week<date '2020-01-01' or p_week>current_date+interval '2 years'
  then raise exception 'Workforce filters denied'; end if;
 with scoped as materialized (
  select distinct e.id as event_id,e.name as event_name,s.id as site_id,s.name as site_name,
   o.name as client_name,rd.id as role_id,rd.display_name as role_name,
   p.id as owner_id,p.display_name as owner_name
  from public.event_staffing_requirements r join public.operational_events e on e.id=r.event_id
  join public.sites s on s.id=e.site_id join public.crm_organisations o on o.id=e.organisation_id
  join public.operational_role_definitions rd on rd.id=r.role_id
  join public.people p on p.id=e.owner_person_id
  where r.state='PLANNED' and e.status in ('PLANNING','CONFIRMED','LIVE')
   and r.service_date>=p_week and r.service_date<p_week+7
 )
 select jsonb_build_object(
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',event_id,'name',event_name) order by event_name,event_id)
    from (select distinct event_id,event_name from scoped) q),'[]'::jsonb),
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
revoke all on function public.workforce_filter_choices(date) from public,anon,authenticated;
grant execute on function public.workforce_filter_choices(date) to authenticated;
