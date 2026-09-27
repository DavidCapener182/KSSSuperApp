-- TASK-20F-A synthetic pilot only. This records Training requirements, never deployability.
-- The Supabase CLI is unavailable in this isolated worktree; filename is provisional until apply.
create table public.training_requirements_20fa (
 id uuid primary key default gen_random_uuid(),
 label text not null check (length(trim(label)) between 3 and 120),
 created_by uuid not null references public.people(id),
 created_at timestamptz not null default now()
);
create table public.training_requirement_grants_20fa (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.people(id),
 capability text not null check (capability in ('AUTHOR','PUBLISHER','VIEWER')),
 service_id uuid references public.site_services(id),
 granted_by uuid not null references public.people(id),
 granted_at timestamptz not null default now(),
 effective_until timestamptz not null,
 reason text not null check (length(trim(reason)) between 10 and 300),
 revoked_by uuid references public.people(id),
 revoked_at timestamptz,
 revoke_reason text,
 check (effective_until>granted_at),
 check (capability<>'VIEWER' or service_id is not null),
 check (capability='VIEWER' or service_id is null),
 check ((revoked_by is null and revoked_at is null and revoke_reason is null) or
        (revoked_by is not null and revoked_at is not null and length(trim(revoke_reason)) between 10 and 300))
);
create unique index training_requirement_open_grant_20fa on public.training_requirement_grants_20fa
 (person_id,capability,coalesce(service_id,'00000000-0000-0000-0000-000000000000'::uuid))
 where revoked_at is null;
create table public.training_requirement_versions_20fa (
 id uuid primary key default gen_random_uuid(),
 requirement_id uuid not null references public.training_requirements_20fa(id),
 version_number integer not null check (version_number>0),
 state text not null default 'DRAFT' check (state in ('DRAFT','PUBLISHED','ABANDONED')),
 role_id uuid not null references public.operational_role_definitions(id),
 site_id uuid references public.sites(id),
 service_id uuid references public.site_services(id),
 course_id uuid not null references public.training_courses(id),
 course_version_id uuid not null,
 foreign key(course_id,course_version_id) references public.training_course_versions(course_id,id),
 prior_evidence text not null check (prior_evidence in ('NOT_ACCEPTED','ACCEPT_IF_CURRENT')),
 effective_from date not null,
 effective_until date,
 content_hash text,
 created_by uuid not null references public.people(id),
 created_at timestamptz not null default now(),
 published_by uuid references public.people(id),
 published_at timestamptz,
 publish_reason text,
 unique(requirement_id,version_number),
 check (effective_until is null or effective_until>effective_from),
 check (service_id is null or site_id is not null),
 check ((state='PUBLISHED' and published_by is not null and published_at is not null and
         content_hash is not null and length(trim(publish_reason)) between 10 and 300)
        or (state<>'PUBLISHED' and published_by is null and published_at is null and content_hash is null))
);
create unique index training_requirement_one_draft_20fa on public.training_requirement_versions_20fa(requirement_id)
 where state='DRAFT';
create table public.training_requirement_events_20fa (
 id uuid primary key default gen_random_uuid(),
 requirement_id uuid references public.training_requirements_20fa(id),
 version_id uuid references public.training_requirement_versions_20fa(id),
 grant_id uuid references public.training_requirement_grants_20fa(id),
 action text not null check (action in ('DRAFT_CREATED','PUBLISHED','ABANDONED','GRANT','REVOKE')),
 actor_person_id uuid not null references public.people(id),
 reason text not null,
 occurred_at timestamptz not null default now()
);
alter table public.training_requirements_20fa enable row level security;
alter table public.training_requirement_grants_20fa enable row level security;
alter table public.training_requirement_versions_20fa enable row level security;
alter table public.training_requirement_events_20fa enable row level security;
revoke all on public.training_requirements_20fa, public.training_requirement_grants_20fa,
 public.training_requirement_versions_20fa, public.training_requirement_events_20fa
 from public, anon, authenticated;

