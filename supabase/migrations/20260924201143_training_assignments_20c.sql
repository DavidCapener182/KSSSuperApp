-- TASK-20C. Synthetic Dev only. Exact-version assignment and factual page progress.
create table public.training_assigner_grants (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references public.people(id),
 granted_by uuid not null references public.people(id), granted_at timestamptz not null default now(),
 effective_from timestamptz not null default now(), effective_until timestamptz,
 grant_reason text not null check (length(trim(grant_reason)) between 10 and 300),
 revoked_by uuid references public.people(id), revoked_at timestamptz,
 revoke_reason text, check (effective_until is null or effective_until > effective_from),
 check ((revoked_by is null and revoked_at is null and revoke_reason is null) or
        (revoked_by is not null and revoked_at is not null and length(trim(revoke_reason)) between 10 and 300))
);
create unique index training_assigner_one_open_grant on public.training_assigner_grants(person_id) where revoked_at is null;
create table public.training_assigner_grant_events (
 id uuid primary key default gen_random_uuid(), grant_id uuid not null references public.training_assigner_grants(id),
 actor_person_id uuid not null references public.people(id), action text not null check (action in ('GRANT','REVOKE')),
 reason text not null, occurred_at timestamptz not null default now()
);
create table public.training_assignments (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references public.people(id),
 course_id uuid not null references public.training_courses(id),
 course_version_id uuid not null, foreign key (course_id,course_version_id) references public.training_course_versions(course_id,id),
 assigned_by uuid not null references public.people(id), assigned_at timestamptz not null default now(),
 due_on date not null, assignment_reason text not null check (length(trim(assignment_reason)) between 10 and 300),
 state text not null default 'ACTIVE' check (state in ('ACTIVE','CANCELLED','SUPERSEDED')),
 revision integer not null default 1 check (revision > 0),
 ended_by uuid references public.people(id), ended_at timestamptz, end_reason text,
 replaces_assignment_id uuid unique references public.training_assignments(id),
 replaced_by_assignment_id uuid unique references public.training_assignments(id),
 check ((state='ACTIVE' and ended_by is null and ended_at is null and end_reason is null) or
        (state<>'ACTIVE' and ended_by is not null and ended_at is not null and length(trim(end_reason)) between 10 and 300))
);
create unique index training_one_active_per_person_course on public.training_assignments(person_id,course_id) where state='ACTIVE';
create index training_assignments_person on public.training_assignments(person_id,assigned_at desc);
create table public.training_assignment_events (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.training_assignments(id),
 actor_person_id uuid not null references public.people(id),
 action text not null check (action in ('ASSIGNED','DUE_CHANGED','CANCELLED','SUPERSEDED')),
 details jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);
create table public.training_learning_positions (
 assignment_id uuid primary key references public.training_assignments(id),
 course_version_id uuid not null references public.training_course_versions(id),
 module_ordinal integer not null check (module_ordinal > 0), page_ordinal integer not null check (page_ordinal > 0),
 saved_by uuid not null references public.people(id), saved_at timestamptz not null default now()
);
create table public.training_page_marks (
 assignment_id uuid not null references public.training_assignments(id),
 course_version_id uuid not null references public.training_course_versions(id),
 module_ordinal integer not null check (module_ordinal > 0), page_ordinal integer not null check (page_ordinal > 0),
 marked_by uuid not null references public.people(id), marked_at timestamptz not null default now(),
 primary key (assignment_id,module_ordinal,page_ordinal)
);
create table public.training_learning_events (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.training_assignments(id),
 course_version_id uuid not null references public.training_course_versions(id),
 actor_person_id uuid not null references public.people(id),
 action text not null check (action in ('SAVE_PLACE','MARK_PAGE')),
 module_ordinal integer not null, page_ordinal integer not null, occurred_at timestamptz not null default now()
);
create table public.training_assignment_requests (
 actor_person_id uuid not null references public.people(id), request_key uuid not null,
 action text not null check (action in ('ASSIGN','SUPERSEDE','CANCEL','DUE_CHANGE')),
 payload_hash text not null, result_id uuid, created_at timestamptz not null default now(),
 primary key(actor_person_id,request_key)
);
alter table public.training_assigner_grants enable row level security;
alter table public.training_assigner_grant_events enable row level security;
alter table public.training_assignments enable row level security;
alter table public.training_assignment_events enable row level security;
alter table public.training_learning_positions enable row level security;
alter table public.training_page_marks enable row level security;
alter table public.training_learning_events enable row level security;
alter table public.training_assignment_requests enable row level security;
revoke all on public.training_assigner_grants,public.training_assigner_grant_events,public.training_assignments,
 public.training_assignment_events,public.training_learning_positions,public.training_page_marks,
 public.training_learning_events,public.training_assignment_requests from public,anon,authenticated;

