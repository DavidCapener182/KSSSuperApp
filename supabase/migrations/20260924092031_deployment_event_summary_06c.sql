-- One authorised factual count read for the Event plan; no Person or private source data.
create function public.deployment_event_summary(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or not exists(select 1 from public.operational_events where id=p_event) then
  raise exception 'Deployment summary denied'; end if;
 with lines as (
  select r.id,r.required_quantity,
    count(a.id) filter(where a.status in ('ALLOCATED','ACCEPTED')) as allocated,
    count(a.id) filter(where a.status='ACCEPTED') as accepted
  from public.event_staffing_requirements r left join public.event_staff_allocations a on a.requirement_id=r.id
  where r.event_id=p_event and r.state='PLANNED' group by r.id
 )
 select jsonb_build_object('required',coalesce(sum(required_quantity),0),
  'allocated',coalesce(sum(allocated),0),'accepted',coalesce(sum(accepted),0),
  'remaining',coalesce(sum(required_quantity-allocated),0),
  'lines',coalesce(jsonb_object_agg(id::text,jsonb_build_object('required',required_quantity,
   'allocated',allocated,'accepted',accepted,'remaining',required_quantity-allocated)),'{}'::jsonb)) into result from lines;
 return result;
end $$;
revoke all on function public.deployment_event_summary(uuid) from public,anon,authenticated;
grant execute on function public.deployment_event_summary(uuid) to authenticated;
