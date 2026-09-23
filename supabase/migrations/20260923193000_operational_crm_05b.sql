-- TASK-05B: additive CRM activity and an explicit CRM branch in the shared Task system.
-- Existing document-review operations retain their trigger and source semantics.
create table public.crm_activities (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.crm_organisations(id),
 opportunity_id uuid references public.crm_opportunities(id),
 contact_id uuid references public.crm_contacts(id),
 activity_type text not null check (activity_type in ('PHONE_CALL','EMAIL','MEETING','NOTE','TENDER_UPDATE','PROPOSAL_SENT','FOLLOW_UP')),
 subject text not null check (length(trim(subject)) between 1 and 160 and subject !~ '[[:cntrl:]]'),
 summary text check (summary is null or (length(summary) <= 1000 and summary !~ '[[:cntrl:]]')),
 corrects_activity_id uuid references public.crm_activities(id),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default transaction_timestamp(),
 check (corrects_activity_id is null or corrects_activity_id <> id)
);
create index crm_activities_org_at_idx on public.crm_activities(organisation_id, occurred_at desc,id);
create index crm_activities_opp_at_idx on public.crm_activities(opportunity_id, occurred_at desc,id);
alter table public.crm_activities enable row level security;
revoke all on public.crm_activities from public,anon,authenticated;
grant select on public.crm_activities to authenticated;
create policy crm_activity_read on public.crm_activities for select to authenticated using (private.crm_authorised());

create function private.guard_crm_activity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'CRM activity history is immutable'; end if;
 if not private.crm_authorised() or new.actor_person_id is distinct from private.current_person_id()
   or new.occurred_at is distinct from transaction_timestamp()
   or not exists(select 1 from public.crm_organisations where id=new.organisation_id)
   or (new.opportunity_id is not null and not exists(select 1 from public.crm_opportunities
       where id=new.opportunity_id and organisation_id=new.organisation_id))
   or (new.contact_id is not null and not exists(select 1 from public.crm_contacts
       where id=new.contact_id and organisation_id=new.organisation_id))
   or (new.corrects_activity_id is not null and not exists(select 1 from public.crm_activities
       where id=new.corrects_activity_id and organisation_id=new.organisation_id))
 then raise exception 'CRM activity denied'; end if;
 return new;
end $$;
revoke all on function private.guard_crm_activity() from public,anon,authenticated;
create trigger guard_crm_activity before insert or update or delete on public.crm_activities
 for each row execute function private.guard_crm_activity();