create function private.training_requirement_granted_20fa(p_capability text,p_service uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select private.current_person_id() is not null and private.has_active_role('OFFICE_ADMIN') and
 exists(select 1 from public.training_requirement_grants_20fa g
  where g.person_id=private.current_person_id() and g.capability=p_capability
   and g.revoked_at is null and g.effective_until>now()
   and (p_service is null and g.service_id is null or p_service is not null and (g.service_id is null or g.service_id=p_service)))
$$;
create function private.training_requirement_seal_20fa() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Training requirement history is immutable'; end $$;
create trigger training_requirement_identity_seal_20fa before update or delete on public.training_requirements_20fa
 for each row execute function private.training_requirement_seal_20fa();
create trigger training_requirement_event_seal_20fa before update or delete on public.training_requirement_events_20fa
 for each row execute function private.training_requirement_seal_20fa();
create function private.training_requirement_version_guard_20fa() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.state<>'DRAFT' or new.state not in ('PUBLISHED','ABANDONED') or
 (to_jsonb(new)-'state'-'published_by'-'published_at'-'publish_reason'-'content_hash') is distinct from
 (to_jsonb(old)-'state'-'published_by'-'published_at'-'publish_reason'-'content_hash')
 then raise exception 'Requirement version is sealed'; end if;
 return new;
end $$;
create trigger training_requirement_version_guard_20fa before update or delete on public.training_requirement_versions_20fa
 for each row execute function private.training_requirement_version_guard_20fa();
create function private.training_requirement_grant_guard_20fa() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.revoked_at is not null or new.revoked_at is null or
 (to_jsonb(new)-'revoked_by'-'revoked_at'-'revoke_reason') is distinct from
 (to_jsonb(old)-'revoked_by'-'revoked_at'-'revoke_reason')
 then raise exception 'Requirement grant is sealed'; end if;
 return new;
end $$;
create trigger training_requirement_grant_guard_20fa before update or delete on public.training_requirement_grants_20fa
 for each row execute function private.training_requirement_grant_guard_20fa();

create function public.training_requirement_grant_20fa(p_person uuid,p_capability text,p_service uuid,p_until timestamptz,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid;
begin
 if actor is null or not private.has_active_role('SUPER_ADMIN') or
 p_capability not in ('AUTHOR','PUBLISHER','VIEWER') or
 (p_capability='VIEWER' and p_service is null) or
 (p_capability<>'VIEWER' and p_service is not null) or
 length(trim(coalesce(p_reason,''))) not between 10 and 300 or
 p_until is null or p_until<=now() or
 (p_service is not null and not exists(select 1 from public.site_services where id=p_service)) or
 not private.has_active_role_for_person(p_person,'OFFICE_ADMIN')
 then raise exception 'Requirement grant denied'; end if;
 insert into public.training_requirement_grants_20fa(person_id,capability,service_id,granted_by,effective_until,reason)
 values(p_person,p_capability,p_service,actor,p_until,trim(p_reason)) returning id into result;
 insert into public.training_requirement_events_20fa(grant_id,action,actor_person_id,reason)
 values(result,'GRANT',actor,trim(p_reason));
 return result;
end $$;
create function public.training_requirement_revoke_grant_20fa(p_grant uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid;
begin
 if actor is null or not private.has_active_role('SUPER_ADMIN') or
 length(trim(coalesce(p_reason,''))) not between 10 and 300 then raise exception 'Requirement revoke denied'; end if;
 update public.training_requirement_grants_20fa set revoked_by=actor,revoked_at=now(),revoke_reason=trim(p_reason)
 where id=p_grant and revoked_at is null returning id into result;
 if result is null then raise exception 'Grant unavailable'; end if;
 insert into public.training_requirement_events_20fa(grant_id,action,actor_person_id,reason)
 values(result,'REVOKE',actor,trim(p_reason));
end $$;

create function public.training_requirement_create_20fa(p_label text,p_role uuid,p_site uuid,p_service uuid,
 p_course_version uuid,p_prior text,p_from date,p_until date,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid; vid uuid; course uuid; actual_site uuid;
begin
 if actor is null or not private.training_requirement_granted_20fa('AUTHOR',p_service) or
 length(trim(coalesce(p_label,''))) not between 3 and 120 or length(trim(coalesce(p_reason,''))) not between 10 and 300 or
 p_prior not in ('NOT_ACCEPTED','ACCEPT_IF_CURRENT') or p_from is null or
 (p_until is not null and p_until<=p_from) or
 not exists(select 1 from public.operational_role_definitions where id=p_role and active and code<>'SIA')
 then raise exception 'Requirement draft denied'; end if;
 if p_site is not null and not exists(select 1 from public.sites where id=p_site and status='ACTIVE')
 then raise exception 'Site unavailable'; end if;
 if p_service is not null then
  select site_id into actual_site from public.site_services where id=p_service and state='ACTIVE';
  if actual_site is distinct from p_site then raise exception 'Service/site mismatch'; end if;
 end if;
 select course_id into course from public.training_course_versions
 where id=p_course_version and state='PUBLISHED' and retired_at is null;
 if course is null then raise exception 'CourseVersion unavailable'; end if;
 insert into public.training_requirements_20fa(label,created_by) values(trim(p_label),actor) returning id into result;
 insert into public.training_requirement_versions_20fa(requirement_id,version_number,role_id,site_id,service_id,
  course_id,course_version_id,prior_evidence,effective_from,effective_until,created_by)
 values(result,1,p_role,p_site,p_service,course,p_course_version,p_prior,p_from,p_until,actor) returning id into vid;
 insert into public.training_requirement_events_20fa(requirement_id,version_id,action,actor_person_id,reason)
 values(result,vid,'DRAFT_CREATED',actor,trim(p_reason));
 return result;
end $$;
create function public.training_requirement_publish_20fa(p_version uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); v public.training_requirement_versions_20fa%rowtype; h text;
begin
 if actor is null or length(trim(coalesce(p_reason,''))) not between 10 and 300 then raise exception 'Publish denied'; end if;
 select * into v from public.training_requirement_versions_20fa where id=p_version for update;
 if v.id is null or v.state<>'DRAFT' or not private.training_requirement_granted_20fa('PUBLISHER',v.service_id)
 then raise exception 'Publish denied'; end if;
 perform 1 from public.training_requirements_20fa where id=v.requirement_id for update;
 if exists(select 1 from public.training_requirement_versions_20fa x where x.requirement_id=v.requirement_id
  and x.state='PUBLISHED' and daterange(x.effective_from,x.effective_until,'[)') &&
    daterange(v.effective_from,v.effective_until,'[)'))
 then raise exception 'Published interval overlaps'; end if;
 if not exists(select 1 from public.training_course_versions c where c.id=v.course_version_id
  and c.state='PUBLISHED' and c.retired_at is null) then raise exception 'CourseVersion unavailable'; end if;
 h:=encode(extensions.digest(jsonb_build_object('requirementId',v.requirement_id,'version',v.version_number,
  'roleId',v.role_id,'siteId',v.site_id,'serviceId',v.service_id,'courseVersionId',v.course_version_id,
  'priorEvidence',v.prior_evidence,'from',v.effective_from,'until',v.effective_until)::text,'sha256'),'hex');
 update public.training_requirement_versions_20fa set state='PUBLISHED',published_by=actor,published_at=now(),
  publish_reason=trim(p_reason),content_hash=h where id=v.id;
 insert into public.training_requirement_events_20fa(requirement_id,version_id,action,actor_person_id,reason)
 values(v.requirement_id,v.id,'PUBLISHED',actor,trim(p_reason));
 return v.id;
end $$;
create function public.training_requirement_revise_20fa(p_previous uuid,p_course_version uuid,p_prior text,
 p_from date,p_until date,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); prior public.training_requirement_versions_20fa%rowtype;
 result uuid; course uuid; n integer;
begin
 select * into prior from public.training_requirement_versions_20fa where id=p_previous;
 if actor is null or prior.id is null or prior.state<>'PUBLISHED' or
  not private.training_requirement_granted_20fa('AUTHOR',prior.service_id) or
  p_prior not in ('NOT_ACCEPTED','ACCEPT_IF_CURRENT') or p_from is null or
  (p_until is not null and p_until<=p_from) or
  length(trim(coalesce(p_reason,''))) not between 10 and 300 then raise exception 'Revision denied'; end if;
 perform 1 from public.training_requirements_20fa where id=prior.requirement_id for update;
 if exists(select 1 from public.training_requirement_versions_20fa
  where requirement_id=prior.requirement_id and state='DRAFT') then raise exception 'Draft already exists'; end if;
 select course_id into course from public.training_course_versions
  where id=p_course_version and state='PUBLISHED' and retired_at is null;
 if course is null then raise exception 'CourseVersion unavailable'; end if;
 select max(version_number)+1 into n from public.training_requirement_versions_20fa
  where requirement_id=prior.requirement_id;
 insert into public.training_requirement_versions_20fa(requirement_id,version_number,role_id,site_id,service_id,
  course_id,course_version_id,prior_evidence,effective_from,effective_until,created_by)
 values(prior.requirement_id,n,prior.role_id,prior.site_id,prior.service_id,course,p_course_version,
  p_prior,p_from,p_until,actor) returning id into result;
 insert into public.training_requirement_events_20fa(requirement_id,version_id,action,actor_person_id,reason)
 values(prior.requirement_id,result,'DRAFT_CREATED',actor,trim(p_reason));
 return result;
end $$;

create function public.training_requirement_access_20fa() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('superAdmin',private.has_active_role('SUPER_ADMIN'),
  'author',private.training_requirement_granted_20fa('AUTHOR'),
  'publisher',private.training_requirement_granted_20fa('PUBLISHER'),
  'viewer',private.has_active_role('OFFICE_ADMIN') and exists(
    select 1 from public.training_requirement_grants_20fa g
    where g.person_id=private.current_person_id() and g.capability='VIEWER'
      and g.revoked_at is null and g.effective_until>now()),
  'staff',private.has_active_role('SECURITY_STAFF'))
 where private.current_person_id() is not null
$$;
create function public.training_requirement_admin_20fa() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not (private.training_requirement_granted_20fa('AUTHOR') or
  private.training_requirement_granted_20fa('PUBLISHER') or
  exists(select 1 from public.training_requirement_grants_20fa g where g.person_id=private.current_person_id()
   and g.capability='VIEWER' and g.revoked_at is null and g.effective_until>now())
  or private.has_active_role('SUPER_ADMIN'))
 then raise exception 'Requirement administration denied'; end if;
 return jsonb_build_object(
  'requirements',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'label',r.label,
   'versions',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'number',v.version_number,
    'state',v.state,'roleId',v.role_id,'siteId',v.site_id,'serviceId',v.service_id,'courseVersionId',v.course_version_id,
    'priorEvidence',v.prior_evidence,'effectiveFrom',v.effective_from,'effectiveUntil',v.effective_until,
    'hash',v.content_hash,'publishedAt',v.published_at) order by v.version_number),'[]'::jsonb)
    from public.training_requirement_versions_20fa v where v.requirement_id=r.id
      and (private.has_active_role('SUPER_ADMIN') or private.training_requirement_granted_20fa('AUTHOR')
       or private.training_requirement_granted_20fa('PUBLISHER')
       or (v.state='PUBLISHED' and private.training_requirement_granted_20fa('VIEWER',v.service_id)))),
   'events',(select coalesce(jsonb_agg(jsonb_build_object('action',e.action,'versionId',e.version_id,
    'actorPersonId',e.actor_person_id,'reason',e.reason,'occurredAt',e.occurred_at)
    order by e.occurred_at),'[]'::jsonb)
    from public.training_requirement_events_20fa e
    where e.requirement_id=r.id and e.action in ('DRAFT_CREATED','PUBLISHED','ABANDONED')))
    order by r.created_at desc),'[]'::jsonb) from public.training_requirements_20fa r
    where private.has_active_role('SUPER_ADMIN') or private.training_requirement_granted_20fa('AUTHOR')
      or private.training_requirement_granted_20fa('PUBLISHER')
      or exists(select 1 from public.training_requirement_versions_20fa v where v.requirement_id=r.id
       and v.state='PUBLISHED' and private.training_requirement_granted_20fa('VIEWER',v.service_id))),
  'roles',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name) order by display_name),'[]'::jsonb)
   from public.operational_role_definitions where active and code<>'SIA'),
  'courses',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title) order by v.title),'[]'::jsonb)
   from public.training_course_versions v where v.state='PUBLISHED' and v.retired_at is null),
  'sites',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name),'[]'::jsonb)
   from public.sites s where s.status='ACTIVE'),
  'services',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'siteId',s.site_id,'name',s.name) order by s.name),'[]'::jsonb)
   from public.site_services s where s.state='ACTIVE'),
  'grants',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'personId',g.person_id,'capability',g.capability,
   'serviceId',g.service_id,'effectiveUntil',g.effective_until,'revokedAt',g.revoked_at) order by g.granted_at desc),'[]'::jsonb)
   from public.training_requirement_grants_20fa g where private.has_active_role('SUPER_ADMIN'))
 );
