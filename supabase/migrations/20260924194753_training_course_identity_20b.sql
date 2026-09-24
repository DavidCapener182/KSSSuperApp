-- TASK-20B stable Course metadata, separate from sealed version snapshots.
alter table public.training_courses add column title text;
alter table public.training_courses add column summary text;
update public.training_courses c set title=v.title,summary=v.summary from public.training_course_versions v where v.course_id=c.id and v.version_number=1;
alter table public.training_courses alter column title set not null;
alter table public.training_courses alter column summary set not null;
alter table public.training_courses add constraint training_course_title_size check (length(trim(title)) between 3 and 160);
alter table public.training_courses add constraint training_course_summary_size check (length(trim(summary)) between 1 and 600);
create or replace function public.training_create_course(p_title text,p_summary text,p_content jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.current_person_id(); v_course uuid; v_version uuid;
begin
 if not private.training_can('TRAINING_AUTHOR') or length(trim(p_title)) not between 3 and 160 or length(trim(p_summary)) not between 1 and 600 then raise exception 'Authoring denied'; end if;
 perform private.training_validate_content(p_content,false);
 insert into public.training_courses(created_by,next_version,title,summary) values(v_actor,2,trim(p_title),trim(p_summary)) returning id into v_course;
 insert into public.training_course_versions(course_id,version_number,title,summary,content,created_by) values(v_course,1,trim(p_title),trim(p_summary),p_content,v_actor) returning id into v_version;
 insert into public.training_course_events(course_id,version_id,actor_person_id,action) values(v_course,v_version,v_actor,'COURSE_CREATE');
 return v_course;
end $$;
create or replace function public.training_admin(p_course uuid default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
 if not private.training_can('TRAINING_AUTHOR') and not private.training_can('TRAINING_PUBLISHER') then raise exception 'Training administration denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('courseId',c.id,'courseTitle',c.title,'courseSummary',c.summary,'currentVersionId',c.current_version_id,'versionId',v.id,'versionNumber',v.version_number,'state',v.state,'revision',v.revision,'title',v.title,'summary',v.summary,'audienceRule',v.audience_rule,'synthetic',v.synthetic,'modules',v.content,'contentHash',v.content_hash,'createdAt',v.created_at,'publishedAt',v.published_at,'retiredAt',v.retired_at,'abandonedAt',v.abandoned_at) order by c.created_at desc,v.version_number desc),'[]'::jsonb) into v_rows
 from public.training_courses c join public.training_course_versions v on v.course_id=c.id where p_course is null or c.id=p_course;
 return v_rows;
end $$;