create function private.training_assigner() returns boolean language sql stable security definer set search_path='' as $$
 select private.current_person_id() is not null and
 (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')) and
 exists(select 1 from public.training_assigner_grants g where g.person_id=private.current_person_id()
  and g.revoked_at is null and g.effective_from<=now() and (g.effective_until is null or g.effective_until>now()))
$$;
create function private.training_staff_eligible(p_person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.role_assignments r where r.person_id=p_person and r.role_code='SECURITY_STAFF'
  and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))
 and exists(select 1 from public.auth_identities i where i.person_id=p_person and i.active)
$$;
create function private.training_valid_page(p_version uuid,p_module integer,p_page integer) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.training_course_versions v where v.id=p_version and
  p_module between 1 and jsonb_array_length(v.content) and
  p_page between 1 and jsonb_array_length(v.content->(p_module-1)->'pages'))
$$;
create function private.training_request(p_actor uuid,p_key uuid,p_action text,p_payload jsonb) returns uuid
 language plpgsql security definer set search_path='' as $$
declare h text := encode(extensions.digest(p_payload::text,'sha256'),'hex'); r public.training_assignment_requests%rowtype;
begin
 if p_key is null then raise exception 'Request key required'; end if;
 insert into public.training_assignment_requests(actor_person_id,request_key,action,payload_hash)
 values(p_actor,p_key,p_action,h) on conflict do nothing;
 select * into r from public.training_assignment_requests where actor_person_id=p_actor and request_key=p_key for update;
 if r.action<>p_action or r.payload_hash<>h then raise exception 'Changed-payload request replay'; end if;
 return r.result_id;
end $$;
revoke all on function private.training_assigner(),private.training_staff_eligible(uuid),private.training_valid_page(uuid,integer,integer),private.training_request(uuid,uuid,text,jsonb) from public,anon,authenticated;

create function public.training_assigner_grant(p_person uuid,p_from timestamptz,p_until timestamptz,p_reason text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid;
begin
 if not private.has_active_role('SUPER_ADMIN') or p_person is null or p_from is null or
 (p_until is not null and p_until<=p_from) or length(trim(p_reason)) not between 10 and 300 or
 not exists(select 1 from public.role_assignments r where r.person_id=p_person and r.role_code='OFFICE_ADMIN'
  and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now())) or
 not exists(select 1 from public.auth_identities i where i.person_id=p_person and i.active) then raise exception 'Grant denied'; end if;
 insert into public.training_assigner_grants(person_id,granted_by,effective_from,effective_until,grant_reason)
 values(p_person,actor,p_from,p_until,trim(p_reason)) returning id into result;
 insert into public.training_assigner_grant_events(grant_id,actor_person_id,action,reason) values(result,actor,'GRANT',trim(p_reason));
 return result;
end $$;
create function public.training_assigner_revoke(p_grant uuid,p_reason text) returns void
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid;
begin
 if not private.has_active_role('SUPER_ADMIN') or length(trim(p_reason)) not between 10 and 300 then raise exception 'Revoke denied'; end if;
 update public.training_assigner_grants set revoked_by=actor,revoked_at=now(),revoke_reason=trim(p_reason)
 where id=p_grant and revoked_at is null returning id into result;
 if result is null then raise exception 'Grant not found'; end if;
 insert into public.training_assigner_grant_events(grant_id,actor_person_id,action,reason) values(result,actor,'REVOKE',trim(p_reason));
