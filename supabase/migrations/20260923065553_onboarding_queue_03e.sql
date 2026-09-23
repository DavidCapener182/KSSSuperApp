-- TASK-03E: explicit synthetic onboarding team, narrow case authority, and typed ownership history.
-- Later sections of this migration update linked document, Task and verification guards together.
create table public.onboarding_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 3 and 100 and name !~ '[[:cntrl:]]'),
  created_by_person_id uuid not null references public.people(id),
  created_at timestamptz not null default now()
);
create table public.onboarding_team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.onboarding_teams(id),
  person_id uuid not null references public.people(id),
  can_coordinate boolean not null default false,
  effective_from timestamptz not null,
  effective_until timestamptz,
  revoked_at timestamptz,
  granted_by_person_id uuid not null references public.people(id),
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from),
  check (revoked_at is null or revoked_at >= created_at)
);
create index onboarding_team_memberships_active_idx on public.onboarding_team_memberships(team_id,person_id,effective_from,effective_until) where revoked_at is null;
create unique index onboarding_team_memberships_unrevoked_idx on public.onboarding_team_memberships(team_id,person_id) where revoked_at is null;
alter table public.onboarding_cases add column team_id uuid references public.onboarding_teams(id);
create index onboarding_cases_team_state_idx on public.onboarding_cases(team_id,state,created_at desc);
create table public.onboarding_case_owner_changes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.onboarding_cases(id),
  old_owner_person_id uuid not null references public.people(id),
  new_owner_person_id uuid not null references public.people(id),
  actor_person_id uuid not null references public.people(id),
  reason text not null check (length(trim(reason)) between 10 and 500 and reason !~ '[[:cntrl:]]'),
  changed_at timestamptz not null default now(),
  transaction_id bigint not null default txid_current(),
  check (old_owner_person_id <> new_owner_person_id)
);
create index onboarding_owner_changes_case_idx on public.onboarding_case_owner_changes(case_id,changed_at desc);
create table public.onboarding_case_cover_grants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.onboarding_cases(id),
  owner_person_id uuid not null references public.people(id),
  covering_person_id uuid not null references public.people(id),
  grantor_person_id uuid not null references public.people(id),
  effective_from timestamptz not null,
  effective_until timestamptz not null,
  reason text not null check (length(trim(reason)) between 10 and 500 and reason !~ '[[:cntrl:]]'),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by_person_id uuid references public.people(id),
  check (owner_person_id <> covering_person_id and effective_until > effective_from),
  check (effective_until <= (((effective_from at time zone 'Europe/London') + interval '14 days') at time zone 'Europe/London')),
  check ((revoked_at is null and revoked_by_person_id is null) or (revoked_at is not null and revoked_by_person_id is not null))
);
create index onboarding_cover_case_active_idx on public.onboarding_case_cover_grants(case_id,covering_person_id,effective_from,effective_until) where revoked_at is null;

-- All new public tables use deny-by-default RLS. Business changes use guarded RPCs only.
alter table public.onboarding_teams enable row level security;
alter table public.onboarding_team_memberships enable row level security;
alter table public.onboarding_case_owner_changes enable row level security;
alter table public.onboarding_case_cover_grants enable row level security;
revoke all on public.onboarding_teams,public.onboarding_team_memberships,
  public.onboarding_case_owner_changes,public.onboarding_case_cover_grants from public,anon,authenticated;
-- No raw team/case-history grants. The API uses minimal scoped projections and actions.

create function private.has_active_role_for_person(requested_person uuid,requested_role text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.role_assignments ra where ra.person_id=requested_person
    and ra.role_code=requested_role and ra.revoked_at is null and ra.effective_from<=now()
    and (ra.effective_until is null or ra.effective_until>now()))
$$;
create function private.active_onboarding_team_member(requested_team uuid,requested_person uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select requested_team is not null and requested_person is not null
    and private.has_active_role_for_person(requested_person,'OFFICE_ADMIN') and exists (
      select 1 from public.onboarding_team_memberships m
      where m.team_id=requested_team and m.person_id=requested_person and m.revoked_at is null
        and m.effective_from<=now() and (m.effective_until is null or m.effective_until>now()))
$$;
create function private.onboarding_team_coordinator(requested_team uuid,requested_person uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.active_onboarding_team_member(requested_team,requested_person) and exists (
    select 1 from public.onboarding_team_memberships m where m.team_id=requested_team
      and m.person_id=requested_person and m.can_coordinate and m.revoked_at is null
      and m.effective_from<=now() and (m.effective_until is null or m.effective_until>now()))
$$;
create function private.onboarding_owner_authorised(requested_case uuid,requested_person uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.onboarding_cases c where c.id=requested_case
    and c.owner_person_id=requested_person and c.team_id is not null
    and private.active_onboarding_team_member(c.team_id,requested_person))
$$;
create function private.onboarding_cover_authorised(requested_case uuid,requested_person uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.onboarding_cases c
    join public.onboarding_case_cover_grants g on g.case_id=c.id
    where c.id=requested_case and c.state='IN_PROGRESS' and c.team_id is not null
      and g.owner_person_id=c.owner_person_id and g.covering_person_id=requested_person
      and g.revoked_at is null and g.effective_from<=now() and g.effective_until>now()
      and private.active_onboarding_team_member(c.team_id,requested_person)
      and private.active_onboarding_team_member(c.team_id,c.owner_person_id))
$$;
create function private.onboarding_office_case_access(requested_case uuid,requested_person uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.onboarding_owner_authorised(requested_case,requested_person)
    or private.onboarding_cover_authorised(requested_case,requested_person)
$$;
create function private.onboarding_request_case(requested_id uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select case when count(distinct linked.case_id)=1 then (array_agg(distinct linked.case_id))[1] else null end
  from (select cr.case_id from public.onboarding_case_requirements cr
          where cr.document_request_id=requested_id
        union all
        select s.case_id from public.onboarding_sia_submissions s
          where s.document_request_id=requested_id) linked
$$;
revoke all on function private.has_active_role_for_person(uuid,text),
  private.active_onboarding_team_member(uuid,uuid),
  private.onboarding_team_coordinator(uuid,uuid),private.onboarding_owner_authorised(uuid,uuid),
  private.onboarding_cover_authorised(uuid,uuid),private.onboarding_office_case_access(uuid,uuid),
  private.onboarding_request_case(uuid) from public,anon,authenticated;

-- Bootstrap only the already authorised synthetic Office A owner into one bounded dev team.
-- Existing case identities, requirements, evidence and decisions are untouched.
insert into public.onboarding_teams(name,created_by_person_id)
select 'Synthetic Office Onboarding',p.id from public.people p
where p.id='10000000-0000-4000-8000-000000000001';
insert into public.onboarding_team_memberships(team_id,person_id,effective_from,granted_by_person_id)
select t.id,p.id,now(),'10000000-0000-4000-8000-000000000001'::uuid
from public.onboarding_teams t join public.people p on p.id='10000000-0000-4000-8000-000000000002'
where t.name='Synthetic Office Onboarding';
-- A one-time source-controlled backfill of team context for existing synthetic cases.
-- The old guard prohibits all metadata updates, so this bounded migration temporarily disables it.
alter table public.onboarding_cases disable trigger guard_onboarding_case;
update public.onboarding_cases c set team_id=t.id from public.onboarding_teams t
where t.name='Synthetic Office Onboarding' and c.owner_person_id='10000000-0000-4000-8000-000000000002';
alter table public.onboarding_cases enable trigger guard_onboarding_case;
alter table public.onboarding_cases alter column team_id set not null;

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
  'role_assignment','site_assignment','site','document_request','document_version','document_review','task',
  'onboarding_case','onboarding_requirement','onboarding_verification','person_profile','profile_submission',
  'sia_credential','sia_submission','controlled_publisher_grant','controlled_document','controlled_version',
  'controlled_publication','controlled_assignment','controlled_access','controlled_acknowledgement',
  'onboarding_team','onboarding_team_membership','onboarding_cover','onboarding_owner_change','task_assignment'));

create function public.create_onboarding_team(team_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; created uuid;
begin
  actor:=private.current_person_id();
  if actor is null or not private.has_active_role('SUPER_ADMIN') or team_name is null
    or length(trim(team_name)) not between 3 and 100 or team_name ~ '[[:cntrl:]]'
  then raise exception 'Team creation denied'; end if;
  insert into public.onboarding_teams(name,created_by_person_id) values(trim(team_name),actor) returning id into created;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,actor,'onboarding_team',created,'INSERT',jsonb_build_object('name',trim(team_name)));
  return created;
end;$$;
create function public.grant_onboarding_team_member(requested_team uuid,target_person uuid,
  starts_at timestamptz,ends_at timestamptz,can_coordinate_reassign boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; created uuid;
begin
  actor:=private.current_person_id();
  if actor is null or not private.has_active_role('SUPER_ADMIN') or target_person=actor
    or not exists(select 1 from public.onboarding_teams where id=requested_team)
    or not private.has_active_role_for_person(target_person,'OFFICE_ADMIN')
    or starts_at is null or (ends_at is not null and ends_at<=starts_at)
  then raise exception 'Team membership denied'; end if;
  insert into public.onboarding_team_memberships(team_id,person_id,can_coordinate,effective_from,effective_until,granted_by_person_id)
    values(requested_team,target_person,coalesce(can_coordinate_reassign,false),starts_at,ends_at,actor)
    returning id into created;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,target_person,'onboarding_team_membership',created,'INSERT',
      jsonb_build_object('team_id',requested_team,'effective_from',starts_at,'effective_until',ends_at,
        'can_coordinate',coalesce(can_coordinate_reassign,false)));
  return created;
end;$$;
create function public.revoke_onboarding_team_member(requested_membership uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; membership public.onboarding_team_memberships%rowtype;
begin
  actor:=private.current_person_id();
  if actor is null or not private.has_active_role('SUPER_ADMIN') then raise exception 'Team membership denied'; end if;
  select * into membership from public.onboarding_team_memberships where id=requested_membership for update;
  if membership.id is null then raise exception 'Team membership denied'; end if;
  if membership.revoked_at is not null then return membership.id; end if;
  update public.onboarding_team_memberships set revoked_at=now() where id=membership.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,before_value,after_value)
    values(actor,membership.person_id,'onboarding_team_membership',membership.id,'UPDATE',
      jsonb_build_object('team_id',membership.team_id,'revoked_at',null),
      jsonb_build_object('team_id',membership.team_id,'revoked_at',now()));
  return membership.id;
end;$$;
create function public.set_onboarding_team_coordinator(requested_membership uuid,enabled boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; membership public.onboarding_team_memberships%rowtype;
begin
  actor:=private.current_person_id();
  if actor is null or not private.has_active_role('SUPER_ADMIN') or enabled is null
  then raise exception 'Coordinator change denied'; end if;
  select * into membership from public.onboarding_team_memberships where id=requested_membership for update;
  if membership.id is null or membership.revoked_at is not null or membership.person_id=actor
  then raise exception 'Coordinator change denied'; end if;
  if membership.can_coordinate=enabled then return membership.id; end if;
  update public.onboarding_team_memberships set can_coordinate=enabled where id=membership.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,before_value,after_value)
    values(actor,membership.person_id,'onboarding_team_membership',membership.id,'UPDATE',
      jsonb_build_object('can_coordinate',membership.can_coordinate),jsonb_build_object('can_coordinate',enabled));
  return membership.id;
end;$$;

create function public.list_onboarding_team_people(requested_team uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
  actor:=private.current_person_id();
  if actor is null or not (private.has_active_role('SUPER_ADMIN') or
    private.active_onboarding_team_member(requested_team,actor)) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('personId',p.id,'displayName',p.display_name,
    'membershipId',m.id,'canCoordinate',m.can_coordinate,'effectiveUntil',m.effective_until)
    order by p.display_name),'[]'::jsonb) into result
  from public.onboarding_team_memberships m join public.people p on p.id=m.person_id
  where m.team_id=requested_team and m.revoked_at is null and m.effective_from<=now()
    and (m.effective_until is null or m.effective_until>now())
    and private.has_active_role_for_person(m.person_id,'OFFICE_ADMIN');
  return result;
end;$$;
create function public.list_onboarding_teams() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
  actor:=private.current_person_id();
  if actor is null or not (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN'))
  then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) order by t.name),'[]'::jsonb)
    into result from public.onboarding_teams t where private.has_active_role('SUPER_ADMIN')
      or private.active_onboarding_team_member(t.id,actor);
  return result;
