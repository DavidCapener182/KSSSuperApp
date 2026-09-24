-- TASK-15A synthetic Dev: native asset custody and sized stock. No live inventory import.
create table public.asset_stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 3 and 100),
  created_at timestamptz not null default transaction_timestamp()
);
insert into public.asset_stores(name) values ('KSS controlled store');

create table public.asset_capability_grants (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  scope_kind text not null check (scope_kind in ('STORE','SITE','SITE_SERVICE','EVENT')),
  store_id uuid references public.asset_stores(id),
  site_id uuid references public.sites(id),
  site_service_id uuid references public.site_services(id),
  event_id uuid references public.operational_events(id),
  effective_from timestamptz not null default transaction_timestamp(),
  effective_until timestamptz not null,
  granted_by uuid not null references public.people(id),
  grant_reason text not null check (length(trim(grant_reason)) between 3 and 300),
  revoked_at timestamptz,
  revoked_by uuid references public.people(id),
  revocation_reason text check (revocation_reason is null or length(trim(revocation_reason)) between 3 and 300),
  created_at timestamptz not null default transaction_timestamp(),
  check (effective_until > effective_from),
  check ((scope_kind='STORE' and store_id is not null and num_nonnulls(site_id,site_service_id,event_id)=0)
    or (scope_kind='SITE' and site_id is not null and num_nonnulls(store_id,site_service_id,event_id)=0)
    or (scope_kind='SITE_SERVICE' and site_service_id is not null and num_nonnulls(store_id,site_id,event_id)=0)
    or (scope_kind='EVENT' and event_id is not null and num_nonnulls(store_id,site_id,site_service_id)=0))
);
create index asset_grants_person_idx on public.asset_capability_grants(person_id,effective_until) where revoked_at is null;

create table public.asset_items (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'),
  class text not null check (class in ('RADIO','KEY_CARD','PHONE','LAPTOP_TABLET','BODYCAM')),
  description text not null check (length(trim(description)) between 2 and 160 and description !~ '[[:cntrl:]]'),
  serial text check (serial is null or (length(trim(serial)) between 2 and 100 and serial !~ '[[:cntrl:]]')),
  condition text not null default 'UNKNOWN' check (condition in ('GOOD','SERVICEABLE','DAMAGED','UNSERVICEABLE','UNKNOWN')),
  maintenance_state text not null default 'NONE' check (maintenance_state in ('NONE','QUARANTINED','IN_REPAIR')),
  exception_state text not null default 'NONE' check (exception_state in ('NONE','LOST','RETIRED')),
  holder_kind text not null default 'STORE' check (holder_kind in ('PERSON','STORE','SITE','SITE_SERVICE','EVENT')),
  holder_person_id uuid references public.people(id),
  holder_store_id uuid references public.asset_stores(id),
  holder_site_id uuid references public.sites(id),
  holder_site_service_id uuid references public.site_services(id),
  holder_event_id uuid references public.operational_events(id),
  location_site_id uuid references public.sites(id),
  location_event_id uuid references public.operational_events(id),
  expected_return_at timestamptz,
  pending_ack text check (pending_ack in ('ISSUE','RETURN')),
  pending_person_id uuid references public.people(id),
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null references public.people(id),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  check ((holder_kind='PERSON' and holder_person_id is not null and num_nonnulls(holder_store_id,holder_site_id,holder_site_service_id,holder_event_id)=0)
    or (holder_kind='STORE' and holder_store_id is not null and num_nonnulls(holder_person_id,holder_site_id,holder_site_service_id,holder_event_id)=0)
    or (holder_kind='SITE' and holder_site_id is not null and num_nonnulls(holder_person_id,holder_store_id,holder_site_service_id,holder_event_id)=0)
    or (holder_kind='SITE_SERVICE' and holder_site_service_id is not null and num_nonnulls(holder_person_id,holder_store_id,holder_site_id,holder_event_id)=0)
    or (holder_kind='EVENT' and holder_event_id is not null and num_nonnulls(holder_person_id,holder_store_id,holder_site_id,holder_site_service_id)=0)),
  check (num_nonnulls(location_site_id,location_event_id) <= 1),
  check ((pending_ack='ISSUE' and pending_person_id=holder_person_id)
    or (pending_ack='RETURN' and holder_kind='STORE' and pending_person_id is not null)
    or (pending_ack is null and pending_person_id is null)),
  check (expected_return_at is null or isfinite(expected_return_at)),
  check (exception_state <> 'RETIRED' or pending_ack is null)
);
create unique index asset_serial_unique_idx on public.asset_items(class,lower(serial)) where serial is not null;
create index asset_holder_person_idx on public.asset_items(holder_person_id,id) where holder_person_id is not null;
create index asset_holder_site_idx on public.asset_items(holder_site_id,id) where holder_site_id is not null;
create index asset_holder_service_idx on public.asset_items(holder_site_service_id,id) where holder_site_service_id is not null;
create index asset_holder_event_idx on public.asset_items(holder_event_id,id) where holder_event_id is not null;
create index asset_holder_store_idx on public.asset_items(holder_store_id,id) where holder_store_id is not null;

