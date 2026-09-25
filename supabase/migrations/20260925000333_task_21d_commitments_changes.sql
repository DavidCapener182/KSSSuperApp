-- TASK-21D. Synthetic Development only. No contractual confirmation or source write.
create table public.service_commitments (
 id uuid primary key default gen_random_uuid(),
 service_delivery_id uuid not null references public.service_deliveries(id),
 category text not null check (category in ('STAFFING','SERVICE_REVIEW','OPERATING_INSTRUCTION','EQUIPMENT','REPORTING','CLIENT_FOLLOW_UP','OTHER')),
 description text not null check (length(trim(description)) between 3 and 500 and description !~ '[[:cntrl:]]'),
 owner_person_id uuid not null references public.people(id),
 applies_from date not null,
 applies_until date,
 state text not null default 'PROPOSED_UNVERIFIED' check (state in ('PROPOSED_UNVERIFIED','ENDED','WITHDRAWN')),
 revision integer not null default 1 check (revision > 0),
 created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 updated_at timestamptz not null default transaction_timestamp(),
 check (applies_until is null or applies_until >= applies_from)
);
create index service_commitments_delivery_idx on public.service_commitments(service_delivery_id,created_at,id);

create table public.service_commitment_history (
 id uuid primary key default gen_random_uuid(),
 commitment_id uuid not null references public.service_commitments(id),
 kind text not null check (kind in ('CREATED','OWNER_REASSIGNED','ENDED','WITHDRAWN')),
 revision integer not null,
 actor_person_id uuid not null references public.people(id),
 reason text,
 before_value jsonb,
 after_value jsonb not null,
 occurred_at timestamptz not null default transaction_timestamp(),
 unique(commitment_id,revision)
);

create table public.service_change_grants (
 id uuid primary key default gen_random_uuid(),
 service_delivery_id uuid not null references public.service_deliveries(id),
 person_id uuid not null references public.people(id),
 capability text not null check (capability in ('SERVICE_CHANGE_PROPOSER','SERVICE_CHANGE_APPROVER','SERVICE_CHANGE_RECORDER')),
 effective_from timestamptz not null default transaction_timestamp(),
 effective_until timestamptz not null,
 granted_by_person_id uuid not null references public.people(id),
 granted_at timestamptz not null default transaction_timestamp(),
 reason text not null check (length(trim(reason)) between 3 and 500),
 revoked_at timestamptz,
 revoked_by_person_id uuid references public.people(id),
 revocation_reason text,
 check (effective_until > effective_from),
 check ((revoked_at is null and revoked_by_person_id is null and revocation_reason is null) or (revoked_at is not null and revoked_by_person_id is not null and revocation_reason is not null))
);
create unique index service_change_active_grant_idx on public.service_change_grants(service_delivery_id,person_id,capability) where revoked_at is null;
create index service_change_grant_person_idx on public.service_change_grants(person_id,service_delivery_id,capability);
create table public.service_change_grant_history (
 id uuid primary key default gen_random_uuid(),
 grant_id uuid not null references public.service_change_grants(id),
 kind text not null check (kind in ('GRANTED','REVOKED')),
 actor_person_id uuid not null references public.people(id),
 reason text not null,
 occurred_at timestamptz not null default transaction_timestamp(),
 unique(grant_id,kind)
);

