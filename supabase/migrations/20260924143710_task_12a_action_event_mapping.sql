-- TASK-12A: map the UI action vocabulary to the incident lifecycle event vocabulary.
create or replace function public.incident_review_action(p_incident uuid,p_expected_revision integer,p_idempotency_key uuid,
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
    values(i.id,next_revision,case p_action when 'ACKNOWLEDGE' then 'ACKNOWLEDGED' when 'CLOSE' then 'CLOSED' when 'REOPEN' then 'REOPENED' else p_action end,
      i.status,new_status,p_action_code,case when p_action='REOPEN' then trim(p_reason) else null end,actor)
    returning id into event_id;
  insert into public.incident_idempotency(actor_person_id,idempotency_key,request_kind,request_hash,incident_id,event_id)
    values(actor,p_idempotency_key,'ACTION',request_hash,i.id,event_id);
  return jsonb_build_object('incidentId',i.id,'eventId',event_id,'revision',next_revision,'status',new_status,'replayed',false);
end $$;
revoke all on function public.incident_review_action(uuid,integer,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.incident_review_action(uuid,integer,uuid,text,text,text) to authenticated;
