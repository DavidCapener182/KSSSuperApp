-- PRODUCT-07: bounded read projections over the accepted 15A ledger. No custody or stock mutation is changed.
create function public.asset_register_page(
  p_search text, p_class text, p_holder_kind text, p_context uuid,
  p_condition text, p_repair text, p_exception text, p_return text,
  p_view text, p_page integer, p_size integer
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); office boolean; ops boolean; total_count bigint; rows_json jsonb;
begin
  office:=private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN');
  ops:=private.has_active_role('OPERATIONS');
  if actor is null or not (office or ops) then raise exception 'Asset register denied'; end if;
  if p_page is null or p_page<1 or p_page>100000 or p_size is null or p_size<1 or p_size>100
    or length(coalesce(p_search,''))>100
    or (p_class is not null and p_class not in ('RADIO','KEY_CARD','PHONE','LAPTOP_TABLET','BODYCAM'))
    or (p_holder_kind is not null and p_holder_kind not in ('PERSON','STORE','SITE','SITE_SERVICE','EVENT'))
    or (p_condition is not null and p_condition not in ('GOOD','SERVICEABLE','DAMAGED','UNSERVICEABLE','UNKNOWN'))
    or (p_repair is not null and p_repair not in ('NONE','QUARANTINED','IN_REPAIR'))
    or (p_exception is not null and p_exception not in ('NONE','LOST','RETIRED'))
    or (p_return is not null and p_return not in ('OVERDUE','DUE','NOT_SET'))
    or (p_view is not null and p_view not in ('ALL','AVAILABLE','ISSUED','OVERDUE','REPAIR','EXCEPTIONS'))
  then raise exception 'Invalid asset register filter'; end if;
  with filtered as (
    select a.* from public.asset_items a
    where (office or (ops and (private.asset_has_grant(actor,a.holder_kind,private.asset_holder_id(a))
      or (a.holder_kind='PERSON' and private.asset_has_grant(actor,'STORE',a.home_store_id)))))
      and (nullif(trim(p_search),'') is null or a.reference ilike '%'||trim(p_search)||'%' or a.description ilike '%'||trim(p_search)||'%')
      and (p_class is null or a.class=p_class)
      and (p_holder_kind is null or a.holder_kind=p_holder_kind)
      and (p_context is null or private.asset_holder_id(a)=p_context)
      and (p_condition is null or a.condition=p_condition)
      and (p_repair is null or a.maintenance_state=p_repair)
      and (p_exception is null or a.exception_state=p_exception)
      and (p_return is null or (p_return='OVERDUE' and a.expected_return_at<transaction_timestamp() and a.holder_kind<>'STORE')
        or (p_return='DUE' and a.expected_return_at>=transaction_timestamp() and a.holder_kind<>'STORE')
        or (p_return='NOT_SET' and a.expected_return_at is null))
      and (p_view is null or p_view='ALL'
        or (p_view='AVAILABLE' and a.holder_kind='STORE' and a.pending_ack is null and a.maintenance_state='NONE'
          and a.exception_state='NONE' and a.condition in ('GOOD','SERVICEABLE'))
        or (p_view='ISSUED' and a.holder_kind<>'STORE')
        or (p_view='OVERDUE' and a.expected_return_at<transaction_timestamp() and a.holder_kind<>'STORE')
        or (p_view='REPAIR' and a.maintenance_state<>'NONE')
        or (p_view='EXCEPTIONS' and a.exception_state<>'NONE'))
  ), numbered as (
    select a.*,count(*) over() as matched from filtered a order by a.reference,a.id
    limit p_size offset ((p_page-1)*p_size)
  )
  select coalesce(max(n.matched),0),coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',n.id,'reference',n.reference,'class',n.class,'description',n.description,
    'condition',n.condition,'maintenanceState',n.maintenance_state,'exceptionState',n.exception_state,
    'holderKind',n.holder_kind,'holderId',case n.holder_kind when 'PERSON' then n.holder_person_id when 'STORE' then n.holder_store_id when 'SITE' then n.holder_site_id when 'SITE_SERVICE' then n.holder_site_service_id when 'EVENT' then n.holder_event_id end,
    'holderLabel',case n.holder_kind
      when 'PERSON' then (select p.display_name from public.people p where p.id=n.holder_person_id)
      when 'STORE' then (select s.name from public.asset_stores s where s.id=n.holder_store_id)
      when 'SITE' then (select s.name from public.sites s where s.id=n.holder_site_id)
      when 'SITE_SERVICE' then (select s.name from public.site_services s where s.id=n.holder_site_service_id)
      when 'EVENT' then (select e.name from public.operational_events e where e.id=n.holder_event_id) end,
    'locationLabel',case when n.location_event_id is not null then (select e.name from public.operational_events e where e.id=n.location_event_id)
      when n.location_site_id is not null then (select s.name from public.sites s where s.id=n.location_site_id)
      when n.holder_store_id is not null then (select s.name from public.asset_stores s where s.id=n.holder_store_id) end,
    'expectedReturnAt',n.expected_return_at,'pendingAck',n.pending_ack,'revision',n.revision,
    'availableToIssue',n.holder_kind='STORE' and n.pending_ack is null and n.maintenance_state='NONE'
      and n.exception_state='NONE' and n.condition in ('GOOD','SERVICEABLE'),
    'availabilityReason',case when n.holder_kind<>'STORE' then 'Held outside store'
      when n.pending_ack is not null then 'Handover pending'
      when n.maintenance_state<>'NONE' then 'Repair: '||n.maintenance_state
      when n.exception_state<>'NONE' then 'Exception: '||n.exception_state
      when n.condition not in ('GOOD','SERVICEABLE') then 'Condition: '||n.condition
      else 'Available from store' end,
    'overdue',n.expected_return_at is not null and n.expected_return_at<transaction_timestamp() and n.holder_kind<>'STORE')
    order by n.reference,n.id),'[]'::jsonb) into total_count,rows_json from numbered n;
  -- A page beyond the end still needs the true count.
  if total_count=0 then
    with filtered as (select a.id from public.asset_items a where
      (office or (ops and (private.asset_has_grant(actor,a.holder_kind,private.asset_holder_id(a))
      or (a.holder_kind='PERSON' and private.asset_has_grant(actor,'STORE',a.home_store_id)))))
      and (nullif(trim(p_search),'') is null or a.reference ilike '%'||trim(p_search)||'%' or a.description ilike '%'||trim(p_search)||'%')
      and (p_class is null or a.class=p_class) and (p_holder_kind is null or a.holder_kind=p_holder_kind)
      and (p_context is null or private.asset_holder_id(a)=p_context) and (p_condition is null or a.condition=p_condition)
      and (p_repair is null or a.maintenance_state=p_repair) and (p_exception is null or a.exception_state=p_exception)
      and (p_return is null or (p_return='OVERDUE' and a.expected_return_at<transaction_timestamp() and a.holder_kind<>'STORE')
        or (p_return='DUE' and a.expected_return_at>=transaction_timestamp() and a.holder_kind<>'STORE')
        or (p_return='NOT_SET' and a.expected_return_at is null))
      and (p_view is null or p_view='ALL'
        or (p_view='AVAILABLE' and a.holder_kind='STORE' and a.pending_ack is null and a.maintenance_state='NONE' and a.exception_state='NONE' and a.condition in ('GOOD','SERVICEABLE'))
        or (p_view='ISSUED' and a.holder_kind<>'STORE')
        or (p_view='OVERDUE' and a.expected_return_at<transaction_timestamp() and a.holder_kind<>'STORE')
        or (p_view='REPAIR' and a.maintenance_state<>'NONE') or (p_view='EXCEPTIONS' and a.exception_state<>'NONE')))
    select count(*) into total_count from filtered;
  end if;
  return pg_catalog.jsonb_build_object('items',rows_json,'total',total_count,'page',p_page,'pageSize',p_size);