create table public.service_change_requests (
 id uuid primary key default gen_random_uuid(),
 service_delivery_id uuid not null references public.service_deliveries(id),
 target_domain text not null default 'SITE_SERVICE' check (target_domain = 'SITE_SERVICE'),
 target_id uuid not null references public.site_services(id),
 baseline_revision integer not null check (baseline_revision > 0),
 baseline_event_id uuid not null references public.site_service_events(id),
 summary text not null check (length(trim(summary)) between 3 and 500 and summary !~ '[[:cntrl:]]'),
 reason text not null check (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]'),
 requested_effective_at timestamptz not null,
 owner_person_id uuid not null references public.people(id),
 related_change_id uuid references public.service_change_requests(id),
 state text not null default 'PROPOSED' check (state in ('PROPOSED','UNDER_REVIEW','APPROVED','REJECTED','WITHDRAWN')),
 application_outcome text check (application_outcome in ('APPLIED','NOT_APPLIED')),
 application_event_id uuid unique references public.site_service_events(id),
 application_revision integer,
 application_note text,
 application_recorded_at timestamptz,
 application_recorder_person_id uuid references public.people(id),
 proposer_person_id uuid not null references public.people(id),
 approver_person_id uuid references public.people(id),
 decided_at timestamptz,
 decision_reason text,
 revision integer not null default 1 check (revision > 0),
 created_at timestamptz not null default transaction_timestamp(),
 updated_at timestamptz not null default transaction_timestamp(),
 check ((application_outcome is null and application_event_id is null and application_revision is null and application_recorded_at is null and application_recorder_person_id is null) or
        (state='APPROVED' and application_outcome='APPLIED' and application_event_id is not null and application_revision is not null and application_recorded_at is not null and application_recorder_person_id is not null) or
        (state='APPROVED' and application_outcome='NOT_APPLIED' and application_event_id is null and application_revision is null and application_recorded_at is not null and application_recorder_person_id is not null))
);
create index service_changes_delivery_idx on public.service_change_requests(service_delivery_id,created_at,id);
create table public.service_change_history (
 id uuid primary key default gen_random_uuid(),
 change_id uuid not null references public.service_change_requests(id),
 kind text not null check (kind in ('PROPOSED','REVISED','UNDER_REVIEW','APPROVED','REJECTED','WITHDRAWN','APPLIED','NOT_APPLIED','OWNER_REASSIGNED')),
 revision integer not null,
 actor_person_id uuid not null references public.people(id),
 reason text,
 before_value jsonb,
 after_value jsonb not null,
 occurred_at timestamptz not null default transaction_timestamp(),
 unique(change_id,revision)
);
create table public.service_change_requests_idempotency (
 actor_person_id uuid not null references public.people(id),
 request_key uuid not null,
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default transaction_timestamp(),
 primary key(actor_person_id,request_key)
);

do $$ declare t text; begin
 foreach t in array array['service_commitments','service_commitment_history','service_change_grants','service_change_grant_history','service_change_requests','service_change_history','service_change_requests_idempotency'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

create function private.service_change_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Immutable Service Delivery history'; end $$;
create trigger immutable_commitment_history before update or delete on public.service_commitment_history for each row execute function private.service_change_immutable();
create trigger immutable_change_history before update or delete on public.service_change_history for each row execute function private.service_change_immutable();
create trigger immutable_grant_history before update or delete on public.service_change_grant_history for each row execute function private.service_change_immutable();

create function private.service_change_scope(p_delivery uuid) returns public.service_deliveries
language plpgsql stable security definer set search_path='' as $$
declare d public.service_deliveries%rowtype; begin
 perform private.service_delivery_actor();
 select * into d from public.service_deliveries where id=p_delivery;
 if not found or not exists (
  select 1 from public.site_services s join public.site_client_links l on l.id=s.site_client_link_id
  where s.id=d.site_service_id and s.site_client_link_id=d.site_client_link_id and s.site_id=d.site_id and s.organisation_id=d.organisation_id
   and l.site_id=d.site_id and l.organisation_id=d.organisation_id
 ) then raise exception 'Exact Service Delivery source unavailable'; end if;
 return d;
end $$;
revoke all on function private.service_change_scope(uuid) from public,anon,authenticated,service_role;

create function private.service_change_has_grant(p_delivery uuid,p_actor uuid,p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.service_delivery_owner_ok(p_actor,false) and exists (
  select 1 from public.service_change_grants g
  where g.service_delivery_id=p_delivery and g.person_id=p_actor and g.capability=p_capability
   and g.revoked_at is null and g.effective_from<=transaction_timestamp() and g.effective_until>transaction_timestamp()
 )
$$;
revoke all on function private.service_change_has_grant(uuid,uuid,text) from public,anon,authenticated,service_role;

create function private.service_change_reason(p_text text) returns text
language plpgsql immutable set search_path='' as $$
declare cleaned text:=trim(p_text); begin
 if cleaned is null or length(cleaned) not between 3 and 500 or cleaned ~ '[[:cntrl:]]' then raise exception 'Reason must be 3 to 500 plain characters'; end if;
 return cleaned;
end $$;
revoke all on function private.service_change_reason(text) from public,anon,authenticated,service_role;

create function public.service_change_grants_admin(p_delivery uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d public.service_deliveries%rowtype; begin
 d:=private.service_change_scope(p_delivery);
 if not private.has_active_role('SUPER_ADMIN') then raise exception 'Grant administration denied'; end if;
 return jsonb_build_object(
  'grants',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'personId',g.person_id,'personName',p.display_name,'capability',g.capability,'effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,'grantedAt',g.granted_at,'revokedAt',g.revoked_at,'reason',g.reason,'revocationReason',g.revocation_reason) order by g.granted_at desc,g.id),'[]'::jsonb)
   from public.service_change_grants g join public.people p on p.id=g.person_id where g.service_delivery_id=p_delivery),
  'eligiblePeople',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by p.display_name),'[]'::jsonb)
   from public.people p where private.service_delivery_owner_ok(p.id,false))
 );