end;$$;
revoke all on function public.create_onboarding_team(text),
  public.grant_onboarding_team_member(uuid,uuid,timestamptz,timestamptz,boolean),
  public.revoke_onboarding_team_member(uuid),public.set_onboarding_team_coordinator(uuid,boolean),
  public.list_onboarding_team_people(uuid),public.list_onboarding_teams() from public,anon,authenticated;
grant execute on function public.create_onboarding_team(text),
  public.grant_onboarding_team_member(uuid,uuid,timestamptz,timestamptz,boolean),
  public.revoke_onboarding_team_member(uuid),public.set_onboarding_team_coordinator(uuid,boolean),
  public.list_onboarding_team_people(uuid),public.list_onboarding_teams() to authenticated;

create or replace function private.onboarding_case_readable(requested_case uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.onboarding_cases c where c.id=requested_case
    and private.current_person_id() is not null and (
      private.has_active_role('SUPER_ADMIN')
      or (private.has_active_role('SECURITY_STAFF') and c.person_id=private.current_person_id())
      or private.onboarding_office_case_access(c.id,private.current_person_id())))
$$;

create or replace function private.guard_onboarding_case() returns trigger
language plpgsql security definer set search_path='' as $$
declare change_id uuid;
begin
  if tg_op='DELETE' then raise exception 'Onboarding case history cannot be deleted'; end if;
  if tg_op='INSERT' then
    if new.state<>'DRAFT' or new.started_at is not null or new.cancelled_at is not null
      or new.created_by_person_id<>new.owner_person_id or new.person_id=new.owner_person_id
      or new.team_id is null or not private.active_onboarding_team_member(new.team_id,new.owner_person_id)
    then raise exception 'Invalid onboarding case'; end if;
    return new;
  end if;
  if new.id<>old.id or new.person_id<>old.person_id or new.intended_role<>old.intended_role
    or new.site_id is distinct from old.site_id or new.template_version_id<>old.template_version_id
    or new.created_by_person_id<>old.created_by_person_id or new.team_id<>old.team_id
    or new.client_request_id<>old.client_request_id or new.created_at<>old.created_at
  then raise exception 'Onboarding case identity is immutable'; end if;
  if new.owner_person_id is distinct from old.owner_person_id then
    if new.state<>old.state or new.started_at is distinct from old.started_at
      or new.cancelled_at is distinct from old.cancelled_at or old.state='CANCELLED'
      or not private.active_onboarding_team_member(new.team_id,new.owner_person_id)
    then raise exception 'Onboarding owner transition denied'; end if;
    select id into change_id from public.onboarding_case_owner_changes
      where case_id=old.id and old_owner_person_id=old.owner_person_id
        and new_owner_person_id=new.owner_person_id and transaction_id=txid_current()
        and actor_person_id=private.current_person_id() order by changed_at desc limit 1;
    if change_id is null then raise exception 'Onboarding owner history required'; end if;
    return new;
  end if;
  if not ((old.state='DRAFT' and new.state='IN_PROGRESS' and new.started_at is not null and new.cancelled_at is null)
    or (old.state in ('DRAFT','IN_PROGRESS') and new.state='CANCELLED'
      and new.started_at is not distinct from old.started_at and new.cancelled_at is not null))
  then raise exception 'Onboarding case transition denied'; end if;
  return new;
end;$$;

create or replace function public.create_onboarding_case(target_person uuid,requested_site uuid,request_key uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; version_id uuid; created_id uuid; existing_case public.onboarding_cases%rowtype;
  requirement_count integer; chosen_team uuid; team_count integer;
begin
  actor:=private.current_person_id();
  if actor is null or request_key is null or target_person is null or target_person=actor
    or not private.has_active_role('OFFICE_ADMIN') or requested_site is null
    or not private.office_owns_site(requested_site) or not private.site_is_active(requested_site)
    or not exists(select 1 from public.sites s where s.id=requested_site and s.name='Synthetic Static Security Site')
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

create or replace function public.start_onboarding_case(requested_case uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or actor is null or actor=c.person_id or c.state='CANCELLED'
    or not (private.has_active_role('SUPER_ADMIN') or private.onboarding_owner_authorised(c.id,actor))
  then raise exception 'Onboarding start denied'; end if;
  if c.state='IN_PROGRESS' then return c.id; end if;
  update public.onboarding_cases set state='IN_PROGRESS',started_at=now() where id=c.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'onboarding_case',c.id,'UPDATE',jsonb_build_object('state','IN_PROGRESS'));
  return c.id;
end;$$;

alter table public.tasks add column cancelled_at timestamptz;
alter table public.tasks add column cancellation_case_id uuid references public.onboarding_cases(id);
alter table public.tasks add column cancellation_reason text check (cancellation_reason='ONBOARDING_CASE_CANCELLED');
alter table public.tasks drop constraint tasks_state_check;
alter table public.tasks add constraint tasks_state_check check (state in ('OPEN','DONE','CANCELLED'));
alter table public.tasks drop constraint tasks_check;
alter table public.tasks add constraint tasks_check check (
  (state='OPEN' and completed_at is null and completion_kind is null and completion_event_id is null
    and cancelled_at is null and cancellation_case_id is null and cancellation_reason is null)
  or (state='DONE' and completed_at is not null and completion_kind='DOCUMENT_REVIEW_DECISION'
    and completion_event_id is not null and cancelled_at is null and cancellation_case_id is null and cancellation_reason is null)
  or (state='CANCELLED' and completed_at is null and completion_kind is null and completion_event_id is null
    and cancelled_at is not null and cancellation_case_id is not null
    and cancellation_reason='ONBOARDING_CASE_CANCELLED'));
create table public.task_assignment_changes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  old_assignee_person_id uuid not null references public.people(id),
  new_assignee_person_id uuid not null references public.people(id),
  actor_person_id uuid not null references public.people(id),
  owner_change_id uuid not null references public.onboarding_case_owner_changes(id),
  reason text not null,
  changed_at timestamptz not null default now(),
  check (old_assignee_person_id<>new_assignee_person_id),
  unique(task_id,owner_change_id)
);
alter table public.task_assignment_changes enable row level security;
revoke all on public.task_assignment_changes from public,anon,authenticated;

create or replace function private.guard_task() returns trigger
language plpgsql security definer set search_path='' as $$
declare expected_assignee uuid; source_submitted boolean; matching_review uuid;
  request_id uuid; linked_case uuid; c public.onboarding_cases%rowtype;
  owner_change public.onboarding_case_owner_changes%rowtype;
