-- TASK-03B review fix: do not issue evidence requests for a stale submitted credential.
create or replace function public.issue_onboarding_sia_request(requested_case uuid,requested_submission uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; s public.onboarding_sia_submissions%rowtype;
  latest_id uuid; created_request uuid; sr public.person_sia_credential_revisions%rowtype;
  current_credential public.person_sia_credentials%rowtype;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or c.state<>'IN_PROGRESS' or actor is null or actor=c.person_id
    or actor<>c.owner_person_id or not private.has_active_role('OFFICE_ADMIN')
  then raise exception 'SIA request denied'; end if;
  select id into latest_id from public.onboarding_sia_submissions where case_id=c.id
    order by submitted_at desc,id desc limit 1;
  select * into s from public.onboarding_sia_submissions where id=requested_submission
    and case_id=c.id for update;
  if s.id is null or s.id<>latest_id then raise exception 'SIA submission stale'; end if;
  select * into sr from public.person_sia_credential_revisions where id=s.revision_id;
  select * into current_credential from public.person_sia_credentials where id=sr.credential_id;
  if sr.person_id<>c.person_id or current_credential.person_id<>c.person_id
    or sr.credential_change_seq<>current_credential.credential_change_seq
    or sr.synthetic_reference is distinct from current_credential.synthetic_reference
    or sr.expires_on is distinct from current_credential.expires_on
    or sr.expires_on<private.uk_today()
  then raise exception 'SIA submitted credential is no longer current'; end if;
  if s.document_request_id is not null then return s.document_request_id; end if;
  created_request:=public.create_document_request(c.person_id,c.site_id,
    'Synthetic onboarding SIA evidence');
  update public.onboarding_sia_submissions set document_request_id=created_request where id=s.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'sia_submission',s.id,'UPDATE',
      jsonb_build_object('case_id',c.id,'requirement_id',s.requirement_id,
        'document_request_id',created_request,'synthetic',true));
  return created_request;
end;
$$;
