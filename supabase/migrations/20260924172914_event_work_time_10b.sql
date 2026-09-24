-- TASK-10B: Event-only Staff-proposed worked time and immutable review history.
-- Evidence FKs intentionally target the retained Event composite keys from 09A;
-- the separate 09B adapter may make attendance source columns nullable.

alter table public.event_staff_allocations
  add constraint event_staff_allocation_person_10b_unique unique (id,person_id);

create table public.event_work_time_cases (
  id uuid primary key default gen_random_uuid(),
  event_allocation_id uuid not null unique,
  requirement_id uuid not null,
  event_id uuid not null,
  person_id uuid not null references public.people(id),
  current_revision integer not null default 0 check (current_revision>=0),
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','RETURNED','APPROVED','REVIEW_REQUIRED')),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique(id,event_allocation_id,person_id),
  foreign key(event_allocation_id,requirement_id) references public.event_staff_allocations(id,requirement_id),
  foreign key(event_allocation_id,person_id) references public.event_staff_allocations(id,person_id),
  foreign key(requirement_id,event_id) references public.event_staffing_requirements(id,event_id)
);
create index event_work_time_event_queue_10b on public.event_work_time_cases(event_id,status,updated_at desc,id);
create index event_work_time_person_10b on public.event_work_time_cases(person_id,updated_at desc,id);

create table public.event_work_time_revisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.event_work_time_cases(id),
  revision integer not null check (revision>0),
  kind text not null check (kind in ('DRAFT','SUBMITTED')),
  parent_revision integer,
  author_person_id uuid not null references public.people(id),
  proposed_work_minutes integer not null check (proposed_work_minutes>0),
  evidence_status text not null check (evidence_status in ('NOT_SNAPSHOTTED','COMPLETE','INCOMPLETE','MISSING','INCONSISTENT')),
  attendance_case_revision integer,
  reason text check (reason is null or (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]')),
  created_at timestamptz not null default transaction_timestamp(),
  submitted_at timestamptz,
  unique(case_id,revision),
  unique(id,case_id,revision),
  foreign key(case_id,parent_revision) references public.event_work_time_revisions(case_id,revision),
  check ((kind='DRAFT' and submitted_at is null and evidence_status='NOT_SNAPSHOTTED'
       and attendance_case_revision is null)
      or (kind='SUBMITTED' and submitted_at is not null and evidence_status<>'NOT_SNAPSHOTTED'))
);
create index event_work_time_revision_history_10b on public.event_work_time_revisions(case_id,revision desc);

create table public.event_work_time_segments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  revision integer not null,
  segment_no integer not null check (segment_no>0),
  segment_type text not null check (segment_type in ('WORK','BREAK')),
  starts_at timestamptz not null check (isfinite(starts_at)),
  ends_at timestamptz not null check (isfinite(ends_at) and ends_at>starts_at),
  unique(case_id,revision,segment_no),
  foreign key(case_id,revision) references public.event_work_time_revisions(case_id,revision),
  check (date_trunc('minute',starts_at)=starts_at and date_trunc('minute',ends_at)=ends_at)
);
create index event_work_time_segments_revision_10b on public.event_work_time_segments(case_id,revision,starts_at);

create table public.event_work_time_evidence (
  id uuid primary key default gen_random_uuid(),
  work_time_revision_id uuid not null,
  work_time_case_id uuid not null,
  revision integer not null,
  attendance_case_id uuid not null,
  attendance_event_id uuid not null,
  event_allocation_id uuid not null,
  person_id uuid not null,
  observed_case_revision integer not null check (observed_case_revision>=0),
  observed_event_revision integer not null check (observed_event_revision>0),
  pinned_at timestamptz not null default transaction_timestamp(),
  unique(work_time_revision_id,attendance_event_id),
  foreign key(work_time_revision_id,work_time_case_id,revision)
    references public.event_work_time_revisions(id,case_id,revision),
  foreign key(work_time_case_id,event_allocation_id,person_id)
    references public.event_work_time_cases(id,event_allocation_id,person_id),
  foreign key(event_allocation_id,person_id)
    references public.event_staff_allocations(id,person_id),
  -- 09B preserves these Event composite keys while making the source FK nullable.
  foreign key(attendance_case_id,event_allocation_id,person_id)
    references public.attendance_cases(id,event_allocation_id,person_id),
  foreign key(attendance_event_id,attendance_case_id)
    references public.attendance_events(id,attendance_case_id)
);
create index event_work_time_evidence_revision_10b on public.event_work_time_evidence(work_time_revision_id,observed_event_revision);

create table public.event_work_time_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.event_work_time_cases(id),
  revision_id uuid,
  revision integer,
  kind text not null check (kind in ('DRAFT_SAVED','SUBMITTED','RETURNED','WORKED_TIME_APPROVED','SOURCE_REVIEW_REQUIRED')),
  from_status text check (from_status is null or from_status in ('DRAFT','SUBMITTED','RETURNED','APPROVED','REVIEW_REQUIRED')),
  to_status text not null check (to_status in ('DRAFT','SUBMITTED','RETURNED','APPROVED','REVIEW_REQUIRED')),
  actor_person_id uuid references public.people(id),
  actor_kind text not null check (actor_kind in ('PERSON','SYSTEM')),
  reason text check (reason is null or (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]')),
  source_key text,
  recorded_at timestamptz not null default transaction_timestamp(),
  foreign key(revision_id,case_id,revision) references public.event_work_time_revisions(id,case_id,revision),
  check ((actor_kind='PERSON' and actor_person_id is not null) or (actor_kind='SYSTEM' and actor_person_id is null)),
  check ((kind in ('RETURNED','SOURCE_REVIEW_REQUIRED') and reason is not null)
      or kind not in ('RETURNED','SOURCE_REVIEW_REQUIRED'))
);
create unique index event_work_time_source_event_10b on public.event_work_time_events(case_id,source_key)
  where source_key is not null;
