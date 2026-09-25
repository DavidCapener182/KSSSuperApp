-- TASK-20E follow-up: audience-specific exact Completion evidence.
-- Does not modify the applied 20260925000018 completion decision migration.
-- The previously proposed 20260925010000 read projection was not applied.
create function public.training_completion_history(p_assignment uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.training_assignments%rowtype;
 v public.training_course_versions%rowtype; c public.training_completion_cases%rowtype;
 r public.training_completion_rule_versions%rowtype; done public.training_completions%rowtype;
 pages integer; marks integer; result jsonb; manager_view boolean:=false;
begin
 select * into a from public.training_assignments where id=p_assignment;
 if actor is null or a.id is null then raise exception 'Completion history unavailable'; end if;
 if a.person_id<>actor then
  if not private.training_completion_manager() then raise exception 'Completion history unavailable'; end if;
  manager_view:=true;
 end if;
 select * into v from public.training_course_versions where id=a.course_version_id;
 select * into c from public.training_completion_cases where assignment_id=a.id;
 if c.id is not null then
  select * into r from public.training_completion_rule_versions where id=c.rule_version_id;
  select * into done from public.training_completions where case_id=c.id;
 else
  select * into r from public.training_completion_rule_versions x where x.course_version_id=a.course_version_id
   and x.effective_from<=now() and (x.effective_until is null or x.effective_until>now())
   order by x.version_number desc limit 1;
 end if;
 select coalesce(sum(jsonb_array_length(m.value->'pages')),0)::integer into pages from jsonb_array_elements(v.content) m;
 select count(*)::integer into marks from public.training_page_marks p where p.assignment_id=a.id and p.course_version_id=v.id;
 result:=jsonb_build_object(
  'assignment',jsonb_build_object('id',a.id,'personId',a.person_id,'state',a.state,
    'courseVersionId',v.id,'courseVersion',v.version_number,'courseTitle',v.title,
    'contentHash',v.content_hash,'retiredAt',v.retired_at,'pageCount',pages,'viewedCount',marks),
  'rule',case when r.id is null then null else jsonb_build_object('id',r.id,'version',r.version_number,
    'pinned',c.id is not null,'courseVersionId',r.course_version_id,'hash',r.rule_hash,
    'allPagesRequired',r.all_pages_required,'requiredAssessmentVersionIds',r.required_assessment_version_ids,
    'passEvidenceRule',r.pass_evidence_rule,'effectiveFrom',r.effective_from,
    'effectiveUntil',r.effective_until,'validityMonths',r.validity_months) end,
  'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'assessmentVersionId',t.assessment_version_id,
    'state',t.state,'result',t.result,'submittedAt',t.submitted_at) order by t.started_at,t.id)
    from public.training_attempts t where t.assignment_id=a.id and t.person_id=a.person_id and t.course_version_id=v.id),'[]'::jsonb),
  'completion',case when done.id is null then null else jsonb_build_object('id',done.id,
    'ruleVersionId',done.rule_version_id,'ruleHash',done.rule_hash,'passedAttemptIds',done.passed_attempt_ids,
    'pageMarkCount',done.page_mark_count,'pageCount',done.page_count,
    'completedAt',done.completed_at,'voidedAt',done.voided_at) ||
    case when manager_view then jsonb_build_object('evaluatedBy',done.evaluated_by,
      'voidedBy',done.voided_by,'voidReason',done.void_reason) else '{}'::jsonb end end,
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,
    'completionId',e.completion_id,'occurredAt',e.occurred_at) ||
    case when manager_view then jsonb_build_object('actorPersonId',e.actor_person_id,
      'reason',e.reason) else '{}'::jsonb end order by e.occurred_at,e.id)
    from public.training_completion_events e where e.case_id=c.id),'[]'::jsonb));
 return result;
end $$;
revoke all on function public.training_completion_history(uuid) from public,anon,authenticated;
grant execute on function public.training_completion_history(uuid) to authenticated;

create or replace function public.training_completion_grants_read() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if private.current_person_id() is null or not private.has_active_role('SUPER_ADMIN') then raise exception 'Oversight denied'; end if;
 select jsonb_build_object('grants',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'personId',g.person_id,
  'personName',p.display_name,'grantedBy',g.granted_by,'grantedAt',g.granted_at,
  'revokedBy',g.revoked_by,'revokedAt',g.revoked_at,'reason',g.grant_reason,'revokeReason',g.revoke_reason,
  'events',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'actorPersonId',e.actor_person_id,
    'reason',e.reason,'occurredAt',e.occurred_at) order by e.occurred_at,e.id)
    from public.training_completion_manager_events e where e.grant_id=g.id),'[]'::jsonb)) order by g.granted_at desc)
  from public.training_completion_manager_grants g join public.people p on p.id=g.person_id),'[]'::jsonb),
  'candidates',coalesce((select jsonb_agg(jsonb_build_object('personId',p.id,'personName',p.display_name) order by p.display_name)
  from public.people p where private.has_active_role_for_person(p.id,'OFFICE_ADMIN') and
  not exists(select 1 from public.training_completion_manager_grants g where g.person_id=p.id and g.revoked_at is null)),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.training_completion_grants_read() from public,anon,authenticated;
grant execute on function public.training_completion_grants_read() to authenticated;