end $$;
create function public.training_assigner_access() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('assigner',private.training_assigner(),'superAdmin',private.has_active_role('SUPER_ADMIN'))
$$;
create function public.training_assigner_grants_read() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_active_role('SUPER_ADMIN') then raise exception 'Grant history denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'personId',g.person_id,'displayName',p.display_name,
 'grantedBy',g.granted_by,'grantedAt',g.granted_at,'effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,
 'grantReason',g.grant_reason,'revokedBy',g.revoked_by,'revokedAt',g.revoked_at,'revokeReason',g.revoke_reason)
 order by g.granted_at desc),'[]'::jsonb) into result from public.training_assigner_grants g join public.people p on p.id=g.person_id;
 return result;
end $$;
create function public.training_assignable_choices() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.training_assigner() then raise exception 'Choices denied'; end if;
 return jsonb_build_object(
 'staff',(select coalesce(jsonb_agg(jsonb_build_object('personId',p.id,'displayName',p.display_name) order by p.display_name),'[]'::jsonb)
  from public.people p where private.training_staff_eligible(p.id)),
 'courses',(select coalesce(jsonb_agg(jsonb_build_object('courseId',c.id,'versionId',v.id,'versionNumber',v.version_number,'title',v.title) order by v.title),'[]'::jsonb)
  from public.training_courses c join public.training_course_versions v on v.id=c.current_version_id
  where v.state='PUBLISHED' and v.retired_at is null));
end $$;

create function public.training_assign(p_person uuid,p_course uuid,p_version uuid,p_due date,p_reason text,p_request uuid) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid; current_version uuid;
begin
 if not private.training_assigner() or p_person is null or p_course is null or p_version is null or p_due is null or
 length(trim(p_reason)) not between 10 and 300 then raise exception 'Assignment denied'; end if;
 result:=private.training_request(actor,p_request,'ASSIGN',jsonb_build_object('person',p_person,'course',p_course,'version',p_version,'due',p_due,'reason',trim(p_reason)));
 if result is not null then return result; end if;
 select current_version_id into current_version from public.training_courses where id=p_course for update;
 if current_version is distinct from p_version or not private.training_staff_eligible(p_person) or
 not exists(select 1 from public.training_course_versions v where v.id=p_version and v.course_id=p_course and v.state='PUBLISHED' and v.retired_at is null) or
 exists(select 1 from public.training_assignments a where a.person_id=p_person and a.course_id=p_course and a.state='ACTIVE') or
 not private.training_assigner() then raise exception 'Assignment target stale or unavailable'; end if;
 insert into public.training_assignments(person_id,course_id,course_version_id,assigned_by,due_on,assignment_reason)
 values(p_person,p_course,p_version,actor,p_due,trim(p_reason)) returning id into result;
 insert into public.training_assignment_events(assignment_id,actor_person_id,action,details)
 values(result,actor,'ASSIGNED',jsonb_build_object('courseVersionId',p_version,'dueOn',p_due,'reason',trim(p_reason)));
 update public.training_assignment_requests set result_id=result where actor_person_id=actor and request_key=p_request;
 return result;
end $$;
create function public.training_change_due(p_assignment uuid,p_revision integer,p_due date,p_reason text,p_request uuid) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); prior public.training_assignments%rowtype; result uuid;
begin
 if not private.training_assigner() or p_due is null or length(trim(p_reason)) not between 10 and 300 then raise exception 'Due-date change denied'; end if;
 result:=private.training_request(actor,p_request,'DUE_CHANGE',jsonb_build_object('assignment',p_assignment,'revision',p_revision,'due',p_due,'reason',trim(p_reason)));
 if result is not null then return result; end if;
 select * into prior from public.training_assignments where id=p_assignment for update;
 if prior.id is null or prior.state<>'ACTIVE' or prior.revision<>p_revision or prior.due_on=p_due or not private.training_assigner() then raise exception 'Stale or unavailable assignment'; end if;
 update public.training_assignments set due_on=p_due,revision=revision+1 where id=p_assignment;
 insert into public.training_assignment_events(assignment_id,actor_person_id,action,details)
 values(p_assignment,actor,'DUE_CHANGED',jsonb_build_object('oldDueOn',prior.due_on,'newDueOn',p_due,'reason',trim(p_reason),'revision',p_revision+1));
 update public.training_assignment_requests set result_id=p_assignment where actor_person_id=actor and request_key=p_request;
 return p_assignment;
