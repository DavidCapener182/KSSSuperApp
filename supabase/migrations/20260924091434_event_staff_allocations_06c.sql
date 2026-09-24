-- TASK-06C: synthetic-only allocation and Staff response. No attendance, availability or pay.
create table public.operational_role_check_policies (
 id uuid primary key default gen_random_uuid(),
 role_id uuid not null references public.operational_role_definitions(id),
 version integer not null check (version>0),
 rule_code text not null check (rule_code='SYNTHETIC_SIA_SECURITY_GUARDING'),
 development_only boolean not null default true check (development_only),
 enabled boolean not null default false,
 created_at timestamptz not null default transaction_timestamp(),
 unique(role_id,version)
);
insert into public.operational_role_check_policies(role_id,version,rule_code)
 select id,1,'SYNTHETIC_SIA_SECURITY_GUARDING' from public.operational_role_definitions where code='SIA';
-- The source migration leaves this rule disabled. A guarded Dev-only seed enables it on the exact Dev project.

create table public.event_staff_allocations (
 id uuid primary key default gen_random_uuid(),
 requirement_id uuid not null references public.event_staffing_requirements(id),
 person_id uuid not null references public.people(id),
 status text not null default 'ALLOCATED' check (status in ('ALLOCATED','ACCEPTED','DECLINED','CANCELLED')),
 requirement_revision_at_allocation integer not null check (requirement_revision_at_allocation>0),
 allocated_by_person_id uuid not null references public.people(id),
 allocated_at timestamptz not null default transaction_timestamp(),
 responded_at timestamptz,
 cancelled_at timestamptz,
 updated_at timestamptz not null default transaction_timestamp(),
 revision integer not null default 1 check (revision>0),
 check ((status='ALLOCATED' and responded_at is null and cancelled_at is null)
  or (status in ('ACCEPTED','DECLINED') and responded_at is not null and cancelled_at is null)
  or (status='CANCELLED' and cancelled_at is not null)),
 unique(id,requirement_id)
);
create unique index event_staff_active_person_requirement_idx on public.event_staff_allocations(requirement_id,person_id)
 where status in ('ALLOCATED','ACCEPTED');
create index event_staff_requirement_status_idx on public.event_staff_allocations(requirement_id,status,id);
create index event_staff_person_status_idx on public.event_staff_allocations(person_id,status,id);

create table public.event_staff_allocation_events (
 id uuid primary key default gen_random_uuid(),
 allocation_id uuid not null,
 requirement_id uuid not null,
 person_id uuid not null references public.people(id),
 kind text not null check (kind in ('ALLOCATED','ACCEPTED','DECLINED','CANCELLED','EVENT_CANCELLED')),
 old_status text check (old_status is null or old_status in ('ALLOCATED','ACCEPTED')),
 new_status text not null check (new_status in ('ALLOCATED','ACCEPTED','DECLINED','CANCELLED')),
 old_revision integer,
 new_revision integer not null check (new_revision>0),
 requirement_revision_at_allocation integer not null,
 actor_person_id uuid not null references public.people(id),
 reason_code text check (reason_code is null or reason_code in ('CANNOT_ATTEND','TIMING_CONFLICT','OTHER')),
 reason text check (reason is null or (length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]')),
 occurred_at timestamptz not null default transaction_timestamp(),
 foreign key(allocation_id,requirement_id) references public.event_staff_allocations(id,requirement_id),
 unique(allocation_id,new_revision)
);
create index event_staff_allocation_history_idx on public.event_staff_allocation_events(allocation_id,new_revision desc);

alter table public.operational_role_check_policies enable row level security;
alter table public.event_staff_allocations enable row level security;
alter table public.event_staff_allocation_events enable row level security;
revoke all on public.operational_role_check_policies,public.event_staff_allocations,public.event_staff_allocation_events from public,anon,authenticated;

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
 'role_assignment','site_assignment','site','document_request','document_version','document_review','task',
 'onboarding_case','onboarding_requirement','onboarding_verification','person_profile','profile_submission',
 'sia_credential','sia_submission','controlled_publisher_grant','controlled_document','controlled_version',
 'controlled_publication','controlled_assignment','controlled_access','controlled_acknowledgement',
 'onboarding_team','onboarding_team_membership','onboarding_cover','onboarding_owner_change','task_assignment',
 'crm_organisation','crm_contact','crm_opportunity','crm_opportunity_event','crm_relationship_event',
 'crm_organisation_owner_event','crm_activity','crm_follow_up','crm_task_event',
 'site_client_link','operational_event','operational_event_event','operational_role','event_staffing_requirement',
 'event_staff_allocation','event_staff_allocation_event'));