end $$;
revoke all on function public.asset_register_page(text,text,text,uuid,text,text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.asset_register_page(text,text,text,uuid,text,text,text,text,text,integer,integer) to authenticated;

create function public.asset_register_support() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); office boolean; ops boolean;
begin
  office:=private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN'); ops:=private.has_active_role('OPERATIONS');
  if actor is null or not (office or ops) then raise exception 'Asset support denied'; end if;
  return pg_catalog.jsonb_build_object(
    'stores',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',s.id,'name',s.name))
      from public.asset_stores s where office or (ops and private.asset_has_grant(actor,'STORE',s.id))),'[]'::jsonb),
    'stock',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',s.id,'sku',s.sku,
      'garment',s.garment,'size',s.size,'available',s.available_quantity,'issued',s.issued_quantity,'revision',s.revision))
      from public.asset_stock s where office or (ops and private.asset_has_grant(actor,'STORE',s.store_id))),'[]'::jsonb),
    'contexts',coalesce((select pg_catalog.jsonb_agg(x.value || pg_catalog.jsonb_build_object('label',x.label) order by x.label) from (
      select distinct a.holder_kind||':'||private.asset_holder_id(a)::text as key,
        case a.holder_kind when 'PERSON' then (select p.display_name from public.people p where p.id=a.holder_person_id)
          when 'STORE' then (select s.name from public.asset_stores s where s.id=a.holder_store_id)
          when 'SITE' then (select s.name from public.sites s where s.id=a.holder_site_id)
          when 'SITE_SERVICE' then (select s.name from public.site_services s where s.id=a.holder_site_service_id)
          when 'EVENT' then (select e.name from public.operational_events e where e.id=a.holder_event_id) end as label,
        pg_catalog.jsonb_build_object('kind',a.holder_kind,'id',private.asset_holder_id(a)) as value
      from public.asset_items a where office or (ops and (private.asset_has_grant(actor,a.holder_kind,private.asset_holder_id(a))
        or (a.holder_kind='PERSON' and private.asset_has_grant(actor,'STORE',a.home_store_id))))
    ) x),'[]'::jsonb)
  );
