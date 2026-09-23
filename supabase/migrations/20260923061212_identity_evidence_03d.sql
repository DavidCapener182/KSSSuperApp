-- TASK-03D: one V2 case-specific Identity Evidence request and exact-version verification.
-- Published template definitions and the personnel Document service remain unchanged.
create or replace function private.guard_onboarding_requirement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.onboarding_cases%rowtype; d public.onboarding_requirement_definitions%rowtype;
  req public.document_requests%rowtype; tv public.onboarding_template_versions%rowtype;
begin
  if tg_op = 'DELETE' then raise exception 'Onboarding requirement history cannot be deleted'; end if;
  if tg_op = 'INSERT' then
    select * into c from public.onboarding_cases where id = new.case_id;
    select * into d from public.onboarding_requirement_definitions where id = new.definition_id;
    if c.id is null or d.id is null or d.template_version_id <> c.template_version_id
      or new.document_request_id is not null then raise exception 'Onboarding definition mismatch'; end if;
    return new;
  end if;
  if new.id <> old.id or new.case_id <> old.case_id or new.definition_id <> old.definition_id
    or new.created_at <> old.created_at or old.document_request_id is not null
    or new.document_request_id is null then raise exception 'Onboarding requirement is immutable'; end if;
  select * into c from public.onboarding_cases where id = old.case_id;
  select * into d from public.onboarding_requirement_definitions where id = old.definition_id;
  select * into req from public.document_requests where id = new.document_request_id;
  if c.state <> 'IN_PROGRESS' or req.id is null
    or req.target_person_id <> c.person_id or req.requester_person_id <> c.owner_person_id
    or req.site_id is distinct from c.site_id then raise exception 'Onboarding evidence link denied'; end if;
  if d.code = 'RIGHT_TO_WORK' then return new; end if;
  select * into tv from public.onboarding_template_versions where id=c.template_version_id;
  if d.code <> 'IDENTITY_EVIDENCE' or d.template_version_id <> c.template_version_id
    or tv.version_number <> 2 or d.fulfilment_kind <> 'NOT_CONFIGURED'
    or d.provider_state <> 'NOT_CONFIGURED'
    or req.title <> 'Synthetic onboarding Identity Evidence'
    or req.created_at < c.started_at
  then raise exception 'Identity Evidence activation denied'; end if;
  return new;
end;
$$;

create or replace function private.guard_onboarding_verification() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; v public.document_versions%rowtype;
  doc public.documents%rowtype; rev public.document_reviews%rowtype;
  dr public.document_requests%rowtype; tv public.onboarding_template_versions%rowtype;
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
  elsif d.code='IDENTITY_EVIDENCE' then
    select * into tv from public.onboarding_template_versions where id=c.template_version_id;
    select * into dr from public.document_requests where id=cr.document_request_id;
    if tv.version_number<>2 or d.template_version_id<>c.template_version_id
      or d.fulfilment_kind<>'NOT_CONFIGURED' or d.provider_state<>'NOT_CONFIGURED'
      or new.sia_submission_id is not null or new.synthetic_valid_until is not null
      or dr.id is null or dr.title<>'Synthetic onboarding Identity Evidence'
      or dr.target_person_id<>c.person_id or dr.requester_person_id<>c.owner_person_id
      or dr.site_id is distinct from c.site_id or dr.created_at<c.started_at
      or doc.request_id<>dr.id or rev.request_id<>dr.id
    then raise exception 'Identity verification source denied'; end if;
  else raise exception 'Unsupported requirement verification'; end if;
  return new;
end;
$$;