begin
  if tg_op='DELETE' then raise exception 'Tasks cannot be deleted'; end if;
  if tg_op='UPDATE' and (new.id is distinct from old.id or new.task_type is distinct from old.task_type
    or new.title is distinct from old.title or new.source_kind is distinct from old.source_kind
    or new.source_id is distinct from old.source_id or new.created_at is distinct from old.created_at
    or old.state<>'OPEN') then raise exception 'Task identity or state is immutable'; end if;
  if tg_op='INSERT' and (new.state<>'OPEN' or new.completion_event_id is not null
    or new.completion_kind is not null or new.completed_at is not null or new.cancelled_at is not null
    or new.cancellation_case_id is not null or new.cancellation_reason is not null)
  then raise exception 'Task insertion denied'; end if;
  select r.id,r.requester_person_id,(v.upload_state='SUBMITTED') into request_id,expected_assignee,source_submitted
    from public.document_versions v join public.documents d on d.id=v.document_id
    join public.document_requests r on r.id=d.request_id
    where v.id=new.source_id and d.classification='PERSONNEL_PRIVATE';
  linked_case:=private.onboarding_request_case(request_id);
  if linked_case is not null then
    select * into c from public.onboarding_cases where id=linked_case;
    expected_assignee:=c.owner_person_id;
  end if;
  if new.task_type<>'DOCUMENT_REVIEW' or new.source_kind<>'DOCUMENT_VERSION'
    or expected_assignee is null or source_submitted is not true then raise exception 'Task source denied'; end if;
  if tg_op='INSERT' then
    if new.assignee_person_id<>expected_assignee or (linked_case is not null and c.state<>'IN_PROGRESS')
    then raise exception 'Task assignment denied'; end if;
    return new;
  end if;
  if new.assignee_person_id is distinct from old.assignee_person_id then
    if new.state<>old.state or new.assignee_person_id<>expected_assignee or linked_case is null
      or c.state='CANCELLED' or new.updated_at<>transaction_timestamp()
      or new.completed_at is distinct from old.completed_at or new.completion_event_id is distinct from old.completion_event_id
      or new.cancelled_at is distinct from old.cancelled_at
    then raise exception 'Task reassignment denied'; end if;
    select * into owner_change from public.onboarding_case_owner_changes oc
      where oc.case_id=linked_case and oc.old_owner_person_id=old.assignee_person_id
        and oc.new_owner_person_id=new.assignee_person_id and oc.transaction_id=txid_current()
        and oc.actor_person_id=private.current_person_id() order by oc.changed_at desc limit 1;
    if owner_change.id is null then raise exception 'Task owner history required'; end if;
    insert into public.task_assignment_changes(task_id,old_assignee_person_id,new_assignee_person_id,
      actor_person_id,owner_change_id,reason)
      values(old.id,old.assignee_person_id,new.assignee_person_id,owner_change.actor_person_id,
        owner_change.id,owner_change.reason);
    insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,before_value,after_value)
      values(owner_change.actor_person_id,c.person_id,'task_assignment',old.id,'UPDATE',
        jsonb_build_object('assignee_person_id',old.assignee_person_id),
        jsonb_build_object('assignee_person_id',new.assignee_person_id,'case_id',c.id));
    return new;
  end if;
  if new.state='DONE' then
    select rev.id into matching_review from public.document_reviews rev
      where rev.id=new.completion_event_id and rev.version_id=new.source_id;
    if new.completion_kind<>'DOCUMENT_REVIEW_DECISION' or matching_review is null
      or new.completed_at is null or new.updated_at is distinct from new.completed_at
      or new.cancelled_at is not null or new.cancellation_case_id is not null
    then raise exception 'Task completion denied'; end if;
  elsif new.state='CANCELLED' then
    if linked_case is null or new.cancellation_case_id<>linked_case or c.state<>'CANCELLED'
      or new.cancellation_reason<>'ONBOARDING_CASE_CANCELLED'
      or new.cancelled_at is distinct from c.cancelled_at or new.updated_at is distinct from new.cancelled_at
      or new.completed_at is not null or new.completion_event_id is not null
      or exists(select 1 from public.document_reviews rev where rev.version_id=new.source_id)
    then raise exception 'Task cancellation denied'; end if;
  else raise exception 'Task transition denied'; end if;
  return new;
end;$$;

create or replace function private.ensure_document_review_task(version_id uuid,initiating_person uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.document_versions%rowtype; r public.document_requests%rowtype;
  existing_task public.tasks%rowtype; created_id uuid; linked_case uuid; expected_assignee uuid;
begin
  select * into v from public.document_versions where id=version_id;
  if v.id is null or v.upload_state<>'SUBMITTED' then raise exception 'Task source not submitted'; end if;
  select r0.* into r from public.documents d join public.document_requests r0 on r0.id=d.request_id
    where d.id=v.document_id and d.classification='PERSONNEL_PRIVATE';
  if r.id is null then raise exception 'Task source denied'; end if;
  linked_case:=private.onboarding_request_case(r.id);
  expected_assignee:=r.requester_person_id;
  if linked_case is not null then
    select owner_person_id into expected_assignee from public.onboarding_cases where id=linked_case;
  end if;
  insert into public.tasks(task_type,title,assignee_person_id,source_kind,source_id)
    values('DOCUMENT_REVIEW','Review submitted personnel evidence',expected_assignee,'DOCUMENT_VERSION',version_id)
    on conflict(source_kind,source_id) do nothing returning id into created_id;
  select * into existing_task from public.tasks where source_kind='DOCUMENT_VERSION' and source_id=version_id;
  if existing_task.id is null or existing_task.task_type<>'DOCUMENT_REVIEW'
    or (existing_task.state='OPEN' and existing_task.assignee_person_id<>expected_assignee)
    or (linked_case is null and existing_task.assignee_person_id<>r.requester_person_id)
  then raise exception 'Task source conflict'; end if;
  if created_id is not null then
    insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
      values(initiating_person,expected_assignee,'task',created_id,'INSERT',
        jsonb_build_object('source_kind','DOCUMENT_VERSION','source_id',version_id,'state','OPEN','automatic',true));
  end if;
  return existing_task.id;
end;$$;

create or replace function private.task_source_readable(version_id uuid,assignee uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.document_versions v
    join public.documents d on d.id=v.document_id
    join public.document_requests r on r.id=d.request_id
    where v.id=version_id and v.upload_state='SUBMITTED' and d.classification='PERSONNEL_PRIVATE'
      and private.document_can_read_request(r.id) and (
        (private.onboarding_request_case(r.id) is null and r.requester_person_id=assignee
          and ((private.has_active_role('OFFICE_ADMIN') and private.current_person_id()=assignee)
            or private.has_active_role('SUPER_ADMIN')))
        or (private.onboarding_request_case(r.id) is not null and (
          private.has_active_role('SUPER_ADMIN')
          or private.onboarding_office_case_access(private.onboarding_request_case(r.id),private.current_person_id())))))
$$;

-- A linked onboarding request follows its exact case. The requester's identity remains
-- immutable provenance; it is not perpetual access after reassignment.
create or replace function private.document_can_read_request(requested_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.document_requests r where r.id=requested_id and
    (case when private.onboarding_request_case(r.id) is not null then
      private.has_active_role('SUPER_ADMIN')
      or (r.target_person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
      or (private.has_active_role('OFFICE_ADMIN') and
        private.onboarding_office_case_access(private.onboarding_request_case(r.id),private.current_person_id()))
    else private.has_active_role('SUPER_ADMIN')
      or (r.target_person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
      or (r.requester_person_id=private.current_person_id() and private.has_active_role('OFFICE_ADMIN'))
    end))
$$;

create function private.document_can_review_request(requested_id uuid,actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.document_requests r where r.id=requested_id
    and r.target_person_id<>actor and (
      (private.onboarding_request_case(r.id) is null and (
        private.has_active_role('SUPER_ADMIN') or
        (private.has_active_role('OFFICE_ADMIN') and r.requester_person_id=actor)))
      or (private.onboarding_request_case(r.id) is not null and exists(
        select 1 from public.onboarding_cases c
        where c.id=private.onboarding_request_case(r.id) and c.state='IN_PROGRESS'
          and c.person_id=r.target_person_id and (
            private.has_active_role('SUPER_ADMIN') or
            (private.has_active_role('OFFICE_ADMIN') and
              private.onboarding_office_case_access(c.id,actor)))))))
$$;
revoke all on function private.document_can_review_request(uuid,uuid) from public,anon,authenticated;

create function public.reassign_onboarding_case(requested_case uuid,new_owner uuid,reason_text text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; change_id uuid; clean_reason text;
begin
  actor:=private.current_person_id(); clean_reason:=trim(reason_text);
  select * into c from public.onboarding_cases where id=requested_case for update;
  if actor is null or c.id is null or c.state<>'IN_PROGRESS' or actor=c.person_id
    or new_owner is null or new_owner=c.person_id or new_owner=c.owner_person_id
    or clean_reason is null or length(clean_reason) not between 10 and 500 or clean_reason ~ '[[:cntrl:]]'
    or not private.active_onboarding_team_member(c.team_id,new_owner)
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.active_onboarding_team_member(c.team_id,actor) and
        (c.owner_person_id=actor or private.onboarding_team_coordinator(c.team_id,actor))))
  then raise exception 'Onboarding reassignment denied'; end if;
  insert into public.onboarding_case_owner_changes(case_id,old_owner_person_id,
    new_owner_person_id,actor_person_id,reason)
    values(c.id,c.owner_person_id,new_owner,actor,clean_reason) returning id into change_id;
  update public.onboarding_cases set owner_person_id=new_owner where id=c.id;
  update public.tasks t set assignee_person_id=new_owner,updated_at=transaction_timestamp()
    from public.document_versions v join public.documents d on d.id=v.document_id
    where t.source_kind='DOCUMENT_VERSION' and t.source_id=v.id and d.request_id is not null
      and t.state='OPEN' and t.assignee_person_id=c.owner_person_id
      and private.onboarding_request_case(d.request_id)=c.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,before_value,after_value)
    values(actor,c.person_id,'onboarding_owner_change',change_id,'INSERT',
      jsonb_build_object('owner_person_id',c.owner_person_id),
      jsonb_build_object('owner_person_id',new_owner,'case_id',c.id,'reason',clean_reason));
  return change_id;
end;$$;

create function public.grant_onboarding_case_cover(requested_case uuid,covering_person uuid,
  starts_at timestamptz,ends_at timestamptz,reason_text text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; grant_id uuid; clean_reason text;
begin
  actor:=private.current_person_id(); clean_reason:=trim(reason_text);
  select * into c from public.onboarding_cases where id=requested_case for update;
  if actor is null or c.id is null or c.state<>'IN_PROGRESS' or covering_person is null
    or covering_person=c.person_id or covering_person=c.owner_person_id or actor=c.person_id
    or starts_at is null or ends_at is null or starts_at<transaction_timestamp()-interval '1 minute'
    or ends_at<=starts_at or ends_at>(((starts_at at time zone 'Europe/London')+interval '14 days') at time zone 'Europe/London')
    or clean_reason is null or length(clean_reason) not between 10 and 500 or clean_reason ~ '[[:cntrl:]]'
    or not private.active_onboarding_team_member(c.team_id,covering_person)
    or not private.active_onboarding_team_member(c.team_id,c.owner_person_id)
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.active_onboarding_team_member(c.team_id,actor) and actor=c.owner_person_id))
    or exists(select 1 from public.onboarding_case_cover_grants g where g.case_id=c.id
      and g.covering_person_id=covering_person and g.revoked_at is null and
      tstzrange(g.effective_from,g.effective_until,'[)') && tstzrange(starts_at,ends_at,'[)'))
  then raise exception 'Onboarding cover denied'; end if;
  insert into public.onboarding_case_cover_grants(case_id,owner_person_id,covering_person_id,
    grantor_person_id,effective_from,effective_until,reason)
    values(c.id,c.owner_person_id,covering_person,actor,starts_at,ends_at,clean_reason)
    returning id into grant_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,covering_person,'onboarding_cover',grant_id,'INSERT',
      jsonb_build_object('case_id',c.id,'starts_at',starts_at,'ends_at',ends_at,'reason',clean_reason));
  return grant_id;
