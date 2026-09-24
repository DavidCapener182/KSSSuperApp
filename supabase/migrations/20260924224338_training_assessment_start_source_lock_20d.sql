-- TASK-20D serialize starts with exact source retirement and publication.
create or replace function public.training_assessment_start(p_assignment uuid,p_version uuid,p_request uuid) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.training_assignments%rowtype; v public.training_assessment_versions%rowtype;
 result uuid; current_version uuid; last_result text; last_time timestamptz; submitted_count integer;
begin
 result:=private.training_assessment_request(actor,p_request,'START',jsonb_build_object('assignment',p_assignment,'version',p_version));
 if result is not null then return result; end if;
 select * into a from public.training_assignments where id=p_assignment for update;
 perform 1 from public.training_course_versions c where c.id=a.course_version_id and c.state='PUBLISHED' and c.retired_at is null for share;
 if not found then raise exception 'CourseVersion unavailable'; end if;
 select * into v from public.training_assessment_versions where id=p_version for update;
 if v.id is not null then select current_version_id into current_version from public.training_assessments where id=v.assessment_id for update; end if;
 if a.id is null or a.person_id<>actor or not private.has_active_role('SECURITY_STAFF') or a.state<>'ACTIVE' or
 v.id is null or v.course_version_id<>a.course_version_id or v.state<>'PUBLISHED' or v.retired_at is not null or
 not exists(select 1 from public.training_course_versions c where c.id=a.course_version_id and c.state='PUBLISHED' and c.retired_at is null)
 then raise exception 'Start denied'; end if;
 select id into result from public.training_attempts where assignment_id=a.id and assessment_version_id=v.id
 and state='IN_PROGRESS' for update;
 if result is null then
  if current_version is distinct from v.id then raise exception 'Stale assessment version'; end if;
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
