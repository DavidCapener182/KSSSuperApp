-- A Super Admin creates an exact synthetic starter case with a named active Office owner.
-- The existing Office create function and its team membership rule are unchanged.
create function public.create_onboarding_case_as_super(
  target_person uuid, requested_site uuid, requested_team uuid,
  requested_owner uuid, request_key uuid
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; version_id uuid; created_id uuid;
  existing_case public.onboarding_cases%rowtype; requirement_count integer;
begin
  actor := private.current_person_id();
  if actor is null or not private.has_active_role('SUPER_ADMIN')
    or target_person is null or target_person = actor or requested_site is null
    or requested_team is null or requested_owner is null or request_key is null
    or not private.site_is_active(requested_site)
    or not exists (select 1 from public.sites s where s.id = requested_site
      and s.name = 'Synthetic Static Security Site')
    or not private.active_onboarding_team_member(requested_team, requested_owner)
    or not private.has_active_role_for_person(target_person, 'SECURITY_STAFF')
    or not exists (select 1 from public.site_assignments sa
      where sa.person_id = target_person and sa.site_id = requested_site
        and sa.revoked_at is null and sa.effective_from <= now()
        and (sa.effective_until is null or sa.effective_until > now()))
  then raise exception 'Onboarding case denied'; end if;

  select v.id into version_id from public.onboarding_template_versions v
    join public.onboarding_templates t on t.id = v.template_id
    where t.code = 'SECURITY_STAFF_BASE' and v.published_at is not null
    order by v.version_number desc limit 1;
  if version_id is null then raise exception 'Onboarding template unavailable'; end if;

  insert into public.onboarding_cases(person_id, intended_role, site_id,
    template_version_id, created_by_person_id, owner_person_id, team_id, client_request_id)
    values (target_person, 'SECURITY_STAFF', requested_site, version_id,
      actor, requested_owner, requested_team, request_key)
    on conflict (created_by_person_id, client_request_id) do nothing returning id into created_id;
  if created_id is null then
    select * into existing_case from public.onboarding_cases
      where created_by_person_id = actor and client_request_id = request_key;
    if existing_case.id is null or existing_case.person_id <> target_person
      or existing_case.site_id <> requested_site or existing_case.team_id <> requested_team
      or existing_case.owner_person_id <> requested_owner
    then raise exception 'Onboarding request conflict'; end if;
    return existing_case.id;
  end if;

  insert into public.onboarding_case_requirements(case_id, definition_id)
    select created_id, d.id from public.onboarding_requirement_definitions d
      where d.template_version_id = version_id;
  get diagnostics requirement_count = row_count;
  if requirement_count <> 6 then raise exception 'Incomplete onboarding template'; end if;
  insert into public.audit_events(actor_person_id, affected_person_id, entity_type,
    entity_id, action, after_value)
    values (actor, target_person, 'onboarding_case', created_id, 'INSERT',
      jsonb_build_object('state', 'DRAFT', 'template_version_id', version_id,
        'team_id', requested_team, 'owner_person_id', requested_owner,
        'super_admin_created', true));
  return created_id;
end;$$;

revoke all on function public.create_onboarding_case_as_super(uuid,uuid,uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.create_onboarding_case_as_super(uuid,uuid,uuid,uuid,uuid)
  to authenticated;

create function public.list_onboarding_case_targets(requested_site uuid)
returns table(person_id uuid, display_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_person_id() is null or requested_site is null
    or not (private.has_active_role('SUPER_ADMIN')
      or (private.has_active_role('OFFICE_ADMIN') and private.office_owns_site(requested_site)))
    or not private.site_is_active(requested_site)
  then return; end if;
  return query select p.id, p.display_name from public.people p
    where private.has_active_role_for_person(p.id, 'SECURITY_STAFF')
      and exists (select 1 from public.site_assignments sa
        where sa.person_id = p.id and sa.site_id = requested_site
          and sa.revoked_at is null and sa.effective_from <= now()
          and (sa.effective_until is null or sa.effective_until > now()))
    order by p.display_name limit 50;
end;$$;

revoke all on function public.list_onboarding_case_targets(uuid)
  from public, anon, authenticated;
grant execute on function public.list_onboarding_case_targets(uuid) to authenticated;
