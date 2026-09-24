-- TASK-17C: approved Time Away is a hard gate for new Event/static duty and Staff acceptance.
-- All effective-state transitions and allocation writers serialize on public.people(id).

create table public.time_away_reconciliation_issues (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.time_away_requests(id),
 approval_revision integer not null,
 person_id uuid not null references public.people(id),
 source text not null check (source in ('EVENT','SITE_SHIFT')),
 event_allocation_id uuid references public.event_staff_allocations(id),
 site_allocation_id uuid references public.site_shift_allocations(id),
 allocation_revision integer not null,
 duty_revision integer not null,
 duty_starts_at timestamptz not null,
 duty_ends_at timestamptz not null,
 status text not null default 'REVIEW_REQUIRED' check (status in ('REVIEW_REQUIRED','CLOSED')),
 revision integer not null default 1 check (revision>0),
 created_at timestamptz not null default transaction_timestamp(),
 closed_at timestamptz,
 closed_by_person_id uuid references public.people(id),
 check ((source='EVENT' and event_allocation_id is not null and site_allocation_id is null)
     or (source='SITE_SHIFT' and site_allocation_id is not null and event_allocation_id is null)),
 check ((status='REVIEW_REQUIRED' and closed_at is null and closed_by_person_id is null)
     or (status='CLOSED' and closed_at is not null and closed_by_person_id is not null)),
 foreign key (request_id,approval_revision) references public.time_away_request_events(request_id,revision)
);
create unique index time_away_issue_event_unique_17c on public.time_away_reconciliation_issues
 (request_id,approval_revision,event_allocation_id) where source='EVENT';
create unique index time_away_issue_site_unique_17c on public.time_away_reconciliation_issues
 (request_id,approval_revision,site_allocation_id) where source='SITE_SHIFT';
create index time_away_issue_event_lookup_17c on public.time_away_reconciliation_issues(event_allocation_id,status) where source='EVENT';
create index time_away_issue_site_lookup_17c on public.time_away_reconciliation_issues(site_allocation_id,status) where source='SITE_SHIFT';

create table public.time_away_reconciliation_events (
 id uuid primary key default gen_random_uuid(),
 issue_id uuid not null references public.time_away_reconciliation_issues(id),
 revision integer not null,
 kind text not null check (kind in ('REVIEW_REQUIRED','CLOSED')),
 actor_person_id uuid not null references public.people(id),
 reason text,
 occurred_at timestamptz not null default transaction_timestamp(),
 unique(issue_id,revision)
);
alter table public.time_away_reconciliation_issues enable row level security;
alter table public.time_away_reconciliation_events enable row level security;
revoke all on public.time_away_reconciliation_issues,public.time_away_reconciliation_events from public,anon,authenticated;

create function private.guard_time_away_issue_17c() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_17c',true) is distinct from 'allowed' then raise exception 'Reconciliation write denied'; end if;
 if tg_op='DELETE' then raise exception 'Reconciliation history is immutable'; end if;
 if tg_table_name='time_away_reconciliation_events' and tg_op='UPDATE' then raise exception 'Reconciliation history is immutable'; end if;
 if tg_table_name='time_away_reconciliation_issues' and tg_op='UPDATE' then
  if (new.request_id,new.approval_revision,new.person_id,new.source,new.event_allocation_id,new.site_allocation_id,
   new.allocation_revision,new.duty_revision,new.duty_starts_at,new.duty_ends_at,new.created_at)
   is distinct from
  (old.request_id,old.approval_revision,old.person_id,old.source,old.event_allocation_id,old.site_allocation_id,
   old.allocation_revision,old.duty_revision,old.duty_starts_at,old.duty_ends_at,old.created_at)
  then raise exception 'Reconciliation identity is immutable'; end if;
 end if;
 return new;
end $$;
create trigger guard_time_away_issue_17c before insert or update or delete on public.time_away_reconciliation_issues
 for each row execute function private.guard_time_away_issue_17c();