end $$;
create function public.training_cancel(p_assignment uuid,p_revision integer,p_reason text,p_request uuid) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); prior public.training_assignments%rowtype; result uuid;
begin
 if not private.training_assigner() or length(trim(p_reason)) not between 10 and 300 then raise exception 'Cancellation denied'; end if;
 result:=private.training_request(actor,p_request,'CANCEL',jsonb_build_object('assignment',p_assignment,'revision',p_revision,'reason',trim(p_reason)));
 if result is not null then return result; end if;
 select * into prior from public.training_assignments where id=p_assignment for update;
 if prior.id is null or prior.state<>'ACTIVE' or prior.revision<>p_revision or not private.training_assigner() then raise exception 'Stale or unavailable assignment'; end if;
 update public.training_assignments set state='CANCELLED',revision=revision+1,ended_by=actor,ended_at=now(),end_reason=trim(p_reason) where id=p_assignment;
 insert into public.training_assignment_events(assignment_id,actor_person_id,action,details)
 values(p_assignment,actor,'CANCELLED',jsonb_build_object('reason',trim(p_reason),'revision',p_revision+1));
 update public.training_assignment_requests set result_id=p_assignment where actor_person_id=actor and request_key=p_request;
 return p_assignment;
end $$;
create function public.training_supersede_assignment(p_assignment uuid,p_revision integer,p_version uuid,p_due date,p_reason text,p_request uuid) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); prior public.training_assignments%rowtype; result uuid; current_version uuid; course uuid;
begin
 if not private.training_assigner() or p_due is null or p_version is null or length(trim(p_reason)) not between 10 and 300 then raise exception 'Supersession denied'; end if;
 result:=private.training_request(actor,p_request,'SUPERSEDE',jsonb_build_object('assignment',p_assignment,'revision',p_revision,'version',p_version,'due',p_due,'reason',trim(p_reason)));
 if result is not null then return result; end if;
 select course_id into course from public.training_assignments where id=p_assignment;
 select current_version_id into current_version from public.training_courses where id=course for update;
 select * into prior from public.training_assignments where id=p_assignment for update;
 if prior.id is null or prior.state<>'ACTIVE' or prior.revision<>p_revision or current_version is distinct from p_version or
 prior.course_version_id=p_version or not private.training_staff_eligible(prior.person_id) or not private.training_assigner() or
 not exists(select 1 from public.training_course_versions v where v.id=p_version and v.course_id=course and v.state='PUBLISHED' and v.retired_at is null)
 then raise exception 'Stale or unavailable supersession'; end if;
 update public.training_assignments set state='SUPERSEDED',revision=revision+1,ended_by=actor,ended_at=now(),end_reason=trim(p_reason) where id=p_assignment;
 insert into public.training_assignments(person_id,course_id,course_version_id,assigned_by,due_on,assignment_reason,replaces_assignment_id)
 values(prior.person_id,course,p_version,actor,p_due,trim(p_reason),p_assignment) returning id into result;
 update public.training_assignments set replaced_by_assignment_id=result where id=p_assignment;
 insert into public.training_assignment_events(assignment_id,actor_person_id,action,details)
 values(p_assignment,actor,'SUPERSEDED',jsonb_build_object('newAssignmentId',result,'newVersionId',p_version,'reason',trim(p_reason)));
 insert into public.training_assignment_events(assignment_id,actor_person_id,action,details)
 values(result,actor,'ASSIGNED',jsonb_build_object('replacesAssignmentId',p_assignment,'courseVersionId',p_version,'dueOn',p_due,'reason',trim(p_reason)));
 update public.training_assignment_requests set result_id=result where actor_person_id=actor and request_key=p_request;
 return result;
end $$;

create function private.training_learning_guard(p_assignment uuid,p_module integer,p_page integer) returns uuid
 language plpgsql security definer set search_path='' as $$
