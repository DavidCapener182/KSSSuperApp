-- TASK-12A: allow a Staff reporter to resolve an ambiguous submit response without exposing details.
create function public.incident_submit_result(p_idempotency_key uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
  if actor is null or not private.has_active_role('SECURITY_STAFF') or p_idempotency_key is null then
    raise exception 'Incident submission result unavailable'; end if;
  select jsonb_build_object('found',true,'incidentId',m.incident_id) into result
    from public.incident_idempotency m
    where m.actor_person_id=actor and m.idempotency_key=p_idempotency_key and m.request_kind='SUBMIT';
  return coalesce(result,jsonb_build_object('found',false));
end $$;
revoke all on function public.incident_submit_result(uuid) from public,anon,authenticated;
grant execute on function public.incident_submit_result(uuid) to authenticated;
