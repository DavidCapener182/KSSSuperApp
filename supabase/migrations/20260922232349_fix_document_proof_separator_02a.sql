-- PostgreSQL text rejects NUL; ASCII unit separator is unambiguous because
-- validated filenames cannot contain control characters.


create or replace function public.begin_document_upload(requested_id uuid, supplied_name text, supplied_mime text,
  supplied_size integer, supplied_sha256 text, server_proof text)
returns table(version_id uuid, object_key text, upload_state text)
language plpgsql volatile security definer set search_path = '' as $$
declare doc public.documents%rowtype; existing public.document_versions%rowtype; new_id uuid;
begin
  if not private.valid_document_server_proof(
      concat_ws(chr(31),'begin',requested_id::text,supplied_name,supplied_mime,supplied_size::text,supplied_sha256), server_proof)
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

create or replace function public.finalize_document_upload(requested_id uuid, version_id uuid, server_proof text)
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
      concat_ws(chr(31),'finalize',requested_id::text,version_id::text,v.sha256), server_proof)
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

create or replace function public.audit_document_privileged_read(requested_id uuid, requested_version uuid, server_proof text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if not private.has_active_role('SUPER_ADMIN') or not private.document_can_read_request(requested_id) or
     not private.valid_document_server_proof(concat_ws(chr(31),'read',requested_id::text,requested_version::text),server_proof)
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