end;$$;

create function public.revoke_onboarding_case_cover(requested_grant uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; g public.onboarding_case_cover_grants%rowtype; c public.onboarding_cases%rowtype;
begin
  actor:=private.current_person_id();
  select * into g from public.onboarding_case_cover_grants where id=requested_grant for update;
  select * into c from public.onboarding_cases where id=g.case_id for update;
  if actor is null or g.id is null or c.id is null or not (private.has_active_role('SUPER_ADMIN')
    or (private.active_onboarding_team_member(c.team_id,actor) and
      (actor=c.owner_person_id or actor=g.grantor_person_id)))
  then raise exception 'Onboarding cover revoke denied'; end if;
  if g.revoked_at is not null then return g.id; end if;
  update public.onboarding_case_cover_grants set revoked_at=now(),revoked_by_person_id=actor where id=g.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,g.covering_person_id,'onboarding_cover',g.id,'UPDATE',jsonb_build_object('revoked',true));
  return g.id;
end;$$;

create or replace function public.cancel_onboarding_case(requested_case uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cancellation_time timestamptz;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or actor is null or actor=c.person_id or
    not (private.has_active_role('SUPER_ADMIN') or private.onboarding_owner_authorised(c.id,actor))
  then raise exception 'Onboarding cancellation denied'; end if;
  if c.state='CANCELLED' then return c.id; end if;
  cancellation_time:=transaction_timestamp();
  update public.onboarding_cases set state='CANCELLED',cancelled_at=cancellation_time where id=c.id;
  update public.tasks t set state='CANCELLED',cancellation_case_id=c.id,
    cancellation_reason='ONBOARDING_CASE_CANCELLED',cancelled_at=cancellation_time,
    updated_at=cancellation_time
    from public.document_versions v join public.documents d on d.id=v.document_id
    where t.source_kind='DOCUMENT_VERSION' and t.source_id=v.id and t.state='OPEN'
      and private.onboarding_request_case(d.request_id)=c.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'onboarding_case',c.id,'UPDATE',jsonb_build_object('state','CANCELLED'));
  return c.id;
end;$$;

revoke all on function public.reassign_onboarding_case(uuid,uuid,text),
  public.grant_onboarding_case_cover(uuid,uuid,timestamptz,timestamptz,text),
  public.revoke_onboarding_case_cover(uuid) from public,anon,authenticated;
grant execute on function public.reassign_onboarding_case(uuid,uuid,text),
  public.grant_onboarding_case_cover(uuid,uuid,timestamptz,timestamptz,text),
  public.revoke_onboarding_case_cover(uuid) to authenticated;

create or replace function public.review_document_version(requested_id uuid,reviewed_version uuid,
  supplied_decision text,supplied_reason text,supplied_comment text) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; r public.document_requests%rowtype; d public.documents%rowtype;
  v public.document_versions%rowtype; review_id uuid; clean_comment text; linked_case uuid;
  locked_case public.onboarding_cases%rowtype;
begin
  actor:=private.current_person_id(); linked_case:=private.onboarding_request_case(requested_id);
  if actor is null or not (private.has_active_role('SUPER_ADMIN') or private.has_active_role('OFFICE_ADMIN'))
  then raise exception 'Review denied'; end if;
  if linked_case is not null then
    select * into locked_case from public.onboarding_cases where id=linked_case for update;
    if locked_case.id is null or locked_case.state<>'IN_PROGRESS' then raise exception 'Review denied'; end if;
  end if;
  select * into r from public.document_requests where id=requested_id for update;
  if r.id is null or r.target_person_id=actor or not private.document_can_review_request(r.id,actor)
    or (linked_case is not null and linked_case is distinct from private.onboarding_request_case(r.id))
  then raise exception 'Review denied'; end if;
  select * into d from public.documents where request_id=requested_id;
  if d.id is null or d.classification<>'PERSONNEL_PRIVATE' then raise exception 'Review denied'; end if;
  select * into v from public.document_versions where id=reviewed_version and document_id=d.id for update;
  if v.id is null or v.upload_state<>'SUBMITTED' or v.uploader_person_id=actor or
    exists(select 1 from public.document_versions later where later.document_id=d.id
      and later.upload_state='SUBMITTED' and later.version_number>v.version_number) or
    exists(select 1 from public.document_reviews existing where existing.version_id=reviewed_version)
  then raise exception 'Review conflict'; end if;
  clean_comment:=case when supplied_comment is null then null else trim(supplied_comment) end;
  if supplied_decision='ACCEPTED_AS_EVIDENCE' then
    if supplied_reason is not null or clean_comment is not null then raise exception 'Review input denied'; end if;
  elsif supplied_decision='REJECTED' then
    if supplied_reason is null or supplied_reason not in
      ('UNREADABLE','WRONG_DOCUMENT','INCOMPLETE','EXPIRED_OR_OUTDATED','DETAILS_DO_NOT_MATCH','OTHER')
      or clean_comment is null or length(clean_comment) not between 10 and 500
      or clean_comment ~ '[[:cntrl:]]' then raise exception 'Review input denied'; end if;
  else raise exception 'Review input denied'; end if;
  insert into public.document_reviews(request_id,document_id,version_id,reviewer_person_id,
    decision,reason_code,reviewer_comment)
    values(r.id,d.id,v.id,actor,supplied_decision,supplied_reason,clean_comment)
    returning id into review_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,r.target_person_id,'document_review',review_id,'INSERT',
      jsonb_build_object('request_id',r.id,'version_id',v.id,'decision',supplied_decision));
  return review_id;
end;$$;

create function private.create_case_document_request(c public.onboarding_cases,request_title text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; created_id uuid;
begin
  actor:=private.current_person_id();
  if c.id is null or c.state<>'IN_PROGRESS' or actor is null or actor=c.person_id
    or not private.onboarding_owner_authorised(c.id,actor)
    or request_title not in ('Synthetic onboarding Right to Work evidence',
      'Synthetic onboarding SIA evidence','Synthetic onboarding Identity Evidence')
  then raise exception 'Onboarding document request denied'; end if;
  insert into public.document_requests(target_person_id,requester_person_id,site_id,title)
    values(c.person_id,actor,c.site_id,request_title) returning id into created_id;
  insert into public.documents(request_id,owner_person_id) values(created_id,c.person_id);
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'document_request',created_id,'INSERT',
      jsonb_build_object('status','REQUESTED','onboarding_case_id',c.id));
  return created_id;
end;$$;
revoke all on function private.create_case_document_request(public.onboarding_cases,text) from public,anon,authenticated;

-- Existing evidence decisions retain exact version guards; only current case authority changes.
create or replace function public.issue_onboarding_rtw_request(requested_case uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; c public.onboarding_cases%rowtype; req public.onboarding_case_requirements%rowtype;
  new_request uuid;
begin
  actor := private.current_person_id();
  select * into c from public.onboarding_cases where id = requested_case for update;
  if c.id is null or c.state <> 'IN_PROGRESS' or actor is null or actor = c.person_id
    or not private.onboarding_owner_authorised(c.id,actor)
  then raise exception 'Onboarding request denied'; end if;
  select cr.* into req from public.onboarding_case_requirements cr
    join public.onboarding_requirement_definitions d on d.id = cr.definition_id
    where cr.case_id = c.id and d.code = 'RIGHT_TO_WORK' for update of cr;
  if req.id is null then raise exception 'RTW requirement unavailable'; end if;
  if req.document_request_id is not null then return req.document_request_id; end if;
  new_request := private.create_case_document_request(c,
    'Synthetic onboarding Right to Work evidence');
  update public.onboarding_case_requirements set document_request_id = new_request where id = req.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (actor,c.person_id,'onboarding_requirement',req.id,'UPDATE',
      jsonb_build_object('document_request_id',new_request,'kind','RIGHT_TO_WORK'));
  return new_request;
end;
$$;

create or replace function public.verify_onboarding_rtw(requested_case uuid, requested_requirement uuid,
  accepted_version uuid, requested_synthetic_valid_until timestamptz default null) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; dr public.document_requests%rowtype;
  doc public.documents%rowtype; v public.document_versions%rowtype; rev public.document_reviews%rowtype;
  existing public.onboarding_requirement_verifications%rowtype; created_id uuid;
begin
  actor := private.current_person_id();
  select * into c from public.onboarding_cases where id = requested_case for update;
  if c.id is null or c.state <> 'IN_PROGRESS' or actor is null or actor = c.person_id
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.has_active_role('OFFICE_ADMIN') and private.onboarding_office_case_access(c.id,actor)))
  then raise exception 'Onboarding verification denied'; end if;
  select * into cr from public.onboarding_case_requirements where id = requested_requirement and case_id = c.id for update;
  select * into d from public.onboarding_requirement_definitions where id = cr.definition_id;
  select * into dr from public.document_requests where id = cr.document_request_id;
  select * into doc from public.documents where request_id = dr.id and classification = 'PERSONNEL_PRIVATE';
  select * into v from public.document_versions where id = accepted_version and document_id = doc.id;
  select * into rev from public.document_reviews where version_id = v.id and request_id = dr.id;
  if cr.id is null or d.code <> 'RIGHT_TO_WORK' or dr.id is null or doc.id is null
    or dr.target_person_id <> c.person_id
    or dr.site_id is distinct from c.site_id or v.id is null or v.upload_state <> 'SUBMITTED'
    or rev.id is null or rev.decision <> 'ACCEPTED_AS_EVIDENCE'
    or (requested_synthetic_valid_until is not null and requested_synthetic_valid_until <= now())
    or exists (select 1 from public.document_versions later where later.document_id = doc.id
      and later.upload_state = 'SUBMITTED' and later.version_number > v.version_number)
  then raise exception 'Onboarding verification source denied'; end if;
  select * into existing from public.onboarding_requirement_verifications
    where requirement_id = cr.id and evidence_version_id = v.id;
  if existing.id is not null then
    if existing.synthetic_valid_until is distinct from requested_synthetic_valid_until then
      raise exception 'Onboarding verification conflict'; end if;
    return existing.id;
  end if;
  insert into public.onboarding_requirement_verifications(case_id,requirement_id,target_person_id,
    verifier_person_id,evidence_version_id,decision,synthetic_valid_until)
    values (c.id,cr.id,c.person_id,actor,v.id,'VERIFIED',requested_synthetic_valid_until)
    returning id into created_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (actor,c.person_id,'onboarding_verification',created_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',cr.id,'version_id',v.id,
        'decision','VERIFIED','synthetic',true,'super_override',private.has_active_role('SUPER_ADMIN') and actor <> c.owner_person_id));
  return created_id;
