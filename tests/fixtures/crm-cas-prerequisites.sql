-- DISPOSABLE LOCAL TEST ONLY: source prerequisites, not hosted Auth/RLS parity.
-- current_person_id/has_active_role below are explicit synthetic session adapters.
create schema private;
create role anon nologin;
create role authenticated nologin;
grant usage on schema public,private to authenticated;
create table public.people(id uuid primary key);
create table public.role_assignments(person_id uuid references public.people(id),role_code text,
 revoked_at timestamptz,effective_from timestamptz default '-infinity',effective_until timestamptz);
create table public.crm_organisations(id uuid primary key);
create table public.crm_opportunities(id uuid primary key);
-- Matches the source foundation SELECT grants needed by the task RLS policy.
grant select on public.crm_organisations,public.crm_opportunities to authenticated;
create table public.audit_events(id uuid primary key default gen_random_uuid(),actor_person_id uuid,
 affected_person_id uuid,entity_type text,entity_id uuid,action text,after_value jsonb);
create function private.current_person_id() returns uuid language sql stable as $$
 select nullif(current_setting('fixture.person',true),'')::uuid
$$;
create function private.has_active_role(code text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.role_assignments where person_id=private.current_person_id()
 and role_code=code and revoked_at is null and effective_from<=now() and (effective_until is null or effective_until>now()))
$$;
create function private.fixture_audit_fail() returns trigger language plpgsql as $$
begin
 if current_setting('fixture.audit_fail',true)='on' then raise exception 'Synthetic audit failure'; end if;
 return new;
end $$;
create trigger fixture_audit_failure before insert on public.audit_events for each row execute function private.fixture_audit_fail();

-- Only the ABA scenario temporarily uses ordered synthetic event IDs. This makes
-- same-transaction event tie ordering deterministic without replacing any guard.
create sequence private.fixture_event_ids start 1000000;
create function private.fixture_ordered_event_uuid() returns uuid language sql volatile as $$
 select ('00000000-0000-4000-8000-'||lpad(nextval('private.fixture_event_ids')::text,12,'0'))::uuid
$$;
