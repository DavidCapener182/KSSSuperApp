-- TASK-21B. Explicit, synthetic-only management record. No source triggers.
create extension if not exists btree_gist;

create table public.service_deliveries (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.crm_organisations(id),
 site_id uuid not null references public.sites(id),
 site_client_link_id uuid not null,
 site_service_id uuid not null references public.site_services(id),
 start_source text not null check (start_source in ('MOBILISATION_HANDOVER','LEGACY_EXISTING')),
 mobilisation_id uuid references public.mobilisations(id),
 handover_decision_id uuid references public.mobilisation_decisions(id),
 legacy_reason_code text check (legacy_reason_code is null or legacy_reason_code='LEGACY_EXISTING_SERVICE'),
 legacy_explanation text check (legacy_explanation is null or (length(trim(legacy_explanation)) between 10 and 500 and legacy_explanation !~ '[[:cntrl:]]')),
 owner_person_id uuid not null references public.people(id),
 state text not null default 'PROPOSED' check (state in ('PROPOSED','ACTIVE','CLOSING','CLOSED','CANCELLED')),
 revision integer not null default 1 check (revision>0),
 created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 updated_at timestamptz not null default transaction_timestamp(),
 unique(site_service_id,site_client_link_id),
 foreign key(site_client_link_id,site_id,organisation_id) references public.site_client_links(id,site_id,organisation_id),
 check ((start_source='MOBILISATION_HANDOVER' and mobilisation_id is not null and handover_decision_id is not null and legacy_reason_code is null and legacy_explanation is null)
 or (start_source='LEGACY_EXISTING' and mobilisation_id is null and handover_decision_id is null and legacy_reason_code='LEGACY_EXISTING_SERVICE' and legacy_explanation is not null))
);
create index service_deliveries_list_idx on public.service_deliveries(created_at desc,id);

create table public.service_review_periods (
 id uuid primary key default gen_random_uuid(), service_delivery_id uuid not null references public.service_deliveries(id),
 name text not null check(length(trim(name)) between 3 and 120 and name !~ '[[:cntrl:]]'),
 starts_on date not null, ends_on date not null, owner_person_id uuid not null references public.people(id),
 state text not null default 'OPEN' check(state in ('OPEN','CLOSED')),
 revision integer not null default 1,
 created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(), closed_at timestamptz,
 check(ends_on>=starts_on),
 exclude using gist(service_delivery_id with =, daterange(starts_on,ends_on,'[]') with &&)
);
create index service_review_periods_delivery_idx on public.service_review_periods(service_delivery_id,starts_on,id);

create table public.service_review_meetings (
 id uuid primary key default gen_random_uuid(), period_id uuid not null references public.service_review_periods(id),
 scheduled_local timestamp without time zone not null,
 scheduled_at timestamptz not null,
 state text not null default 'SCHEDULED' check(state in ('SCHEDULED','HELD','CANCELLED')),
 held_local timestamp without time zone, held_at timestamptz,
 note text check(note is null or (length(trim(note)) between 3 and 1000 and note !~ '[[:cntrl:]]')),
 revision integer not null default 1,
 created_by_person_id uuid not null references public.people(id), created_at timestamptz not null default transaction_timestamp(),
 check((state='HELD' and held_at is not null and held_local is not null) or (state<>'HELD' and held_at is null and held_local is null))
);
create index service_review_meetings_period_idx on public.service_review_meetings(period_id,scheduled_at,id);

