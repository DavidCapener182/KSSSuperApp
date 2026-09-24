-- TASK-14A synthetic Dev Site Service book. All exposed tables have RLS and no direct client grants.
create table public.site_book_grants (
 id uuid primary key default gen_random_uuid(), service_id uuid not null references public.site_services(id), person_id uuid not null references public.people(id),
 kind text not null check(kind in ('CONTRIBUTOR','MANAGER')), valid_from timestamptz not null, valid_until timestamptz not null,
 reason text not null check(length(trim(reason)) between 3 and 300), issued_by uuid not null references public.people(id), issued_at timestamptz not null default transaction_timestamp(),
 revoked_by uuid references public.people(id), revoked_at timestamptz, revoke_reason text,
 check(valid_until>valid_from), check((revoked_at is null and revoked_by is null and revoke_reason is null) or (revoked_at is not null and revoked_by is not null and length(trim(revoke_reason))>=3))
);
create index site_book_grants_scope_idx on public.site_book_grants(person_id,service_id,kind,valid_from,valid_until) where revoked_at is null;
create table public.site_book_grant_events (
 id uuid primary key default gen_random_uuid(), grant_id uuid not null references public.site_book_grants(id), kind text not null check(kind in ('ISSUED','REVOKED')),
 actor_person_id uuid not null references public.people(id), reason text not null, recorded_at timestamptz not null default transaction_timestamp()
);
create table public.site_book_entries (
 id uuid primary key default gen_random_uuid(), service_id uuid not null references public.site_services(id), demand_id uuid, allocation_id uuid,
 author_person_id uuid not null references public.people(id), entry_type text not null check(entry_type in ('VISITOR_CONTRACTOR_DELIVERY','KEYS_EQUIPMENT','MAINTENANCE','CLIENT_INSTRUCTION','ROUTINE_OBSERVATION','HANDOVER','OUTSTANDING_ITEM')),
 source_kind text not null check(source_kind in ('OBSERVED','REPORTED_TO_ME')), current_version integer not null default 1 check(current_version>0),
 recorded_at timestamptz not null default transaction_timestamp(),
 foreign key(demand_id,service_id) references public.site_shift_demands(id,service_id),
 foreign key(allocation_id,demand_id) references public.site_shift_allocations(id,demand_id), unique(id,service_id)
);
create index site_book_entries_service_idx on public.site_book_entries(service_id,recorded_at desc,id);
create table public.site_book_entry_versions (
 id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.site_book_entries(id), version integer not null check(version>0),
 occurred_at timestamptz not null, original_local text not null check(length(original_local) between 16 and 35), source_offset text not null check(source_offset ~ '^[+-][0-9]{2}:[0-9]{2}$'),
 body text not null check(length(trim(body)) between 5 and 1200 and body !~ '[[:cntrl:]]'),
 actor_person_id uuid not null references public.people(id), correction_reason text, recorded_at timestamptz not null default transaction_timestamp(),
 unique(entry_id,version), check((version=1 and correction_reason is null) or (version>1 and length(trim(correction_reason)) between 3 and 300))
);
create table public.site_book_items (
 id uuid primary key default gen_random_uuid(), service_id uuid not null, entry_id uuid not null unique, status text not null default 'OPEN' check(status in ('OPEN','RESOLVED')),
 revision integer not null default 1 check(revision>0), created_at timestamptz not null default transaction_timestamp(),
 foreign key(entry_id,service_id) references public.site_book_entries(id,service_id), unique(id,service_id)
);
create index site_book_items_open_idx on public.site_book_items(service_id,status,created_at,id);
create table public.site_book_item_events (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references public.site_book_items(id), revision integer not null,
 kind text not null check(kind in ('OPENED','UPDATED','RESOLVED','REOPENED')), actor_person_id uuid not null references public.people(id),
 note text not null check(length(trim(note)) between 3 and 600 and note !~ '[[:cntrl:]]'), reason text,
 recorded_at timestamptz not null default transaction_timestamp(), unique(item_id,revision),
 check((kind in ('RESOLVED','REOPENED') and length(trim(reason)) between 3 and 300) or (kind in ('OPENED','UPDATED') and reason is null))
);
create table public.site_book_handovers (
 id uuid primary key default gen_random_uuid(), service_id uuid not null references public.site_services(id), outgoing_from timestamptz not null, outgoing_until timestamptz not null,
 created_by uuid not null references public.people(id), created_at timestamptz not null default transaction_timestamp(), revision integer not null default 1 check(revision>0),
 closed_at timestamptz, closed_by uuid references public.people(id), close_reason text, check(outgoing_until>outgoing_from and outgoing_until<=outgoing_from+interval '24 hours'),
 check((closed_at is null and closed_by is null and close_reason is null) or (closed_at is not null and closed_by is not null and length(trim(close_reason)) between 3 and 300))
);
create index site_book_handover_latest_idx on public.site_book_handovers(service_id,created_at desc,id);
create table public.site_book_handover_events (
 id uuid primary key default gen_random_uuid(), handover_id uuid not null references public.site_book_handovers(id), revision integer not null,
 kind text not null check(kind in ('STARTED','CONTRIBUTED','CLOSED')), actor_person_id uuid not null references public.people(id),
 body text not null check(length(trim(body)) between 3 and 1200 and body !~ '[[:cntrl:]]'), recorded_at timestamptz not null default transaction_timestamp(), unique(handover_id,revision)
);
create table public.site_book_acknowledgements (
 id uuid primary key default gen_random_uuid(), handover_id uuid not null references public.site_book_handovers(id), revision integer not null,
 receiver_person_id uuid not null references public.people(id), recorded_at timestamptz not null default transaction_timestamp(), unique(handover_id,revision,receiver_person_id),
 foreign key(handover_id,revision) references public.site_book_handover_events(handover_id,revision)
);
create table public.site_book_idempotency (
 actor_person_id uuid not null references public.people(id), idempotency_key uuid not null, action text not null, payload_hash text not null,
 result jsonb not null, recorded_at timestamptz not null default transaction_timestamp(), primary key(actor_person_id,idempotency_key)
);
create table public.site_book_access_audit (
 id uuid primary key default gen_random_uuid(), service_id uuid not null references public.site_services(id), actor_person_id uuid not null references public.people(id),
 action text not null, target_id uuid, recorded_at timestamptz not null default transaction_timestamp()
);
alter table public.site_book_grants enable row level security;
alter table public.site_book_grant_events enable row level security;
alter table public.site_book_entries enable row level security;
alter table public.site_book_entry_versions enable row level security;
alter table public.site_book_items enable row level security;
alter table public.site_book_item_events enable row level security;
alter table public.site_book_handovers enable row level security;
alter table public.site_book_handover_events enable row level security;
alter table public.site_book_acknowledgements enable row level security;
alter table public.site_book_idempotency enable row level security;
alter table public.site_book_access_audit enable row level security;
revoke all on public.site_book_grants,public.site_book_grant_events,public.site_book_entries,public.site_book_entry_versions,public.site_book_items,
 public.site_book_item_events,public.site_book_handovers,public.site_book_handover_events,public.site_book_acknowledgements,public.site_book_idempotency,
 public.site_book_access_audit from public,anon,authenticated;

