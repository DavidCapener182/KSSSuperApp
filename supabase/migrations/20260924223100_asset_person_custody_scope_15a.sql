-- TASK-15A forward correction: preserve original store authority when an item is held by a Person.
alter table public.asset_items add column home_store_id uuid references public.asset_stores(id);
update public.asset_items set home_store_id=coalesce(holder_store_id,(select id from public.asset_stores order by created_at,id limit 1));
alter table public.asset_items alter column home_store_id set not null;
create or replace function public.asset_register(p_reference text,p_class text,p_description text,p_serial text,p_store uuid,p_condition text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); h text; replay public.asset_requests%rowtype; item public.asset_items%rowtype; ev uuid; result jsonb;
begin
  if actor is null or not private.has_active_role('OFFICE_ADMIN') or p_request_key is null
    or p_reference !~ '^[A-Z0-9][A-Z0-9-]{2,31}$' or p_class not in ('RADIO','KEY_CARD','PHONE','LAPTOP_TABLET','BODYCAM')
    or length(trim(coalesce(p_description,''))) not between 2 and 160
    or p_condition not in ('GOOD','SERVICEABLE','DAMAGED','UNSERVICEABLE','UNKNOWN')
    or not exists(select 1 from public.asset_stores where id=p_store) then raise exception 'Asset registration denied'; end if;
  h:=md5(concat_ws('|',p_reference,p_class,p_description,coalesce(p_serial,''),p_store::text,p_condition));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||p_request_key::text,0));
  select * into replay from public.asset_requests where actor_person_id=actor and request_key=p_request_key;
  if found then
    if replay.action<>'REGISTER' or replay.request_hash<>h then raise exception 'Idempotency conflict'; end if;
    return replay.result;
  end if;
  insert into public.asset_items(reference,class,description,serial,home_store_id,holder_store_id,condition,created_by)
    values(p_reference,p_class,trim(p_description),nullif(trim(p_serial),''),p_store,p_store,p_condition,actor) returning * into item;
  insert into public.asset_events(asset_id,revision,action,actor_person_id,holder_after,condition_after,maintenance_after,exception_after,to_holder_id)
    values(item.id,1,'REGISTER',actor,'STORE',item.condition,'NONE','NONE',p_store) returning id into ev;
  result:=pg_catalog.jsonb_build_object('id',item.id,'revision',1,'eventId',ev);
  insert into public.asset_requests(actor_person_id,request_key,action,target_id,request_hash,result)
    values(actor,p_request_key,'REGISTER',item.id,h,result);
  return result;
end $$;

create or replace function public.asset_act(p_asset uuid,p_action text,p_expected_revision integer,p_request_key uuid,
  p_holder_kind text default null,p_holder_id uuid default null,p_condition text default null,
  p_expected_return_at timestamptz default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); item public.asset_items%rowtype; previous public.asset_items%rowtype;
  replay public.asset_requests%rowtype; h text; ev uuid; result jsonb; target_site uuid;
