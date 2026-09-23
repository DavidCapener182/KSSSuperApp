-- TASK-03B review fix: Super Admin private profile oversight must be case-bound and audited.
create or replace function private.office_manages_onboarding_person(target_person uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_active_role('OFFICE_ADMIN') and not private.has_active_role('SUPER_ADMIN') and exists (
    select 1 from public.onboarding_cases c
    join public.onboarding_template_versions v on v.id=c.template_version_id
    where c.person_id=target_person and c.owner_person_id=private.current_person_id()
      and c.state in ('DRAFT','IN_PROGRESS') and v.version_number>=2)
$$;

drop policy person_profiles_read on public.person_profiles;
create policy person_profiles_read on public.person_profiles for select to authenticated using (
  (person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
  or private.office_manages_onboarding_person(person_id));
drop policy person_profile_revisions_read on public.person_profile_revisions;
create policy person_profile_revisions_read on public.person_profile_revisions for select to authenticated using (
  (person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
  or (not private.has_active_role('SUPER_ADMIN') and exists (
    select 1 from public.onboarding_profile_submissions s join public.onboarding_cases c on c.id=s.case_id
    where s.revision_id=public.person_profile_revisions.id and c.owner_person_id=private.current_person_id()
      and private.has_active_role('OFFICE_ADMIN'))));
drop policy person_sia_credentials_read on public.person_sia_credentials;
create policy person_sia_credentials_read on public.person_sia_credentials for select to authenticated using (
  (person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
  or private.office_manages_onboarding_person(person_id));
drop policy sia_revisions_read on public.person_sia_credential_revisions;
create policy sia_revisions_read on public.person_sia_credential_revisions for select to authenticated using (
  (person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
  or (not private.has_active_role('SUPER_ADMIN') and exists (
    select 1 from public.onboarding_sia_submissions s join public.onboarding_cases c on c.id=s.case_id
    where s.revision_id=public.person_sia_credential_revisions.id and c.owner_person_id=private.current_person_id()
      and private.has_active_role('OFFICE_ADMIN'))));

create function public.read_onboarding_private_profile(requested_case uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; v public.onboarding_template_versions%rowtype;
  current_profile jsonb; submitted_profile jsonb; current_sia jsonb; submitted_sia jsonb;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case;
  select * into v from public.onboarding_template_versions where id=c.template_version_id;
  if actor is null or c.id is null or v.version_number<2 or not private.has_active_role('SUPER_ADMIN')
  then raise exception 'Private profile oversight denied'; end if;
  if c.state in ('DRAFT','IN_PROGRESS') then
    select to_jsonb(p) into current_profile from public.person_profiles p where p.person_id=c.person_id;
    select to_jsonb(sc) into current_sia from public.person_sia_credentials sc
      where sc.person_id=c.person_id and sc.category='SECURITY_GUARDING';
  end if;
  select to_jsonb(r) into submitted_profile from public.person_profile_revisions r
    join public.onboarding_profile_submissions s on s.revision_id=r.id
    where s.case_id=c.id order by s.submitted_at desc,s.id desc limit 1;
  select to_jsonb(r) into submitted_sia from public.person_sia_credential_revisions r
    join public.onboarding_sia_submissions s on s.revision_id=r.id
    where s.case_id=c.id order by s.submitted_at desc,s.id desc limit 1;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'person_profile',c.person_id,'READ',
      jsonb_build_object('case_id',c.id,'scope','SUPER_ADMIN_ONBOARDING_PRIVATE_READ'));
  return jsonb_build_object('profile',current_profile,'submittedProfile',submitted_profile,
    'siaCredential',current_sia,'submittedSia',submitted_sia);
end;
$$;
revoke all on function public.read_onboarding_private_profile(uuid) from public,anon,authenticated;
grant execute on function public.read_onboarding_private_profile(uuid) to authenticated;
