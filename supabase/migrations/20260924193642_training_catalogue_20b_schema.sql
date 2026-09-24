-- TASK-20B. Synthetic Dev only. No learning results or provider integration.
create table public.training_courses (
 id uuid primary key default gen_random_uuid(),
 owner_team text not null default 'KSS_OFFICE_ADMIN' check (owner_team = 'KSS_OFFICE_ADMIN'),
 created_by uuid not null references public.people(id),
 created_at timestamptz not null default now(),
 current_version_id uuid,
 next_version integer not null default 1 check (next_version > 0)
);
create table public.training_capability_grants (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references public.people(id),
 capability text not null check (capability in ('TRAINING_AUTHOR','TRAINING_PUBLISHER')),
 granted_by uuid not null references public.people(id), granted_at timestamptz not null default now(),
 revoked_by uuid references public.people(id), revoked_at timestamptz,
 reason text not null check (length(trim(reason)) between 10 and 300),
 check ((revoked_by is null) = (revoked_at is null))
);
create unique index training_active_grant on public.training_capability_grants(person_id,capability) where revoked_at is null;
create table public.training_course_versions (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.training_courses(id),
 version_number integer not null check (version_number > 0),
 state text not null default 'DRAFT' check (state in ('DRAFT','PUBLISHED','ABANDONED')),
 revision integer not null default 1 check (revision > 0),
 title text not null check (length(trim(title)) between 3 and 160),
 summary text not null check (length(trim(summary)) between 1 and 600),
 audience_rule text not null default 'ACTIVE_SECURITY_STAFF_V1' check (audience_rule = 'ACTIVE_SECURITY_STAFF_V1'),
 language_code text not null default 'en-GB' check (language_code = 'en-GB'),
 synthetic boolean not null default true check (synthetic),
 content jsonb not null default '[]'::jsonb,
 content_hash text,
 created_by uuid not null references public.people(id), created_at timestamptz not null default now(),
 published_by uuid references public.people(id), published_at timestamptz,
 abandoned_by uuid references public.people(id), abandoned_at timestamptz, abandonment_reason text,
 retired_by uuid references public.people(id), retired_at timestamptz, retirement_reason text,
 unique(course_id,version_number), unique(course_id,id),
 check ((published_at is null) = (published_by is null)),
 check ((abandoned_at is null) = (abandoned_by is null)),
 check ((retired_at is null) = (retired_by is null)),
 check (state <> 'PUBLISHED' or (published_at is not null and content_hash is not null))
);
alter table public.training_courses add constraint training_current_version_fk foreign key (id,current_version_id) references public.training_course_versions(course_id,id);
create table public.training_course_events (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.training_courses(id),
 version_id uuid references public.training_course_versions(id), actor_person_id uuid not null references public.people(id),
 action text not null check (action in ('COURSE_CREATE','DRAFT_CREATE','DRAFT_EDIT','DRAFT_ABANDON','PUBLISH','SUPERSEDE','RETIRE','GRANT','REVOKE')),
 details jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);
create index training_versions_course on public.training_course_versions(course_id,version_number desc);
create index training_events_course on public.training_course_events(course_id,occurred_at desc);
alter table public.training_courses enable row level security;
alter table public.training_capability_grants enable row level security;
alter table public.training_course_versions enable row level security;
alter table public.training_course_events enable row level security;
revoke all on public.training_courses,public.training_capability_grants,public.training_course_versions,public.training_course_events from anon,authenticated;

create function private.training_can(p_capability text) returns boolean language sql stable security definer set search_path = '' as $$
 select private.has_active_role('SUPER_ADMIN') or (
 private.has_active_role('OFFICE_ADMIN') and exists (
 select 1 from public.training_capability_grants g
 where g.person_id = private.current_person_id() and g.capability = p_capability and g.revoked_at is null))
$$;
revoke all on function private.training_can(text) from public,anon,authenticated;

