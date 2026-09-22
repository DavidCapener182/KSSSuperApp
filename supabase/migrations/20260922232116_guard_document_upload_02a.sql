-- TASK-02A hardening after independent security review.
-- A high-entropy proof key is generated in the database and copied only to
-- ignored local server configuration for this development project.
create table private.document_upload_signing_secret (
  singleton boolean primary key default true check (singleton),
  secret_hex text not null check (secret_hex ~ '^[0-9a-f]{64}$')
);
revoke all on private.document_upload_signing_secret from public, anon, authenticated;
insert into private.document_upload_signing_secret(singleton, secret_hex)
values (true, encode(extensions.gen_random_bytes(32), 'hex'));

create function private.valid_document_server_proof(payload text, proof text) returns boolean
language sql stable security definer set search_path = '' as $$
  select proof is not null and proof ~ '^[0-9a-f]{64}$' and exists (
    select 1 from private.document_upload_signing_secret s where s.singleton
      and encode(extensions.hmac(convert_to(payload,'UTF8'),decode(s.secret_hex,'hex'),'sha256'),'hex') = proof
  )
$$;
revoke all on function private.valid_document_server_proof(text,text) from public, anon, authenticated;
grant execute on function private.valid_document_server_proof(text,text) to authenticated;

-- Remove user-callable versions that trusted caller-supplied file metadata.
drop function public.begin_document_upload(uuid,text,text,integer,text);
drop function public.finalize_document_upload(uuid,uuid);

create function public.begin_document_upload(requested_id uuid, supplied_name text, supplied_mime text,
  supplied_size integer, supplied_sha256 text, server_proof text)
returns table(version_id uuid, object_key text, upload_state text)
language plpgsql volatile security definer set search_path = '' as $$
declare doc public.documents%rowtype; existing public.document_versions%rowtype; new_id uuid;
begin
  if not private.valid_document_server_proof(
      concat_ws(chr(0),'begin',requested_id::text,supplied_name,supplied_mime,supplied_size::text,supplied_sha256), server_proof)
    or not private.document_can_submit_request(requested_id) or
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

create function public.finalize_document_upload(requested_id uuid, version_id uuid, server_proof text)
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
  if not found or v.uploader_person_id is distinct from private.current_person_id() or
    not private.valid_document_server_proof(
      concat_ws(chr(0),'finalize',requested_id::text,version_id::text,v.sha256), server_proof)
  then raise exception 'Upload denied'; end if;
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
revoke all on function public.begin_document_upload(uuid,text,text,integer,text,text),
  public.finalize_document_upload(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.begin_document_upload(uuid,text,text,integer,text,text),
  public.finalize_document_upload(uuid,uuid,text) to authenticated;

-- Even privileged future writes cannot rewrite controlled submitted evidence.
create function private.guard_document_version_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.document_id is distinct from old.document_id or
     new.version_number is distinct from old.version_number or new.object_key is distinct from old.object_key or
     new.original_filename is distinct from old.original_filename or new.mime_type is distinct from old.mime_type or
     new.byte_size is distinct from old.byte_size or new.sha256 is distinct from old.sha256 or
     new.uploader_person_id is distinct from old.uploader_person_id or new.scan_state is distinct from old.scan_state or
     new.created_at is distinct from old.created_at then
    raise exception 'Document version metadata is immutable'; end if;
  if old.upload_state = 'SUBMITTED' or new.upload_state <> 'SUBMITTED' or
     old.upload_state <> 'PENDING_UPLOAD' or new.submitted_at is null then
    raise exception 'Invalid document version transition'; end if;
  return new;
end;
$$;
revoke all on function private.guard_document_version_update() from public, anon, authenticated;
create trigger guard_document_version_update before update on public.document_versions
  for each row execute function private.guard_document_version_update();

create function private.guard_document_request_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.target_person_id is distinct from old.target_person_id or
     new.requester_person_id is distinct from old.requester_person_id or new.site_id is distinct from old.site_id or
     new.title is distinct from old.title or new.created_at is distinct from old.created_at or
     old.status <> 'REQUESTED' or new.status <> 'SUBMITTED' or new.submitted_at is null then
    raise exception 'Invalid document request transition'; end if;
  return new;
end;
$$;
revoke all on function private.guard_document_request_update() from public, anon, authenticated;
create trigger guard_document_request_update before update on public.document_requests
  for each row execute function private.guard_document_request_update();

-- Attributable Super Admin application-route retrieval. Direct authorised
-- Storage downloads remain outside this application-route event.
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check
  check (action in ('INSERT','UPDATE','READ','DELETE'));
create function public.audit_document_privileged_read(requested_id uuid, requested_version uuid, server_proof text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if not private.has_active_role('SUPER_ADMIN') or not private.document_can_read_request(requested_id) or
     not private.valid_document_server_proof(concat_ws(chr(0),'read',requested_id::text,requested_version::text),server_proof)
  then raise exception 'Read denied'; end if;
  select r.target_person_id into target from public.document_requests r
    join public.documents d on d.request_id = r.id
    join public.document_versions v on v.document_id = d.id
    where r.id = requested_id and v.id = requested_version and v.upload_state = 'SUBMITTED';
  if target is null then raise exception 'Read denied'; end if;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (private.current_person_id(),target,'document_version',requested_version,'READ',
      jsonb_build_object('request_id',requested_id));
  return true;
end;
$$;
revoke all on function public.audit_document_privileged_read(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.audit_document_privileged_read(uuid,uuid,text) to authenticated;

-- Only stale pending objects can be removed by Super Admin cleanup.
create function private.document_can_cleanup_key(requested_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.has_active_role('SUPER_ADMIN')) and exists (
    select 1 from public.document_versions v where v.object_key = requested_key
      and v.upload_state = 'PENDING_UPLOAD' and v.created_at < now() - interval '24 hours'
  )
$$;
revoke all on function private.document_can_cleanup_key(text) from public, anon, authenticated;
grant execute on function private.document_can_cleanup_key(text) to authenticated;
create policy enterprise_document_cleanup_read on storage.objects for select to authenticated
  using (bucket_id = 'enterprise-personnel-evidence'
    and storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info','object.delete'])
    and private.document_can_cleanup_key(name));
create policy enterprise_document_cleanup_delete on storage.objects for delete to authenticated
  using (bucket_id = 'enterprise-personnel-evidence' and private.document_can_cleanup_key(name));

create function public.cleanup_stale_document_version(requested_version uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v public.document_versions%rowtype; target uuid;
begin
  if not private.has_active_role('SUPER_ADMIN') then raise exception 'Cleanup denied'; end if;
  select * into v from public.document_versions where id = requested_version for update;
  if not found or v.upload_state <> 'PENDING_UPLOAD' or v.created_at >= now() - interval '24 hours' then
    raise exception 'Cleanup denied'; end if;
  if exists (select 1 from storage.objects o where o.bucket_id='enterprise-personnel-evidence' and o.name=v.object_key)
    then raise exception 'Object still present'; end if;
  select d.owner_person_id into target from public.documents d where d.id=v.document_id;
  delete from public.document_versions where id=requested_version;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (private.current_person_id(),target,'document_version',requested_version,'DELETE',
      jsonb_build_object('state','STALE_PENDING_CLEANED'));
  return true;
end;
$$;
revoke all on function public.cleanup_stale_document_version(uuid) from public, anon, authenticated;
grant execute on function public.cleanup_stale_document_version(uuid) to authenticated;
