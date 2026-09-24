-- TASK-20D. Synthetic Dev only. Assessments and factual attempts; no completion.
create table public.training_assessment_grants (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references public.people(id),
 capability text not null check (capability in ('ASSESSMENT_AUTHOR','ASSESSMENT_PUBLISHER')),
 granted_by uuid not null references public.people(id), granted_at timestamptz not null default now(),
 reason text not null check (length(trim(reason)) between 10 and 300),
 revoked_by uuid references public.people(id), revoked_at timestamptz, revoke_reason text,
 check ((revoked_by is null and revoked_at is null and revoke_reason is null) or
 (revoked_by is not null and revoked_at is not null and length(trim(revoke_reason)) between 10 and 300))
);
create unique index training_assessment_one_grant on public.training_assessment_grants(person_id,capability) where revoked_at is null;
create table public.training_assessments (
 id uuid primary key default gen_random_uuid(), course_version_id uuid not null unique references public.training_course_versions(id),
 current_version_id uuid, next_version integer not null default 1 check (next_version > 0),
 created_by uuid not null references public.people(id), created_at timestamptz not null default now()
);
create table public.training_assessment_versions (
 id uuid primary key default gen_random_uuid(), assessment_id uuid not null references public.training_assessments(id),
 course_version_id uuid not null references public.training_course_versions(id),
 version_number integer not null check (version_number > 0), revision integer not null default 1 check (revision > 0),
 state text not null default 'DRAFT' check (state in ('DRAFT','PUBLISHED','ABANDONED')),
 questions jsonb not null default '[]'::jsonb, content_hash text, pass_percent integer not null default 80 check (pass_percent=80),
 max_submitted integer not null default 3 check (max_submitted=3), retake_minutes integer not null default 30 check (retake_minutes=30),
 created_by uuid not null references public.people(id), created_at timestamptz not null default now(),
 published_by uuid references public.people(id), published_at timestamptz,
 retired_by uuid references public.people(id), retired_at timestamptz, retirement_reason text,
 abandoned_by uuid references public.people(id), abandoned_at timestamptz, abandonment_reason text,
 unique(assessment_id,version_number), unique(assessment_id,id), unique(course_version_id,id),
 check (state<>'PUBLISHED' or (published_by is not null and published_at is not null and content_hash is not null))
);
alter table public.training_assessments add constraint training_assessment_current_fk foreign key (id,current_version_id)
 references public.training_assessment_versions(assessment_id,id);
create unique index training_assessment_one_draft on public.training_assessment_versions(assessment_id) where state='DRAFT';
create table public.training_attempts (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.training_assignments(id),
 person_id uuid not null references public.people(id), course_version_id uuid not null references public.training_course_versions(id),
 assessment_version_id uuid not null references public.training_assessment_versions(id),
 state text not null default 'IN_PROGRESS' check (state in ('IN_PROGRESS','SUBMITTED','ABANDONED')),
 revision integer not null default 1 check (revision > 0), draft_answers jsonb not null default '{}'::jsonb,
 started_at timestamptz not null default now(), submitted_at timestamptz, abandoned_at timestamptz,
 abandon_reason text, correct_count integer, total_count integer, score_percent numeric(6,2),
 result text check (result in ('PASSED','FAILED')),
 check ((state='IN_PROGRESS' and submitted_at is null and abandoned_at is null and result is null) or
 (state='SUBMITTED' and submitted_at is not null and abandoned_at is null and result is not null and correct_count is not null and total_count is not null and score_percent is not null) or
 (state='ABANDONED' and abandoned_at is not null and submitted_at is null and result is null))
);
create unique index training_attempt_one_open on public.training_attempts(assignment_id,assessment_version_id) where state='IN_PROGRESS';
create index training_attempt_history on public.training_attempts(assignment_id,assessment_version_id,started_at desc);
create table public.training_submitted_answers (
 attempt_id uuid primary key references public.training_attempts(id), answers jsonb not null,
 answer_hash text not null, submitted_at timestamptz not null default now()
);
create table public.training_assessment_events (
 id uuid primary key default gen_random_uuid(), assessment_id uuid references public.training_assessments(id),
 assessment_version_id uuid references public.training_assessment_versions(id),
 attempt_id uuid references public.training_attempts(id), actor_person_id uuid references public.people(id),
 action text not null, reason text, occurred_at timestamptz not null default now()
);
create table public.training_assessment_requests (
 actor_person_id uuid not null references public.people(id), request_key uuid not null,
 action text not null, payload_hash text not null, result_id uuid, created_at timestamptz not null default now(),
 primary key(actor_person_id,request_key)
);
alter table public.training_assessment_grants enable row level security;
alter table public.training_assessments enable row level security;
alter table public.training_assessment_versions enable row level security;
alter table public.training_attempts enable row level security;
alter table public.training_submitted_answers enable row level security;
alter table public.training_assessment_events enable row level security;
alter table public.training_assessment_requests enable row level security;
revoke all on public.training_assessment_grants,public.training_assessments,public.training_assessment_versions,
 public.training_attempts,public.training_submitted_answers,public.training_assessment_events,public.training_assessment_requests
 from public,anon,authenticated;

