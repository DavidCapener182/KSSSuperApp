-- TASK-03B review fix: a cancelled or V1 case must not expose later current private records.
create or replace function private.office_manages_onboarding_person(target_person uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_active_role('OFFICE_ADMIN') and exists (
    select 1 from public.onboarding_cases c
    join public.onboarding_template_versions v on v.id=c.template_version_id
    where c.person_id=target_person and c.owner_person_id=private.current_person_id()
      and c.state in ('DRAFT','IN_PROGRESS') and v.version_number>=2)
$$;
