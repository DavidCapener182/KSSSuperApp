-- TASK-03E forward correction: original case owner may start a Draft.
create or replace function public.get_onboarding_case_access(requested_case uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; result jsonb;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case;
  if actor is null or c.id is null or not (
    private.has_active_role('SUPER_ADMIN') or
    (private.has_active_role('OFFICE_ADMIN') and private.onboarding_office_case_access(c.id,actor)))
  then return null; end if;
  select jsonb_build_object('caseId',c.id,'teamId',c.team_id,
    'ownerPersonId',c.owner_person_id,'ownerName',owner.display_name,
    'starterName',starter.display_name,'siteName',coalesce(site.name,'Company onboarding'),
    'isCover',private.onboarding_cover_authorised(c.id,actor),
    'canAct',c.state in ('DRAFT','IN_PROGRESS') and actor<>c.person_id,
    'canReassign',c.state='IN_PROGRESS' and actor<>c.person_id and
      (private.has_active_role('SUPER_ADMIN') or
        (private.active_onboarding_team_member(c.team_id,actor) and
          (c.owner_person_id=actor or private.onboarding_team_coordinator(c.team_id,actor)))))
    into result from public.people owner join public.people starter on starter.id=c.person_id
    left join public.sites site on site.id=c.site_id where owner.id=c.owner_person_id;
  return result;
end;$$;