create function public.crm_record_activity(p_organisation uuid,p_opportunity uuid,p_contact uuid,
 p_type text,p_subject text,p_summary text default null,p_corrects uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; actor uuid:=private.current_person_id();
begin
 if not private.crm_authorised() then raise exception 'CRM action denied'; end if;
 insert into public.crm_activities(organisation_id,opportunity_id,contact_id,activity_type,subject,summary,
   corrects_activity_id,actor_person_id,occurred_at)
 values(p_organisation,p_opportunity,p_contact,p_type,trim(p_subject),nullif(trim(p_summary),''),
   p_corrects,actor,transaction_timestamp()) returning id into result;
 perform private.crm_audit('crm_activity',result,'INSERT',array['activity_type','subject','summary']);
 return result;
end $$;
revoke all on function public.crm_record_activity(uuid,uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.crm_record_activity(uuid,uuid,uuid,text,text,text,uuid) to authenticated;

-- Preserve the document-only trigger verbatim by restricting its firing to document rows.
drop trigger guard_task_change on public.tasks;
create trigger guard_task_change_document_insert before insert on public.tasks for each row
 when (new.task_type='DOCUMENT_REVIEW') execute function private.guard_task();
create trigger guard_task_change_document_update before update on public.tasks for each row
 when (old.task_type='DOCUMENT_REVIEW') execute function private.guard_task();
create trigger guard_task_change_document_delete before delete on public.tasks for each row
 when (old.task_type='DOCUMENT_REVIEW') execute function private.guard_task();

alter table public.tasks add column created_by_person_id uuid references public.people(id);
alter table public.tasks add column due_at timestamptz;
alter table public.tasks add column crm_cancellation_reason text;
alter table public.tasks drop constraint tasks_task_type_check;
alter table public.tasks add constraint tasks_task_type_check check (task_type in ('DOCUMENT_REVIEW','CRM_FOLLOW_UP'));
alter table public.tasks drop constraint tasks_title_check;
alter table public.tasks add constraint tasks_title_check check (
 (task_type='DOCUMENT_REVIEW' and title='Review submitted personnel evidence') or
 (task_type='CRM_FOLLOW_UP' and length(trim(title)) between 1 and 160 and title !~ '[[:cntrl:]]'));
alter table public.tasks drop constraint tasks_source_kind_check;
alter table public.tasks add constraint tasks_source_kind_check check (
 (task_type='DOCUMENT_REVIEW' and source_kind='DOCUMENT_VERSION') or
 (task_type='CRM_FOLLOW_UP' and source_kind in ('CRM_OPPORTUNITY','CRM_ORGANISATION')));
alter table public.tasks drop constraint tasks_source_kind_source_id_key;
create unique index tasks_document_source_unique on public.tasks(source_id) where source_kind='DOCUMENT_VERSION';
alter table public.tasks drop constraint tasks_completion_kind_check;
alter table public.tasks add constraint tasks_completion_kind_check check (completion_kind in ('DOCUMENT_REVIEW_DECISION','CRM_MANUAL_COMPLETION'));
alter table public.tasks drop constraint tasks_check;
alter table public.tasks add constraint tasks_check check (
 (task_type='DOCUMENT_REVIEW' and created_by_person_id is null and due_at is null and crm_cancellation_reason is null and (
   (state='OPEN' and completed_at is null and completion_kind is null and completion_event_id is null
     and cancelled_at is null and cancellation_case_id is null and cancellation_reason is null) or
   (state='DONE' and completed_at is not null and completion_kind='DOCUMENT_REVIEW_DECISION'
     and completion_event_id is not null and cancelled_at is null and cancellation_case_id is null and cancellation_reason is null) or
   (state='CANCELLED' and completed_at is null and completion_kind is null and completion_event_id is null
     and cancelled_at is not null and cancellation_case_id is not null and cancellation_reason='ONBOARDING_CASE_CANCELLED')))
 or (task_type='CRM_FOLLOW_UP' and created_by_person_id is not null and cancellation_case_id is null
   and cancellation_reason is null and (
   (state='OPEN' and completed_at is null and completion_kind is null and completion_event_id is null
     and cancelled_at is null and crm_cancellation_reason is null) or
   (state='DONE' and completed_at is not null and completion_kind='CRM_MANUAL_COMPLETION'
     and completion_event_id is not null and cancelled_at is null and crm_cancellation_reason is null) or
   (state='CANCELLED' and completed_at is null and completion_kind is null and completion_event_id is null
     and cancelled_at is not null and length(trim(crm_cancellation_reason)) between 3 and 300))));
create index tasks_crm_source_idx on public.tasks(source_kind,source_id,state,due_at,id)
 where task_type='CRM_FOLLOW_UP';
create index tasks_crm_due_idx on public.tasks(due_at,id) where task_type='CRM_FOLLOW_UP' and state='OPEN';

create table public.crm_task_events (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id) deferrable initially deferred,
 event_kind text not null check (event_kind in ('CREATE','REASSIGN','RESCHEDULE','COMPLETE','CANCEL')),
 old_assignee_person_id uuid references public.people(id),
 new_assignee_person_id uuid references public.people(id),
 old_due_at timestamptz,
 new_due_at timestamptz,
 reason text check (reason is null or (length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]')),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default transaction_timestamp(),
 transaction_id bigint not null default txid_current(),
 check ((event_kind in ('REASSIGN','RESCHEDULE','CANCEL') and reason is not null) or event_kind not in ('REASSIGN','RESCHEDULE','CANCEL')),
 check (event_kind<>'REASSIGN' or (old_assignee_person_id is distinct from new_assignee_person_id
   and old_assignee_person_id is not null and new_assignee_person_id is not null)),
 check (event_kind<>'RESCHEDULE' or old_due_at is distinct from new_due_at)
);
create index crm_task_events_task_at_idx on public.crm_task_events(task_id,occurred_at desc,id);
alter table public.crm_task_events enable row level security;
revoke all on public.crm_task_events from public,anon,authenticated;
grant select on public.crm_task_events to authenticated;
create policy crm_task_events_read on public.crm_task_events for select to authenticated using (private.crm_authorised());
create function private.guard_crm_task_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'CRM Task history is immutable'; end if;
 if not private.crm_authorised() or new.actor_person_id is distinct from private.current_person_id()
   or new.occurred_at is distinct from transaction_timestamp() or new.transaction_id<>txid_current()
 then raise exception 'CRM Task history denied'; end if;
 return new;
end $$;
revoke all on function private.guard_crm_task_event() from public,anon,authenticated;
create trigger guard_crm_task_event before insert or update or delete on public.crm_task_events
 for each row execute function private.guard_crm_task_event();

create policy tasks_crm_read on public.tasks for select to authenticated using (
 task_type='CRM_FOLLOW_UP' and private.crm_authorised()
 and ((source_kind='CRM_OPPORTUNITY' and exists(select 1 from public.crm_opportunities where id=source_id))
   or (source_kind='CRM_ORGANISATION' and exists(select 1 from public.crm_organisations where id=source_id))));

create function private.guard_crm_task() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.crm_task_events%rowtype; actor uuid:=private.current_person_id();
begin
 if tg_op='DELETE' then raise exception 'CRM Tasks cannot be deleted'; end if;
 if not private.crm_authorised() or new.task_type<>'CRM_FOLLOW_UP'
   or (new.source_kind='CRM_OPPORTUNITY' and not exists(select 1 from public.crm_opportunities where id=new.source_id))
   or (new.source_kind='CRM_ORGANISATION' and not exists(select 1 from public.crm_organisations where id=new.source_id))
 then raise exception 'CRM Task denied'; end if;
 if tg_op='UPDATE' and (old.task_type<>'CRM_FOLLOW_UP' or old.state<>'OPEN'
   or new.id is distinct from old.id or new.source_kind is distinct from old.source_kind
   or new.source_id is distinct from old.source_id or new.created_at is distinct from old.created_at
   or new.title is distinct from old.title or new.created_by_person_id is distinct from old.created_by_person_id)
 then raise exception 'CRM Task identity is immutable'; end if;
 select * into e from public.crm_task_events x where x.task_id=new.id
   and x.transaction_id=txid_current() and x.actor_person_id=actor
   and x.occurred_at=transaction_timestamp()
   and x.event_kind=case when tg_op='INSERT' then 'CREATE'
     when new.state='DONE' then 'COMPLETE' when new.state='CANCELLED' then 'CANCEL'
     when new.assignee_person_id is distinct from old.assignee_person_id then 'REASSIGN'
     else 'RESCHEDULE' end
   order by x.occurred_at desc,x.id desc limit 1;
 if e.id is null then raise exception 'CRM Task history required'; end if;
 if tg_op='INSERT' then
   if new.state<>'OPEN' or new.created_by_person_id<>actor or new.created_at<>transaction_timestamp()
     or new.updated_at<>transaction_timestamp() or e.new_assignee_person_id<>new.assignee_person_id
     or e.new_due_at is distinct from new.due_at or not private.crm_owner_eligible(new.assignee_person_id)
   then raise exception 'CRM Task creation denied'; end if;
 else
   if new.updated_at<>transaction_timestamp() or e.old_assignee_person_id is distinct from old.assignee_person_id
     or e.new_assignee_person_id is distinct from new.assignee_person_id
     or e.old_due_at is distinct from old.due_at or e.new_due_at is distinct from new.due_at
   then raise exception 'CRM Task transition denied'; end if;
   if new.state='OPEN' and new.assignee_person_id is distinct from old.assignee_person_id then
     if new.due_at is distinct from old.due_at or not private.crm_owner_eligible(new.assignee_person_id)
       or e.reason is null then raise exception 'CRM Task reassignment denied'; end if;
   elsif new.state='OPEN' and new.due_at is distinct from old.due_at then
     if new.assignee_person_id<>old.assignee_person_id then raise exception 'CRM Task reschedule denied'; end if;
   elsif new.state='DONE' then
     if actor<>old.assignee_person_id or new.assignee_person_id<>old.assignee_person_id
       or new.due_at is distinct from old.due_at or new.completed_at<>transaction_timestamp()
       or new.completion_kind<>'CRM_MANUAL_COMPLETION' or new.completion_event_id<>e.id
     then raise exception 'CRM Task completion denied'; end if;
   elsif new.state='CANCELLED' then
     if actor<>old.assignee_person_id and not private.has_active_role('SUPER_ADMIN')
       or new.assignee_person_id<>old.assignee_person_id or new.due_at is distinct from old.due_at
       or new.cancelled_at<>transaction_timestamp() or new.crm_cancellation_reason is distinct from e.reason
     then raise exception 'CRM Task cancellation denied'; end if;
   else raise exception 'CRM Task transition denied'; end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_crm_task() from public,anon,authenticated;
create trigger guard_task_change_crm_insert before insert on public.tasks for each row
 when (new.task_type='CRM_FOLLOW_UP') execute function private.guard_crm_task();
create trigger guard_task_change_crm_update before update on public.tasks for each row
 when (old.task_type='CRM_FOLLOW_UP' or new.task_type='CRM_FOLLOW_UP') execute function private.guard_crm_task();
create trigger guard_task_change_crm_delete before delete on public.tasks for each row
 when (old.task_type='CRM_FOLLOW_UP') execute function private.guard_crm_task();

create function public.crm_create_follow_up(p_source_kind text,p_source_id uuid,p_title text,
 p_assignee uuid,p_due_at timestamptz default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid:=gen_random_uuid(); actor uuid:=private.current_person_id(); at_time timestamptz:=transaction_timestamp();
begin
 if not private.crm_authorised() or p_source_kind not in ('CRM_OPPORTUNITY','CRM_ORGANISATION')
   or not private.crm_owner_eligible(p_assignee) then raise exception 'CRM Task denied'; end if;
 insert into public.crm_task_events(task_id,event_kind,new_assignee_person_id,new_due_at,actor_person_id,occurred_at)
 values(result,'CREATE',p_assignee,p_due_at,actor,at_time);
 insert into public.tasks(id,task_type,title,assignee_person_id,source_kind,source_id,
   created_by_person_id,due_at,created_at,updated_at)
 values(result,'CRM_FOLLOW_UP',trim(p_title),p_assignee,p_source_kind,p_source_id,actor,p_due_at,at_time,at_time);
 perform private.crm_audit('task',result,'INSERT',array['source_kind','source_id','assignee_person_id','due_at']);
 return result;
end $$;

create function public.crm_change_follow_up(p_id uuid,p_action text,p_assignee uuid default null,
 p_due_at timestamptz default null,p_reason text default null) returns void
language plpgsql security definer set search_path='' as $$
declare t public.tasks%rowtype; actor uuid:=private.current_person_id(); at_time timestamptz:=transaction_timestamp();
 event_id uuid;
begin
 if not private.crm_authorised() then raise exception 'CRM Task denied'; end if;
 select * into t from public.tasks where id=p_id and task_type='CRM_FOLLOW_UP' for update;
 if t.id is null or t.state<>'OPEN' then raise exception 'CRM Task denied'; end if;
 if p_action='REASSIGN' then
   if p_assignee is null or p_assignee=t.assignee_person_id or not private.crm_owner_eligible(p_assignee)
     or length(trim(coalesce(p_reason,'')))<3 then raise exception 'CRM Task reassignment denied'; end if;
 elsif p_action='RESCHEDULE' then
   if p_due_at is not distinct from t.due_at or length(trim(coalesce(p_reason,'')))<3
     then raise exception 'CRM Task reschedule denied'; end if;
 elsif p_action='COMPLETE' then
   if actor<>t.assignee_person_id then raise exception 'CRM Task completion denied'; end if;
 elsif p_action='CANCEL' then
   if (actor<>t.assignee_person_id and not private.has_active_role('SUPER_ADMIN'))
     or length(trim(coalesce(p_reason,'')))<3 then raise exception 'CRM Task cancellation denied'; end if;
 else raise exception 'CRM Task action denied'; end if;
 insert into public.crm_task_events(task_id,event_kind,old_assignee_person_id,new_assignee_person_id,
   old_due_at,new_due_at,reason,actor_person_id,occurred_at)
 values(t.id,p_action,t.assignee_person_id,case when p_action='REASSIGN' then p_assignee else t.assignee_person_id end,
   t.due_at,case when p_action='RESCHEDULE' then p_due_at else t.due_at end,
   case when p_action in ('REASSIGN','CANCEL','RESCHEDULE') then nullif(trim(p_reason),'') else null end,actor,at_time)
 returning id into event_id;
 if p_action='REASSIGN' then
   update public.tasks set assignee_person_id=p_assignee,updated_at=at_time where id=t.id;
 elsif p_action='RESCHEDULE' then
   update public.tasks set due_at=p_due_at,updated_at=at_time where id=t.id;
 elsif p_action='COMPLETE' then
   update public.tasks set state='DONE',completed_at=at_time,completion_kind='CRM_MANUAL_COMPLETION',
     completion_event_id=event_id,updated_at=at_time where id=t.id;
 else
   update public.tasks set state='CANCELLED',cancelled_at=at_time,crm_cancellation_reason=trim(p_reason),
     updated_at=at_time where id=t.id;
 end if;
 perform private.crm_audit('task',t.id,'UPDATE',array['state','assignee_person_id','due_at']);
end $$;
revoke all on function public.crm_create_follow_up(text,uuid,text,uuid,timestamptz),
 public.crm_change_follow_up(uuid,text,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.crm_create_follow_up(text,uuid,text,uuid,timestamptz),
 public.crm_change_follow_up(uuid,text,uuid,timestamptz,text) to authenticated;

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
 'role_assignment','site_assignment','site','document_request','document_version','document_review','task',
 'onboarding_case','onboarding_requirement','onboarding_verification','person_profile','profile_submission',
 'sia_credential','sia_submission','controlled_publisher_grant','controlled_document','controlled_version',
 'controlled_publication','controlled_assignment','controlled_access','controlled_acknowledgement',
 'onboarding_team','onboarding_team_membership','onboarding_cover','onboarding_owner_change','task_assignment',
 'crm_organisation','crm_contact','crm_opportunity','crm_opportunity_event','crm_relationship_event',
 'crm_activity'));