create function private.guard_allocations_06c() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_06c',true) is distinct from 'allowed' then raise exception 'Allocation direct write denied'; end if;
 if tg_op='DELETE' then raise exception 'Allocation history cannot be deleted'; end if;
 if tg_table_name='event_staff_allocation_events' and tg_op='UPDATE' then raise exception 'Allocation history is immutable'; end if;
 if tg_table_name='event_staff_allocations' and tg_op='UPDATE' and
   (new.id is distinct from old.id or new.requirement_id is distinct from old.requirement_id or
    new.person_id is distinct from old.person_id or new.requirement_revision_at_allocation is distinct from old.requirement_revision_at_allocation or
    new.allocated_by_person_id is distinct from old.allocated_by_person_id or new.allocated_at is distinct from old.allocated_at or
    new.revision<>old.revision+1 or old.status in ('DECLINED','CANCELLED')) then
   raise exception 'Allocation identity/history cannot be changed'; end if;
 return new;
end $$;
revoke all on function private.guard_allocations_06c() from public,anon,authenticated;
create trigger guard_event_staff_allocations before insert or update or delete on public.event_staff_allocations
 for each row execute function private.guard_allocations_06c();
create trigger guard_event_staff_allocation_events before insert or update or delete on public.event_staff_allocation_events
 for each row execute function private.guard_allocations_06c();

-- Reuse the accepted exact synthetic SIA evidence and verification chain without returning protected rows.
create function private.synthetic_sia_check_06c(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from public.person_sia_credentials current_credential
  join public.person_sia_credential_revisions sr on sr.credential_id=current_credential.id
   and sr.person_id=target and sr.category='SECURITY_GUARDING'
   and sr.credential_change_seq=current_credential.credential_change_seq
   and sr.synthetic_reference=current_credential.synthetic_reference
   and sr.expires_on=current_credential.expires_on
  join public.onboarding_sia_submissions s on s.revision_id=sr.id and s.person_id=target
  join public.onboarding_cases c on c.id=s.case_id and c.person_id=target and c.state='IN_PROGRESS'
  join public.onboarding_case_requirements cr on cr.id=s.requirement_id and cr.case_id=c.id
  join public.onboarding_requirement_definitions d on d.id=cr.definition_id
   and d.code='SIA_LICENCE' and d.expected_sia_category='SECURITY_GUARDING'
  join public.document_requests request on request.id=s.document_request_id and request.target_person_id=target
  join public.documents doc on doc.request_id=request.id and doc.owner_person_id=target and doc.classification='PERSONNEL_PRIVATE'
  join public.document_versions v on v.document_id=doc.id and v.upload_state='SUBMITTED'
  join public.document_reviews review on review.version_id=v.id and review.request_id=request.id
   and review.decision='ACCEPTED_AS_EVIDENCE'
  join public.onboarding_requirement_verifications ov on ov.requirement_id=cr.id and ov.case_id=c.id
   and ov.target_person_id=target and ov.sia_submission_id=s.id and ov.evidence_version_id=v.id and ov.decision='VERIFIED'
  where current_credential.person_id=target and current_credential.category='SECURITY_GUARDING'
   and sr.expires_on>=private.uk_today() and (ov.synthetic_valid_until is null or ov.synthetic_valid_until>now())
   and not exists(select 1 from public.onboarding_sia_submissions newer where newer.requirement_id=cr.id
     and (newer.submitted_at,newer.id)>(s.submitted_at,s.id))
   and not exists(select 1 from public.document_versions later where later.document_id=doc.id
     and later.upload_state='SUBMITTED' and later.version_number>v.version_number)
 )
$$;
revoke all on function private.synthetic_sia_check_06c(uuid) from public,anon,authenticated;

