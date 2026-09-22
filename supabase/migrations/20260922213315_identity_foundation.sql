-- TASK-01B: KSS Enterprise development identity and scoped access foundation.
-- Dedicated project only. Additive migration; no production identities or data.
create schema private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  provider text not null check (provider in ('supabase', 'entra')),
  provider_subject text not null check (length(trim(provider_subject)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (provider, provider_subject),
  unique (person_id, provider)
);
create index auth_identities_person_id_idx on public.auth_identities(person_id);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  role_code text not null check (role_code in ('SUPER_ADMIN', 'OFFICE_ADMIN', 'OPERATIONS', 'SECURITY_STAFF')),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  revoked_at timestamptz,
  granted_by uuid references public.people(id),
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);
create index role_assignments_person_role_idx on public.role_assignments(person_id, role_code);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.site_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  site_id uuid not null references public.sites(id),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  revoked_at timestamptz,
  granted_by uuid references public.people(id),
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);
create index site_assignments_person_site_idx on public.site_assignments(person_id, site_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_person_id uuid references public.people(id),
  affected_person_id uuid not null references public.people(id),
  entity_type text not null check (entity_type in ('role_assignment', 'site_assignment')),
  entity_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE')),
  before_value jsonb,
  after_value jsonb,
  occurred_at timestamptz not null default now()
);
create index audit_events_affected_at_idx on public.audit_events(affected_person_id, occurred_at desc);

-- These helpers are in an unexposed schema, have fixed search paths and reveal
-- only the current Enterprise Person/active role. They never use JWT role metadata.
create function private.current_person_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ai.person_id from public.auth_identities ai
  where ai.provider = 'supabase'
    and ai.provider_subject = (select auth.uid())::text
    and ai.active
  limit 1
$$;

create function private.has_active_role(requested_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.role_assignments ra
    where ra.person_id = (select private.current_person_id())
      and ra.role_code = requested_role
      and ra.revoked_at is null
      and ra.effective_from <= now()
      and (ra.effective_until is null or ra.effective_until > now())
  )
$$;

create function private.has_any_active_role() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.role_assignments ra
    where ra.person_id = (select private.current_person_id())
      and ra.revoked_at is null
      and ra.effective_from <= now()
      and (ra.effective_until is null or ra.effective_until > now())
  )
$$;

revoke all on function private.current_person_id() from public, anon, authenticated;
revoke all on function private.has_active_role(text) from public, anon, authenticated;
revoke all on function private.has_any_active_role() from public, anon, authenticated;
grant execute on function private.current_person_id(), private.has_active_role(text), private.has_any_active_role() to authenticated;

create function private.audit_assignment_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events (
    actor_person_id, affected_person_id, entity_type, entity_id, action,
    before_value, after_value
  ) values (
    private.current_person_id(), new.person_id,
    case when tg_table_name = 'role_assignments' then 'role_assignment' else 'site_assignment' end,
    new.id, tg_op,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;
revoke all on function private.audit_assignment_change() from public, anon, authenticated;
create trigger audit_role_assignment_change after insert or update on public.role_assignments
  for each row execute function private.audit_assignment_change();
create trigger audit_site_assignment_change after insert or update on public.site_assignments
  for each row execute function private.audit_assignment_change();

alter table public.people enable row level security;
alter table public.auth_identities enable row level security;
alter table public.role_assignments enable row level security;
alter table public.sites enable row level security;
alter table public.site_assignments enable row level security;
alter table public.audit_events enable row level security;

-- Supabase projects can have broad public-schema default grants. Restrict each
-- Enterprise table explicitly before granting the narrow authenticated paths.
revoke all on table public.people, public.auth_identities, public.role_assignments,
  public.sites, public.site_assignments, public.audit_events from anon, authenticated;
grant select, insert, update on table public.people, public.auth_identities,
  public.role_assignments, public.sites, public.site_assignments to authenticated;
grant select on table public.audit_events to authenticated;

create policy people_read on public.people for select to authenticated using (
  (select private.has_any_active_role()) and id = (select private.current_person_id())
  or (select private.has_active_role('SUPER_ADMIN'))
);
create policy people_insert on public.people for insert to authenticated with check ((select private.has_active_role('SUPER_ADMIN')));
create policy people_update on public.people for update to authenticated
  using ((select private.has_active_role('SUPER_ADMIN')))
  with check ((select private.has_active_role('SUPER_ADMIN')));

create policy auth_identities_read on public.auth_identities for select to authenticated using (
  active and provider = 'supabase' and provider_subject = (select auth.uid())::text
  or (select private.has_active_role('SUPER_ADMIN'))
);
create policy auth_identities_insert on public.auth_identities for insert to authenticated with check ((select private.has_active_role('SUPER_ADMIN')));
create policy auth_identities_update on public.auth_identities for update to authenticated
  using ((select private.has_active_role('SUPER_ADMIN')))
  with check ((select private.has_active_role('SUPER_ADMIN')));

create policy role_assignments_read on public.role_assignments for select to authenticated using (
  (select private.has_any_active_role()) and person_id = (select private.current_person_id())
  or (select private.has_active_role('SUPER_ADMIN'))
);
create policy role_assignments_insert on public.role_assignments for insert to authenticated with check ((select private.has_active_role('SUPER_ADMIN')));
create policy role_assignments_update on public.role_assignments for update to authenticated
  using ((select private.has_active_role('SUPER_ADMIN')))
  with check ((select private.has_active_role('SUPER_ADMIN')));

create policy sites_read on public.sites for select to authenticated using (
  (select private.has_active_role('SUPER_ADMIN')) or (
    (select private.has_any_active_role()) and exists (
      select 1 from public.site_assignments sa
      where sa.site_id = sites.id
        and sa.person_id = (select private.current_person_id())
        and sa.revoked_at is null
        and sa.effective_from <= now()
        and (sa.effective_until is null or sa.effective_until > now())
    )
  )
);
create policy sites_insert on public.sites for insert to authenticated with check ((select private.has_active_role('SUPER_ADMIN')));
create policy sites_update on public.sites for update to authenticated
  using ((select private.has_active_role('SUPER_ADMIN')))
  with check ((select private.has_active_role('SUPER_ADMIN')));

create policy site_assignments_read on public.site_assignments for select to authenticated using (
  (select private.has_any_active_role()) and person_id = (select private.current_person_id())
  or (select private.has_active_role('SUPER_ADMIN'))
);
create policy site_assignments_insert on public.site_assignments for insert to authenticated with check ((select private.has_active_role('SUPER_ADMIN')));
create policy site_assignments_update on public.site_assignments for update to authenticated
  using ((select private.has_active_role('SUPER_ADMIN')))
  with check ((select private.has_active_role('SUPER_ADMIN')));

create policy audit_events_read on public.audit_events for select to authenticated using ((select private.has_active_role('SUPER_ADMIN')));
