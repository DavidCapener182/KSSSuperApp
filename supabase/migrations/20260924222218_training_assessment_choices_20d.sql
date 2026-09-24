-- TASK-20D authoring choices for assessment-only Office capability.
create function public.training_assessment_course_choices() returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.training_assessment_can('ASSESSMENT_AUTHOR') and
 not private.training_assessment_can('ASSESSMENT_PUBLISHER') and not private.has_active_role('SUPER_ADMIN')
 then raise exception 'Assessment choices denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('courseVersionId',v.id,'courseId',v.course_id,
 'title',v.title,'versionNumber',v.version_number,'retired',v.retired_at is not null,
 'currentAssessmentVersionId',a.current_version_id) order by v.published_at desc),'[]'::jsonb)
 into result from public.training_course_versions v
 left join public.training_assessments a on a.course_version_id=v.id
 where v.state='PUBLISHED' and v.retired_at is null;
 return result;
end $$;
revoke all on function public.training_assessment_course_choices() from public,anon,authenticated;
grant execute on function public.training_assessment_course_choices() to authenticated;