create function private.candidate_check_06c(p_requirement uuid,p_person uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare req public.event_staffing_requirements%rowtype; ev public.operational_events%rowtype;
 role_code text; has_staff boolean; has_clash boolean; check_enabled boolean; passed boolean;
 result_code text; reasons text[]:=array['AVAILABILITY_NOT_RECORDED'];
begin
 select * into req from public.event_staffing_requirements where id=p_requirement;
 select * into ev from public.operational_events where id=req.event_id;
 select code into role_code from public.operational_role_definitions where id=req.role_id;
 has_staff:=exists(select 1 from public.people p join public.role_assignments ra on ra.person_id=p.id
   where p.id=p_person and ra.role_code='SECURITY_STAFF' and ra.revoked_at is null
   and ra.effective_from<=now() and (ra.effective_until is null or ra.effective_until>now()));
 has_clash:=exists(select 1 from public.event_staff_allocations a
   join public.event_staffing_requirements other on other.id=a.requirement_id
   where a.person_id=p_person and a.status in ('ALLOCATED','ACCEPTED')
   and req.report_at<other.shift_ends_at and other.report_at<req.shift_ends_at);
 if not has_staff then reasons:=array_append(reasons,'ACTIVE_SECURITY_STAFF_ROLE_REQUIRED'); end if;
 if has_clash then reasons:=array_append(reasons,'RECORDED_ALLOCATION_CLASH'); end if;
 if req.id is null or req.state<>'PLANNED' or ev.status not in ('PLANNING','CONFIRMED','LIVE') then
   reasons:=array_append(reasons,'REQUIREMENT_NOT_ACTIVE'); end if;
 if not has_staff or has_clash or req.id is null or req.state<>'PLANNED' or ev.status not in ('PLANNING','CONFIRMED','LIVE') then
   result_code:='BLOCKED';
 elsif role_code='SIA' then
   select exists(select 1 from public.operational_role_check_policies p where p.role_id=req.role_id
     and p.rule_code='SYNTHETIC_SIA_SECURITY_GUARDING' and p.development_only and p.enabled)
     into check_enabled;
   if not check_enabled then result_code:='BLOCKED';reasons:=array_append(reasons,'SIA_SYNTHETIC_RULE_DISABLED');
   else
     passed:=private.synthetic_sia_check_06c(p_person);
     if passed then result_code:='SYNTHETIC_CHECKS_PASSED_WITH_WARNINGS';
       reasons:=array_append(reasons,'SYNTHETIC_SIA_CHECK_SATISFIED');
     else result_code:='BLOCKED';reasons:=array_append(reasons,'SYNTHETIC_SIA_CHECK_NOT_SATISFIED'); end if;
   end if;
 else
   result_code:='REVIEW_REQUIRED';reasons:=array_append(reasons,'ROLE_QUALIFICATION_RULE_NOT_CONFIGURED');
 end if;
 return jsonb_build_object('result',result_code,'reasons',reasons,'policy_version',case when role_code='SIA' then 1 else null end);
end $$;
revoke all on function private.candidate_check_06c(uuid,uuid) from public,anon,authenticated;

create function public.deployment_candidates(p_event uuid,p_requirement uuid,p_search text default '',p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_search is null or length(p_search)>80 or p_search ~ '[[:cntrl:]]'
  or p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50 or
  not exists(select 1 from public.event_staffing_requirements where id=p_requirement and event_id=p_event)
 then raise exception 'Candidate search denied'; end if;
 with scoped as materialized (
  select p.id,p.display_name from public.people p where exists(select 1 from public.role_assignments ra
   where ra.person_id=p.id and ra.role_code='SECURITY_STAFF' and ra.revoked_at is null and ra.effective_from<=now()
    and (ra.effective_until is null or ra.effective_until>now()))
   and (trim(p_search)='' or position(lower(trim(p_search)) in lower(p.display_name))>0)
 ), page as (select * from scoped order by lower(display_name),id offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,
   'role','SECURITY_STAFF','check',private.candidate_check_06c(p_requirement,p.id))
   order by lower(p.display_name),p.id) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.deployment_candidates(uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.deployment_candidates(uuid,uuid,text,integer,integer) to authenticated;

create function public.deployment_requirement(p_event uuid,p_requirement uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or not exists(select 1 from public.event_staffing_requirements
   where id=p_requirement and event_id=p_event) then raise exception 'Deployment read denied'; end if;
 select jsonb_build_object('required',r.required_quantity,
  'allocated',count(a.id) filter(where a.status in ('ALLOCATED','ACCEPTED')),
  'accepted',count(a.id) filter(where a.status='ACCEPTED'),
  'remaining',r.required_quantity-count(a.id) filter(where a.status in ('ALLOCATED','ACCEPTED')),
  'allocations',coalesce(jsonb_agg(jsonb_build_object('id',a.id,'person_id',a.person_id,'person_name',p.display_name,
   'status',a.status,'revision',a.revision,'allocated_at',a.allocated_at) order by a.allocated_at,a.id)
   filter(where a.id is not null),'[]'::jsonb)) into result
 from public.event_staffing_requirements r left join public.event_staff_allocations a on a.requirement_id=r.id
 left join public.people p on p.id=a.person_id where r.id=p_requirement group by r.id;
 return result;
end $$;
revoke all on function public.deployment_requirement(uuid,uuid) from public,anon,authenticated;
grant execute on function public.deployment_requirement(uuid,uuid) to authenticated;

create function public.deployment_allocate(p_event uuid,p_requirement uuid,p_person uuid,p_expected_revision integer,
 p_acknowledge_warnings boolean default false,p_reason text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); ev public.operational_events%rowtype;
 req public.event_staffing_requirements%rowtype; assessment jsonb; active_count integer; result uuid;
begin
 if actor is null or not private.operational_authorised() or p_person=actor then raise exception 'Allocation denied'; end if;
 select * into ev from public.operational_events where id=p_event for update;
 select * into req from public.event_staffing_requirements where id=p_requirement and event_id=p_event for update;
 if ev.id is null or ev.status not in ('PLANNING','CONFIRMED','LIVE') or req.id is null or req.state<>'PLANNED'
   or req.revision is distinct from p_expected_revision then raise exception 'Allocation denied'; end if;
 -- The Person row serialises overlapping allocations even when they target different Events/requirements.
 perform 1 from public.people where id=p_person for update;
 if not found then raise exception 'Allocation denied'; end if;
 select count(*) into active_count from public.event_staff_allocations where requirement_id=p_requirement and status in ('ALLOCATED','ACCEPTED');
 if active_count>=req.required_quantity then raise exception 'Requirement capacity reached'; end if;
 assessment:=private.candidate_check_06c(p_requirement,p_person);
 if assessment->>'result'='BLOCKED' then raise exception 'Candidate blocked'; end if;
 if assessment->>'result'='REVIEW_REQUIRED' and
   (p_acknowledge_warnings is distinct from true or p_reason is null or length(trim(p_reason)) not between 3 and 300
    or p_reason ~ '[[:cntrl:]]') then raise exception 'Warnings require acknowledgement and reason'; end if;
 perform set_config('kss.write_06c','allowed',true);
 insert into public.event_staff_allocations(requirement_id,person_id,requirement_revision_at_allocation,allocated_by_person_id)
 values(p_requirement,p_person,req.revision,actor) returning id into result;
 insert into public.event_staff_allocation_events(allocation_id,requirement_id,person_id,kind,new_status,new_revision,
  requirement_revision_at_allocation,actor_person_id,reason)
 values(result,p_requirement,p_person,'ALLOCATED','ALLOCATED',1,req.revision,actor,
  case when assessment->>'result'='REVIEW_REQUIRED' then trim(p_reason) else null end);
 perform private.crm_audit('event_staff_allocation',result,'INSERT',array['requirement_id','person_id','status']);
 return result;
end $$;
revoke all on function public.deployment_allocate(uuid,uuid,uuid,integer,boolean,text) from public,anon,authenticated;
grant execute on function public.deployment_allocate(uuid,uuid,uuid,integer,boolean,text) to authenticated;

create function public.deployment_cancel(p_event uuid,p_requirement uuid,p_allocation uuid,p_expected_revision integer,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); ev public.operational_events%rowtype;
 req public.event_staffing_requirements%rowtype; old public.event_staff_allocations%rowtype; next_revision integer;
begin
 if actor is null or not private.operational_authorised() or p_reason is null or length(trim(p_reason)) not between 3 and 300
  or p_reason ~ '[[:cntrl:]]' then raise exception 'Allocation cancellation denied'; end if;
 select * into ev from public.operational_events where id=p_event for update;
 select * into req from public.event_staffing_requirements where id=p_requirement and event_id=p_event for update;
 select * into old from public.event_staff_allocations where id=p_allocation and requirement_id=p_requirement for update;
 if ev.id is null or ev.status not in ('PLANNING','CONFIRMED','LIVE') or req.id is null or old.id is null
  or old.status not in ('ALLOCATED','ACCEPTED') or old.revision is distinct from p_expected_revision then
   raise exception 'Allocation cancellation denied'; end if;
 next_revision:=old.revision+1;
 perform set_config('kss.write_06c','allowed',true);
 update public.event_staff_allocations set status='CANCELLED',cancelled_at=transaction_timestamp(),
  updated_at=transaction_timestamp(),revision=next_revision where id=p_allocation;
 insert into public.event_staff_allocation_events(allocation_id,requirement_id,person_id,kind,old_status,new_status,
  old_revision,new_revision,requirement_revision_at_allocation,actor_person_id,reason)
 values(old.id,old.requirement_id,old.person_id,'CANCELLED',old.status,'CANCELLED',old.revision,next_revision,
  old.requirement_revision_at_allocation,actor,trim(p_reason));
 perform private.crm_audit('event_staff_allocation_event',old.id,'UPDATE',array['status','revision']);
 return next_revision;
end $$;
revoke all on function public.deployment_cancel(uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.deployment_cancel(uuid,uuid,uuid,integer,text) to authenticated;

create function public.my_deployments(p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_offset is null or p_offset<0 or p_offset>10000
   or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Deployment self read denied'; end if;
 with scoped as materialized (
  select a.id,a.status,a.revision,a.allocated_at,r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,
   r.area_label,o.display_name as role_name,e.name as event_name,e.status as event_status,s.name as site_name,
   s.reporting_point
  from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
  join public.operational_role_definitions o on o.id=r.role_id
  join public.operational_events e on e.id=r.event_id join public.sites s on s.id=e.site_id
  where a.person_id=actor
 ), page as (select * from scoped order by report_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),'items',coalesce((select jsonb_agg(to_jsonb(p)
  order by p.report_at desc,p.id desc) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.my_deployments(integer,integer) from public,anon,authenticated;
grant execute on function public.my_deployments(integer,integer) to authenticated;

create function public.deployment_respond(p_allocation uuid,p_expected_revision integer,p_response text,
 p_reason_code text default null,p_note text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); old public.event_staff_allocations%rowtype;
 req public.event_staffing_requirements%rowtype; ev public.operational_events%rowtype; next_revision integer;
 target_requirement uuid; target_event uuid;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_response is null or p_response not in ('ACCEPTED','DECLINED') or
  (p_response='ACCEPTED' and (p_reason_code is not null or p_note is not null)) or
  (p_response='DECLINED' and (p_reason_code is null or p_reason_code not in ('CANNOT_ATTEND','TIMING_CONFLICT','OTHER'))) or
  (p_note is not null and (length(trim(p_note))>300 or p_note ~ '[[:cntrl:]]')) then
  raise exception 'Deployment response denied'; end if;
 select a.requirement_id,r.event_id into target_requirement,target_event from public.event_staff_allocations a
  join public.event_staffing_requirements r on r.id=a.requirement_id where a.id=p_allocation and a.person_id=actor;
 if target_requirement is null then raise exception 'Deployment response denied'; end if;
 select * into ev from public.operational_events where id=target_event for update;
 select * into req from public.event_staffing_requirements where id=target_requirement for update;
 select * into old from public.event_staff_allocations where id=p_allocation and person_id=actor for update;
 if old.id is null or old.status<>'ALLOCATED' or old.revision is distinct from p_expected_revision or
   req.state<>'PLANNED' or ev.status not in ('PLANNING','CONFIRMED','LIVE') then
   raise exception 'Deployment response denied'; end if;
 next_revision:=old.revision+1;
 perform set_config('kss.write_06c','allowed',true);
 update public.event_staff_allocations set status=p_response,responded_at=transaction_timestamp(),
  updated_at=transaction_timestamp(),revision=next_revision where id=p_allocation;
 insert into public.event_staff_allocation_events(allocation_id,requirement_id,person_id,kind,old_status,new_status,
  old_revision,new_revision,requirement_revision_at_allocation,actor_person_id,reason_code,reason)
 values(old.id,old.requirement_id,old.person_id,p_response,'ALLOCATED',p_response,old.revision,next_revision,
  old.requirement_revision_at_allocation,actor,case when p_response='DECLINED' then p_reason_code else null end,
  nullif(trim(p_note),''));
 perform private.crm_audit('event_staff_allocation_event',old.id,'UPDATE',array['status','revision']);
 return next_revision;
end $$;
revoke all on function public.deployment_respond(uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.deployment_respond(uuid,integer,text,text,text) to authenticated;

-- All 06B writes, including direct RPC calls, pass this reconciliation trigger.
create function private.reconcile_requirement_allocations_06c() returns trigger
language plpgsql security definer set search_path='' as $$
declare active_count integer;
begin
 if new.role_id is distinct from old.role_id or new.service_date is distinct from old.service_date or
  new.report_at is distinct from old.report_at or new.shift_starts_at is distinct from old.shift_starts_at or
  new.shift_ends_at is distinct from old.shift_ends_at or new.area_label is distinct from old.area_label or
  new.instructions is distinct from old.instructions or new.state='CANCELLED' then
   if exists(select 1 from public.event_staff_allocations a where a.requirement_id=old.id and a.status in ('ALLOCATED','ACCEPTED')) then
     raise exception 'Reconcile active allocations before changing staffing context'; end if;
 end if;
 select count(*) into active_count from public.event_staff_allocations a where a.requirement_id=old.id and a.status in ('ALLOCATED','ACCEPTED');
 if new.required_quantity<active_count then raise exception 'Requirement quantity below active allocations'; end if;
 return new;
end $$;
revoke all on function private.reconcile_requirement_allocations_06c() from public,anon,authenticated;
create trigger reconcile_requirement_allocations before update on public.event_staffing_requirements
 for each row execute function private.reconcile_requirement_allocations_06c();

-- 06A Event cancellation remains the only public lifecycle path. This trigger makes allocation consequences atomic.
create function private.reconcile_event_allocations_06c() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.event_staff_allocations%rowtype; next_revision integer;
begin
 if (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at) and
   exists(select 1 from public.event_staff_allocations x join public.event_staffing_requirements r on r.id=x.requirement_id
    where r.event_id=old.id and x.status in ('ALLOCATED','ACCEPTED')) then
   raise exception 'Reconcile active allocations before changing Event dates'; end if;
 if old.status<>'CANCELLED' and new.status='CANCELLED' then
   if actor is null then raise exception 'Event allocation cancellation denied'; end if;
   perform set_config('kss.write_06c','allowed',true);
   for a in select x.* from public.event_staff_allocations x join public.event_staffing_requirements r on r.id=x.requirement_id
      where r.event_id=old.id and x.status in ('ALLOCATED','ACCEPTED') order by x.id for update of x loop
     next_revision:=a.revision+1;
     update public.event_staff_allocations set status='CANCELLED',cancelled_at=transaction_timestamp(),
       updated_at=transaction_timestamp(),revision=next_revision where id=a.id;
     insert into public.event_staff_allocation_events(allocation_id,requirement_id,person_id,kind,old_status,new_status,
       old_revision,new_revision,requirement_revision_at_allocation,actor_person_id,reason)
     values(a.id,a.requirement_id,a.person_id,'EVENT_CANCELLED',a.status,'CANCELLED',a.revision,next_revision,
       a.requirement_revision_at_allocation,actor,'Event cancelled');
     perform private.crm_audit('event_staff_allocation_event',a.id,'UPDATE',array['status','revision']);
   end loop;
 end if;
 return new;
end $$;
revoke all on function private.reconcile_event_allocations_06c() from public,anon,authenticated;
create trigger reconcile_event_allocations before update on public.operational_events
 for each row execute function private.reconcile_event_allocations_06c();
