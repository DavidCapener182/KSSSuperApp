-- TASK-03A: synthetic onboarding proof. No legal RTW conclusion or eligibility result.
create table public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = 'SECURITY_STAFF_BASE'),
  intended_role text not null check (intended_role = 'SECURITY_STAFF'),
  title text not null,
  created_at timestamptz not null default now()
);
create table public.onboarding_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.onboarding_templates(id),
  version_number integer not null check (version_number > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (template_id,version_number)
);
create table public.onboarding_requirement_definitions (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.onboarding_template_versions(id),
  code text not null check (code in ('PERSONAL_DETAILS','RIGHT_TO_WORK','SIA_LICENCE','IDENTITY_EVIDENCE','CONTRACT_TERMS','CORE_KSS_INDUCTION')),
  title text not null,
  position integer not null check (position between 1 and 6),
  mandatory boolean not null default true check (mandatory),
  fulfilment_kind text not null check (fulfilment_kind in ('NOT_CONFIGURED','PRIVATE_DOCUMENT','CONTROLLED_ACKNOWLEDGEMENT','TRAINING_PROVIDER')),
  provider_state text not null check (provider_state in ('AVAILABLE','NOT_CONFIGURED','NOT_AVAILABLE','NOT_CONNECTED')),
  initial_actor text not null check (initial_actor in ('STAFF','OFFICE','EXTERNAL_PROVIDER')),
  unique (template_version_id,code),
  unique (template_version_id,position)
);
create table public.onboarding_cases (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  intended_role text not null check (intended_role = 'SECURITY_STAFF'),
  site_id uuid references public.sites(id),
  template_version_id uuid not null references public.onboarding_template_versions(id),
  created_by_person_id uuid not null references public.people(id),
  owner_person_id uuid not null references public.people(id),
  client_request_id uuid not null,
  state text not null default 'DRAFT' check (state in ('DRAFT','IN_PROGRESS','CANCELLED')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  cancelled_at timestamptz,
  unique (created_by_person_id,client_request_id),
  check ((state = 'DRAFT' and started_at is null and cancelled_at is null)
    or (state = 'IN_PROGRESS' and started_at is not null and cancelled_at is null)
    or (state = 'CANCELLED' and cancelled_at is not null))
);
create index onboarding_cases_person_at_idx on public.onboarding_cases(person_id,created_at desc);
create index onboarding_cases_owner_at_idx on public.onboarding_cases(owner_person_id,created_at desc);
create table public.onboarding_case_requirements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.onboarding_cases(id),
  definition_id uuid not null references public.onboarding_requirement_definitions(id),
  document_request_id uuid unique references public.document_requests(id),
  created_at timestamptz not null default now(),
  unique (case_id,definition_id)
);
create index onboarding_case_requirements_case_idx on public.onboarding_case_requirements(case_id);
create table public.onboarding_requirement_verifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.onboarding_cases(id),
  requirement_id uuid not null references public.onboarding_case_requirements(id),
  target_person_id uuid not null references public.people(id),
  verifier_person_id uuid not null references public.people(id),
  evidence_version_id uuid not null references public.document_versions(id),
  decision text not null check (decision = 'VERIFIED'),
  decided_at timestamptz not null default now(),
  synthetic_valid_until timestamptz,
  unique (requirement_id,evidence_version_id)
);
create index onboarding_verifications_case_idx on public.onboarding_requirement_verifications(case_id,decided_at desc);

-- All catalog and business tables are readable only under their own RLS rules.
alter table public.onboarding_templates enable row level security;
alter table public.onboarding_template_versions enable row level security;
alter table public.onboarding_requirement_definitions enable row level security;
alter table public.onboarding_cases enable row level security;
alter table public.onboarding_case_requirements enable row level security;
alter table public.onboarding_requirement_verifications enable row level security;
revoke all on public.onboarding_templates,public.onboarding_template_versions,
  public.onboarding_requirement_definitions,public.onboarding_cases,
  public.onboarding_case_requirements,public.onboarding_requirement_verifications
  from public,anon,authenticated;
grant select on public.onboarding_templates,public.onboarding_template_versions,
  public.onboarding_requirement_definitions,public.onboarding_cases,
  public.onboarding_case_requirements,public.onboarding_requirement_verifications to authenticated;

