-- TASK-03B review fix: a reverted edit cannot revive a stale credential submission.
create or replace function private.guard_onboarding_verification() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; v public.document_versions%rowtype;
  doc public.documents%rowtype; rev public.document_reviews%rowtype;
  s public.onboarding_sia_submissions%rowtype; sr public.person_sia_credential_revisions%rowtype;
  current_credential public.person_sia_credentials%rowtype;
begin
  if tg_op<>'INSERT' then raise exception 'Onboarding verification is immutable'; end if;
  select * into c from public.onboarding_cases where id=new.case_id;
  select * into cr from public.onboarding_case_requirements where id=new.requirement_id;
  select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
  select * into v from public.document_versions where id=new.evidence_version_id;
  select * into doc from public.documents where id=v.document_id;
  select * into rev from public.document_reviews where version_id=v.id;
  if c.id is null or c.state<>'IN_PROGRESS' or cr.case_id<>c.id
    or new.target_person_id<>c.person_id or new.verifier_person_id=c.person_id
    or new.verifier_person_id is distinct from private.current_person_id()
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id=new.verifier_person_id))
    or v.id is null or v.upload_state<>'SUBMITTED' or doc.classification<>'PERSONNEL_PRIVATE'
    or rev.decision<>'ACCEPTED_AS_EVIDENCE' or new.decision<>'VERIFIED'
    or exists(select 1 from public.document_versions later where later.document_id=v.document_id
      and later.upload_state='SUBMITTED' and later.version_number>v.version_number)
  then raise exception 'Onboarding verification source denied'; end if;
  if d.code='RIGHT_TO_WORK' then
    if new.sia_submission_id is not null or doc.request_id<>cr.document_request_id
      or (new.synthetic_valid_until is not null and new.synthetic_valid_until<=now())
    then raise exception 'RTW verification source denied'; end if;
  elsif d.code='SIA_LICENCE' then
    select * into s from public.onboarding_sia_submissions where id=new.sia_submission_id;
    select * into sr from public.person_sia_credential_revisions where id=s.revision_id;
    select * into current_credential from public.person_sia_credentials where id=sr.credential_id;
    if new.synthetic_valid_until is not null or s.id is null or s.case_id<>c.id or s.requirement_id<>cr.id
      or s.person_id<>c.person_id or s.document_request_id<>doc.request_id
      or sr.person_id<>c.person_id or sr.category<>d.expected_sia_category
      or current_credential.person_id<>c.person_id or current_credential.category<>sr.category
      or current_credential.credential_change_seq<>sr.credential_change_seq
      or current_credential.synthetic_reference is distinct from sr.synthetic_reference
      or current_credential.expires_on is distinct from sr.expires_on
      or sr.expires_on<private.uk_today()
      or exists(select 1 from public.onboarding_sia_submissions newer where newer.requirement_id=cr.id
        and (newer.submitted_at,newer.id)>(s.submitted_at,s.id))
    then raise exception 'SIA verification source denied'; end if;
  else raise exception 'Unsupported requirement verification'; end if;
  return new;
end;
$$;

create or replace function public.verify_onboarding_sia(requested_case uuid,requested_requirement uuid,
  requested_submission uuid,accepted_version uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; s public.onboarding_sia_submissions%rowtype;
  sr public.person_sia_credential_revisions%rowtype; current_credential public.person_sia_credentials%rowtype;
  dr public.document_requests%rowtype; doc public.documents%rowtype;
  v public.document_versions%rowtype; rev public.document_reviews%rowtype;
  existing uuid; created_id uuid;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or c.state<>'IN_PROGRESS' or actor is null or actor=c.person_id
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id=actor))
  then raise exception 'SIA verification denied'; end if;
  select * into cr from public.onboarding_case_requirements
    where id=requested_requirement and case_id=c.id for update;
  select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
  select * into s from public.onboarding_sia_submissions
    where id=requested_submission and requirement_id=cr.id;
  select * into sr from public.person_sia_credential_revisions where id=s.revision_id;
  select * into current_credential from public.person_sia_credentials where id=sr.credential_id;
  select * into dr from public.document_requests where id=s.document_request_id;
  select * into doc from public.documents where request_id=dr.id and classification='PERSONNEL_PRIVATE';
  select * into v from public.document_versions where id=accepted_version and document_id=doc.id;
  select * into rev from public.document_reviews where version_id=v.id and request_id=dr.id;
  if cr.id is null or d.code<>'SIA_LICENCE' or d.provider_state<>'AVAILABLE'
    or s.id is null or s.case_id<>c.id or s.person_id<>c.person_id
    or sr.id is null or sr.person_id<>c.person_id or sr.category<>d.expected_sia_category
    or current_credential.id is null or current_credential.person_id<>c.person_id
    or current_credential.credential_change_seq<>sr.credential_change_seq
    or current_credential.synthetic_reference is distinct from sr.synthetic_reference
    or current_credential.expires_on is distinct from sr.expires_on
    or sr.expires_on<private.uk_today() or dr.id is null
    or dr.target_person_id<>c.person_id or dr.requester_person_id<>c.owner_person_id
    or dr.site_id is distinct from c.site_id or doc.id is null
    or v.id is null or v.upload_state<>'SUBMITTED' or rev.decision<>'ACCEPTED_AS_EVIDENCE'
    or exists(select 1 from public.onboarding_sia_submissions newer where newer.requirement_id=cr.id
      and (newer.submitted_at,newer.id)>(s.submitted_at,s.id))
    or exists(select 1 from public.document_versions later where later.document_id=doc.id
      and later.upload_state='SUBMITTED' and later.version_number>v.version_number)
  then raise exception 'SIA verification source denied'; end if;
  select id into existing from public.onboarding_requirement_verifications
    where requirement_id=cr.id and sia_submission_id=s.id;
  if existing is not null then return existing; end if;
  insert into public.onboarding_requirement_verifications(case_id,requirement_id,target_person_id,
    verifier_person_id,evidence_version_id,decision,sia_submission_id)
    values(c.id,cr.id,c.person_id,actor,v.id,'VERIFIED',s.id) returning id into created_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'onboarding_verification',created_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',cr.id,'sia_submission_id',s.id,
        'credential_revision_id',sr.id,'document_request_id',dr.id,'version_id',v.id,
        'synthetic',true,'super_override',private.has_active_role('SUPER_ADMIN') and actor<>c.owner_person_id));
  return created_id;
end;
$$;
