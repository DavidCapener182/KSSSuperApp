-- TASK-20F-A: reasoned effective end enables a later immutable version without rewriting published bytes.
create table public.training_requirement_ends_20fa (
 version_id uuid primary key references public.training_requirement_versions_20fa(id),
 end_on date not null,
 actor_person_id uuid not null references public.people(id),
 reason text not null check(length(trim(reason)) between 10 and 300),
 occurred_at timestamptz not null default now()
);
alter table public.training_requirement_ends_20fa enable row level security;
revoke all on public.training_requirement_ends_20fa from public,anon,authenticated;
create trigger training_requirement_end_seal_20fa before update or delete on public.training_requirement_ends_20fa
 for each row execute function private.training_requirement_seal_20fa();
alter table public.training_requirement_events_20fa drop constraint training_requirement_events_20fa_action_check;
alter table public.training_requirement_events_20fa add constraint training_requirement_events_20fa_action_check
 check(action in ('DRAFT_CREATED','PUBLISHED','ABANDONED','ENDED','GRANT','REVOKE'));
create function public.training_requirement_end_20fa(p_version uuid,p_end_on date,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); v public.training_requirement_versions_20fa%rowtype;
begin
 select * into v from public.training_requirement_versions_20fa where id=p_version for update;
 if actor is null or v.id is null or v.state<>'PUBLISHED' or
  not private.training_requirement_granted_20fa('PUBLISHER',v.service_id) or
  p_end_on is null or p_end_on<=v.effective_from or
  p_end_on<(now() at time zone 'Europe/London')::date or
  (v.effective_until is not null and p_end_on>=v.effective_until) or
  length(trim(coalesce(p_reason,''))) not between 10 and 300
 then raise exception 'Requirement end denied'; end if;
 perform 1 from public.training_requirements_20fa where id=v.requirement_id for update;
 if exists(select 1 from public.training_requirement_ends_20fa where version_id=v.id)
 then raise exception 'Requirement already ended'; end if;
 insert into public.training_requirement_ends_20fa(version_id,end_on,actor_person_id,reason)
 values(v.id,p_end_on,actor,trim(p_reason));
 insert into public.training_requirement_events_20fa(requirement_id,version_id,action,actor_person_id,reason)
 values(v.requirement_id,v.id,'ENDED',actor,trim(p_reason));
end $$;
revoke all on function public.training_requirement_end_20fa(uuid,date,text) from public,anon,authenticated;
grant execute on function public.training_requirement_end_20fa(uuid,date,text) to authenticated;

create or replace function public.training_requirement_publish_20fa(p_version uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); v public.training_requirement_versions_20fa%rowtype; h text;
begin
 if actor is null or length(trim(coalesce(p_reason,''))) not between 10 and 300 then raise exception 'Publish denied'; end if;
 select * into v from public.training_requirement_versions_20fa where id=p_version for update;
 if v.id is null or v.state<>'DRAFT' or not private.training_requirement_granted_20fa('PUBLISHER',v.service_id)
 then raise exception 'Publish denied'; end if;
 perform 1 from public.training_requirements_20fa where id=v.requirement_id for update;
 if exists(select 1 from public.training_requirement_versions_20fa x where x.requirement_id=v.requirement_id
  and x.state='PUBLISHED' and daterange(x.effective_from,coalesce((select e.end_on from public.training_requirement_ends_20fa e where e.version_id=x.id),x.effective_until),'[)') &&
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

create or replace function public.training_requirement_admin_20fa() returns jsonb
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
    'endedOn',(select e.end_on from public.training_requirement_ends_20fa e where e.version_id=v.id),
    'hash',v.content_hash,'publishedAt',v.published_at) order by v.version_number),'[]'::jsonb)
    from public.training_requirement_versions_20fa v where v.requirement_id=r.id
      and (private.has_active_role('SUPER_ADMIN') or private.training_requirement_granted_20fa('AUTHOR')
       or private.training_requirement_granted_20fa('PUBLISHER')
       or (v.state='PUBLISHED' and private.training_requirement_granted_20fa('VIEWER',v.service_id)))),
   'events',(select coalesce(jsonb_agg(jsonb_build_object('action',e.action,'versionId',e.version_id,
    'actorPersonId',e.actor_person_id,'reason',e.reason,'occurredAt',e.occurred_at)
    order by e.occurred_at),'[]'::jsonb)
    from public.training_requirement_events_20fa e
    where e.requirement_id=r.id and e.action in ('DRAFT_CREATED','PUBLISHED','ABANDONED','ENDED')))
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

create or replace function public.training_requirement_matrix_20fa(p_person uuid,p_service uuid,p_role uuid,p_as_of date)
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
  where a.person_id=p_person and a.course_version_id=v.course_version_id
   and (a.assigned_at at time zone 'Europe/London')::date<=p_as_of
   and (a.ended_at is null or (a.ended_at at time zone 'Europe/London')::date>p_as_of)
  order by a.assigned_at desc limit 1
 ) ass on true
 left join lateral (
  select c.id,c.assignment_id,c.rule_version_id,c.completed_at from public.training_completions c
  where c.person_id=p_person and c.course_version_id=v.course_version_id
   and (c.voided_at is null or (c.voided_at at time zone 'Europe/London')::date>p_as_of)
   and (v.prior_evidence='ACCEPT_IF_CURRENT' or (c.completed_at at time zone 'Europe/London')::date>=v.effective_from)
   and (c.completed_at at time zone 'Europe/London')::date<=p_as_of
  order by c.completed_at desc limit 1
 ) done on true
 left join lateral (
  select i.id,i.reference from public.training_certificate_issues i
  where i.completion_id=done.id and i.state in ('ISSUED','REVOKED')
   and (i.issued_at at time zone 'Europe/London')::date<=p_as_of
   and (i.revoked_at is null or (i.revoked_at at time zone 'Europe/London')::date>p_as_of)
   and (i.expiry_on is null or i.expiry_on>=p_as_of)
  order by i.issued_at desc limit 1
 ) cert on true
 where v.state='PUBLISHED' and v.role_id=p_role and (v.site_id is null or v.site_id=site)
  and (v.service_id is null or v.service_id=p_service)
  and v.effective_from<=p_as_of and (coalesce((select e.end_on from public.training_requirement_ends_20fa e where e.version_id=v.id),v.effective_until) is null
   or p_as_of<coalesce((select e.end_on from public.training_requirement_ends_20fa e where e.version_id=v.id),v.effective_until));
 return jsonb_build_object('personId',p_person,'serviceId',p_service,'roleId',p_role,'asOf',p_as_of,
  'policy','SYNTHETIC_TRAINING_PILOT','rows',row_result);
end $$;
