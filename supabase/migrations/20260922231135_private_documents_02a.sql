-- TASK-02A: synthetic personnel-document request, one immutable submitted version.
-- Dedicated KSS Enterprise Dev project only. No real personnel documents.
create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  target_person_id uuid not null references public.people(id),
  requester_person_id uuid not null references public.people(id),
  site_id uuid references public.sites(id), -- optional creation context, never audience
  title text not null check (length(trim(title)) between 1 and 100),
  status text not null default 'REQUESTED' check (status in ('REQUESTED','SUBMITTED')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  check ((status = 'REQUESTED' and submitted_at is null) or (status = 'SUBMITTED' and submitted_at is not null))
);
create index document_requests_target_at_idx on public.document_requests(target_person_id, created_at desc);
create index document_requests_requester_at_idx on public.document_requests(requester_person_id, created_at desc);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.document_requests(id),
  owner_person_id uuid not null references public.people(id),
  classification text not null default 'PERSONNEL_PRIVATE' check (classification = 'PERSONNEL_PRIVATE'),
  source_kind text not null default 'ENTERPRISE_NATIVE' check (source_kind = 'ENTERPRISE_NATIVE'),
  created_at timestamptz not null default now()
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id),
  version_number integer not null check (version_number > 0),
  object_key text not null unique check (length(object_key) between 50 and 120),
  original_filename text not null check (length(original_filename) between 1 and 180 and original_filename !~ '[\\/[:cntrl:]]'),
  mime_type text not null check (mime_type in ('application/pdf','image/png','image/jpeg')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploader_person_id uuid not null references public.people(id),
  upload_state text not null default 'PENDING_UPLOAD' check (upload_state in ('PENDING_UPLOAD','SUBMITTED')),
  scan_state text not null default 'NOT_SCANNED' check (scan_state = 'NOT_SCANNED'),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (document_id, version_number),
  check ((upload_state = 'PENDING_UPLOAD' and submitted_at is null) or (upload_state = 'SUBMITTED' and submitted_at is not null))
);
create index document_versions_document_at_idx on public.document_versions(document_id, created_at desc);

alter table public.document_requests enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
revoke all on public.document_requests, public.documents, public.document_versions from anon, authenticated;
grant select on public.document_requests, public.documents, public.document_versions to authenticated;

-- These fixed-search-path helpers read authoritative Person/role/request records,
-- never JWT user metadata. They are not exposed via the Data API.
create function private.document_can_read_request(requested_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_requests r
    where r.id = requested_id and (
      (select private.has_active_role('SUPER_ADMIN')) or
      (r.target_person_id = (select private.current_person_id()) and (select private.has_active_role('SECURITY_STAFF'))) or
      (r.requester_person_id = (select private.current_person_id()) and (select private.has_active_role('OFFICE_ADMIN')))
    )
  )
$$;
create function private.document_can_submit_request(requested_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_requests r
    where r.id = requested_id and r.status = 'REQUESTED'
      and r.target_person_id = (select private.current_person_id())
      and (select private.has_active_role('SECURITY_STAFF'))
  )
$$;
create function private.document_can_upload_key(requested_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_versions v
    join public.documents d on d.id = v.document_id
    where v.object_key = requested_key and v.upload_state = 'PENDING_UPLOAD'
      and v.uploader_person_id = (select private.current_person_id())
      and (select private.document_can_submit_request(d.request_id))
  )
$$;
create function private.document_can_download_key(requested_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_versions v
    join public.documents d on d.id = v.document_id
    where v.object_key = requested_key and v.upload_state = 'SUBMITTED'
      and d.classification = 'PERSONNEL_PRIVATE'
      and (select private.document_can_read_request(d.request_id))
  )
$$;
create function private.document_can_reconcile_key(requested_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_versions v
    join public.documents d on d.id = v.document_id
    where v.object_key = requested_key and v.upload_state = 'PENDING_UPLOAD'
      and v.uploader_person_id = (select private.current_person_id())
      and (select private.document_can_submit_request(d.request_id))
  )
$$;
revoke all on function private.document_can_read_request(uuid), private.document_can_submit_request(uuid),
  private.document_can_upload_key(text), private.document_can_download_key(text),
  private.document_can_reconcile_key(text) from public, anon, authenticated;