create table public.asset_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.asset_items(id),
  revision integer not null,
  action text not null check (action in ('REGISTER','ISSUE','TRANSFER','RETURN','ACK_ISSUE','DISPUTE_ISSUE','ACK_RETURN','INSPECT','REPORT_DAMAGE','REPORT_LOSS','RECOVER','REPAIR_START','REPAIR_COMPLETE','RETIRE')),
  actor_person_id uuid not null references public.people(id),
  holder_before text,
  holder_after text not null,
  condition_before text,
  condition_after text not null,
  maintenance_before text,
  maintenance_after text not null,
  exception_before text,
  exception_after text not null,
  from_holder_id uuid,
  to_holder_id uuid,
  expected_return_at timestamptz,
  reason text check (reason is null or (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]')),
  recorded_at timestamptz not null default transaction_timestamp(),
  unique(asset_id,revision)
);
create index asset_events_actor_idx on public.asset_events(actor_person_id,recorded_at);

create table public.asset_stock (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'),
  garment text not null check (length(trim(garment)) between 2 and 100),
  size text not null check (length(trim(size)) between 1 and 20),
  store_id uuid not null references public.asset_stores(id),
  available_quantity integer not null default 0 check (available_quantity >= 0),
  issued_quantity integer not null default 0 check (issued_quantity >= 0),
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null references public.people(id),
  created_at timestamptz not null default transaction_timestamp(),
  unique(garment,size,store_id)
);
create index asset_stock_store_idx on public.asset_stock(store_id,garment,size);
create table public.asset_stock_issues (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references public.asset_stock(id),
  person_id uuid not null references public.people(id),
  quantity_outstanding integer not null check (quantity_outstanding >= 0),
  acknowledgement text not null default 'PENDING' check (acknowledgement in ('PENDING','ACKNOWLEDGED','DISPUTED')),
  acknowledgement_reason text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default transaction_timestamp()
);
create index asset_stock_issues_person_idx on public.asset_stock_issues(person_id,stock_id);
create table public.asset_stock_events (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references public.asset_stock(id),
  revision integer not null,
  action text not null check (action in ('OPENING','ISSUE','RETURN','ADJUST','ACK_ISSUE','DISPUTE_ISSUE')),
  quantity integer not null check (quantity <> 0),
  issue_id uuid references public.asset_stock_issues(id),
  person_id uuid references public.people(id),
  actor_person_id uuid not null references public.people(id),
  available_after integer not null,
  outstanding_after integer not null,
  reason text check (reason is null or (length(trim(reason)) between 3 and 500)),
  recorded_at timestamptz not null default transaction_timestamp(),
  unique(stock_id,revision)
);
create index asset_stock_events_actor_idx on public.asset_stock_events(actor_person_id,recorded_at);

create table public.asset_requests (
  id uuid primary key default gen_random_uuid(),
  actor_person_id uuid not null references public.people(id),
  request_key uuid not null,
  action text not null,
  target_id uuid not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default transaction_timestamp(),
  unique(actor_person_id,request_key)
);
create index asset_requests_target_idx on public.asset_requests(target_id,action);

alter table public.asset_stores enable row level security;
alter table public.asset_capability_grants enable row level security;
alter table public.asset_items enable row level security;
alter table public.asset_events enable row level security;
alter table public.asset_stock enable row level security;
alter table public.asset_stock_issues enable row level security;
alter table public.asset_stock_events enable row level security;
alter table public.asset_requests enable row level security;
revoke all on public.asset_stores,public.asset_capability_grants,public.asset_items,public.asset_events,
  public.asset_stock,public.asset_stock_issues,public.asset_stock_events,public.asset_requests from public,anon,authenticated;

create function private.asset_holder_id(p_item public.asset_items) returns uuid
language sql stable set search_path='' as $$
  select coalesce(p_item.holder_person_id,p_item.holder_store_id,p_item.holder_site_id,p_item.holder_site_service_id,p_item.holder_event_id)