end;
$$;

create or replace function public.issue_onboarding_sia_request(requested_case uuid,requested_submission uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; s public.onboarding_sia_submissions%rowtype;
  latest_id uuid; created_request uuid; sr public.person_sia_credential_revisions%rowtype;
  current_credential public.person_sia_credentials%rowtype;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or c.state<>'IN_PROGRESS' or actor is null or actor=c.person_id
    or not private.onboarding_owner_authorised(c.id,actor)
  then raise exception 'SIA request denied'; end if;
  select id into latest_id from public.onboarding_sia_submissions where case_id=c.id
    order by submitted_at desc,id desc limit 1;
  select * into s from public.onboarding_sia_submissions where id=requested_submission
    and case_id=c.id for update;
  if s.id is null or s.id<>latest_id then raise exception 'SIA submission stale'; end if;
  select * into sr from public.person_sia_credential_revisions where id=s.revision_id;
  select * into current_credential from public.person_sia_credentials where id=sr.credential_id;
  if sr.person_id<>c.person_id or current_credential.person_id<>c.person_id
    or sr.credential_change_seq<>current_credential.credential_change_seq
    or sr.synthetic_reference is distinct from current_credential.synthetic_reference
    or sr.expires_on is distinct from current_credential.expires_on
    or sr.expires_on<private.uk_today()
  then raise exception 'SIA submitted credential is no longer current'; end if;
  if s.document_request_id is not null then return s.document_request_id; end if;
  created_request:=private.create_case_document_request(c,
    'Synthetic onboarding SIA evidence');
  update public.onboarding_sia_submissions set document_request_id=created_request where id=s.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'sia_submission',s.id,'UPDATE',
      jsonb_build_object('case_id',c.id,'requirement_id',s.requirement_id,
        'document_request_id',created_request,'synthetic',true));
  return created_request;
end;
$$;

create or replace function public.verify_onboarding_sia(requested_case uuid,requested_requirement uuid,
  requested_submission uuid,accepted_version uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; s public.onboarding_sia_submissions%rowtype;
  sr public.person_sia_credential_revisions%rowtype; current_credential public.person_sia_credentials%rowtype;
  dr public.document_requests%rowtype; doc public.documents%rowtype;
  v public.document_versions%rowtype; rev public.document_reviews%rowtype;
  existing uuid; created_id uuid;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or c.state<>'IN_PROGRESS' or actor is null or actor=c.person_id
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.has_active_role('OFFICE_ADMIN') and private.onboarding_office_case_access(c.id,actor)))
  then raise exception 'SIA verification denied'; end if;
  select * into cr from public.onboarding_case_requirements
    where id=requested_requirement and case_id=c.id for update;
  select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
  select * into s from public.onboarding_sia_submissions
    where id=requested_submission and requirement_id=cr.id;
  select * into sr from public.person_sia_credential_revisions where id=s.revision_id;
  select * into current_credential from public.person_sia_credentials where id=sr.credential_id;
  select * into dr from public.document_requests where id=s.document_request_id;
  select * into doc from public.documents where request_id=dr.id and classification='PERSONNEL_PRIVATE';
  select * into v from public.document_versions where id=accepted_version and document_id=doc.id;
  select * into rev from public.document_reviews where version_id=v.id and request_id=dr.id;
  if cr.id is null or d.code<>'SIA_LICENCE' or d.provider_state<>'AVAILABLE'
    or s.id is null or s.case_id<>c.id or s.person_id<>c.person_id
    or sr.id is null or sr.person_id<>c.person_id or sr.category<>d.expected_sia_category
    or current_credential.id is null or current_credential.person_id<>c.person_id
    or current_credential.credential_change_seq<>sr.credential_change_seq
    or current_credential.synthetic_reference is distinct from sr.synthetic_reference
    or current_credential.expires_on is distinct from sr.expires_on
    or sr.expires_on<private.uk_today() or dr.id is null
    or dr.target_person_id<>c.person_id
    or dr.site_id is distinct from c.site_id or doc.id is null
    or v.id is null or v.upload_state<>'SUBMITTED' or rev.decision<>'ACCEPTED_AS_EVIDENCE'
    or exists(select 1 from public.onboarding_sia_submissions newer where newer.requirement_id=cr.id
      and (newer.submitted_at,newer.id)>(s.submitted_at,s.id))
    or exists(select 1 from public.document_versions later where later.document_id=doc.id
      and later.upload_state='SUBMITTED' and later.version_number>v.version_number)
  then raise exception 'SIA verification source denied'; end if;
  select id into existing from public.onboarding_requirement_verifications
    where requirement_id=cr.id and sia_submission_id=s.id;
  if existing is not null then return existing; end if;
  insert into public.onboarding_requirement_verifications(case_id,requirement_id,target_person_id,
    verifier_person_id,evidence_version_id,decision,sia_submission_id)
    values(c.id,cr.id,c.person_id,actor,v.id,'VERIFIED',s.id) returning id into created_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'onboarding_verification',created_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',cr.id,'sia_submission_id',s.id,
        'credential_revision_id',sr.id,'document_request_id',dr.id,'version_id',v.id,
        'synthetic',true,'super_override',private.has_active_role('SUPER_ADMIN') and actor<>c.owner_person_id));
  return created_id;
end;
$$;

create or replace function public.issue_onboarding_identity_request(requested_case uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; tv public.onboarding_template_versions%rowtype;
  existing public.document_requests%rowtype; created_id uuid;
begin
  actor := private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or c.state<>'IN_PROGRESS' or actor is null or actor=c.person_id
    or not private.onboarding_owner_authorised(c.id,actor)
  then raise exception 'Identity request denied'; end if;
  select r.* into cr from public.onboarding_case_requirements r
    join public.onboarding_requirement_definitions def on def.id=r.definition_id
    where r.case_id=c.id and def.code='IDENTITY_EVIDENCE' for update of r;
  select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
  select * into tv from public.onboarding_template_versions where id=c.template_version_id;
  if cr.id is null or tv.version_number<>2 or d.template_version_id<>c.template_version_id
    or d.fulfilment_kind<>'NOT_CONFIGURED' or d.provider_state<>'NOT_CONFIGURED'
  then raise exception 'Identity requirement unavailable'; end if;
  if cr.document_request_id is not null then
    select * into existing from public.document_requests where id=cr.document_request_id;
    if existing.id is null or existing.title<>'Synthetic onboarding Identity Evidence'
      or existing.target_person_id<>c.person_id
      or existing.site_id is distinct from c.site_id then raise exception 'Identity request mismatch'; end if;
    return existing.id;
  end if;
  created_id := private.create_case_document_request(c,'Synthetic onboarding Identity Evidence');
  update public.onboarding_case_requirements set document_request_id=created_id where id=cr.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'onboarding_requirement',cr.id,'UPDATE',
      jsonb_build_object('document_request_id',created_id,'kind','IDENTITY_EVIDENCE','case_id',c.id));
  return created_id;
end;
$$;

