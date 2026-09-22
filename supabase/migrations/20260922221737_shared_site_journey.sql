-- TASK-01C: synthetic shared Site journey in the dedicated KSS Enterprise Dev project.
-- Additive record/audit changes; no live KSS data or other project dependencies.

alter table public.sites
  add column site_reference text,
  add column address_line1 text,
  add column town_city text,
  add column postcode text,
  add column reporting_point text,
  add column status text not null default 'DRAFT',
  add column created_by_person_id uuid references public.people(id),
  add column updated_at timestamptz not null default now();

-- Preserve TASK-01B fixture UUIDs and make their new fields deterministic.
update public.sites set
  site_reference = 'DEV-SITE-A', address_line1 = '1 Example Street',
  town_city = 'Exampletown', postcode = 'EX1 1AA',
  reporting_point = 'Main entrance', status = 'ACTIVE',
  created_by_person_id = '10000000-0000-4000-8000-000000000002'
where id = '30000000-0000-4000-8000-000000000001';
update public.sites set
  site_reference = 'DEV-SITE-B', address_line1 = '2 Example Street',
  town_city = 'Exampletown', postcode = 'EX1 1AB',
  reporting_point = 'Reception', status = 'ACTIVE',
  created_by_person_id = '10000000-0000-4000-8000-000000000001'
where id = '30000000-0000-4000-8000-000000000002';

alter table public.sites
  alter column site_reference set not null,
  alter column address_line1 set not null,
  alter column town_city set not null,
  alter column postcode set not null,
  alter column reporting_point set not null,
  alter column created_by_person_id set not null,
  add constraint sites_reference_unique unique (site_reference),
  add constraint sites_reference_format check (site_reference ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'),
  add constraint sites_status_check check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  add constraint sites_address_check check (
    length(trim(address_line1)) between 1 and 160 and
    length(trim(town_city)) between 1 and 100 and
    length(trim(postcode)) between 1 and 20 and
    length(trim(reporting_point)) between 1 and 500
  );
create index sites_created_by_idx on public.sites(created_by_person_id);

alter table public.site_assignments add column change_reason text;
update public.site_assignments set change_reason = 'TASK-01B synthetic fixture' where change_reason is null;
alter table public.site_assignments
  alter column change_reason set not null,
  add constraint site_assignments_reason_check check (length(trim(change_reason)) between 1 and 500),
  add constraint site_assignments_finite_dates_check check (
    isfinite(effective_from) and (effective_until is null or isfinite(effective_until))
  );

alter table public.audit_events
  alter column affected_person_id drop not null,
  add column site_id uuid references public.sites(id),
  add column reason text;
update public.audit_events
  set site_id = (after_value ->> 'site_id')::uuid
  where entity_type = 'site_assignment' and after_value ? 'site_id';
alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check
  check (entity_type in ('role_assignment', 'site_assignment', 'site'));
alter table public.audit_events add constraint audit_events_target_check check (
  (entity_type = 'site' and site_id is not null) or
  (entity_type = 'site_assignment' and site_id is not null and affected_person_id is not null) or
  (entity_type = 'role_assignment' and affected_person_id is not null)
);
create index audit_events_site_at_idx on public.audit_events(site_id, occurred_at desc);

-- Private read-only helpers bypass RLS only to evaluate the same authoritative rows.
create function private.office_owns_site(requested_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sites s
    where s.id = requested_site
      and s.created_by_person_id = (select private.current_person_id())
      and (select private.has_active_role('OFFICE_ADMIN'))
  )
$$;
create function private.site_is_active(requested_site uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sites s where s.id = requested_site and s.status = 'ACTIVE')
$$;
create function private.staff_role_covers_period(requested_person uuid, period_start timestamptz, period_end timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select period_end is not null and period_end > period_start and exists (
    select 1 from public.role_assignments ra
    where ra.person_id = requested_person and ra.role_code = 'SECURITY_STAFF'
      and ra.revoked_at is null
      and ra.effective_from <= now()
      and (ra.effective_until is null or ra.effective_until > now())
      and ra.effective_from <= period_start
      and (ra.effective_until is null or ra.effective_until >= period_end)
  )
$$;
create function private.office_may_write_site_assignment(
  target_person uuid, target_site uuid, period_start timestamptz,
  period_end timestamptz, grant_actor uuid, revocation timestamptz
) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.has_active_role('OFFICE_ADMIN'))
    and grant_actor = (select private.current_person_id())
    and target_person <> (select private.current_person_id())
    and (select private.office_owns_site(target_site))
    and (select private.site_is_active(target_site))
    and period_end is not null
    and (revocation is not null or (select private.staff_role_covers_period(target_person, period_start, period_end)))
$$;

revoke all on function private.office_owns_site(uuid), private.site_is_active(uuid),
  private.staff_role_covers_period(uuid,timestamptz,timestamptz),
  private.office_may_write_site_assignment(uuid,uuid,timestamptz,timestamptz,uuid,timestamptz)
  from public, anon, authenticated;
grant execute on function private.office_owns_site(uuid), private.site_is_active(uuid),
  private.staff_role_covers_period(uuid,timestamptz,timestamptz),
  private.office_may_write_site_assignment(uuid,uuid,timestamptz,timestamptz,uuid,timestamptz)
  to authenticated;

-- Narrow server preflight: return only a boolean for the caller's own active Site.
-- RLS still independently checks the full predicate on the mutation itself.
create function public.can_delegate_site_assignment(
  target_person uuid, target_site uuid, period_start timestamptz, period_end timestamptz
) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.office_may_write_site_assignment(
    target_person, target_site, period_start, period_end,
    private.current_person_id(), null
  )
$$;
revoke all on function public.can_delegate_site_assignment(uuid,uuid,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public.can_delegate_site_assignment(uuid,uuid,timestamptz,timestamptz)
  to authenticated;

-- Guard immutable identity/ownership fields and the one-way lifecycle even for
-- writes made directly via the authenticated Data API.
create function private.guard_site_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by_person_id is distinct from private.current_person_id() then
      raise exception 'Site creator must be the current Person';
    end if;
    if new.status <> 'DRAFT' then
      raise exception 'New Sites must be Draft';
    end if;
    new.created_at := now();
  else
    if new.id is distinct from old.id or
       new.site_reference is distinct from old.site_reference or
       new.created_by_person_id is distinct from old.created_by_person_id or
       new.created_at is distinct from old.created_at then
      raise exception 'Site identity, reference and ownership are immutable';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'DRAFT' and new.status = 'ACTIVE') or
      (old.status = 'ACTIVE' and new.status = 'RETIRED')
    ) then
      raise exception 'Invalid Site status transition';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.guard_site_change() from public, anon, authenticated;
