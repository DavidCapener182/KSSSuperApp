-- TASK-03C. Synthetic controlled publication and exact-version acknowledgement.
-- Dedicated KSS Enterprise development project only. No real contracts or staff data.
create table public.controlled_publisher_grants (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  family text not null check (family = 'ONBOARDING_TERMS_SYNTHETIC'),
  effective_from timestamptz not null default now(),
  effective_until timestamptz not null,
  revoked_at timestamptz,
  granted_by_person_id uuid not null references public.people(id),
  created_at timestamptz not null default now(),
  check (effective_until > effective_from)
);
create index controlled_publisher_grants_person_idx on public.controlled_publisher_grants(person_id,family,effective_until);

create table public.controlled_documents (
  id uuid primary key default gen_random_uuid(),
  family text not null check (family = 'ONBOARDING_TERMS_SYNTHETIC'),
  title text not null check (length(trim(title)) between 1 and 120 and title !~ '[[:cntrl:]]'),
  created_by_person_id uuid not null references public.people(id),
  created_at timestamptz not null default now()
);
create table public.controlled_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.controlled_documents(id),
  version_number integer not null check (version_number between 1 and 100),
  title text not null check (length(trim(title)) between 1 and 140 and title !~ '[[:cntrl:]]'),
  object_key text not null unique check (length(object_key) between 50 and 120),
  original_filename text not null check (length(original_filename) between 1 and 180 and original_filename !~ '[\\/[:cntrl:]]'),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  byte_size integer not null check (byte_size between 1 and 1048576),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  scan_state text not null default 'NOT_SCANNED' check (scan_state = 'NOT_SCANNED'),
  upload_state text not null default 'PENDING_UPLOAD' check (upload_state in ('PENDING_UPLOAD','READY')),
  state text not null default 'DRAFT' check (state in ('DRAFT','PUBLISHED','SUPERSEDED')),
  created_by_person_id uuid not null references public.people(id),
  created_at timestamptz not null default now(),
  published_by_person_id uuid references public.people(id),
  published_at timestamptz,
  effective_on date,
  superseded_by_person_id uuid references public.people(id),
  superseded_at timestamptz,
  unique (document_id,version_number),
  check ((state='DRAFT' and published_at is null and superseded_at is null)
    or (state='PUBLISHED' and upload_state='READY' and published_at is not null and superseded_at is null)
    or (state='SUPERSEDED' and upload_state='READY' and published_at is not null and superseded_at is not null))
);
create index controlled_versions_document_idx on public.controlled_document_versions(document_id,version_number desc);
create unique index controlled_one_published_version_idx on public.controlled_document_versions(document_id) where state='PUBLISHED';
create table public.controlled_publication_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.controlled_documents(id),
  version_id uuid not null references public.controlled_document_versions(id),
  action text not null check (action in ('PUBLISHED','SUPERSEDED')),
  actor_person_id uuid not null references public.people(id),
  occurred_at timestamptz not null default now(),
  unique (version_id,action)
);
create table public.onboarding_controlled_assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.onboarding_cases(id),
  requirement_id uuid not null unique references public.onboarding_case_requirements(id),
  target_person_id uuid not null references public.people(id),
  document_id uuid not null references public.controlled_documents(id),
  version_id uuid not null references public.controlled_document_versions(id),
  assigned_by_person_id uuid not null references public.people(id),
  assigned_at timestamptz not null default now()
);
create index onboarding_controlled_assignments_case_idx on public.onboarding_controlled_assignments(case_id);
create table public.controlled_document_accesses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.onboarding_controlled_assignments(id),
  person_id uuid not null references public.people(id),
  version_id uuid not null references public.controlled_document_versions(id),
  accessed_at timestamptz not null default now()
);
create index controlled_accesses_assignment_idx on public.controlled_document_accesses(assignment_id,accessed_at);
create table public.controlled_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  target_person_id uuid not null references public.people(id),
  actor_person_id uuid not null references public.people(id),
  case_id uuid not null references public.onboarding_cases(id),
  requirement_id uuid not null references public.onboarding_case_requirements(id),
  assignment_id uuid not null unique references public.onboarding_controlled_assignments(id),
  document_id uuid not null references public.controlled_documents(id),
  version_id uuid not null references public.controlled_document_versions(id),
  acknowledgement_type text not null check (acknowledgement_type='PRESENTED_AND_ACKNOWLEDGED'),
  acknowledged_at timestamptz not null default now()
);

