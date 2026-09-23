-- TASK-02B: synthetic-only evidence review and replacement. Preserve all 02A history.
create table public.document_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.document_requests(id),
  document_id uuid not null references public.documents(id),
  version_id uuid not null unique references public.document_versions(id),
  reviewer_person_id uuid not null references public.people(id),
  decision text not null check (decision in ('ACCEPTED_AS_EVIDENCE','REJECTED')),
  reason_code text check (reason_code in
    ('UNREADABLE','WRONG_DOCUMENT','INCOMPLETE','EXPIRED_OR_OUTDATED','DETAILS_DO_NOT_MATCH','OTHER')),
  reviewer_comment text,
  decided_at timestamptz not null default now(),
  check (
    (decision = 'ACCEPTED_AS_EVIDENCE' and reason_code is null and reviewer_comment is null)
    or
    (decision = 'REJECTED' and reason_code is not null
      and reviewer_comment is not null
      and length(trim(reviewer_comment)) between 10 and 500
      and reviewer_comment !~ '[[:cntrl:]]')
  )
);
create index document_reviews_request_at_idx on public.document_reviews(request_id, decided_at desc);
alter table public.document_reviews enable row level security;
revoke all on public.document_reviews from public, anon, authenticated;
grant select on public.document_reviews to authenticated;
create policy document_reviews_read on public.document_reviews for select to authenticated using (
  (select private.document_can_read_request(request_id))
  and exists (select 1 from public.documents d where d.id = document_id
    and d.request_id = document_reviews.request_id and d.classification = 'PERSONNEL_PRIVATE')
);

-- The business decision cannot be rewritten, and must bind to an exact submitted version.
create function private.guard_document_review() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid; uploader uuid;
begin
  if tg_op <> 'INSERT' then raise exception 'Document reviews are immutable'; end if;
  select r.target_person_id, v.uploader_person_id into target, uploader
    from public.document_requests r
    join public.documents d on d.request_id = r.id
    join public.document_versions v on v.document_id = d.id
    where r.id = new.request_id and d.id = new.document_id and v.id = new.version_id
      and d.classification = 'PERSONNEL_PRIVATE' and v.upload_state = 'SUBMITTED';
  if target is null or new.reviewer_person_id in (target,uploader) or
    exists (select 1 from public.document_versions later
      join public.document_versions current_version on current_version.id = new.version_id
      where later.document_id = new.document_id
        and later.upload_state = 'SUBMITTED'
        and later.version_number > current_version.version_number)
  then raise exception 'Review target denied'; end if;
  return new;
end;
$$;
revoke all on function private.guard_document_review() from public, anon, authenticated;
create trigger guard_document_review_insert before insert on public.document_reviews
  for each row execute function private.guard_document_review();
create trigger guard_document_review_change before update or delete on public.document_reviews
  for each row execute function private.guard_document_review();

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check
  check (entity_type in ('role_assignment','site_assignment','site','document_request','document_version','document_review'));
alter table public.audit_events drop constraint audit_events_target_check;
alter table public.audit_events add constraint audit_events_target_check check (
  (entity_type = 'site' and site_id is not null) or
  (entity_type = 'site_assignment' and site_id is not null and affected_person_id is not null) or
  (entity_type = 'role_assignment' and affected_person_id is not null) or
  (entity_type in ('document_request','document_version','document_review') and affected_person_id is not null)
);