create function public.issue_onboarding_identity_request(requested_case uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; tv public.onboarding_template_versions%rowtype;
  existing public.document_requests%rowtype; created_id uuid;
begin
  actor := private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or c.state<>'IN_PROGRESS' or actor is null or actor=c.person_id
    or c.owner_person_id<>actor or not private.has_active_role('OFFICE_ADMIN')
  then raise exception 'Identity request denied'; end if;
  select r.* into cr from public.onboarding_case_requirements r
    join public.onboarding_requirement_definitions def on def.id=r.definition_id
    where r.case_id=c.id and def.code='IDENTITY_EVIDENCE' for update of r;
  select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
  select * into tv from public.onboarding_template_versions where id=c.template_version_id;
  if cr.id is null or tv.version_number<>2 or d.template_version_id<>c.template_version_id
    or d.fulfilment_kind<>'NOT_CONFIGURED' or d.provider_state<>'NOT_CONFIGURED'
  then raise exception 'Identity requirement unavailable'; end if;
  if cr.document_request_id is not null then
    select * into existing from public.document_requests where id=cr.document_request_id;
    if existing.id is null or existing.title<>'Synthetic onboarding Identity Evidence'
      or existing.target_person_id<>c.person_id or existing.requester_person_id<>c.owner_person_id
      or existing.site_id is distinct from c.site_id then raise exception 'Identity request mismatch'; end if;
    return existing.id;
  end if;
  created_id := public.create_document_request(c.person_id,c.site_id,'Synthetic onboarding Identity Evidence');
  update public.onboarding_case_requirements set document_request_id=created_id where id=cr.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'onboarding_requirement',cr.id,'UPDATE',
      jsonb_build_object('document_request_id',created_id,'kind','IDENTITY_EVIDENCE','case_id',c.id));
  return created_id;
end;
$$;

create function public.verify_onboarding_identity(requested_case uuid,requested_requirement uuid,
  accepted_version uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; tv public.onboarding_template_versions%rowtype;
  dr public.document_requests%rowtype; doc public.documents%rowtype;
  v public.document_versions%rowtype; rev public.document_reviews%rowtype;
  existing uuid; created_id uuid;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or c.state<>'IN_PROGRESS' or actor is null or actor=c.person_id
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id=actor))
  then raise exception 'Identity verification denied'; end if;
  select * into cr from public.onboarding_case_requirements
    where id=requested_requirement and case_id=c.id for update;
  select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
  select * into tv from public.onboarding_template_versions where id=c.template_version_id;
  select * into dr from public.document_requests where id=cr.document_request_id;
  select * into doc from public.documents where request_id=dr.id and classification='PERSONNEL_PRIVATE';
  select * into v from public.document_versions where id=accepted_version and document_id=doc.id;
  select * into rev from public.document_reviews where version_id=v.id and request_id=dr.id;
  if cr.id is null or d.code<>'IDENTITY_EVIDENCE' or d.template_version_id<>c.template_version_id
    or tv.version_number<>2 or d.fulfilment_kind<>'NOT_CONFIGURED' or d.provider_state<>'NOT_CONFIGURED'
    or dr.id is null or dr.title<>'Synthetic onboarding Identity Evidence'
    or dr.target_person_id<>c.person_id or dr.requester_person_id<>c.owner_person_id
    or dr.site_id is distinct from c.site_id or dr.created_at<c.started_at or doc.id is null
    or v.id is null or v.upload_state<>'SUBMITTED' or rev.id is null
    or rev.decision<>'ACCEPTED_AS_EVIDENCE'
    or exists(select 1 from public.document_versions later where later.document_id=doc.id
      and later.upload_state='SUBMITTED' and later.version_number>v.version_number)
  then raise exception 'Identity verification source denied'; end if;
  select id into existing from public.onboarding_requirement_verifications
    where requirement_id=cr.id and evidence_version_id=v.id;
  if existing is not null then return existing; end if;
  insert into public.onboarding_requirement_verifications(case_id,requirement_id,target_person_id,
    verifier_person_id,evidence_version_id,decision)
    values(c.id,cr.id,c.person_id,actor,v.id,'VERIFIED') returning id into created_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'onboarding_verification',created_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',cr.id,'document_request_id',dr.id,
        'version_id',v.id,'synthetic',true,'super_override',private.has_active_role('SUPER_ADMIN') and actor<>c.owner_person_id));
  return created_id;
end;
$$;
revoke all on function public.issue_onboarding_identity_request(uuid),
  public.verify_onboarding_identity(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.issue_onboarding_identity_request(uuid),
  public.verify_onboarding_identity(uuid,uuid,uuid) to authenticated;
