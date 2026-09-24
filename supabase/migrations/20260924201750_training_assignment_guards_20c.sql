-- TASK-20C forward guard: preserve append-only evidence and immutable assignment identity.
create function private.training_no_evidence_mutation() returns trigger language plpgsql set search_path='' as $$
begin
 raise exception 'Training evidence is append-only';
end $$;
create trigger training_grant_events_seal before update or delete on public.training_assigner_grant_events for each row execute function private.training_no_evidence_mutation();
create trigger training_assignment_events_seal before update or delete on public.training_assignment_events for each row execute function private.training_no_evidence_mutation();
create trigger training_learning_events_seal before update or delete on public.training_learning_events for each row execute function private.training_no_evidence_mutation();
create trigger training_page_marks_seal before update or delete on public.training_page_marks for each row execute function private.training_no_evidence_mutation();
create function private.training_assignment_identity_seal() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or new.id<>old.id or new.person_id<>old.person_id or new.course_id<>old.course_id or
 new.course_version_id<>old.course_version_id or new.assigned_by<>old.assigned_by or new.assigned_at<>old.assigned_at or
 new.assignment_reason<>old.assignment_reason or new.replaces_assignment_id is distinct from old.replaces_assignment_id or
 (old.state<>'ACTIVE' and new is distinct from old) then raise exception 'Assignment identity and history immutable'; end if;
 return new;
end $$;
create trigger training_assignment_identity_seal before update or delete on public.training_assignments for each row execute function private.training_assignment_identity_seal();
create function private.training_assigner_grant_seal() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(new)-'revoked_by'-'revoked_at'-'revoke_reason') is distinct from
 (to_jsonb(old)-'revoked_by'-'revoked_at'-'revoke_reason') or old.revoked_at is not null or
 new.revoked_at is null or new.revoked_by is null or length(trim(new.revoke_reason)) not between 10 and 300
 then raise exception 'Assigner grant history immutable'; end if;
 return new;
end $$;
create trigger training_assigner_grant_seal before update or delete on public.training_assigner_grants for each row execute function private.training_assigner_grant_seal();
revoke all on function private.training_no_evidence_mutation(),private.training_assignment_identity_seal(),private.training_assigner_grant_seal() from public,anon,authenticated;

alter table public.training_assignments alter constraint training_assignments_replaced_by_assignment_id_fkey deferrable initially deferred;

create or replace function public.training_supersede_assignment(p_assignment uuid,p_revision integer,p_version uuid,p_due date,p_reason text,p_request uuid) returns uuid
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
 result:=gen_random_uuid();
 update public.training_assignments set state='SUPERSEDED',revision=revision+1,ended_by=actor,ended_at=now(),end_reason=trim(p_reason),replaced_by_assignment_id=result where id=p_assignment;
 insert into public.training_assignments(id,person_id,course_id,course_version_id,assigned_by,due_on,assignment_reason,replaces_assignment_id)
 values(result,prior.person_id,course,p_version,actor,p_due,trim(p_reason),p_assignment);
 insert into public.training_assignment_events(assignment_id,actor_person_id,action,details)
 values(p_assignment,actor,'SUPERSEDED',jsonb_build_object('newAssignmentId',result,'newVersionId',p_version,'reason',trim(p_reason)));
 insert into public.training_assignment_events(assignment_id,actor_person_id,action,details)
 values(result,actor,'ASSIGNED',jsonb_build_object('replacesAssignmentId',p_assignment,'courseVersionId',p_version,'dueOn',p_due,'reason',trim(p_reason)));
 update public.training_assignment_requests set result_id=result where actor_person_id=actor and request_key=p_request;
 return result;
end $$;

create function public.training_assigner_candidates() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_active_role('SUPER_ADMIN') then raise exception 'Candidate list denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('personId',p.id,'displayName',p.display_name) order by p.display_name),'[]'::jsonb)
 into result from public.people p where exists(select 1 from public.role_assignments r where r.person_id=p.id
 and r.role_code='OFFICE_ADMIN' and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))
 and exists(select 1 from public.auth_identities i where i.person_id=p.id and i.active);
 return result;
end $$;
revoke all on function public.training_assigner_candidates() from public,anon,authenticated;
grant execute on function public.training_assigner_candidates() to authenticated;

create or replace function public.training_assignment_history(p_assignment uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; a public.training_assignments%rowtype;
begin
 select * into a from public.training_assignments where id=p_assignment;
 if a.id is null or (not private.training_assigner() and not private.has_active_role('SUPER_ADMIN') and
 not (private.has_active_role('SECURITY_STAFF') and a.person_id=private.current_person_id()))
 then raise exception 'History denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'actorPersonId',e.actor_person_id,
 'details',e.details,'occurredAt',e.occurred_at) order by e.occurred_at,e.id),'[]'::jsonb) into result from (
 select id,action,actor_person_id,details,occurred_at from public.training_assignment_events
 where assignment_id=p_assignment
 union all
 select id,'COURSE_PUBLISHED'::text,actor_person_id,
 jsonb_build_object('versionId',version_id,'note','Publication did not change this assignment'),occurred_at
 from public.training_course_events where course_id=a.course_id and action='PUBLISH' and occurred_at>a.assigned_at
 ) e;
 return result;
end $$;