create function private.training_assessment_can(p_capability text) returns boolean language sql stable security definer set search_path='' as $$
 select private.current_person_id() is not null and private.has_active_role('OFFICE_ADMIN') and
 exists(select 1 from public.training_assessment_grants g where g.person_id=private.current_person_id()
 and g.capability=p_capability and g.revoked_at is null)
$$;
create function private.training_assessment_validate(p_questions jsonb) returns void language plpgsql set search_path='' as $$
declare q jsonb; o jsonb; qid text; oid text; seen_questions text[]:='{}'; seen_options text[]; keys text[]; kind text;
begin
 if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions) not between 1 and 25 then raise exception 'Invalid assessment'; end if;
 for q in select value from jsonb_array_elements(p_questions) loop
  if jsonb_typeof(q)<>'object' or (select count(*) from jsonb_object_keys(q))<>5 or
    not (q ?& array['id','type','prompt','options','key']) then raise exception 'Invalid question'; end if;
  qid:=q->>'id'; kind:=q->>'type';
  if jsonb_typeof(q->'id')<>'string' or qid is null or length(qid) not between 1 and 64 or qid=any(seen_questions) or kind not in ('SINGLE','MULTIPLE') or
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
create function private.training_assessment_answers_valid(p_questions jsonb,p_answers jsonb,p_required boolean) returns boolean
 language plpgsql set search_path='' as $$
