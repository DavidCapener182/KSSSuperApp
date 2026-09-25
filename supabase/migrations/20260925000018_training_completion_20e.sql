-- TASK-20E synthetic Development only. Completion requires explicit evaluation.
create table public.training_completion_manager_grants (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references public.people(id),
 granted_by uuid not null references public.people(id), granted_at timestamptz not null default now(),
 grant_reason text not null check (length(trim(grant_reason)) between 10 and 300),
 revoked_by uuid references public.people(id), revoked_at timestamptz, revoke_reason text,
 check ((revoked_by is null and revoked_at is null and revoke_reason is null) or
        (revoked_by is not null and revoked_at is not null and length(trim(revoke_reason)) between 10 and 300))
);
create unique index training_completion_one_manager_grant on public.training_completion_manager_grants(person_id) where revoked_at is null;
create table public.training_completion_manager_events (
 id uuid primary key default gen_random_uuid(), grant_id uuid not null references public.training_completion_manager_grants(id),
 actor_person_id uuid not null references public.people(id), action text not null check (action in ('GRANT','REVOKE')),
 reason text not null, occurred_at timestamptz not null default now()
);
create table public.training_completion_rule_versions (
 id uuid primary key default gen_random_uuid(), course_version_id uuid not null references public.training_course_versions(id),
 version_number integer not null check (version_number>0), all_pages_required boolean not null check (all_pages_required),
 required_assessment_version_ids uuid[] not null check (cardinality(required_assessment_version_ids)>0),
 pass_evidence_rule text not null default 'ONE_SUBMITTED_PASSED_PER_VERSION' check (pass_evidence_rule='ONE_SUBMITTED_PASSED_PER_VERSION'),
 effective_from timestamptz not null, effective_until timestamptz,
 validity_months integer check (validity_months between 1 and 120),
 published_by uuid not null references public.people(id), published_at timestamptz not null default now(),
 rule_hash text not null, unique(course_version_id,version_number),
 check (effective_until is null or effective_until>effective_from)
);
create table public.training_completion_cases (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null unique references public.training_assignments(id),
 person_id uuid not null references public.people(id), course_version_id uuid not null references public.training_course_versions(id),
 rule_version_id uuid not null references public.training_completion_rule_versions(id),
 created_by uuid not null references public.people(id), created_at timestamptz not null default now()
);
create table public.training_completions (
 id uuid primary key default gen_random_uuid(), case_id uuid not null unique references public.training_completion_cases(id),
 assignment_id uuid not null unique references public.training_assignments(id), person_id uuid not null references public.people(id),
 course_version_id uuid not null references public.training_course_versions(id),
 rule_version_id uuid not null references public.training_completion_rule_versions(id),
 rule_hash text not null, passed_attempt_ids uuid[] not null, page_mark_count integer not null,
 page_count integer not null, evaluated_by uuid not null references public.people(id), completed_at timestamptz not null default now(),
 voided_by uuid references public.people(id), voided_at timestamptz, void_reason text,
 check ((voided_by is null and voided_at is null and void_reason is null) or
        (voided_by is not null and voided_at is not null and length(trim(void_reason)) between 10 and 300))
);
create table public.training_completion_events (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references public.training_completion_cases(id),
 completion_id uuid references public.training_completions(id), actor_person_id uuid not null references public.people(id),
 action text not null check (action in ('EVALUATED_UNMET','COMPLETED','VOIDED')),
 details jsonb not null default '{}'::jsonb, reason text, occurred_at timestamptz not null default now()
);
create table public.training_completion_requests (
 actor_person_id uuid not null references public.people(id), request_key uuid not null, action text not null,
 payload_hash text not null, result jsonb, created_at timestamptz not null default now(),
 primary key(actor_person_id,request_key)
);
alter table public.training_completion_manager_grants enable row level security;
alter table public.training_completion_manager_events enable row level security;
alter table public.training_completion_rule_versions enable row level security;
alter table public.training_completion_cases enable row level security;
alter table public.training_completions enable row level security;
alter table public.training_completion_events enable row level security;
alter table public.training_completion_requests enable row level security;
revoke all on public.training_completion_manager_grants,public.training_completion_manager_events,
 public.training_completion_rule_versions,public.training_completion_cases,public.training_completions,
 public.training_completion_events,public.training_completion_requests from public,anon,authenticated;