alter table public.controlled_publisher_grants enable row level security;
alter table public.controlled_documents enable row level security;
alter table public.controlled_document_versions enable row level security;
alter table public.controlled_publication_events enable row level security;
alter table public.onboarding_controlled_assignments enable row level security;
alter table public.controlled_document_accesses enable row level security;
alter table public.controlled_acknowledgements enable row level security;
revoke all on public.controlled_publisher_grants,public.controlled_documents,public.controlled_document_versions,
  public.controlled_publication_events,public.onboarding_controlled_assignments,public.controlled_document_accesses,
  public.controlled_acknowledgements from public,anon,authenticated;
grant select on public.controlled_publisher_grants,public.controlled_documents,public.controlled_document_versions,
  public.controlled_publication_events,public.onboarding_controlled_assignments,public.controlled_document_accesses,
  public.controlled_acknowledgements to authenticated;

create function private.can_publish_controlled(family_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select family_code='ONBOARDING_TERMS_SYNTHETIC' and private.has_active_role('OFFICE_ADMIN')
    and exists(select 1 from public.controlled_publisher_grants g
      where g.person_id=private.current_person_id() and g.family=family_code
        and g.revoked_at is null and g.effective_from<=now() and g.effective_until>now())
$$;
create function private.can_read_controlled_assignment(requested_assignment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.onboarding_controlled_assignments a
    join public.onboarding_cases c on c.id=a.case_id
    where a.id=requested_assignment and private.current_person_id() is not null
      and (private.has_active_role('SUPER_ADMIN')
        or (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id=private.current_person_id())
        or (private.has_active_role('SECURITY_STAFF') and c.person_id=private.current_person_id())))
$$;
create function private.can_download_controlled_key(requested_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.controlled_document_versions v
    join public.controlled_documents d on d.id=v.document_id
    where v.object_key=requested_key and v.upload_state='READY' and (
      (private.can_publish_controlled(d.family) and d.created_by_person_id=private.current_person_id())
      or exists(select 1 from public.onboarding_controlled_assignments a
        join public.onboarding_cases c on c.id=a.case_id
        where a.version_id=v.id and c.state='IN_PROGRESS'
          and (private.has_active_role('SUPER_ADMIN')
            or (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id=private.current_person_id())
            or (private.has_active_role('SECURITY_STAFF') and c.person_id=private.current_person_id())))
    ))
$$;
create function private.can_upload_controlled_key(requested_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.controlled_document_versions v
    join public.controlled_documents d on d.id=v.document_id
    where v.object_key=requested_key and v.state='DRAFT' and v.upload_state='PENDING_UPLOAD'
      and v.created_by_person_id=private.current_person_id() and d.created_by_person_id=private.current_person_id()
      and private.can_publish_controlled(d.family))
$$;
revoke all on function private.can_publish_controlled(text),private.can_read_controlled_assignment(uuid),
  private.can_download_controlled_key(text),private.can_upload_controlled_key(text) from public,anon,authenticated;
grant execute on function private.can_publish_controlled(text),private.can_read_controlled_assignment(uuid),
  private.can_download_controlled_key(text),private.can_upload_controlled_key(text) to authenticated;

create policy controlled_grants_read on public.controlled_publisher_grants for select to authenticated
  using (private.has_active_role('SUPER_ADMIN') or person_id=private.current_person_id());
create policy controlled_documents_read on public.controlled_documents for select to authenticated using (
  private.has_active_role('SUPER_ADMIN') or
  (created_by_person_id=private.current_person_id() and private.can_publish_controlled(family)) or
  exists(select 1 from public.onboarding_controlled_assignments a
    where a.document_id=id and private.can_read_controlled_assignment(a.id)));
create policy controlled_versions_read on public.controlled_document_versions for select to authenticated using (
  private.has_active_role('SUPER_ADMIN') or
  exists(select 1 from public.controlled_documents d where d.id=document_id
    and d.created_by_person_id=private.current_person_id() and private.can_publish_controlled(d.family)) or
  exists(select 1 from public.onboarding_controlled_assignments a
    where a.version_id=id and private.can_read_controlled_assignment(a.id)));
create policy controlled_publication_events_read on public.controlled_publication_events for select to authenticated using (
  private.has_active_role('SUPER_ADMIN') or exists(select 1 from public.controlled_documents d
    where d.id=document_id and d.created_by_person_id=private.current_person_id() and private.can_publish_controlled(d.family)));
create policy controlled_assignments_read on public.onboarding_controlled_assignments for select to authenticated
  using (private.can_read_controlled_assignment(id));
create policy controlled_accesses_read on public.controlled_document_accesses for select to authenticated
  using (private.can_read_controlled_assignment(assignment_id));
create policy controlled_acknowledgements_read on public.controlled_acknowledgements for select to authenticated
  using (private.can_read_controlled_assignment(assignment_id));

-- No ordinary role can change published bytes/identity or any historical business row.
create function private.guard_controlled_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='DELETE' then raise exception 'Controlled version history is immutable'; end if;
  if old.state='SUPERSEDED' or old.document_id is distinct from new.document_id
    or old.version_number is distinct from new.version_number or old.title is distinct from new.title
    or old.object_key is distinct from new.object_key or old.original_filename is distinct from new.original_filename
    or old.mime_type is distinct from new.mime_type or old.byte_size is distinct from new.byte_size
    or old.sha256 is distinct from new.sha256 or old.scan_state is distinct from new.scan_state
    or old.created_by_person_id is distinct from new.created_by_person_id or old.created_at is distinct from new.created_at
  then raise exception 'Controlled version identity is immutable'; end if;
  if old.state='PUBLISHED' and (new.state<>'SUPERSEDED' or old.upload_state is distinct from new.upload_state
    or old.published_at is distinct from new.published_at or old.published_by_person_id is distinct from new.published_by_person_id
    or old.effective_on is distinct from new.effective_on) then raise exception 'Published version is immutable'; end if;
  if old.state='DRAFT' and (new.state not in ('DRAFT','PUBLISHED') or
    (old.upload_state='READY' and new.upload_state<>'READY')) then raise exception 'Invalid version transition'; end if;
  return new;
end;
$$;
create trigger guard_controlled_version before update or delete on public.controlled_document_versions
  for each row execute function private.guard_controlled_version();
create function private.guard_controlled_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op<>'INSERT' then raise exception 'Controlled history is immutable'; end if;
  if tg_table_name='onboarding_controlled_assignments' and not exists(
    select 1 from public.onboarding_cases c join public.onboarding_case_requirements r on r.case_id=c.id
      join public.onboarding_requirement_definitions d on d.id=r.definition_id
      join public.controlled_document_versions v on v.id=new.version_id
      join public.controlled_documents cd on cd.id=v.document_id
    where c.id=new.case_id and r.id=new.requirement_id and c.person_id=new.target_person_id
      and d.code='CONTRACT_TERMS' and d.fulfilment_kind='CONTROLLED_ACKNOWLEDGEMENT'
      and c.state='IN_PROGRESS' and c.template_version_id=d.template_version_id
      and v.state='PUBLISHED' and v.document_id=new.document_id and cd.family='ONBOARDING_TERMS_SYNTHETIC'
  ) then raise exception 'Assignment source mismatch'; end if;
  if tg_table_name='controlled_document_accesses' and not exists(
    select 1 from public.onboarding_controlled_assignments a join public.onboarding_cases c on c.id=a.case_id
      where a.id=new.assignment_id and a.target_person_id=new.person_id and a.version_id=new.version_id
        and c.state='IN_PROGRESS') then raise exception 'Access source mismatch'; end if;
  if tg_table_name='controlled_acknowledgements' and not exists(
    select 1 from public.onboarding_controlled_assignments a join public.onboarding_cases c on c.id=a.case_id
      join public.controlled_document_versions v on v.id=a.version_id
      where a.id=new.assignment_id and a.case_id=new.case_id and a.requirement_id=new.requirement_id
        and a.target_person_id=new.target_person_id and a.document_id=new.document_id and a.version_id=new.version_id
        and new.actor_person_id=new.target_person_id and c.state='IN_PROGRESS' and v.state='PUBLISHED'
        and exists(select 1 from public.controlled_document_accesses x where x.assignment_id=a.id
          and x.person_id=new.target_person_id and x.version_id=new.version_id)
  ) then raise exception 'Acknowledgement source mismatch'; end if;
  return new;
end;
$$;
create trigger guard_controlled_assignments before insert or update or delete on public.onboarding_controlled_assignments
  for each row execute function private.guard_controlled_history();
create trigger guard_controlled_accesses before insert or update or delete on public.controlled_document_accesses
  for each row execute function private.guard_controlled_history();
create trigger guard_controlled_acknowledgements before insert or update or delete on public.controlled_acknowledgements
  for each row execute function private.guard_controlled_history();
create trigger guard_controlled_publication_events before insert or update or delete on public.controlled_publication_events
  for each row execute function private.guard_controlled_history();
revoke all on function private.guard_controlled_version(),private.guard_controlled_history() from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('enterprise-controlled-documents','enterprise-controlled-documents',false,1048576,array['application/pdf']);
create policy controlled_document_upload on storage.objects for insert to authenticated
  with check (bucket_id='enterprise-controlled-documents' and private.can_upload_controlled_key(name));
create policy controlled_document_download on storage.objects for select to authenticated
  using (bucket_id='enterprise-controlled-documents'
    and storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info'])
    and (private.can_download_controlled_key(name) or private.can_upload_controlled_key(name)));

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
  'role_assignment','site_assignment','site','document_request','document_version','document_review','task',
  'onboarding_case','onboarding_requirement','onboarding_verification','person_profile','profile_submission',
  'sia_credential','sia_submission','controlled_publisher_grant','controlled_document','controlled_version',
  'controlled_publication','controlled_assignment','controlled_access','controlled_acknowledgement'));