begin
  if actor is null or p_asset is null or p_request_key is null or p_expected_revision<1
    or p_action not in ('ISSUE','TRANSFER','RETURN','ACK_ISSUE','DISPUTE_ISSUE','ACK_RETURN','INSPECT','REPORT_DAMAGE','REPORT_LOSS','REPAIR_START','REPAIR_COMPLETE','RETIRE')
    then raise exception 'Asset action denied'; end if;
  h:=md5(concat_ws('|',p_asset::text,p_action,p_expected_revision::text,coalesce(p_holder_kind,''),coalesce(p_holder_id::text,''),
    coalesce(p_condition,''),coalesce(p_expected_return_at::text,''),coalesce(p_reason,'')));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||p_request_key::text,0));
  select * into replay from public.asset_requests where actor_person_id=actor and request_key=p_request_key;
  if found then
    if replay.action<>p_action or replay.target_id<>p_asset or replay.request_hash<>h then raise exception 'Idempotency conflict'; end if;
    return replay.result;
  end if;
  select * into item from public.asset_items where id=p_asset for update;
  if not found or item.revision<>p_expected_revision then raise exception 'Asset revision conflict'; end if;
  previous:=item;
  if p_action in ('ACK_ISSUE','DISPUTE_ISSUE') then
    if item.pending_ack<>'ISSUE' or item.pending_person_id<>actor then raise exception 'Acknowledgement denied'; end if;
    if p_action='DISPUTE_ISSUE' and length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'Reason required'; end if;
    item.pending_ack:=null; item.pending_person_id:=null;
    if p_action='DISPUTE_ISSUE' then item.maintenance_state:='QUARANTINED'; end if;
  elsif p_action in ('REPORT_DAMAGE','REPORT_LOSS') then
    if item.holder_person_id<>actor then raise exception 'Report denied'; end if;
    if length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'Reason required'; end if;
    if p_action='REPORT_DAMAGE' then item.condition:='DAMAGED'; item.maintenance_state:='QUARANTINED';
    else item.exception_state:='LOST'; end if;
  else
    if item.exception_state='RETIRED' then raise exception 'Retired asset'; end if;
    if not (private.has_active_role('OFFICE_ADMIN') and p_action in ('INSPECT','REPAIR_START','REPAIR_COMPLETE','RETIRE'))
      and not private.asset_has_grant(actor,item.holder_kind,private.asset_holder_id(item))
      and not (item.holder_kind='PERSON' and private.asset_has_grant(actor,'STORE',item.home_store_id))
      then raise exception 'Asset capability denied'; end if;
    if p_action in ('ISSUE','TRANSFER','RETURN') then
      if item.pending_ack is not null or item.exception_state<>'NONE'
        or (p_action<>'RETURN' and (item.maintenance_state<>'NONE'
          or item.condition in ('DAMAGED','UNSERVICEABLE','UNKNOWN'))) then raise exception 'Asset unavailable'; end if;
      if p_holder_kind not in ('PERSON','STORE','SITE','SITE_SERVICE','EVENT') or p_holder_id is null then raise exception 'Invalid holder'; end if;
      if p_action='ISSUE' and item.holder_kind<>'STORE' then raise exception 'Issue requires store'; end if;
      if p_action='RETURN' and (p_holder_kind<>'STORE' or item.holder_kind='STORE') then raise exception 'Return requires store'; end if;
      if p_holder_kind='PERSON' and not exists(select 1 from public.people where id=p_holder_id) then raise exception 'Invalid holder'; end if;
      if p_holder_kind='STORE' and not exists(select 1 from public.asset_stores where id=p_holder_id) then raise exception 'Invalid holder'; end if;
      if p_holder_kind='SITE' and not exists(select 1 from public.sites where id=p_holder_id) then raise exception 'Invalid holder'; end if;
      if p_holder_kind='SITE_SERVICE' then
        select site_id into target_site from public.site_services where id=p_holder_id;
        if target_site is null then raise exception 'Invalid holder'; end if;
      end if;
      if p_holder_kind='EVENT' then
        select site_id into target_site from public.operational_events where id=p_holder_id;
        if target_site is null then raise exception 'Invalid holder'; end if;
      end if;
      if p_holder_kind<>'PERSON' and not private.asset_has_grant(actor,p_holder_kind,p_holder_id)
        then raise exception 'Destination capability denied'; end if;
      item.holder_kind:=p_holder_kind;
      item.holder_person_id:=case when p_holder_kind='PERSON' then p_holder_id end;
      item.holder_store_id:=case when p_holder_kind='STORE' then p_holder_id end;
      item.holder_site_id:=case when p_holder_kind='SITE' then p_holder_id end;
      item.holder_site_service_id:=case when p_holder_kind='SITE_SERVICE' then p_holder_id end;
      item.holder_event_id:=case when p_holder_kind='EVENT' then p_holder_id end;
      item.location_site_id:=case when p_holder_kind='SITE' then p_holder_id when p_holder_kind='SITE_SERVICE' then target_site end;
      item.location_event_id:=case when p_holder_kind='EVENT' then p_holder_id end;
      item.expected_return_at:=case when p_holder_kind='STORE' then null else p_expected_return_at end;
      if p_holder_kind='PERSON' then item.pending_ack:='ISSUE'; item.pending_person_id:=p_holder_id;
      elsif p_action='RETURN' then item.pending_ack:='RETURN'; item.pending_person_id:=previous.holder_person_id;
      else item.pending_ack:=null; item.pending_person_id:=null; end if;
      if p_action='RETURN' and p_condition is not null then
        if p_condition not in ('GOOD','SERVICEABLE','DAMAGED','UNSERVICEABLE','UNKNOWN') then raise exception 'Invalid condition'; end if;
        item.condition:=p_condition;
        if p_condition in ('DAMAGED','UNSERVICEABLE','UNKNOWN') then item.maintenance_state:='QUARANTINED'; end if;
      end if;
    elsif p_action='ACK_RETURN' then
      if item.pending_ack<>'RETURN' or item.holder_kind<>'STORE' then raise exception 'Return acknowledgement denied'; end if;
      item.pending_ack:=null; item.pending_person_id:=null;
    elsif p_action='INSPECT' then
      if p_condition not in ('GOOD','SERVICEABLE','DAMAGED','UNSERVICEABLE','UNKNOWN') then raise exception 'Invalid condition'; end if;
      item.condition:=p_condition;
      if p_condition in ('GOOD','SERVICEABLE') and item.maintenance_state='QUARANTINED' then item.maintenance_state:='NONE'; end if;
    elsif p_action='REPAIR_START' then
      if item.holder_kind<>'STORE' or item.condition not in ('DAMAGED','UNSERVICEABLE','UNKNOWN') then raise exception 'Repair start denied'; end if;
      item.maintenance_state:='IN_REPAIR';
    elsif p_action='REPAIR_COMPLETE' then
      if item.maintenance_state<>'IN_REPAIR' then raise exception 'Repair completion denied'; end if;
      item.maintenance_state:='QUARANTINED';
    elsif p_action='RETIRE' then
      if item.holder_kind<>'STORE' or item.pending_ack is not null or length(trim(coalesce(p_reason,''))) not between 3 and 500
        then raise exception 'Retirement denied'; end if;
      item.exception_state:='RETIRED';
    end if;
  end if;
  item.revision:=item.revision+1; item.updated_at:=transaction_timestamp();
  update public.asset_items set condition=item.condition,maintenance_state=item.maintenance_state,exception_state=item.exception_state,
    holder_kind=item.holder_kind,holder_person_id=item.holder_person_id,holder_store_id=item.holder_store_id,
    holder_site_id=item.holder_site_id,holder_site_service_id=item.holder_site_service_id,holder_event_id=item.holder_event_id,
    location_site_id=item.location_site_id,location_event_id=item.location_event_id,expected_return_at=item.expected_return_at,
    pending_ack=item.pending_ack,pending_person_id=item.pending_person_id,revision=item.revision,updated_at=item.updated_at where id=p_asset;
  insert into public.asset_events(asset_id,revision,action,actor_person_id,holder_before,holder_after,condition_before,condition_after,
    maintenance_before,maintenance_after,exception_before,exception_after,from_holder_id,to_holder_id,expected_return_at,reason)
    values(p_asset,item.revision,p_action,actor,previous.holder_kind,item.holder_kind,previous.condition,item.condition,
      previous.maintenance_state,item.maintenance_state,previous.exception_state,item.exception_state,
      private.asset_holder_id(previous),private.asset_holder_id(item),item.expected_return_at,nullif(trim(p_reason),''))
    returning id into ev;
  result:=pg_catalog.jsonb_build_object('id',p_asset,'revision',item.revision,'eventId',ev);
  insert into public.asset_requests(actor_person_id,request_key,action,target_id,request_hash,result)
    values(actor,p_request_key,p_action,p_asset,h,result);
  return result;