declare item record; q jsonb; value jsonb; choice jsonb; used text[]; valid_ids text[]; count_answers integer:=0;
begin
 if jsonb_typeof(p_answers)<>'object' then return false; end if;
 for item in select key,value from jsonb_each(p_answers) loop
  select x into q from jsonb_array_elements(p_questions) x where x->>'id'=item.key;
  if q is null or jsonb_typeof(item.value)<>'array' or jsonb_array_length(item.value)<1 then return false; end if;
  used:='{}'; valid_ids:=array(select x->>'id' from jsonb_array_elements(q->'options') x);
  for choice in select x from jsonb_array_elements(item.value) x loop
   if jsonb_typeof(choice)<>'string' or choice#>>'{}'=any(used) or
    not choice#>>'{}'=any(valid_ids) then return false; end if;
   used:=array_append(used,choice#>>'{}');
  end loop;
  if q->>'type'='SINGLE' and cardinality(used)<>1 then return false; end if;
  count_answers:=count_answers+1;
 end loop;
 return not p_required or count_answers=jsonb_array_length(p_questions);
end $$;
create function private.training_assessment_request(p_actor uuid,p_key uuid,p_action text,p_payload jsonb) returns uuid
 language plpgsql security definer set search_path='' as $$
declare h text:=encode(extensions.digest(p_payload::text,'sha256'),'hex'); r public.training_assessment_requests%rowtype;
begin
 if p_actor is null or p_key is null then raise exception 'Request denied'; end if;
 insert into public.training_assessment_requests(actor_person_id,request_key,action,payload_hash)
 values(p_actor,p_key,p_action,h) on conflict do nothing;
 select * into r from public.training_assessment_requests where actor_person_id=p_actor and request_key=p_key for update;
 if r.action<>p_action or r.payload_hash<>h then raise exception 'Changed request replay'; end if;
 return r.result_id;
end $$;
revoke all on function private.training_assessment_can(text),private.training_assessment_validate(jsonb),
 private.training_assessment_answers_valid(jsonb,jsonb,boolean),private.training_assessment_request(uuid,uuid,text,jsonb)
 from public,anon,authenticated;

create function private.training_assessment_seal() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (old.state<>'DRAFT' and
  (new.assessment_id<>old.assessment_id or new.course_version_id<>old.course_version_id or new.questions<>old.questions or
   new.content_hash is distinct from old.content_hash or new.pass_percent<>old.pass_percent or
   new.max_submitted<>old.max_submitted or new.retake_minutes<>old.retake_minutes or new.state<>old.state or
   new.revision<>old.revision or new.version_number<>old.version_number or new.created_by<>old.created_by or
   new.published_by is distinct from old.published_by or new.published_at is distinct from old.published_at or
   new.abandoned_by is distinct from old.abandoned_by or new.abandoned_at is distinct from old.abandoned_at))
  then raise exception 'Assessment version immutable'; end if;
 if old.retired_at is not null and new is distinct from old then raise exception 'Assessment retired'; end if;
 return new;
end $$;
create trigger training_assessment_version_seal before update or delete on public.training_assessment_versions
 for each row execute function private.training_assessment_seal();
create function private.training_submitted_seal() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Submitted assessment evidence immutable'; end $$;
create trigger training_submitted_answers_seal before update or delete on public.training_submitted_answers
 for each row execute function private.training_submitted_seal();
create trigger training_assessment_events_seal before update or delete on public.training_assessment_events
 for each row execute function private.training_submitted_seal();
create function private.training_attempt_seal() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or new.id<>old.id or new.assignment_id<>old.assignment_id or new.person_id<>old.person_id or
 new.course_version_id<>old.course_version_id or new.assessment_version_id<>old.assessment_version_id or
 new.started_at<>old.started_at or old.state<>'IN_PROGRESS' then raise exception 'Attempt immutable'; end if;
 return new;
end $$;
create trigger training_attempt_seal before update or delete on public.training_attempts
 for each row execute function private.training_attempt_seal();
create function private.training_assessment_grant_seal() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.revoked_at is not null or new.revoked_at is null or new.revoked_by is null or
 (to_jsonb(new)-'revoked_by'-'revoked_at'-'revoke_reason') is distinct from
 (to_jsonb(old)-'revoked_by'-'revoked_at'-'revoke_reason') then raise exception 'Grant immutable'; end if;
 return new;
end $$;
create trigger training_assessment_grant_seal before update or delete on public.training_assessment_grants
 for each row execute function private.training_assessment_grant_seal();
revoke all on function private.training_assessment_seal(),private.training_submitted_seal(),private.training_attempt_seal(),
 private.training_assessment_grant_seal() from public,anon,authenticated;

create function public.training_assessment_grant(p_person uuid,p_capability text,p_reason text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid;
begin
 if not private.has_active_role('SUPER_ADMIN') or p_capability not in ('ASSESSMENT_AUTHOR','ASSESSMENT_PUBLISHER') or
 length(trim(p_reason)) not between 10 and 300 or not exists(select 1 from public.role_assignments r
 where r.person_id=p_person and r.role_code='OFFICE_ADMIN' and r.revoked_at is null and r.effective_from<=now()
 and (r.effective_until is null or r.effective_until>now())) or
 not exists(select 1 from public.auth_identities i where i.person_id=p_person and i.active)
 then raise exception 'Grant denied'; end if;
 insert into public.training_assessment_grants(person_id,capability,granted_by,reason)
 values(p_person,p_capability,actor,trim(p_reason)) returning id into result;
 insert into public.training_assessment_events(actor_person_id,action,reason) values(actor,'GRANT',trim(p_reason));
 return result;
end $$;
create function public.training_assessment_revoke(p_grant uuid,p_reason text) returns void
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); affected integer;
begin
 if not private.has_active_role('SUPER_ADMIN') or length(trim(p_reason)) not between 10 and 300 then raise exception 'Revoke denied'; end if;
 update public.training_assessment_grants set revoked_by=actor,revoked_at=now(),revoke_reason=trim(p_reason)
 where id=p_grant and revoked_at is null;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Revoke denied'; end if;
 insert into public.training_assessment_events(actor_person_id,action,reason) values(actor,'REVOKE',trim(p_reason));
end $$;
create function public.training_assessment_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 return jsonb_build_object('author',private.training_assessment_can('ASSESSMENT_AUTHOR'),
 'publisher',private.training_assessment_can('ASSESSMENT_PUBLISHER'),
 'superAdmin',private.has_active_role('SUPER_ADMIN'));
end $$;
create function public.training_assessment_grants_read() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_active_role('SUPER_ADMIN') then raise exception 'Grants denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'personId',g.person_id,'displayName',p.display_name,
 'capability',g.capability,'grantedAt',g.granted_at,'revokedAt',g.revoked_at,'reason',g.reason,'revokeReason',g.revoke_reason)
 order by g.granted_at desc),'[]'::jsonb) into result from public.training_assessment_grants g
 join public.people p on p.id=g.person_id;
 return result;
