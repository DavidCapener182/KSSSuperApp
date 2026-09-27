-- Register a staff Person before a Site or case owner has been configured.
-- The Person remains separate from an authentication identity.
create table public.onboarding_starter_requests (
  actor_person_id uuid not null references public.people(id),
  request_key uuid not null,
  display_name text not null,
  site_id uuid references public.sites(id),
  person_id uuid not null unique references public.people(id),
  case_id uuid not null references public.onboarding_cases(id),
  created_at timestamptz not null default now(),
  primary key (actor_person_id, request_key)
);
alter table public.onboarding_starter_requests enable row level security;
revoke all on public.onboarding_starter_requests from public, anon, authenticated;

create or replace function private.active_onboarding_team_member(requested_team uuid,requested_person uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select requested_team is not null and requested_person is not null
    and (private.has_active_role_for_person(requested_person,'OFFICE_ADMIN')
      or private.has_active_role_for_person(requested_person,'SUPER_ADMIN'))
    and exists (select 1 from public.onboarding_team_memberships m
      where m.team_id=requested_team and m.person_id=requested_person and m.revoked_at is null
        and m.effective_from<=now() and (m.effective_until is null or m.effective_until>now()))
$$;

-- A Super Admin can own an onboarding case without first creating a second
-- Office account. The named team and membership remain explicit and audited.
create function private.ensure_super_onboarding_team(actor uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare chosen uuid; membership_id uuid; created_team boolean := false;
begin
  if actor is null or actor <> private.current_person_id() or not private.has_active_role('SUPER_ADMIN')
  then raise exception 'Onboarding team denied'; end if;
  select m.team_id into chosen from public.onboarding_team_memberships m
    where m.person_id=actor and m.revoked_at is null and m.effective_from<=now()
      and (m.effective_until is null or m.effective_until>now())
    order by m.created_at limit 1;
  if chosen is not null then return chosen; end if;
  select t.id into chosen from public.onboarding_teams t where t.name='KSS Onboarding';
  if chosen is null then
    insert into public.onboarding_teams(name,created_by_person_id)
      values('KSS Onboarding',actor) returning id into chosen;
    created_team := true;
  end if;
  if created_team then
    insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
      values(actor,actor,'onboarding_team',chosen,'INSERT',jsonb_build_object('name','KSS Onboarding'));
  end if;
  insert into public.onboarding_team_memberships(team_id,person_id,can_coordinate,effective_from,granted_by_person_id)
    values(chosen,actor,true,now(),actor) returning id into membership_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,actor,'onboarding_team_membership',membership_id,'INSERT',
      jsonb_build_object('team_id',chosen,'effective_from',now(),'can_coordinate',true));
  return chosen;
end;$$;

-- A case can begin as company onboarding and gain one active Site context
-- while still a draft. This never grants Staff Site access.
create or replace function private.guard_onboarding_case() returns trigger
language plpgsql security definer set search_path = '' as $$
declare change_id uuid;
begin
  if tg_op = 'DELETE' then raise exception 'Onboarding case history cannot be deleted'; end if;
  if tg_op = 'INSERT' then
    if new.state <> 'DRAFT' or new.started_at is not null or new.cancelled_at is not null
      or new.person_id = new.owner_person_id
      or new.team_id is null or not private.active_onboarding_team_member(new.team_id, new.owner_person_id)
      or not (new.created_by_person_id = new.owner_person_id
        or (new.created_by_person_id = private.current_person_id()
          and private.has_active_role('SUPER_ADMIN')))
    then raise exception 'Invalid onboarding case'; end if;
    return new;
  end if;
  if old.site_id is null and new.site_id is not null and old.state = 'DRAFT'
    and private.has_active_role('SUPER_ADMIN') and private.site_is_active(new.site_id)
    and new.id = old.id and new.person_id = old.person_id
    and new.intended_role = old.intended_role and new.template_version_id = old.template_version_id
    and new.created_by_person_id = old.created_by_person_id and new.owner_person_id = old.owner_person_id
    and new.team_id = old.team_id and new.client_request_id = old.client_request_id
    and new.state = old.state and new.created_at = old.created_at
    and new.started_at is not distinct from old.started_at
    and new.cancelled_at is not distinct from old.cancelled_at
  then return new; end if;
  if new.id <> old.id or new.person_id <> old.person_id or new.intended_role <> old.intended_role
    or new.site_id is distinct from old.site_id or new.template_version_id <> old.template_version_id
    or new.created_by_person_id <> old.created_by_person_id or new.team_id <> old.team_id
    or new.client_request_id <> old.client_request_id or new.created_at <> old.created_at
  then raise exception 'Onboarding case identity is immutable'; end if;
  if new.owner_person_id is distinct from old.owner_person_id then
    if new.state <> old.state or new.started_at is distinct from old.started_at
      or new.cancelled_at is distinct from old.cancelled_at or old.state = 'CANCELLED'
      or not private.active_onboarding_team_member(new.team_id, new.owner_person_id)
    then raise exception 'Onboarding owner transition denied'; end if;
    select id into change_id from public.onboarding_case_owner_changes
      where case_id = old.id and old_owner_person_id = old.owner_person_id
        and new_owner_person_id = new.owner_person_id and transaction_id = txid_current()
        and actor_person_id = private.current_person_id() order by changed_at desc limit 1;
    if change_id is null then raise exception 'Onboarding owner history required'; end if;
    return new;
  end if;
  if not ((old.state = 'DRAFT' and new.state = 'IN_PROGRESS' and new.started_at is not null and new.cancelled_at is null)
    or (old.state in ('DRAFT','IN_PROGRESS') and new.state = 'CANCELLED'
      and new.started_at is not distinct from old.started_at and new.cancelled_at is not null))
  then raise exception 'Onboarding case transition denied'; end if;
  return new;
end;$$;

create function public.attach_onboarding_site(requested_case uuid, requested_site uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype;
begin
  actor := private.current_person_id();
  if actor is null or not private.has_active_role('SUPER_ADMIN') or requested_site is null
    or not private.site_is_active(requested_site)
  then raise exception 'Onboarding Site denied'; end if;
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or c.state<>'DRAFT' or (c.site_id is not null and c.site_id<>requested_site)
  then raise exception 'Onboarding Site denied'; end if;
  if c.site_id=requested_site then return c.id; end if;
  update public.onboarding_cases set site_id=requested_site where id=c.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,before_value,after_value)
    values(actor,c.person_id,'onboarding_case',c.id,'UPDATE',
      jsonb_build_object('site_id',null),jsonb_build_object('site_id',requested_site));
  return c.id;
end;$$;
revoke all on function public.attach_onboarding_site(uuid,uuid) from public,anon,authenticated;
grant execute on function public.attach_onboarding_site(uuid,uuid) to authenticated;
revoke all on function private.ensure_super_onboarding_team(uuid) from public, anon, authenticated;

create function public.register_onboarding_starter(p_starter_name text, p_request_key uuid, p_requested_site uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; clean_name text; existing public.onboarding_starter_requests%rowtype;
  created uuid; created_case uuid; chosen_team uuid;
begin
  actor := private.current_person_id();
  clean_name := trim(p_starter_name);
  if actor is null or not private.has_active_role('SUPER_ADMIN') or p_request_key is null
    or p_starter_name is null or length(clean_name) not between 2 and 120
    or clean_name ~ '[[:cntrl:]]'
    or (p_requested_site is not null and not private.site_is_active(p_requested_site))
  then raise exception 'Starter registration denied'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || p_request_key::text, 0));
  select * into existing from public.onboarding_starter_requests r
    where r.actor_person_id = actor and r.request_key = p_request_key;
  if existing.person_id is not null then
    if existing.display_name <> clean_name or existing.site_id is distinct from p_requested_site
    then raise exception 'Starter request conflict'; end if;
    return jsonb_build_object('personId',existing.person_id,'caseId',existing.case_id);
  end if;
  insert into public.people(display_name) values(clean_name) returning id into created;
  insert into public.role_assignments(person_id, role_code, granted_by)
    values(created, 'SECURITY_STAFF', actor);
  chosen_team := private.ensure_super_onboarding_team(actor);
  created_case := public.create_onboarding_case_as_super(created,p_requested_site,chosen_team,actor,p_request_key);
  insert into public.onboarding_starter_requests(actor_person_id, request_key, display_name, site_id, person_id, case_id)
    values(actor, p_request_key, clean_name, p_requested_site, created, created_case);
  return jsonb_build_object('personId',created,'caseId',created_case);
