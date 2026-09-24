-- TASK-12A: synthetic operational Incident reporting and narrow reviewer authority.
-- The submitter/reviewer interface is mediated only by fixed-search-path RPCs.

create table public.incident_reviewer_grants (
  id uuid primary key default gen_random_uuid(),
  reviewer_person_id uuid not null references public.people(id),
  effective_from timestamptz not null,
  effective_until timestamptz not null,
  granted_by_person_id uuid not null references public.people(id),
  grant_reason text not null check (length(trim(grant_reason)) between 3 and 300 and grant_reason !~ '[[:cntrl:]]'),
  revoked_at timestamptz,
  revoked_by_person_id uuid references public.people(id),
  revocation_reason text check (revocation_reason is null or (length(trim(revocation_reason)) between 3 and 300 and revocation_reason !~ '[[:cntrl:]]')),
  created_at timestamptz not null default transaction_timestamp(),
  check (effective_until > effective_from),
  check ((revoked_at is null and revoked_by_person_id is null and revocation_reason is null)
      or (revoked_at is not null and revoked_by_person_id is not null and revocation_reason is not null))
);
create unique index incident_reviewer_one_unrevoked_grant_idx
  on public.incident_reviewer_grants(reviewer_person_id) where revoked_at is null;
create index incident_reviewer_active_idx
  on public.incident_reviewer_grants(reviewer_person_id,effective_from,effective_until) where revoked_at is null;

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  reporter_person_id uuid not null references public.people(id),
  status text not null default 'OPEN' check (status in ('OPEN','ACKNOWLEDGED','ACTION_RECORDED','CLOSED','REOPENED')),
  revision integer not null default 1 check (revision > 0),
  current_report_version integer not null default 1 check (current_report_version > 0),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique(id,reporter_person_id)
);
create index incidents_reporter_created_idx on public.incidents(reporter_person_id,created_at desc,id);
create index incidents_review_queue_idx on public.incidents(status,created_at desc,id);

create table public.incident_report_versions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  version integer not null check (version > 0),
  occurred_at timestamptz not null check (isfinite(occurred_at)),
  category text not null check (category in ('SAFETY_HAZARD','INJURY_OR_ILLNESS_REPORTED','SECURITY_OCCURRENCE','PROPERTY_DAMAGE_OR_LOSS','SERVICE_DISRUPTION','OTHER_OPERATIONAL')),
  narrative text not null check (length(trim(narrative)) between 10 and 6000 and narrative !~ '[[:cntrl:]]'),
  event_id uuid references public.operational_events(id),
  site_id uuid references public.sites(id),
  site_service_id uuid references public.site_services(id),
  event_allocation_id uuid references public.event_staff_allocations(id),
  site_shift_allocation_id uuid references public.site_shift_allocations(id),
  recorded_by_person_id uuid not null references public.people(id),
  correction_reason text check (correction_reason is null or (length(trim(correction_reason)) between 3 and 500 and correction_reason !~ '[[:cntrl:]]')),
  recorded_at timestamptz not null default transaction_timestamp(),
  foreign key(incident_id,recorded_by_person_id) references public.incidents(id,reporter_person_id),
  unique(incident_id,version),
  check (num_nonnulls(event_allocation_id,site_shift_allocation_id) <= 1),
  check (event_id is null or site_service_id is null),
  check (event_allocation_id is null or site_service_id is null),
  check (site_shift_allocation_id is null or event_id is null)
);
create index incident_report_versions_current_idx on public.incident_report_versions(incident_id,version desc);
create index incident_report_versions_context_event_idx on public.incident_report_versions(event_id,site_id) where event_id is not null;
create index incident_report_versions_context_site_service_idx on public.incident_report_versions(site_service_id,site_id) where site_service_id is not null;
create index incident_report_versions_context_site_idx on public.incident_report_versions(site_id) where site_id is not null;

create table public.incident_external_parties (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  report_version integer not null,
  relationship text not null check (relationship in ('MEMBER_OF_PUBLIC','CLIENT_REPRESENTATIVE','CONTRACTOR','WITNESS','OTHER')),
  descriptor text not null check (length(trim(descriptor)) between 2 and 120 and descriptor !~ '[[:cntrl:]]'),
  created_at timestamptz not null default transaction_timestamp(),
  foreign key(incident_id,report_version) references public.incident_report_versions(incident_id,version),
  check (descriptor !~* '(@|https?://|www\.|\+?[0-9][0-9 ()-]{6,})')
);
create index incident_external_parties_version_idx on public.incident_external_parties(incident_id,report_version,id);