end $$;

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
      'holderKind',a.holder_kind,'holderId',private.asset_holder_id(a),'expectedReturnAt',a.expected_return_at,
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

create or replace function public.asset_history(p_asset uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); item public.asset_items%rowtype;
begin
  if actor is null then raise exception 'Asset access denied'; end if;
  select * into item from public.asset_items where id=p_asset;
  if not found or (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')
    or item.holder_person_id=actor or private.asset_has_grant(actor,item.holder_kind,private.asset_holder_id(item))
    or (item.holder_kind='PERSON' and private.asset_has_grant(actor,'STORE',item.home_store_id))) is not true
    then raise exception 'Asset access denied'; end if;
  return pg_catalog.jsonb_build_object('id',item.id,'reference',item.reference,'class',item.class,
    'serial',case when item.class='KEY_CARD' and not (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')) then null else item.serial end,
    'events',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',e.id,'revision',e.revision,'action',e.action,'actorId',e.actor_person_id,'holderBefore',e.holder_before,
      'holderAfter',e.holder_after,'conditionBefore',e.condition_before,'conditionAfter',e.condition_after,
      'maintenanceAfter',e.maintenance_after,'exceptionAfter',e.exception_after,'recordedAt',e.recorded_at,
      'reason',case when item.class='KEY_CARD' and not (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')) then null else e.reason end)
      order by e.revision) from public.asset_events e where e.asset_id=p_asset), '[]'::jsonb));
end $$;
