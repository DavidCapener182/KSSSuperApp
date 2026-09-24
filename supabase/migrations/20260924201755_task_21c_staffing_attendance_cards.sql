-- TASK-21C: read-only factual cards for one exact 21B review period.
-- 08A/09B remain authoritative. No source writes, copied rows or personnel narrative.
create function public.service_delivery_source_cards_21c(p_delivery uuid,p_period uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  d public.service_deliveries%rowtype;
  p public.service_review_periods%rowtype;
  s public.site_services%rowtype;
  staffing jsonb;
  attendance jsonb;
begin
  perform private.service_delivery_actor();
  if not private.operational_authorised() or p_delivery is null or p_period is null then
    raise exception 'Service Delivery source access denied';
  end if;
  select * into d from public.service_deliveries where id=p_delivery;
  select * into p from public.service_review_periods where id=p_period and service_delivery_id=p_delivery;
  if d.id is null or p.id is null then raise exception 'Exact review period denied'; end if;
  select * into s from public.site_services where id=d.site_service_id
    and site_id=d.site_id and organisation_id=d.organisation_id
    and site_client_link_id=d.site_client_link_id;
  if s.id is null or not exists(select 1 from public.site_client_links l
    where l.id=d.site_client_link_id and l.site_id=d.site_id and l.organisation_id=d.organisation_id)
  then raise exception 'Historical source membership denied'; end if;

  with demands as materialized (
    select sd.id,sd.required_quantity,
      (select count(*)::integer from public.site_shift_allocations a where a.demand_id=sd.id and a.status in ('ALLOCATED','ACCEPTED')) as allocated,
      (select count(*)::integer from public.site_shift_allocations a where a.demand_id=sd.id and a.status='ACCEPTED') as accepted
    from public.site_shift_demands sd
    where sd.service_id=s.id and sd.service_date between p.starts_on and p.ends_on and sd.state='PLANNED'
  )
  select jsonb_build_object(
    'plannedDemandCount',count(*),
    'required',coalesce(sum(required_quantity),0),
    'allocated',coalesce(sum(allocated),0),
    'accepted',coalesce(sum(accepted),0),
    'remaining',coalesce(sum(greatest(required_quantity-allocated,0)),0)
  ) into staffing from demands;

  with cases as materialized (
    select summary.facts
    from public.attendance_cases c
    join public.site_shift_allocations a on a.id=c.site_shift_allocation_id and a.person_id=c.person_id
    join public.site_shift_demands sd on sd.id=a.demand_id
    cross join lateral (select private.attendance_summary_site_09b(a.id,a.person_id,false) as facts) summary
    where sd.service_id=s.id and sd.service_date between p.starts_on and p.ends_on
  )
  select jsonb_build_object(
    'recordedCaseCount',count(*),
    'checkIns',count(*) filter(where facts->>'check_in_at' is not null),
    'checkOuts',count(*) filter(where facts->>'check_out_at' is not null),
    'currentExceptions',count(*) filter(where (facts->>'exception_recorded')::boolean is true),
    'noShows',count(*) filter(where (facts->>'no_show_recorded')::boolean is true),
    'reviewRequired',count(*) filter(where (facts->>'review_required')::boolean is true)
  ) into attendance from cases;

  return jsonb_build_object(
    'serviceDeliveryId',d.id,'reviewPeriodId',p.id,
    'startsOn',p.starts_on,'endsOn',p.ends_on,'periodState',p.state,
    'siteServiceId',s.id,'siteId',s.site_id,'sourceServiceState',s.state,
    'asOf',transaction_timestamp(),
    'staffing',staffing,'attendance',attendance
  );
end $$;
revoke all on function public.service_delivery_source_cards_21c(uuid,uuid) from public,anon,authenticated;
grant execute on function public.service_delivery_source_cards_21c(uuid,uuid) to authenticated;
