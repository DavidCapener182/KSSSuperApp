-- TASK-15A show authorised holder and observed location labels.
create or replace function public.asset_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); office boolean; ops boolean; result jsonb;
begin
  if actor is null then raise exception 'Asset access denied'; end if;
  office:=private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN');
  ops:=private.has_active_role('OPERATIONS');
  select pg_catalog.jsonb_build_object(
    'stores',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',s.id,'name',s.name))
      from public.asset_stores s where office or (ops and private.asset_has_grant(actor,'STORE',s.id))), '[]'::jsonb),
    'items',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',a.id,'reference',a.reference,'class',a.class,'description',a.description,
      'condition',a.condition,'maintenanceState',a.maintenance_state,'exceptionState',a.exception_state,
      'holderKind',a.holder_kind,'holderId',private.asset_holder_id(a),
      'holderLabel',case a.holder_kind
        when 'PERSON' then (select p.display_name from public.people p where p.id=a.holder_person_id)
        when 'STORE' then (select s.name from public.asset_stores s where s.id=a.holder_store_id)
        when 'SITE' then (select s.name from public.sites s where s.id=a.holder_site_id)
        when 'SITE_SERVICE' then (select s.name from public.site_services s where s.id=a.holder_site_service_id)
        when 'EVENT' then (select e.name from public.operational_events e where e.id=a.holder_event_id) end,
      'locationLabel',case when a.location_event_id is not null then
        (select e.name from public.operational_events e where e.id=a.location_event_id)
        when a.location_site_id is not null then (select s.name from public.sites s where s.id=a.location_site_id)
        when a.holder_store_id is not null then (select s.name from public.asset_stores s where s.id=a.holder_store_id)
        else null end,
      'expectedReturnAt',a.expected_return_at,
      'pendingAck',a.pending_ack,'revision',a.revision,'overdue',
        a.expected_return_at is not null and a.expected_return_at<transaction_timestamp() and a.holder_kind<>'STORE'))
      from public.asset_items a where office or a.holder_person_id=actor
        or (ops and (private.asset_has_grant(actor,a.holder_kind,private.asset_holder_id(a))
          or (a.holder_kind='PERSON' and private.asset_has_grant(actor,'STORE',a.home_store_id))))), '[]'::jsonb),
    'stock',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',s.id,'sku',s.sku,'garment',s.garment,'size',s.size,'available',s.available_quantity,
      'issued',s.issued_quantity,'revision',s.revision,'storeId',s.store_id))
      from public.asset_stock s where office or (ops and private.asset_has_grant(actor,'STORE',s.store_id))), '[]'::jsonb),
    'myStock',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'issueId',i.id,'stockId',i.stock_id,'garment',s.garment,'size',s.size,'outstanding',i.quantity_outstanding,
      'acknowledgement',i.acknowledgement))
      from public.asset_stock_issues i join public.asset_stock s on s.id=i.stock_id
      where i.person_id=actor and i.quantity_outstanding>0), '[]'::jsonb)
  ) into result;
  return result;
end $$;
