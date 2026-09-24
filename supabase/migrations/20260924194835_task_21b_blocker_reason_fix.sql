create or replace function public.service_delivery_change(p_id uuid,p_kind text,p_subject uuid,p_data jsonb,p_expected integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.service_delivery_actor(); prior public.service_delivery_requests%rowtype;
 d public.service_deliveries%rowtype; period public.service_review_periods%rowtype; meeting public.service_review_meetings%rowtype;
 action_row public.service_delivery_actions%rowtype; blocker public.service_delivery_blockers%rowtype;
 digest text; sid uuid; old_value jsonb; new_value jsonb; change_reason text:=nullif(trim(p_data->>'reason'),'');
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
 (change_reason is null or length(change_reason) not between 3 and 500 or change_reason ~ '[[:cntrl:]]') then raise exception 'Bounded reason required'; end if;
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
   if outstanding>0 and (change_reason is null or length(change_reason)<10) then raise exception 'Outstanding work requires explanation'; end if;
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
   update public.service_delivery_blockers set resolved_by_person_id=actor,resolved_at=transaction_timestamp(),resolution_note=change_reason,revision=revision+1 where id=sid;
   new_value:=jsonb_build_object('state','RESOLVED','resolutionNote',change_reason);
  else
   if blocker.resolved_at is null or exists(select 1 from public.service_delivery_actions where id=blocker.action_id and state in ('DONE','CANCELLED')) then raise exception 'Blocker reopen denied'; end if;
   update public.service_delivery_blockers set resolved_by_person_id=null,resolved_at=null,resolution_note=null,revision=revision+1 where id=sid;
   new_value:=jsonb_build_object('state','OPEN');
  end if;
 else raise exception 'Unknown Service Delivery action'; end case;
 perform private.service_delivery_event(p_id,p_kind,sid,actor,old_value,new_value,change_reason);
 result:=jsonb_build_object('id',p_id,'subjectId',sid,'revision',p_expected+1);
 insert into public.service_delivery_requests(actor_person_id,request_key,payload_hash,result) values(actor,p_key,digest,result);
 return result;
end $$;
revoke all on function public.service_delivery_change(uuid,text,uuid,jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function public.service_delivery_change(uuid,text,uuid,jsonb,integer,uuid) to authenticated;