end $$;
revoke all on function public.asset_register_support() from public,anon,authenticated;
grant execute on function public.asset_register_support() to authenticated;

create function public.asset_stock_issue_choices(p_stock uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); row0 public.asset_stock%rowtype;
begin
  if actor is null or not (private.has_active_role('OPERATIONS') or private.has_active_role('OFFICE_ADMIN')) then raise exception 'Stock issue choices denied'; end if;
  select * into row0 from public.asset_stock where id=p_stock;
  if not found or not (private.has_active_role('OFFICE_ADMIN') or private.asset_has_grant(actor,'STORE',row0.store_id))
    then raise exception 'Stock issue choices denied'; end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('issueId',i.id,
    'personId',i.person_id,'personName',p.display_name,'outstanding',i.quantity_outstanding)
    order by p.display_name,i.id)
    from public.asset_stock_issues i join public.people p on p.id=i.person_id
    where i.stock_id=p_stock and i.quantity_outstanding>0),'[]'::jsonb);
end $$;
revoke all on function public.asset_stock_issue_choices(uuid) from public,anon,authenticated;
grant execute on function public.asset_stock_issue_choices(uuid) to authenticated;

create function public.asset_event_receipt(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id();
begin
  if actor is null then raise exception 'Asset receipt denied'; end if;
  return (select pg_catalog.jsonb_build_object('eventId',e.id,'assetId',e.asset_id,'revision',e.revision,
    'action',e.action,'holderKind',e.holder_after,'holderId',e.to_holder_id,
    'condition',e.condition_after,'recordedAt',e.recorded_at)
    from public.asset_events e where e.id=p_event and e.actor_person_id=actor);
end $$;
revoke all on function public.asset_event_receipt(uuid) from public,anon,authenticated;
grant execute on function public.asset_event_receipt(uuid) to authenticated;

create function public.asset_stock_event_receipt(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id();
begin
  if actor is null then raise exception 'Stock receipt denied'; end if;
  return (select pg_catalog.jsonb_build_object('eventId',e.id,'stockId',e.stock_id,'revision',e.revision,
    'action',e.action,'availableAfter',e.available_after,'outstandingAfter',e.outstanding_after,
    'issueId',e.issue_id,'recordedAt',e.recorded_at)
    from public.asset_stock_events e where e.id=p_event and e.actor_person_id=actor);
end $$;
revoke all on function public.asset_stock_event_receipt(uuid) from public,anon,authenticated;
grant execute on function public.asset_stock_event_receipt(uuid) to authenticated;