$$;
create function private.asset_has_grant(p_actor uuid,p_kind text,p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.has_active_role('OPERATIONS') and exists (
    select 1 from public.asset_capability_grants g
    where g.person_id=p_actor and g.scope_kind=p_kind
      and coalesce(g.store_id,g.site_id,g.site_service_id,g.event_id)=p_id
      and g.revoked_at is null and g.effective_from<=transaction_timestamp() and g.effective_until>transaction_timestamp()
  )
$$;
revoke all on function private.asset_holder_id(public.asset_items),private.asset_has_grant(uuid,text,uuid) from public,anon,authenticated;

create function public.asset_grant(p_person uuid,p_scope_kind text,p_scope_id uuid,p_until timestamptz,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid;
begin
  if actor is null or not private.has_active_role('SUPER_ADMIN') or p_person is null or p_scope_id is null
    or p_until<=transaction_timestamp() or p_until>transaction_timestamp()+interval '1 year'
    or length(trim(coalesce(p_reason,''))) not between 3 and 300 then raise exception 'Asset grant denied'; end if;
  if p_scope_kind='STORE' and not exists(select 1 from public.asset_stores where id=p_scope_id) then raise exception 'Invalid asset scope'; end if;
  if p_scope_kind='SITE' and not exists(select 1 from public.sites where id=p_scope_id) then raise exception 'Invalid asset scope'; end if;
  if p_scope_kind='SITE_SERVICE' and not exists(select 1 from public.site_services where id=p_scope_id) then raise exception 'Invalid asset scope'; end if;
  if p_scope_kind='EVENT' and not exists(select 1 from public.operational_events where id=p_scope_id) then raise exception 'Invalid asset scope'; end if;
  if p_scope_kind not in ('STORE','SITE','SITE_SERVICE','EVENT') then raise exception 'Invalid asset scope'; end if;
  insert into public.asset_capability_grants(person_id,scope_kind,store_id,site_id,site_service_id,event_id,effective_until,granted_by,grant_reason)
  values(p_person,p_scope_kind,case when p_scope_kind='STORE' then p_scope_id end,
    case when p_scope_kind='SITE' then p_scope_id end,case when p_scope_kind='SITE_SERVICE' then p_scope_id end,
    case when p_scope_kind='EVENT' then p_scope_id end,p_until,actor,trim(p_reason)) returning id into result;
  return result;
end $$;
revoke all on function public.asset_grant(uuid,text,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.asset_grant(uuid,text,uuid,timestamptz,text) to authenticated;

create function public.asset_revoke_grant(p_grant uuid,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id();
begin
  if actor is null or not private.has_active_role('SUPER_ADMIN') or length(trim(coalesce(p_reason,''))) not between 3 and 300
    then raise exception 'Asset grant revoke denied'; end if;
  update public.asset_capability_grants set revoked_at=transaction_timestamp(),revoked_by=actor,revocation_reason=trim(p_reason)
    where id=p_grant and revoked_at is null;
  return found;
end $$;
revoke all on function public.asset_revoke_grant(uuid,text) from public,anon,authenticated;
grant execute on function public.asset_revoke_grant(uuid,text) to authenticated;

create function public.asset_register(p_reference text,p_class text,p_description text,p_serial text,p_store uuid,p_condition text,p_request_key uuid)
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
  insert into public.asset_items(reference,class,description,serial,holder_store_id,condition,created_by)
    values(p_reference,p_class,trim(p_description),nullif(trim(p_serial),''),p_store,p_condition,actor) returning * into item;
  insert into public.asset_events(asset_id,revision,action,actor_person_id,holder_after,condition_after,maintenance_after,exception_after,to_holder_id)
    values(item.id,1,'REGISTER',actor,'STORE',item.condition,'NONE','NONE',p_store) returning id into ev;
  result:=pg_catalog.jsonb_build_object('id',item.id,'revision',1,'eventId',ev);
  insert into public.asset_requests(actor_person_id,request_key,action,target_id,request_hash,result)
    values(actor,p_request_key,'REGISTER',item.id,h,result);
  return result;
end $$;
revoke all on function public.asset_register(text,text,text,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.asset_register(text,text,text,text,uuid,text,uuid) to authenticated;

create function public.asset_act(p_asset uuid,p_action text,p_expected_revision integer,p_request_key uuid,
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
    if not (private.has_active_role('OFFICE_ADMIN') and p_action='RETIRE')
      and not private.asset_has_grant(actor,item.holder_kind,private.asset_holder_id(item))
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
revoke all on function public.asset_act(uuid,text,integer,uuid,text,uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.asset_act(uuid,text,integer,uuid,text,uuid,text,timestamptz,text) to authenticated;

create function public.asset_stock_create(p_sku text,p_garment text,p_size text,p_store uuid,p_opening integer,p_reason text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); h text; replay public.asset_requests%rowtype; row0 public.asset_stock%rowtype; ev uuid; result jsonb;
begin
  if actor is null or not private.has_active_role('OFFICE_ADMIN') or p_request_key is null
    or p_sku !~ '^[A-Z0-9][A-Z0-9-]{2,31}$' or length(trim(coalesce(p_garment,''))) not between 2 and 100
    or length(trim(coalesce(p_size,''))) not between 1 and 20 or p_opening<1
    or length(trim(coalesce(p_reason,''))) not between 3 and 500
    or not exists(select 1 from public.asset_stores where id=p_store) then raise exception 'Stock creation denied'; end if;
  h:=md5(concat_ws('|',p_sku,p_garment,p_size,p_store::text,p_opening::text,p_reason));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||p_request_key::text,0));
  select * into replay from public.asset_requests where actor_person_id=actor and request_key=p_request_key;
  if found then
    if replay.action<>'STOCK_CREATE' or replay.request_hash<>h then raise exception 'Idempotency conflict'; end if;
    return replay.result;
  end if;
  insert into public.asset_stock(sku,garment,size,store_id,available_quantity,created_by)
    values(p_sku,trim(p_garment),trim(p_size),p_store,p_opening,actor) returning * into row0;
  insert into public.asset_stock_events(stock_id,revision,action,quantity,actor_person_id,available_after,outstanding_after,reason)
    values(row0.id,1,'OPENING',p_opening,actor,p_opening,0,trim(p_reason)) returning id into ev;
  result:=pg_catalog.jsonb_build_object('id',row0.id,'revision',1,'eventId',ev);
  insert into public.asset_requests(actor_person_id,request_key,action,target_id,request_hash,result)
    values(actor,p_request_key,'STOCK_CREATE',row0.id,h,result);
  return result;
end $$;
revoke all on function public.asset_stock_create(text,text,text,uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.asset_stock_create(text,text,text,uuid,integer,text,uuid) to authenticated;

create function public.asset_stock_move(p_stock uuid,p_action text,p_quantity integer,p_person uuid,p_issue uuid,
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
revoke all on function public.asset_stock_move(uuid,text,integer,uuid,uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.asset_stock_move(uuid,text,integer,uuid,uuid,integer,uuid,text) to authenticated;

create function public.asset_stock_ack(p_issue uuid,p_dispute boolean,p_reason text,p_request_key uuid)
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
revoke all on function public.asset_stock_ack(uuid,boolean,text,uuid) from public,anon,authenticated;
grant execute on function public.asset_stock_ack(uuid,boolean,text,uuid) to authenticated;

create function public.asset_workspace() returns jsonb
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
        or (ops and private.asset_has_grant(actor,a.holder_kind,private.asset_holder_id(a)))), '[]'::jsonb),
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
revoke all on function public.asset_workspace() from public,anon,authenticated;
grant execute on function public.asset_workspace() to authenticated;

create function public.asset_history(p_asset uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); item public.asset_items%rowtype;
begin
  if actor is null then raise exception 'Asset access denied'; end if;
  select * into item from public.asset_items where id=p_asset;
  if not found or (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')
    or item.holder_person_id=actor or private.asset_has_grant(actor,item.holder_kind,private.asset_holder_id(item))) is not true
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
revoke all on function public.asset_history(uuid) from public,anon,authenticated;
grant execute on function public.asset_history(uuid) to authenticated;

create function public.asset_admin_choices() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if private.current_person_id() is null or not private.has_active_role('SUPER_ADMIN')
    then raise exception 'Asset administration denied'; end if;
  return pg_catalog.jsonb_build_object(
    'operations',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',p.id,'name',p.display_name))
      from public.people p where exists(select 1 from public.role_assignments r where r.person_id=p.id
        and r.role_code='OPERATIONS' and r.revoked_at is null
        and r.effective_from<=transaction_timestamp()
        and (r.effective_until is null or r.effective_until>transaction_timestamp()))), '[]'::jsonb),
    'scopes',coalesce((select pg_catalog.jsonb_agg(x.value) from (
      select pg_catalog.jsonb_build_object('kind','STORE','id',s.id,'name',s.name) value from public.asset_stores s
      union all select pg_catalog.jsonb_build_object('kind','SITE','id',s.id,'name',s.name) from public.sites s
      union all select pg_catalog.jsonb_build_object('kind','SITE_SERVICE','id',s.id,'name',s.name) from public.site_services s
      union all select pg_catalog.jsonb_build_object('kind','EVENT','id',e.id,'name',e.name) from public.operational_events e
    ) x), '[]'::jsonb),
    'grants',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',g.id,'personId',g.person_id,'scopeKind',g.scope_kind,
      'scopeId',coalesce(g.store_id,g.site_id,g.site_service_id,g.event_id),
      'effectiveUntil',g.effective_until,'revokedAt',g.revoked_at))
      from public.asset_capability_grants g where g.revoked_at is null and g.effective_until>transaction_timestamp()), '[]'::jsonb)
  );
end $$;
revoke all on function public.asset_admin_choices() from public,anon,authenticated;
grant execute on function public.asset_admin_choices() to authenticated;
