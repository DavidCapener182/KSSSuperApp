-- TASK-03C forward fix: PL/pgSQL must branch by table before reading NEW fields.
create or replace function private.guard_controlled_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op<>'INSERT' then raise exception 'Controlled history is immutable'; end if;
  if tg_table_name='onboarding_controlled_assignments' then
    if not exists(
      select 1 from public.onboarding_cases c join public.onboarding_case_requirements r on r.case_id=c.id
        join public.onboarding_requirement_definitions d on d.id=r.definition_id
        join public.controlled_document_versions v on v.id=new.version_id
        join public.controlled_documents cd on cd.id=v.document_id
      where c.id=new.case_id and r.id=new.requirement_id and c.person_id=new.target_person_id
        and d.code='CONTRACT_TERMS' and d.fulfilment_kind='CONTROLLED_ACKNOWLEDGEMENT'
        and c.state='IN_PROGRESS' and c.template_version_id=d.template_version_id
        and v.state='PUBLISHED' and v.document_id=new.document_id and cd.family='ONBOARDING_TERMS_SYNTHETIC'
    ) then raise exception 'Assignment source mismatch'; end if;
  elsif tg_table_name='controlled_document_accesses' then
    if not exists(
      select 1 from public.onboarding_controlled_assignments a join public.onboarding_cases c on c.id=a.case_id
        where a.id=new.assignment_id and a.target_person_id=new.person_id and a.version_id=new.version_id
          and c.state='IN_PROGRESS'
    ) then raise exception 'Access source mismatch'; end if;
  elsif tg_table_name='controlled_acknowledgements' then
    if not exists(
      select 1 from public.onboarding_controlled_assignments a join public.onboarding_cases c on c.id=a.case_id
        join public.controlled_document_versions v on v.id=a.version_id
        where a.id=new.assignment_id and a.case_id=new.case_id and a.requirement_id=new.requirement_id
          and a.target_person_id=new.target_person_id and a.document_id=new.document_id and a.version_id=new.version_id
          and new.actor_person_id=new.target_person_id and c.state='IN_PROGRESS' and v.state='PUBLISHED'
          and exists(select 1 from public.controlled_document_accesses x where x.assignment_id=a.id
            and x.person_id=new.target_person_id and x.version_id=new.version_id)
    ) then raise exception 'Acknowledgement source mismatch'; end if;
  end if;
  return new;
end;
$$;
