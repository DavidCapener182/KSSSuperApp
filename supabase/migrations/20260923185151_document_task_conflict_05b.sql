-- TASK-05B forward correction: document idempotence now targets the exact
-- partial unique index retained for DocumentVersion sources. No CRM conflict
-- target is introduced; several CRM follow-ups may share one source.
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
    on conflict(source_id) where source_kind='DOCUMENT_VERSION' do nothing returning id into created_id;
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
