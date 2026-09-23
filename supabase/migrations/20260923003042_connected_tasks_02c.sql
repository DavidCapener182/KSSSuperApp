-- TASK-02C: synthetic document-review work. Business decisions remain in document_reviews.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_type text not null check (task_type = 'DOCUMENT_REVIEW'),
  title text not null check (title = 'Review submitted personnel evidence'),
  state text not null default 'OPEN' check (state in ('OPEN','DONE')),
  assignee_person_id uuid not null references public.people(id),
  source_kind text not null check (source_kind = 'DOCUMENT_VERSION'),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completion_kind text check (completion_kind = 'DOCUMENT_REVIEW_DECISION'),
  completion_event_id uuid,
  unique (source_kind, source_id),
  check ((state = 'OPEN' and completed_at is null and completion_kind is null and completion_event_id is null)
    or (state = 'DONE' and completed_at is not null and completion_kind = 'DOCUMENT_REVIEW_DECISION' and completion_event_id is not null))
);
create index tasks_assignee_state_created_idx on public.tasks(assignee_person_id,state,created_at desc);
alter table public.tasks enable row level security;
revoke all on public.tasks from public, anon, authenticated;
grant select on public.tasks to authenticated;

create function private.task_source_readable(version_id uuid, assignee uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_versions v
      join public.documents d on d.id = v.document_id
      join public.document_requests r on r.id = d.request_id
    where v.id = version_id and v.upload_state = 'SUBMITTED'
      and d.classification = 'PERSONNEL_PRIVATE'
      and r.requester_person_id = assignee
      and private.document_can_read_request(r.id)
      and (
        (private.has_active_role('OFFICE_ADMIN') and private.current_person_id() = assignee)
        or private.has_active_role('SUPER_ADMIN')
      )
  )
$$;
revoke all on function private.task_source_readable(uuid,uuid) from public, anon, authenticated;
grant execute on function private.task_source_readable(uuid,uuid) to authenticated;
create policy tasks_read on public.tasks for select to authenticated using (
  task_type = 'DOCUMENT_REVIEW' and source_kind = 'DOCUMENT_VERSION'
  and (select private.task_source_readable(source_id,assignee_person_id))
);

create function private.guard_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare expected_assignee uuid; source_submitted boolean; matching_review uuid;
begin
  if tg_op = 'DELETE' then raise exception 'Tasks cannot be deleted'; end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.task_type is distinct from old.task_type
    or new.title is distinct from old.title or new.assignee_person_id is distinct from old.assignee_person_id
    or new.source_kind is distinct from old.source_kind or new.source_id is distinct from old.source_id
    or new.created_at is distinct from old.created_at or old.state <> 'OPEN'
    or new.state <> 'DONE' or new.updated_at is distinct from new.completed_at
  ) then raise exception 'Task identity or state is immutable'; end if;
  if tg_op = 'INSERT' and (new.state <> 'OPEN' or new.completion_event_id is not null
    or new.completion_kind is not null or new.completed_at is not null) then
    raise exception 'Task insertion denied'; end if;
  select r.requester_person_id, (v.upload_state = 'SUBMITTED')
    into expected_assignee, source_submitted
    from public.document_versions v
      join public.documents d on d.id = v.document_id
      join public.document_requests r on r.id = d.request_id
    where v.id = new.source_id and d.classification = 'PERSONNEL_PRIVATE';
  if new.task_type <> 'DOCUMENT_REVIEW' or new.source_kind <> 'DOCUMENT_VERSION'
    or expected_assignee is null or expected_assignee <> new.assignee_person_id
    or source_submitted is not true then raise exception 'Task source denied'; end if;
  if tg_op = 'UPDATE' then
    select rev.id into matching_review from public.document_reviews rev
      where rev.id = new.completion_event_id and rev.version_id = new.source_id;
    if new.completion_kind <> 'DOCUMENT_REVIEW_DECISION' or matching_review is null
      or new.completed_at is null then raise exception 'Task completion denied'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_task() from public, anon, authenticated;
create trigger guard_task_change before insert or update or delete on public.tasks
  for each row execute function private.guard_task();

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check
  check (entity_type in ('role_assignment','site_assignment','site','document_request','document_version','document_review','task'));
alter table public.audit_events drop constraint audit_events_target_check;
alter table public.audit_events add constraint audit_events_target_check check (
  (entity_type = 'site' and site_id is not null) or
  (entity_type = 'site_assignment' and site_id is not null and affected_person_id is not null) or
  (entity_type = 'role_assignment' and affected_person_id is not null) or
  (entity_type in ('document_request','document_version','document_review','task') and affected_person_id is not null)
);

