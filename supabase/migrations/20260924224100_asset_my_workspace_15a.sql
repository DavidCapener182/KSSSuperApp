-- TASK-15A Staff self view stays self-only even for a Person with another active role.
create function public.asset_my_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id();
begin
  if actor is null then raise exception 'Equipment self view denied'; end if;
  return pg_catalog.jsonb_build_object(
    'stores','[]'::jsonb,'stock','[]'::jsonb,
    'items',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',a.id,'reference',a.reference,'class',a.class,'description',a.description,
      'condition',a.condition,'maintenanceState',a.maintenance_state,'exceptionState',a.exception_state,
      'holderKind',a.holder_kind,'holderId',a.holder_person_id,'holderLabel','My custody',
      'locationLabel',case when a.location_event_id is not null then (select e.name from public.operational_events e where e.id=a.location_event_id)
        when a.location_site_id is not null then (select s.name from public.sites s where s.id=a.location_site_id) end,
      'expectedReturnAt',a.expected_return_at,'pendingAck',a.pending_ack,'revision',a.revision,
      'overdue',a.expected_return_at is not null and a.expected_return_at<transaction_timestamp()))
      from public.asset_items a where a.holder_person_id=actor), '[]'::jsonb),
    'myStock',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'issueId',i.id,'stockId',i.stock_id,'garment',s.garment,'size',s.size,
      'outstanding',i.quantity_outstanding,'acknowledgement',i.acknowledgement))
      from public.asset_stock_issues i join public.asset_stock s on s.id=i.stock_id
      where i.person_id=actor and i.quantity_outstanding>0), '[]'::jsonb)
  );
end $$;
revoke all on function public.asset_my_workspace() from public,anon,authenticated;
grant execute on function public.asset_my_workspace() to authenticated;