create table public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  revision integer not null check (revision > 0),
  kind text not null check (kind in ('REPORTED','CORRECTED','ACKNOWLEDGED','ACTION_RECORDED','CLOSED','REOPENED')),
  previous_status text check (previous_status is null or previous_status in ('OPEN','ACKNOWLEDGED','ACTION_RECORDED','CLOSED','REOPENED')),
  new_status text not null check (new_status in ('OPEN','ACKNOWLEDGED','ACTION_RECORDED','CLOSED','REOPENED')),
  report_version integer,
  action_code text check (action_code is null or action_code in ('AREA_MADE_SAFE','DUTY_MANAGER_CONTACTED','SERVICE_CONTINUED_WITH_CONTROL','SERVICE_PAUSED','EXTERNAL_PROCESS_REFERRED','FOLLOW_UP_REQUIRED','OTHER_OPERATIONAL_ACTION')),
  reason text check (reason is null or (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]')),
  actor_person_id uuid not null references public.people(id),
  recorded_at timestamptz not null default transaction_timestamp(),
  unique(incident_id,revision),
  foreign key(incident_id,report_version) references public.incident_report_versions(incident_id,version),
  check ((kind='ACTION_RECORDED' and action_code is not null) or (kind<>'ACTION_RECORDED' and action_code is null)),
  check ((kind in ('REOPENED','CORRECTED') and reason is not null) or (kind not in ('REOPENED','CORRECTED') and reason is null)),
  check ((kind='REPORTED' and previous_status is null and new_status='OPEN' and revision=1 and report_version=1)
    or (kind='CORRECTED' and previous_status=new_status and report_version is not null)
    or (kind='ACKNOWLEDGED' and previous_status='OPEN' and new_status='ACKNOWLEDGED')
    or (kind='ACTION_RECORDED' and previous_status in ('ACKNOWLEDGED','ACTION_RECORDED','REOPENED') and new_status='ACTION_RECORDED')
    or (kind='CLOSED' and previous_status='ACTION_RECORDED' and new_status='CLOSED')
    or (kind='REOPENED' and previous_status='CLOSED' and new_status='REOPENED'))
);
create index incident_events_history_idx on public.incident_events(incident_id,revision desc,id);

create table public.incident_reviewer_grant_events (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.incident_reviewer_grants(id),
  kind text not null check (kind in ('GRANTED','REVOKED')),
  reviewer_person_id uuid not null references public.people(id),
  actor_person_id uuid not null references public.people(id),
  effective_from timestamptz,
  effective_until timestamptz,
  reason text not null check (length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]'),
  recorded_at timestamptz not null default transaction_timestamp(),
  check ((kind='GRANTED' and effective_from is not null and effective_until is not null)
      or (kind='REVOKED' and effective_from is null and effective_until is null))
);
create index incident_reviewer_grant_events_idx on public.incident_reviewer_grant_events(grant_id,recorded_at,id);

create table public.incident_access_audit (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  actor_person_id uuid not null references public.people(id),
  action text not null check (action in ('DETAIL_READ')),
  purpose text not null check (purpose in ('OPERATIONAL_REVIEW','SUPER_ADMIN_OVERSIGHT')),
  recorded_at timestamptz not null default transaction_timestamp()
);
create index incident_access_audit_record_idx on public.incident_access_audit(incident_id,recorded_at desc);
create index incident_access_audit_actor_idx on public.incident_access_audit(actor_person_id,recorded_at desc);

create table public.incident_idempotency (
  id uuid primary key default gen_random_uuid(),
  actor_person_id uuid not null references public.people(id),
  idempotency_key uuid not null,
  request_kind text not null check (request_kind in ('SUBMIT','CORRECT','ACTION')),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{32}$'),
  incident_id uuid not null references public.incidents(id),
  event_id uuid not null references public.incident_events(id),
  created_at timestamptz not null default transaction_timestamp(),
  unique(actor_person_id,idempotency_key)
);
create index incident_idempotency_incident_idx on public.incident_idempotency(incident_id,created_at desc);

alter table public.incident_reviewer_grants enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_report_versions enable row level security;
alter table public.incident_external_parties enable row level security;
alter table public.incident_events enable row level security;
alter table public.incident_reviewer_grant_events enable row level security;
alter table public.incident_access_audit enable row level security;
alter table public.incident_idempotency enable row level security;
revoke all on public.incident_reviewer_grants,public.incidents,public.incident_report_versions,
  public.incident_external_parties,public.incident_events,public.incident_reviewer_grant_events,
  public.incident_access_audit,public.incident_idempotency from public,anon,authenticated;