alter table public.audit_events drop constraint audit_events_target_check;
alter table public.audit_events add constraint audit_events_target_check check (
  (entity_type='site' and site_id is not null) or
  (entity_type='site_assignment' and site_id is not null and affected_person_id is not null) or
  (entity_type='role_assignment' and affected_person_id is not null) or
  (entity_type not in ('site','site_assignment','role_assignment') and affected_person_id is not null));

create function public.grant_controlled_publisher(target_person uuid, expires_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare grant_id uuid;
begin
  if not private.has_active_role('SUPER_ADMIN') or target_person=private.current_person_id()
    or not exists(select 1 from public.role_assignments r where r.person_id=target_person and r.role_code='OFFICE_ADMIN'
      and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))
    or expires_at is null or expires_at<=now() or expires_at>now()+interval '90 days'
  then raise exception 'Publisher grant denied'; end if;
  if exists(select 1 from public.controlled_publisher_grants g where g.person_id=target_person
    and g.family='ONBOARDING_TERMS_SYNTHETIC' and g.revoked_at is null and g.effective_until>now())
  then raise exception 'Active publisher grant exists'; end if;
  insert into public.controlled_publisher_grants(person_id,family,effective_until,granted_by_person_id)
    values(target_person,'ONBOARDING_TERMS_SYNTHETIC',expires_at,private.current_person_id()) returning id into grant_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(private.current_person_id(),target_person,'controlled_publisher_grant',grant_id,'INSERT',
      jsonb_build_object('family','ONBOARDING_TERMS_SYNTHETIC','expires_at',expires_at));
  return grant_id;