end;$$;
revoke all on function public.register_onboarding_starter(text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.register_onboarding_starter(text,uuid,uuid) to authenticated;

-- Keep Office case authority and the existing Staff/Site/team gates, but accept
-- any active Site that the Office owner actually controls.
create or replace function public.create_onboarding_case(target_person uuid,requested_site uuid,request_key uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; version_id uuid; created_id uuid; existing_case public.onboarding_cases%rowtype;
  requirement_count integer; chosen_team uuid; team_count integer;
begin
  actor:=private.current_person_id();
  if actor is null or request_key is null or target_person is null or target_person=actor
    or not private.has_active_role('OFFICE_ADMIN') or requested_site is null
    or not private.office_owns_site(requested_site) or not private.site_is_active(requested_site)
    or not private.has_active_role_for_person(target_person,'SECURITY_STAFF')
    or not exists(select 1 from public.site_assignments sa where sa.person_id=target_person
      and sa.site_id=requested_site and sa.revoked_at is null and sa.effective_from<=now()
      and (sa.effective_until is null or sa.effective_until>now()))
  then raise exception 'Onboarding case denied'; end if;
  select count(distinct m.team_id),(array_agg(distinct m.team_id))[1] into team_count,chosen_team
    from public.onboarding_team_memberships m where m.person_id=actor and m.revoked_at is null
      and m.effective_from<=now() and (m.effective_until is null or m.effective_until>now());
  if team_count<>1 then raise exception 'Choose one authorised onboarding team'; end if;
  select v.id into version_id from public.onboarding_template_versions v
    join public.onboarding_templates t on t.id=v.template_id
    where t.code='SECURITY_STAFF_BASE' and v.published_at is not null
    order by v.version_number desc limit 1;
  if version_id is null then raise exception 'Onboarding template unavailable'; end if;
  insert into public.onboarding_cases(person_id,intended_role,site_id,template_version_id,
    created_by_person_id,owner_person_id,team_id,client_request_id)
    values(target_person,'SECURITY_STAFF',requested_site,version_id,actor,actor,chosen_team,request_key)
    on conflict (created_by_person_id,client_request_id) do nothing returning id into created_id;
  if created_id is null then
    select * into existing_case from public.onboarding_cases
      where created_by_person_id=actor and client_request_id=request_key;
    if existing_case.id is null or existing_case.person_id<>target_person
      or existing_case.site_id<>requested_site or existing_case.team_id<>chosen_team
    then raise exception 'Onboarding request conflict'; end if;
    return existing_case.id;
  end if;
  insert into public.onboarding_case_requirements(case_id,definition_id)
    select created_id,d.id from public.onboarding_requirement_definitions d where d.template_version_id=version_id;
  get diagnostics requirement_count=row_count;
  if requirement_count<>6 then raise exception 'Incomplete onboarding template'; end if;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,target_person,'onboarding_case',created_id,'INSERT',
      jsonb_build_object('state','DRAFT','template_version_id',version_id,'team_id',chosen_team));
  return created_id;
end;$$;

create or replace function public.create_onboarding_case_as_super(
  target_person uuid, requested_site uuid, requested_team uuid,
  requested_owner uuid, request_key uuid
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; version_id uuid; created_id uuid;
  existing_case public.onboarding_cases%rowtype; requirement_count integer;
begin
  actor := private.current_person_id();
  if actor is null or not private.has_active_role('SUPER_ADMIN')
    or target_person is null or target_person = actor
    or requested_team is null or requested_owner is null or request_key is null
    or not private.active_onboarding_team_member(requested_team, requested_owner)
    or not private.has_active_role_for_person(target_person, 'SECURITY_STAFF')
    or (requested_site is not null and not private.site_is_active(requested_site))
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
      or existing_case.site_id is distinct from requested_site or existing_case.team_id <> requested_team
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
