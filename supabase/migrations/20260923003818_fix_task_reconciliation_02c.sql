-- TASK-02C forward repair: qualify the reviewed version lookup in the bounded reconciler.
create or replace function private.reconcile_document_review_task(version_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v public.document_versions%rowtype; d public.documents%rowtype;
  latest_version uuid; review_row public.document_reviews%rowtype; task_id uuid;
begin
  select * into v from public.document_versions where id = version_id;
  if not found or v.upload_state <> 'SUBMITTED' then raise exception 'Reconciliation source denied'; end if;
  select * into d from public.documents where id = v.document_id and classification = 'PERSONNEL_PRIVATE';
  if not found then raise exception 'Reconciliation source denied'; end if;
  select id into latest_version from public.document_versions
    where document_id = d.id and upload_state = 'SUBMITTED' order by version_number desc limit 1;
  select * into review_row from public.document_reviews rev where rev.version_id = v.id;
  if review_row.id is null and latest_version <> v.id then
    raise exception 'Older undecided version requires investigation'; end if;
  task_id := private.ensure_document_review_task(v.id,v.uploader_person_id);
  if review_row.id is not null then
    perform private.resolve_reconciled_document_review_task(task_id,review_row.id,review_row.reviewer_person_id);
  end if;
  return task_id;
end;
$$;
revoke all on function private.reconcile_document_review_task(uuid) from public, anon, authenticated;