create function private.incident_current_reviewer_12a(p_person uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select p_person is not null
    and exists(select 1 from public.role_assignments r where r.person_id=p_person and r.role_code='OPERATIONS'
      and r.revoked_at is null and r.effective_from<=transaction_timestamp()
      and (r.effective_until is null or r.effective_until>transaction_timestamp()))
    and exists(select 1 from public.incident_reviewer_grants g where g.reviewer_person_id=p_person
      and g.revoked_at is null and g.effective_from<=transaction_timestamp()
      and g.effective_until>transaction_timestamp())
$$;
revoke all on function private.incident_current_reviewer_12a(uuid) from public,anon,authenticated;

create function private.incident_resolve_context_12a(p_actor uuid,p_event uuid,p_site uuid,p_service uuid,
  p_event_allocation uuid,p_site_allocation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_event uuid:=p_event; v_site uuid:=p_site; v_service uuid:=p_service; parent_event uuid; parent_site uuid; parent_service uuid;
begin
  if p_actor is null then raise exception 'Incident context denied'; end if;
  if p_event is not null and p_service is not null then raise exception 'Incident context denied'; end if;
  if p_event_allocation is not null and p_site_allocation is not null then raise exception 'Incident context denied'; end if;
  if p_event_allocation is not null then
    select e.id,e.site_id into parent_event,parent_site
      from public.event_staff_allocations a
      join public.event_staffing_requirements r on r.id=a.requirement_id
      join public.operational_events e on e.id=r.event_id
      where a.id=p_event_allocation and a.person_id=p_actor;
    if not found then raise exception 'Incident context denied'; end if;
    if (v_event is not null and v_event<>parent_event) or (v_site is not null and v_site<>parent_site) then
      raise exception 'Incident context denied'; end if;
    v_event:=parent_event; v_site:=parent_site;
  end if;
  if p_site_allocation is not null then
    select s.id,s.site_id into parent_service,parent_site
      from public.site_shift_allocations a
      join public.site_shift_demands d on d.id=a.demand_id
      join public.site_services s on s.id=d.service_id
      where a.id=p_site_allocation and a.person_id=p_actor;
    if not found then raise exception 'Incident context denied'; end if;
    if (v_service is not null and v_service<>parent_service) or (v_site is not null and v_site<>parent_site) then
      raise exception 'Incident context denied'; end if;
    v_service:=parent_service; v_site:=parent_site;
  end if;
  if v_event is not null then
    select e.site_id into parent_site from public.operational_events e where e.id=v_event;
    if not found or (v_site is not null and v_site<>parent_site) then raise exception 'Incident context denied'; end if;
    if p_event_allocation is null and not exists(
      select 1 from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
      where a.person_id=p_actor and r.event_id=v_event) then raise exception 'Incident context denied'; end if;
    v_site:=parent_site;
  end if;
  if v_service is not null then
    select s.site_id into parent_site from public.site_services s where s.id=v_service;
    if not found or (v_site is not null and v_site<>parent_site) then raise exception 'Incident context denied'; end if;
    if p_site_allocation is null and not exists(
      select 1 from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
      where a.person_id=p_actor and d.service_id=v_service) then raise exception 'Incident context denied'; end if;
    v_site:=parent_site;
  end if;
  if v_site is not null and v_event is null and v_service is null and p_event_allocation is null and p_site_allocation is null
    and not exists(select 1 from public.site_assignments a where a.person_id=p_actor and a.site_id=v_site
      and a.revoked_at is null and a.effective_from<=transaction_timestamp()
      and (a.effective_until is null or a.effective_until>transaction_timestamp())) then
    raise exception 'Incident context denied';
  end if;
  return jsonb_build_object('event_id',v_event,'site_id',v_site,'site_service_id',v_service,
    'event_allocation_id',p_event_allocation,'site_shift_allocation_id',p_site_allocation);
end $$;
revoke all on function private.incident_resolve_context_12a(uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;

create function private.guard_incidents_12a() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'Incident history cannot be deleted'; end if;
  if current_setting('kss.incident_write_12a',true) is distinct from 'allowed' then raise exception 'Incident direct write denied'; end if;
  if tg_table_name='incidents' then
    if tg_op='INSERT' then
      if new.reporter_person_id is distinct from private.current_person_id() or new.status<>'OPEN' or new.revision<>1
        or new.current_report_version<>1 then raise exception 'Incident creation denied'; end if;
      return new;
    end if;
    if new.id is distinct from old.id or new.reporter_person_id is distinct from old.reporter_person_id
      or new.created_at is distinct from old.created_at or new.revision<>old.revision+1
      or new.current_report_version not between old.current_report_version and old.current_report_version+1 then
      raise exception 'Incident identity is immutable'; end if;
    return new;
  elsif tg_table_name='incident_reviewer_grants' then
    if tg_op='INSERT' then
      if new.granted_by_person_id is distinct from private.current_person_id() or new.revoked_at is not null then
        raise exception 'Incident grant creation denied'; end if;
      return new;
    end if;
    if new.id is distinct from old.id or new.reviewer_person_id is distinct from old.reviewer_person_id
      or new.effective_from is distinct from old.effective_from or new.effective_until is distinct from old.effective_until
      or new.granted_by_person_id is distinct from old.granted_by_person_id or new.grant_reason is distinct from old.grant_reason
      or new.created_at is distinct from old.created_at or old.revoked_at is not null
      or new.revoked_at is null or new.revoked_by_person_id is distinct from private.current_person_id()
      or new.revocation_reason is null then raise exception 'Incident grant history is immutable'; end if;
    return new;
  elsif tg_op<>'INSERT' then
    raise exception 'Incident history is immutable';
  end if;
  if tg_table_name='incident_report_versions' then
    if new.recorded_by_person_id is distinct from private.current_person_id() then raise exception 'Incident actor mismatch'; end if;
  elsif tg_table_name='incident_external_parties' then
    if not exists(select 1 from public.incident_report_versions v where v.incident_id=new.incident_id
      and v.version=new.report_version and v.recorded_by_person_id=private.current_person_id()) then raise exception 'Incident actor mismatch'; end if;
  elsif to_jsonb(new)->>'actor_person_id' is distinct from private.current_person_id()::text then
    raise exception 'Incident actor mismatch';
  end if;
  return new;
end $$;
revoke all on function private.guard_incidents_12a() from public,anon,authenticated;

create trigger guard_incidents_12a before insert or update or delete on public.incidents
  for each row execute function private.guard_incidents_12a();
create trigger guard_incident_reviewer_grants_12a before insert or update or delete on public.incident_reviewer_grants
  for each row execute function private.guard_incidents_12a();
create trigger guard_incident_report_versions_12a before insert or update or delete on public.incident_report_versions
  for each row execute function private.guard_incidents_12a();
create trigger guard_incident_external_parties_12a before insert or update or delete on public.incident_external_parties
  for each row execute function private.guard_incidents_12a();
create trigger guard_incident_events_12a before insert or update or delete on public.incident_events
  for each row execute function private.guard_incidents_12a();
create trigger guard_incident_reviewer_grant_events_12a before insert or update or delete on public.incident_reviewer_grant_events
  for each row execute function private.guard_incidents_12a();
create trigger guard_incident_access_audit_12a before insert or update or delete on public.incident_access_audit
  for each row execute function private.guard_incidents_12a();
create trigger guard_incident_idempotency_12a before insert or update or delete on public.incident_idempotency
  for each row execute function private.guard_incidents_12a();

create function private.incident_context_label_12a(p_incident uuid,p_version integer default null) returns text
language sql stable security definer set search_path='' as $$
  select coalesce(nullif(concat_ws(' · ',
    case when e.id is not null then 'Event: '||e.name end,
    case when s.id is not null then 'Site: '||s.name end,
    case when sv.id is not null then 'Service: '||sv.name end),''),'No linked context')
  from public.incidents i
  join public.incident_report_versions v on v.incident_id=i.id and v.version=coalesce(p_version,i.current_report_version)
  left join public.operational_events e on e.id=v.event_id
  left join public.sites s on s.id=v.site_id
  left join public.site_services sv on sv.id=v.site_service_id
  where i.id=p_incident
$$;
revoke all on function private.incident_context_label_12a(uuid,integer) from public,anon,authenticated;

create function public.incident_current_access() returns boolean
language sql stable security definer set search_path='' as $$
  select private.current_person_id() is not null and
    (private.has_active_role('SUPER_ADMIN') or private.incident_current_reviewer_12a(private.current_person_id()))
$$;
revoke all on function public.incident_current_access() from public,anon,authenticated;
grant execute on function public.incident_current_access() to authenticated;

create function public.incident_context_choices() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
  if actor is null or not private.has_active_role('SECURITY_STAFF') then raise exception 'Incident context denied'; end if;
  with choices as (
    select 'SITE'::text kind,s.id,s.name||' · Site' label from public.site_assignments a
      join public.sites s on s.id=a.site_id where a.person_id=actor and a.revoked_at is null
      and a.effective_from<=transaction_timestamp() and (a.effective_until is null or a.effective_until>transaction_timestamp())
    union
    select 'EVENT'::text,e.id,e.name||' · Event · '||s.name from public.event_staff_allocations a
      join public.event_staffing_requirements r on r.id=a.requirement_id join public.operational_events e on e.id=r.event_id
      join public.sites s on s.id=e.site_id where a.person_id=actor
    union
    select 'SITE_SERVICE'::text,sv.id,sv.name||' · Site service · '||s.name from public.site_shift_allocations a
      join public.site_shift_demands d on d.id=a.demand_id join public.site_services sv on sv.id=d.service_id
      join public.sites s on s.id=sv.site_id where a.person_id=actor
    union
    select 'EVENT_ALLOCATION'::text,a.id,e.name||' · '||r.area_label||' · Event allocation' from public.event_staff_allocations a
      join public.event_staffing_requirements r on r.id=a.requirement_id join public.operational_events e on e.id=r.event_id
      where a.person_id=actor
    union
    select 'SITE_SHIFT_ALLOCATION'::text,a.id,sv.name||' · '||d.area_label||' · Site allocation' from public.site_shift_allocations a
      join public.site_shift_demands d on d.id=a.demand_id join public.site_services sv on sv.id=d.service_id
      where a.person_id=actor
  ) select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'label',label) order by kind,label,id),'[]'::jsonb)
    into result from choices;
  return result;