end $$;
revoke all on function public.service_change_grants_admin(uuid) from public,anon,authenticated,service_role;
grant execute on function public.service_change_grants_admin(uuid) to authenticated;

create function public.service_change_grant_command(p_delivery uuid,p_grant uuid,p_person uuid,p_capability text,p_until timestamptz,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.service_delivery_actor(); d public.service_deliveries%rowtype; g public.service_change_grants%rowtype;
 prior public.service_change_requests_idempotency%rowtype; h text; result jsonb; why text:=private.service_change_reason(p_reason); begin
 if not private.has_active_role('SUPER_ADMIN') then raise exception 'Grant administration denied'; end if;
 if p_key is null then raise exception 'Request key required'; end if;
 h:=md5(jsonb_build_array('GRANT',p_delivery,p_grant,p_person,p_capability,p_until,why)::text);
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_key::text,0));
 select * into prior from public.service_change_requests_idempotency where actor_person_id=actor and request_key=p_key;
 if found then if prior.payload_hash<>h then raise exception 'Idempotency key conflict'; end if; return prior.result; end if;
 d:=private.service_change_scope(p_delivery);
 if p_grant is null then
  if p_capability not in ('SERVICE_CHANGE_PROPOSER','SERVICE_CHANGE_APPROVER','SERVICE_CHANGE_RECORDER') or not private.service_delivery_owner_ok(p_person,false) or p_until<=transaction_timestamp() or p_until>transaction_timestamp()+interval '366 days' then raise exception 'Invalid finite Office grant'; end if;
  insert into public.service_change_grants(service_delivery_id,person_id,capability,effective_until,granted_by_person_id,reason)
   values(p_delivery,p_person,p_capability,p_until,actor,why) returning * into g;
  insert into public.service_change_grant_history(grant_id,kind,actor_person_id,reason) values(g.id,'GRANTED',actor,why);
 else
  select * into g from public.service_change_grants where id=p_grant and service_delivery_id=p_delivery for update;
  if not found or g.revoked_at is not null then raise exception 'Grant unavailable'; end if;
  update public.service_change_grants set revoked_at=transaction_timestamp(),revoked_by_person_id=actor,revocation_reason=why where id=g.id;
  insert into public.service_change_grant_history(grant_id,kind,actor_person_id,reason) values(g.id,'REVOKED',actor,why);
 end if;
 result:=jsonb_build_object('id',g.id,'kind',case when p_grant is null then 'GRANTED' else 'REVOKED' end);
 insert into public.service_change_requests_idempotency(actor_person_id,request_key,payload_hash,result) values(actor,p_key,h,result);
 return result;
