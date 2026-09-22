-- Forward correction: the shared role/Site trigger must not access columns
-- absent from role_assignments. Preserve full before/after audit snapshots.
create or replace function private.audit_assignment_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events (
    actor_person_id, affected_person_id, site_id, entity_type, entity_id,
    action, before_value, after_value, reason
  ) values (
    private.current_person_id(), new.person_id,
    (to_jsonb(new) ->> 'site_id')::uuid,
    case when tg_table_name = 'role_assignments' then 'role_assignment' else 'site_assignment' end,
    new.id, tg_op,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    to_jsonb(new) ->> 'change_reason'
  );
  return new;
end;
$$;
revoke all on function private.audit_assignment_change() from public, anon, authenticated;