end $$;
revoke all on function public.incident_context_choices() from public,anon,authenticated;
grant execute on function public.incident_context_choices() to authenticated;

create function public.incident_reviewer_grants_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if private.current_person_id() is null or not private.has_active_role('SUPER_ADMIN') then raise exception 'Incident grant access denied'; end if;
  with people_with_grants as (
    select distinct r.person_id from public.role_assignments r where r.role_code='OPERATIONS'
      and r.revoked_at is null and r.effective_from<=transaction_timestamp()
      and (r.effective_until is null or r.effective_until>transaction_timestamp())
    union select distinct g.reviewer_person_id from public.incident_reviewer_grants g
  )
  select coalesce(jsonb_agg(jsonb_build_object('personId',p.id,'displayName',p.display_name,
    'hasOperationsRole',exists(select 1 from public.role_assignments r where r.person_id=p.id and r.role_code='OPERATIONS'
      and r.revoked_at is null and r.effective_from<=transaction_timestamp()
      and (r.effective_until is null or r.effective_until>transaction_timestamp())),
    'grant',case when g.id is null then null else jsonb_build_object('id',g.id,'effectiveFrom',g.effective_from,
      'effectiveUntil',g.effective_until,'grantedBy',gp.display_name,'grantReason',g.grant_reason,
      'revokedAt',g.revoked_at,'revokedBy',rp.display_name,'revocationReason',g.revocation_reason,
      'active',g.revoked_at is null and g.effective_from<=transaction_timestamp() and g.effective_until>transaction_timestamp()) end)
    order by lower(p.display_name),p.id),'[]'::jsonb) into result
  from people_with_grants x join public.people p on p.id=x.person_id
  left join lateral (select g0.* from public.incident_reviewer_grants g0 where g0.reviewer_person_id=p.id order by g0.created_at desc,g0.id desc limit 1) g on true
  left join public.people gp on gp.id=g.granted_by_person_id left join public.people rp on rp.id=g.revoked_by_person_id;
  return result;
end $$;
revoke all on function public.incident_reviewer_grants_list() from public,anon,authenticated;
grant execute on function public.incident_reviewer_grants_list() to authenticated;

