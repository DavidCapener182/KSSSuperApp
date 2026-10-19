-- OFFLINE PROPOSAL ONLY. Not a migration and not applied to a hosted database.
-- Baseline: a95d85079c33a3fd352bd190599864a79240c27c.
-- Additive opt-in contract: no existing function/grant/policy/table is replaced.
-- Existing crm_change_follow_up and its triggers remain the sole business writer.
begin;

create function public.crm_follow_up_cas_snapshot(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.tasks%rowtype; n bigint;
begin
 if private.current_person_id() is null or not private.crm_authorised() then
   raise insufficient_privilege using message='CRM Task denied';
 end if;
 select * into t from public.tasks where id=p_id and task_type='CRM_FOLLOW_UP' for share;
 if t.id is null then raise insufficient_privilege using message='CRM Task denied'; end if;
 select count(*) into n from public.crm_task_events where task_id=t.id;
 return jsonb_build_object('id',t.id,'sourceKind',t.source_kind,'sourceId',t.source_id,
   'state',t.state,'assigneePersonId',t.assignee_person_id,'dueAt',t.due_at,'eventCount',n::text);
end $$;
revoke all on function public.crm_follow_up_cas_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.crm_follow_up_cas_snapshot(uuid) to authenticated;

create function public.crm_change_follow_up_cas(p_id uuid,p_expected jsonb,p_action text,
 p_assignee uuid default null,p_due_at timestamptz default null,p_reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.tasks%rowtype; actor uuid:=private.current_person_id(); n bigint; after_n bigint;
 expected_n bigint; expected_due timestamptz; before_ids uuid[]; event_id uuid; event_rows bigint;
begin
 if actor is null or not private.crm_authorised() then
   raise insufficient_privilege using message='CRM Task denied';
 end if;
 -- Decimal text avoids JavaScript bigint precision loss; do not accept numeric JSON,
 -- missing/extra keys, signed/fractional/leading-zero tokens or bigint overflow.
 if p_expected is null or jsonb_typeof(p_expected)<>'object'
   or not p_expected ?& array['id','sourceKind','sourceId','state','assigneePersonId','dueAt','eventCount']
   or (p_expected-array['id','sourceKind','sourceId','state','assigneePersonId','dueAt','eventCount'])<>'{}'::jsonb
   or jsonb_typeof(p_expected->'id')<>'string'
   or jsonb_typeof(p_expected->'sourceId')<>'string'
   or jsonb_typeof(p_expected->'assigneePersonId')<>'string'
   or jsonb_typeof(p_expected->'eventCount')<>'string'
   or jsonb_typeof(p_expected->'sourceKind')<>'string'
   or jsonb_typeof(p_expected->'state')<>'string'
   or (p_expected->>'eventCount') !~ '^[1-9][0-9]{0,18}$'
   or (p_expected->>'sourceKind') not in ('CRM_ORGANISATION','CRM_OPPORTUNITY')
   or (p_expected->>'state')<>'OPEN'
   or jsonb_typeof(p_expected->'dueAt') not in ('null','string') then
   raise invalid_parameter_value using message='Invalid CRM follow-up expectation';
 end if;
 if (p_expected->>'eventCount')::numeric>9223372036854775807 then
   raise invalid_parameter_value using message='Invalid CRM follow-up expectation';
 end if;
 expected_n:=(p_expected->>'eventCount')::bigint;
 if p_expected->'dueAt'<>'null'::jsonb then
   if (p_expected->>'dueAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
     raise invalid_parameter_value using message='Invalid CRM follow-up expectation';
   end if;
   expected_due:=(p_expected->>'dueAt')::timestamptz;
   if not isfinite(expected_due) then raise invalid_parameter_value using message='Invalid CRM follow-up expectation'; end if;
 end if;
 -- The same row lock is used by the baseline writer. Compare AFTER obtaining it.
 select * into t from public.tasks where id=p_id and task_type='CRM_FOLLOW_UP' for update;
 if t.id is null then raise insufficient_privilege using message='CRM Task denied'; end if;
 select count(*),coalesce(array_agg(id),'{}'::uuid[]) into n,before_ids
   from public.crm_task_events where task_id=t.id;
 if t.state<>'OPEN' or (p_expected->>'id')::uuid is distinct from t.id
   or (p_expected->>'sourceKind') is distinct from t.source_kind
   or (p_expected->>'sourceId')::uuid is distinct from t.source_id
   or (p_expected->>'assigneePersonId')::uuid is distinct from t.assignee_person_id
   or expected_due is distinct from t.due_at or expected_n<>n then
   raise sqlstate 'PT409' using message='CRM follow-up changed; refresh before retry';
 end if;
 -- Re-entrant row lock; all original action/actor/source/history/audit guards apply.
 perform public.crm_change_follow_up(p_id,p_action,p_assignee,p_due_at,p_reason);
 select count(*) into after_n from public.crm_task_events where task_id=t.id;
 select count(*),(array_agg(id))[1] into event_rows,event_id from public.crm_task_events
   where task_id=t.id and not(id=any(before_ids)) and transaction_id=txid_current()
   and actor_person_id=actor and event_kind=p_action;
 if event_rows<>1 or after_n::numeric<>n::numeric+1 then
   raise exception 'CRM follow-up receipt unavailable';
 end if;
 return jsonb_build_object('id',t.id,'eventId',event_id,'eventCount',after_n::text);
end $$;
revoke all on function public.crm_change_follow_up_cas(uuid,jsonb,text,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.crm_change_follow_up_cas(uuid,jsonb,text,uuid,timestamptz,text) to authenticated;
commit;