create function private.training_completion_manager() returns boolean language sql stable security definer set search_path='' as $$
 select private.current_person_id() is not null and private.has_active_role('OFFICE_ADMIN') and
 exists(select 1 from public.training_completion_manager_grants g where g.person_id=private.current_person_id() and g.revoked_at is null)
$$;
create function private.training_completion_request(p_actor uuid,p_key uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h text:=encode(extensions.digest(p_payload::text,'sha256'),'hex'); r public.training_completion_requests%rowtype;
begin
 if p_actor is null or p_key is null then raise exception 'Request denied'; end if;
 insert into public.training_completion_requests(actor_person_id,request_key,action,payload_hash)
 values(p_actor,p_key,p_action,h) on conflict do nothing;
 select * into r from public.training_completion_requests where actor_person_id=p_actor and request_key=p_key for update;
 if r.action<>p_action or r.payload_hash<>h then raise exception 'Changed request replay'; end if;
 return r.result;
end $$;
create function private.training_completion_seal() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Training completion evidence immutable'; end $$;
create trigger training_completion_rule_seal before update or delete on public.training_completion_rule_versions for each row execute function private.training_completion_seal();
create trigger training_completion_case_seal before update or delete on public.training_completion_cases for each row execute function private.training_completion_seal();
create trigger training_completion_event_seal before update or delete on public.training_completion_events for each row execute function private.training_completion_seal();
create trigger training_completion_manager_event_seal before update or delete on public.training_completion_manager_events for each row execute function private.training_completion_seal();
create function private.training_completion_fact_seal() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.voided_at is not null or
 (to_jsonb(new)-'voided_by'-'voided_at'-'void_reason') is distinct from
 (to_jsonb(old)-'voided_by'-'voided_at'-'void_reason') or
 new.voided_at is null or new.voided_by is null or length(trim(new.void_reason)) not between 10 and 300
 then raise exception 'Completion immutable'; end if;
 return new;
end $$;
create trigger training_completion_fact_seal before update or delete on public.training_completions for each row execute function private.training_completion_fact_seal();

create function public.training_completion_grant(p_person uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid;
begin
 if actor is null or not private.has_active_role('SUPER_ADMIN') or length(trim(coalesce(p_reason,''))) not between 10 and 300 or
 not private.has_active_role_for_person(p_person,'OFFICE_ADMIN') then raise exception 'Grant denied'; end if;
 insert into public.training_completion_manager_grants(person_id,granted_by,grant_reason)
 values(p_person,actor,trim(p_reason)) returning id into result;
 insert into public.training_completion_manager_events(grant_id,actor_person_id,action,reason)
 values(result,actor,'GRANT',trim(p_reason));
 return result;
end $$;
create function public.training_completion_revoke_grant(p_grant uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid;
begin
 if actor is null or not private.has_active_role('SUPER_ADMIN') or length(trim(coalesce(p_reason,''))) not between 10 and 300 then raise exception 'Revoke denied'; end if;
 update public.training_completion_manager_grants set revoked_by=actor,revoked_at=now(),revoke_reason=trim(p_reason)
 where id=p_grant and revoked_at is null returning id into result;
 if result is null then raise exception 'Grant unavailable'; end if;
 insert into public.training_completion_manager_events(grant_id,actor_person_id,action,reason)
 values(result,actor,'REVOKE',trim(p_reason));
end $$;

create function public.training_completion_publish_rule(p_course_version uuid,p_assessment_version uuid,p_effective_from timestamptz,p_effective_until timestamptz,p_validity_months integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid; n integer; v public.training_course_versions%rowtype; a public.training_assessment_versions%rowtype; payload jsonb;
begin
 if actor is null or not private.has_active_role('OFFICE_ADMIN') or not exists
 (select 1 from public.training_capability_grants g where g.person_id=actor and g.capability='TRAINING_PUBLISHER' and g.revoked_at is null)
 then raise exception 'Publisher authority required'; end if;
 select * into v from public.training_course_versions where id=p_course_version for update;
 select * into a from public.training_assessment_versions where id=p_assessment_version for update;
 if v.id is null or v.state<>'PUBLISHED' or v.retired_at is not null or a.id is null or a.state<>'PUBLISHED' or a.retired_at is not null or
 a.course_version_id<>v.id or p_effective_from is null or p_effective_from>now() or
 (p_effective_until is not null and p_effective_until<=p_effective_from) or
 (p_validity_months is not null and p_validity_months not between 1 and 120) then raise exception 'Invalid rule source'; end if;
 if exists(select 1 from public.training_completion_rule_versions r where r.course_version_id=v.id and
 tstzrange(r.effective_from,r.effective_until,'[)') && tstzrange(p_effective_from,p_effective_until,'[)')) then raise exception 'Rule interval overlaps'; end if;
 select coalesce(max(version_number),0)+1 into n from public.training_completion_rule_versions where course_version_id=v.id;
 payload:=jsonb_build_object('courseVersionId',v.id,'allPagesRequired',true,'assessmentVersionIds',jsonb_build_array(a.id),
 'passEvidenceRule','ONE_SUBMITTED_PASSED_PER_VERSION','effectiveFrom',p_effective_from,'effectiveUntil',p_effective_until,
 'validityMonths',p_validity_months,'version',n);
 insert into public.training_completion_rule_versions(course_version_id,version_number,all_pages_required,required_assessment_version_ids,
 effective_from,effective_until,validity_months,published_by,rule_hash)
 values(v.id,n,true,array[a.id],p_effective_from,p_effective_until,p_validity_months,actor,
 encode(extensions.digest(payload::text,'sha256'),'hex')) returning id into result;
 return result;
end $$;

create function public.training_completion_evaluate(p_assignment uuid,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); replay jsonb; a public.training_assignments%rowtype; v public.training_course_versions%rowtype;
 rule public.training_completion_rule_versions%rowtype; c public.training_completion_cases%rowtype; done public.training_completions%rowtype;
 expected_pages integer; marked_pages integer; attempts uuid[]:='{}'; required_id uuid; passed_id uuid; unmet text[]:='{}'; v_result jsonb;
begin
 replay:=private.training_completion_request(actor,p_request,'EVALUATE',jsonb_build_object('assignment',p_assignment));
 if replay is not null then return replay; end if;
 select * into a from public.training_assignments where id=p_assignment for update;
 if a.id is null or (a.person_id<>actor and not private.training_completion_manager()) then raise exception 'Evaluation denied'; end if;
 if a.state<>'ACTIVE' then raise exception 'Assignment inactive'; end if;
 select * into v from public.training_course_versions where id=a.course_version_id for update;
 if v.state<>'PUBLISHED' or v.retired_at is not null then raise exception 'Course retired'; end if;
 select * into c from public.training_completion_cases where assignment_id=a.id;
 if c.id is null then
  select * into rule from public.training_completion_rule_versions r where r.course_version_id=a.course_version_id and
   r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()) order by r.version_number desc limit 1;
  if rule.id is null then raise exception 'No published effective completion rule'; end if;
  insert into public.training_completion_cases(assignment_id,person_id,course_version_id,rule_version_id,created_by)
  values(a.id,a.person_id,a.course_version_id,rule.id,actor) returning * into c;
 else
  select * into rule from public.training_completion_rule_versions where id=c.rule_version_id;
 end if;
 select * into done from public.training_completions where case_id=c.id;
 if done.id is not null then
  v_result:=jsonb_build_object('caseId',c.id,'completionId',done.id,'status',case when done.voided_at is null then 'COMPLETED' else 'VOIDED' end,'unmet',jsonb_build_array());
 else
  select coalesce(sum(jsonb_array_length(m.value->'pages')),0)::integer into expected_pages from jsonb_array_elements(v.content) m;
  select count(*)::integer into marked_pages from public.training_page_marks p where p.assignment_id=a.id and p.course_version_id=v.id;
  if rule.all_pages_required and marked_pages<>expected_pages then unmet:=array_append(unmet,'PAGES_NOT_ALL_MARKED_VIEWED'); end if;
  foreach required_id in array rule.required_assessment_version_ids loop
   if not exists(select 1 from public.training_assessment_versions av where av.id=required_id and av.course_version_id=v.id and av.state='PUBLISHED' and av.retired_at is null)
   then raise exception 'Required assessment retired'; end if;
   select t.id into passed_id from public.training_attempts t where t.assignment_id=a.id and t.person_id=a.person_id and
   t.course_version_id=v.id and t.assessment_version_id=required_id and t.state='SUBMITTED' and t.result='PASSED'
   order by t.submitted_at,t.id limit 1;
   if passed_id is null then unmet:=array_append(unmet,'PASSED_ATTEMPT_REQUIRED:'||required_id::text);
   else attempts:=array_append(attempts,passed_id); end if;
   passed_id:=null;
  end loop;
  if cardinality(unmet)=0 then
   insert into public.training_completions(case_id,assignment_id,person_id,course_version_id,rule_version_id,rule_hash,
   passed_attempt_ids,page_mark_count,page_count,evaluated_by)
   values(c.id,a.id,a.person_id,v.id,rule.id,rule.rule_hash,attempts,marked_pages,expected_pages,actor) returning * into done;
   insert into public.training_completion_events(case_id,completion_id,actor_person_id,action,details)
   values(c.id,done.id,actor,'COMPLETED',jsonb_build_object('ruleVersionId',rule.id,'passedAttemptIds',attempts,'pageCount',expected_pages));
   v_result:=jsonb_build_object('caseId',c.id,'completionId',done.id,'status','COMPLETED','unmet',jsonb_build_array());
  else
   insert into public.training_completion_events(case_id,actor_person_id,action,details)
   values(c.id,actor,'EVALUATED_UNMET',jsonb_build_object('unmet',unmet));
   v_result:=jsonb_build_object('caseId',c.id,'completionId',null,'status','UNMET','unmet',unmet);
  end if;
 end if;
 update public.training_completion_requests set result=v_result where actor_person_id=actor and request_key=p_request;
 return v_result;
end $$;

create function public.training_completion_mine() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null then raise exception 'Unauthorised'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'assignmentId',c.assignment_id,'courseVersionId',c.course_version_id,
 'ruleVersionId',c.rule_version_id,'completedAt',c.completed_at,'voidedAt',c.voided_at) order by c.completed_at desc),'[]'::jsonb)
 into result from public.training_completions c where c.person_id=actor;
 return result;