create function private.training_validate_content(p_content jsonb, p_complete boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare m jsonb; p jsonb; b jsonb; mi integer := 0; pi integer; bi integer; txt text; kind text;
begin
 if jsonb_typeof(p_content) <> 'array' or jsonb_array_length(p_content) > 20 or (p_complete and jsonb_array_length(p_content) = 0) then raise exception 'Invalid modules'; end if;
 for m in select value from jsonb_array_elements(p_content) loop
  mi := mi + 1;
  if jsonb_typeof(m) <> 'object' or m ? 'documentVersionId' or m ? 'url' or m ? 'html' or
   jsonb_typeof(m->'title') <> 'string' or length(trim(m->>'title')) not between 1 and 120 or
   jsonb_typeof(m->'pages') <> 'array' or jsonb_array_length(m->'pages') > 30 or
   (p_complete and jsonb_array_length(m->'pages') = 0) or (select count(*) from jsonb_object_keys(m)) <> 2 then raise exception 'Invalid module'; end if;
  pi := 0;
  for p in select value from jsonb_array_elements(m->'pages') loop
   pi := pi + 1;
   if jsonb_typeof(p) <> 'object' or (select count(*) from jsonb_object_keys(p)) <> 2 or
    jsonb_typeof(p->'title') <> 'string' or length(trim(p->>'title')) not between 1 and 120 or
    jsonb_typeof(p->'blocks') <> 'array' or jsonb_array_length(p->'blocks') > 60 or
    (p_complete and jsonb_array_length(p->'blocks') = 0) or octet_length(p::text) > 16000 then raise exception 'Invalid page'; end if;
   bi := 0;
   for b in select value from jsonb_array_elements(p->'blocks') loop
    bi := bi + 1; kind := b->>'type'; txt := b->>'text';
    if jsonb_typeof(b) <> 'object' or (select count(*) from jsonb_object_keys(b)) <> 2 or
     kind not in ('heading','paragraph','bullet','numbered','emphasis','callout') or
     jsonb_typeof(b->'text') <> 'string' or length(trim(txt)) not between 1 and 1500 then raise exception 'Invalid content block'; end if;
   end loop;
  end loop;
 end loop;
 if octet_length(p_content::text) > 240000 then raise exception 'Course package too large'; end if;
end $$;
revoke all on function private.training_validate_content(jsonb,boolean) from public,anon,authenticated;

create function private.training_seal() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op = 'DELETE' and old.state = 'PUBLISHED' then raise exception 'Published version immutable'; end if;
 if tg_op = 'UPDATE' and old.state = 'PUBLISHED' then
  if (to_jsonb(new) - 'retired_by' - 'retired_at' - 'retirement_reason') is distinct from
     (to_jsonb(old) - 'retired_by' - 'retired_at' - 'retirement_reason') then raise exception 'Published version immutable'; end if;
  if old.retired_at is not null or new.retired_at is null or new.retired_by is null or length(trim(new.retirement_reason)) not between 10 and 300 then raise exception 'Invalid retirement'; end if;
 end if;
 if tg_op = 'UPDATE' and old.state = 'ABANDONED' then raise exception 'Abandoned version immutable'; end if;
 return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger training_version_seal before update or delete on public.training_course_versions for each row execute function private.training_seal();

create function public.training_capabilities() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if private.current_person_id() is null then raise exception 'Unauthorised'; end if;
 return jsonb_build_object('author',private.training_can('TRAINING_AUTHOR'),'publisher',private.training_can('TRAINING_PUBLISHER'),'superAdmin',private.has_active_role('SUPER_ADMIN'));
end $$;
create function public.training_grant(p_person uuid,p_capability text,p_reason text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.current_person_id(); v_id uuid;
begin
 if not private.has_active_role('SUPER_ADMIN') or p_capability not in ('TRAINING_AUTHOR','TRAINING_PUBLISHER') or length(trim(p_reason)) not between 10 and 300 or
 not exists(select 1 from public.role_assignments r where r.person_id=p_person and r.role_code='OFFICE_ADMIN' and r.revoked_at is null and r.effective_from <= now() and (r.effective_until is null or r.effective_until > now())) then raise exception 'Grant denied'; end if;
 insert into public.training_capability_grants(person_id,capability,granted_by,reason) values(p_person,p_capability,v_actor,p_reason) returning id into v_id;
 return v_id;
end $$;
create function public.training_revoke(p_grant uuid,p_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.current_person_id(); v_grant public.training_capability_grants%rowtype;
begin
 if not private.has_active_role('SUPER_ADMIN') or length(trim(p_reason)) not between 10 and 300 then raise exception 'Revoke denied'; end if;
 update public.training_capability_grants set revoked_by=v_actor,revoked_at=now() where id=p_grant and revoked_at is null returning * into v_grant;
 if not found then raise exception 'Grant not found'; end if;
end $$;
create function public.training_create_course(p_title text,p_summary text,p_content jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.current_person_id(); v_course uuid; v_version uuid;
begin
 if not private.training_can('TRAINING_AUTHOR') or length(trim(p_title)) not between 3 and 160 or length(trim(p_summary)) not between 1 and 600 then raise exception 'Authoring denied'; end if;
 perform private.training_validate_content(p_content,false);
 insert into public.training_courses(created_by,next_version) values(v_actor,2) returning id into v_course;
 insert into public.training_course_versions(course_id,version_number,title,summary,content,created_by) values(v_course,1,trim(p_title),trim(p_summary),p_content,v_actor) returning id into v_version;
 insert into public.training_course_events(course_id,version_id,actor_person_id,action) values(v_course,v_version,v_actor,'COURSE_CREATE');
 return v_course;
end $$;
create function public.training_create_draft(p_course uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.current_person_id(); v_number integer; v_previous public.training_course_versions%rowtype; v_id uuid;
begin
 if not private.training_can('TRAINING_AUTHOR') then raise exception 'Authoring denied'; end if;
 select next_version into v_number from public.training_courses where id=p_course for update;
 if not found then raise exception 'Course not found'; end if;
 if exists(select 1 from public.training_course_versions where course_id=p_course and state='DRAFT') then raise exception 'Existing draft'; end if;
 select * into v_previous from public.training_course_versions where course_id=p_course and state='PUBLISHED' order by version_number desc limit 1;
 if not found then raise exception 'No published version'; end if;
 insert into public.training_course_versions(course_id,version_number,title,summary,content,created_by)
 values(p_course,v_number,v_previous.title,v_previous.summary,v_previous.content,v_actor) returning id into v_id;
 update public.training_courses set next_version=next_version+1 where id=p_course;
 insert into public.training_course_events(course_id,version_id,actor_person_id,action) values(p_course,v_id,v_actor,'DRAFT_CREATE');
 return v_id;
end $$;
create function public.training_edit_draft(p_version uuid,p_revision integer,p_title text,p_summary text,p_content jsonb) returns integer language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.current_person_id(); v_course uuid; v_revision integer;
begin
 if not private.training_can('TRAINING_AUTHOR') or length(trim(p_title)) not between 3 and 160 or length(trim(p_summary)) not between 1 and 600 then raise exception 'Authoring denied'; end if;
 perform private.training_validate_content(p_content,false);
 update public.training_course_versions set title=trim(p_title),summary=trim(p_summary),content=p_content,revision=revision+1
 where id=p_version and state='DRAFT' and revision=p_revision returning course_id,revision into v_course,v_revision;
 if not found then raise exception 'Stale or unavailable draft'; end if;
 insert into public.training_course_events(course_id,version_id,actor_person_id,action,details) values(v_course,p_version,v_actor,'DRAFT_EDIT',jsonb_build_object('revision',v_revision));
 return v_revision;
end $$;
create function public.training_abandon_draft(p_version uuid,p_revision integer,p_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.current_person_id(); v_course uuid;
begin
 if not private.training_can('TRAINING_AUTHOR') or length(trim(p_reason)) not between 10 and 300 then raise exception 'Abandon denied'; end if;
 update public.training_course_versions set state='ABANDONED',abandoned_by=v_actor,abandoned_at=now(),abandonment_reason=trim(p_reason)
 where id=p_version and state='DRAFT' and revision=p_revision returning course_id into v_course;
 if not found then raise exception 'Stale or unavailable draft'; end if;
 insert into public.training_course_events(course_id,version_id,actor_person_id,action) values(v_course,p_version,v_actor,'DRAFT_ABANDON');
end $$;
create function public.training_publish(p_version uuid,p_revision integer) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.current_person_id(); v_draft public.training_course_versions%rowtype; v_old uuid; v_course uuid;
begin
 if not private.training_can('TRAINING_PUBLISHER') then raise exception 'Publication denied'; end if;
 select course_id into v_course from public.training_course_versions where id=p_version;
 if v_course is null then raise exception 'Version not found'; end if;
 perform 1 from public.training_courses where id=v_course for update;
 select * into v_draft from public.training_course_versions where id=p_version for update;
 if v_draft.state <> 'DRAFT' or v_draft.revision <> p_revision then raise exception 'Stale or unavailable draft'; end if;
 perform private.training_validate_content(v_draft.content,true);
 select current_version_id into v_old from public.training_courses where id=v_course;
 update public.training_course_versions set state='PUBLISHED',published_by=v_actor,published_at=now(),content_hash=encode(extensions.digest(content::text,'sha256'),'hex') where id=p_version;
 update public.training_courses set current_version_id=p_version where id=v_course;
 if v_old is not null then insert into public.training_course_events(course_id,version_id,actor_person_id,action,details) values(v_course,v_old,v_actor,'SUPERSEDE',jsonb_build_object('newVersionId',p_version)); end if;
 insert into public.training_course_events(course_id,version_id,actor_person_id,action,details) values(v_course,p_version,v_actor,'PUBLISH',jsonb_build_object('versionNumber',v_draft.version_number));
 return p_version;
end $$;
create function public.training_retire(p_version uuid,p_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.current_person_id(); v_course uuid;
begin
 if not private.training_can('TRAINING_PUBLISHER') or length(trim(p_reason)) not between 10 and 300 then raise exception 'Retirement denied'; end if;
 select course_id into v_course from public.training_course_versions where id=p_version;
 perform 1 from public.training_courses where id=v_course and current_version_id=p_version for update;
 if not found then raise exception 'Not current'; end if;
 update public.training_course_versions set retired_by=v_actor,retired_at=now(),retirement_reason=trim(p_reason) where id=p_version and state='PUBLISHED' and retired_at is null;
 if not found then raise exception 'Already retired'; end if;
 update public.training_courses set current_version_id=null where id=v_course;
 insert into public.training_course_events(course_id,version_id,actor_person_id,action) values(v_course,p_version,v_actor,'RETIRE');
end $$;
create function public.training_catalogue(p_course uuid default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
 if not private.has_active_role('SECURITY_STAFF') and not private.has_active_role('OPERATIONS') and not private.training_can('TRAINING_AUTHOR') and not private.training_can('TRAINING_PUBLISHER') then raise exception 'Catalogue denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('courseId',c.id,'versionId',v.id,'versionNumber',v.version_number,'title',v.title,'summary',v.summary,'audienceRule',v.audience_rule,'synthetic',v.synthetic,'modules',v.content) order by v.title),'[]'::jsonb) into v_rows
 from public.training_courses c join public.training_course_versions v on v.id=c.current_version_id
 where v.state='PUBLISHED' and v.retired_at is null and (p_course is null or c.id=p_course);
 return v_rows;
end $$;
create function public.training_admin(p_course uuid default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
 if not private.training_can('TRAINING_AUTHOR') and not private.training_can('TRAINING_PUBLISHER') then raise exception 'Training administration denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('courseId',c.id,'currentVersionId',c.current_version_id,'versionId',v.id,'versionNumber',v.version_number,'state',v.state,'revision',v.revision,'title',v.title,'summary',v.summary,'audienceRule',v.audience_rule,'synthetic',v.synthetic,'modules',v.content,'contentHash',v.content_hash,'createdAt',v.created_at,'publishedAt',v.published_at,'retiredAt',v.retired_at,'abandonedAt',v.abandoned_at) order by c.created_at desc,v.version_number desc),'[]'::jsonb) into v_rows
 from public.training_courses c join public.training_course_versions v on v.course_id=c.id where p_course is null or c.id=p_course;
 return v_rows;
end $$;
create function public.training_history(p_course uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
 if not private.training_can('TRAINING_AUTHOR') and not private.training_can('TRAINING_PUBLISHER') then raise exception 'History denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'versionId',e.version_id,'actorPersonId',e.actor_person_id,'action',e.action,'details',e.details,'occurredAt',e.occurred_at) order by e.occurred_at,e.id),'[]'::jsonb) into v_rows
 from public.training_course_events e where e.course_id=p_course;
 return v_rows;
end $$;
revoke all on function public.training_capabilities(),public.training_grant(uuid,text,text),public.training_revoke(uuid,text),public.training_create_course(text,text,jsonb),public.training_create_draft(uuid),public.training_edit_draft(uuid,integer,text,text,jsonb),public.training_abandon_draft(uuid,integer,text),public.training_publish(uuid,integer),public.training_retire(uuid,text),public.training_catalogue(uuid),public.training_admin(uuid),public.training_history(uuid) from public,anon,authenticated;
grant execute on function public.training_capabilities(),public.training_grant(uuid,text,text),public.training_revoke(uuid,text),public.training_create_course(text,text,jsonb),public.training_create_draft(uuid),public.training_edit_draft(uuid,integer,text,text,jsonb),public.training_abandon_draft(uuid,integer,text),public.training_publish(uuid,integer),public.training_retire(uuid,text),public.training_catalogue(uuid),public.training_admin(uuid),public.training_history(uuid) to authenticated;
