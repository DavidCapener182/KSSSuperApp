-- Super Admin reads exact Person credential detail through an attributable oversight RPC.
drop policy credential_claims_read_16b on public.credential_claims_16b;
create policy credential_claims_read_16b on public.credential_claims_16b for select to authenticated using
 ((person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
   or private.credential_reviewer_16b(person_id,type_code));
drop policy credential_revisions_read_16b on public.credential_revisions_16b;
create policy credential_revisions_read_16b on public.credential_revisions_16b for select to authenticated using
 ((person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
   or private.credential_reviewer_16b(person_id,type_code));

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
 'role_assignment','site_assignment','site','document_request','document_version',
 'document_review','task','onboarding_case','onboarding_requirement','onboarding_verification',
 'person_profile','profile_submission','sia_credential','sia_submission','controlled_publisher_grant',
 'controlled_document','controlled_version','controlled_publication','controlled_assignment','controlled_access',
 'controlled_acknowledgement','onboarding_team','onboarding_team_membership','onboarding_cover','onboarding_owner_change',
 'task_assignment','crm_organisation','crm_contact','crm_opportunity','crm_opportunity_event',
 'crm_relationship_event','crm_organisation_owner_event','crm_activity','crm_follow_up','crm_task_event',
 'site_client_link','operational_event','operational_event_event','operational_role','event_staffing_requirement',
 'event_staff_allocation','event_staff_allocation_event','credential_claim','credential_revision','credential_decision',
 'credential_reviewer_grant','credential_oversight'));

create function public.read_credential_oversight_16b(subject uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null or not private.has_active_role('SUPER_ADMIN') or subject is null
   or not exists(select 1 from public.people where id=subject)
 then raise exception 'Credential oversight denied'; end if;
 select jsonb_build_object(
   'claims',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb)
     from public.credential_claims_16b c where c.person_id=subject),
   'revisions',(select coalesce(jsonb_agg(to_jsonb(r) order by r.submitted_at desc),'[]'::jsonb)
     from public.credential_revisions_16b r where r.person_id=subject),
   'decisions',(select coalesce(jsonb_agg(to_jsonb(d) order by d.decided_at desc),'[]'::jsonb)
     from public.credential_decisions_16b d join public.credential_claims_16b c on c.id=d.claim_id
     where c.person_id=subject),
   'grants',(select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb)
     from public.credential_reviewer_grants_16b g where g.subject_person_id=subject)) into result;
 insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
 values(actor,subject,'credential_oversight',subject,'INSERT',jsonb_build_object('scope','EXACT_PERSON_READ'));
 return result;
end $$;
revoke all on function public.read_credential_oversight_16b(uuid) from public,anon,authenticated;
grant execute on function public.read_credential_oversight_16b(uuid) to authenticated;