end $$;

create function public.training_requirement_matrix_20fa(p_person uuid,p_service uuid,p_role uuid,p_as_of date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); site uuid; row_result jsonb;
begin
 if actor is null or p_person is null or p_service is null or p_role is null or p_as_of is null
 then raise exception 'Matrix context required'; end if;
 select site_id into site from public.site_services where id=p_service;
 if site is null then raise exception 'Service unavailable'; end if;
 if actor=p_person then
  if not private.has_active_role('SECURITY_STAFF') or not exists(
   select 1 from public.site_shift_allocations a
   join public.site_shift_demands d on d.id=a.demand_id
   where a.person_id=actor and a.status in ('ALLOCATED','ACCEPTED')
    and d.state='PLANNED' and d.service_id=p_service and d.role_id=p_role and d.service_date=p_as_of)
  then raise exception 'Self context denied'; end if;
 elsif not private.training_requirement_granted_20fa('VIEWER',p_service) then
  raise exception 'Matrix viewer denied';
 end if;
 if not exists(select 1 from public.site_shift_allocations a
   join public.site_shift_demands d on d.id=a.demand_id
   where a.person_id=p_person and a.status in ('ALLOCATED','ACCEPTED')
    and d.state='PLANNED' and d.service_id=p_service and d.role_id=p_role and d.service_date=p_as_of)
 then raise exception 'Person context denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'requirementId',v.requirement_id,'versionId',v.id,'version',v.version_number,'label',r.label,
  'hash',v.content_hash,'asOf',p_as_of,'roleId',p_role,'siteId',site,'serviceId',p_service,
  'courseVersionId',v.course_version_id,'priorEvidence',v.prior_evidence,
  'status',case when done.id is not null then 'COMPLETED'
    when ass.id is not null then 'ASSIGNED_IN_PROGRESS' else 'NOT_ASSIGNED' end,
  'assignmentId',coalesce(done.assignment_id,ass.id),'completionId',done.id,
  'completionRuleVersionId',done.rule_version_id,'completedAt',done.completed_at,
  'certificateIssueId',cert.id,'certificateReference',cert.reference)
  order by v.version_number desc),'[]'::jsonb) into row_result
 from public.training_requirement_versions_20fa v
 join public.training_requirements_20fa r on r.id=v.requirement_id
 left join lateral (
  select a.id from public.training_assignments a
  where a.person_id=p_person and a.course_version_id=v.course_version_id and a.state='ACTIVE'
  order by a.assigned_at desc limit 1
 ) ass on true
 left join lateral (
  select c.id,c.assignment_id,c.rule_version_id,c.completed_at from public.training_completions c
  where c.person_id=p_person and c.course_version_id=v.course_version_id and c.voided_at is null
   and (v.prior_evidence='ACCEPT_IF_CURRENT' or (c.completed_at at time zone 'Europe/London')::date>=v.effective_from)
   and (c.completed_at at time zone 'Europe/London')::date<=p_as_of
  order by c.completed_at desc limit 1
 ) done on true
 left join lateral (
  select i.id,i.reference from public.training_certificate_issues i
  where i.completion_id=done.id and i.state='ISSUED' and (i.expiry_on is null or i.expiry_on>=p_as_of)
  order by i.issued_at desc limit 1
 ) cert on true
 where v.state='PUBLISHED' and v.role_id=p_role and (v.site_id is null or v.site_id=site)
  and (v.service_id is null or v.service_id=p_service)
  and v.effective_from<=p_as_of and (v.effective_until is null or p_as_of<v.effective_until);
 return jsonb_build_object('personId',p_person,'serviceId',p_service,'roleId',p_role,'asOf',p_as_of,
  'policy','SYNTHETIC_TRAINING_PILOT','rows',row_result);