end;
$$;
create function public.revoke_controlled_publisher(grant_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare g public.controlled_publisher_grants%rowtype;
begin
  if not private.has_active_role('SUPER_ADMIN') then raise exception 'Revocation denied'; end if;
  select * into g from public.controlled_publisher_grants where id=grant_id for update;
  if not found then raise exception 'Grant unavailable'; end if;
  if g.revoked_at is null then
    update public.controlled_publisher_grants set revoked_at=now() where id=grant_id;
    insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
      values(private.current_person_id(),g.person_id,'controlled_publisher_grant',grant_id,'UPDATE',
        jsonb_build_object('revoked',true));
  end if;
  return true;
end;
$$;
create function public.create_controlled_document() returns uuid
language plpgsql security definer set search_path = '' as $$
declare created_id uuid;
begin
  if not private.can_publish_controlled('ONBOARDING_TERMS_SYNTHETIC') then raise exception 'Publication denied'; end if;
  insert into public.controlled_documents(family,title,created_by_person_id)
    values('ONBOARDING_TERMS_SYNTHETIC','KSS Development Terms Acknowledgement',private.current_person_id())
    returning id into created_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(private.current_person_id(),private.current_person_id(),'controlled_document',created_id,'INSERT',
      jsonb_build_object('family','ONBOARDING_TERMS_SYNTHETIC'));
  return created_id;
end;
$$;
create function public.begin_controlled_version(requested_document uuid, supplied_name text,
  supplied_size integer, supplied_sha256 text, server_proof text)
returns table(version_id uuid,object_key text) language plpgsql security definer set search_path = '' as $$
declare d public.controlled_documents%rowtype; next_number integer; created_id uuid; created_key text;
begin
  if not private.valid_document_server_proof(concat_ws(chr(31),'controlled_begin',requested_document::text,
    supplied_name,supplied_size::text,supplied_sha256),server_proof)
    or supplied_name is null or supplied_name !~* '^[a-z0-9][a-z0-9._ -]{0,160}[.]pdf$'
    or supplied_size is null or supplied_size not between 1 and 1048576
    or supplied_sha256 is null or supplied_sha256 !~ '^[0-9a-f]{64}$'
  then raise exception 'Version denied'; end if;
  select * into d from public.controlled_documents where id=requested_document for update;
  if not found or d.created_by_person_id<>private.current_person_id() or not private.can_publish_controlled(d.family)
    then raise exception 'Version denied'; end if;
  if exists(select 1 from public.controlled_document_versions v where v.document_id=d.id and v.state='DRAFT')
    then raise exception 'Draft version already exists'; end if;
  select coalesce(max(v.version_number),0)+1 into next_number from public.controlled_document_versions v where v.document_id=d.id;
  created_id:=gen_random_uuid(); created_key:=gen_random_uuid()::text || '/' || created_id::text;
  insert into public.controlled_document_versions(id,document_id,version_number,title,object_key,original_filename,
    byte_size,sha256,created_by_person_id)
    values(created_id,d.id,next_number,d.title || ' v' || next_number,created_key,supplied_name,
      supplied_size,supplied_sha256,private.current_person_id());
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(private.current_person_id(),private.current_person_id(),'controlled_version',created_id,'INSERT',
      jsonb_build_object('document_id',d.id,'version',next_number,'scan_state','NOT_SCANNED'));
  version_id:=created_id;object_key:=created_key;return next;
end;
$$;
create function public.finalize_controlled_version(requested_version uuid, server_proof text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v public.controlled_document_versions%rowtype; d public.controlled_documents%rowtype;
begin
  select * into v from public.controlled_document_versions where id=requested_version for update;
  if not found then raise exception 'Version unavailable'; end if;
  select * into d from public.controlled_documents where id=v.document_id;
  if d.created_by_person_id<>private.current_person_id() or not private.can_publish_controlled(d.family)
    or v.state<>'DRAFT' or not private.valid_document_server_proof(
      concat_ws(chr(31),'controlled_finalize',requested_version::text,v.sha256),server_proof)
  then raise exception 'Finalisation denied'; end if;
  if v.upload_state='READY' then return true; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='enterprise-controlled-documents'
    and o.name=v.object_key and (o.metadata->>'size')::integer=v.byte_size
    and o.metadata->>'mimetype'='application/pdf') then raise exception 'Object unavailable'; end if;
  update public.controlled_document_versions set upload_state='READY' where id=v.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(private.current_person_id(),private.current_person_id(),'controlled_version',v.id,'UPDATE',
      jsonb_build_object('upload_state','READY'));
  return true;
end;
$$;
create function public.publish_controlled_version(requested_version uuid, requested_effective_on date) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v public.controlled_document_versions%rowtype; d public.controlled_documents%rowtype;
  prior public.controlled_document_versions%rowtype;
begin
  select * into v from public.controlled_document_versions where id=requested_version for update;
  if not found then raise exception 'Version unavailable'; end if;
  select * into d from public.controlled_documents where id=v.document_id for update;
  if d.created_by_person_id<>private.current_person_id() or not private.can_publish_controlled(d.family)
    or v.state<>'DRAFT' or v.upload_state<>'READY' or requested_effective_on is null
    or requested_effective_on>current_date+30 or requested_effective_on<current_date-30
  then raise exception 'Publication denied'; end if;
  select * into prior from public.controlled_document_versions
    where document_id=d.id and state='PUBLISHED' for update;
  if found and exists(select 1 from public.onboarding_controlled_assignments a
    join public.onboarding_cases c on c.id=a.case_id
    where a.version_id=prior.id and c.state='IN_PROGRESS'
      and not exists(select 1 from public.controlled_acknowledgements ack where ack.assignment_id=a.id))
  then raise exception 'Unresolved assignment prevents supersession'; end if;
  if prior.id is not null then
    update public.controlled_document_versions set state='SUPERSEDED',superseded_at=now(),
      superseded_by_person_id=private.current_person_id() where id=prior.id;
    insert into public.controlled_publication_events(document_id,version_id,action,actor_person_id)
      values(d.id,prior.id,'SUPERSEDED',private.current_person_id());
    insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
      values(private.current_person_id(),private.current_person_id(),'controlled_publication',prior.id,'UPDATE',
        jsonb_build_object('action','SUPERSEDED','new_version_id',v.id));
  end if;
  update public.controlled_document_versions set state='PUBLISHED',published_at=now(),
    published_by_person_id=private.current_person_id(),effective_on=requested_effective_on where id=v.id;
  insert into public.controlled_publication_events(document_id,version_id,action,actor_person_id)
    values(d.id,v.id,'PUBLISHED',private.current_person_id());
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(private.current_person_id(),private.current_person_id(),'controlled_publication',v.id,'INSERT',
      jsonb_build_object('action','PUBLISHED','document_id',d.id,'version',v.version_number));
  return true;
end;
$$;
create function public.assign_onboarding_controlled(requested_case uuid,requested_requirement uuid,
  requested_version uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.onboarding_cases%rowtype; r public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; v public.controlled_document_versions%rowtype;
  cd public.controlled_documents%rowtype; created_id uuid;
begin
  select * into c from public.onboarding_cases where id=requested_case for update;
  select * into r from public.onboarding_case_requirements where id=requested_requirement and case_id=requested_case;
  select * into d from public.onboarding_requirement_definitions where id=r.definition_id;
  select * into v from public.controlled_document_versions where id=requested_version;
  select * into cd from public.controlled_documents where id=v.document_id;
  if c.id is null or c.state<>'IN_PROGRESS' or c.owner_person_id<>private.current_person_id()
    or c.person_id=private.current_person_id() or not private.has_active_role('OFFICE_ADMIN')
    or not private.can_publish_controlled('ONBOARDING_TERMS_SYNTHETIC')
    or r.id is null or d.code<>'CONTRACT_TERMS' or d.fulfilment_kind<>'CONTROLLED_ACKNOWLEDGEMENT'
    or d.provider_state<>'NOT_AVAILABLE' or d.template_version_id<>c.template_version_id
    or v.id is null or v.state<>'PUBLISHED' or v.effective_on>current_date or cd.family<>'ONBOARDING_TERMS_SYNTHETIC'
    or cd.created_by_person_id<>private.current_person_id()
    or exists(select 1 from public.onboarding_controlled_assignments where requirement_id=r.id)
  then raise exception 'Assignment denied'; end if;
  insert into public.onboarding_controlled_assignments(case_id,requirement_id,target_person_id,
    document_id,version_id,assigned_by_person_id)
    values(c.id,r.id,c.person_id,cd.id,v.id,private.current_person_id()) returning id into created_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(private.current_person_id(),c.person_id,'controlled_assignment',created_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',r.id,'version_id',v.id));
  return created_id;
end;
$$;
create function public.record_controlled_access(requested_assignment uuid,server_proof text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.onboarding_controlled_assignments%rowtype; c public.onboarding_cases%rowtype;
  v public.controlled_document_versions%rowtype; created_id uuid;
begin
  select * into a from public.onboarding_controlled_assignments where id=requested_assignment for update;
  select * into c from public.onboarding_cases where id=a.case_id;
  select * into v from public.controlled_document_versions where id=a.version_id;
  if a.id is null or c.state<>'IN_PROGRESS' or c.person_id<>private.current_person_id()
    or not private.has_active_role('SECURITY_STAFF') or v.id is null
    or not private.valid_document_server_proof(
      concat_ws(chr(31),'controlled_access',a.id::text,v.id::text),server_proof)
  then raise exception 'Access denied'; end if;
  insert into public.controlled_document_accesses(assignment_id,person_id,version_id)
    values(a.id,c.person_id,v.id) returning id into created_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(c.person_id,c.person_id,'controlled_access',created_id,'READ',
      jsonb_build_object('assignment_id',a.id,'version_id',v.id));
  return created_id;
end;
$$;
create function public.acknowledge_controlled_assignment(requested_assignment uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.onboarding_controlled_assignments%rowtype; c public.onboarding_cases%rowtype;
  v public.controlled_document_versions%rowtype; existing_id uuid; created_id uuid;
begin
  select * into a from public.onboarding_controlled_assignments where id=requested_assignment for update;
  select * into c from public.onboarding_cases where id=a.case_id for update;
  select * into v from public.controlled_document_versions where id=a.version_id;
  if a.id is null or c.state<>'IN_PROGRESS' or c.person_id<>private.current_person_id()
    or not private.has_active_role('SECURITY_STAFF') then raise exception 'Acknowledgement denied'; end if;
  select id into existing_id from public.controlled_acknowledgements where assignment_id=a.id;
  if existing_id is not null then return existing_id; end if;
  if v.state<>'PUBLISHED' or v.effective_on>current_date
    or not exists(select 1 from public.controlled_document_accesses x where x.assignment_id=a.id
      and x.person_id=c.person_id and x.version_id=v.id)
  then raise exception 'Exact published version must be accessed first'; end if;
  insert into public.controlled_acknowledgements(target_person_id,actor_person_id,case_id,requirement_id,
    assignment_id,document_id,version_id,acknowledgement_type)
    values(c.person_id,c.person_id,c.id,a.requirement_id,a.id,a.document_id,v.id,
      'PRESENTED_AND_ACKNOWLEDGED') returning id into created_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(c.person_id,c.person_id,'controlled_acknowledgement',created_id,'INSERT',
      jsonb_build_object('assignment_id',a.id,'version_id',v.id));
  return created_id;
end;
$$;

revoke all on function public.grant_controlled_publisher(uuid,timestamptz),
  public.revoke_controlled_publisher(uuid),public.create_controlled_document(),
  public.begin_controlled_version(uuid,text,integer,text,text),public.finalize_controlled_version(uuid,text),
  public.publish_controlled_version(uuid,date),public.assign_onboarding_controlled(uuid,uuid,uuid),
  public.record_controlled_access(uuid,text),public.acknowledge_controlled_assignment(uuid)
  from public,anon,authenticated;
grant execute on function public.grant_controlled_publisher(uuid,timestamptz),
  public.revoke_controlled_publisher(uuid),public.create_controlled_document(),
  public.begin_controlled_version(uuid,text,integer,text,text),public.finalize_controlled_version(uuid,text),
  public.publish_controlled_version(uuid,date),public.assign_onboarding_controlled(uuid,uuid,uuid),
  public.record_controlled_access(uuid,text),public.acknowledge_controlled_assignment(uuid)
  to authenticated;