-- A scoped label for the Office queue; people SELECT remains self/Super only.
create function public.document_subject_name(requested_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select p.display_name from public.document_requests r
    join public.people p on p.id = r.target_person_id
    join public.documents d on d.request_id = r.id
    where r.id = requested_id and d.classification = 'PERSONNEL_PRIVATE'
      and private.document_can_read_request(r.id)
$$;
revoke all on function public.document_subject_name(uuid) from public, anon, authenticated;
grant execute on function public.document_subject_name(uuid) to authenticated;

create function public.review_document_version(
  requested_id uuid, reviewed_version uuid, supplied_decision text,
  supplied_reason text, supplied_comment text
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; r public.document_requests%rowtype; d public.documents%rowtype;
  v public.document_versions%rowtype; review_id uuid; clean_comment text;
begin
  actor := private.current_person_id();
  if actor is null or not (private.has_active_role('SUPER_ADMIN') or private.has_active_role('OFFICE_ADMIN')) then
    raise exception 'Review denied'; end if;
  select * into r from public.document_requests where id = requested_id for update;
  if not found or (not private.has_active_role('SUPER_ADMIN') and
      (not private.has_active_role('OFFICE_ADMIN') or r.requester_person_id <> actor))
    or r.target_person_id = actor then raise exception 'Review denied'; end if;
  select * into d from public.documents where request_id = requested_id;
  if not found or d.classification <> 'PERSONNEL_PRIVATE' then raise exception 'Review denied'; end if;
  select * into v from public.document_versions where id = reviewed_version and document_id = d.id for update;
  if not found or v.upload_state <> 'SUBMITTED' or v.uploader_person_id = actor or
    exists (select 1 from public.document_versions later
      where later.document_id = d.id and later.upload_state = 'SUBMITTED'
        and later.version_number > v.version_number) or
    exists (select 1 from public.document_reviews existing where existing.version_id = reviewed_version)
  then raise exception 'Review conflict'; end if;
  clean_comment := case when supplied_comment is null then null else trim(supplied_comment) end;
  if supplied_decision = 'ACCEPTED_AS_EVIDENCE' then
    if supplied_reason is not null or clean_comment is not null then raise exception 'Review input denied'; end if;
  elsif supplied_decision = 'REJECTED' then
    if supplied_reason is null or supplied_reason not in
      ('UNREADABLE','WRONG_DOCUMENT','INCOMPLETE','EXPIRED_OR_OUTDATED','DETAILS_DO_NOT_MATCH','OTHER')
      or clean_comment is null or length(clean_comment) not between 10 and 500
      or clean_comment ~ '[[:cntrl:]]'
    then raise exception 'Review input denied'; end if;
  else raise exception 'Review input denied'; end if;
  insert into public.document_reviews(request_id,document_id,version_id,reviewer_person_id,
    decision,reason_code,reviewer_comment)
    values (r.id,d.id,v.id,actor,supplied_decision,supplied_reason,clean_comment)
    returning id into review_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (actor,r.target_person_id,'document_review',review_id,'INSERT',
      jsonb_build_object('request_id',r.id,'version_id',v.id,'decision',supplied_decision));
  return review_id;
end;
$$;
revoke all on function public.review_document_version(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.review_document_version(uuid,uuid,text,text,text) to authenticated;

-- Upload authority is still the target Staff Person; a replacement is allowed only
-- while the latest submitted version has an immutable REJECTED decision.
create or replace function private.document_can_submit_request(requested_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_requests r
    join public.documents d on d.request_id = r.id
    where r.id = requested_id and d.classification = 'PERSONNEL_PRIVATE'
      and r.target_person_id = (select private.current_person_id())
      and (select private.has_active_role('SECURITY_STAFF'))
      and (r.status = 'REQUESTED' or (
        r.status = 'SUBMITTED' and exists (
          select 1 from public.document_versions v
          join public.document_reviews rev on rev.version_id = v.id and rev.decision = 'REJECTED'
          where v.document_id = d.id and v.upload_state = 'SUBMITTED'
            and not exists (select 1 from public.document_versions newer
              where newer.document_id = d.id and newer.upload_state = 'SUBMITTED'
                and newer.version_number > v.version_number)
        )
      ))
  )
$$;

create or replace function public.begin_document_upload(requested_id uuid, supplied_name text, supplied_mime text,
  supplied_size integer, supplied_sha256 text, server_proof text)
returns table(version_id uuid, object_key text, upload_state text)
language plpgsql volatile security definer set search_path = '' as $$
declare doc public.documents%rowtype; existing public.document_versions%rowtype;
  prior public.document_versions%rowtype; new_id uuid; next_number integer;
begin
  if not private.valid_document_server_proof(
      concat_ws(chr(31),'begin',requested_id::text,supplied_name,supplied_mime,supplied_size::text,supplied_sha256),server_proof)
    or not private.document_can_submit_request(requested_id)
    or supplied_name is null or length(supplied_name) not between 1 and 180
    or supplied_name ~ '[\\/[:cntrl:]]'
    or supplied_mime is null or supplied_mime not in ('application/pdf','image/png','image/jpeg')
    or supplied_size is null or supplied_size not between 1 and 5242880
    or supplied_sha256 is null or supplied_sha256 !~ '^[0-9a-f]{64}$'
  then raise exception 'Upload denied'; end if;
  perform 1 from public.document_requests r where r.id = requested_id for update;
  if not private.document_can_submit_request(requested_id) then raise exception 'Upload denied'; end if;
  select * into doc from public.documents d where d.request_id = requested_id;
  select * into existing from public.document_versions v where v.document_id = doc.id
    order by v.version_number desc limit 1;
  if found and existing.upload_state = 'PENDING_UPLOAD' then
    if existing.uploader_person_id is distinct from private.current_person_id() or
      existing.original_filename is distinct from supplied_name or
      existing.mime_type is distinct from supplied_mime or
      existing.byte_size is distinct from supplied_size or
      existing.sha256 is distinct from supplied_sha256
    then raise exception 'Upload conflict'; end if;
    version_id := existing.id; object_key := existing.object_key; upload_state := existing.upload_state;
    return next; return;
  end if;
  if found then
    prior := existing;
    if not exists (select 1 from public.document_reviews rev
      where rev.version_id = prior.id and rev.decision = 'REJECTED')
    then raise exception 'Upload conflict'; end if;
    next_number := prior.version_number + 1;
  else next_number := 1; end if;
  new_id := gen_random_uuid();
  insert into public.document_versions(id,document_id,version_number,object_key,
    original_filename,mime_type,byte_size,sha256,uploader_person_id)
    values (new_id,doc.id,next_number,gen_random_uuid()::text || '/' || new_id::text,
      supplied_name,supplied_mime,supplied_size,supplied_sha256,private.current_person_id())
    returning id, public.document_versions.object_key, public.document_versions.upload_state
      into version_id, object_key, upload_state;
  return next;
end;
$$;

create or replace function public.finalize_document_upload(requested_id uuid, version_id uuid, server_proof text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare r public.document_requests%rowtype; v public.document_versions%rowtype; d public.documents%rowtype;
begin
  if private.current_person_id() is null or not private.has_active_role('SECURITY_STAFF') then
    raise exception 'Upload denied'; end if;
  select * into r from public.document_requests q where q.id = requested_id for update;
  if not found or r.target_person_id is distinct from private.current_person_id() then
    raise exception 'Upload denied'; end if;
  select * into d from public.documents where request_id = requested_id;
  select * into v from public.document_versions where id = version_id and document_id = d.id for update;
  if not found or v.uploader_person_id is distinct from private.current_person_id() or
    not private.valid_document_server_proof(
      concat_ws(chr(31),'finalize',requested_id::text,version_id::text,v.sha256),server_proof)
  then raise exception 'Upload denied'; end if;
  if v.upload_state = 'SUBMITTED' then return true; end if;
  if v.upload_state <> 'PENDING_UPLOAD'
    or exists (select 1 from public.document_versions newer
      where newer.document_id = d.id and newer.version_number > v.version_number)
    or not private.document_can_submit_request(requested_id)
    or (v.version_number > 1 and not exists (
      select 1 from public.document_versions prior
      join public.document_reviews rev on rev.version_id = prior.id and rev.decision = 'REJECTED'
      where prior.document_id = d.id and prior.version_number = v.version_number - 1
        and prior.upload_state = 'SUBMITTED'))
    or not exists (select 1 from storage.objects o
      where o.bucket_id = 'enterprise-personnel-evidence' and o.name = v.object_key
        and (o.metadata ->> 'size')::integer = v.byte_size
        and o.metadata ->> 'mimetype' = v.mime_type)
  then raise exception 'Upload not ready'; end if;
  update public.document_versions set upload_state = 'SUBMITTED', submitted_at = now() where id = version_id;
  if r.status = 'REQUESTED' then
    update public.document_requests set status = 'SUBMITTED', submitted_at = now() where id = requested_id;
  end if;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (private.current_person_id(),r.target_person_id,'document_version',version_id,'UPDATE',
      jsonb_build_object('status','SUBMITTED','request_id',requested_id));
  return true;
end;
$$;