end $$;
create function public.training_requirement_contexts_20fa() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id();
begin
 if actor is null then raise exception 'Context denied'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'personId',q.person_id,'personName',q.display_name,'serviceId',q.service_id,'serviceName',q.service_name,
  'roleId',q.role_id,'roleName',q.role_name,'asOf',q.service_date) order by q.service_date desc,q.display_name)
 from (
  select distinct a.person_id,p.display_name,d.service_id,s.name as service_name,d.role_id,
   r.display_name as role_name,d.service_date
  from public.site_shift_allocations a
  join public.site_shift_demands d on d.id=a.demand_id
  join public.site_services s on s.id=d.service_id
  join public.operational_role_definitions r on r.id=d.role_id
  join public.people p on p.id=a.person_id
  where a.status in ('ALLOCATED','ACCEPTED') and d.state='PLANNED'
   and d.service_date between (now() at time zone 'Europe/London')::date-interval '30 days'
     and (now() at time zone 'Europe/London')::date+interval '90 days'
   and ((a.person_id=actor and private.has_active_role('SECURITY_STAFF'))
     or private.training_requirement_granted_20fa('VIEWER',d.service_id))
  order by d.service_date desc,p.display_name limit 100
 ) q),'[]'::jsonb);
end $$;

revoke all on function private.training_requirement_granted_20fa(text,uuid) from public,anon,authenticated;
revoke all on function public.training_requirement_grant_20fa(uuid,text,uuid,timestamptz,text),
 public.training_requirement_revoke_grant_20fa(uuid,text),
 public.training_requirement_create_20fa(text,uuid,uuid,uuid,uuid,text,date,date,text),
 public.training_requirement_revise_20fa(uuid,uuid,text,date,date,text),
 public.training_requirement_publish_20fa(uuid,text),
 public.training_requirement_access_20fa(),
 public.training_requirement_admin_20fa(),
 public.training_requirement_contexts_20fa(),
 public.training_requirement_matrix_20fa(uuid,uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.training_requirement_grant_20fa(uuid,text,uuid,timestamptz,text),
 public.training_requirement_revoke_grant_20fa(uuid,text),
 public.training_requirement_create_20fa(text,uuid,uuid,uuid,uuid,text,date,date,text),
 public.training_requirement_revise_20fa(uuid,uuid,text,date,date,text),
 public.training_requirement_publish_20fa(uuid,text),
 public.training_requirement_access_20fa(),
 public.training_requirement_admin_20fa(),
 public.training_requirement_contexts_20fa(),
 public.training_requirement_matrix_20fa(uuid,uuid,uuid,date) to authenticated;