end $$;
create function public.training_assessment_create(p_course_version uuid,p_questions jsonb) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a uuid; v uuid; n integer;
begin
 if not private.training_assessment_can('ASSESSMENT_AUTHOR') or not exists(select 1 from public.training_course_versions c
 where c.id=p_course_version and c.state='PUBLISHED' and c.retired_at is null) then raise exception 'Create denied'; end if;
 perform private.training_assessment_validate(p_questions);
 insert into public.training_assessments(course_version_id,created_by) values(p_course_version,actor)
 on conflict(course_version_id) do nothing;
 select id,next_version into a,n from public.training_assessments where course_version_id=p_course_version for update;
 if exists(select 1 from public.training_assessment_versions where assessment_id=a and state='DRAFT') then raise exception 'Existing draft'; end if;
 insert into public.training_assessment_versions(assessment_id,course_version_id,version_number,questions,created_by)
 values(a,p_course_version,n,p_questions,actor) returning id into v;
 update public.training_assessments set next_version=n+1 where id=a;
 insert into public.training_assessment_events(assessment_id,assessment_version_id,actor_person_id,action)
 values(a,v,actor,'DRAFT_CREATE');
 return v;
end $$;
create function public.training_assessment_edit(p_version uuid,p_revision integer,p_questions jsonb) returns integer
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result integer; aid uuid;
begin
 if not private.training_assessment_can('ASSESSMENT_AUTHOR') then raise exception 'Edit denied'; end if;
 perform private.training_assessment_validate(p_questions);
 update public.training_assessment_versions set questions=p_questions,revision=revision+1
 where id=p_version and state='DRAFT' and revision=p_revision returning revision,assessment_id into result,aid;
 if result is null then raise exception 'Stale draft'; end if;
 insert into public.training_assessment_events(assessment_id,assessment_version_id,actor_person_id,action)
 values(aid,p_version,actor,'DRAFT_EDIT');
 return result;
end $$;
create function public.training_assessment_publish(p_version uuid,p_revision integer) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); v public.training_assessment_versions%rowtype; old uuid;
begin
 if not private.training_assessment_can('ASSESSMENT_PUBLISHER') then raise exception 'Publish denied'; end if;
 select * into v from public.training_assessment_versions where id=p_version for update;
 if v.id is null or v.state<>'DRAFT' or v.revision<>p_revision or
 not exists(select 1 from public.training_course_versions c where c.id=v.course_version_id and c.state='PUBLISHED' and c.retired_at is null)
 then raise exception 'Stale publish'; end if;
 perform private.training_assessment_validate(v.questions);
 select current_version_id into old from public.training_assessments where id=v.assessment_id for update;
 update public.training_assessment_versions set state='PUBLISHED',published_by=actor,published_at=now(),
 content_hash=encode(extensions.digest(questions::text,'sha256'),'hex') where id=p_version;
 update public.training_assessments set current_version_id=p_version where id=v.assessment_id;
 insert into public.training_assessment_events(assessment_id,assessment_version_id,actor_person_id,action,reason)
 values(v.assessment_id,p_version,actor,'PUBLISH',case when old is null then null else 'Prior version retained' end);
 return p_version;
end $$;
create function public.training_assessment_retire(p_version uuid,p_reason text) returns void
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); aid uuid;
begin
 if not private.training_assessment_can('ASSESSMENT_PUBLISHER') or length(trim(p_reason)) not between 10 and 300
 then raise exception 'Retire denied'; end if;
 update public.training_assessment_versions set retired_by=actor,retired_at=now(),retirement_reason=trim(p_reason)
 where id=p_version and state='PUBLISHED' and retired_at is null returning assessment_id into aid;
 if aid is null then raise exception 'Retire denied'; end if;
 update public.training_assessments set current_version_id=null where id=aid and current_version_id=p_version;
 insert into public.training_assessment_events(assessment_id,assessment_version_id,actor_person_id,action,reason)
 values(aid,p_version,actor,'RETIRE',trim(p_reason));
end $$;
create function public.training_assessment_abandon_draft(p_version uuid,p_revision integer,p_reason text) returns void
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); aid uuid;
begin
 if not private.training_assessment_can('ASSESSMENT_AUTHOR') or length(trim(p_reason)) not between 10 and 300
 then raise exception 'Abandon denied'; end if;
 update public.training_assessment_versions set state='ABANDONED',abandoned_by=actor,abandoned_at=now(),
 abandonment_reason=trim(p_reason) where id=p_version and state='DRAFT' and revision=p_revision returning assessment_id into aid;
 if aid is null then raise exception 'Stale draft'; end if;
 insert into public.training_assessment_events(assessment_id,assessment_version_id,actor_person_id,action,reason)
 values(aid,p_version,actor,'DRAFT_ABANDON',trim(p_reason));
end $$;

create function private.training_assessment_public_questions(p_questions jsonb) returns jsonb
 language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(q.value-'key' order by q.ordinality),'[]'::jsonb)
 from jsonb_array_elements(p_questions) with ordinality q(value,ordinality)