create function public.incident_reviewer_grant(p_reviewer uuid,p_last_active_date date,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid; starts_at timestamptz:=transaction_timestamp(); ends_at timestamptz;
begin
  if actor is null or not private.has_active_role('SUPER_ADMIN') or p_reviewer is null or p_last_active_date is null
    or p_last_active_date<private.uk_today() or p_reason is null or length(trim(p_reason)) not between 3 and 300
    or p_reason ~ '[[:cntrl:]]'
    or not exists(select 1 from public.role_assignments r where r.person_id=p_reviewer and r.role_code='OPERATIONS'
      and r.revoked_at is null and r.effective_from<=starts_at and (r.effective_until is null or r.effective_until>starts_at)) then
    raise exception 'Incident reviewer grant denied'; end if;
  ends_at:=(p_last_active_date+1)::timestamp at time zone 'Europe/London';
  if ends_at<=starts_at then raise exception 'Incident reviewer grant denied'; end if;
  perform set_config('kss.incident_write_12a','allowed',true);
  insert into public.incident_reviewer_grants(reviewer_person_id,effective_from,effective_until,granted_by_person_id,grant_reason)
    values(p_reviewer,starts_at,ends_at,actor,trim(p_reason)) returning id into result;
  insert into public.incident_reviewer_grant_events(grant_id,kind,reviewer_person_id,actor_person_id,effective_from,effective_until,reason)
    values(result,'GRANTED',p_reviewer,actor,starts_at,ends_at,trim(p_reason));
  return result;
end $$;
revoke all on function public.incident_reviewer_grant(uuid,date,text) from public,anon,authenticated;
grant execute on function public.incident_reviewer_grant(uuid,date,text) to authenticated;

create function public.incident_reviewer_revoke(p_grant uuid,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); g public.incident_reviewer_grants%rowtype;
begin
  if actor is null or not private.has_active_role('SUPER_ADMIN') or p_grant is null
    or p_reason is null or length(trim(p_reason)) not between 3 and 300 or p_reason ~ '[[:cntrl:]]' then
    raise exception 'Incident reviewer revoke denied'; end if;
  select * into g from public.incident_reviewer_grants where id=p_grant for update;
  if g.id is null or g.revoked_at is not null then raise exception 'Incident reviewer revoke denied'; end if;
  perform set_config('kss.incident_write_12a','allowed',true);
  update public.incident_reviewer_grants set revoked_at=transaction_timestamp(),revoked_by_person_id=actor,
    revocation_reason=trim(p_reason) where id=g.id;
  insert into public.incident_reviewer_grant_events(grant_id,kind,reviewer_person_id,actor_person_id,reason)
    values(g.id,'REVOKED',g.reviewer_person_id,actor,trim(p_reason));
  return true;
end $$;
revoke all on function public.incident_reviewer_revoke(uuid,text) from public,anon,authenticated;
grant execute on function public.incident_reviewer_revoke(uuid,text) to authenticated;

create function public.incident_submit(p_idempotency_key uuid,p_occurred_at timestamptz,p_category text,p_narrative text,
  p_event uuid default null,p_site uuid default null,p_site_service uuid default null,p_event_allocation uuid default null,
  p_site_shift_allocation uuid default null,p_external_parties jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); context jsonb; payload jsonb; request_hash text; prior public.incident_idempotency%rowtype;
  incident_id uuid; event_id uuid; result jsonb; party jsonb;
begin
  if actor is null or not private.has_active_role('SECURITY_STAFF') or p_idempotency_key is null
    or p_occurred_at is null or not isfinite(p_occurred_at) or p_occurred_at>transaction_timestamp()
    or p_category not in ('SAFETY_HAZARD','INJURY_OR_ILLNESS_REPORTED','SECURITY_OCCURRENCE','PROPERTY_DAMAGE_OR_LOSS','SERVICE_DISRUPTION','OTHER_OPERATIONAL')
    or p_narrative is null or length(trim(p_narrative)) not between 10 and 6000 or p_narrative ~ '[[:cntrl:]]'
    or p_external_parties is null or jsonb_typeof(p_external_parties)<>'array' or jsonb_array_length(p_external_parties)>3 then
    raise exception 'Invalid incident report'; end if;
  context:=private.incident_resolve_context_12a(actor,p_event,p_site,p_site_service,p_event_allocation,p_site_shift_allocation);
  for party in select value from jsonb_array_elements(p_external_parties) loop
    if jsonb_typeof(party)<>'object' or (select count(*) from jsonb_object_keys(party))<>2
      or party->>'relationship' not in ('MEMBER_OF_PUBLIC','CLIENT_REPRESENTATIVE','CONTRACTOR','WITNESS','OTHER')
      or length(trim(coalesce(party->>'descriptor',''))) not between 2 and 120
      or party->>'descriptor' ~ '[[:cntrl:]]'
      or party->>'descriptor' ~* '(@|https?://|www\.|\+?[0-9][0-9 ()-]{6,})' then raise exception 'Invalid external party descriptor'; end if;
  end loop;
  payload:=jsonb_build_object('occurred_at',p_occurred_at,'category',p_category,'narrative',trim(p_narrative),
    'context',context,'external_parties',p_external_parties);
  request_hash:=md5(payload::text);
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_idempotency_key::text,0));
  select * into prior from public.incident_idempotency where actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prior.id is not null then
    if prior.request_kind<>'SUBMIT' or prior.request_hash<>request_hash then raise exception 'Idempotency key payload mismatch'; end if;
    return jsonb_build_object('incidentId',prior.incident_id,'revision',1,'replayed',true);
  end if;
  perform set_config('kss.incident_write_12a','allowed',true);
  insert into public.incidents(reporter_person_id) values(actor) returning id into incident_id;
  insert into public.incident_report_versions(incident_id,version,occurred_at,category,narrative,event_id,site_id,site_service_id,
    event_allocation_id,site_shift_allocation_id,recorded_by_person_id)
    values(incident_id,1,p_occurred_at,p_category,trim(p_narrative),(context->>'event_id')::uuid,(context->>'site_id')::uuid,
      (context->>'site_service_id')::uuid,(context->>'event_allocation_id')::uuid,(context->>'site_shift_allocation_id')::uuid,actor);
  for party in select value from jsonb_array_elements(p_external_parties) loop
    insert into public.incident_external_parties(incident_id,report_version,relationship,descriptor)
      values(incident_id,1,party->>'relationship',trim(party->>'descriptor'));
  end loop;
  insert into public.incident_events(incident_id,revision,kind,new_status,report_version,actor_person_id)
    values(incident_id,1,'REPORTED','OPEN',1,actor) returning id into event_id;
  insert into public.incident_idempotency(actor_person_id,idempotency_key,request_kind,request_hash,incident_id,event_id)
    values(actor,p_idempotency_key,'SUBMIT',request_hash,incident_id,event_id);
  return jsonb_build_object('incidentId',incident_id,'revision',1,'replayed',false);