create or replace function public.verify_onboarding_identity(requested_case uuid,requested_requirement uuid,
  accepted_version uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; tv public.onboarding_template_versions%rowtype;
  dr public.document_requests%rowtype; doc public.documents%rowtype;
  v public.document_versions%rowtype; rev public.document_reviews%rowtype;
  existing uuid; created_id uuid;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or c.state<>'IN_PROGRESS' or actor is null or actor=c.person_id
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.has_active_role('OFFICE_ADMIN') and private.onboarding_office_case_access(c.id,actor)))
  then raise exception 'Identity verification denied'; end if;
  select * into cr from public.onboarding_case_requirements
    where id=requested_requirement and case_id=c.id for update;
  select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
  select * into tv from public.onboarding_template_versions where id=c.template_version_id;
  select * into dr from public.document_requests where id=cr.document_request_id;
  select * into doc from public.documents where request_id=dr.id and classification='PERSONNEL_PRIVATE';
  select * into v from public.document_versions where id=accepted_version and document_id=doc.id;
  select * into rev from public.document_reviews where version_id=v.id and request_id=dr.id;
  if cr.id is null or d.code<>'IDENTITY_EVIDENCE' or d.template_version_id<>c.template_version_id
    or tv.version_number<>2 or d.fulfilment_kind<>'NOT_CONFIGURED' or d.provider_state<>'NOT_CONFIGURED'
    or dr.id is null or dr.title<>'Synthetic onboarding Identity Evidence'
    or dr.target_person_id<>c.person_id
    or dr.site_id is distinct from c.site_id or dr.created_at<c.started_at or doc.id is null
    or v.id is null or v.upload_state<>'SUBMITTED' or rev.id is null
    or rev.decision<>'ACCEPTED_AS_EVIDENCE'
    or exists(select 1 from public.document_versions later where later.document_id=doc.id
      and later.upload_state='SUBMITTED' and later.version_number>v.version_number)
  then raise exception 'Identity verification source denied'; end if;
  select id into existing from public.onboarding_requirement_verifications
    where requirement_id=cr.id and evidence_version_id=v.id;
  if existing is not null then return existing; end if;
  insert into public.onboarding_requirement_verifications(case_id,requirement_id,target_person_id,
    verifier_person_id,evidence_version_id,decision)
    values(c.id,cr.id,c.person_id,actor,v.id,'VERIFIED') returning id into created_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'onboarding_verification',created_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',cr.id,'document_request_id',dr.id,
        'version_id',v.id,'synthetic',true,'super_override',private.has_active_role('SUPER_ADMIN') and actor<>c.owner_person_id));
  return created_id;
end;
$$;

create or replace function private.guard_onboarding_requirement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.onboarding_cases%rowtype; d public.onboarding_requirement_definitions%rowtype;
  req public.document_requests%rowtype; tv public.onboarding_template_versions%rowtype;
begin
  if tg_op = 'DELETE' then raise exception 'Onboarding requirement history cannot be deleted'; end if;
  if tg_op = 'INSERT' then
    select * into c from public.onboarding_cases where id = new.case_id;
    select * into d from public.onboarding_requirement_definitions where id = new.definition_id;
    if c.id is null or d.id is null or d.template_version_id <> c.template_version_id
      or new.document_request_id is not null then raise exception 'Onboarding definition mismatch'; end if;
    return new;
  end if;
  if new.id <> old.id or new.case_id <> old.case_id or new.definition_id <> old.definition_id
    or new.created_at <> old.created_at or old.document_request_id is not null
    or new.document_request_id is null then raise exception 'Onboarding requirement is immutable'; end if;
  select * into c from public.onboarding_cases where id = old.case_id;
  select * into d from public.onboarding_requirement_definitions where id = old.definition_id;
  select * into req from public.document_requests where id = new.document_request_id;
  if c.state <> 'IN_PROGRESS' or req.id is null
    or req.target_person_id <> c.person_id
    or req.requester_person_id <> private.current_person_id()
    or not private.onboarding_owner_authorised(c.id,private.current_person_id())
    or req.site_id is distinct from c.site_id then raise exception 'Onboarding evidence link denied'; end if;
  if d.code = 'RIGHT_TO_WORK' then return new; end if;
  select * into tv from public.onboarding_template_versions where id=c.template_version_id;
  if d.code <> 'IDENTITY_EVIDENCE' or d.template_version_id <> c.template_version_id
    or tv.version_number <> 2 or d.fulfilment_kind <> 'NOT_CONFIGURED'
    or d.provider_state <> 'NOT_CONFIGURED'
    or req.title <> 'Synthetic onboarding Identity Evidence'
    or req.created_at < c.started_at
  then raise exception 'Identity Evidence activation denied'; end if;
  return new;
end;
$$;

create or replace function private.guard_onboarding_verification() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; v public.document_versions%rowtype;
  doc public.documents%rowtype; rev public.document_reviews%rowtype;
  dr public.document_requests%rowtype; tv public.onboarding_template_versions%rowtype;
  s public.onboarding_sia_submissions%rowtype; sr public.person_sia_credential_revisions%rowtype;
  current_credential public.person_sia_credentials%rowtype;
begin
  if tg_op<>'INSERT' then raise exception 'Onboarding verification is immutable'; end if;
  select * into c from public.onboarding_cases where id=new.case_id;
  select * into cr from public.onboarding_case_requirements where id=new.requirement_id;
  select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
  select * into v from public.document_versions where id=new.evidence_version_id;
  select * into doc from public.documents where id=v.document_id;
  select * into rev from public.document_reviews where version_id=v.id;
  if c.id is null or c.state<>'IN_PROGRESS' or cr.case_id<>c.id
    or new.target_person_id<>c.person_id or new.verifier_person_id=c.person_id
    or new.verifier_person_id is distinct from private.current_person_id()
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.has_active_role('OFFICE_ADMIN') and private.onboarding_office_case_access(c.id,new.verifier_person_id)))
    or v.id is null or v.upload_state<>'SUBMITTED' or doc.classification<>'PERSONNEL_PRIVATE'
    or rev.decision<>'ACCEPTED_AS_EVIDENCE' or new.decision<>'VERIFIED'
    or exists(select 1 from public.document_versions later where later.document_id=v.document_id
      and later.upload_state='SUBMITTED' and later.version_number>v.version_number)
  then raise exception 'Onboarding verification source denied'; end if;
  if d.code='RIGHT_TO_WORK' then
    if new.sia_submission_id is not null or doc.request_id<>cr.document_request_id
      or (new.synthetic_valid_until is not null and new.synthetic_valid_until<=now())
    then raise exception 'RTW verification source denied'; end if;
  elsif d.code='SIA_LICENCE' then
    select * into s from public.onboarding_sia_submissions where id=new.sia_submission_id;
    select * into sr from public.person_sia_credential_revisions where id=s.revision_id;
    select * into current_credential from public.person_sia_credentials where id=sr.credential_id;
    if new.synthetic_valid_until is not null or s.id is null or s.case_id<>c.id or s.requirement_id<>cr.id
      or s.person_id<>c.person_id or s.document_request_id<>doc.request_id
      or sr.person_id<>c.person_id or sr.category<>d.expected_sia_category
      or current_credential.person_id<>c.person_id or current_credential.category<>sr.category
      or current_credential.credential_change_seq<>sr.credential_change_seq
      or current_credential.synthetic_reference is distinct from sr.synthetic_reference
      or current_credential.expires_on is distinct from sr.expires_on
      or sr.expires_on<private.uk_today()
      or exists(select 1 from public.onboarding_sia_submissions newer where newer.requirement_id=cr.id
        and (newer.submitted_at,newer.id)>(s.submitted_at,s.id))
    then raise exception 'SIA verification source denied'; end if;
  elsif d.code='IDENTITY_EVIDENCE' then
    select * into tv from public.onboarding_template_versions where id=c.template_version_id;
    select * into dr from public.document_requests where id=cr.document_request_id;
    if tv.version_number<>2 or d.template_version_id<>c.template_version_id
      or d.fulfilment_kind<>'NOT_CONFIGURED' or d.provider_state<>'NOT_CONFIGURED'
      or new.sia_submission_id is not null or new.synthetic_valid_until is not null
      or dr.id is null or dr.title<>'Synthetic onboarding Identity Evidence'
      or dr.target_person_id<>c.person_id
      or dr.site_id is distinct from c.site_id or dr.created_at<c.started_at
      or doc.request_id<>dr.id or rev.request_id<>dr.id
    then raise exception 'Identity verification source denied'; end if;
  else raise exception 'Unsupported requirement verification'; end if;
  return new;
end;
$$;

-- Case-bound read paths, without widening team triage into private Person access.
create or replace function private.guard_03b_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; pr public.person_profile_revisions%rowtype;
  sr public.person_sia_credential_revisions%rowtype; req public.document_requests%rowtype;
begin
  if tg_op='DELETE' then raise exception 'Submitted history cannot be deleted'; end if;
  if tg_table_name in ('person_profile_revisions','person_sia_credential_revisions') then
    if tg_op='UPDATE' then raise exception 'Submitted revision is immutable'; end if;
    if new.person_id<>new.submitted_by_person_id or new.submitted_by_person_id is distinct from private.current_person_id()
      or not private.has_active_role('SECURITY_STAFF') then raise exception 'Submitted revision denied'; end if;
    return new;
  end if;
  if tg_table_name='onboarding_profile_submissions' then
    if tg_op='UPDATE' then raise exception 'Profile submission is immutable'; end if;
    select * into c from public.onboarding_cases where id=new.case_id;
    select * into cr from public.onboarding_case_requirements where id=new.requirement_id;
    select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
    select * into pr from public.person_profile_revisions where id=new.revision_id;
    if c.id is null or c.state<>'IN_PROGRESS' or c.person_id<>private.current_person_id()
      or not private.has_active_role('SECURITY_STAFF') or cr.case_id<>c.id or d.code<>'PERSONAL_DETAILS'
      or d.provider_state<>'AVAILABLE' or pr.person_id<>c.person_id then
      raise exception 'Profile submission source denied'; end if;
    return new;
  end if;
  if tg_table_name='onboarding_sia_submissions' then
    if tg_op='UPDATE' then
      if old.document_request_id is not null or new.document_request_id is null
        or new.id<>old.id or new.case_id<>old.case_id or new.requirement_id<>old.requirement_id
        or new.person_id<>old.person_id or new.revision_id<>old.revision_id
        or new.request_key<>old.request_key or new.submitted_at<>old.submitted_at then
        raise exception 'SIA submission is immutable'; end if;
      select * into c from public.onboarding_cases where id=old.case_id;
      select * into req from public.document_requests where id=new.document_request_id;
      if c.state<>'IN_PROGRESS' or req.id is null or req.target_person_id<>c.person_id
        or req.requester_person_id<>private.current_person_id() or req.site_id is distinct from c.site_id
        or not private.onboarding_owner_authorised(c.id,private.current_person_id())
      then raise exception 'SIA evidence link denied'; end if;
      return new;
    end if;
    select * into c from public.onboarding_cases where id=new.case_id;
    select * into cr from public.onboarding_case_requirements where id=new.requirement_id;
    select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
    select * into sr from public.person_sia_credential_revisions where id=new.revision_id;
    if c.id is null or c.state<>'IN_PROGRESS' or c.person_id<>private.current_person_id()
      or not private.has_active_role('SECURITY_STAFF') or cr.case_id<>c.id or d.code<>'SIA_LICENCE'
      or d.provider_state<>'AVAILABLE' or sr.person_id<>c.person_id
      or sr.category<>d.expected_sia_category or new.document_request_id is not null
    then raise exception 'SIA submission source denied'; end if;
    return new;
  end if;
  raise exception 'Unsupported history operation';