create trigger guard_site_change before insert or update on public.sites
  for each row execute function private.guard_site_change();

create function private.guard_site_assignment_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.effective_until is null then
      raise exception 'New Site assignments require a finite end';
    end if;
    if new.revoked_at is not null then
      raise exception 'New Site assignments cannot start revoked';
    end if;
    if new.granted_by is distinct from private.current_person_id() then
      raise exception 'Grant actor must be the current Person';
    end if;
    new.created_at := now();
  else
    if new.id is distinct from old.id or
       new.person_id is distinct from old.person_id or
       new.site_id is distinct from old.site_id or
       new.granted_by is distinct from old.granted_by or
       new.created_at is distinct from old.created_at then
      raise exception 'Site assignment identity is immutable';
    end if;
    if old.revoked_at is not null and new is distinct from old then
      raise exception 'Revoked Site assignments cannot be changed';
    end if;
    if old.revoked_at is null and new.revoked_at is not null and
       (new.effective_from is distinct from old.effective_from or
        new.effective_until is distinct from old.effective_until) then
      raise exception 'Revocation cannot rewrite the assignment period';
    end if;
    if old.revoked_at is null and new.revoked_at is not null then
      new.revoked_at := now();
    end if;
    if new is distinct from old and new.change_reason is not distinct from old.change_reason then
      raise exception 'A new reason is required for each Site assignment change';
    end if;
    if new.revoked_at is null and new.effective_until is null then
      raise exception 'Changed Site assignments require a finite end';
    end if;
  end if;
  if length(trim(new.change_reason)) < 1 then
    raise exception 'Change reason is required';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_site_assignment_change() from public, anon, authenticated;