end $$;
revoke all on function public.incident_submit(uuid,timestamptz,text,text,uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.incident_submit(uuid,timestamptz,text,text,uuid,uuid,uuid,uuid,uuid,jsonb) to authenticated;

create function public.incident_correct(p_incident uuid,p_expected_revision integer,p_idempotency_key uuid,p_occurred_at timestamptz,
  p_category text,p_narrative text,p_reason text,p_event uuid default null,p_site uuid default null,p_site_service uuid default null,
  p_event_allocation uuid default null,p_site_shift_allocation uuid default null,p_external_parties jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); i public.incidents%rowtype; context jsonb; payload jsonb; request_hash text;
  prior public.incident_idempotency%rowtype; event_id uuid; next_revision integer; next_version integer; party jsonb;
begin
  if actor is null or not private.has_active_role('SECURITY_STAFF') or p_incident is null or p_expected_revision is null
    or p_idempotency_key is null or p_occurred_at is null or not isfinite(p_occurred_at) or p_occurred_at>transaction_timestamp()
    or p_category not in ('SAFETY_HAZARD','INJURY_OR_ILLNESS_REPORTED','SECURITY_OCCURRENCE','PROPERTY_DAMAGE_OR_LOSS','SERVICE_DISRUPTION','OTHER_OPERATIONAL')
    or p_narrative is null or length(trim(p_narrative)) not between 10 and 6000 or p_narrative ~ '[[:cntrl:]]'
    or p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]'
    or p_external_parties is null or jsonb_typeof(p_external_parties)<>'array' or jsonb_array_length(p_external_parties)>3 then
    raise exception 'Invalid incident correction'; end if;
  context:=private.incident_resolve_context_12a(actor,p_event,p_site,p_site_service,p_event_allocation,p_site_shift_allocation);
  for party in select value from jsonb_array_elements(p_external_parties) loop
    if jsonb_typeof(party)<>'object' or (select count(*) from jsonb_object_keys(party))<>2
      or party->>'relationship' not in ('MEMBER_OF_PUBLIC','CLIENT_REPRESENTATIVE','CONTRACTOR','WITNESS','OTHER')
      or length(trim(coalesce(party->>'descriptor',''))) not between 2 and 120 or party->>'descriptor' ~ '[[:cntrl:]]'
      or party->>'descriptor' ~* '(@|https?://|www\.|\+?[0-9][0-9 ()-]{6,})' then raise exception 'Invalid external party descriptor'; end if;
  end loop;
  payload:=jsonb_build_object('incident_id',p_incident,'expected_revision',p_expected_revision,'occurred_at',p_occurred_at,
    'category',p_category,'narrative',trim(p_narrative),'reason',trim(p_reason),'context',context,'external_parties',p_external_parties);
  request_hash:=md5(payload::text);
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_idempotency_key::text,0));
  select * into prior from public.incident_idempotency where actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prior.id is not null then
    if prior.request_kind<>'CORRECT' or prior.request_hash<>request_hash then raise exception 'Idempotency key payload mismatch'; end if;
    return jsonb_build_object('incidentId',prior.incident_id,'eventId',prior.event_id,'replayed',true);
  end if;
  select * into i from public.incidents where id=p_incident and reporter_person_id=actor for update;
  if i.id is null or i.revision<>p_expected_revision then raise exception 'Incident correction unavailable'; end if;
  next_revision:=i.revision+1; next_version:=i.current_report_version+1;
  perform set_config('kss.incident_write_12a','allowed',true);
  insert into public.incident_report_versions(incident_id,version,occurred_at,category,narrative,event_id,site_id,site_service_id,
    event_allocation_id,site_shift_allocation_id,recorded_by_person_id,correction_reason)
    values(i.id,next_version,p_occurred_at,p_category,trim(p_narrative),(context->>'event_id')::uuid,(context->>'site_id')::uuid,
      (context->>'site_service_id')::uuid,(context->>'event_allocation_id')::uuid,(context->>'site_shift_allocation_id')::uuid,actor,trim(p_reason));
  for party in select value from jsonb_array_elements(p_external_parties) loop
    insert into public.incident_external_parties(incident_id,report_version,relationship,descriptor)
      values(i.id,next_version,party->>'relationship',trim(party->>'descriptor'));
  end loop;
  update public.incidents set revision=next_revision,current_report_version=next_version,updated_at=transaction_timestamp() where id=i.id;
  insert into public.incident_events(incident_id,revision,kind,previous_status,new_status,report_version,reason,actor_person_id)
    values(i.id,next_revision,'CORRECTED',i.status,i.status,next_version,trim(p_reason),actor) returning id into event_id;
  insert into public.incident_idempotency(actor_person_id,idempotency_key,request_kind,request_hash,incident_id,event_id)
    values(actor,p_idempotency_key,'CORRECT',request_hash,i.id,event_id);
  return jsonb_build_object('incidentId',i.id,'eventId',event_id,'revision',next_revision,'reportVersion',next_version,'replayed',false);