grant execute on function private.document_can_read_request(uuid), private.document_can_submit_request(uuid),
  private.document_can_upload_key(text), private.document_can_download_key(text),
  private.document_can_reconcile_key(text) to authenticated;

create policy document_requests_read on public.document_requests for select to authenticated
  using ((select private.document_can_read_request(id)));
create policy documents_read on public.documents for select to authenticated
  using ((select private.document_can_read_request(request_id)) and classification = 'PERSONNEL_PRIVATE');
create policy document_versions_read on public.document_versions for select to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id
    and (select private.document_can_read_request(d.request_id))));

-- The existing audit ledger is extended without copying private file metadata.
alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check
  check (entity_type in ('role_assignment','site_assignment','site','document_request','document_version'));
alter table public.audit_events drop constraint audit_events_target_check;
alter table public.audit_events add constraint audit_events_target_check check (
  (entity_type = 'site' and site_id is not null) or
  (entity_type = 'site_assignment' and site_id is not null and affected_person_id is not null) or
  (entity_type = 'role_assignment' and affected_person_id is not null) or
  (entity_type in ('document_request','document_version') and affected_person_id is not null)
);
create index audit_events_document_at_idx on public.audit_events(entity_type, entity_id, occurred_at desc)
  where entity_type in ('document_request','document_version');