create trigger guard_site_assignment_change before insert or update on public.site_assignments
  for each row execute function private.guard_site_assignment_change();

-- Audit each state transition; before/after snapshots preserve amended periods.
create or replace function private.audit_assignment_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events (
    actor_person_id, affected_person_id, site_id, entity_type, entity_id,
    action, before_value, after_value, reason
  ) values (
    private.current_person_id(), new.person_id,
    case when tg_table_name = 'site_assignments' then (to_jsonb(new) ->> 'site_id')::uuid else null end,
    case when tg_table_name = 'role_assignments' then 'role_assignment' else 'site_assignment' end,
    new.id, tg_op,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    case when tg_table_name = 'site_assignments' then new.change_reason else null end
  );
  return new;
end;
$$;
revoke all on function private.audit_assignment_change() from public, anon, authenticated;

create function private.audit_site_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events (
    actor_person_id, site_id, entity_type, entity_id, action, before_value, after_value
  ) values (
    private.current_person_id(), new.id, 'site', new.id, tg_op,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;
revoke all on function private.audit_site_change() from public, anon, authenticated;
create trigger audit_site_change after insert or update on public.sites
  for each row execute function private.audit_site_change();

drop policy sites_read on public.sites;
drop policy sites_insert on public.sites;
drop policy sites_update on public.sites;
create policy sites_read on public.sites for select to authenticated using (
  (select private.has_active_role('SUPER_ADMIN')) or
  ((select private.has_active_role('OFFICE_ADMIN')) and created_by_person_id = (select private.current_person_id())) or
  (status = 'ACTIVE' and (select private.has_active_role('SECURITY_STAFF')) and exists (
    select 1 from public.site_assignments sa
    where sa.site_id = sites.id and sa.person_id = (select private.current_person_id())
      and sa.revoked_at is null and sa.effective_from <= now()
      and (sa.effective_until is null or sa.effective_until > now())
  ))
);
create policy sites_insert on public.sites for insert to authenticated with check (
  ((select private.has_active_role('SUPER_ADMIN')) or (select private.has_active_role('OFFICE_ADMIN')))
  and created_by_person_id = (select private.current_person_id()) and status = 'DRAFT'
);
create policy sites_update on public.sites for update to authenticated
  using ((select private.has_active_role('SUPER_ADMIN')) or (select private.office_owns_site(id)))
  with check ((select private.has_active_role('SUPER_ADMIN')) or (select private.office_owns_site(id)));

drop policy site_assignments_read on public.site_assignments;
drop policy site_assignments_insert on public.site_assignments;
drop policy site_assignments_update on public.site_assignments;
create policy site_assignments_read on public.site_assignments for select to authenticated using (
  (select private.has_active_role('SUPER_ADMIN')) or
  (select private.office_owns_site(site_id)) or
  (person_id = (select private.current_person_id())
    and (select private.has_active_role('SECURITY_STAFF'))
    and (select private.site_is_active(site_id))
    and revoked_at is null and effective_from <= now()
    and (effective_until is null or effective_until > now()))
);
create policy site_assignments_insert on public.site_assignments for insert to authenticated with check (
  (select private.has_active_role('SUPER_ADMIN')) or
  (select private.office_may_write_site_assignment(person_id,site_id,effective_from,effective_until,granted_by,revoked_at))
);
create policy site_assignments_update on public.site_assignments for update to authenticated
  using (
    (select private.has_active_role('SUPER_ADMIN')) or
    ((select private.has_active_role('OFFICE_ADMIN'))
      and granted_by = (select private.current_person_id())
      and (select private.office_owns_site(site_id))
      and (select private.site_is_active(site_id)))
  )
  with check (
    (select private.has_active_role('SUPER_ADMIN')) or
    (select private.office_may_write_site_assignment(person_id,site_id,effective_from,effective_until,granted_by,revoked_at))
  );

drop policy audit_events_read on public.audit_events;
create policy audit_events_read on public.audit_events for select to authenticated using (
  (select private.has_active_role('SUPER_ADMIN')) or
  (site_id is not null and (select private.office_owns_site(site_id)))
);