create index event_work_time_events_history_10b on public.event_work_time_events(case_id,recorded_at,id);

create table public.event_work_time_idempotency (
  actor_person_id uuid not null references public.people(id),
  idempotency_key uuid not null,
  action text not null check (action in ('SAVE_DRAFT','SUBMIT','RETURN','APPROVE','GRANT','REVOKE')),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{32}$'),
  result jsonb not null,
  recorded_at timestamptz not null default transaction_timestamp(),
  primary key(actor_person_id,idempotency_key)
);

create table public.event_work_time_grants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.operational_events(id),
  person_id uuid not null references public.people(id),
  capability text not null check (capability in ('WORK_TIME_REVIEW','WORK_TIME_APPROVE')),
  effective_from timestamptz not null,
  effective_until timestamptz not null,
  granted_by_person_id uuid not null references public.people(id),
  reason text not null check (length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]'),
  revoked_at timestamptz,
  revoked_by_person_id uuid references public.people(id),
  revocation_reason text check (revocation_reason is null or (length(trim(revocation_reason)) between 3 and 300 and revocation_reason !~ '[[:cntrl:]]')),
  created_at timestamptz not null default transaction_timestamp(),
  check (effective_until>effective_from),
  check ((revoked_at is null and revoked_by_person_id is null and revocation_reason is null)
      or (revoked_at is not null and revoked_by_person_id is not null and revocation_reason is not null))
);
create unique index event_work_time_active_grant_10b on public.event_work_time_grants(event_id,person_id,capability) where revoked_at is null;
create index event_work_time_grant_lookup_10b on public.event_work_time_grants(event_id,person_id,capability,effective_from,effective_until) where revoked_at is null;

create table public.event_work_time_grant_events (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.event_work_time_grants(id),
  kind text not null check (kind in ('GRANTED','REVOKED')),
  event_id uuid not null references public.operational_events(id),
  person_id uuid not null references public.people(id),
  capability text not null check (capability in ('WORK_TIME_REVIEW','WORK_TIME_APPROVE')),
  actor_person_id uuid not null references public.people(id),
  effective_from timestamptz,
  effective_until timestamptz,
  reason text not null check (length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]'),
  recorded_at timestamptz not null default transaction_timestamp(),
  check ((kind='GRANTED' and effective_from is not null and effective_until is not null)
      or (kind='REVOKED' and effective_from is null and effective_until is null))
);

alter table public.event_work_time_cases enable row level security;
alter table public.event_work_time_revisions enable row level security;
alter table public.event_work_time_segments enable row level security;
alter table public.event_work_time_evidence enable row level security;
alter table public.event_work_time_events enable row level security;
alter table public.event_work_time_idempotency enable row level security;
alter table public.event_work_time_grants enable row level security;
alter table public.event_work_time_grant_events enable row level security;
revoke all on public.event_work_time_cases,public.event_work_time_revisions,public.event_work_time_segments,
  public.event_work_time_evidence,public.event_work_time_events,public.event_work_time_idempotency,
  public.event_work_time_grants,public.event_work_time_grant_events from public,anon,authenticated,service_role;

create function private.event_work_time_has_grant_10b(p_event uuid,p_person uuid,p_capability text)
returns boolean language sql stable security definer set search_path='' as $$
  select p_event is not null and p_person is not null
    and p_capability in ('WORK_TIME_REVIEW','WORK_TIME_APPROVE')
    and exists(select 1 from public.event_work_time_grants g where g.event_id=p_event and g.person_id=p_person
      and g.capability=p_capability and g.revoked_at is null and g.effective_from<=transaction_timestamp()
      and g.effective_until>transaction_timestamp())
$$;
revoke all on function private.event_work_time_has_grant_10b(uuid,uuid,text) from public,anon,authenticated,service_role;

create function private.guard_event_work_time_10b() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if current_setting('kss.event_work_time_write_10b',true) is distinct from 'allowed' then
    raise exception 'Worked-time direct write denied';
  end if;
  if tg_op='DELETE' then raise exception 'Worked-time history cannot be deleted'; end if;
  if tg_table_name in ('event_work_time_revisions','event_work_time_segments','event_work_time_evidence',
      'event_work_time_events','event_work_time_grant_events') then
    if tg_op<>'INSERT' then raise exception 'Worked-time history is immutable'; end if;
    return new;
  end if;
  if tg_table_name='event_work_time_idempotency' then
    if tg_op<>'INSERT' or new.actor_person_id is distinct from private.current_person_id() then
      raise exception 'Worked-time idempotency direct write denied'; end if;
    return new;
  end if;
  if tg_table_name='event_work_time_cases' then
    if tg_op='INSERT' then
      if not exists(select 1 from public.event_staff_allocations a
          join public.event_staffing_requirements r on r.id=a.requirement_id
          where a.id=new.event_allocation_id and a.requirement_id=new.requirement_id and a.person_id=new.person_id
            and r.event_id=new.event_id) then raise exception 'Worked-time source binding denied'; end if;
    elsif new.id is distinct from old.id or new.event_allocation_id is distinct from old.event_allocation_id
       or new.requirement_id is distinct from old.requirement_id or new.event_id is distinct from old.event_id
       or new.person_id is distinct from old.person_id or new.current_revision<old.current_revision
       or new.current_revision>old.current_revision+1 or new.created_at is distinct from old.created_at then
      raise exception 'Worked-time case identity/history is immutable';
    end if;
    return new;
  end if;
  if tg_table_name='event_work_time_grants' then
    if tg_op='INSERT' then return new; end if;
    if new.id is distinct from old.id or new.event_id is distinct from old.event_id or new.person_id is distinct from old.person_id
       or new.capability is distinct from old.capability or new.effective_from is distinct from old.effective_from
       or new.effective_until is distinct from old.effective_until or new.granted_by_person_id is distinct from old.granted_by_person_id
       or new.reason is distinct from old.reason or old.revoked_at is not null or new.revoked_at is null then
      raise exception 'Worked-time grant history is immutable'; end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_event_work_time_10b() from public,anon,authenticated,service_role;
