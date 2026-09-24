-- TASK-15A direct RPC callers must supply revision, quantity and acknowledgement choice.
create or replace function public.asset_act(p_asset uuid,p_action text,p_expected_revision integer,p_request_key uuid,
  p_holder_kind text default null,p_holder_id uuid default null,p_condition text default null,
  p_expected_return_at timestamptz default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); item public.asset_items%rowtype; previous public.asset_items%rowtype;
  replay public.asset_requests%rowtype; h text; ev uuid; result jsonb; target_site uuid;
begin
  if actor is null or p_asset is null or p_request_key is null
    or p_expected_revision is null or p_expected_revision<1
    or p_action not in ('ISSUE','TRANSFER','RETURN','ACK_ISSUE','DISPUTE_ISSUE','ACK_RETURN','INSPECT','REPORT_DAMAGE','REPORT_LOSS','RECOVER','REPAIR_START','REPAIR_COMPLETE','RETIRE')
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
    elsif p_action='RECOVER' then
      if item.exception_state<>'LOST' or length(trim(coalesce(p_reason,''))) not between 3 and 500
        then raise exception 'Recovery denied'; end if;
      item.exception_state:='NONE'; item.maintenance_state:='QUARANTINED';
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
create or replace function public.asset_stock_move(p_stock uuid,p_action text,p_quantity integer,p_person uuid,p_issue uuid,
  p_expected_revision integer,p_request_key uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); row0 public.asset_stock%rowtype; issue0 public.asset_stock_issues%rowtype;
  replay public.asset_requests%rowtype; h text; ev uuid; result jsonb; new_issue uuid;
begin
  if actor is null or p_request_key is null or p_expected_revision is null or p_expected_revision<1
    or p_quantity is null or p_quantity=0
    or p_action not in ('ISSUE','RETURN','ADJUST') then raise exception 'Stock action denied'; end if;
  h:=md5(concat_ws('|',p_stock::text,p_action,p_quantity::text,coalesce(p_person::text,''),coalesce(p_issue::text,''),
    p_expected_revision::text,coalesce(p_reason,'')));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||p_request_key::text,0));
  select * into replay from public.asset_requests where actor_person_id=actor and request_key=p_request_key;
  if found then
    if replay.action<>p_action or replay.target_id<>p_stock or replay.request_hash<>h then raise exception 'Idempotency conflict'; end if;
    return replay.result;
  end if;
  select * into row0 from public.asset_stock where id=p_stock for update;
  if not found or row0.revision<>p_expected_revision then raise exception 'Stock revision conflict'; end if;
  if p_action='ADJUST' then
    if not private.has_active_role('OFFICE_ADMIN') or length(trim(coalesce(p_reason,''))) not between 3 and 500
      then raise exception 'Adjustment denied'; end if;
    if row0.available_quantity+p_quantity<0 then raise exception 'Stock adjustment exceeds available balance'; end if;
    row0.available_quantity:=row0.available_quantity+p_quantity;
  else
    if p_quantity<1 then raise exception 'Stock quantity must be positive'; end if;
    if not private.asset_has_grant(actor,'STORE',row0.store_id) then raise exception 'Stock capability denied'; end if;
    if p_action='ISSUE' then
      if p_person is null or not exists(select 1 from public.people where id=p_person)
        or row0.available_quantity<p_quantity then raise exception 'Stock issue denied'; end if;
      insert into public.asset_stock_issues(stock_id,person_id,quantity_outstanding)
        values(p_stock,p_person,p_quantity) returning id into new_issue;
      row0.available_quantity:=row0.available_quantity-p_quantity;
      row0.issued_quantity:=row0.issued_quantity+p_quantity;
    else
      select * into issue0 from public.asset_stock_issues where id=p_issue and stock_id=p_stock for update;
      if not found or issue0.quantity_outstanding<p_quantity or issue0.acknowledgement='PENDING'
        or p_person is distinct from issue0.person_id
        then raise exception 'Stock return denied'; end if;
      update public.asset_stock_issues set quantity_outstanding=quantity_outstanding-p_quantity where id=p_issue;
      row0.available_quantity:=row0.available_quantity+p_quantity;
      row0.issued_quantity:=row0.issued_quantity-p_quantity;
      new_issue:=p_issue;
    end if;
  end if;
  row0.revision:=row0.revision+1;
  update public.asset_stock set available_quantity=row0.available_quantity,issued_quantity=row0.issued_quantity,
    revision=row0.revision where id=p_stock;
  insert into public.asset_stock_events(stock_id,revision,action,quantity,issue_id,person_id,actor_person_id,
    available_after,outstanding_after,reason)
    values(p_stock,row0.revision,p_action,p_quantity,new_issue,p_person,actor,row0.available_quantity,
      row0.issued_quantity,nullif(trim(p_reason),'')) returning id into ev;
  result:=pg_catalog.jsonb_build_object('id',p_stock,'revision',row0.revision,'eventId',ev,'issueId',new_issue);
  insert into public.asset_requests(actor_person_id,request_key,action,target_id,request_hash,result)
    values(actor,p_request_key,p_action,p_stock,h,result);
  return result;
end $$;
create or replace function public.asset_stock_ack(p_issue uuid,p_dispute boolean,p_reason text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); issue0 public.asset_stock_issues%rowtype; stock0 public.asset_stock%rowtype;
  replay public.asset_requests%rowtype; h text; result jsonb; ev uuid; stock_id0 uuid;
begin
  if actor is null or p_request_key is null or p_dispute is null
    then raise exception 'Stock acknowledgement denied'; end if;
  h:=md5(concat_ws('|',p_issue::text,p_dispute::text,coalesce(p_reason,'')));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||p_request_key::text,0));
  select * into replay from public.asset_requests where actor_person_id=actor and request_key=p_request_key;
  if found then
    if replay.action<>'STOCK_ACK' or replay.target_id<>p_issue or replay.request_hash<>h then raise exception 'Idempotency conflict'; end if;
    return replay.result;
  end if;
  select stock_id into stock_id0 from public.asset_stock_issues where id=p_issue;
  select * into stock0 from public.asset_stock where id=stock_id0 for update;
  select * into issue0 from public.asset_stock_issues where id=p_issue for update;
  if not found or issue0.person_id<>actor or issue0.acknowledgement<>'PENDING'
    or (p_dispute and length(trim(coalesce(p_reason,''))) not between 3 and 500)
    then raise exception 'Stock acknowledgement denied'; end if;
  update public.asset_stock_issues set acknowledgement=case when p_dispute then 'DISPUTED' else 'ACKNOWLEDGED' end,
    acknowledgement_reason=nullif(trim(p_reason),''),acknowledged_at=transaction_timestamp() where id=p_issue;
  update public.asset_stock set revision=revision+1 where id=stock_id0;
  insert into public.asset_stock_events(stock_id,revision,action,quantity,issue_id,person_id,actor_person_id,
    available_after,outstanding_after,reason)
    values(stock_id0,stock0.revision+1,case when p_dispute then 'DISPUTE_ISSUE' else 'ACK_ISSUE' end,
      issue0.quantity_outstanding,p_issue,actor,actor,stock0.available_quantity,stock0.issued_quantity,
      nullif(trim(p_reason),'')) returning id into ev;
  result:=pg_catalog.jsonb_build_object('issueId',p_issue,'eventId',ev,
    'acknowledgement',case when p_dispute then 'DISPUTED' else 'ACKNOWLEDGED' end);
  insert into public.asset_requests(actor_person_id,request_key,action,target_id,request_hash,result)
    values(actor,p_request_key,'STOCK_ACK',p_issue,h,result);
  return result;
end $$;
