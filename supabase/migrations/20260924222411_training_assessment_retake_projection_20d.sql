-- TASK-20D server-time retake availability projection.
create or replace function public.training_assessment_staff(p_assignment uuid) returns jsonb
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
 'passedCurrent',last_result='PASSED','retakeBlocked',last_result='FAILED' and now()<last_time+interval '30 minutes');
 return result;
end $$;
