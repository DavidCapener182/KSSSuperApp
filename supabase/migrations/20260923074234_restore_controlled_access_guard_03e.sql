-- TASK-03E forward correction: retain the 03C typed Staff access prerequisite while allowing exact-case Office cover.
create or replace function private.can_download_controlled_key(requested_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.controlled_document_versions v
    join public.controlled_documents d on d.id=v.document_id
    where v.object_key=requested_key and v.upload_state='READY' and (
      (private.can_publish_controlled(d.family) and d.created_by_person_id=private.current_person_id())
      or exists(select 1 from public.onboarding_controlled_assignments a
        join public.onboarding_cases c on c.id=a.case_id
        where a.version_id=v.id and c.state='IN_PROGRESS'
          and (private.has_active_role('SUPER_ADMIN')
            or (private.has_active_role('OFFICE_ADMIN') and private.onboarding_office_case_access(c.id,private.current_person_id()))
            or (private.has_active_role('SECURITY_STAFF') and c.person_id=private.current_person_id()
              and exists(select 1 from public.controlled_document_accesses x where x.assignment_id=a.id
                and x.person_id=c.person_id and x.version_id=v.id))))
    ))
$$;