end;
$$;

create or replace function private.can_read_controlled_assignment(requested_assignment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.onboarding_controlled_assignments a
    join public.onboarding_cases c on c.id=a.case_id
    where a.id=requested_assignment and private.current_person_id() is not null
      and (private.has_active_role('SUPER_ADMIN')
        or (private.has_active_role('OFFICE_ADMIN') and private.onboarding_office_case_access(c.id,private.current_person_id()))
        or (private.has_active_role('SECURITY_STAFF') and c.person_id=private.current_person_id())))
$$;

create or replace function private.can_download_controlled_key(requested_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.controlled_document_versions v
    join public.controlled_documents d on d.id=v.document_id
    where v.object_key=requested_key and v.upload_state='READY' and (
      (private.can_publish_controlled(d.family) and d.created_by_person_id=private.current_person_id())
      or exists(select 1 from public.onboarding_controlled_assignments a
        join public.onboarding_cases c on c.id=a.case_id
        where a.version_id=v.id and c.state='IN_PROGRESS'
          and (private.has_active_role('SUPER_ADMIN')
            or (private.has_active_role('OFFICE_ADMIN') and private.onboarding_office_case_access(c.id,private.current_person_id()))
            or (private.has_active_role('SECURITY_STAFF') and c.person_id=private.current_person_id())))
    ))
$$;

create or replace function public.read_onboarding_private_profile(requested_case uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; v public.onboarding_template_versions%rowtype;
  current_profile jsonb; submitted_profile jsonb; current_sia jsonb; submitted_sia jsonb;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case;
  select * into v from public.onboarding_template_versions where id=c.template_version_id;
  if actor is null or c.id is null or v.version_number<2 or not (private.has_active_role('SUPER_ADMIN') or
    (private.has_active_role('OFFICE_ADMIN') and private.onboarding_office_case_access(c.id,actor)))
  then raise exception 'Private profile oversight denied'; end if;
  if c.state in ('DRAFT','IN_PROGRESS') then
    select to_jsonb(p) into current_profile from public.person_profiles p where p.person_id=c.person_id;
    select to_jsonb(sc) into current_sia from public.person_sia_credentials sc
      where sc.person_id=c.person_id and sc.category='SECURITY_GUARDING';
  end if;
  select to_jsonb(r) into submitted_profile from public.person_profile_revisions r
    join public.onboarding_profile_submissions s on s.revision_id=r.id
    where s.case_id=c.id order by s.submitted_at desc,s.id desc limit 1;
  select to_jsonb(r) into submitted_sia from public.person_sia_credential_revisions r
    join public.onboarding_sia_submissions s on s.revision_id=r.id
    where s.case_id=c.id order by s.submitted_at desc,s.id desc limit 1;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'person_profile',c.person_id,'READ',
      jsonb_build_object('case_id',c.id,'scope',case when private.has_active_role('SUPER_ADMIN') then 'SUPER_ADMIN_ONBOARDING_PRIVATE_READ' else 'OFFICE_CASE_PRIVATE_READ' end));
  return jsonb_build_object('profile',current_profile,'submittedProfile',submitted_profile,
    'siaCredential',current_sia,'submittedSia',submitted_sia);
end;
$$;