create trigger guard_time_away_issue_event_17c before insert or update or delete on public.time_away_reconciliation_events
 for each row execute function private.guard_time_away_issue_17c();
revoke all on function private.guard_time_away_issue_17c() from public,anon,authenticated;

create function private.approved_time_away_overlap_17c(p_person uuid,p_start timestamptz,p_end timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
 select p_person is not null and p_start is not null and p_end>p_start and exists (
  select 1 from public.time_away_requests r join public.time_away_segments s on s.request_id=r.id
  where r.person_id=p_person and r.state in ('APPROVED','CANCELLATION_REQUESTED')
   and (case when s.kind='WHOLE_DAY'
    then s.local_date::timestamp at time zone 'Europe/London' else s.starts_at end)<p_end
   and p_start<(case when s.kind='WHOLE_DAY'
    then (s.local_date+1)::timestamp at time zone 'Europe/London' else s.ends_at end)
 )
$$;
revoke all on function private.approved_time_away_overlap_17c(uuid,timestamptz,timestamptz) from public,anon,authenticated;

create function private.time_away_segment_overlap_17c(p_request uuid,p_start timestamptz,p_end timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.time_away_segments s where s.request_id=p_request
  and (case when s.kind='WHOLE_DAY' then s.local_date::timestamp at time zone 'Europe/London' else s.starts_at end)<p_end
  and p_start<(case when s.kind='WHOLE_DAY' then (s.local_date+1)::timestamp at time zone 'Europe/London' else s.ends_at end))
$$;
revoke all on function private.time_away_segment_overlap_17c(uuid,timestamptz,timestamptz) from public,anon,authenticated;

create function private.open_time_away_issues_17c(p_request uuid,p_revision integer,p_person uuid,p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare duty record; issue uuid;
begin
 perform set_config('kss.write_17c','allowed',true);
 for duty in
  select a.id,a.revision as allocation_revision,r.revision as duty_revision,r.report_at,r.shift_ends_at
  from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
  where a.person_id=p_person and a.status in ('ALLOCATED','ACCEPTED')
   and private.time_away_segment_overlap_17c(p_request,r.report_at,r.shift_ends_at)
  for share of a
 loop
  insert into public.time_away_reconciliation_issues(request_id,approval_revision,person_id,source,
   event_allocation_id,allocation_revision,duty_revision,duty_starts_at,duty_ends_at)
  values(p_request,p_revision,p_person,'EVENT',duty.id,duty.allocation_revision,duty.duty_revision,duty.report_at,duty.shift_ends_at)
  on conflict do nothing returning id into issue;
  if issue is not null then
   insert into public.time_away_reconciliation_events(issue_id,revision,kind,actor_person_id)
   values(issue,1,'REVIEW_REQUIRED',p_actor);
  end if;
  issue:=null;
 end loop;
 for duty in
  select a.id,a.revision as allocation_revision,d.revision as duty_revision,d.report_at,d.shift_ends_at
  from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
  where a.person_id=p_person and a.status in ('ALLOCATED','ACCEPTED')
   and private.time_away_segment_overlap_17c(p_request,d.report_at,d.shift_ends_at)
  for share of a
 loop
  insert into public.time_away_reconciliation_issues(request_id,approval_revision,person_id,source,
   site_allocation_id,allocation_revision,duty_revision,duty_starts_at,duty_ends_at)
  values(p_request,p_revision,p_person,'SITE_SHIFT',duty.id,duty.allocation_revision,duty.duty_revision,duty.report_at,duty.shift_ends_at)
  on conflict do nothing returning id into issue;
  if issue is not null then
   insert into public.time_away_reconciliation_events(issue_id,revision,kind,actor_person_id)
   values(issue,1,'REVIEW_REQUIRED',p_actor);
  end if;
  issue:=null;
 end loop;
end $$;
revoke all on function private.open_time_away_issues_17c(uuid,integer,uuid,uuid) from public,anon,authenticated;

create function public.time_away_reconciliation_list(p_source text,p_allocation uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if private.current_person_id() is null or not private.operational_authorised() or p_allocation is null
  or p_source not in ('EVENT','SITE_SHIFT') then raise exception 'Reconciliation access denied'; end if;
 if p_source='EVENT' and not exists(select 1 from public.event_staff_allocations where id=p_allocation)
  or p_source='SITE_SHIFT' and not exists(select 1 from public.site_shift_allocations where id=p_allocation)
 then raise exception 'Reconciliation access denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'source',i.source,
  'allocationId',coalesce(i.event_allocation_id,i.site_allocation_id),'status',i.status,
  'revision',i.revision,'createdAt',i.created_at,'closedAt',i.closed_at,
  'approvedTimeAwayConflict',true) order by i.created_at,i.id),'[]'::jsonb)
 into result from public.time_away_reconciliation_issues i where i.source=p_source
  and ((p_source='EVENT' and i.event_allocation_id=p_allocation)
   or (p_source='SITE_SHIFT' and i.site_allocation_id=p_allocation));
 return result;