-- Narrow transactional RPCs. Every public entry point authenticates, verifies
-- the stable Person and current database role, and is granted only to authenticated.
create function public.eligible_document_targets(requested_site uuid)
returns table(person_id uuid, display_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_person_id() is null or not (
    private.has_active_role('SUPER_ADMIN') or
    (requested_site is not null and private.office_owns_site(requested_site) and private.site_is_active(requested_site))
  ) then return; end if;
  return query
    select p.id, p.display_name from public.people p
    where exists (select 1 from public.role_assignments ra
      where ra.person_id = p.id and ra.role_code = 'SECURITY_STAFF'
        and ra.revoked_at is null and ra.effective_from <= now()
        and (ra.effective_until is null or ra.effective_until > now()))
      and (private.has_active_role('SUPER_ADMIN') or exists (
        select 1 from public.site_assignments sa where sa.person_id = p.id
          and sa.site_id = requested_site and sa.revoked_at is null
          and sa.effective_from <= now() and (sa.effective_until is null or sa.effective_until > now())))
    order by p.display_name limit 50;
end;
$$;

create function public.create_document_request(target_person uuid, requested_site uuid, request_title text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; new_request uuid;
begin
  actor := private.current_person_id();
  if actor is null or target_person is null or target_person = actor or
     request_title is null or length(trim(request_title)) not between 1 and 100 or
     request_title ~ '[[:cntrl:]]' or
     not exists (select 1 from public.role_assignments ra where ra.person_id = target_person
       and ra.role_code = 'SECURITY_STAFF' and ra.revoked_at is null
       and ra.effective_from <= now() and (ra.effective_until is null or ra.effective_until > now()))
  then raise exception 'Document request denied'; end if;
  if not private.has_active_role('SUPER_ADMIN') then
    if requested_site is null or not private.office_owns_site(requested_site) or
       not private.site_is_active(requested_site) or
       not exists (select 1 from public.site_assignments sa where sa.person_id = target_person
         and sa.site_id = requested_site and sa.revoked_at is null
         and sa.effective_from <= now() and (sa.effective_until is null or sa.effective_until > now()))
    then raise exception 'Document request denied'; end if;
  end if;
  insert into public.document_requests(target_person_id,requester_person_id,site_id,title)
    values (target_person,actor,requested_site,trim(request_title)) returning id into new_request;
  insert into public.documents(request_id,owner_person_id) values (new_request,target_person);
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (actor,target_person,'document_request',new_request,'INSERT',jsonb_build_object('status','REQUESTED'));
  return new_request;
end;
$$;

create function public.begin_document_upload(requested_id uuid, supplied_name text, supplied_mime text,
  supplied_size integer, supplied_sha256 text)
returns table(version_id uuid, object_key text, upload_state text)
language plpgsql volatile security definer set search_path = '' as $$
declare doc public.documents%rowtype; existing public.document_versions%rowtype; new_id uuid;
begin
  if not private.document_can_submit_request(requested_id) or
    supplied_name is null or length(supplied_name) not between 1 and 180 or
    supplied_name ~ '[\\/[:cntrl:]]' or
    supplied_mime is null or supplied_mime not in ('application/pdf','image/png','image/jpeg') or
    supplied_size is null or supplied_size not between 1 and 5242880 or
    supplied_sha256 is null or supplied_sha256 !~ '^[0-9a-f]{64}$'
  then raise exception 'Upload denied'; end if;
  perform 1 from public.document_requests r where r.id = requested_id for update;
  if not private.document_can_submit_request(requested_id) then raise exception 'Upload denied'; end if;
  select * into doc from public.documents d where d.request_id = requested_id;
  select * into existing from public.document_versions v where v.document_id = doc.id and v.version_number = 1;
  if found then
    if existing.uploader_person_id is distinct from private.current_person_id() or
       existing.original_filename is distinct from supplied_name or
       existing.mime_type is distinct from supplied_mime or
       existing.byte_size is distinct from supplied_size or
       existing.sha256 is distinct from supplied_sha256 or
       existing.upload_state <> 'PENDING_UPLOAD'
    then raise exception 'Upload conflict'; end if;
    version_id := existing.id; object_key := existing.object_key; upload_state := existing.upload_state;
    return next; return;
  end if;
  new_id := gen_random_uuid();
  insert into public.document_versions(id,document_id,version_number,object_key,
    original_filename,mime_type,byte_size,sha256,uploader_person_id)
    values (new_id,doc.id,1,gen_random_uuid()::text || '/' || new_id::text,
      supplied_name,supplied_mime,supplied_size,supplied_sha256,private.current_person_id())
    returning id, public.document_versions.object_key, public.document_versions.upload_state
      into version_id, object_key, upload_state;
  return next;
end;
$$;

create function public.finalize_document_upload(requested_id uuid, version_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare r public.document_requests%rowtype; v public.document_versions%rowtype;
begin
  if private.current_person_id() is null or not private.has_active_role('SECURITY_STAFF') then
    raise exception 'Upload denied'; end if;
  select * into r from public.document_requests q where q.id = requested_id for update;
  if not found or r.target_person_id is distinct from private.current_person_id() then
    raise exception 'Upload denied'; end if;
  select dv.* into v from public.document_versions dv join public.documents d on d.id = dv.document_id
    where dv.id = version_id and d.request_id = requested_id for update of dv;
  if not found or v.uploader_person_id is distinct from private.current_person_id() then
    raise exception 'Upload denied'; end if;
  if r.status = 'SUBMITTED' and v.upload_state = 'SUBMITTED' then return true; end if;
  if r.status <> 'REQUESTED' or v.upload_state <> 'PENDING_UPLOAD' or not exists (
    select 1 from storage.objects o where o.bucket_id = 'enterprise-personnel-evidence'
      and o.name = v.object_key and (o.metadata ->> 'size')::integer = v.byte_size
      and o.metadata ->> 'mimetype' = v.mime_type
  ) then raise exception 'Upload not ready'; end if;
  update public.document_versions set upload_state = 'SUBMITTED', submitted_at = now() where id = version_id;
  update public.document_requests set status = 'SUBMITTED', submitted_at = now() where id = requested_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (private.current_person_id(),r.target_person_id,'document_version',version_id,'UPDATE',
      jsonb_build_object('status','SUBMITTED','request_id',requested_id));
  return true;
end;
$$;

revoke all on function public.eligible_document_targets(uuid),
  public.create_document_request(uuid,uuid,text),
  public.begin_document_upload(uuid,text,text,integer,text),
  public.finalize_document_upload(uuid,uuid) from public, anon, authenticated;
grant execute on function public.eligible_document_targets(uuid),
  public.create_document_request(uuid,uuid,text),
  public.begin_document_upload(uuid,text,text,integer,text),
  public.finalize_document_upload(uuid,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('enterprise-personnel-evidence','enterprise-personnel-evidence',false,5242880,
  array['application/pdf','image/png','image/jpeg']);
create policy enterprise_document_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'enterprise-personnel-evidence' and private.document_can_upload_key(name));
create policy enterprise_document_download on storage.objects for select to authenticated
  using (bucket_id = 'enterprise-personnel-evidence'
    and storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info'])
    and (private.document_can_download_key(name) or private.document_can_reconcile_key(name)));