create table public.service_delivery_actions (
 id uuid primary key default gen_random_uuid(), service_delivery_id uuid not null references public.service_deliveries(id),
 period_id uuid references public.service_review_periods(id),
 title text not null check(length(trim(title)) between 3 and 180 and title !~ '[[:cntrl:]]'),
 category text not null check(category in ('SERVICE_REVIEW','STAFFING_REVIEW','EQUIPMENT_REVIEW','INSTRUCTIONS_REVIEW','CLIENT_FOLLOW_UP','OTHER')),
 owner_person_id uuid not null references public.people(id), due_on date,
 state text not null default 'OPEN' check(state in ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
 revision integer not null default 1, created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(), updated_at timestamptz not null default transaction_timestamp()
);
create index service_delivery_actions_delivery_idx on public.service_delivery_actions(service_delivery_id,state,id);

create table public.service_delivery_blockers (
 id uuid primary key default gen_random_uuid(), action_id uuid not null references public.service_delivery_actions(id),
 reason text not null check(length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]'),
 owner_person_id uuid not null references public.people(id),
 opened_by_person_id uuid not null references public.people(id), opened_at timestamptz not null default transaction_timestamp(),
 resolved_by_person_id uuid references public.people(id), resolved_at timestamptz,
 resolution_note text check(resolution_note is null or (length(trim(resolution_note)) between 3 and 500 and resolution_note !~ '[[:cntrl:]]')),
 revision integer not null default 1,
 check((resolved_at is null and resolved_by_person_id is null and resolution_note is null) or
 (resolved_at is not null and resolved_by_person_id is not null and resolution_note is not null))
);
create index service_delivery_blockers_action_idx on public.service_delivery_blockers(action_id,resolved_at,id);

create table public.service_delivery_history (
 id uuid primary key default gen_random_uuid(), service_delivery_id uuid not null references public.service_deliveries(id),
 kind text not null check(kind in ('CREATED','OWNER','STATE','PERIOD_CREATED','PERIOD_DATES','PERIOD_CLOSED','MEETING_CREATED','MEETING_RESCHEDULED','MEETING_HELD','MEETING_CANCELLED','ACTION_CREATED','ACTION_CHANGED','ACTION_STATE','BLOCKER_OPENED','BLOCKER_RESOLVED','BLOCKER_REOPENED')),
 subject_id uuid not null, actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default transaction_timestamp(),
 before_value jsonb, after_value jsonb, reason text,
 service_revision integer not null
);
create index service_delivery_history_page_idx on public.service_delivery_history(service_delivery_id,occurred_at,id);
create table public.service_delivery_requests (
 actor_person_id uuid not null references public.people(id), request_key uuid not null,
 payload_hash text not null, result jsonb not null,
 created_at timestamptz not null default transaction_timestamp(), primary key(actor_person_id,request_key)
);
do $$ declare t text; begin
 foreach t in array array['service_deliveries','service_review_periods','service_review_meetings','service_delivery_actions','service_delivery_blockers','service_delivery_history','service_delivery_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;

create function private.service_delivery_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); begin
 if actor is null or not (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')) then raise exception 'Service Delivery access denied'; end if;
 return actor;
end $$;
revoke all on function private.service_delivery_actor() from public,anon,authenticated;

create function private.service_delivery_owner_ok(target uuid, allow_super boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select target is not null and (exists(select 1 from public.role_assignments r where r.person_id=target and r.role_code='OFFICE_ADMIN' and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))
 or (allow_super and exists(select 1 from public.role_assignments r where r.person_id=target and r.role_code='SUPER_ADMIN' and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))))
$$;
revoke all on function private.service_delivery_owner_ok(uuid,boolean) from public,anon,authenticated;

create function private.service_delivery_local(value text) returns timestamptz
language plpgsql stable security definer set search_path='' as $$
declare wall timestamp; instant timestamptz; begin
 if value is null or value !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d$' then raise exception 'Invalid London wall time'; end if;
 wall:=replace(value,'T',' ')::timestamp;
 instant:=wall at time zone 'Europe/London';
 if (instant at time zone 'Europe/London')<>wall then raise exception 'Nonexistent London wall time'; end if;
 if ((instant-interval '1 hour') at time zone 'Europe/London')=wall or ((instant+interval '1 hour') at time zone 'Europe/London')=wall then raise exception 'Ambiguous London wall time'; end if;
 return instant;
end $$;
revoke all on function private.service_delivery_local(text) from public,anon,authenticated;

create function private.service_delivery_event(did uuid, event_kind text, sid uuid, actor uuid, old_value jsonb, new_value jsonb, why text) returns void
language plpgsql security definer set search_path='' as $$
declare rev integer; begin
 update public.service_deliveries set revision=revision+1,updated_at=transaction_timestamp() where id=did returning revision into rev;
 insert into public.service_delivery_history(service_delivery_id,kind,subject_id,actor_person_id,before_value,after_value,reason,service_revision)
 values(did,event_kind,sid,actor,old_value,new_value,why,rev);
end $$;
revoke all on function private.service_delivery_event(uuid,text,uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;

create function public.service_delivery_start(p_service uuid,p_link uuid,p_source text,p_mobilisation uuid,p_decision uuid,p_owner uuid,p_super_oversight boolean,p_reason_code text,p_explanation text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.service_delivery_actor(); prior public.service_delivery_requests%rowtype;
 digest text; source_row public.site_services%rowtype; mid public.mobilisations%rowtype; did uuid; result jsonb;
begin
 if p_key is null then raise exception 'Request key required'; end if;
 digest:=md5(jsonb_build_array(p_service,p_link,p_source,p_mobilisation,p_decision,p_owner,p_super_oversight,p_reason_code,p_explanation)::text);
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_key::text,0));
 select * into prior from public.service_delivery_requests where actor_person_id=actor and request_key=p_key;
 if found then if prior.payload_hash<>digest then raise exception 'Idempotency key conflict'; end if; return prior.result; end if;
 if not private.service_delivery_owner_ok(p_owner,p_super_oversight and private.has_active_role('SUPER_ADMIN')) then raise exception 'Owner ineligible'; end if;
 select * into source_row from public.site_services where id=p_service and site_client_link_id=p_link for share;
 if not found or not exists(select 1 from public.site_client_links l where l.id=p_link and l.site_id=source_row.site_id and l.organisation_id=source_row.organisation_id) then raise exception 'Exact source membership denied'; end if;
 if p_source='MOBILISATION_HANDOVER' then
  select * into mid from public.mobilisations where id=p_mobilisation and status='HANDED_OVER' and organisation_id=source_row.organisation_id for share;
  if not found or p_reason_code is not null or p_explanation is not null or not exists(
   select 1 from public.mobilisation_decisions d where d.id=p_decision and d.mobilisation_id=mid.id and d.kind='HANDOVER' and d.outcome='APPROVED' and d.occurred_at<=mid.handed_over_at
  ) or not exists(select 1 from public.mobilisation_links ml where ml.mobilisation_id=mid.id and ml.source_type='SITE_SERVICE' and ml.source_id=p_service and ml.unlinked_at is null and ml.linked_at<=mid.handed_over_at)
  then raise exception 'Exact 18A handover provenance denied'; end if;
 elsif p_source='LEGACY_EXISTING' then
  if p_mobilisation is not null or p_decision is not null or p_reason_code<>'LEGACY_EXISTING_SERVICE' or p_explanation is null or length(trim(p_explanation)) not between 10 and 500 or p_explanation ~ '[[:cntrl:]]' then raise exception 'Legacy start reason required'; end if;
 else raise exception 'Invalid start source'; end if;
 insert into public.service_deliveries(organisation_id,site_id,site_client_link_id,site_service_id,start_source,mobilisation_id,handover_decision_id,legacy_reason_code,legacy_explanation,owner_person_id,created_by_person_id)
 values(source_row.organisation_id,source_row.site_id,p_link,p_service,p_source,p_mobilisation,p_decision,p_reason_code,nullif(trim(p_explanation),''),p_owner,actor) returning id into did;
 insert into public.service_delivery_history(service_delivery_id,kind,subject_id,actor_person_id,after_value,service_revision,reason)
 values(did,'CREATED',did,actor,jsonb_build_object('source',p_source,'serviceId',p_service,'linkId',p_link,'mobilisationId',p_mobilisation,'handoverDecisionId',p_decision,'ownerId',p_owner,'reasonCode',p_reason_code),1,p_explanation);
 result:=jsonb_build_object('id',did,'revision',1);
 insert into public.service_delivery_requests(actor_person_id,request_key,payload_hash,result) values(actor,p_key,digest,result);
 return result;
end $$;
revoke all on function public.service_delivery_start(uuid,uuid,text,uuid,uuid,uuid,boolean,text,text,uuid) from public,anon,authenticated;
grant execute on function public.service_delivery_start(uuid,uuid,text,uuid,uuid,uuid,boolean,text,text,uuid) to authenticated;

create function public.service_delivery_change(p_id uuid,p_kind text,p_subject uuid,p_data jsonb,p_expected integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.service_delivery_actor(); prior public.service_delivery_requests%rowtype;
 d public.service_deliveries%rowtype; period public.service_review_periods%rowtype; meeting public.service_review_meetings%rowtype;
 action_row public.service_delivery_actions%rowtype; blocker public.service_delivery_blockers%rowtype;
 digest text; sid uuid; old_value jsonb; new_value jsonb; reason text:=nullif(trim(p_data->>'reason'),'');
 wall_time timestamptz; actual_time timestamptz; outstanding integer; result jsonb; state_text text;
begin
 if p_key is null or p_data is null or p_expected is null then raise exception 'Revision, data and request key required'; end if;
 digest:=md5(jsonb_build_array(p_id,p_kind,p_subject,p_data,p_expected)::text);
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_key::text,0));
 select * into prior from public.service_delivery_requests where actor_person_id=actor and request_key=p_key;
 if found then if prior.payload_hash<>digest then raise exception 'Idempotency key conflict'; end if; return prior.result; end if;
 select * into d from public.service_deliveries where id=p_id for update;
 if not found or d.revision<>p_expected or d.state in ('CLOSED','CANCELLED') then raise exception 'Stale or terminal Service Delivery'; end if;
 if not exists(select 1 from public.site_services s join public.site_client_links l on l.id=s.site_client_link_id where s.id=d.site_service_id and s.site_client_link_id=d.site_client_link_id and s.site_id=d.site_id and s.organisation_id=d.organisation_id and l.site_id=d.site_id and l.organisation_id=d.organisation_id) then raise exception 'Historical source membership changed'; end if;
 if p_kind in ('OWNER','STATE','PERIOD_DATES','PERIOD_CLOSED','MEETING_RESCHEDULED','MEETING_HELD','MEETING_CANCELLED','ACTION_CHANGED','ACTION_STATE','BLOCKER_RESOLVED','BLOCKER_REOPENED') and
 (reason is null or length(reason) not between 3 and 500 or reason ~ '[[:cntrl:]]') then raise exception 'Bounded reason required'; end if;
 case p_kind
 when 'OWNER' then
  sid:=d.id;
  if not private.service_delivery_owner_ok((p_data->>'ownerId')::uuid,coalesce((p_data->>'superOversight')::boolean,false) and private.has_active_role('SUPER_ADMIN')) then raise exception 'Replacement owner ineligible'; end if;
  old_value:=jsonb_build_object('ownerId',d.owner_person_id);
  update public.service_deliveries set owner_person_id=(p_data->>'ownerId')::uuid where id=p_id;
  new_value:=jsonb_build_object('ownerId',p_data->>'ownerId');
 when 'STATE' then
  sid:=d.id; state_text:=p_data->>'state';
  if not ((d.state='PROPOSED' and state_text in ('ACTIVE','CANCELLED')) or (d.state='ACTIVE' and state_text='CLOSING') or (d.state='CLOSING' and state_text='CLOSED')) then raise exception 'Invalid Service Delivery transition'; end if;
  if state_text in ('CLOSING','CLOSED') then
   select (select count(*) from public.service_review_periods where service_delivery_id=p_id and state='OPEN')+
    (select count(*) from public.service_delivery_actions where service_delivery_id=p_id and state not in ('DONE','CANCELLED'))+
    (select count(*) from public.service_delivery_blockers b join public.service_delivery_actions a on a.id=b.action_id where a.service_delivery_id=p_id and b.resolved_at is null) into outstanding;
   if outstanding>0 and (reason is null or length(reason)<10) then raise exception 'Outstanding work requires explanation'; end if;
  end if;
  old_value:=jsonb_build_object('state',d.state); new_value:=jsonb_build_object('state',state_text,'outstandingCount',coalesce(outstanding,0));
  update public.service_deliveries set state=state_text where id=p_id;
 when 'PERIOD_CREATED' then
  if d.state not in ('PROPOSED','ACTIVE','CLOSING') then raise exception 'Period creation denied'; end if;
  if not private.service_delivery_owner_ok((p_data->>'ownerId')::uuid,private.has_active_role('SUPER_ADMIN')) then raise exception 'Period owner ineligible'; end if;
  insert into public.service_review_periods(service_delivery_id,name,starts_on,ends_on,owner_person_id,created_by_person_id)
  values(p_id,p_data->>'name',(p_data->>'startsOn')::date,(p_data->>'endsOn')::date,(p_data->>'ownerId')::uuid,actor) returning id into sid;
  new_value:=jsonb_build_object('name',p_data->>'name','startsOn',p_data->>'startsOn','endsOn',p_data->>'endsOn','ownerId',p_data->>'ownerId');
 when 'PERIOD_DATES','PERIOD_CLOSED' then
  select * into period from public.service_review_periods where id=p_subject and service_delivery_id=p_id for update;
  if not found or period.state<>'OPEN' then raise exception 'Open period required'; end if;
  sid:=period.id;
  if p_kind='PERIOD_DATES' then
   if period.revision<>coalesce((p_data->>'subjectRevision')::integer,-1) then raise exception 'Stale period'; end if;
   old_value:=jsonb_build_object('startsOn',period.starts_on,'endsOn',period.ends_on);
   update public.service_review_periods set starts_on=(p_data->>'startsOn')::date,ends_on=(p_data->>'endsOn')::date,revision=revision+1 where id=sid;
   new_value:=jsonb_build_object('startsOn',p_data->>'startsOn','endsOn',p_data->>'endsOn');
  else
   old_value:=jsonb_build_object('state','OPEN');
   update public.service_review_periods set state='CLOSED',closed_at=transaction_timestamp(),revision=revision+1 where id=sid;
   new_value:=jsonb_build_object('state','CLOSED');
  end if;
 when 'MEETING_CREATED' then
  if not exists(select 1 from public.service_review_periods where id=(p_data->>'periodId')::uuid and service_delivery_id=p_id and state='OPEN') then raise exception 'Open period required'; end if;
  wall_time:=private.service_delivery_local(p_data->>'scheduledLocal');
  insert into public.service_review_meetings(period_id,scheduled_local,scheduled_at,created_by_person_id)
  values((p_data->>'periodId')::uuid,replace(p_data->>'scheduledLocal','T',' ')::timestamp,wall_time,actor) returning id into sid;
  new_value:=jsonb_build_object('periodId',p_data->>'periodId','scheduledLocal',p_data->>'scheduledLocal','scheduledAt',wall_time);
 when 'MEETING_RESCHEDULED','MEETING_HELD','MEETING_CANCELLED' then
  select m.* into meeting from public.service_review_meetings m join public.service_review_periods p on p.id=m.period_id where m.id=p_subject and p.service_delivery_id=p_id for update of m;
  if not found or meeting.state<>'SCHEDULED' or meeting.revision<>coalesce((p_data->>'subjectRevision')::integer,-1) or not exists(select 1 from public.service_review_periods where id=meeting.period_id and state='OPEN') then raise exception 'Stale or terminal meeting'; end if;
  sid:=meeting.id; old_value:=jsonb_build_object('state',meeting.state,'scheduledLocal',meeting.scheduled_local,'scheduledAt',meeting.scheduled_at);
  if p_kind='MEETING_RESCHEDULED' then
   wall_time:=private.service_delivery_local(p_data->>'scheduledLocal');
   update public.service_review_meetings set scheduled_local=replace(p_data->>'scheduledLocal','T',' ')::timestamp,scheduled_at=wall_time,revision=revision+1 where id=sid;
   new_value:=jsonb_build_object('state','SCHEDULED','scheduledLocal',p_data->>'scheduledLocal','scheduledAt',wall_time);
  elsif p_kind='MEETING_HELD' then
   actual_time:=private.service_delivery_local(p_data->>'heldLocal');
   update public.service_review_meetings set state='HELD',held_local=replace(p_data->>'heldLocal','T',' ')::timestamp,held_at=actual_time,note=p_data->>'note',revision=revision+1 where id=sid;
   new_value:=jsonb_build_object('state','HELD','heldLocal',p_data->>'heldLocal','heldAt',actual_time,'note',p_data->>'note');
  else
   update public.service_review_meetings set state='CANCELLED',revision=revision+1 where id=sid;
   new_value:=jsonb_build_object('state','CANCELLED');
  end if;
 when 'ACTION_CREATED' then
  if p_data->>'periodId' is not null and not exists(select 1 from public.service_review_periods where id=(p_data->>'periodId')::uuid and service_delivery_id=p_id) then raise exception 'Exact period denied'; end if;
  if not private.service_delivery_owner_ok((p_data->>'ownerId')::uuid,private.has_active_role('SUPER_ADMIN')) then raise exception 'Action owner ineligible'; end if;
  insert into public.service_delivery_actions(service_delivery_id,period_id,title,category,owner_person_id,due_on,created_by_person_id)
  values(p_id,(p_data->>'periodId')::uuid,p_data->>'title',p_data->>'category',(p_data->>'ownerId')::uuid,(p_data->>'dueOn')::date,actor) returning id into sid;
  new_value:=jsonb_build_object('title',p_data->>'title','category',p_data->>'category','ownerId',p_data->>'ownerId','periodId',p_data->>'periodId','dueOn',p_data->>'dueOn','state','OPEN');
 when 'ACTION_CHANGED','ACTION_STATE' then
  select * into action_row from public.service_delivery_actions where id=p_subject and service_delivery_id=p_id for update;
  if not found or action_row.revision<>coalesce((p_data->>'subjectRevision')::integer,-1) then raise exception 'Stale action'; end if;
  sid:=action_row.id; old_value:=jsonb_build_object('title',action_row.title,'category',action_row.category,'ownerId',action_row.owner_person_id,'dueOn',action_row.due_on,'state',action_row.state);
  if p_kind='ACTION_CHANGED' then
   if action_row.state='CANCELLED' or not private.service_delivery_owner_ok((p_data->>'ownerId')::uuid,private.has_active_role('SUPER_ADMIN')) then raise exception 'Action change denied'; end if;
   update public.service_delivery_actions set title=p_data->>'title',category=p_data->>'category',owner_person_id=(p_data->>'ownerId')::uuid,due_on=(p_data->>'dueOn')::date,revision=revision+1,updated_at=transaction_timestamp() where id=sid;
  else
   state_text:=p_data->>'state';
   if action_row.state='CANCELLED' or (action_row.state='DONE' and state_text<>'OPEN') or (action_row.state<>'DONE' and state_text not in ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED')) then raise exception 'Invalid action transition'; end if;
   if state_text='DONE' and exists(select 1 from public.service_delivery_blockers where action_id=sid and resolved_at is null) then raise exception 'Open blocker prevents DONE'; end if;
   update public.service_delivery_actions set state=state_text,revision=revision+1,updated_at=transaction_timestamp() where id=sid;
  end if;
  select jsonb_build_object('title',a.title,'category',a.category,'ownerId',a.owner_person_id,'dueOn',a.due_on,'state',a.state) into new_value from public.service_delivery_actions a where a.id=sid;
 when 'BLOCKER_OPENED' then
  select * into action_row from public.service_delivery_actions where id=(p_data->>'actionId')::uuid and service_delivery_id=p_id for update;
  if not found or action_row.state in ('DONE','CANCELLED') or not private.service_delivery_owner_ok((p_data->>'ownerId')::uuid,private.has_active_role('SUPER_ADMIN')) then raise exception 'Blocker action or owner denied'; end if;
  insert into public.service_delivery_blockers(action_id,reason,owner_person_id,opened_by_person_id)
  values(action_row.id,p_data->>'blockerReason',(p_data->>'ownerId')::uuid,actor) returning id into sid;
  new_value:=jsonb_build_object('actionId',action_row.id,'reason',p_data->>'blockerReason','ownerId',p_data->>'ownerId','state','OPEN');
 when 'BLOCKER_RESOLVED','BLOCKER_REOPENED' then
  select b.* into blocker from public.service_delivery_blockers b join public.service_delivery_actions a on a.id=b.action_id where b.id=p_subject and a.service_delivery_id=p_id for update of b;
  if not found or blocker.revision<>coalesce((p_data->>'subjectRevision')::integer,-1) then raise exception 'Stale blocker'; end if;
  sid:=blocker.id; old_value:=jsonb_build_object('state',case when blocker.resolved_at is null then 'OPEN' else 'RESOLVED' end,'resolutionNote',blocker.resolution_note);
  if p_kind='BLOCKER_RESOLVED' then
   if blocker.resolved_at is not null then raise exception 'Blocker already resolved'; end if;
   update public.service_delivery_blockers set resolved_by_person_id=actor,resolved_at=transaction_timestamp(),resolution_note=reason,revision=revision+1 where id=sid;
   new_value:=jsonb_build_object('state','RESOLVED','resolutionNote',reason);
  else
   if blocker.resolved_at is null or exists(select 1 from public.service_delivery_actions where id=blocker.action_id and state in ('DONE','CANCELLED')) then raise exception 'Blocker reopen denied'; end if;
   update public.service_delivery_blockers set resolved_by_person_id=null,resolved_at=null,resolution_note=null,revision=revision+1 where id=sid;
   new_value:=jsonb_build_object('state','OPEN');
  end if;
 else raise exception 'Unknown Service Delivery action'; end case;
 perform private.service_delivery_event(p_id,p_kind,sid,actor,old_value,new_value,reason);
 result:=jsonb_build_object('id',p_id,'subjectId',sid,'revision',p_expected+1);
 insert into public.service_delivery_requests(actor_person_id,request_key,payload_hash,result) values(actor,p_key,digest,result);
 return result;
end $$;
revoke all on function public.service_delivery_change(uuid,text,uuid,jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function public.service_delivery_change(uuid,text,uuid,jsonb,integer,uuid) to authenticated;

create function public.service_delivery_choices() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.service_delivery_actor();
 return jsonb_build_object(
  'owners',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'office',private.service_delivery_owner_ok(p.id,false),'super',private.service_delivery_owner_ok(p.id,true)) order by p.display_name),'[]'::jsonb)
   from public.people p where private.service_delivery_owner_ok(p.id,true)),
  'services',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'siteId',s.site_id,'siteName',site.name,'organisationId',s.organisation_id,'clientName',o.name,'linkId',s.site_client_link_id,'state',s.state,'handoverChoices',
   (select coalesce(jsonb_agg(jsonb_build_object('mobilisationId',m.id,'decisionId',d.id,'title',m.title)),'[]'::jsonb) from public.mobilisations m join public.mobilisation_decisions d on d.mobilisation_id=m.id and d.kind='HANDOVER' and d.outcome='APPROVED' join public.mobilisation_links ml on ml.mobilisation_id=m.id and ml.source_type='SITE_SERVICE' and ml.source_id=s.id and ml.unlinked_at is null where m.status='HANDED_OVER' and m.organisation_id=s.organisation_id)) order by o.name,site.name,s.name),'[]'::jsonb)
   from public.site_services s join public.sites site on site.id=s.site_id join public.crm_organisations o on o.id=s.organisation_id
   where not exists(select 1 from public.service_deliveries d where d.site_service_id=s.id and d.site_client_link_id=s.site_client_link_id))
 );