end $$;
revoke all on function public.time_away_reconciliation_list(text,uuid) from public,anon,authenticated;
grant execute on function public.time_away_reconciliation_list(text,uuid) to authenticated;

create function public.time_away_reconciliation_close(p_issue uuid,p_expected_revision integer,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); issue public.time_away_reconciliation_issues%rowtype;
 current_status text; duty_start timestamptz; duty_end timestamptz;
begin
 if actor is null or not private.operational_authorised() or p_expected_revision is null
  or p_reason is null or length(trim(p_reason)) not between 10 and 300 or p_reason ~ '[[:cntrl:]]'
 then raise exception 'Reconciliation closure denied'; end if;
 select person_id into issue.person_id from public.time_away_reconciliation_issues where id=p_issue;
 if issue.person_id is null then raise exception 'Reconciliation closure denied'; end if;
 perform 1 from public.people where id=issue.person_id for update;
 if not found then raise exception 'Reconciliation closure denied'; end if;
 select * into issue from public.time_away_reconciliation_issues where id=p_issue for update;
 if issue.id is null or issue.revision<>p_expected_revision or issue.status<>'REVIEW_REQUIRED'
 then raise exception 'Reconciliation closure denied'; end if;
 if issue.source='EVENT' then
  select a.status,r.report_at,r.shift_ends_at into current_status,duty_start,duty_end
  from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
  where a.id=issue.event_allocation_id;
 else
  select a.status,d.report_at,d.shift_ends_at into current_status,duty_start,duty_end
  from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
  where a.id=issue.site_allocation_id;
 end if;
 if current_status in ('ALLOCATED','ACCEPTED') and
  private.approved_time_away_overlap_17c(issue.person_id,duty_start,duty_end)
 then raise exception 'Active approved Time Away conflict cannot be closed'; end if;
 perform set_config('kss.write_17c','allowed',true);
 update public.time_away_reconciliation_issues set status='CLOSED',revision=revision+1,
  closed_at=transaction_timestamp(),closed_by_person_id=actor where id=issue.id;
 insert into public.time_away_reconciliation_events(issue_id,revision,kind,actor_person_id,reason)
 values(issue.id,issue.revision+1,'CLOSED',actor,trim(p_reason));
 return issue.revision+1;