create trigger guard_event_work_time_cases_10b before insert or update or delete on public.event_work_time_cases
  for each row execute function private.guard_event_work_time_10b();
create trigger guard_event_work_time_revisions_10b before insert or update or delete on public.event_work_time_revisions
  for each row execute function private.guard_event_work_time_10b();
create trigger guard_event_work_time_segments_10b before insert or update or delete on public.event_work_time_segments
  for each row execute function private.guard_event_work_time_10b();
create trigger guard_event_work_time_evidence_10b before insert or update or delete on public.event_work_time_evidence
  for each row execute function private.guard_event_work_time_10b();
create trigger guard_event_work_time_events_10b before insert or update or delete on public.event_work_time_events
  for each row execute function private.guard_event_work_time_10b();
create trigger guard_event_work_time_idempotency_10b before insert or update or delete on public.event_work_time_idempotency
  for each row execute function private.guard_event_work_time_10b();
create trigger guard_event_work_time_grants_10b before insert or update or delete on public.event_work_time_grants
  for each row execute function private.guard_event_work_time_10b();
create trigger guard_event_work_time_grant_events_10b before insert or update or delete on public.event_work_time_grant_events
  for each row execute function private.guard_event_work_time_10b();

create function private.event_work_time_append_event_10b(
  p_case uuid,p_revision_id uuid,p_revision integer,p_kind text,p_from text,p_to text,
  p_actor uuid,p_actor_kind text,p_reason text,p_source_key text default null
) returns public.event_work_time_events language plpgsql security definer set search_path='' as $$
declare ev public.event_work_time_events%rowtype;
begin
  perform set_config('kss.event_work_time_write_10b','allowed',true);
  insert into public.event_work_time_events(case_id,revision_id,revision,kind,from_status,to_status,
    actor_person_id,actor_kind,reason,source_key)
  values(p_case,p_revision_id,p_revision,p_kind,p_from,p_to,p_actor,p_actor_kind,p_reason,p_source_key)
  returning * into ev;
  return ev;
end $$;
revoke all on function private.event_work_time_append_event_10b(uuid,uuid,integer,text,text,text,uuid,text,text,text)
  from public,anon,authenticated,service_role;

