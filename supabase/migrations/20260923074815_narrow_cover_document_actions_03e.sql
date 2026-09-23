-- Cover sees exact actionable onboarding evidence only. Current owner and Super
-- retain their established case-bound history access; generic requests keep
-- original requester semantics.
create function private.cover_request_actionable(requested_id uuid,requested_case uuid,actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.onboarding_cover_authorised(requested_case,actor) and exists (
    select 1 from public.documents doc join public.document_versions v on v.document_id=doc.id
    where doc.request_id=requested_id and v.upload_state='SUBMITTED'
      and not exists(select 1 from public.document_versions later where later.document_id=doc.id
        and later.upload_state='SUBMITTED' and later.version_number>v.version_number)
      and (
        exists(select 1 from public.tasks t where t.source_kind='DOCUMENT_VERSION' and t.source_id=v.id
          and t.state='OPEN')
        or (exists(select 1 from public.document_reviews r where r.version_id=v.id
              and r.decision='ACCEPTED_AS_EVIDENCE')
          and not exists(select 1 from public.onboarding_requirement_verifications ov
            where ov.case_id=requested_case and ov.evidence_version_id=v.id and ov.decision='VERIFIED'))))
$$;
revoke all on function private.cover_request_actionable(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function private.document_can_read_request(requested_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.document_requests r where r.id=requested_id and
    (case when private.onboarding_request_case(r.id) is not null then
      private.has_active_role('SUPER_ADMIN')
      or (r.target_person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
      or (private.has_active_role('OFFICE_ADMIN') and (
        private.onboarding_owner_authorised(private.onboarding_request_case(r.id),private.current_person_id())
        or private.cover_request_actionable(r.id,private.onboarding_request_case(r.id),private.current_person_id())))
    else private.has_active_role('SUPER_ADMIN')
      or (r.target_person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
      or (r.requester_person_id=private.current_person_id() and private.has_active_role('OFFICE_ADMIN'))
    end))
$$;

create or replace function private.document_can_review_request(requested_id uuid,actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.document_requests r where r.id=requested_id
    and r.target_person_id<>actor and (
      (private.onboarding_request_case(r.id) is null and (
        private.has_active_role('SUPER_ADMIN') or
        (private.has_active_role('OFFICE_ADMIN') and r.requester_person_id=actor)))
      or (private.onboarding_request_case(r.id) is not null and exists(
        select 1 from public.onboarding_cases c
        where c.id=private.onboarding_request_case(r.id) and c.state='IN_PROGRESS'
          and c.person_id=r.target_person_id and (
            private.has_active_role('SUPER_ADMIN') or
            (private.has_active_role('OFFICE_ADMIN') and (
              private.onboarding_owner_authorised(c.id,actor)
              or (private.cover_request_actionable(r.id,c.id,actor)
                and exists(select 1 from public.tasks t
                  join public.document_versions v on v.id=t.source_id
                  join public.documents d on d.id=v.document_id
                  where d.request_id=r.id and t.state='OPEN')))))))))
$$;

create or replace function private.can_download_controlled_key(requested_key text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.controlled_document_versions v
    join public.controlled_documents d on d.id=v.document_id
    where v.object_key=requested_key and v.upload_state='READY' and (
      (private.can_publish_controlled(d.family) and d.created_by_person_id=private.current_person_id())
      or exists(select 1 from public.onboarding_controlled_assignments a
        join public.onboarding_cases c on c.id=a.case_id
        where a.version_id=v.id and c.state='IN_PROGRESS'
          and (private.has_active_role('SUPER_ADMIN')
            or (private.has_active_role('OFFICE_ADMIN') and private.onboarding_owner_authorised(c.id,private.current_person_id()))
            or (private.has_active_role('SECURITY_STAFF') and c.person_id=private.current_person_id()
              and exists(select 1 from public.controlled_document_accesses x where x.assignment_id=a.id
                and x.person_id=c.person_id and x.version_id=v.id))))))
$$;
