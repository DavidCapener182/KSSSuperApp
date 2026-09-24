-- TASK-20D assessment authority and exact request readback.
alter table public.training_assessment_requests add column result_revision integer;
create or replace function public.training_assessment_admin_history(p_assignment uuid) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.training_assessment_can('ASSESSMENT_AUTHOR') and not private.training_assessment_can('ASSESSMENT_PUBLISHER')
 and not private.has_active_role('SUPER_ADMIN') then raise exception 'History denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'assessmentVersionId',t.assessment_version_id,
 'state',t.state,'startedAt',t.started_at,'submittedAt',t.submitted_at,'scorePercent',t.score_percent,'result',t.result)
 order by t.started_at),'[]'::jsonb) into result from public.training_attempts t where t.assignment_id=p_assignment;
 return result;
end $$;
create or replace function public.training_assessment_save(p_attempt uuid,p_revision integer,p_answers jsonb,p_request uuid) returns integer
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid; t public.training_attempts%rowtype; v public.training_assessment_versions%rowtype; next_revision integer;
begin
 result:=private.training_assessment_request(actor,p_request,'SAVE',jsonb_build_object('attempt',p_attempt,'revision',p_revision,'answers',p_answers));
 if result is not null then return (select result_revision from public.training_assessment_requests where actor_person_id=actor and request_key=p_request); end if;
 t:=private.training_attempt_guard(p_attempt);
 if t.revision<>p_revision then raise exception 'Stale attempt'; end if;
 select * into v from public.training_assessment_versions where id=t.assessment_version_id;
 if not private.training_assessment_answers_valid(v.questions,p_answers,false) then raise exception 'Invalid answers'; end if;
 update public.training_attempts set draft_answers=p_answers,revision=revision+1 where id=t.id returning revision into next_revision;
 update public.training_assessment_requests set result_id=t.id,result_revision=next_revision where actor_person_id=actor and request_key=p_request;
 insert into public.training_assessment_events(assessment_id,assessment_version_id,attempt_id,actor_person_id,action)
 values(v.assessment_id,v.id,t.id,actor,'SAVE');
 return next_revision;
end $$;
create or replace function private.training_assessment_validate(p_questions jsonb) returns void language plpgsql set search_path='' as $$
declare q jsonb; o jsonb; qid text; oid text; seen_questions text[]:='{}'; seen_options text[]; keys text[]; kind text;
begin
 if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions) not between 1 and 25 then raise exception 'Invalid assessment'; end if;
 for q in select value from jsonb_array_elements(p_questions) loop
  if jsonb_typeof(q)<>'object' or (select count(*) from jsonb_object_keys(q))<>5 or
    not (q ?& array['id','type','prompt','options','key']) then raise exception 'Invalid question'; end if;
  qid:=q->>'id'; kind:=q->>'type';
  if jsonb_typeof(q->'id')<>'string' or qid is null or length(qid) not between 1 and 64 or qid=any(seen_questions) or jsonb_typeof(q->'type')<>'string' or kind not in ('SINGLE','MULTIPLE') or
    jsonb_typeof(q->'prompt')<>'string' or
    length(trim(q->>'prompt')) not between 1 and 1500 or jsonb_typeof(q->'options')<>'array' or
    jsonb_array_length(q->'options') not between 2 and 6 or jsonb_typeof(q->'key')<>'array' then raise exception 'Invalid question'; end if;
  seen_questions:=array_append(seen_questions,qid); seen_options:='{}'; keys:='{}';
  for o in select value from jsonb_array_elements(q->'options') loop
   if jsonb_typeof(o)<>'object' or (select count(*) from jsonb_object_keys(o))<>2 or not (o ?& array['id','text']) or
    jsonb_typeof(o->'id')<>'string' or jsonb_typeof(o->'text')<>'string' or
    length(o->>'id') not between 1 and 64 or o->>'id'=any(seen_options) or length(trim(o->>'text')) not between 1 and 500
    then raise exception 'Invalid option'; end if;
   seen_options:=array_append(seen_options,o->>'id');
  end loop;
  for o in select value from jsonb_array_elements(q->'key') loop
   oid:=o#>>'{}';
   if jsonb_typeof(o)<>'string' or oid=any(keys) or not oid=any(seen_options) then raise exception 'Invalid answer key'; end if;
   keys:=array_append(keys,oid);
  end loop;
  if cardinality(keys)<1 or (kind='SINGLE' and cardinality(keys)<>1) or
    (kind='MULTIPLE' and cardinality(keys)<2) then raise exception 'Invalid answer key'; end if;
 end loop;
end $$;