end $$;
revoke all on function public.incident_correct(uuid,integer,uuid,timestamptz,text,text,text,uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.incident_correct(uuid,integer,uuid,timestamptz,text,text,text,uuid,uuid,uuid,uuid,uuid,jsonb) to authenticated;

create function public.incident_self_list(p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
  if actor is null or not private.has_active_role('SECURITY_STAFF') or p_offset is null or p_offset<0 or p_offset>10000
    or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Incident report list denied'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'status',q.status,'revision',q.revision,'createdAt',q.created_at,
    'occurredAt',q.occurred_at,'category',q.category,'contextLabel',private.incident_context_label_12a(q.id),
    'hasCorrection',q.current_report_version>1) order by q.created_at desc,q.id),'[]'::jsonb) into result
  from (select i.id,i.status,i.revision,i.created_at,i.current_report_version,v.occurred_at,v.category
    from public.incidents i join public.incident_report_versions v on v.incident_id=i.id and v.version=i.current_report_version
    where i.reporter_person_id=actor order by i.created_at desc,i.id offset p_offset limit p_limit) q;
  return jsonb_build_object('items',result);
end $$;
revoke all on function public.incident_self_list(integer,integer) from public,anon,authenticated;
grant execute on function public.incident_self_list(integer,integer) to authenticated;

create function public.incident_review_queue(p_offset integer default 0,p_limit integer default 25,p_include_closed boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if private.current_person_id() is null or not (private.has_active_role('SUPER_ADMIN') or private.incident_current_reviewer_12a(private.current_person_id()))
    or p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50
    or p_include_closed is null then raise exception 'Incident queue denied'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'status',q.status,'revision',q.revision,'createdAt',q.created_at,
    'occurredAt',q.occurred_at,'category',q.category,'contextLabel',private.incident_context_label_12a(q.id),
    'reporterName',q.reporter_name) order by q.created_at desc,q.id),'[]'::jsonb) into result
  from (select i.id,i.status,i.revision,i.created_at,v.occurred_at,v.category,p.display_name reporter_name
    from public.incidents i join public.incident_report_versions v on v.incident_id=i.id and v.version=i.current_report_version
    join public.people p on p.id=i.reporter_person_id
    where p_include_closed or i.status<>'CLOSED'
    order by i.created_at desc,i.id offset p_offset limit p_limit) q;
  return jsonb_build_object('items',result);
end $$;
revoke all on function public.incident_review_queue(integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.incident_review_queue(integer,integer,boolean) to authenticated;

create function public.incident_detail(p_incident uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); i public.incidents%rowtype; own_record boolean; reviewer boolean; report_rows jsonb; event_rows jsonb; result jsonb;
begin
  if actor is null or p_incident is null then raise exception 'Incident unavailable'; end if;
  reviewer:=private.has_active_role('SUPER_ADMIN') or private.incident_current_reviewer_12a(actor);
  select * into i from public.incidents where id=p_incident;
  if i.id is null then raise exception 'Incident unavailable'; end if;
  own_record:=i.reporter_person_id=actor and private.has_active_role('SECURITY_STAFF');
  if not reviewer and not own_record then raise exception 'Incident unavailable'; end if;
  if reviewer then
    perform set_config('kss.incident_write_12a','allowed',true);
    insert into public.incident_access_audit(incident_id,actor_person_id,action,purpose)
      values(i.id,actor,'DETAIL_READ',case when private.has_active_role('SUPER_ADMIN') then 'SUPER_ADMIN_OVERSIGHT' else 'OPERATIONAL_REVIEW' end);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('version',v.version,'occurredAt',v.occurred_at,'category',v.category,
    'narrative',v.narrative,'contextLabel',private.incident_context_label_12a(i.id,v.version),'correctionReason',v.correction_reason,
    'context',jsonb_build_object('eventId',v.event_id,'siteId',v.site_id,'siteServiceId',v.site_service_id,
      'eventAllocationId',v.event_allocation_id,'siteShiftAllocationId',v.site_shift_allocation_id),
    'recordedAt',v.recorded_at,'externalParties',coalesce((select jsonb_agg(jsonb_build_object('relationship',x.relationship,'descriptor',x.descriptor)
      order by x.id) from public.incident_external_parties x where x.incident_id=v.incident_id and x.report_version=v.version),'[]'::jsonb))
    order by v.version),'[]'::jsonb) into report_rows from public.incident_report_versions v where v.incident_id=i.id;
  select coalesce(jsonb_agg(jsonb_build_object('kind',e.kind,'status',e.new_status,'actionCode',case when reviewer then e.action_code else null end,
    'reason',case when reviewer then e.reason else null end,'actorName',case when reviewer then p.display_name else null end,
    'recordedAt',e.recorded_at) order by e.revision),'[]'::jsonb) into event_rows
    from public.incident_events e join public.people p on p.id=e.actor_person_id where e.incident_id=i.id;
  select jsonb_build_object('id',i.id,'reporterName',case when reviewer then p.display_name else null end,
    'status',i.status,'revision',i.revision,'reportVersion',i.current_report_version,'createdAt',i.created_at,
    'reports',report_rows,'events',event_rows,'viewerCanReview',reviewer,'viewerOwnReport',own_record)
    into result from public.people p where p.id=i.reporter_person_id;
  return result;
