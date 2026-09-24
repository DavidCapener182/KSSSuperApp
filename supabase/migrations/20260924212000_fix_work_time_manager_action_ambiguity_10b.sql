-- Qualify revision columns and prevent reopening a previously approved revision after source changes.
create or replace function public.event_work_time_manager_action(
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
  select * into v from public.event_work_time_revisions r where r.case_id=c.id and r.kind='SUBMITTED' order by r.revision desc limit 1;
  if v.id is null or v.author_person_id=actor or c.person_id=actor then raise exception 'Worked-time self approval denied'; end if;
  if p_action='APPROVE' and (c.status='REVIEW_REQUIRED' or c.status<>'SUBMITTED' or v.revision<>c.current_revision) then
    raise exception 'Return source-changed work time for correction'; end if;
  if p_action='RETURN' and c.status='REVIEW_REQUIRED' and exists(
    select 1 from public.event_work_time_events prior where prior.case_id=c.id and prior.kind='WORKED_TIME_APPROVED'
  ) then raise exception 'Approved worked-time history requires separate reopen authority'; end if;
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