end $$;
revoke all on function public.service_change_grant_command(uuid,uuid,uuid,text,timestamptz,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.service_change_grant_command(uuid,uuid,uuid,text,timestamptz,text,uuid) to authenticated;

create function public.service_management_command(p_delivery uuid,p_entity text,p_kind text,p_subject uuid,p_data jsonb,p_expected integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.service_delivery_actor(); d public.service_deliveries%rowtype;
 c public.service_commitments%rowtype; change_row public.service_change_requests%rowtype;
 s public.site_services%rowtype; source_event public.site_service_events%rowtype;
 prior public.service_change_requests_idempotency%rowtype; h text; result jsonb;
 before_record jsonb; after_record jsonb; why text; new_state text; new_owner uuid; effective_time timestamptz;
begin
 if p_key is null or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Request key and payload required'; end if;
 h:=md5(jsonb_build_array('MANAGEMENT',p_delivery,p_entity,p_kind,p_subject,p_data,p_expected)::text);
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_key::text,0));
 select * into prior from public.service_change_requests_idempotency where actor_person_id=actor and request_key=p_key;
 if found then if prior.payload_hash<>h then raise exception 'Idempotency key conflict'; end if; return prior.result; end if;
 select * into d from public.service_deliveries where id=p_delivery for update;
 if not found or d.state in ('CLOSED','CANCELLED') then raise exception 'Service Delivery unavailable or terminal'; end if;
 -- The source relationship is checked under an exact source-row lock on each command.
 select * into s from public.site_services where id=d.site_service_id for share;
 if not found or s.site_client_link_id<>d.site_client_link_id or s.site_id<>d.site_id or s.organisation_id<>d.organisation_id or
  not exists(select 1 from public.site_client_links l where l.id=d.site_client_link_id and l.site_id=d.site_id and l.organisation_id=d.organisation_id)
 then raise exception 'Exact Service Delivery source changed'; end if;

 if p_entity='COMMITMENT' then
  if p_kind='CREATE' then
   if p_subject is not null or p_expected is not null or p_data->>'category' not in ('STAFFING','SERVICE_REVIEW','OPERATING_INSTRUCTION','EQUIPMENT','REPORTING','CLIENT_FOLLOW_UP','OTHER')
     or length(trim(p_data->>'description')) not between 3 and 500 or (p_data->>'description') ~ '[[:cntrl:]]'
     or not private.service_delivery_owner_ok((p_data->>'ownerId')::uuid,false) then raise exception 'Invalid proposed commitment'; end if;
   insert into public.service_commitments(service_delivery_id,category,description,owner_person_id,applies_from,applies_until,created_by_person_id)
    values(p_delivery,p_data->>'category',trim(p_data->>'description'),(p_data->>'ownerId')::uuid,(p_data->>'appliesFrom')::date,nullif(p_data->>'appliesUntil','')::date,actor) returning * into c;
   insert into public.service_commitment_history(commitment_id,kind,revision,actor_person_id,after_value)
    values(c.id,'CREATED',1,actor,jsonb_build_object('state',c.state,'category',c.category,'description',c.description,'ownerId',c.owner_person_id,'appliesFrom',c.applies_from,'appliesUntil',c.applies_until));
  else
   select * into c from public.service_commitments where id=p_subject and service_delivery_id=p_delivery for update;
   if not found or c.revision<>p_expected or c.state<>'PROPOSED_UNVERIFIED' then raise exception 'Stale or terminal commitment'; end if;
   why:=private.service_change_reason(p_data->>'reason');
   before_record:=jsonb_build_object('state',c.state,'ownerId',c.owner_person_id,'appliesUntil',c.applies_until);
   if p_kind='OWNER_REASSIGNED' then
    new_owner:=(p_data->>'ownerId')::uuid;
    if new_owner=c.owner_person_id or not private.service_delivery_owner_ok(new_owner,false) then raise exception 'Ineligible replacement owner'; end if;
    update public.service_commitments set owner_person_id=new_owner,revision=revision+1,updated_at=transaction_timestamp() where id=c.id;
   elsif p_kind in ('ENDED','WITHDRAWN') then
    if p_kind='ENDED' then
     if (p_data->>'endedOn')::date<c.applies_from or (p_data->>'endedOn')::date>current_date then raise exception 'Invalid ending date'; end if;
     update public.service_commitments set state='ENDED',applies_until=(p_data->>'endedOn')::date,revision=revision+1,updated_at=transaction_timestamp() where id=c.id;
    else
     update public.service_commitments set state='WITHDRAWN',revision=revision+1,updated_at=transaction_timestamp() where id=c.id;
    end if;
   else raise exception 'Unsupported commitment transition'; end if;
   select * into c from public.service_commitments where id=c.id;
   insert into public.service_commitment_history(commitment_id,kind,revision,actor_person_id,reason,before_value,after_value)
    values(c.id,p_kind,c.revision,actor,why,before_record,jsonb_build_object('state',c.state,'ownerId',c.owner_person_id,'appliesUntil',c.applies_until));
  end if;
  result:=jsonb_build_object('id',c.id,'revision',c.revision,'state',c.state);

 elsif p_entity='CHANGE' then
  if p_kind='PROPOSE' then
   if not private.service_change_has_grant(p_delivery,actor,'SERVICE_CHANGE_PROPOSER') then raise exception 'Proposal grant required'; end if;
   if p_subject is not null or p_expected is not null or (p_data->>'targetDomain') is distinct from 'SITE_SERVICE'
    or (p_data->>'targetId')::uuid<>d.site_service_id or (p_data->>'baselineRevision')::integer<>s.revision
    or length(trim(p_data->>'summary')) not between 3 and 500 or (p_data->>'summary') ~ '[[:cntrl:]]'
    or not private.service_delivery_owner_ok((p_data->>'ownerId')::uuid,false) then raise exception 'Invalid exact Site Service proposal'; end if;
   why:=private.service_change_reason(p_data->>'reason');
   effective_time:=private.service_delivery_local(p_data->>'requestedEffectiveLocal');
   if effective_time is null or effective_time<transaction_timestamp() then raise exception 'Retrospective change request denied'; end if;
   select * into source_event from public.site_service_events where service_id=s.id and new_revision=s.revision;
   if not found or source_event.id is distinct from (p_data->>'baselineEventId')::uuid then raise exception 'Exact baseline event mismatch'; end if;
   if nullif(p_data->>'relatedChangeId','') is not null and not exists(select 1 from public.service_change_requests r where r.id=(p_data->>'relatedChangeId')::uuid and r.service_delivery_id=p_delivery) then raise exception 'Related change out of scope'; end if;
   insert into public.service_change_requests(service_delivery_id,target_id,baseline_revision,baseline_event_id,summary,reason,requested_effective_at,owner_person_id,related_change_id,proposer_person_id)
    values(p_delivery,s.id,s.revision,source_event.id,trim(p_data->>'summary'),why,effective_time,(p_data->>'ownerId')::uuid,nullif(p_data->>'relatedChangeId','')::uuid,actor) returning * into change_row;
   insert into public.service_change_history(change_id,kind,revision,actor_person_id,reason,after_value)
    values(change_row.id,'PROPOSED',1,actor,why,jsonb_build_object('targetDomain','SITE_SERVICE','targetId',s.id,'baselineRevision',s.revision,'baselineEventId',source_event.id,'summary',change_row.summary,'requestedEffectiveAt',effective_time,'ownerId',change_row.owner_person_id));
  else
   select * into change_row from public.service_change_requests where id=p_subject and service_delivery_id=p_delivery for update;
   if not found or change_row.revision<>p_expected or change_row.target_id<>s.id then raise exception 'Stale or out-of-scope change'; end if;
   before_record:=jsonb_build_object('state',change_row.state,'summary',change_row.summary,'ownerId',change_row.owner_person_id,'applicationOutcome',change_row.application_outcome);
   why:=private.service_change_reason(p_data->>'reason');
   if p_kind in ('REVISED','OWNER_REASSIGNED','UNDER_REVIEW','WITHDRAWN') then
    if not private.service_change_has_grant(p_delivery,actor,'SERVICE_CHANGE_PROPOSER') then raise exception 'Proposal grant required'; end if;
    if change_row.state not in ('PROPOSED','UNDER_REVIEW') then raise exception 'Change already decided'; end if;
    if p_kind='REVISED' then
     if length(trim(p_data->>'summary')) not between 3 and 500 or (p_data->>'summary') ~ '[[:cntrl:]]' then raise exception 'Invalid revised summary'; end if;
     effective_time:=private.service_delivery_local(p_data->>'requestedEffectiveLocal');
     if effective_time<transaction_timestamp() then raise exception 'Retrospective revision denied'; end if;
     update public.service_change_requests set summary=trim(p_data->>'summary'),requested_effective_at=effective_time,revision=revision+1,updated_at=transaction_timestamp() where id=change_row.id;
    elsif p_kind='OWNER_REASSIGNED' then
     new_owner:=(p_data->>'ownerId')::uuid;
     if new_owner=change_row.owner_person_id or not private.service_delivery_owner_ok(new_owner,false) then raise exception 'Ineligible replacement owner'; end if;
     update public.service_change_requests set owner_person_id=new_owner,revision=revision+1,updated_at=transaction_timestamp() where id=change_row.id;
    elsif p_kind='UNDER_REVIEW' then
     if change_row.state<>'PROPOSED' then raise exception 'Already under review'; end if;
     update public.service_change_requests set state='UNDER_REVIEW',revision=revision+1,updated_at=transaction_timestamp() where id=change_row.id;
    else
     update public.service_change_requests set state='WITHDRAWN',revision=revision+1,updated_at=transaction_timestamp() where id=change_row.id;
    end if;
   elsif p_kind in ('APPROVED','REJECTED') then
    if not private.service_change_has_grant(p_delivery,actor,'SERVICE_CHANGE_APPROVER') or change_row.proposer_person_id=actor then raise exception 'Independent approver grant required'; end if;
    if change_row.state not in ('PROPOSED','UNDER_REVIEW') then raise exception 'Change already decided'; end if;
    if change_row.requested_effective_at<transaction_timestamp() then raise exception 'Retrospective management decision denied'; end if;
    if s.revision<>change_row.baseline_revision or not exists(select 1 from public.site_service_events e where e.id=change_row.baseline_event_id and e.service_id=s.id and e.new_revision=s.revision) then raise exception 'Source changed since proposal; deliberate review required'; end if;
    update public.service_change_requests set state=p_kind,approver_person_id=actor,decided_at=transaction_timestamp(),decision_reason=why,revision=revision+1,updated_at=transaction_timestamp() where id=change_row.id;
   elsif p_kind in ('APPLIED','NOT_APPLIED') then
    if not private.service_change_has_grant(p_delivery,actor,'SERVICE_CHANGE_RECORDER') or change_row.state<>'APPROVED' or change_row.application_outcome is not null then raise exception 'Application reconciliation denied'; end if;
    if p_kind='APPLIED' then
     select * into source_event from public.site_service_events where id=(p_data->>'sourceEventId')::uuid and service_id=s.id for share;
     if not found or source_event.previous_revision<>change_row.baseline_revision or source_event.new_revision<>s.revision or source_event.new_revision<=change_row.baseline_revision or source_event.occurred_at<change_row.decided_at
       or source_event.effective_on<(change_row.decided_at at time zone 'Europe/London')::date then raise exception 'Exact later source application not verified'; end if;
     update public.service_change_requests set application_outcome='APPLIED',application_event_id=source_event.id,application_revision=source_event.new_revision,application_recorded_at=transaction_timestamp(),application_recorder_person_id=actor,application_note=why,revision=revision+1,updated_at=transaction_timestamp() where id=change_row.id;
    else
     update public.service_change_requests set application_outcome='NOT_APPLIED',application_recorded_at=transaction_timestamp(),application_recorder_person_id=actor,application_note=why,revision=revision+1,updated_at=transaction_timestamp() where id=change_row.id;
    end if;
   else raise exception 'Unsupported change transition'; end if;
   select * into change_row from public.service_change_requests where id=change_row.id;
   insert into public.service_change_history(change_id,kind,revision,actor_person_id,reason,before_value,after_value)
    values(change_row.id,p_kind,change_row.revision,actor,why,before_record,jsonb_build_object('state',change_row.state,'summary',change_row.summary,'ownerId',change_row.owner_person_id,'applicationOutcome',change_row.application_outcome,'applicationEventId',change_row.application_event_id,'applicationRevision',change_row.application_revision));
  end if;
  result:=jsonb_build_object('id',change_row.id,'revision',change_row.revision,'state',change_row.state,'applicationOutcome',change_row.application_outcome);
 else raise exception 'Unsupported Service Delivery entity'; end if;
 insert into public.service_change_requests_idempotency(actor_person_id,request_key,payload_hash,result) values(actor,p_key,h,result);
 return result;
