-- A cancelled onboarding case keeps its document history, but cannot accept
-- another upload or complete an upload that was started before cancellation.
create or replace function private.document_can_submit_request(requested_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_requests r
    join public.documents d on d.request_id = r.id
    where r.id = requested_id and d.classification = 'PERSONNEL_PRIVATE'
      and r.target_person_id = (select private.current_person_id())
      and (select private.has_active_role('SECURITY_STAFF'))
      and not exists (
        select 1 from public.onboarding_case_requirements cr
        join public.onboarding_cases oc on oc.id = cr.case_id
        where cr.document_request_id = r.id and oc.state = 'CANCELLED'
      )
      and (r.status = 'REQUESTED' or (
        r.status = 'SUBMITTED' and exists (
          select 1 from public.document_versions v
          join public.document_reviews rev on rev.version_id = v.id and rev.decision = 'REJECTED'
          where v.document_id = d.id and v.upload_state = 'SUBMITTED'
            and not exists (select 1 from public.document_versions newer
              where newer.document_id = d.id and newer.upload_state = 'SUBMITTED'
                and newer.version_number > v.version_number)
        )
      ))
  )
$$;
