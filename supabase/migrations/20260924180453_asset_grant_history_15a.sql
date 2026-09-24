-- TASK-15A append-only privileged grant audit and business event tamper guard.
create table public.asset_grant_events (
 id uuid primary key default gen_random_uuid(),
 grant_id uuid not null references public.asset_capability_grants(id),
 kind text not null check (kind in ('GRANTED','REVOKED')),
 actor_person_id uuid not null references public.people(id),
 reason text not null check (length(trim(reason)) between 3 and 300),
 occurred_at timestamptz not null default transaction_timestamp(),
 unique(grant_id,kind)
);
create index asset_grant_event_actor_idx on public.asset_grant_events(actor_person_id,occurred_at);
insert into public.asset_grant_events(grant_id,kind,actor_person_id,reason,occurred_at)
 select id,'GRANTED',granted_by,grant_reason,created_at from public.asset_capability_grants;
insert into public.asset_grant_events(grant_id,kind,actor_person_id,reason,occurred_at)
 select id,'REVOKED',revoked_by,revocation_reason,revoked_at from public.asset_capability_grants where revoked_at is not null;
alter table public.asset_grant_events enable row level security;
revoke all on public.asset_grant_events from public,anon,authenticated;
create function private.asset_history_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Asset business history is immutable'; end $$;
revoke all on function private.asset_history_immutable() from public,anon,authenticated;
create trigger asset_events_immutable before update or delete on public.asset_events
 for each row execute function private.asset_history_immutable();
create trigger asset_stock_events_immutable before update or delete on public.asset_stock_events
 for each row execute function private.asset_history_immutable();
create trigger asset_grant_events_immutable before update or delete on public.asset_grant_events
 for each row execute function private.asset_history_immutable();
create or replace function public.asset_grant(p_person uuid,p_scope_kind text,p_scope_id uuid,p_until timestamptz,p_reason text)
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
  insert into public.asset_grant_events(grant_id,kind,actor_person_id,reason)
    values(result,'GRANTED',actor,trim(p_reason));
  return result;
end $$;
create or replace function public.asset_revoke_grant(p_grant uuid,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id();
begin
  if actor is null or not private.has_active_role('SUPER_ADMIN') or length(trim(coalesce(p_reason,''))) not between 3 and 300
    then raise exception 'Asset grant revoke denied'; end if;
  update public.asset_capability_grants set revoked_at=transaction_timestamp(),revoked_by=actor,revocation_reason=trim(p_reason)
    where id=p_grant and revoked_at is null;
  if found then
    insert into public.asset_grant_events(grant_id,kind,actor_person_id,reason)
      values(p_grant,'REVOKED',actor,trim(p_reason));
  end if;
  return found;
end $$;
