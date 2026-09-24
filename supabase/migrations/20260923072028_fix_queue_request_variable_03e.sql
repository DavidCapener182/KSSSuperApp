-- TASK-03E forward correction: disambiguate the queue projection local request variable.
create or replace function private.onboarding_case_triage(requested_case uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.onboarding_cases%rowtype; req record; completed integer:=0;
  first_code text; first_actor text; first_action text; done boolean;
  linked_request_id uuid; latest_version uuid; review_decision text; matched_verification boolean;
  submitted_revision public.person_profile_revisions%rowtype;
  profile public.person_profiles%rowtype; sia_submission public.onboarding_sia_submissions%rowtype;
  sia_revision public.person_sia_credential_revisions%rowtype;
  current_sia public.person_sia_credentials%rowtype;
  assigned uuid; accessed boolean; acknowledged boolean;
begin
  select * into c from public.onboarding_cases where id=requested_case;
  if c.id is null then return null; end if;
  if c.state='CANCELLED' then first_code:='CASE_CANCELLED';first_actor:='NONE';first_action:='Cancelled case'; end if;
  if c.state='DRAFT' then first_code:='CASE_START';first_actor:='OFFICE';first_action:='Start onboarding'; end if;
  for req in select cr.id,cr.document_request_id,d.code from public.onboarding_case_requirements cr
    join public.onboarding_requirement_definitions d on d.id=cr.definition_id
    where cr.case_id=c.id order by d.position loop
    done:=false; linked_request_id:=req.document_request_id;
    latest_version:=null;review_decision:=null;matched_verification:=false;
    if req.code='PERSONAL_DETAILS' then
      select * into profile from public.person_profiles p where p.person_id=c.person_id;
      select r.* into submitted_revision from public.person_profile_revisions r
        join public.onboarding_profile_submissions s on s.revision_id=r.id
        where s.requirement_id=req.id order by s.submitted_at desc,s.id desc limit 1;
      done:=submitted_revision.id is not null and private.profile_complete(profile)
        and profile.legal_first_name=submitted_revision.legal_first_name
        and profile.surname=submitted_revision.surname
        and profile.contact_email=submitted_revision.contact_email
        and profile.mobile=submitted_revision.mobile
        and profile.address_line1=submitted_revision.address_line1
        and profile.town_city=submitted_revision.town_city
        and profile.postcode=submitted_revision.postcode;
      if not done and first_code is null then first_code:=req.code;first_actor:='STAFF';first_action:='Submit current personal details';end if;
    elsif req.code='SIA_LICENCE' then
      select * into sia_submission from public.onboarding_sia_submissions s
        where s.requirement_id=req.id order by s.submitted_at desc,s.id desc limit 1;
      linked_request_id:=sia_submission.document_request_id;
      select * into sia_revision from public.person_sia_credential_revisions where id=sia_submission.revision_id;
      select * into current_sia from public.person_sia_credentials where id=sia_revision.credential_id;
      if sia_revision.id is null or current_sia.id is null or current_sia.synthetic_reference is distinct from sia_revision.synthetic_reference
        or current_sia.expires_on is distinct from sia_revision.expires_on
        or sia_revision.expires_on<private.uk_today() then
        if first_code is null then first_code:=req.code;first_actor:='STAFF';first_action:='Submit current synthetic SIA details';end if;
      end if;
    elsif req.code='CONTRACT_TERMS' then
      select a.id into assigned from public.onboarding_controlled_assignments a where a.requirement_id=req.id;
      select exists(select 1 from public.controlled_document_accesses x where x.assignment_id=assigned
        and x.person_id=c.person_id) into accessed;
      select exists(select 1 from public.controlled_acknowledgements x
        where x.assignment_id=assigned and x.actor_person_id=c.person_id) into acknowledged;
      done:=assigned is not null and accessed and acknowledged;
      if not done and first_code is null then
        first_code:=req.code;first_actor:=case when assigned is null then 'OFFICE' else 'STAFF' end;
        first_action:=case when assigned is null then 'Assign synthetic terms' else 'Open and acknowledge terms' end;
      end if;
    elsif req.code='CORE_KSS_INDUCTION' then
      if first_code is null then first_code:=req.code;first_actor:='EXTERNAL_PROVIDER';first_action:='Training provider not connected';end if;
    end if;
    if req.code in ('RIGHT_TO_WORK','SIA_LICENCE','IDENTITY_EVIDENCE') then
      if linked_request_id is not null then
        select v.id,dr.decision into latest_version,review_decision
          from public.documents doc join public.document_versions v on v.document_id=doc.id
          left join public.document_reviews dr on dr.version_id=v.id
          where doc.request_id=linked_request_id and v.upload_state='SUBMITTED'
          order by v.version_number desc limit 1;
      end if;
      select exists(select 1 from public.onboarding_requirement_verifications ov
        where ov.requirement_id=req.id and ov.evidence_version_id=latest_version
          and ov.decision='VERIFIED'
          and (ov.synthetic_valid_until is null or ov.synthetic_valid_until>now())
          and (req.code<>'SIA_LICENCE' or ov.sia_submission_id=sia_submission.id)) into matched_verification;
      if req.code='SIA_LICENCE' and (sia_revision.id is null or current_sia.id is null
        or current_sia.synthetic_reference is distinct from sia_revision.synthetic_reference
        or current_sia.expires_on is distinct from sia_revision.expires_on
        or sia_revision.expires_on<private.uk_today()) then matched_verification:=false; end if;
      done:=latest_version is not null and review_decision='ACCEPTED_AS_EVIDENCE' and matched_verification;
      if not done and first_code is null then
        first_code:=req.code;
        if linked_request_id is null then first_actor:='OFFICE';first_action:='Issue evidence request';
        elsif latest_version is null or review_decision='REJECTED' then first_actor:='STAFF';first_action:='Submit synthetic evidence';
        else first_actor:='OFFICE';first_action:=case when review_decision='ACCEPTED_AS_EVIDENCE'
          then 'Verify exact accepted evidence' else 'Review submitted evidence' end; end if;
      end if;
    end if;
    if done then completed:=completed+1; end if;
  end loop;
  return jsonb_build_object('verifiedCount',completed,'totalCount',6,
    'blocker',coalesce(first_code,'NONE'),'nextActor',coalesce(first_actor,'NONE'),
    'nextAction',coalesce(first_action,'No outstanding action'));
end;$$;