end $$;
revoke all on function public.incident_detail(uuid) from public,anon,authenticated;
grant execute on function public.incident_detail(uuid) to authenticated;

create function public.incident_review_action(p_incident uuid,p_expected_revision integer,p_idempotency_key uuid,
  p_action text,p_action_code text default null,p_reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); i public.incidents%rowtype; prior public.incident_idempotency%rowtype;
  new_status text; request_hash text; payload jsonb; event_id uuid; next_revision integer;
begin
  if actor is null or p_incident is null or p_expected_revision is null or p_idempotency_key is null or p_action is null
    or p_action not in ('ACKNOWLEDGE','ACTION_RECORDED','CLOSE','REOPEN') then raise exception 'Incident action denied'; end if;
  if not (private.has_active_role('SUPER_ADMIN') or private.incident_current_reviewer_12a(actor)) then raise exception 'Incident action denied'; end if;
  if (p_action='ACTION_RECORDED' and (p_action_code is null or p_action_code not in ('AREA_MADE_SAFE','DUTY_MANAGER_CONTACTED','SERVICE_CONTINUED_WITH_CONTROL','SERVICE_PAUSED','EXTERNAL_PROCESS_REFERRED','FOLLOW_UP_REQUIRED','OTHER_OPERATIONAL_ACTION')))
    or (p_action<>'ACTION_RECORDED' and p_action_code is not null)
    or (p_action='REOPEN' and (p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]'))
    or (p_action<>'REOPEN' and p_reason is not null) then raise exception 'Incident action denied'; end if;
  payload:=jsonb_build_object('incident_id',p_incident,'expected_revision',p_expected_revision,'action',p_action,'action_code',p_action_code,'reason',p_reason);
  request_hash:=md5(payload::text);
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_idempotency_key::text,0));
  select * into prior from public.incident_idempotency where actor_person_id=actor and idempotency_key=p_idempotency_key;
  if prior.id is not null then
    if prior.request_kind<>'ACTION' or prior.request_hash<>request_hash then raise exception 'Idempotency key payload mismatch'; end if;
    return jsonb_build_object('incidentId',prior.incident_id,'eventId',prior.event_id,'replayed',true);
  end if;
  select * into i from public.incidents where id=p_incident for update;
  if i.id is null or i.revision<>p_expected_revision then raise exception 'Incident action unavailable'; end if;
  if p_action='ACKNOWLEDGE' and i.status='OPEN' then new_status:='ACKNOWLEDGED';
  elsif p_action='ACTION_RECORDED' and i.status in ('ACKNOWLEDGED','ACTION_RECORDED','REOPENED') then new_status:='ACTION_RECORDED';
  elsif p_action='CLOSE' and i.status='ACTION_RECORDED' then new_status:='CLOSED';
  elsif p_action='REOPEN' and i.status='CLOSED' then new_status:='REOPENED';
  else raise exception 'Incident action unavailable'; end if;
  next_revision:=i.revision+1;
  perform set_config('kss.incident_write_12a','allowed',true);
  update public.incidents set status=new_status,revision=next_revision,updated_at=transaction_timestamp() where id=i.id;
  insert into public.incident_events(incident_id,revision,kind,previous_status,new_status,action_code,reason,actor_person_id)
    values(i.id,next_revision,case when p_action='ACKNOWLEDGE' then 'ACKNOWLEDGED' else p_action end,
      i.status,new_status,p_action_code,case when p_action='REOPEN' then trim(p_reason) else null end,actor)
    returning id into event_id;
  insert into public.incident_idempotency(actor_person_id,idempotency_key,request_kind,request_hash,incident_id,event_id)
    values(actor,p_idempotency_key,'ACTION',request_hash,i.id,event_id);
  return jsonb_build_object('incidentId',i.id,'eventId',event_id,'revision',next_revision,'status',new_status,'replayed',false);
end $$;
revoke all on function public.incident_review_action(uuid,integer,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.incident_review_action(uuid,integer,uuid,text,text,text) to authenticated;

comment on table public.incidents is 'TASK-12A operational Incident aggregate; synthetic Dev first slice; all read/write through guarded RPCs.';
comment on table public.incident_report_versions is 'Immutable report snapshots; corrections append a new version and preserve prior narrative.';
comment on table public.incident_reviewer_grants is 'Narrow Incident-only grant; active Operations role is independently required on every reviewer operation.';
comment on table public.incident_access_audit is 'Attributable detail-read metadata; never stores report narrative or participant descriptors.';