$$;
create function private.training_assessment_attempt_json(a public.training_attempts) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare submitted_count integer; last_failed timestamptz; allowed timestamptz;
begin
 select count(*) filter(where state='SUBMITTED'),max(submitted_at) filter(where state='SUBMITTED' and result='FAILED')
 into submitted_count,last_failed from public.training_attempts
 where assignment_id=a.assignment_id and assessment_version_id=a.assessment_version_id;
 allowed:=case when a.result='FAILED' and submitted_count<3 then a.submitted_at+interval '30 minutes' else null end;
 return jsonb_build_object('id',a.id,'assignmentId',a.assignment_id,'courseVersionId',a.course_version_id,
 'assessmentVersionId',a.assessment_version_id,'state',a.state,'revision',a.revision,'draftAnswers',
 case when a.state='IN_PROGRESS' then a.draft_answers else null end,'startedAt',a.started_at,
 'submittedAt',a.submitted_at,'abandonedAt',a.abandoned_at,
 'scorePercent',a.score_percent,'result',a.result,
 'attemptNumber',case when a.state='SUBMITTED' then (select count(*) from public.training_attempts t
 where t.assignment_id=a.assignment_id and t.assessment_version_id=a.assessment_version_id and t.state='SUBMITTED'
 and (t.submitted_at,t.id)<=(a.submitted_at,a.id)) else null end,
 'attemptsRemaining',greatest(0,3-submitted_count),'earliestRetakeAt',allowed);
end $$;
create function public.training_assessment_staff(p_assignment uuid) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare a public.training_assignments%rowtype; assessment public.training_assessments%rowtype; v public.training_assessment_versions%rowtype;
 result jsonb; attempt_rows jsonb; current_attempt public.training_attempts%rowtype; submitted_count integer; last_result text; last_time timestamptz;
begin
 select * into a from public.training_assignments where id=p_assignment;
 if a.id is null or a.person_id<>private.current_person_id() or not private.has_active_role('SECURITY_STAFF')
 then raise exception 'Assessment denied'; end if;
 select * into assessment from public.training_assessments where course_version_id=a.course_version_id;
 if assessment.id is not null and assessment.current_version_id is not null then
  select * into v from public.training_assessment_versions where id=assessment.current_version_id;
 end if;
 select coalesce(jsonb_agg(private.training_assessment_attempt_json(t) order by t.started_at,t.id),'[]'::jsonb)
 into attempt_rows from public.training_attempts t where t.assignment_id=a.id;
 select * into current_attempt from public.training_attempts t where t.assignment_id=a.id and t.state='IN_PROGRESS'
 order by t.started_at desc limit 1;
 if v.id is not null then
  select count(*) into submitted_count from public.training_attempts t where t.assignment_id=a.id
  and t.assessment_version_id=v.id and t.state='SUBMITTED';
  select t.result,t.submitted_at into last_result,last_time from public.training_attempts t where t.assignment_id=a.id
  and t.assessment_version_id=v.id and t.state='SUBMITTED' order by t.submitted_at desc limit 1;
 end if;
 result:=jsonb_build_object('assignmentId',a.id,'courseVersionId',a.course_version_id,'assignmentState',a.state,
 'courseRetired',exists(select 1 from public.training_course_versions c where c.id=a.course_version_id and c.retired_at is not null),
 'assessmentVersionId',v.id,'assessmentVersionNumber',v.version_number,'assessmentRetired',v.retired_at is not null,
 'questions',case when a.state='ACTIVE' and v.id is not null and v.retired_at is null and
 not exists(select 1 from public.training_course_versions c where c.id=a.course_version_id and c.retired_at is not null)
 then private.training_assessment_public_questions(v.questions) else '[]'::jsonb end,
 'openQuestions',case when a.state='ACTIVE' and current_attempt.id is not null and
 exists(select 1 from public.training_assessment_versions ov where ov.id=current_attempt.assessment_version_id and ov.retired_at is null)
 and not exists(select 1 from public.training_course_versions c where c.id=a.course_version_id and c.retired_at is not null)
 then private.training_assessment_public_questions((select ov.questions from public.training_assessment_versions ov where ov.id=current_attempt.assessment_version_id))
 else '[]'::jsonb end,
 'history',attempt_rows,'openAttempt',case when current_attempt.id is null then null else private.training_assessment_attempt_json(current_attempt) end,
 'submittedCount',coalesce(submitted_count,0),'attemptsRemaining',greatest(0,3-coalesce(submitted_count,0)),
 'earliestRetakeAt',case when last_result='FAILED' and submitted_count<3 then last_time+interval '30 minutes' else null end,
 'passedCurrent',last_result='PASSED');
 return result;