declare a public.training_assignments%rowtype;
begin
 select * into a from public.training_assignments where id=p_assignment for update;
 if a.id is null or a.person_id<>private.current_person_id() or not private.has_active_role('SECURITY_STAFF') or
 a.state<>'ACTIVE' or not private.training_staff_eligible(a.person_id) or
 not exists(select 1 from public.training_course_versions v where v.id=a.course_version_id and v.retired_at is null and v.state='PUBLISHED') or
 not private.training_valid_page(a.course_version_id,p_module,p_page) then raise exception 'Learning action denied'; end if;
 return a.course_version_id;
end $$;
revoke all on function private.training_learning_guard(uuid,integer,integer) from public,anon,authenticated;
create function public.training_save_place(p_assignment uuid,p_module integer,p_page integer) returns void
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); version uuid;
begin
 version:=private.training_learning_guard(p_assignment,p_module,p_page);
 if exists(select 1 from public.training_learning_positions where assignment_id=p_assignment and module_ordinal=p_module and page_ordinal=p_page) then return; end if;
 insert into public.training_learning_positions(assignment_id,course_version_id,module_ordinal,page_ordinal,saved_by)
 values(p_assignment,version,p_module,p_page,actor)
 on conflict(assignment_id) do update set module_ordinal=p_module,page_ordinal=p_page,saved_by=actor,saved_at=now();
 insert into public.training_learning_events(assignment_id,course_version_id,actor_person_id,action,module_ordinal,page_ordinal)
 values(p_assignment,version,actor,'SAVE_PLACE',p_module,p_page);
end $$;
create function public.training_mark_page(p_assignment uuid,p_module integer,p_page integer) returns void
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); version uuid; inserted integer;
begin
 version:=private.training_learning_guard(p_assignment,p_module,p_page);
 insert into public.training_page_marks(assignment_id,course_version_id,module_ordinal,page_ordinal,marked_by)
 values(p_assignment,version,p_module,p_page,actor) on conflict do nothing;
 get diagnostics inserted = row_count;
 if inserted=1 then
  insert into public.training_learning_events(assignment_id,course_version_id,actor_person_id,action,module_ordinal,page_ordinal)
  values(p_assignment,version,actor,'MARK_PAGE',p_module,p_page);
 end if;
end $$;

create function private.training_assignment_json(a public.training_assignments) returns jsonb
 language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',a.id,'personId',a.person_id,'displayName',p.display_name,'courseId',a.course_id,
 'versionId',a.course_version_id,'versionNumber',v.version_number,'title',v.title,'assignedAt',a.assigned_at,
 'dueOn',a.due_on,'reason',a.assignment_reason,'state',a.state,'revision',a.revision,'retired',v.retired_at is not null,
 'replacesAssignmentId',a.replaces_assignment_id,'replacedByAssignmentId',a.replaced_by_assignment_id,
 'endedAt',a.ended_at,'endReason',a.end_reason,'pageCount',
 (select coalesce(sum(jsonb_array_length(m->'pages')),0) from jsonb_array_elements(v.content) m),
 'viewedCount',(select count(*) from public.training_page_marks pm where pm.assignment_id=a.id),
 'savedModule',(select lp.module_ordinal from public.training_learning_positions lp where lp.assignment_id=a.id),
 'savedPage',(select lp.page_ordinal from public.training_learning_positions lp where lp.assignment_id=a.id))
 from public.training_course_versions v join public.people p on p.id=a.person_id where v.id=a.course_version_id
$$;
revoke all on function private.training_assignment_json(public.training_assignments) from public,anon,authenticated;
create function public.training_my_learning() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_active_role('SECURITY_STAFF') or private.current_person_id() is null then raise exception 'Learning denied'; end if;
 select coalesce(jsonb_agg(private.training_assignment_json(a) order by (a.state='ACTIVE') desc,a.assigned_at desc),'[]'::jsonb)
 into result from public.training_assignments a where a.person_id=private.current_person_id();
 return result;
