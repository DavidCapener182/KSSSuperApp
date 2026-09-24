-- TASK-20B synthetic Dev fixture only; no real KSS training or completion facts.
do $$
declare v_super uuid := '10000000-0000-4000-8000-000000000001'; v_office uuid := '10000000-0000-4000-8000-000000000002'; v_course uuid; v_version uuid; v_content jsonb;
begin
 if not exists(select 1 from public.people where id=v_super and display_name='Synthetic Super Admin') or
 not exists(select 1 from public.people where id=v_office and display_name='Synthetic Office Admin') then raise exception 'Synthetic Dev personas missing'; end if;
 insert into public.training_capability_grants(person_id,capability,granted_by,reason)
 values(v_office,'TRAINING_AUTHOR',v_super,'Synthetic TASK-20B authoring proof'),(v_office,'TRAINING_PUBLISHER',v_super,'Synthetic TASK-20B publication proof');
 v_content := jsonb_build_array(
  jsonb_build_object('title','1. Purpose and boundaries','pages',jsonb_build_array(
   jsonb_build_object('title','Welcome','blocks',jsonb_build_array(
    jsonb_build_object('type','heading','text','Introduction to event and site security'),
    jsonb_build_object('type','paragraph','text','Synthetic learning content for interface testing only. This is not approved KSS induction, a qualification or compliance material.'),
    jsonb_build_object('type','callout','text','Reading these pages records no completion or compliance fact.'))),
   jsonb_build_object('title','What this course covers','blocks',jsonb_build_array(
    jsonb_build_object('type','paragraph','text','This example introduces common event and site security concepts.'),
    jsonb_build_object('type','bullet','text','Understand the purpose of an assignment briefing.'),
    jsonb_build_object('type','bullet','text','Know when to report a concern to a supervisor.'))))),
  jsonb_build_object('title','2. Working at a site','pages',jsonb_build_array(
   jsonb_build_object('title','Arrival and briefing','blocks',jsonb_build_array(
    jsonb_build_object('type','heading','text','Before beginning a duty'),
    jsonb_build_object('type','numbered','text','Confirm the assigned location and reporting point.'),
    jsonb_build_object('type','numbered','text','Read the current local instructions supplied by the duty lead.'),
    jsonb_build_object('type','emphasis','text','This demonstration does not replace operational instructions.'))),
   jsonb_build_object('title','Communicating concerns','blocks',jsonb_build_array(
    jsonb_build_object('type','paragraph','text','Escalate uncertain situations using the local reporting route given at briefing.'),
    jsonb_build_object('type','callout','text','Do not rely on this synthetic example as an incident procedure.'))))),
  jsonb_build_object('title','3. Event context','pages',jsonb_build_array(
   jsonb_build_object('title','Crowd awareness','blocks',jsonb_build_array(
    jsonb_build_object('type','heading','text','Observe and communicate'),
    jsonb_build_object('type','paragraph','text','This page demonstrates readable long-form content and ordered navigation on a phone.'),
    jsonb_build_object('type','bullet','text','Keep communication clear and factual.'),
    jsonb_build_object('type','bullet','text','Follow the actual site and event plan supplied for the duty.'))),
   jsonb_build_object('title','End of example','blocks',jsonb_build_array(
    jsonb_build_object('type','paragraph','text','You have reached the final synthetic page.'),
    jsonb_build_object('type','callout','text','No progress, pass, completion, certificate or eligibility is recorded.'))))));
 perform private.training_validate_content(v_content,true);
 insert into public.training_courses(created_by,next_version) values(v_office,2) returning id into v_course;
 insert into public.training_course_versions(course_id,version_number,state,title,summary,content,content_hash,created_by,published_by,published_at)
 values(v_course,1,'PUBLISHED','KSS Enterprise — Introduction to Event & Site Security','Synthetic example course for catalogue and page rendering checks.',v_content,encode(extensions.digest(v_content::text,'sha256'),'hex'),v_office,v_office,now()) returning id into v_version;
 update public.training_courses set current_version_id=v_version where id=v_course;
 insert into public.training_course_events(course_id,version_id,actor_person_id,action,details)
 values(v_course,v_version,v_office,'COURSE_CREATE',jsonb_build_object('syntheticFixture',true)),
 (v_course,v_version,v_office,'PUBLISH',jsonb_build_object('versionNumber',1,'syntheticFixture',true));
end $$;