end $$;
create function public.training_assessment_admin() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.training_assessment_can('ASSESSMENT_AUTHOR') and not private.training_assessment_can('ASSESSMENT_PUBLISHER')
 and not private.has_active_role('SUPER_ADMIN') then raise exception 'Assessment admin denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'assessmentId',v.assessment_id,
 'courseVersionId',v.course_version_id,'versionNumber',v.version_number,'revision',v.revision,
 'state',v.state,'questions',case when private.training_assessment_can('ASSESSMENT_AUTHOR') or
 private.training_assessment_can('ASSESSMENT_PUBLISHER') then v.questions else private.training_assessment_public_questions(v.questions) end,
 'currentVersionId',a.current_version_id,'contentHash',v.content_hash,
 'publishedAt',v.published_at,'retiredAt',v.retired_at) order by v.created_at desc),'[]'::jsonb) into result
 from public.training_assessment_versions v join public.training_assessments a on a.id=v.assessment_id;
 return result;
end $$;
create function public.training_assessment_admin_history(p_assignment uuid) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.training_assessment_can('ASSESSMENT_AUTHOR') and not private.training_assessment_can('ASSESSMENT_PUBLISHER')
 and not private.training_assigner() and not private.has_active_role('SUPER_ADMIN') then raise exception 'History denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'assessmentVersionId',t.assessment_version_id,
 'state',t.state,'startedAt',t.started_at,'submittedAt',t.submitted_at,'scorePercent',t.score_percent,'result',t.result)
 order by t.started_at),'[]'::jsonb) into result from public.training_attempts t where t.assignment_id=p_assignment;
 return result;
end $$;
create function private.training_attempt_guard(p_attempt uuid) returns public.training_attempts
 language plpgsql security definer set search_path='' as $$
declare t public.training_attempts%rowtype;
begin
 select * into t from public.training_attempts where id=p_attempt for update;
 if t.id is null or t.person_id<>private.current_person_id() or not private.has_active_role('SECURITY_STAFF') or
 t.state<>'IN_PROGRESS' or not exists(select 1 from public.training_assignments a where a.id=t.assignment_id
 and a.person_id=t.person_id and a.course_version_id=t.course_version_id and a.state='ACTIVE') or
 not exists(select 1 from public.training_course_versions c where c.id=t.course_version_id and c.state='PUBLISHED' and c.retired_at is null) or
 not exists(select 1 from public.training_assessment_versions v where v.id=t.assessment_version_id and
 v.course_version_id=t.course_version_id and v.state='PUBLISHED' and v.retired_at is null)
 then raise exception 'Attempt unavailable'; end if;
 return t;
end $$;
create function public.training_assessment_start(p_assignment uuid,p_version uuid,p_request uuid) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.training_assignments%rowtype; v public.training_assessment_versions%rowtype;
 result uuid; last_result text; last_time timestamptz; submitted_count integer;
begin
 result:=private.training_assessment_request(actor,p_request,'START',jsonb_build_object('assignment',p_assignment,'version',p_version));
 if result is not null then return result; end if;
 select * into a from public.training_assignments where id=p_assignment for update;
 select * into v from public.training_assessment_versions where id=p_version;
 if a.id is null or a.person_id<>actor or not private.has_active_role('SECURITY_STAFF') or a.state<>'ACTIVE' or
 v.id is null or v.course_version_id<>a.course_version_id or v.state<>'PUBLISHED' or v.retired_at is not null or
 not exists(select 1 from public.training_course_versions c where c.id=a.course_version_id and c.state='PUBLISHED' and c.retired_at is null)
 then raise exception 'Start denied'; end if;
 select id into result from public.training_attempts where assignment_id=a.id and assessment_version_id=v.id
 and state='IN_PROGRESS';
 if result is null then
  if not exists(select 1 from public.training_assessments x where x.id=v.assessment_id and x.current_version_id=v.id)
  then raise exception 'Stale assessment version'; end if;
  select count(*) into submitted_count from public.training_attempts t where t.assignment_id=a.id
  and t.assessment_version_id=v.id and t.state='SUBMITTED';
  select t.result,t.submitted_at into last_result,last_time from public.training_attempts t where t.assignment_id=a.id
  and t.assessment_version_id=v.id and t.state='SUBMITTED' order by t.submitted_at desc limit 1;
  if submitted_count>=3 or last_result='PASSED' or (last_result='FAILED' and now()<last_time+interval '30 minutes')
  then raise exception 'Attempt allowance or retake delay'; end if;
  insert into public.training_attempts(assignment_id,person_id,course_version_id,assessment_version_id)
  values(a.id,actor,a.course_version_id,v.id) returning id into result;
  insert into public.training_assessment_events(assessment_id,assessment_version_id,attempt_id,actor_person_id,action)
  values(v.assessment_id,v.id,result,actor,'START');
 end if;
 update public.training_assessment_requests set result_id=result where actor_person_id=actor and request_key=p_request;
 return result;