end $$;
revoke all on function public.time_away_reconciliation_close(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.time_away_reconciliation_close(uuid,integer,text) to authenticated;

-- Existing guarded RPCs retain their signatures and original checks.


create or replace function private.site_shift_candidate_08a(p_demand uuid,p_person uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d public.site_shift_demands%rowtype; s public.site_services%rowtype; role_code text;
 has_staff boolean; has_clash boolean; availability text; check_enabled boolean; passed boolean;
 result_code text; reasons text[]:=array[]::text[];
begin
 select * into d from public.site_shift_demands where id=p_demand;
 select * into s from public.site_services where id=d.service_id;
 select code into role_code from public.operational_role_definitions where id=d.role_id;
 has_staff:=exists(select 1 from public.role_assignments ra where ra.person_id=p_person and ra.role_code='SECURITY_STAFF'
  and ra.revoked_at is null and ra.effective_from<=now() and (ra.effective_until is null or ra.effective_until>now()));
 availability:=private.availability_assessment_07a(p_person,d.report_at,d.shift_ends_at);
 has_clash:=private.person_allocation_overlap_08a(p_person,d.report_at,d.shift_ends_at,null,null);
 reasons:=array_append(reasons,case availability when 'DECLARED_AVAILABLE' then 'DECLARED_AVAILABLE'
  when 'DECLARED_UNAVAILABLE' then 'DECLARED_UNAVAILABLE' when 'NOT_FULLY_COVERED' then 'AVAILABILITY_NOT_FULLY_COVERED'
  else 'AVAILABILITY_NOT_DECLARED' end);
 if not has_staff then reasons:=array_append(reasons,'ACTIVE_SECURITY_STAFF_ROLE_REQUIRED'); end if;
 if has_clash then reasons:=array_append(reasons,'RECORDED_ALLOCATION_CLASH'); end if;
 if private.approved_time_away_overlap_17c(p_person,d.report_at,d.shift_ends_at) then
  reasons:=array_append(reasons,'APPROVED_TIME_AWAY_CONFLICT'); end if;
 if d.id is null or d.state<>'PLANNED' or s.state not in ('ACTIVE','PAUSED') or
  d.service_date<s.effective_from or (s.effective_until is not null and d.service_date>=s.effective_until) or
  exists(select 1 from public.site_service_pauses p where p.service_id=s.id and p.starts_on<=d.service_date and d.service_date<p.ends_before)
  then reasons:=array_append(reasons,'DEMAND_NOT_ACTIVE'); end if;
 if not has_staff or has_clash or private.approved_time_away_overlap_17c(p_person,d.report_at,d.shift_ends_at)
  or availability='DECLARED_UNAVAILABLE' or d.id is null or d.state<>'PLANNED' or
  s.state not in ('ACTIVE','PAUSED') or d.service_date<s.effective_from or
  (s.effective_until is not null and d.service_date>=s.effective_until) or
  exists(select 1 from public.site_service_pauses p where p.service_id=s.id and p.starts_on<=d.service_date and d.service_date<p.ends_before)
  then result_code:='BLOCKED';
 elsif role_code='SIA' then
  select exists(select 1 from public.operational_role_check_policies x where x.role_id=d.role_id
   and x.rule_code='SYNTHETIC_SIA_SECURITY_GUARDING' and x.development_only and x.enabled) into check_enabled;
  if not check_enabled then result_code:='BLOCKED';reasons:=array_append(reasons,'SIA_SYNTHETIC_RULE_DISABLED');
  else
   passed:=private.synthetic_sia_check_06c(p_person);
   if not passed then result_code:='BLOCKED';reasons:=array_append(reasons,'SYNTHETIC_SIA_CHECK_NOT_SATISFIED');
   else result_code:=case when availability='DECLARED_AVAILABLE' then 'SYNTHETIC_CHECKS_PASSED_WITH_WARNINGS' else 'REVIEW_REQUIRED' end;
    reasons:=array_append(reasons,'SYNTHETIC_SIA_CHECK_SATISFIED'); end if;
  end if;
 else result_code:='REVIEW_REQUIRED';reasons:=array_append(reasons,'ROLE_QUALIFICATION_RULE_NOT_CONFIGURED'); end if;
 return jsonb_build_object('result',result_code,'availability',availability,'reasons',reasons,
  'policy_version',case when role_code='SIA' then 1 else null end);
end $$;

create or replace function private.candidate_check_06c(p_requirement uuid,p_person uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare req public.event_staffing_requirements%rowtype; ev public.operational_events%rowtype;
 role_code text; has_staff boolean; has_clash boolean; check_enabled boolean; passed boolean;
 result_code text; availability text; reasons text[]:=array[]::text[];
begin
 select * into req from public.event_staffing_requirements where id=p_requirement;
 select * into ev from public.operational_events where id=req.event_id;
 select code into role_code from public.operational_role_definitions where id=req.role_id;
 has_staff:=exists(select 1 from public.people p join public.role_assignments ra on ra.person_id=p.id
   where p.id=p_person and ra.role_code='SECURITY_STAFF' and ra.revoked_at is null
   and ra.effective_from<=now() and (ra.effective_until is null or ra.effective_until>now()));
 availability:=private.availability_assessment_07a(p_person,req.report_at,req.shift_ends_at);
 reasons:=array_append(reasons,case availability when 'DECLARED_AVAILABLE' then 'DECLARED_AVAILABLE'
  when 'DECLARED_UNAVAILABLE' then 'DECLARED_UNAVAILABLE' when 'NOT_FULLY_COVERED' then 'AVAILABILITY_NOT_FULLY_COVERED'
  else 'AVAILABILITY_NOT_DECLARED' end);
 has_clash:=private.person_allocation_overlap_08a(p_person,req.report_at,req.shift_ends_at,null,null);
 if not has_staff then reasons:=array_append(reasons,'ACTIVE_SECURITY_STAFF_ROLE_REQUIRED'); end if;
 if has_clash then reasons:=array_append(reasons,'RECORDED_ALLOCATION_CLASH'); end if;
 if private.approved_time_away_overlap_17c(p_person,req.report_at,req.shift_ends_at) then
  reasons:=array_append(reasons,'APPROVED_TIME_AWAY_CONFLICT'); end if;
 if req.id is null or req.state<>'PLANNED' or ev.status not in ('PLANNING','CONFIRMED','LIVE') then
   reasons:=array_append(reasons,'REQUIREMENT_NOT_ACTIVE'); end if;
 if not has_staff or has_clash or private.approved_time_away_overlap_17c(p_person,req.report_at,req.shift_ends_at)
  or availability='DECLARED_UNAVAILABLE' or req.id is null or req.state<>'PLANNED' or ev.status not in ('PLANNING','CONFIRMED','LIVE') then
   result_code:='BLOCKED';
 elsif role_code='SIA' then
   select exists(select 1 from public.operational_role_check_policies p where p.role_id=req.role_id
     and p.rule_code='SYNTHETIC_SIA_SECURITY_GUARDING' and p.development_only and p.enabled)
     into check_enabled;
   if not check_enabled then result_code:='BLOCKED';reasons:=array_append(reasons,'SIA_SYNTHETIC_RULE_DISABLED');
   else
     passed:=private.synthetic_sia_check_06c(p_person);
     if passed then result_code:=case when availability='DECLARED_AVAILABLE' then 'SYNTHETIC_CHECKS_PASSED_WITH_WARNINGS' else 'REVIEW_REQUIRED' end;
       reasons:=array_append(reasons,'SYNTHETIC_SIA_CHECK_SATISFIED');
     else result_code:='BLOCKED';reasons:=array_append(reasons,'SYNTHETIC_SIA_CHECK_NOT_SATISFIED'); end if;
   end if;
 else
   result_code:='REVIEW_REQUIRED';reasons:=array_append(reasons,'ROLE_QUALIFICATION_RULE_NOT_CONFIGURED');
 end if;
 return jsonb_build_object('result',result_code,'availability',availability,'reasons',reasons,'policy_version',case when role_code='SIA' then 1 else null end);
end $$;

create or replace function public.deployment_allocate(p_event uuid,p_requirement uuid,p_person uuid,p_expected_revision integer,
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
 if private.approved_time_away_overlap_17c(p_person,req.report_at,req.shift_ends_at) then
  raise exception 'APPROVED_TIME_AWAY_CONFLICT'; end if;
 if assessment->>'result'='BLOCKED' then raise exception 'Candidate blocked'; end if;
 if assessment->>'result'='REVIEW_REQUIRED' and
   (p_acknowledge_warnings is distinct from true or p_reason is null or length(trim(p_reason)) not between 3 and 300
    or p_reason ~ '[[:cntrl:]]') then raise exception 'Warnings require acknowledgement and reason'; end if;
 perform set_config('kss.write_06c','allowed',true);
 if private.approved_time_away_overlap_17c(p_person,req.report_at,req.shift_ends_at) then
  raise exception 'APPROVED_TIME_AWAY_CONFLICT'; end if;
 insert into public.event_staff_allocations(requirement_id,person_id,requirement_revision_at_allocation,allocated_by_person_id)
 values(p_requirement,p_person,req.revision,actor) returning id into result;
 insert into public.event_staff_allocation_events(allocation_id,requirement_id,person_id,kind,new_status,new_revision,
  requirement_revision_at_allocation,actor_person_id,reason)
 values(result,p_requirement,p_person,'ALLOCATED','ALLOCATED',1,req.revision,actor,
  case when assessment->>'result'='REVIEW_REQUIRED' then trim(p_reason) else null end);
 perform private.crm_audit('event_staff_allocation',result,'INSERT',array['requirement_id','person_id','status']);
 return result;
end $$;

create or replace function public.site_shift_allocate(p_service uuid,p_demand uuid,p_person uuid,p_expected_revision integer,
 p_acknowledge_warnings boolean default false,p_reason text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); s public.site_services%rowtype; d public.site_shift_demands%rowtype;
 assessment jsonb; active_count integer; result uuid;
begin
 if actor is null or not private.operational_authorised() or p_person=actor then raise exception 'Allocation denied'; end if;
 select * into s from public.site_services where id=p_service for update;
 select * into d from public.site_shift_demands where id=p_demand and service_id=p_service for update;
 if s.id is null or d.id is null or d.revision is distinct from p_expected_revision or d.state<>'PLANNED'
  then raise exception 'Allocation denied'; end if;
 -- This exact people row is also locked by accepted 06C Event allocate and 07A availability writes.
 perform 1 from public.people where id=p_person for update;
 if not found then raise exception 'Allocation denied'; end if;
 select count(*) into active_count from public.site_shift_allocations where demand_id=p_demand and status in ('ALLOCATED','ACCEPTED');
 if active_count>=d.required_quantity then raise exception 'Requirement capacity reached'; end if;
 assessment:=private.site_shift_candidate_08a(p_demand,p_person);
 if private.approved_time_away_overlap_17c(p_person,d.report_at,d.shift_ends_at) then
  raise exception 'APPROVED_TIME_AWAY_CONFLICT'; end if;
 if assessment->>'result'='BLOCKED' then raise exception 'Candidate blocked'; end if;
 if assessment->>'result'='REVIEW_REQUIRED' and
  (p_acknowledge_warnings is distinct from true or p_reason is null or length(trim(p_reason)) not between 3 and 300
   or p_reason ~ '[[:cntrl:]]') then raise exception 'Warnings require acknowledgement and reason'; end if;
 perform set_config('kss.write_08a','allowed',true);
 if private.approved_time_away_overlap_17c(p_person,d.report_at,d.shift_ends_at) then
  raise exception 'APPROVED_TIME_AWAY_CONFLICT'; end if;
 insert into public.site_shift_allocations(demand_id,person_id,demand_revision_at_allocation,allocated_by_person_id)
 values(p_demand,p_person,d.revision,actor) returning id into result;
 insert into public.site_shift_allocation_events(allocation_id,demand_id,person_id,kind,new_status,new_revision,
  actor_person_id,reason) values(result,p_demand,p_person,'ALLOCATED','ALLOCATED',1,actor,
  case when assessment->>'result'='REVIEW_REQUIRED' then trim(p_reason) else null end);
 return result;
end $$;

create or replace function public.deployment_respond(p_allocation uuid,p_expected_revision integer,p_response text,
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
 perform 1 from public.people where id=actor for update;
 if not found then raise exception 'Deployment response denied'; end if;
 select * into old from public.event_staff_allocations where id=p_allocation and person_id=actor for update;
 if old.id is null or old.status<>'ALLOCATED' or old.revision is distinct from p_expected_revision or
   req.state<>'PLANNED' or ev.status not in ('PLANNING','CONFIRMED','LIVE') then
   raise exception 'Deployment response denied'; end if;
 next_revision:=old.revision+1;
 if p_response='ACCEPTED' and private.approved_time_away_overlap_17c(actor,req.report_at,req.shift_ends_at) then
  raise exception 'APPROVED_TIME_AWAY_CONFLICT'; end if;
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

create or replace function public.site_shift_respond(p_allocation uuid,p_expected_revision integer,p_response text,
 p_reason_code text default null,p_note text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); old public.site_shift_allocations%rowtype; d public.site_shift_demands%rowtype;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_response not in ('ACCEPTED','DECLINED')
  or (p_response='DECLINED' and p_reason_code not in ('CANNOT_ATTEND','TIMING_CONFLICT','OTHER'))
  or p_note is not null and (length(p_note)>300 or p_note ~ '[[:cntrl:]]') then raise exception 'Deployment response denied'; end if;
 perform 1 from public.people where id=actor for update;
 if not found then raise exception 'Deployment response denied'; end if;
 select * into old from public.site_shift_allocations where id=p_allocation and person_id=actor for update;
 select * into d from public.site_shift_demands where id=old.demand_id;
 if old.id is null or old.status<>'ALLOCATED' or old.revision is distinct from p_expected_revision
  or d.state<>'PLANNED' then raise exception 'Deployment response denied'; end if;
 if p_response='ACCEPTED' and private.approved_time_away_overlap_17c(actor,d.report_at,d.shift_ends_at) then
  raise exception 'APPROVED_TIME_AWAY_CONFLICT'; end if;
 perform set_config('kss.write_08a','allowed',true);
 update public.site_shift_allocations set status=p_response,responded_at=transaction_timestamp(),
  updated_at=transaction_timestamp(),revision=old.revision+1 where id=old.id;
 insert into public.site_shift_allocation_events(allocation_id,demand_id,person_id,kind,old_status,new_status,
  old_revision,new_revision,actor_person_id,reason_code,reason)
 values(old.id,old.demand_id,actor,p_response,'ALLOCATED',p_response,old.revision,old.revision+1,actor,
  case when p_response='DECLINED' then p_reason_code else null end,nullif(trim(p_note),''));
 return old.revision+1;
end $$;

create or replace function public.time_away_transition(p_request uuid,p_action text,p_expected_revision integer,
 p_key uuid,p_reason text default null,p_note text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid; r public.time_away_requests%rowtype; next_state text; required_action text;
 decision_kind text; snapshot jsonb; prior public.time_away_request_events%rowtype;
begin
 actor:=private.current_person_id();
 if actor is null or not private.has_any_active_role() or p_key is null or p_expected_revision is null then raise exception 'Time Away action denied'; end if;
 select * into prior from public.time_away_request_events where actor_person_id=actor and kind=p_action and idempotency_key=p_key;
 if prior.id is not null then
  if prior.request_id<>p_request then raise exception 'Idempotency key reused'; end if;
  return prior.revision;
 end if;
 select * into r from public.time_away_requests where id=p_request for update;
 if r.id is null or r.revision<>p_expected_revision then raise exception 'Stale or inaccessible Time Away request'; end if;
 if p_action='WITHDRAWN' and r.state='SUBMITTED' and r.person_id=actor then next_state:='WITHDRAWN';
 elsif p_action='CANCELLATION_REQUESTED' and r.state='APPROVED' and r.person_id=actor then next_state:='CANCELLATION_REQUESTED';
 elsif p_action in ('APPROVED','DECLINED') and r.state='SUBMITTED' and r.person_id<>actor then
  required_action:='DECIDE_REQUEST';next_state:=p_action;decision_kind:=p_action;
 elsif p_action in ('CANCELLATION_APPROVED','CANCELLATION_REJECTED') and r.state='CANCELLATION_REQUESTED'
  and r.person_id<>actor then
  required_action:='DECIDE_CANCELLATION';
  next_state:=case when p_action='CANCELLATION_APPROVED' then 'CANCELLED' else 'APPROVED' end;
  decision_kind:=p_action;
 else raise exception 'Time Away action denied'; end if;
 if required_action is not null and not private.time_away_granted(r.team_id,required_action)
 then raise exception 'Time Away approver grant required'; end if;
 if decision_kind is not null then
  if p_reason is null or p_reason not in ('APPROVED_AS_REQUESTED','STAFFING_CONFLICT','REQUEST_NOT_SUPPORTED',
   'OTHER','CANCELLATION_ACCEPTED','CANCELLATION_NOT_SUPPORTED')
   or (p_action='APPROVED' and p_reason<>'APPROVED_AS_REQUESTED')
   or (p_action='DECLINED' and p_reason not in ('STAFFING_CONFLICT','REQUEST_NOT_SUPPORTED','OTHER'))
   or (p_action='CANCELLATION_APPROVED' and p_reason<>'CANCELLATION_ACCEPTED')
   or (p_action='CANCELLATION_REJECTED' and p_reason not in ('CANCELLATION_NOT_SUPPORTED','OTHER'))
   or (p_note is not null and (length(trim(p_note)) not between 3 and 200 or p_note ~ '[[:cntrl:]]'))
  then raise exception 'Controlled Time Away reason required'; end if;
 elsif p_reason is not null or p_note is not null then raise exception 'Unexpected Time Away reason'; end if;
 if p_action in ('APPROVED','CANCELLATION_APPROVED','CANCELLATION_REJECTED') then
  perform 1 from public.people where id=r.person_id for update;
  if not found then raise exception 'Time Away action denied'; end if;
 end if;
 snapshot:=private.time_away_snapshot(r.id);
 if decision_kind is not null then
  insert into public.time_away_decisions(request_id,request_revision,actor_person_id,kind,reason_code,note,
   category_code,category_version,team_id,segment_snapshot)
  values(r.id,r.revision,actor,decision_kind,p_reason,nullif(trim(p_note),''),r.category_code,r.category_version,
   r.team_id,snapshot);
 end if;
 update public.time_away_requests set state=next_state,revision=revision+1,updated_at=transaction_timestamp()
  where id=r.id;
 insert into public.time_away_request_events(request_id,revision,actor_person_id,kind,old_state,new_state,team_id,
  category_code,category_version,segment_snapshot,idempotency_key)
 values(r.id,r.revision+1,actor,p_action,r.state,next_state,r.team_id,r.category_code,r.category_version,snapshot,p_key);
 if p_action='APPROVED' then
  perform private.open_time_away_issues_17c(r.id,r.revision+1,r.person_id,actor);
 end if;
 return r.revision+1;
end $$;

-- Capture 17B-approved overlaps already present before the hard gate is installed.
-- Lock source writes while taking the final snapshot; no leave or allocation is changed.
lock table public.time_away_requests,public.event_staff_allocations,public.site_shift_allocations
 in share row exclusive mode;
do $$
declare existing record;
begin
 for existing in
  select r.id,r.person_id,e.revision,e.actor_person_id
  from public.time_away_requests r join public.time_away_request_events e on e.request_id=r.id
  where r.state in ('APPROVED','CANCELLATION_REQUESTED') and e.kind='APPROVED'
  order by r.id
 loop
  perform 1 from public.people where id=existing.person_id for update;
  perform private.open_time_away_issues_17c(existing.id,existing.revision,existing.person_id,existing.actor_person_id);
 end loop;
end $$;