create or replace function private.office_manages_onboarding_person(target_person uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_active_role('OFFICE_ADMIN') and not private.has_active_role('SUPER_ADMIN') and exists (
    select 1 from public.onboarding_cases c
    join public.onboarding_template_versions v on v.id=c.template_version_id
    where c.person_id=target_person and private.onboarding_owner_authorised(c.id,private.current_person_id())
      and c.state in ('DRAFT','IN_PROGRESS') and v.version_number>=2)
$$;

drop policy person_profile_revisions_read on public.person_profile_revisions;
create policy person_profile_revisions_read on public.person_profile_revisions for select to authenticated using (
  (person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
  or (not private.has_active_role('SUPER_ADMIN') and exists (
    select 1 from public.onboarding_profile_submissions s
    where s.revision_id=public.person_profile_revisions.id
      and private.onboarding_owner_authorised(s.case_id,private.current_person_id()))));
drop policy sia_revisions_read on public.person_sia_credential_revisions;
create policy sia_revisions_read on public.person_sia_credential_revisions for select to authenticated using (
  (person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
  or (not private.has_active_role('SUPER_ADMIN') and exists (
    select 1 from public.onboarding_sia_submissions s
    where s.revision_id=public.person_sia_credential_revisions.id
      and private.onboarding_owner_authorised(s.case_id,private.current_person_id()))));

-- This projection deliberately returns no private Person, credential, request,
-- version, filename, review or acknowledgement identifiers/content.
create function private.onboarding_case_triage(requested_case uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.onboarding_cases%rowtype; req record; completed integer:=0;
  first_code text; first_actor text; first_action text; done boolean;
  request_id uuid; latest_version uuid; review_decision text; matched_verification boolean;
  submitted_revision public.person_profile_revisions%rowtype;
  profile public.person_profiles%rowtype; sia_submission public.onboarding_sia_submissions%rowtype;
  sia_revision public.person_sia_credential_revisions%rowtype;
  current_sia public.person_sia_credentials%rowtype;
  assigned uuid; accessed boolean; acknowledged boolean;
begin
  select * into c from public.onboarding_cases where id=requested_case;
  if c.id is null then return null; end if;
  if c.state='CANCELLED' then first_code:='CASE_CANCELLED';first_actor:='NONE';first_action:='Cancelled case'; end if;
  if c.state='DRAFT' then first_code:='CASE_START';first_actor:='OFFICE';first_action:='Start onboarding'; end if;
  for req in select cr.id,cr.document_request_id,d.code from public.onboarding_case_requirements cr
    join public.onboarding_requirement_definitions d on d.id=cr.definition_id
    where cr.case_id=c.id order by d.position loop
    done:=false; request_id:=req.document_request_id;
    latest_version:=null;review_decision:=null;matched_verification:=false;
    if req.code='PERSONAL_DETAILS' then
      select * into profile from public.person_profiles p where p.person_id=c.person_id;
      select r.* into submitted_revision from public.person_profile_revisions r
        join public.onboarding_profile_submissions s on s.revision_id=r.id
        where s.requirement_id=req.id order by s.submitted_at desc,s.id desc limit 1;
      done:=submitted_revision.id is not null and private.profile_complete(profile)
        and profile.legal_first_name=submitted_revision.legal_first_name
        and profile.surname=submitted_revision.surname
        and profile.contact_email=submitted_revision.contact_email
        and profile.mobile=submitted_revision.mobile
        and profile.address_line1=submitted_revision.address_line1
        and profile.town_city=submitted_revision.town_city
        and profile.postcode=submitted_revision.postcode;
      if not done and first_code is null then first_code:=req.code;first_actor:='STAFF';first_action:='Submit current personal details';end if;
    elsif req.code='SIA_LICENCE' then
      select * into sia_submission from public.onboarding_sia_submissions s
        where s.requirement_id=req.id order by s.submitted_at desc,s.id desc limit 1;
      request_id:=sia_submission.document_request_id;
      select * into sia_revision from public.person_sia_credential_revisions where id=sia_submission.revision_id;
      select * into current_sia from public.person_sia_credentials where id=sia_revision.credential_id;
      if sia_revision.id is null or current_sia.id is null or current_sia.synthetic_reference is distinct from sia_revision.synthetic_reference
        or current_sia.expires_on is distinct from sia_revision.expires_on
        or sia_revision.expires_on<private.uk_today() then
        if first_code is null then first_code:=req.code;first_actor:='STAFF';first_action:='Submit current synthetic SIA details';end if;
      end if;
    elsif req.code='CONTRACT_TERMS' then
      select a.id into assigned from public.onboarding_controlled_assignments a where a.requirement_id=req.id;
      select exists(select 1 from public.controlled_document_accesses x where x.assignment_id=assigned
        and x.person_id=c.person_id) into accessed;
      select exists(select 1 from public.controlled_acknowledgements x
        where x.assignment_id=assigned and x.actor_person_id=c.person_id) into acknowledged;
      done:=assigned is not null and accessed and acknowledged;
      if not done and first_code is null then
        first_code:=req.code;first_actor:=case when assigned is null then 'OFFICE' else 'STAFF' end;
        first_action:=case when assigned is null then 'Assign synthetic terms' else 'Open and acknowledge terms' end;
      end if;
    elsif req.code='CORE_KSS_INDUCTION' then
      if first_code is null then first_code:=req.code;first_actor:='EXTERNAL_PROVIDER';first_action:='Training provider not connected';end if;
    end if;
    if req.code in ('RIGHT_TO_WORK','SIA_LICENCE','IDENTITY_EVIDENCE') then
      if request_id is not null then
        select v.id,dr.decision into latest_version,review_decision
          from public.documents doc join public.document_versions v on v.document_id=doc.id
          left join public.document_reviews dr on dr.version_id=v.id
          where doc.request_id=request_id and v.upload_state='SUBMITTED'
          order by v.version_number desc limit 1;
      end if;
      select exists(select 1 from public.onboarding_requirement_verifications ov
        where ov.requirement_id=req.id and ov.evidence_version_id=latest_version
          and ov.decision='VERIFIED'
          and (ov.synthetic_valid_until is null or ov.synthetic_valid_until>now())
          and (req.code<>'SIA_LICENCE' or ov.sia_submission_id=sia_submission.id)) into matched_verification;
      if req.code='SIA_LICENCE' and (sia_revision.id is null or current_sia.id is null
        or current_sia.synthetic_reference is distinct from sia_revision.synthetic_reference
        or current_sia.expires_on is distinct from sia_revision.expires_on
        or sia_revision.expires_on<private.uk_today()) then matched_verification:=false; end if;
      done:=latest_version is not null and review_decision='ACCEPTED_AS_EVIDENCE' and matched_verification;
      if not done and first_code is null then
        first_code:=req.code;
        if request_id is null then first_actor:='OFFICE';first_action:='Issue evidence request';
        elsif latest_version is null or review_decision='REJECTED' then first_actor:='STAFF';first_action:='Submit synthetic evidence';
        else first_actor:='OFFICE';first_action:=case when review_decision='ACCEPTED_AS_EVIDENCE'
          then 'Verify exact accepted evidence' else 'Review submitted evidence' end; end if;
      end if;
    end if;
    if done then completed:=completed+1; end if;
  end loop;
  return jsonb_build_object('verifiedCount',completed,'totalCount',6,
    'blocker',coalesce(first_code,'NONE'),'nextActor',coalesce(first_actor,'NONE'),
    'nextAction',coalesce(first_action,'No outstanding action'));
end;$$;
revoke all on function private.onboarding_case_triage(uuid) from public,anon,authenticated;

create function public.list_onboarding_queue(queue_view text default 'MY_CASES',search_text text default '',
  page_offset integer default 0,page_size integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
  actor:=private.current_person_id();
  if actor is null or not (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN'))
    or queue_view not in ('MY_CASES','TEAM_QUEUE','NEEDS_OFFICE','WAITING_STAFF','BLOCKED','CANCELLED')
    or page_offset is null or page_offset<0 or page_offset>10000
    or page_size is null or page_size not between 1 and 50
    or search_text is null or length(search_text)>100 or search_text ~ '[[:cntrl:]]'
  then raise exception 'Onboarding queue denied'; end if;
  with scoped as materialized (
    select c.id,c.person_id,c.owner_person_id,c.team_id,c.site_id,c.template_version_id,
      c.intended_role,c.state,c.created_at,c.started_at,c.cancelled_at,
      (private.has_active_role('SUPER_ADMIN') or private.onboarding_owner_authorised(c.id,actor)) as is_owner,
      private.onboarding_cover_authorised(c.id,actor) as is_cover
    from public.onboarding_cases c where private.has_active_role('SUPER_ADMIN')
      or private.active_onboarding_team_member(c.team_id,actor)
  ), projected as materialized (
    select s.*,p.display_name as starter_name,o.display_name as owner_name,
      t.name as team_name,coalesce(site.name,'Company onboarding') as site_name,
      tv.version_number,private.onboarding_case_triage(s.id) as triage,
      greatest(s.created_at,coalesce(s.started_at,s.created_at),coalesce(s.cancelled_at,s.created_at),
        coalesce((select max(x.changed_at) from public.onboarding_case_owner_changes x where x.case_id=s.id),s.created_at),
        coalesce((select max(x.submitted_at) from public.onboarding_profile_submissions x where x.case_id=s.id),s.created_at),
        coalesce((select max(x.decided_at) from public.onboarding_requirement_verifications x where x.case_id=s.id),s.created_at),
        coalesce((select max(x.acknowledged_at) from public.controlled_acknowledgements x where x.case_id=s.id),s.created_at),
        coalesce((select max(dr.decided_at) from public.document_reviews dr
          where private.onboarding_request_case(dr.request_id)=s.id),s.created_at)) as last_activity
    from scoped s join public.people p on p.id=s.person_id
      join public.people o on o.id=s.owner_person_id
      join public.onboarding_teams t on t.id=s.team_id
      join public.onboarding_template_versions tv on tv.id=s.template_version_id
      left join public.sites site on site.id=s.site_id
  ), visible as materialized (
    select * from projected x where
      (queue_view='MY_CASES' and x.state<>'CANCELLED' and (x.is_owner or x.is_cover))
      or (queue_view='TEAM_QUEUE' and x.state<>'CANCELLED')
      or (queue_view='NEEDS_OFFICE' and x.state<>'CANCELLED' and x.triage->>'nextActor'='OFFICE')
      or (queue_view='WAITING_STAFF' and x.state<>'CANCELLED' and x.triage->>'nextActor'='STAFF')
      or (queue_view='BLOCKED' and x.state<>'CANCELLED' and x.triage->>'nextActor'='EXTERNAL_PROVIDER')
      or (queue_view='CANCELLED' and x.state='CANCELLED')
  ), searched as materialized (
    select * from visible x where trim(search_text)='' or
      x.starter_name ilike '%' || trim(search_text) || '%' or x.owner_name ilike '%' || trim(search_text) || '%'
      or x.intended_role ilike '%' || trim(search_text) || '%' or x.site_name ilike '%' || trim(search_text) || '%'
      or x.team_name ilike '%' || trim(search_text) || '%' or x.state ilike '%' || trim(search_text) || '%'
      or x.triage->>'blocker' ilike '%' || trim(search_text) || '%'
  ), paged as (
    select * from searched order by last_activity desc,id limit page_size offset page_offset
  )
  select jsonb_build_object(
    'total',(select count(*) from searched),
    'counts',jsonb_build_object(
      'activeStarters',(select count(*) from projected where state<>'CANCELLED'),
      'myCases',(select count(*) from projected where state<>'CANCELLED' and (is_owner or is_cover)),
      'needsOffice',(select count(*) from projected where state<>'CANCELLED' and triage->>'nextActor'='OFFICE'),
      'waitingStaff',(select count(*) from projected where state<>'CANCELLED' and triage->>'nextActor'='STAFF'),
      'blocked',(select count(*) from projected where state<>'CANCELLED' and triage->>'nextActor'='EXTERNAL_PROVIDER')),
    'rows',coalesce((select jsonb_agg(jsonb_build_object(
      'id',x.id,'starterName',x.starter_name,'intendedRole',x.intended_role,
      'templateVersion',x.version_number,'siteName',x.site_name,'teamName',x.team_name,
      'state',x.state,'verifiedCount',(x.triage->>'verifiedCount')::integer,'totalCount',6,
      'blocker',x.triage->>'blocker','nextActor',x.triage->>'nextActor',
      'nextAction',x.triage->>'nextAction','ownerName',x.owner_name,
      'lastActivity',x.last_activity,'canOpen',x.is_owner or x.is_cover,
      'isCover',x.is_cover,'teamId',x.team_id,'ownerPersonId',x.owner_person_id,
      'canReassign',private.has_active_role('SUPER_ADMIN') or x.is_owner or
        private.onboarding_team_coordinator(x.team_id,actor),
      'canGrantCover',private.has_active_role('SUPER_ADMIN') or x.is_owner)
      order by x.last_activity desc,x.id) from paged x),'[]'::jsonb)) into result;
  return result;
end;$$;
revoke all on function public.list_onboarding_queue(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.list_onboarding_queue(text,text,integer,integer) to authenticated;

create function public.get_onboarding_case_access(requested_case uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; result jsonb;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case;
  if actor is null or c.id is null or not (
    private.has_active_role('SUPER_ADMIN') or
    (private.has_active_role('OFFICE_ADMIN') and private.onboarding_office_case_access(c.id,actor)))
  then return null; end if;
  select jsonb_build_object('caseId',c.id,'teamId',c.team_id,
    'ownerPersonId',c.owner_person_id,'ownerName',owner.display_name,
    'starterName',starter.display_name,'siteName',coalesce(site.name,'Company onboarding'),
    'isCover',private.onboarding_cover_authorised(c.id,actor),
    'canAct',c.state='IN_PROGRESS' and actor<>c.person_id,
    'canReassign',c.state='IN_PROGRESS' and actor<>c.person_id and
      (private.has_active_role('SUPER_ADMIN') or
        (private.active_onboarding_team_member(c.team_id,actor) and
          (c.owner_person_id=actor or private.onboarding_team_coordinator(c.team_id,actor)))))
    into result from public.people owner join public.people starter on starter.id=c.person_id
    left join public.sites site on site.id=c.site_id where owner.id=c.owner_person_id;
  return result;
end;$$;
revoke all on function public.get_onboarding_case_access(uuid) from public,anon,authenticated;
grant execute on function public.get_onboarding_case_access(uuid) to authenticated;

create function public.list_onboarding_case_cover(requested_case uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; result jsonb;
begin
  actor:=private.current_person_id(); select * into c from public.onboarding_cases where id=requested_case;
  if actor is null or c.id is null or not (private.has_active_role('SUPER_ADMIN')
    or private.onboarding_office_case_access(c.id,actor)) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'coveringPersonId',g.covering_person_id,
    'coveringName',p.display_name,'startsAt',g.effective_from,'endsAt',g.effective_until,
    'revokedAt',g.revoked_at,'reason',g.reason) order by g.granted_at desc),'[]'::jsonb)
    into result from public.onboarding_case_cover_grants g join public.people p on p.id=g.covering_person_id
    where g.case_id=c.id and g.revoked_at is null and g.effective_until>now();
  return result;
end;$$;
create function public.list_eligible_onboarding_office_people(requested_team uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
  actor:=private.current_person_id();
  if actor is null or not (private.has_active_role('SUPER_ADMIN')
    or private.active_onboarding_team_member(requested_team,actor)) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('personId',p.id,'displayName',p.display_name)
    order by p.display_name),'[]'::jsonb) into result from public.people p
    where private.has_active_role_for_person(p.id,'OFFICE_ADMIN')
      and (private.has_active_role('SUPER_ADMIN') or private.active_onboarding_team_member(requested_team,p.id));
  return result;
end;$$;
revoke all on function public.list_onboarding_case_cover(uuid),
  public.list_eligible_onboarding_office_people(uuid) from public,anon,authenticated;
grant execute on function public.list_onboarding_case_cover(uuid),
  public.list_eligible_onboarding_office_people(uuid) to authenticated;