end $$;
create function public.training_assessment_save(p_attempt uuid,p_revision integer,p_answers jsonb,p_request uuid) returns integer
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid; t public.training_attempts%rowtype; v public.training_assessment_versions%rowtype; next_revision integer;
begin
 result:=private.training_assessment_request(actor,p_request,'SAVE',jsonb_build_object('attempt',p_attempt,'revision',p_revision,'answers',p_answers));
 if result is not null then return (select revision from public.training_attempts where id=result); end if;
 t:=private.training_attempt_guard(p_attempt);
 if t.revision<>p_revision then raise exception 'Stale attempt'; end if;
 select * into v from public.training_assessment_versions where id=t.assessment_version_id;
 if not private.training_assessment_answers_valid(v.questions,p_answers,false) then raise exception 'Invalid answers'; end if;
 update public.training_attempts set draft_answers=p_answers,revision=revision+1 where id=t.id returning revision into next_revision;
 update public.training_assessment_requests set result_id=t.id where actor_person_id=actor and request_key=p_request;
 insert into public.training_assessment_events(assessment_id,assessment_version_id,attempt_id,actor_person_id,action)
 values(v.assessment_id,v.id,t.id,actor,'SAVE');
 return next_revision;
end $$;
create function public.training_assessment_submit(p_attempt uuid,p_revision integer,p_answers jsonb,p_request uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); prior uuid; t public.training_attempts%rowtype; v public.training_assessment_versions%rowtype;
 q jsonb; selected text[]; keyed text[]; correct integer:=0; total integer; pct numeric(6,2); h text;
begin
 prior:=private.training_assessment_request(actor,p_request,'SUBMIT',
 jsonb_build_object('attempt',p_attempt,'revision',p_revision,'answers',p_answers));
 if prior is not null then
  select * into t from public.training_attempts where id=prior;
  if t.person_id<>actor or t.state<>'SUBMITTED' then raise exception 'Submission unavailable'; end if;
  return private.training_assessment_attempt_json(t);
 end if;
 select * into t from public.training_attempts where id=p_attempt for update;
 if t.id is null or t.person_id<>actor then raise exception 'Submission denied'; end if;
 h:=encode(extensions.digest(p_answers::text,'sha256'),'hex');
 if t.state='SUBMITTED' then
  if exists(select 1 from public.training_submitted_answers s where s.attempt_id=t.id and s.answer_hash=h and s.answers=p_answers)
  then
   update public.training_assessment_requests set result_id=t.id where actor_person_id=actor and request_key=p_request;
   return private.training_assessment_attempt_json(t);
  end if;
  raise exception 'Changed submitted answers';
 end if;
 t:=private.training_attempt_guard(p_attempt);
 if t.revision<>p_revision then raise exception 'Stale attempt'; end if;
 select * into v from public.training_assessment_versions where id=t.assessment_version_id;
 if not private.training_assessment_answers_valid(v.questions,p_answers,true) then raise exception 'Invalid answers'; end if;
 total:=jsonb_array_length(v.questions);
 for q in select value from jsonb_array_elements(v.questions) loop
  select array_agg(value order by value) into selected from jsonb_array_elements_text(p_answers->(q->>'id')) value;
  select array_agg(value order by value) into keyed from jsonb_array_elements_text(q->'key') value;
  if selected=keyed then correct:=correct+1; end if;
 end loop;
 pct:=round(correct::numeric*100/total,2);
 insert into public.training_submitted_answers(attempt_id,answers,answer_hash) values(t.id,p_answers,h);
 update public.training_attempts set state='SUBMITTED',draft_answers='{}'::jsonb,revision=revision+1,
 submitted_at=now(),correct_count=correct,total_count=total,score_percent=pct,
 result=case when pct>=v.pass_percent then 'PASSED' else 'FAILED' end where id=t.id returning * into t;
 update public.training_assessment_requests set result_id=t.id where actor_person_id=actor and request_key=p_request;
 insert into public.training_assessment_events(assessment_id,assessment_version_id,attempt_id,actor_person_id,action)
 values(v.assessment_id,v.id,t.id,actor,'SUBMIT');
 return private.training_assessment_attempt_json(t);