end $$;
revoke all on function public.service_management_command(uuid,text,text,uuid,jsonb,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.service_management_command(uuid,text,text,uuid,jsonb,integer,uuid) to authenticated;

create function public.service_management_detail(p_delivery uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d public.service_deliveries%rowtype; actor uuid:=private.service_delivery_actor(); begin
 d:=private.service_change_scope(p_delivery);
 return jsonb_build_object(
  'serviceDeliveryId',d.id,'siteId',d.site_id,'siteServiceId',d.site_service_id,'sourceRevision',(select revision from public.site_services where id=d.site_service_id),
  'sourceEventId',(select id from public.site_service_events where service_id=d.site_service_id order by new_revision desc limit 1),
  'permissions',jsonb_build_object('propose',private.service_change_has_grant(d.id,actor,'SERVICE_CHANGE_PROPOSER'),'approve',private.service_change_has_grant(d.id,actor,'SERVICE_CHANGE_APPROVER'),'record',private.service_change_has_grant(d.id,actor,'SERVICE_CHANGE_RECORDER'),'admin',private.has_active_role('SUPER_ADMIN')),
  'commitments',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'category',c.category,'description',c.description,'ownerId',c.owner_person_id,'ownerName',p.display_name,'appliesFrom',c.applies_from,'appliesUntil',c.applies_until,'state',c.state,'revision',c.revision,'createdAt',c.created_at,'history',
    (select coalesce(jsonb_agg(to_jsonb(h) order by h.revision),'[]'::jsonb) from public.service_commitment_history h where h.commitment_id=c.id)) order by c.created_at,c.id),'[]'::jsonb)
   from public.service_commitments c join public.people p on p.id=c.owner_person_id where c.service_delivery_id=d.id),
  'changes',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'targetDomain',r.target_domain,'targetId',r.target_id,'baselineRevision',r.baseline_revision,'baselineEventId',r.baseline_event_id,'summary',r.summary,'reason',r.reason,'requestedEffectiveAt',r.requested_effective_at,'ownerId',r.owner_person_id,'ownerName',p.display_name,'relatedChangeId',r.related_change_id,'state',r.state,'revision',r.revision,'proposerId',r.proposer_person_id,'approverId',r.approver_person_id,'decidedAt',r.decided_at,'applicationOutcome',r.application_outcome,'applicationEventId',r.application_event_id,'applicationRevision',r.application_revision,'applicationRecordedAt',r.application_recorded_at,'sourceChangedSinceApplication',r.application_revision is not null and s.revision<>r.application_revision,'createdAt',r.created_at,'history',
    (select coalesce(jsonb_agg(to_jsonb(h) order by h.revision),'[]'::jsonb) from public.service_change_history h where h.change_id=r.id)) order by r.created_at,r.id),'[]'::jsonb)
   from public.service_change_requests r join public.people p on p.id=r.owner_person_id join public.site_services s on s.id=r.target_id where r.service_delivery_id=d.id),
  'operationalDocumentTargetAvailable',false
 );
end $$;
revoke all on function public.service_management_detail(uuid) from public,anon,authenticated,service_role;
grant execute on function public.service_management_detail(uuid) to authenticated;