create function private.site_book_manager_14a(p_service uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.current_person_id() is not null and (
  private.has_active_role('SUPER_ADMIN') or
  (private.has_active_role('OPERATIONS') and private.operational_authorised() and exists(
   select 1 from public.site_book_grants g where g.service_id=p_service and g.person_id=private.current_person_id() and g.kind='MANAGER'
    and g.revoked_at is null and g.valid_from<=transaction_timestamp() and g.valid_until>transaction_timestamp())))
$$;
revoke all on function private.site_book_manager_14a(uuid) from public,anon,authenticated;
create function private.site_book_staff_14a(p_service uuid,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_active_role('SECURITY_STAFF') and (
  exists(select 1 from public.site_book_grants g where g.service_id=p_service and g.person_id=private.current_person_id() and g.kind='CONTRIBUTOR'
   and g.revoked_at is null and g.valid_from<=transaction_timestamp() and g.valid_until>transaction_timestamp())
  or exists(select 1 from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
   where d.service_id=p_service and a.person_id=private.current_person_id() and a.status in ('ALLOCATED','ACCEPTED') and d.state='PLANNED'
   and transaction_timestamp() >= d.report_at - (case when p_write then interval '1 hour' else interval '48 hours' end)
   and transaction_timestamp() <= d.shift_ends_at + (case when p_write then interval '1 hour' else interval '48 hours' end)))
$$;
revoke all on function private.site_book_staff_14a(uuid,boolean) from public,anon,authenticated;
create function private.site_book_can_read_14a(p_service uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.site_book_staff_14a(p_service,false) or private.site_book_manager_14a(p_service)
$$;
revoke all on function private.site_book_can_read_14a(uuid) from public,anon,authenticated;
create function private.site_book_can_write_14a(p_service uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (private.site_book_staff_14a(p_service,true) or private.site_book_manager_14a(p_service))
 and exists(select 1 from public.site_services s where s.id=p_service and s.state<>'ENDED')
$$;
revoke all on function private.site_book_can_write_14a(uuid) from public,anon,authenticated;
create function private.site_book_same_request_14a(p_key uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.site_book_idempotency%rowtype;
begin
 if p_key is null then raise exception 'Book request denied'; end if;
 select * into old from public.site_book_idempotency where actor_person_id=private.current_person_id() and idempotency_key=p_key;
 if found then
  if old.action<>p_action or old.payload_hash<>md5(p_payload::text) then raise exception 'Book request key reused with changed content'; end if;
  return old.result;
 end if;
 return null;
end $$;
revoke all on function private.site_book_same_request_14a(uuid,text,jsonb) from public,anon,authenticated;

create function public.site_book_grant_issue(p_service uuid,p_person uuid,p_kind text,p_from timestamptz,p_until timestamptz,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); s public.site_services%rowtype; result uuid;
begin
 select * into s from public.site_services where id=p_service;
 if actor is null or s.id is null or not (private.has_active_role('SUPER_ADMIN') or (private.has_active_role('OFFICE_ADMIN') and private.office_owns_site(s.site_id)))
 or p_person is null or p_kind not in ('CONTRIBUTOR','MANAGER') or p_from is null or p_until is null or p_from>=p_until
 or p_until>p_from+interval '366 days' or length(trim(p_reason)) not between 3 and 300
 or not exists(select 1 from public.people where id=p_person)
 or (p_kind='CONTRIBUTOR' and not private.has_active_role_for_person(p_person,'SECURITY_STAFF'))
 or (p_kind='MANAGER' and not private.has_active_role_for_person(p_person,'OPERATIONS')) then raise exception 'Book grant denied'; end if;
 insert into public.site_book_grants(service_id,person_id,kind,valid_from,valid_until,reason,issued_by)
 values(p_service,p_person,p_kind,p_from,p_until,trim(p_reason),actor) returning id into result;
 insert into public.site_book_grant_events(grant_id,kind,actor_person_id,reason) values(result,'ISSUED',actor,trim(p_reason));
 return result;
end $$;
revoke all on function public.site_book_grant_issue(uuid,uuid,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.site_book_grant_issue(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;
create function public.site_book_grant_revoke(p_grant uuid,p_reason text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); g public.site_book_grants%rowtype; site uuid;
begin
 select * into g from public.site_book_grants where id=p_grant for update;
 select site_id into site from public.site_services where id=g.service_id;
 if actor is null or g.id is null or g.revoked_at is not null or length(trim(p_reason)) not between 3 and 300
 or not (private.has_active_role('SUPER_ADMIN') or (private.has_active_role('OFFICE_ADMIN') and private.office_owns_site(site))) then raise exception 'Book grant denied'; end if;
 update public.site_book_grants set revoked_by=actor,revoked_at=transaction_timestamp(),revoke_reason=trim(p_reason) where id=p_grant;
 insert into public.site_book_grant_events(grant_id,kind,actor_person_id,reason) values(p_grant,'REVOKED',actor,trim(p_reason));
 return true;
end $$;
revoke all on function public.site_book_grant_revoke(uuid,text) from public,anon,authenticated;
grant execute on function public.site_book_grant_revoke(uuid,text) to authenticated;
create function public.site_book_grants_list(p_service uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); site uuid; result jsonb;
begin
 select site_id into site from public.site_services where id=p_service;
 if actor is null or site is null or not (private.has_active_role('SUPER_ADMIN') or (private.has_active_role('OFFICE_ADMIN') and private.office_owns_site(site))) then raise exception 'Book grant denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'personId',g.person_id,'personName',p.display_name,'kind',g.kind,'from',g.valid_from,'until',g.valid_until,'reason',g.reason,'revokedAt',g.revoked_at) order by g.issued_at desc), '[]'::jsonb)
 into result from public.site_book_grants g join public.people p on p.id=g.person_id where g.service_id=p_service;
 return result;
end $$;
revoke all on function public.site_book_grants_list(uuid) from public,anon,authenticated;
grant execute on function public.site_book_grants_list(uuid) to authenticated;

create function public.site_book_services_14a() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null then raise exception 'Book access denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'siteName',t.name,'siteId',s.site_id) order by s.name,s.id),'[]'::jsonb) into result
 from public.site_services s join public.sites t on t.id=s.site_id where private.site_book_can_read_14a(s.id);
 return result;
end $$;
revoke all on function public.site_book_services_14a() from public,anon,authenticated;
grant execute on function public.site_book_services_14a() to authenticated;

create function public.site_book_submit_14a(p_service uuid,p_demand uuid,p_allocation uuid,p_type text,p_source text,p_occurred timestamptz,
 p_local text,p_offset text,p_body text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); payload jsonb; prior jsonb; result uuid; item uuid;
begin
 payload:=jsonb_build_object('service',p_service,'demand',p_demand,'allocation',p_allocation,'type',p_type,'source',p_source,'occurred',p_occurred,'local',p_local,'offset',p_offset,'body',p_body);
 prior:=private.site_book_same_request_14a(p_key,'SUBMIT',payload); if prior is not null then return prior; end if;
 if actor is null or not private.site_book_can_write_14a(p_service) or p_type not in ('VISITOR_CONTRACTOR_DELIVERY','KEYS_EQUIPMENT','MAINTENANCE','CLIENT_INSTRUCTION','ROUTINE_OBSERVATION','HANDOVER','OUTSTANDING_ITEM')
 or p_source not in ('OBSERVED','REPORTED_TO_ME') or p_occurred is null or p_occurred>transaction_timestamp()+interval '5 minutes'
 or p_occurred<transaction_timestamp()-interval '30 days' or p_local is null or to_char(p_occurred at time zone 'Europe/London','YYYY-MM-DD"T"HH24:MI')<>p_local
 or p_offset !~ '^[+-][0-9]{2}:[0-9]{2}$' or length(trim(p_body)) not between 5 and 1200 or p_body ~ '[[:cntrl:]]' then raise exception 'Book entry denied'; end if;
 if p_demand is not null and not exists(select 1 from public.site_shift_demands where id=p_demand and service_id=p_service) then raise exception 'Book context denied'; end if;
 if p_allocation is not null and (p_demand is null or not exists(select 1 from public.site_shift_allocations a where a.id=p_allocation and a.demand_id=p_demand
  and (a.person_id=actor or private.site_book_manager_14a(p_service)))) then raise exception 'Book context denied'; end if;
 insert into public.site_book_entries(service_id,demand_id,allocation_id,author_person_id,entry_type,source_kind)
 values(p_service,p_demand,p_allocation,actor,p_type,p_source) returning id into result;
 insert into public.site_book_entry_versions(entry_id,version,occurred_at,original_local,source_offset,body,actor_person_id)
 values(result,1,p_occurred,p_local,p_offset,trim(p_body),actor);
 if p_type='OUTSTANDING_ITEM' then
  insert into public.site_book_items(service_id,entry_id) values(p_service,result) returning id into item;
  insert into public.site_book_item_events(item_id,revision,kind,actor_person_id,note) values(item,1,'OPENED',actor,trim(p_body));
 end if;
 insert into public.site_book_access_audit(service_id,actor_person_id,action,target_id) values(p_service,actor,'ENTRY_SUBMITTED',result);
 prior:=jsonb_build_object('entryId',result,'itemId',item,'version',1);
 insert into public.site_book_idempotency(actor_person_id,idempotency_key,action,payload_hash,result) values(actor,p_key,'SUBMIT',md5(payload::text),prior);
 return prior;
end $$;
revoke all on function public.site_book_submit_14a(uuid,uuid,uuid,text,text,timestamptz,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.site_book_submit_14a(uuid,uuid,uuid,text,text,timestamptz,text,text,text,uuid) to authenticated;

create function public.site_book_correct_14a(p_entry uuid,p_expected integer,p_occurred timestamptz,p_local text,p_offset text,p_body text,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); e public.site_book_entries%rowtype; payload jsonb; prior jsonb; version integer;
begin
 payload:=jsonb_build_object('entry',p_entry,'expected',p_expected,'occurred',p_occurred,'local',p_local,'offset',p_offset,'body',p_body,'reason',p_reason);
 prior:=private.site_book_same_request_14a(p_key,'CORRECT',payload); if prior is not null then return prior; end if;
 select * into e from public.site_book_entries where id=p_entry for update;
 if actor is null or e.id is null or not private.site_book_can_read_14a(e.service_id) or not (e.author_person_id=actor and private.site_book_staff_14a(e.service_id,true) or private.site_book_manager_14a(e.service_id))
 or p_expected is distinct from e.current_version or p_occurred is null or p_occurred>transaction_timestamp()+interval '5 minutes'
 or p_local is null or to_char(p_occurred at time zone 'Europe/London','YYYY-MM-DD"T"HH24:MI')<>p_local or p_offset !~ '^[+-][0-9]{2}:[0-9]{2}$'
 or length(trim(p_body)) not between 5 and 1200 or p_body ~ '[[:cntrl:]]' or length(trim(p_reason)) not between 3 and 300 then raise exception 'Book correction denied or stale'; end if;
 version:=e.current_version+1;
 insert into public.site_book_entry_versions(entry_id,version,occurred_at,original_local,source_offset,body,actor_person_id,correction_reason)
 values(p_entry,version,p_occurred,p_local,p_offset,trim(p_body),actor,trim(p_reason));
 update public.site_book_entries set current_version=version where id=p_entry;
 insert into public.site_book_access_audit(service_id,actor_person_id,action,target_id) values(e.service_id,actor,'ENTRY_CORRECTED',p_entry);
 prior:=jsonb_build_object('entryId',p_entry,'version',version);
 insert into public.site_book_idempotency(actor_person_id,idempotency_key,action,payload_hash,result) values(actor,p_key,'CORRECT',md5(payload::text),prior);
 return prior;
end $$;
revoke all on function public.site_book_correct_14a(uuid,integer,timestamptz,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.site_book_correct_14a(uuid,integer,timestamptz,text,text,text,text,uuid) to authenticated;

create function public.site_book_item_action_14a(p_item uuid,p_expected integer,p_action text,p_note text,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); i public.site_book_items%rowtype; e public.site_book_entries%rowtype; payload jsonb; prior jsonb; next_revision integer; next_status text;
begin
 payload:=jsonb_build_object('item',p_item,'expected',p_expected,'action',p_action,'note',p_note,'reason',p_reason);
 prior:=private.site_book_same_request_14a(p_key,'ITEM_ACTION',payload); if prior is not null then return prior; end if;
 select * into i from public.site_book_items where id=p_item for update;
 select * into e from public.site_book_entries where id=i.entry_id;
 if actor is null or i.id is null or not private.site_book_can_write_14a(i.service_id) or p_expected is distinct from i.revision
 or p_action not in ('UPDATED','RESOLVED','REOPENED') or length(trim(p_note)) not between 3 and 600 or p_note ~ '[[:cntrl:]]'
 or (p_action in ('RESOLVED','REOPENED') and length(trim(p_reason)) not between 3 and 300)
 or (p_action='UPDATED' and p_reason is not null)
 or (p_action='REOPENED' and i.status<>'RESOLVED') or (p_action in ('UPDATED','RESOLVED') and i.status<>'OPEN')
 or (not private.site_book_manager_14a(i.service_id) and (not private.site_book_staff_14a(i.service_id,true) or e.author_person_id<>actor))
 then raise exception 'Book item action denied or stale'; end if;
 next_revision:=i.revision+1; next_status:=case when p_action='RESOLVED' then 'RESOLVED' else 'OPEN' end;
 insert into public.site_book_item_events(item_id,revision,kind,actor_person_id,note,reason)
 values(i.id,next_revision,p_action,actor,trim(p_note),case when p_reason is null then null else trim(p_reason) end);
 update public.site_book_items set status=next_status,revision=next_revision where id=i.id;
 insert into public.site_book_access_audit(service_id,actor_person_id,action,target_id) values(i.service_id,actor,p_action,i.id);
 prior:=jsonb_build_object('itemId',i.id,'revision',next_revision,'status',next_status);
 insert into public.site_book_idempotency(actor_person_id,idempotency_key,action,payload_hash,result) values(actor,p_key,'ITEM_ACTION',md5(payload::text),prior);
 return prior;
end $$;
revoke all on function public.site_book_item_action_14a(uuid,integer,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.site_book_item_action_14a(uuid,integer,text,text,text,uuid) to authenticated;

create function public.site_book_handover_start_14a(p_service uuid,p_from timestamptz,p_until timestamptz,p_body text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); payload jsonb; prior jsonb; result uuid;
begin
 payload:=jsonb_build_object('service',p_service,'from',p_from,'until',p_until,'body',p_body);
 prior:=private.site_book_same_request_14a(p_key,'HANDOVER_START',payload); if prior is not null then return prior; end if;
 if actor is null or not private.site_book_can_write_14a(p_service) or p_from is null or p_until is null or p_until<=p_from or p_until>p_from+interval '24 hours'
 or length(trim(p_body)) not between 3 and 1200 or p_body ~ '[[:cntrl:]]' then raise exception 'Book handover denied'; end if;
 insert into public.site_book_handovers(service_id,outgoing_from,outgoing_until,created_by) values(p_service,p_from,p_until,actor) returning id into result;
 insert into public.site_book_handover_events(handover_id,revision,kind,actor_person_id,body) values(result,1,'STARTED',actor,trim(p_body));
 insert into public.site_book_access_audit(service_id,actor_person_id,action,target_id) values(p_service,actor,'HANDOVER_STARTED',result);
 prior:=jsonb_build_object('handoverId',result,'revision',1);
 insert into public.site_book_idempotency(actor_person_id,idempotency_key,action,payload_hash,result) values(actor,p_key,'HANDOVER_START',md5(payload::text),prior);
 return prior;
end $$;
revoke all on function public.site_book_handover_start_14a(uuid,timestamptz,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function public.site_book_handover_start_14a(uuid,timestamptz,timestamptz,text,uuid) to authenticated;
create function public.site_book_handover_contribute_14a(p_handover uuid,p_expected integer,p_body text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); h public.site_book_handovers%rowtype; payload jsonb; prior jsonb; next_revision integer;
begin
 payload:=jsonb_build_object('handover',p_handover,'expected',p_expected,'body',p_body);
 prior:=private.site_book_same_request_14a(p_key,'HANDOVER_CONTRIBUTE',payload); if prior is not null then return prior; end if;
 select * into h from public.site_book_handovers where id=p_handover for update;
 if actor is null or h.id is null or h.closed_at is not null or not private.site_book_can_write_14a(h.service_id)
 or p_expected is distinct from h.revision or length(trim(p_body)) not between 3 and 1200 or p_body ~ '[[:cntrl:]]' then raise exception 'Book handover denied or stale'; end if;
 next_revision:=h.revision+1;
 insert into public.site_book_handover_events(handover_id,revision,kind,actor_person_id,body) values(h.id,next_revision,'CONTRIBUTED',actor,trim(p_body));
 update public.site_book_handovers set revision=next_revision where id=h.id;
 insert into public.site_book_access_audit(service_id,actor_person_id,action,target_id) values(h.service_id,actor,'HANDOVER_CONTRIBUTED',h.id);
 prior:=jsonb_build_object('handoverId',h.id,'revision',next_revision);
 insert into public.site_book_idempotency(actor_person_id,idempotency_key,action,payload_hash,result) values(actor,p_key,'HANDOVER_CONTRIBUTE',md5(payload::text),prior);
 return prior;
end $$;
revoke all on function public.site_book_handover_contribute_14a(uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.site_book_handover_contribute_14a(uuid,integer,text,uuid) to authenticated;
create function public.site_book_handover_ack_14a(p_handover uuid,p_revision integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); h public.site_book_handovers%rowtype; payload jsonb; prior jsonb; result uuid;
begin
 payload:=jsonb_build_object('handover',p_handover,'revision',p_revision);
 prior:=private.site_book_same_request_14a(p_key,'HANDOVER_ACK',payload); if prior is not null then return prior; end if;
 select * into h from public.site_book_handovers where id=p_handover for update;
 if actor is null or h.id is null or h.closed_at is not null or not private.site_book_staff_14a(h.service_id,true)
 or p_revision is distinct from h.revision then raise exception 'Book acknowledgement denied or stale'; end if;
 insert into public.site_book_acknowledgements(handover_id,revision,receiver_person_id) values(h.id,p_revision,actor)
 on conflict(handover_id,revision,receiver_person_id) do nothing;
 select id into result from public.site_book_acknowledgements where handover_id=h.id and revision=p_revision and receiver_person_id=actor;
 insert into public.site_book_access_audit(service_id,actor_person_id,action,target_id) values(h.service_id,actor,'HANDOVER_ACKNOWLEDGED',h.id);
 prior:=jsonb_build_object('handoverId',h.id,'revision',p_revision,'acknowledgementId',result);
 insert into public.site_book_idempotency(actor_person_id,idempotency_key,action,payload_hash,result) values(actor,p_key,'HANDOVER_ACK',md5(payload::text),prior);
 return prior;
end $$;
revoke all on function public.site_book_handover_ack_14a(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.site_book_handover_ack_14a(uuid,integer,uuid) to authenticated;
create function public.site_book_handover_close_14a(p_handover uuid,p_expected integer,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); h public.site_book_handovers%rowtype; next_revision integer;
begin
 select * into h from public.site_book_handovers where id=p_handover for update;
 if actor is null or h.id is null or not private.site_book_manager_14a(h.service_id) or h.closed_at is not null
 or p_expected is distinct from h.revision or length(trim(p_reason)) not between 3 and 300 then raise exception 'Book handover close denied or stale'; end if;
 next_revision:=h.revision+1;
 insert into public.site_book_handover_events(handover_id,revision,kind,actor_person_id,body) values(h.id,next_revision,'CLOSED',actor,trim(p_reason));
 update public.site_book_handovers set revision=next_revision,closed_by=actor,closed_at=transaction_timestamp(),close_reason=trim(p_reason) where id=h.id;
 insert into public.site_book_access_audit(service_id,actor_person_id,action,target_id) values(h.service_id,actor,'HANDOVER_CLOSED',h.id);
 return true;
end $$;
revoke all on function public.site_book_handover_close_14a(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.site_book_handover_close_14a(uuid,integer,text) to authenticated;

create function public.site_book_next_shift_14a(p_service uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); svc public.site_services%rowtype; h public.site_book_handovers%rowtype;
 open_rows jsonb; notes jsonb; handover_events jsonb; acks jsonb; open_total integer; own_ack timestamptz;
begin
 if actor is null or not private.site_book_can_read_14a(p_service) or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Book access denied'; end if;
 select * into svc from public.site_services where id=p_service;
 if svc.id is null then raise exception 'Book access denied'; end if;
 select count(*) into open_total from public.site_book_items where service_id=p_service and status='OPEN';
 select coalesce(jsonb_agg(x.row order by x.created_at,x.id),'[]'::jsonb) into open_rows from (
  select i.created_at,i.id,jsonb_build_object('id',i.id,'status',i.status,'revision',i.revision,'entryId',i.entry_id,
   'body',v.body,'occurredAt',v.occurred_at,'recordedAt',v.recorded_at,'author',p.display_name,
   'history',(select coalesce(jsonb_agg(jsonb_build_object('kind',ev.kind,'revision',ev.revision,'note',ev.note,'reason',ev.reason,'actor',ep.display_name,'recordedAt',ev.recorded_at) order by ev.revision),'[]'::jsonb)
    from public.site_book_item_events ev join public.people ep on ep.id=ev.actor_person_id where ev.item_id=i.id)) as row
  from public.site_book_items i join public.site_book_entries e on e.id=i.entry_id
  join public.site_book_entry_versions v on v.entry_id=e.id and v.version=e.current_version join public.people p on p.id=e.author_person_id
  where i.service_id=p_service and i.status='OPEN' order by i.created_at,i.id limit 100 offset p_offset
 ) x;
 select coalesce(jsonb_agg(x.row order by x.recorded_at desc,x.id desc),'[]'::jsonb) into notes from (
  select e.id,v.recorded_at,jsonb_build_object('id',e.id,'type',e.entry_type,'source',e.source_kind,'version',e.current_version,
   'body',v.body,'occurredAt',v.occurred_at,'recordedAt',v.recorded_at,'author',p.display_name,'itemId',i.id,
   'history',(select coalesce(jsonb_agg(jsonb_build_object('version',old.version,'body',old.body,'occurredAt',old.occurred_at,'recordedAt',old.recorded_at,'actor',ap.display_name,'reason',old.correction_reason) order by old.version),'[]'::jsonb)
    from public.site_book_entry_versions old join public.people ap on ap.id=old.actor_person_id where old.entry_id=e.id)) as row
  from public.site_book_entries e join public.site_book_entry_versions v on v.entry_id=e.id and v.version=e.current_version
  join public.people p on p.id=e.author_person_id left join public.site_book_items i on i.entry_id=e.id
  where e.service_id=p_service and e.recorded_at>=transaction_timestamp()-interval '48 hours'
  order by e.recorded_at desc,e.id desc limit 25
 ) x;
 select * into h from public.site_book_handovers where service_id=p_service order by created_at desc,id desc limit 1;
 if h.id is not null then
  select coalesce(jsonb_agg(jsonb_build_object('revision',ev.revision,'kind',ev.kind,'body',ev.body,'actor',p.display_name,'recordedAt',ev.recorded_at) order by ev.revision),'[]'::jsonb)
   into handover_events from public.site_book_handover_events ev join public.people p on p.id=ev.actor_person_id where ev.handover_id=h.id;
  select coalesce(jsonb_agg(jsonb_build_object('revision',a.revision,'receiver',p.display_name,'receiverId',a.receiver_person_id,'recordedAt',a.recorded_at) order by a.recorded_at),'[]'::jsonb)
   into acks from public.site_book_acknowledgements a join public.people p on p.id=a.receiver_person_id where a.handover_id=h.id;
  select a.recorded_at into own_ack from public.site_book_acknowledgements a where a.handover_id=h.id and a.revision=h.revision and a.receiver_person_id=actor;
 end if;
 if private.site_book_manager_14a(p_service) then
  insert into public.site_book_access_audit(service_id,actor_person_id,action,target_id) values(p_service,actor,'BOOK_READ',h.id);
 end if;
 return jsonb_build_object('service',jsonb_build_object('id',svc.id,'name',svc.name,'siteId',svc.site_id,'siteName',(select name from public.sites where id=svc.site_id)),
  'canWrite',private.site_book_can_write_14a(p_service),'manager',private.site_book_manager_14a(p_service),'actorId',actor,
  'openTotal',open_total,'openItems',open_rows,'recentNotes',notes,
  'handover',case when h.id is null then null else jsonb_build_object('id',h.id,'revision',h.revision,'from',h.outgoing_from,'until',h.outgoing_until,
   'createdAt',h.created_at,'createdBy',(select display_name from public.people where id=h.created_by),'closedAt',h.closed_at,
   'closeReason',h.close_reason,'events',handover_events,'acknowledgements',acks,'acknowledgedByYouAt',own_ack) end);
end $$;
revoke all on function public.site_book_next_shift_14a(uuid,integer) from public,anon,authenticated;
grant execute on function public.site_book_next_shift_14a(uuid,integer) to authenticated;

comment on table public.site_book_entries is 'TASK-14A synthetic Dev routine Site Service book; incident and patrol records remain separate.';
comment on table public.site_book_acknowledgements is 'One exact handover revision and receiver Person per acknowledgement; no shared team acknowledgement.';