end $$;
create function public.training_assessment_abandon(p_attempt uuid,p_revision integer,p_request uuid) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); prior uuid; t public.training_attempts%rowtype; aid uuid;
begin
 prior:=private.training_assessment_request(actor,p_request,'ABANDON',jsonb_build_object('attempt',p_attempt,'revision',p_revision));
 if prior is not null then return prior; end if;
 t:=private.training_attempt_guard(p_attempt);
 if t.revision<>p_revision then raise exception 'Stale attempt'; end if;
 update public.training_attempts set state='ABANDONED',abandoned_at=now(),abandon_reason='Staff explicitly abandoned',revision=revision+1
 where id=t.id;
 select assessment_id into aid from public.training_assessment_versions where id=t.assessment_version_id;
 insert into public.training_assessment_events(assessment_id,assessment_version_id,attempt_id,actor_person_id,action,reason)
 values(aid,t.assessment_version_id,t.id,actor,'ABANDON','Staff explicitly abandoned');
 update public.training_assessment_requests set result_id=t.id where actor_person_id=actor and request_key=p_request;
 return t.id;
end $$;
create function private.training_assessment_source_change() returns trigger language plpgsql security definer set search_path='' as $$
declare t record; reason text; aid uuid;
begin
 if tg_table_name='training_assignments' then
  if old.state='ACTIVE' and new.state<>'ACTIVE' then
   reason:='Assignment '||new.state;
   for t in select id,assessment_version_id from public.training_attempts where assignment_id=new.id and state='IN_PROGRESS' loop
    select assessment_id into aid from public.training_assessment_versions where id=t.assessment_version_id;
    insert into public.training_assessment_events(assessment_id,assessment_version_id,attempt_id,actor_person_id,action,reason)
    values(aid,t.assessment_version_id,t.id,new.ended_by,'SOURCE_BLOCKED',reason);
   end loop;
  end if;
 elsif old.retired_at is null and new.retired_at is not null then
  reason:=case when tg_table_name='training_course_versions' then 'CourseVersion retired' else 'AssessmentVersion retired' end;
  for t in select id,assessment_version_id from public.training_attempts where state='IN_PROGRESS' and
   (case when tg_table_name='training_course_versions' then course_version_id=new.id else assessment_version_id=new.id end) loop
   select assessment_id into aid from public.training_assessment_versions where id=t.assessment_version_id;
   insert into public.training_assessment_events(assessment_id,assessment_version_id,attempt_id,actor_person_id,action,reason)
   values(aid,t.assessment_version_id,t.id,new.retired_by,'SOURCE_BLOCKED',reason);
  end loop;
 end if;
 return new;
end $$;
create trigger training_attempt_assignment_source after update of state on public.training_assignments
 for each row execute function private.training_assessment_source_change();
create trigger training_attempt_course_source after update of retired_at on public.training_course_versions
 for each row execute function private.training_assessment_source_change();
create trigger training_attempt_assessment_source after update of retired_at on public.training_assessment_versions
 for each row execute function private.training_assessment_source_change();
revoke all on function private.training_assessment_public_questions(jsonb),private.training_assessment_attempt_json(public.training_attempts),
 private.training_attempt_guard(uuid),private.training_assessment_source_change() from public,anon,authenticated;
revoke all on function public.training_assessment_grant(uuid,text,text),public.training_assessment_revoke(uuid,text),
 public.training_assessment_access(),public.training_assessment_grants_read(),public.training_assessment_create(uuid,jsonb),
 public.training_assessment_edit(uuid,integer,jsonb),public.training_assessment_publish(uuid,integer),
 public.training_assessment_retire(uuid,text),public.training_assessment_abandon_draft(uuid,integer,text),
 public.training_assessment_staff(uuid),public.training_assessment_admin(),public.training_assessment_admin_history(uuid),
 public.training_assessment_start(uuid,uuid,uuid),public.training_assessment_save(uuid,integer,jsonb,uuid),
 public.training_assessment_submit(uuid,integer,jsonb,uuid),public.training_assessment_abandon(uuid,integer,uuid)
 from public,anon,authenticated;
grant execute on function public.training_assessment_grant(uuid,text,text),public.training_assessment_revoke(uuid,text),
 public.training_assessment_access(),public.training_assessment_grants_read(),public.training_assessment_create(uuid,jsonb),
 public.training_assessment_edit(uuid,integer,jsonb),public.training_assessment_publish(uuid,integer),
 public.training_assessment_retire(uuid,text),public.training_assessment_abandon_draft(uuid,integer,text),
 public.training_assessment_staff(uuid),public.training_assessment_admin(),public.training_assessment_admin_history(uuid),
 public.training_assessment_start(uuid,uuid,uuid),public.training_assessment_save(uuid,integer,jsonb,uuid),
 public.training_assessment_submit(uuid,integer,jsonb,uuid),public.training_assessment_abandon(uuid,integer,uuid)
 to authenticated;