end $$;
revoke all on function public.service_delivery_choices() from public,anon,authenticated;
grant execute on function public.service_delivery_choices() to authenticated;

create function public.service_delivery_list(p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.service_delivery_actor();
 if p_offset<0 or p_offset>10000 or p_limit<1 or p_limit>50 then raise exception 'Invalid page'; end if;
 return jsonb_build_object('total',(select count(*) from public.service_deliveries),
 'items',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) from (
  select d.id,d.created_at,d.state,d.start_source,d.revision,d.owner_person_id,o.name client_name,si.name site_name,s.name service_name,
   private.service_delivery_owner_ok(d.owner_person_id,true) owner_eligible,
   (select count(*) from public.service_review_periods p where p.service_delivery_id=d.id and p.state='OPEN') open_period_count,
   (select count(*) from public.service_delivery_actions a where a.service_delivery_id=d.id and a.state not in ('DONE','CANCELLED')) open_action_count,
   (select count(*) from public.service_delivery_blockers b join public.service_delivery_actions a on a.id=b.action_id where a.service_delivery_id=d.id and b.resolved_at is null) open_blocker_count,
   (select min(m.scheduled_at) from public.service_review_meetings m join public.service_review_periods p on p.id=m.period_id where p.service_delivery_id=d.id and m.state='SCHEDULED') next_meeting_at
  from public.service_deliveries d join public.crm_organisations o on o.id=d.organisation_id join public.sites si on si.id=d.site_id join public.site_services s on s.id=d.site_service_id
  order by d.created_at desc,d.id limit p_limit offset p_offset
 ) x));
