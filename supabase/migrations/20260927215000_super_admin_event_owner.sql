-- Permit the existing Super Admin to own imported operational Events.
-- This does not grant any additional role or change Event creation authority.
create or replace function private.operational_owner_eligible(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.role_assignments r where r.person_id=target
 and r.role_code in ('SUPER_ADMIN','OFFICE_ADMIN','OPERATIONS')
 and r.revoked_at is null and r.effective_from<=now()
 and (r.effective_until is null or r.effective_until>now()))
$$;
revoke all on function private.operational_owner_eligible(uuid) from public,anon,authenticated;
