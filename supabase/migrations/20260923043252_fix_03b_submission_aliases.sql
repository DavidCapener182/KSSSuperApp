-- Fix PL/pgSQL record/table alias ambiguity in 03B submission functions.
create or replace function public.submit_onboarding_profile(requested_case uuid,supplied_request_key uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  p public.person_profiles%rowtype; prior public.person_profile_revisions%rowtype;
  existing uuid; revision_id uuid; submission_id uuid; changed text[];
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if actor is null or supplied_request_key is null or c.id is null or c.state<>'IN_PROGRESS'
    or c.person_id<>actor or not private.has_active_role('SECURITY_STAFF')
  then raise exception 'Profile submission denied'; end if;
  select req.* into cr from public.onboarding_case_requirements req
    join public.onboarding_requirement_definitions d on d.id=req.definition_id
    where req.case_id=c.id and d.code='PERSONAL_DETAILS' and d.provider_state='AVAILABLE';
  if cr.id is null then raise exception 'Profile requirement unavailable'; end if;
  select id into existing from public.onboarding_profile_submissions
    where requirement_id=cr.id and request_key=supplied_request_key;
  if existing is not null then return existing; end if;
  select * into p from public.person_profiles where person_id=actor for update;
  if p.person_id is null or not private.profile_complete(p) then raise exception 'Required Personal Details missing'; end if;
  select r.* into prior from public.person_profile_revisions r
    join public.onboarding_profile_submissions s on s.revision_id=r.id
    where s.requirement_id=cr.id order by s.submitted_at desc,s.id desc limit 1;
  changed:=array_remove(array[
    case when prior.legal_first_name is distinct from p.legal_first_name then 'legal_first_name' end,
    case when prior.surname is distinct from p.surname then 'surname' end,
    case when prior.preferred_name is distinct from p.preferred_name then 'preferred_name' end,
    case when prior.contact_email is distinct from p.contact_email then 'contact_email' end,
    case when prior.mobile is distinct from p.mobile then 'mobile' end,
    case when prior.address_line1 is distinct from p.address_line1 then 'address_line1' end,
    case when prior.address_line2 is distinct from p.address_line2 then 'address_line2' end,
    case when prior.town_city is distinct from p.town_city then 'town_city' end,
    case when prior.postcode is distinct from p.postcode then 'postcode' end],null);
  insert into public.person_profile_revisions(person_id,submitted_by_person_id,legal_first_name,surname,
    preferred_name,contact_email,mobile,address_line1,address_line2,town_city,postcode,changed_fields)
    values(actor,actor,p.legal_first_name,p.surname,p.preferred_name,p.contact_email,p.mobile,
      p.address_line1,p.address_line2,p.town_city,p.postcode,changed) returning id into revision_id;
  insert into public.onboarding_profile_submissions(case_id,requirement_id,person_id,revision_id,request_key)
    values(c.id,cr.id,actor,revision_id,supplied_request_key) returning id into submission_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,actor,'profile_submission',submission_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',cr.id,'revision_id',revision_id,'changed_fields',changed));
  return submission_id;
end;
$$;

create or replace function public.submit_onboarding_sia(requested_case uuid,supplied_request_key uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  expected text; current_row public.person_sia_credentials%rowtype; existing uuid;
  revision_id uuid; submission_id uuid;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if actor is null or supplied_request_key is null or c.id is null or c.state<>'IN_PROGRESS'
    or c.person_id<>actor or not private.has_active_role('SECURITY_STAFF')
  then raise exception 'SIA submission denied'; end if;
  select req.* into cr from public.onboarding_case_requirements req
    join public.onboarding_requirement_definitions d on d.id=req.definition_id
    where req.case_id=c.id and d.code='SIA_LICENCE' and d.provider_state='AVAILABLE';
  select expected_sia_category into expected from public.onboarding_requirement_definitions where id=cr.definition_id;
  if cr.id is null or expected is null then raise exception 'SIA requirement unavailable'; end if;
  select id into existing from public.onboarding_sia_submissions
    where requirement_id=cr.id and request_key=supplied_request_key;
  if existing is not null then return existing; end if;
  select * into current_row from public.person_sia_credentials
    where person_id=actor and category=expected for update;
  if current_row.id is null or current_row.synthetic_reference is null or current_row.expires_on is null
  then raise exception 'SIA details incomplete'; end if;
  insert into public.person_sia_credential_revisions(credential_id,person_id,category,synthetic_reference,
    expires_on,submitted_by_person_id)
    values(current_row.id,actor,current_row.category,current_row.synthetic_reference,
      current_row.expires_on,actor) returning id into revision_id;
  insert into public.onboarding_sia_submissions(case_id,requirement_id,person_id,revision_id,request_key)
    values(c.id,cr.id,actor,revision_id,supplied_request_key) returning id into submission_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,actor,'sia_submission',submission_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',cr.id,'revision_id',revision_id,'synthetic',true));
  return submission_id;
end;
$$;