create function private.event_work_time_source_review_10b(p_allocation uuid,p_source_key text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.event_work_time_cases%rowtype; r public.event_work_time_revisions%rowtype;
begin
  select * into c from public.event_work_time_cases where event_allocation_id=p_allocation for update;
  if c.id is null or not exists(select 1 from public.event_work_time_revisions where case_id=c.id and kind='SUBMITTED') then return; end if;
  if exists(select 1 from public.event_work_time_events where case_id=c.id and source_key=p_source_key) then return; end if;
  select * into r from public.event_work_time_revisions where case_id=c.id and kind='SUBMITTED' order by revision desc limit 1;
  perform private.event_work_time_append_event_10b(c.id,r.id,r.revision,'SOURCE_REVIEW_REQUIRED',c.status,
    'REVIEW_REQUIRED',null,'SYSTEM',p_reason,p_source_key);
  perform set_config('kss.event_work_time_write_10b','allowed',true);
  update public.event_work_time_cases set status='REVIEW_REQUIRED',updated_at=transaction_timestamp() where id=c.id;
end $$;
revoke all on function private.event_work_time_source_review_10b(uuid,text,text) from public,anon,authenticated,service_role;

create function private.event_work_time_attendance_change_10b() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.event_allocation_id is not null then
    perform private.event_work_time_source_review_10b(new.event_allocation_id,'ATTENDANCE:'||new.id::text,
      'Attendance evidence changed after a work-time submission; review the pinned snapshot.');
  end if;
  return new;
end $$;
revoke all on function private.event_work_time_attendance_change_10b() from public,anon,authenticated,service_role;
create trigger event_work_time_attendance_change_10b after insert on public.attendance_events
  for each row execute function private.event_work_time_attendance_change_10b();

create function private.event_work_time_allocation_change_10b() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status is distinct from old.status or new.revision is distinct from old.revision
     or new.requirement_id is distinct from old.requirement_id then
    perform private.event_work_time_source_review_10b(new.id,'ALLOCATION:'||new.revision::text||':'||new.status,
      'The Event allocation changed after work-time submission; review the linked history.');
  end if;
  return new;
end $$;
revoke all on function private.event_work_time_allocation_change_10b() from public,anon,authenticated,service_role;
create trigger event_work_time_allocation_change_10b after update on public.event_staff_allocations
  for each row execute function private.event_work_time_allocation_change_10b();

create function private.event_work_time_requirement_change_10b() returns trigger
language plpgsql security definer set search_path='' as $$
declare a record;
begin
  if new.revision is distinct from old.revision or new.state is distinct from old.state
     or new.event_id is distinct from old.event_id then
    for a in select id,revision,status from public.event_staff_allocations where requirement_id=old.id loop
      perform private.event_work_time_source_review_10b(a.id,'REQUIREMENT:'||new.id::text||':'||new.revision::text,
        'The Event staffing requirement changed after work-time submission; review the linked history.');
    end loop;
  end if;
  return new;
end $$;
revoke all on function private.event_work_time_requirement_change_10b() from public,anon,authenticated,service_role;
create trigger event_work_time_requirement_change_10b after update on public.event_staffing_requirements
  for each row execute function private.event_work_time_requirement_change_10b();

create function private.event_work_time_event_change_10b() returns trigger
language plpgsql security definer set search_path='' as $$
declare req record; a record;
begin
  if new.status is distinct from old.status or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at or new.site_id is distinct from old.site_id then
    for req in select id,revision from public.event_staffing_requirements where event_id=old.id loop
      for a in select id from public.event_staff_allocations where requirement_id=req.id loop
        perform private.event_work_time_source_review_10b(a.id,'EVENT:'||new.id::text||':'||new.updated_at::text,
          'The Event context changed after work-time submission; review the linked history.');
      end loop;
    end loop;
  end if;
  return new;
end $$;
revoke all on function private.event_work_time_event_change_10b() from public,anon,authenticated,service_role;
create trigger event_work_time_event_change_10b after update on public.operational_events
  for each row execute function private.event_work_time_event_change_10b();

create function public.event_work_time_self_read(p_allocation uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
  if actor is null or not private.has_active_role('SECURITY_STAFF') then raise exception 'Worked-time self read denied'; end if;
  with src as materialized (
    select a.id,a.person_id,a.status,a.revision allocation_revision,r.id requirement_id,r.service_date,
      r.report_at,r.shift_starts_at,r.shift_ends_at,r.area_label,role.display_name role_name,
      e.id event_id,e.name event_name,e.status event_status,s.name site_name,s.reporting_point
    from public.event_staff_allocations a
    join public.event_staffing_requirements r on r.id=a.requirement_id
    join public.operational_events e on e.id=r.event_id
    join public.operational_role_definitions role on role.id=r.role_id
    join public.sites s on s.id=e.site_id
    where a.person_id=actor and a.status in ('ACCEPTED','CANCELLED')
      and (p_allocation is null or a.id=p_allocation)
  ), cases as (
    select c.* from public.event_work_time_cases c where c.person_id=actor
      and (p_allocation is null or c.event_allocation_id=p_allocation)
  ), rows as (
    select s.*,c.id case_id,c.status case_status,c.current_revision,
      coalesce((select jsonb_agg(jsonb_build_object('revision',v.revision,'kind',v.kind,
        'proposed_work_minutes',v.proposed_work_minutes,'evidence_status',v.evidence_status,
        'parent_revision',v.parent_revision,'author_person_id',v.author_person_id,
        'created_at',v.created_at,'submitted_at',v.submitted_at,
        'segments',coalesce((select jsonb_agg(jsonb_build_object('type',g.segment_type,'starts_at',g.starts_at,'ends_at',g.ends_at)
          order by g.segment_no) from public.event_work_time_segments g where g.case_id=v.case_id and g.revision=v.revision),'[]'::jsonb),
        'evidence',coalesce((select jsonb_agg(jsonb_build_object('event_id',ev.id,'event_revision',ev.revision,
          'observed_case_revision',x.observed_case_revision,
          'type',ev.event_type,'actual_at',ev.actual_at,'corrected_actual_at',ev.corrected_actual_at,
          'recorded_at',ev.recorded_at,'reason_code',ev.reason_code) order by ev.revision)
          from public.event_work_time_evidence x join public.attendance_events ev on ev.id=x.attendance_event_id
          where x.work_time_revision_id=v.id),'[]'::jsonb)) order by v.revision)
        from public.event_work_time_revisions v where v.case_id=c.id),'[]'::jsonb) revisions,
      coalesce((select jsonb_agg(jsonb_build_object('kind',x.kind,'revision',x.revision,'reason',x.reason,
        'recorded_at',x.recorded_at) order by x.recorded_at,x.id) from public.event_work_time_events x where x.case_id=c.id),'[]'::jsonb) history
    from src s left join cases c on c.event_allocation_id=s.id
  )
  select coalesce(jsonb_agg(jsonb_build_object('allocation_id',id,'allocation_status',status,
    'allocation_revision',allocation_revision,'requirement_id',requirement_id,'event_id',event_id,
    'event_name',event_name,'event_status',event_status,'site_name',site_name,'reporting_point',reporting_point,
    'service_date',service_date,'report_at',report_at,'shift_starts_at',shift_starts_at,'shift_ends_at',shift_ends_at,
    'role_name',role_name,'area_label',area_label,'case_id',case_id,'status',case_status,'current_revision',current_revision,
    'revisions',revisions,'history',history,'attendance',private.attendance_summary_09a(id,person_id))
    order by report_at desc,id desc),'[]'::jsonb) into result from rows;
  return jsonb_build_object('items',result);
end $$;
revoke all on function public.event_work_time_self_read(uuid) from public,anon,authenticated,service_role;
grant execute on function public.event_work_time_self_read(uuid) to authenticated;

create function public.event_work_time_manager_read(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
  if actor is null or p_event is null or not (private.event_work_time_has_grant_10b(p_event,actor,'WORK_TIME_REVIEW')
      or private.event_work_time_has_grant_10b(p_event,actor,'WORK_TIME_APPROVE')) then
    raise exception 'Worked-time manager read denied'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('case_id',c.id,'allocation_id',c.event_allocation_id,
    'person_id',c.person_id,'person_name',p.display_name,'status',c.status,'current_revision',c.current_revision,
    'service_date',r.service_date,'report_at',r.report_at,'shift_starts_at',r.shift_starts_at,'shift_ends_at',r.shift_ends_at,
    'event_id',e.id,'event_name',e.name,'site_name',s.name,'role_name',role.display_name,'area_label',r.area_label,
    'revisions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'revision',v.revision,'kind',v.kind,
      'proposed_work_minutes',v.proposed_work_minutes,'evidence_status',v.evidence_status,
      'parent_revision',v.parent_revision,'author_person_id',v.author_person_id,'created_at',v.created_at,
      'submitted_at',v.submitted_at,'segments',coalesce((select jsonb_agg(jsonb_build_object('type',g.segment_type,
        'starts_at',g.starts_at,'ends_at',g.ends_at) order by g.segment_no)
        from public.event_work_time_segments g where g.case_id=v.case_id and g.revision=v.revision),'[]'::jsonb),
      'evidence',coalesce((select jsonb_agg(jsonb_build_object('event_id',ev.id,'event_revision',ev.revision,
        'observed_case_revision',x.observed_case_revision,
        'type',ev.event_type,'actual_at',ev.actual_at,'corrected_actual_at',ev.corrected_actual_at,
        'recorded_at',ev.recorded_at,'reason_code',ev.reason_code,'reason',ev.reason)
        order by ev.revision) from public.event_work_time_evidence x join public.attendance_events ev on ev.id=x.attendance_event_id
        where x.work_time_revision_id=v.id),'[]'::jsonb)) order by v.revision)
      from public.event_work_time_revisions v where v.case_id=c.id),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('kind',x.kind,'revision',x.revision,
      'actor_person_id',x.actor_person_id,'reason',x.reason,'recorded_at',x.recorded_at)
      order by x.recorded_at,x.id) from public.event_work_time_events x where x.case_id=c.id),'[]'::jsonb))
    order by r.report_at,p.display_name,c.id),'[]'::jsonb) into result
  from public.event_work_time_cases c
  join public.people p on p.id=c.person_id
  join public.event_staffing_requirements r on r.id=c.requirement_id and r.event_id=p_event
  join public.operational_events e on e.id=c.event_id
  join public.sites s on s.id=e.site_id
  join public.operational_role_definitions role on role.id=r.role_id
  where c.status in ('SUBMITTED','RETURNED','APPROVED','REVIEW_REQUIRED');
  return jsonb_build_object('items',result,'can_review',private.event_work_time_has_grant_10b(p_event,actor,'WORK_TIME_REVIEW'),
    'can_approve',private.event_work_time_has_grant_10b(p_event,actor,'WORK_TIME_APPROVE'));