end $$;

create function public.training_completion_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if private.current_person_id() is null then raise exception 'Unauthorised'; end if;
 return jsonb_build_object('manager',private.training_completion_manager(),
  'publisher',private.has_active_role('OFFICE_ADMIN') and exists
  (select 1 from public.training_capability_grants g where g.person_id=private.current_person_id() and g.capability='TRAINING_PUBLISHER' and g.revoked_at is null),
  'superAdmin',private.has_active_role('SUPER_ADMIN'));
end $$;
create function public.training_completion_admin() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null or not private.training_completion_manager() then raise exception 'Manager authority required'; end if;
 select jsonb_build_object(
  'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'personId',a.person_id,
   'personName',p.display_name,'courseVersionId',a.course_version_id,'courseTitle',v.title,
   'courseVersion',v.version_number,'state',a.state,'ruleVersionId',c.rule_version_id,
   'completionId',x.id,'completedAt',x.completed_at,'voidedAt',x.voided_at) order by a.assigned_at desc)
   from public.training_assignments a join public.people p on p.id=a.person_id
   join public.training_course_versions v on v.id=a.course_version_id
   left join public.training_completion_cases c on c.assignment_id=a.id
   left join public.training_completions x on x.case_id=c.id), '[]'::jsonb),
  'rules',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'courseVersionId',r.course_version_id,
   'version',r.version_number,'requiredAssessmentVersionIds',r.required_assessment_version_ids,
   'effectiveFrom',r.effective_from,'effectiveUntil',r.effective_until,'ruleHash',r.rule_hash))
   from public.training_completion_rule_versions r),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.training_completion_publish_choices() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null or not private.has_active_role('OFFICE_ADMIN') or not exists
 (select 1 from public.training_capability_grants g where g.person_id=actor and g.capability='TRAINING_PUBLISHER' and g.revoked_at is null)
 then raise exception 'Publisher authority required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('courseVersionId',v.id,'courseTitle',v.title,'courseVersion',v.version_number,
 'assessmentVersionId',av.id,'assessmentVersion',av.version_number) order by v.title,v.version_number,av.version_number),'[]'::jsonb)
 into result from public.training_course_versions v join public.training_assessment_versions av on av.course_version_id=v.id
 where v.state='PUBLISHED' and v.retired_at is null and av.state='PUBLISHED' and av.retired_at is null;
 return result;
