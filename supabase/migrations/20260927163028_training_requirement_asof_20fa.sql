-- TASK-20F-A: preserve source dates in the factual as-of matrix. No source writes.
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
  and v.effective_from<=p_as_of and (v.effective_until is null or p_as_of<v.effective_until);
 return jsonb_build_object('personId',p_person,'serviceId',p_service,'roleId',p_role,'asOf',p_as_of,
  'policy','SYNTHETIC_TRAINING_PILOT','rows',row_result);
end $$;