end $$;
revoke all on function public.event_work_time_manager_read(uuid) from public,anon,authenticated,service_role;
grant execute on function public.event_work_time_manager_read(uuid) to authenticated;

create function public.event_work_time_self_action(
  p_allocation uuid,p_action text,p_expected_revision integer,p_segments jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.event_staff_allocations%rowtype;
  c public.event_work_time_cases%rowtype; v public.event_work_time_revisions%rowtype;
  prev public.event_work_time_idempotency%rowtype; seg record; n integer; work_count integer; minutes integer; hash text; result jsonb;
  evidence_case public.attendance_cases%rowtype; evidence_status text; has_in boolean; has_out boolean; bad boolean; exception_fact boolean;
begin
  if actor is null or not private.has_active_role('SECURITY_STAFF') or p_allocation is null
     or p_action is null or p_action not in ('SAVE_DRAFT','SUBMIT') or p_expected_revision is null or p_expected_revision<0
     or p_idempotency_key is null then raise exception 'Worked-time self action denied'; end if;
  hash:=md5(p_action||':'||p_allocation::text||':'||p_expected_revision::text||':'||coalesce(p_segments::text,''));
  perform pg_advisory_xact_lock(hashtext(actor::text),hashtext(p_idempotency_key::text));
  select * into prev from public.event_work_time_idempotency where actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prev.actor_person_id is not null then
    if prev.action<>p_action or prev.request_hash<>hash then raise exception 'Worked-time idempotency conflict'; end if;
    return prev.result;
  end if;
  select * into a from public.event_staff_allocations where id=p_allocation and person_id=actor for update;
  if a.id is null or a.status<>'ACCEPTED' then raise exception 'Worked-time allocation unavailable'; end if;
  if not exists(select 1 from public.event_staffing_requirements r join public.operational_events e on e.id=r.event_id
      where r.id=a.requirement_id and r.state<>'CANCELLED' and e.status<>'CANCELLED') then
    raise exception 'Worked-time Event source unavailable'; end if;
  select * into c from public.event_work_time_cases where event_allocation_id=a.id for update;
  if c.id is null then
    if p_action<>'SAVE_DRAFT' or p_expected_revision<>0 then raise exception 'Save a draft before submitting'; end if;
    perform set_config('kss.event_work_time_write_10b','allowed',true);
    insert into public.event_work_time_cases(event_allocation_id,requirement_id,event_id,person_id)
      select a.id,a.requirement_id,r.event_id,a.person_id from public.event_staffing_requirements r where r.id=a.requirement_id
      returning * into c;
  end if;
  if c.person_id<>actor or c.current_revision<>p_expected_revision then raise exception 'Stale worked-time revision'; end if;
  if p_action='SAVE_DRAFT' then
    if c.status not in ('DRAFT','RETURNED') or a.status<>'ACCEPTED' or p_segments is null
       or jsonb_typeof(p_segments)<>'array' or jsonb_array_length(p_segments)<1 or jsonb_array_length(p_segments)>50 then
      raise exception 'Worked-time draft invalid'; end if;
    if exists(select 1 from jsonb_to_recordset(p_segments) as x(kind text,"startAt" timestamptz,"endAt" timestamptz)
      where kind not in ('WORK','BREAK') or "startAt" is null or "endAt" is null
        or not isfinite("startAt") or not isfinite("endAt") or "endAt"<="startAt"
        or date_trunc('minute',"startAt")<>"startAt" or date_trunc('minute',"endAt")<>"endAt") then
      raise exception 'Worked-time interval invalid'; end if;
    select count(*)::integer,count(*) filter(where kind='WORK')::integer,
      coalesce(sum((extract(epoch from ("endAt"-"startAt"))/60)::integer) filter(where kind='WORK'),0)::integer
      into n,work_count,minutes
      from jsonb_to_recordset(p_segments) as x(kind text,"startAt" timestamptz,"endAt" timestamptz);
    if work_count<1 or minutes<=0 then raise exception 'Worked-time intervals are empty'; end if;
    perform set_config('kss.event_work_time_write_10b','allowed',true);
    insert into public.event_work_time_revisions(case_id,revision,kind,parent_revision,author_person_id,
      proposed_work_minutes,evidence_status)
      values(c.id,c.current_revision+1,'DRAFT',nullif(c.current_revision,0),actor,minutes,'NOT_SNAPSHOTTED') returning * into v;
    n:=0;
    for seg in select * from jsonb_to_recordset(p_segments) as x(kind text,"startAt" timestamptz,"endAt" timestamptz) loop
      n:=n+1;
      insert into public.event_work_time_segments(case_id,revision,segment_no,segment_type,starts_at,ends_at)
        values(c.id,v.revision,n,seg.kind,seg."startAt",seg."endAt");
    end loop;
    if exists(select 1 from public.event_work_time_segments x join public.event_work_time_segments y
        on x.case_id=y.case_id and x.revision=y.revision and x.segment_no<y.segment_no
        and tstzrange(x.starts_at,x.ends_at,'[)') && tstzrange(y.starts_at,y.ends_at,'[)')
        where x.case_id=c.id and x.revision=v.revision) then raise exception 'Worked-time intervals overlap'; end if;
    perform private.event_work_time_append_event_10b(c.id,v.id,v.revision,'DRAFT_SAVED',c.status,'DRAFT',actor,'PERSON',null,null);
    update public.event_work_time_cases set current_revision=v.revision,status='DRAFT',updated_at=transaction_timestamp() where id=c.id returning * into c;
    result:=jsonb_build_object('case_id',c.id,'revision_id',v.id,'revision',v.revision,'status','DRAFT','proposed_work_minutes',minutes);
  else
    if c.status not in ('DRAFT','RETURNED') or c.current_revision<1 or a.status<>'ACCEPTED' then raise exception 'Submission unavailable'; end if;
    select * into v from public.event_work_time_revisions where case_id=c.id and revision=c.current_revision and kind='DRAFT';
    if v.id is null then raise exception 'Current draft unavailable'; end if;
    select * into evidence_case from public.attendance_cases ac where ac.event_allocation_id=a.id and ac.person_id=actor;
    select exists(select 1 from public.attendance_events ev where ev.attendance_case_id=evidence_case.id and ev.event_type='CHECK_IN'),
      exists(select 1 from public.attendance_events ev where ev.attendance_case_id=evidence_case.id and ev.event_type='CHECK_OUT'),
      exists(select 1 from public.attendance_events ev where ev.attendance_case_id=evidence_case.id and ev.event_type='REVIEW_REQUIRED'
        and not exists(select 1 from public.attendance_events cr where cr.corrects_event_id=ev.id
          and cr.correction_code='RESOLVE_CANCELLED_ALLOCATION_REVIEW'))
        or exists(select 1 from public.attendance_events ev where ev.attendance_case_id=evidence_case.id and ev.event_type='NO_SHOW_RECORDED'
          and not exists(select 1 from public.attendance_events cr where cr.corrects_event_id=ev.id
            and cr.correction_code='RESOLVE_NO_SHOW_FOR_CHECK_IN')),
      exists(select 1 from public.attendance_events ev where ev.attendance_case_id=evidence_case.id
        and ev.event_type in ('NO_SHOW_RECORDED','EXCUSED_ABSENCE_RECORDED','CHECK_IN_NOT_POSSIBLE','REVIEW_REQUIRED'))
      into has_in,has_out,bad,exception_fact;
    evidence_status:=case when evidence_case.id is null or not exists(select 1 from public.attendance_events ev where ev.attendance_case_id=evidence_case.id) then 'MISSING'
      when bad then 'INCONSISTENT' when has_in and has_out and not exception_fact then 'COMPLETE' else 'INCOMPLETE' end;
    perform set_config('kss.event_work_time_write_10b','allowed',true);
    insert into public.event_work_time_revisions(case_id,revision,kind,parent_revision,author_person_id,
      proposed_work_minutes,evidence_status,attendance_case_revision,submitted_at)
      values(c.id,c.current_revision+1,'SUBMITTED',c.current_revision,actor,v.proposed_work_minutes,evidence_status,
        case when evidence_case.id is null then null else evidence_case.revision end,transaction_timestamp()) returning * into v;
    insert into public.event_work_time_segments(case_id,revision,segment_no,segment_type,starts_at,ends_at)
      select c.id,v.revision,segment_no,segment_type,starts_at,ends_at from public.event_work_time_segments
      where case_id=c.id and revision=c.current_revision;
    if evidence_case.id is not null then
      insert into public.event_work_time_evidence(work_time_revision_id,work_time_case_id,revision,
        attendance_case_id,attendance_event_id,event_allocation_id,person_id,observed_case_revision,observed_event_revision)
      select v.id,c.id,v.revision,evidence_case.id,ev.id,a.id,actor,evidence_case.revision,ev.revision
      from public.attendance_events ev where ev.attendance_case_id=evidence_case.id and ev.event_allocation_id=a.id and ev.person_id=actor;
    end if;
    perform private.event_work_time_append_event_10b(c.id,v.id,v.revision,'SUBMITTED',c.status,'SUBMITTED',actor,'PERSON',null,null);
    update public.event_work_time_cases set current_revision=v.revision,status='SUBMITTED',updated_at=transaction_timestamp() where id=c.id returning * into c;
    result:=jsonb_build_object('case_id',c.id,'revision_id',v.id,'revision',v.revision,'status','SUBMITTED',
      'proposed_work_minutes',v.proposed_work_minutes,'evidence_status',evidence_status);
  end if;
  insert into public.event_work_time_idempotency(actor_person_id,idempotency_key,action,request_hash,result)
    values(actor,p_idempotency_key,p_action,hash,result);
  return result;
end $$;
revoke all on function public.event_work_time_self_action(uuid,text,integer,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.event_work_time_self_action(uuid,text,integer,jsonb,uuid) to authenticated;

create function public.event_work_time_manager_action(
  p_event uuid,p_case uuid,p_action text,p_expected_revision integer,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); c public.event_work_time_cases%rowtype;
  v public.event_work_time_revisions%rowtype; we public.event_work_time_events%rowtype; prev public.event_work_time_idempotency%rowtype;
  hash text; to_status text; kind text; result jsonb; required_cap text; permission public.event_work_time_grants%rowtype;
begin
  if actor is null or p_event is null or p_case is null or p_expected_revision is null or p_expected_revision<1
    or p_action is null or p_action not in ('RETURN','APPROVE') or p_idempotency_key is null
    or (p_action='RETURN' and (p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]'))
    or (p_action='APPROVE' and p_reason is not null and (length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]')) then
    raise exception 'Worked-time manager action denied'; end if;
  required_cap:=case when p_action='RETURN' then 'WORK_TIME_REVIEW' else 'WORK_TIME_APPROVE' end;
  select * into permission from public.event_work_time_grants g where g.event_id=p_event and g.person_id=actor
    and g.capability=required_cap and g.revoked_at is null and g.effective_from<=transaction_timestamp()
    and g.effective_until>transaction_timestamp() for share;
  if permission.id is null then raise exception 'Worked-time manager action denied'; end if;
  hash:=md5(p_event::text||':'||p_case::text||':'||p_action||':'||p_expected_revision::text||':'||coalesce(trim(p_reason),''));
  perform pg_advisory_xact_lock(hashtext(actor::text),hashtext(p_idempotency_key::text));
  select * into prev from public.event_work_time_idempotency where actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prev.actor_person_id is not null then
    if prev.action<>p_action or prev.request_hash<>hash then raise exception 'Worked-time idempotency conflict'; end if;
    return prev.result;
  end if;
  select * into c from public.event_work_time_cases where id=p_case and event_id=p_event for update;
  if c.id is null or c.current_revision<>p_expected_revision or c.status not in ('SUBMITTED','REVIEW_REQUIRED') then
    raise exception 'Stale or unavailable work-time revision'; end if;
  select * into v from public.event_work_time_revisions where case_id=c.id and kind='SUBMITTED' order by revision desc limit 1;
  if v.id is null or v.author_person_id=actor or c.person_id=actor then raise exception 'Worked-time self approval denied'; end if;
  if p_action='APPROVE' and (c.status='REVIEW_REQUIRED' or c.status<>'SUBMITTED' or v.revision<>c.current_revision) then
    raise exception 'Return source-changed work time for correction'; end if;
  to_status:=case when p_action='RETURN' then 'RETURNED' else 'APPROVED' end;
  kind:=case when p_action='RETURN' then 'RETURNED' else 'WORKED_TIME_APPROVED' end;
  we:=private.event_work_time_append_event_10b(c.id,v.id,v.revision,kind,c.status,to_status,actor,'PERSON',nullif(trim(p_reason),''),null);
  perform set_config('kss.event_work_time_write_10b','allowed',true);
  update public.event_work_time_cases set status=to_status,updated_at=transaction_timestamp() where id=c.id returning * into c;
  result:=jsonb_build_object('case_id',c.id,'revision',c.current_revision,'status',to_status,'event_id',we.id);
  insert into public.event_work_time_idempotency(actor_person_id,idempotency_key,action,request_hash,result)
    values(actor,p_idempotency_key,p_action,hash,result);
  return result;
end $$;
revoke all on function public.event_work_time_manager_action(uuid,uuid,text,integer,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.event_work_time_manager_action(uuid,uuid,text,integer,text,uuid) to authenticated;


create function public.event_work_time_grants_admin(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
  if actor is null or not private.has_active_role('SUPER_ADMIN') or p_event is null
     or not exists(select 1 from public.operational_events where id=p_event) then raise exception 'Worked-time grant admin denied'; end if;
  select jsonb_build_object('grants',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'person_id',g.person_id,
      'person_name',p.display_name,'capability',g.capability,'effective_from',g.effective_from,
      'effective_until',g.effective_until,'revoked_at',g.revoked_at,'reason',g.reason,'revocation_reason',g.revocation_reason)
      order by g.created_at desc) from public.event_work_time_grants g join public.people p on p.id=g.person_id where g.event_id=p_event),'[]'::jsonb),
    'people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name) order by p.display_name,p.id)
      from public.people p where p.id<>actor and exists(select 1 from public.role_assignments ra where ra.person_id=p.id
        and ra.revoked_at is null and ra.effective_from<=transaction_timestamp()
        and (ra.effective_until is null or ra.effective_until>transaction_timestamp()))),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.event_work_time_grants_admin(uuid) from public,anon,authenticated,service_role;
grant execute on function public.event_work_time_grants_admin(uuid) to authenticated;

create function public.event_work_time_grant(
  p_event uuid,p_person uuid,p_capability text,p_effective_from timestamptz,p_effective_until timestamptz,p_reason text,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); prior public.event_work_time_idempotency%rowtype; g public.event_work_time_grants%rowtype; h text; result jsonb;
begin
  if actor is null or not private.has_active_role('SUPER_ADMIN') or p_event is null or p_person is null or p_person=actor
     or p_capability is null or p_capability not in ('WORK_TIME_REVIEW','WORK_TIME_APPROVE') or p_effective_from is null or p_effective_until is null
     or p_effective_until<=p_effective_from or p_reason is null or length(trim(p_reason)) not between 3 and 300
     or p_reason ~ '[[:cntrl:]]' or p_idempotency_key is null
     or not exists(select 1 from public.operational_events where id=p_event)
     or not exists(select 1 from public.role_assignments r where r.person_id=p_person and r.revoked_at is null
       and r.effective_from<=transaction_timestamp() and (r.effective_until is null or r.effective_until>transaction_timestamp())) then
    raise exception 'Worked-time grant denied'; end if;
  h:=md5(p_event::text||':'||p_person::text||':'||p_capability||':'||p_effective_from::text||':'||p_effective_until::text||':'||trim(p_reason));
  perform pg_advisory_xact_lock(hashtext(actor::text),hashtext(p_idempotency_key::text));
  select * into prior from public.event_work_time_idempotency where actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prior.actor_person_id is not null then
    if prior.action<>'GRANT' or prior.request_hash<>h then raise exception 'Worked-time idempotency conflict'; end if;
    return (prior.result->>'grant_id')::uuid;
  end if;
  perform set_config('kss.event_work_time_write_10b','allowed',true);
  insert into public.event_work_time_grants(event_id,person_id,capability,effective_from,effective_until,granted_by_person_id,reason)
    values(p_event,p_person,p_capability,p_effective_from,p_effective_until,actor,trim(p_reason)) returning * into g;
  insert into public.event_work_time_grant_events(grant_id,kind,event_id,person_id,capability,actor_person_id,effective_from,effective_until,reason)
    values(g.id,'GRANTED',p_event,p_person,p_capability,actor,p_effective_from,p_effective_until,trim(p_reason));
  result:=jsonb_build_object('grant_id',g.id);
  insert into public.event_work_time_idempotency(actor_person_id,idempotency_key,action,request_hash,result)
    values(actor,p_idempotency_key,'GRANT',h,result);
  return g.id;
end $$;
revoke all on function public.event_work_time_grant(uuid,uuid,text,timestamptz,timestamptz,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.event_work_time_grant(uuid,uuid,text,timestamptz,timestamptz,text,uuid) to authenticated;

create function public.event_work_time_grant_revoke(p_grant uuid,p_reason text,p_idempotency_key uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); g public.event_work_time_grants%rowtype; prior public.event_work_time_idempotency%rowtype; h text;
begin
  if actor is null or not private.has_active_role('SUPER_ADMIN') or p_grant is null or p_reason is null
     or length(trim(p_reason)) not between 3 and 300 or p_reason ~ '[[:cntrl:]]' or p_idempotency_key is null then
    raise exception 'Worked-time grant revoke denied'; end if;
  h:=md5(p_grant::text||':'||trim(p_reason));
  perform pg_advisory_xact_lock(hashtext(actor::text),hashtext(p_idempotency_key::text));
  select * into prior from public.event_work_time_idempotency where actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prior.actor_person_id is not null then
    if prior.action<>'REVOKE' or prior.request_hash<>h then raise exception 'Worked-time idempotency conflict'; end if;
    return (prior.result->>'revoked')::boolean;
  end if;
  select * into g from public.event_work_time_grants where id=p_grant for update;
  if g.id is null then raise exception 'Worked-time grant revoke denied'; end if;
  if g.revoked_at is null then
    perform set_config('kss.event_work_time_write_10b','allowed',true);
    update public.event_work_time_grants set revoked_at=transaction_timestamp(),revoked_by_person_id=actor,
      revocation_reason=trim(p_reason) where id=g.id;
    insert into public.event_work_time_grant_events(grant_id,kind,event_id,person_id,capability,actor_person_id,reason)
      values(g.id,'REVOKED',g.event_id,g.person_id,g.capability,actor,trim(p_reason));
  end if;
  perform set_config('kss.event_work_time_write_10b','allowed',true);
  insert into public.event_work_time_idempotency(actor_person_id,idempotency_key,action,request_hash,result)
    values(actor,p_idempotency_key,'REVOKE',h,jsonb_build_object('revoked',true));
  return true;
end $$;
revoke all on function public.event_work_time_grant_revoke(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.event_work_time_grant_revoke(uuid,text,uuid) to authenticated;

comment on table public.event_work_time_cases is 'TASK-10B Event-allocation-only worked-time workflow. Static allocations, payable and chargeable approvals are excluded.';
comment on table public.event_work_time_evidence is 'Immutable exact Event attendance evidence pins. Evidence never generates worked intervals.';
comment on table public.event_work_time_grants is 'Named, exact-Event, time-bounded work-time review/approval capabilities. Broad roles confer no approval rights.';