-- Shared idempotent source adapter. This function is unexposed and executable only by triggers/owner.
create function private.ensure_document_review_task(version_id uuid, initiating_person uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v public.document_versions%rowtype; r public.document_requests%rowtype;
  existing_task public.tasks%rowtype; created_id uuid;
begin
  select * into v from public.document_versions where id = version_id;
  if not found or v.upload_state <> 'SUBMITTED' then raise exception 'Task source not submitted'; end if;
  select r0.* into r from public.documents d
    join public.document_requests r0 on r0.id = d.request_id
    where d.id = v.document_id and d.classification = 'PERSONNEL_PRIVATE';
  if not found then raise exception 'Task source denied'; end if;
  insert into public.tasks(task_type,title,assignee_person_id,source_kind,source_id)
    values ('DOCUMENT_REVIEW','Review submitted personnel evidence',r.requester_person_id,'DOCUMENT_VERSION',version_id)
    on conflict (source_kind,source_id) do nothing returning id into created_id;
  select * into existing_task from public.tasks where source_kind = 'DOCUMENT_VERSION' and source_id = version_id;
  if not found or existing_task.task_type <> 'DOCUMENT_REVIEW'
    or existing_task.assignee_person_id <> r.requester_person_id then raise exception 'Task source conflict'; end if;
  if created_id is not null then
    insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
      values (initiating_person,r.requester_person_id,'task',created_id,'INSERT',
        jsonb_build_object('source_kind','DOCUMENT_VERSION','source_id',version_id,'state','OPEN','automatic',true));
  end if;
  return existing_task.id;
end;
$$;
revoke all on function private.ensure_document_review_task(uuid,uuid) from public, anon, authenticated;

create function private.task_after_document_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.upload_state <> 'SUBMITTED' and new.upload_state = 'SUBMITTED' then
    if private.current_person_id() is distinct from new.uploader_person_id then
      raise exception 'Task submission actor denied'; end if;
    perform private.ensure_document_review_task(new.id,private.current_person_id());
  end if;
  return new;
end;
$$;
revoke all on function private.task_after_document_submission() from public, anon, authenticated;
create trigger create_task_on_document_submission after update of upload_state on public.document_versions
  for each row when (old.upload_state is distinct from new.upload_state and new.upload_state = 'SUBMITTED')
  execute function private.task_after_document_submission();

create function private.resolve_reconciled_document_review_task(task_id uuid, review_id uuid, reviewer_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare current_task public.tasks%rowtype; review_row public.document_reviews%rowtype; resolved_at timestamptz;
begin
  select * into current_task from public.tasks where id = task_id for update;
  select * into review_row from public.document_reviews where id = review_id;
  if not found or current_task.id is null or review_row.version_id <> current_task.source_id
    or review_row.reviewer_person_id <> reviewer_id then raise exception 'Task completion source denied'; end if;
  if current_task.state = 'DONE' then
    if current_task.completion_event_id <> review_id then raise exception 'Task completion conflict'; end if;
    return;
  end if;
  resolved_at := now();
  update public.tasks set state = 'DONE', completion_kind = 'DOCUMENT_REVIEW_DECISION',
    completion_event_id = review_id, completed_at = resolved_at, updated_at = resolved_at where id = task_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values (reviewer_id,current_task.assignee_person_id,'task',task_id,'UPDATE',
      jsonb_build_object('source_kind','DOCUMENT_VERSION','source_id',current_task.source_id,
        'state','DONE','completion_event_id',review_id,'automatic',true));
end;
$$;
revoke all on function private.resolve_reconciled_document_review_task(uuid,uuid,uuid) from public, anon, authenticated;

create function private.task_after_document_review() returns trigger
language plpgsql security definer set search_path = '' as $$
declare task_id uuid;
begin
  task_id := private.ensure_document_review_task(new.version_id,new.reviewer_person_id);
  perform private.resolve_reconciled_document_review_task(task_id,new.id,new.reviewer_person_id);
  return new;
end;
$$;
revoke all on function private.task_after_document_review() from public, anon, authenticated;
create trigger complete_task_on_document_review after insert on public.document_reviews
  for each row execute function private.task_after_document_review();

-- Owner-only bounded reconciliation, never a blanket historical backfill.
create function private.reconcile_document_review_task(version_id uuid) returns uuid
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
  select * into review_row from public.document_reviews where version_id = version_id;
  if review_row.id is null and latest_version <> version_id then
    raise exception 'Older undecided version requires investigation'; end if;
  task_id := private.ensure_document_review_task(version_id,v.uploader_person_id);
  if review_row.id is not null then
    perform private.resolve_reconciled_document_review_task(task_id,review_row.id,review_row.reviewer_person_id);
  end if;
  return task_id;
end;
$$;
revoke all on function private.reconcile_document_review_task(uuid) from public, anon, authenticated;