end $$;
revoke all on function public.service_delivery_list(integer,integer) from public,anon,authenticated;
grant execute on function public.service_delivery_list(integer,integer) to authenticated;

create function public.service_delivery_detail(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 perform private.service_delivery_actor();
 select jsonb_build_object('id',d.id,'organisationId',d.organisation_id,'clientName',o.name,'siteId',d.site_id,'siteName',si.name,
  'siteClientLinkId',d.site_client_link_id,'siteServiceId',d.site_service_id,'serviceName',s.name,'sourceState',s.state,
  'historicalLinkCurrent',l.effective_until is null,'sourceMembershipIntact',s.site_client_link_id=d.site_client_link_id and s.site_id=d.site_id and s.organisation_id=d.organisation_id,
  'startSource',d.start_source,'mobilisationId',d.mobilisation_id,'handoverDecisionId',d.handover_decision_id,'legacyReasonCode',d.legacy_reason_code,
  'legacyExplanation',d.legacy_explanation,'ownerId',d.owner_person_id,'ownerName',owner.display_name,'ownerEligible',private.service_delivery_owner_ok(d.owner_person_id,true),
  'state',d.state,'revision',d.revision,'createdAt',d.created_at,'createdBy',d.created_by_person_id,
  'periods',(select coalesce(jsonb_agg(to_jsonb(p) order by p.starts_on,p.id),'[]'::jsonb) from public.service_review_periods p where p.service_delivery_id=d.id),
  'meetings',(select coalesce(jsonb_agg(to_jsonb(m) order by m.scheduled_at,m.id),'[]'::jsonb) from public.service_review_meetings m join public.service_review_periods p on p.id=m.period_id where p.service_delivery_id=d.id),
  'actions',(select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at,a.id),'[]'::jsonb) from public.service_delivery_actions a where a.service_delivery_id=d.id),
  'blockers',(select coalesce(jsonb_agg(to_jsonb(b) order by b.opened_at,b.id),'[]'::jsonb) from public.service_delivery_blockers b join public.service_delivery_actions a on a.id=b.action_id where a.service_delivery_id=d.id),
  'openPeriodCount',(select count(*) from public.service_review_periods p where p.service_delivery_id=d.id and p.state='OPEN'),
  'openActionCount',(select count(*) from public.service_delivery_actions a where a.service_delivery_id=d.id and a.state not in ('DONE','CANCELLED')),
  'openBlockerCount',(select count(*) from public.service_delivery_blockers b join public.service_delivery_actions a on a.id=b.action_id where a.service_delivery_id=d.id and b.resolved_at is null),
  'nextMeetingAt',(select min(m.scheduled_at) from public.service_review_meetings m join public.service_review_periods p on p.id=m.period_id where p.service_delivery_id=d.id and m.state='SCHEDULED')
 ) into result
 from public.service_deliveries d join public.crm_organisations o on o.id=d.organisation_id join public.sites si on si.id=d.site_id join public.site_client_links l on l.id=d.site_client_link_id
 join public.site_services s on s.id=d.site_service_id join public.people owner on owner.id=d.owner_person_id where d.id=p_id;
 if result is null then raise exception 'Service Delivery unavailable'; end if;
 return result;
end $$;
revoke all on function public.service_delivery_detail(uuid) from public,anon,authenticated;
grant execute on function public.service_delivery_detail(uuid) to authenticated;

create function public.service_delivery_history_page(p_id uuid,p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.service_delivery_actor();
 if p_offset<0 or p_offset>100000 or p_limit<1 or p_limit>50 or not exists(select 1 from public.service_deliveries where id=p_id) then raise exception 'History unavailable'; end if;
 return jsonb_build_object('total',(select count(*) from public.service_delivery_history where service_delivery_id=p_id),
 'items',(select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at,x.id),'[]'::jsonb) from
  (select * from public.service_delivery_history where service_delivery_id=p_id order by occurred_at,id limit p_limit offset p_offset) x));
end $$;
revoke all on function public.service_delivery_history_page(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.service_delivery_history_page(uuid,integer,integer) to authenticated;