end $$;
create function public.training_completion_grants_read() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if private.current_person_id() is null or not private.has_active_role('SUPER_ADMIN') then raise exception 'Oversight denied'; end if;
 select jsonb_build_object('grants',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'personId',g.person_id,
  'personName',p.display_name,'grantedAt',g.granted_at,'revokedAt',g.revoked_at,'reason',g.grant_reason,
  'revokeReason',g.revoke_reason) order by g.granted_at desc)
  from public.training_completion_manager_grants g join public.people p on p.id=g.person_id),'[]'::jsonb),
  'candidates',coalesce((select jsonb_agg(jsonb_build_object('personId',p.id,'personName',p.display_name) order by p.display_name)
  from public.people p where private.has_active_role_for_person(p.id,'OFFICE_ADMIN') and
  not exists(select 1 from public.training_completion_manager_grants g where g.person_id=p.id and g.revoked_at is null)),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.training_completion_void(p_completion uuid,p_reason text,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); replay jsonb; c public.training_completions%rowtype; v_result jsonb;
begin
 if not private.training_completion_manager() or length(trim(coalesce(p_reason,''))) not between 10 and 300 then raise exception 'Correction denied'; end if;
 replay:=private.training_completion_request(actor,p_request,'VOID',jsonb_build_object('completion',p_completion,'reason',trim(p_reason)));
 if replay is not null then return replay; end if;
 select * into c from public.training_completions where id=p_completion for update;
 if c.id is null or c.voided_at is not null then raise exception 'Completion unavailable'; end if;
 update public.training_completions set voided_by=actor,voided_at=now(),void_reason=trim(p_reason) where id=c.id;
 insert into public.training_completion_events(case_id,completion_id,actor_person_id,action,reason)
 values(c.case_id,c.id,actor,'VOIDED',trim(p_reason));
 v_result:=jsonb_build_object('completionId',c.id,'status','VOIDED');
 update public.training_completion_requests set result=v_result where actor_person_id=actor and request_key=p_request;
 return v_result;
end $$;

revoke all on function private.training_completion_manager(),private.training_completion_request(uuid,uuid,text,jsonb),
 private.training_completion_seal(),private.training_completion_fact_seal() from public,anon,authenticated;
revoke all on function public.training_completion_grant(uuid,text),public.training_completion_revoke_grant(uuid,text),
 public.training_completion_publish_rule(uuid,uuid,timestamptz,timestamptz,integer),public.training_completion_evaluate(uuid,uuid),
 public.training_completion_mine(),public.training_completion_void(uuid,text,uuid),public.training_completion_access(),
 public.training_completion_admin(),public.training_completion_publish_choices(),public.training_completion_grants_read() from public,anon,authenticated;
grant execute on function public.training_completion_grant(uuid,text),public.training_completion_revoke_grant(uuid,text),
 public.training_completion_publish_rule(uuid,uuid,timestamptz,timestamptz,integer),public.training_completion_evaluate(uuid,uuid),
 public.training_completion_mine(),public.training_completion_void(uuid,text,uuid),public.training_completion_access(),
 public.training_completion_admin(),public.training_completion_publish_choices(),public.training_completion_grants_read() to authenticated;
