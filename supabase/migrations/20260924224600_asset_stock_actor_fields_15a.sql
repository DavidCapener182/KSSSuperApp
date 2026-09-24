-- TASK-15A a stock adjustment has no recipient or issue; an issue cannot spoof a prior issue ID.
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
    if not private.has_active_role('OFFICE_ADMIN') or p_person is not null or p_issue is not null
      or length(trim(coalesce(p_reason,''))) not between 3 and 500
      then raise exception 'Adjustment denied'; end if;
    if row0.available_quantity+p_quantity<0 then raise exception 'Stock adjustment exceeds available balance'; end if;
    row0.available_quantity:=row0.available_quantity+p_quantity;
  else
    if p_quantity<1 then raise exception 'Stock quantity must be positive'; end if;
    if not private.asset_has_grant(actor,'STORE',row0.store_id) then raise exception 'Stock capability denied'; end if;
    if p_action='ISSUE' then
      if p_person is null or p_issue is not null or not exists(select 1 from public.people where id=p_person)
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