create function private.onboarding_case_readable(requested_case uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.onboarding_cases c where c.id = requested_case
      and private.current_person_id() is not null
      and (private.has_active_role('SUPER_ADMIN')
        or (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id = private.current_person_id())
        or (private.has_active_role('SECURITY_STAFF') and c.person_id = private.current_person_id()))
  )
$$;
revoke all on function private.onboarding_case_readable(uuid) from public,anon,authenticated;
grant execute on function private.onboarding_case_readable(uuid) to authenticated;
create function private.onboarding_requirement_readable(requested_requirement uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.onboarding_case_requirements r
    where r.id = requested_requirement and private.onboarding_case_readable(r.case_id))
$$;
revoke all on function private.onboarding_requirement_readable(uuid) from public,anon,authenticated;
grant execute on function private.onboarding_requirement_readable(uuid) to authenticated;
create policy onboarding_templates_read on public.onboarding_templates for select to authenticated
  using (private.has_active_role('SUPER_ADMIN') or private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SECURITY_STAFF'));
create policy onboarding_versions_read on public.onboarding_template_versions for select to authenticated
  using (published_at is not null and (private.has_active_role('SUPER_ADMIN') or private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SECURITY_STAFF')));
create policy onboarding_definitions_read on public.onboarding_requirement_definitions for select to authenticated
  using (exists (select 1 from public.onboarding_template_versions v where v.id = template_version_id and v.published_at is not null)
    and (private.has_active_role('SUPER_ADMIN') or private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SECURITY_STAFF')));
create policy onboarding_cases_read on public.onboarding_cases for select to authenticated
  using (private.onboarding_case_readable(id));
create policy onboarding_requirements_read on public.onboarding_case_requirements for select to authenticated
  using (private.onboarding_case_readable(case_id));
create policy onboarding_verifications_read on public.onboarding_requirement_verifications for select to authenticated
  using (private.onboarding_requirement_readable(requirement_id));

-- Published definitions are immutable; new editions are new version rows.
create function private.guard_onboarding_catalog() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Published onboarding catalog cannot be deleted'; end if;
  if tg_table_name = 'onboarding_templates' and tg_op = 'UPDATE' then
    raise exception 'Onboarding template identity is immutable'; end if;
  if tg_table_name = 'onboarding_template_versions' and tg_op = 'UPDATE' then
    if old.published_at is not null or new.id <> old.id or new.template_id <> old.template_id
      or new.version_number <> old.version_number or new.created_at <> old.created_at
      or new.published_at is null then raise exception 'Onboarding version is immutable'; end if;
    return new;
  end if;
  if tg_table_name = 'onboarding_requirement_definitions' then
    if tg_op = 'INSERT' and exists (select 1 from public.onboarding_template_versions v
      where v.id = new.template_version_id and v.published_at is not null) then
      raise exception 'Published onboarding definition is immutable'; end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.onboarding_template_versions v
      where v.id = old.template_version_id and v.published_at is not null) then
      raise exception 'Published onboarding definition is immutable'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_onboarding_catalog() from public,anon,authenticated;
create trigger guard_onboarding_templates before update or delete on public.onboarding_templates
  for each row execute function private.guard_onboarding_catalog();
create trigger guard_onboarding_versions before update or delete on public.onboarding_template_versions
  for each row execute function private.guard_onboarding_catalog();
create trigger guard_onboarding_definitions before insert or update or delete on public.onboarding_requirement_definitions
  for each row execute function private.guard_onboarding_catalog();

create function private.guard_onboarding_case() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Onboarding case history cannot be deleted'; end if;
  if tg_op = 'INSERT' then
    if new.state <> 'DRAFT' or new.started_at is not null or new.cancelled_at is not null
      or new.created_by_person_id <> new.owner_person_id or new.person_id = new.owner_person_id then
      raise exception 'Invalid onboarding case'; end if;
    return new;
  end if;
  if new.id <> old.id or new.person_id <> old.person_id or new.intended_role <> old.intended_role
    or new.site_id is distinct from old.site_id or new.template_version_id <> old.template_version_id
    or new.created_by_person_id <> old.created_by_person_id or new.owner_person_id <> old.owner_person_id
    or new.client_request_id <> old.client_request_id or new.created_at <> old.created_at
    or not ((old.state = 'DRAFT' and new.state = 'IN_PROGRESS' and new.started_at is not null and new.cancelled_at is null)
      or (old.state in ('DRAFT','IN_PROGRESS') and new.state = 'CANCELLED'
        and new.started_at is not distinct from old.started_at and new.cancelled_at is not null))
  then raise exception 'Onboarding case transition denied'; end if;
  return new;
end;
$$;
revoke all on function private.guard_onboarding_case() from public,anon,authenticated;
create trigger guard_onboarding_case before insert or update or delete on public.onboarding_cases
  for each row execute function private.guard_onboarding_case();

create function private.guard_onboarding_requirement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.onboarding_cases%rowtype; d public.onboarding_requirement_definitions%rowtype;
  req public.document_requests%rowtype;
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
  if c.state <> 'IN_PROGRESS' or d.code <> 'RIGHT_TO_WORK' or req.id is null
    or req.target_person_id <> c.person_id or req.requester_person_id <> c.owner_person_id
    or req.site_id is distinct from c.site_id then raise exception 'Onboarding evidence link denied'; end if;
  return new;
end;
$$;
revoke all on function private.guard_onboarding_requirement() from public,anon,authenticated;
create trigger guard_onboarding_requirement before insert or update or delete on public.onboarding_case_requirements
  for each row execute function private.guard_onboarding_requirement();

create function private.guard_onboarding_verification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; v public.document_versions%rowtype;
  doc public.documents%rowtype; rev public.document_reviews%rowtype;
begin
  if tg_op <> 'INSERT' then raise exception 'Onboarding verification is immutable'; end if;
  select * into c from public.onboarding_cases where id = new.case_id;
  select * into cr from public.onboarding_case_requirements where id = new.requirement_id;
  select * into d from public.onboarding_requirement_definitions where id = cr.definition_id;
  select * into v from public.document_versions where id = new.evidence_version_id;
  select * into doc from public.documents where id = v.document_id;
  select * into rev from public.document_reviews where version_id = v.id;
  if c.id is null or c.state <> 'IN_PROGRESS' or cr.case_id <> c.id or d.code <> 'RIGHT_TO_WORK'
    or new.target_person_id <> c.person_id or new.verifier_person_id = c.person_id
    or new.verifier_person_id is distinct from private.current_person_id()
    or v.id is null or v.upload_state <> 'SUBMITTED' or doc.request_id <> cr.document_request_id
    or rev.decision <> 'ACCEPTED_AS_EVIDENCE' or new.decision <> 'VERIFIED'
    or (new.synthetic_valid_until is not null and new.synthetic_valid_until <= now())
    or exists (select 1 from public.document_versions later where later.document_id = v.document_id
      and later.upload_state = 'SUBMITTED' and later.version_number > v.version_number)
  then raise exception 'Onboarding verification source denied'; end if;
  return new;
end;
$$;
revoke all on function private.guard_onboarding_verification() from public,anon,authenticated;
create trigger guard_onboarding_verification before insert or update or delete on public.onboarding_requirement_verifications
  for each row execute function private.guard_onboarding_verification();

-- Extend the existing audit ledger with minimal onboarding targets.
alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check
  (entity_type in ('role_assignment','site_assignment','site','document_request','document_version','document_review','task',
    'onboarding_case','onboarding_requirement','onboarding_verification'));
alter table public.audit_events drop constraint audit_events_target_check;
alter table public.audit_events add constraint audit_events_target_check check (
  (entity_type = 'site' and site_id is not null) or
  (entity_type = 'site_assignment' and site_id is not null and affected_person_id is not null) or
  (entity_type = 'role_assignment' and affected_person_id is not null) or
  (entity_type in ('document_request','document_version','document_review','task',
    'onboarding_case','onboarding_requirement','onboarding_verification') and affected_person_id is not null)
);

-- Controlled, idempotent case creation. All privileged functions re-check DB role and record scope.
create function public.create_onboarding_case(target_person uuid, requested_site uuid, request_key uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; version_id uuid; created_id uuid; existing_case public.onboarding_cases%rowtype;
  requirement_count integer;
begin
  actor := private.current_person_id();
  if actor is null or request_key is null or target_person is null or target_person = actor
    or not private.has_active_role('OFFICE_ADMIN') or requested_site is null
    or not private.office_owns_site(requested_site) or not private.site_is_active(requested_site)
    or not exists (select 1 from public.sites s where s.id = requested_site
      and s.name = 'Synthetic Static Security Site')
    or not exists (select 1 from public.role_assignments ra where ra.person_id = target_person
      and ra.role_code = 'SECURITY_STAFF' and ra.revoked_at is null
      and ra.effective_from <= now() and (ra.effective_until is null or ra.effective_until > now()))
    or not exists (select 1 from public.site_assignments sa where sa.person_id = target_person
      and sa.site_id = requested_site and sa.revoked_at is null
      and sa.effective_from <= now() and (sa.effective_until is null or sa.effective_until > now()))
  then raise exception 'Onboarding case denied'; end if;
  select v.id into version_id from public.onboarding_template_versions v
    join public.onboarding_templates t on t.id = v.template_id
    where t.code = 'SECURITY_STAFF_BASE' and v.published_at is not null
    order by v.version_number desc limit 1;
  if version_id is null then raise exception 'Onboarding template unavailable'; end if;
  insert into public.onboarding_cases(person_id,intended_role,site_id,template_version_id,
    created_by_person_id,owner_person_id,client_request_id)
    values (target_person,'SECURITY_STAFF',requested_site,version_id,actor,actor,request_key)
    on conflict (created_by_person_id,client_request_id) do nothing returning id into created_id;
  if created_id is null then
    select * into existing_case from public.onboarding_cases
      where created_by_person_id = actor and client_request_id = request_key;
    if existing_case.id is null or existing_case.person_id <> target_person
      or existing_case.site_id <> requested_site then raise exception 'Onboarding request conflict'; end if;
    return existing_case.id;
  end if;
  insert into public.onboarding_case_requirements(case_id,definition_id)
    select created_id,d.id from public.onboarding_requirement_definitions d
      where d.template_version_id = version_id;
  get diagnostics requirement_count = row_count;
  if requirement_count <> 6 then raise exception 'Incomplete onboarding template'; end if;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (actor,target_person,'onboarding_case',created_id,'INSERT',
      jsonb_build_object('state','DRAFT','template_version_id',version_id));
  return created_id;
end;
$$;
revoke all on function public.create_onboarding_case(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_onboarding_case(uuid,uuid,uuid) to authenticated;

create function public.start_onboarding_case(requested_case uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; c public.onboarding_cases%rowtype;
begin
  actor := private.current_person_id();
  select * into c from public.onboarding_cases where id = requested_case for update;
  if c.id is null or actor is null or (not private.has_active_role('SUPER_ADMIN') and
    (not private.has_active_role('OFFICE_ADMIN') or c.owner_person_id <> actor))
    or actor = c.person_id or c.state = 'CANCELLED' then raise exception 'Onboarding start denied'; end if;
  if c.state = 'IN_PROGRESS' then return c.id; end if;
  update public.onboarding_cases set state = 'IN_PROGRESS',started_at = now() where id = c.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (actor,c.person_id,'onboarding_case',c.id,'UPDATE',jsonb_build_object('state','IN_PROGRESS'));
  return c.id;
end;
$$;
revoke all on function public.start_onboarding_case(uuid) from public,anon,authenticated;
grant execute on function public.start_onboarding_case(uuid) to authenticated;

create function public.issue_onboarding_rtw_request(requested_case uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; c public.onboarding_cases%rowtype; req public.onboarding_case_requirements%rowtype;
  new_request uuid;
begin
  actor := private.current_person_id();
  select * into c from public.onboarding_cases where id = requested_case for update;
  if c.id is null or c.state <> 'IN_PROGRESS' or actor is null or actor = c.person_id
    or c.owner_person_id <> actor or not private.has_active_role('OFFICE_ADMIN')
  then raise exception 'Onboarding request denied'; end if;
  select cr.* into req from public.onboarding_case_requirements cr
    join public.onboarding_requirement_definitions d on d.id = cr.definition_id
    where cr.case_id = c.id and d.code = 'RIGHT_TO_WORK' for update of cr;
  if req.id is null then raise exception 'RTW requirement unavailable'; end if;
  if req.document_request_id is not null then return req.document_request_id; end if;
  new_request := public.create_document_request(c.person_id,c.site_id,
    'Synthetic onboarding Right to Work evidence');
  update public.onboarding_case_requirements set document_request_id = new_request where id = req.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (actor,c.person_id,'onboarding_requirement',req.id,'UPDATE',
      jsonb_build_object('document_request_id',new_request,'kind','RIGHT_TO_WORK'));
  return new_request;
end;
$$;
revoke all on function public.issue_onboarding_rtw_request(uuid) from public,anon,authenticated;
grant execute on function public.issue_onboarding_rtw_request(uuid) to authenticated;

create function public.verify_onboarding_rtw(requested_case uuid, requested_requirement uuid,
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
      (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id = actor))
  then raise exception 'Onboarding verification denied'; end if;
  select * into cr from public.onboarding_case_requirements where id = requested_requirement and case_id = c.id for update;
  select * into d from public.onboarding_requirement_definitions where id = cr.definition_id;
  select * into dr from public.document_requests where id = cr.document_request_id;
  select * into doc from public.documents where request_id = dr.id and classification = 'PERSONNEL_PRIVATE';
  select * into v from public.document_versions where id = accepted_version and document_id = doc.id;
  select * into rev from public.document_reviews where version_id = v.id and request_id = dr.id;
  if cr.id is null or d.code <> 'RIGHT_TO_WORK' or dr.id is null or doc.id is null
    or dr.target_person_id <> c.person_id or dr.requester_person_id <> c.owner_person_id
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
revoke all on function public.verify_onboarding_rtw(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.verify_onboarding_rtw(uuid,uuid,uuid,timestamptz) to authenticated;

create function public.cancel_onboarding_case(requested_case uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; c public.onboarding_cases%rowtype;
begin
  actor := private.current_person_id();
  select * into c from public.onboarding_cases where id = requested_case for update;
  if c.id is null or actor is null or actor = c.person_id or
    not (private.has_active_role('SUPER_ADMIN') or
      (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id = actor))
  then raise exception 'Onboarding cancellation denied'; end if;
  if c.state = 'CANCELLED' then return c.id; end if;
  update public.onboarding_cases set state = 'CANCELLED',cancelled_at = now() where id = c.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (actor,c.person_id,'onboarding_case',c.id,'UPDATE',jsonb_build_object('state','CANCELLED'));
  return c.id;
end;
$$;
revoke all on function public.cancel_onboarding_case(uuid) from public,anon,authenticated;
grant execute on function public.cancel_onboarding_case(uuid) to authenticated;

-- Source-controlled synthetic V1 catalog. Definitions are data, not UI checkboxes.
insert into public.onboarding_templates(id,code,intended_role,title)
  values ('40000000-0000-4000-8000-000000000001','SECURITY_STAFF_BASE','SECURITY_STAFF','Synthetic Security Staff onboarding');
insert into public.onboarding_template_versions(id,template_id,version_number)
  values ('40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',1);
insert into public.onboarding_requirement_definitions(id,template_version_id,code,title,position,fulfilment_kind,provider_state,initial_actor)
  values
  ('40000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000002','PERSONAL_DETAILS','Personal details',1,'NOT_CONFIGURED','NOT_CONFIGURED','STAFF'),
  ('40000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000002','RIGHT_TO_WORK','Right to Work',2,'PRIVATE_DOCUMENT','AVAILABLE','STAFF'),
  ('40000000-0000-4000-8000-000000000013','40000000-0000-4000-8000-000000000002','SIA_LICENCE','SIA licence',3,'NOT_CONFIGURED','NOT_CONFIGURED','STAFF'),
  ('40000000-0000-4000-8000-000000000014','40000000-0000-4000-8000-000000000002','IDENTITY_EVIDENCE','Identity evidence',4,'NOT_CONFIGURED','NOT_CONFIGURED','STAFF'),
  ('40000000-0000-4000-8000-000000000015','40000000-0000-4000-8000-000000000002','CONTRACT_TERMS','Contract / terms acknowledgement',5,'CONTROLLED_ACKNOWLEDGEMENT','NOT_AVAILABLE','STAFF'),
  ('40000000-0000-4000-8000-000000000016','40000000-0000-4000-8000-000000000002','CORE_KSS_INDUCTION','Core KSS induction',6,'TRAINING_PROVIDER','NOT_CONNECTED','EXTERNAL_PROVIDER');
update public.onboarding_template_versions set published_at = now()
  where id = '40000000-0000-4000-8000-000000000002';