end $$;
create function public.training_assignment_content(p_assignment uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_active_role('SECURITY_STAFF') then raise exception 'Content denied'; end if;
 select jsonb_build_object('assignment',private.training_assignment_json(a),'modules',v.content,
  'marks',(select coalesce(jsonb_agg(jsonb_build_object('module',m.module_ordinal,'page',m.page_ordinal)),'[]'::jsonb)
   from public.training_page_marks m where m.assignment_id=a.id)) into result
 from public.training_assignments a join public.training_course_versions v on v.id=a.course_version_id
 where a.id=p_assignment and a.person_id=private.current_person_id() and a.state='ACTIVE' and v.state='PUBLISHED' and v.retired_at is null;
 if result is null then raise exception 'Content unavailable'; end if;
 return result;
end $$;
create function public.training_assignments_admin() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.training_assigner() and not private.has_active_role('SUPER_ADMIN') then raise exception 'Assignment administration denied'; end if;
 select coalesce(jsonb_agg(private.training_assignment_json(a) order by (a.state='ACTIVE') desc,a.assigned_at desc),'[]'::jsonb)
 into result from public.training_assignments a;
 return result;
end $$;
create function public.training_assignment_history(p_assignment uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.training_assigner() and not private.has_active_role('SUPER_ADMIN') and
 not (private.has_active_role('SECURITY_STAFF') and exists(select 1 from public.training_assignments a where a.id=p_assignment and a.person_id=private.current_person_id()))
 then raise exception 'History denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'actorPersonId',e.actor_person_id,
 'details',e.details,'occurredAt',e.occurred_at) order by e.occurred_at,e.id),'[]'::jsonb)
 into result from public.training_assignment_events e where e.assignment_id=p_assignment;
 return result;
end $$;

-- Historical published versions may be explicitly retired without changing the current pointer.
create or replace function public.training_retire(p_version uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); course uuid; current_version uuid;
begin
 if not private.training_can('TRAINING_PUBLISHER') or length(trim(p_reason)) not between 10 and 300 then raise exception 'Retirement denied'; end if;
 select course_id into course from public.training_course_versions where id=p_version;
 if course is null then raise exception 'Version not found'; end if;
 select current_version_id into current_version from public.training_courses where id=course for update;
 update public.training_course_versions set retired_by=actor,retired_at=now(),retirement_reason=trim(p_reason)
 where id=p_version and state='PUBLISHED' and retired_at is null;
 if not found then raise exception 'Already retired or unavailable'; end if;
 if current_version=p_version then update public.training_courses set current_version_id=null where id=course; end if;
 insert into public.training_course_events(course_id,version_id,actor_person_id,action,details)
 values(course,p_version,actor,'RETIRE',jsonb_build_object('reason',trim(p_reason)));
end $$;

revoke all on function public.training_assigner_grant(uuid,timestamptz,timestamptz,text),
 public.training_assigner_revoke(uuid,text),public.training_assigner_access(),public.training_assigner_grants_read(),
 public.training_assignable_choices(),public.training_assign(uuid,uuid,uuid,date,text,uuid),
 public.training_change_due(uuid,integer,date,text,uuid),public.training_cancel(uuid,integer,text,uuid),
 public.training_supersede_assignment(uuid,integer,uuid,date,text,uuid),public.training_save_place(uuid,integer,integer),
 public.training_mark_page(uuid,integer,integer),public.training_my_learning(),public.training_assignment_content(uuid),
 public.training_assignments_admin(),public.training_assignment_history(uuid) from public,anon,authenticated;
grant execute on function public.training_assigner_grant(uuid,timestamptz,timestamptz,text),
 public.training_assigner_revoke(uuid,text),public.training_assigner_access(),public.training_assigner_grants_read(),
 public.training_assignable_choices(),public.training_assign(uuid,uuid,uuid,date,text,uuid),
 public.training_change_due(uuid,integer,date,text,uuid),public.training_cancel(uuid,integer,text,uuid),
 public.training_supersede_assignment(uuid,integer,uuid,date,text,uuid),public.training_save_place(uuid,integer,integer),
 public.training_mark_page(uuid,integer,integer),public.training_my_learning(),public.training_assignment_content(uuid),
 public.training_assignments_admin(),public.training_assignment_history(uuid) to authenticated;
