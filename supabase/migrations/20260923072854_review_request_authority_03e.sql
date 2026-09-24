-- TASK-03E: server preflight mirrors the guarded review RPC. Generic requests
-- retain original requester authority; exact onboarding links use case authority.
create function public.can_review_document_request(requested_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.current_person_id() is not null and
    private.document_can_review_request(requested_id,private.current_person_id())
$$;
revoke all on function public.can_review_document_request(uuid) from public,anon,authenticated;
grant execute on function public.can_review_document_request(uuid) to authenticated;
