-- TASK-21D forward correction: require a caller-observed parent or exact source revision on creation.
create or replace function public.service_management_command(p_delivery uuid,p_entity text,p_kind text,p_subject uuid,p_data jsonb,p_expected integer,p_key uuid)
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
   if p_subject is not null or p_expected is distinct from d.revision or p_data->>'category' not in ('STAFFING','SERVICE_REVIEW','OPERATING_INSTRUCTION','EQUIPMENT','REPORTING','CLIENT_FOLLOW_UP','OTHER')
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
   if p_subject is not null or p_expected is distinct from s.revision or (p_data->>'targetDomain') is distinct from 'SITE_SERVICE'
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
