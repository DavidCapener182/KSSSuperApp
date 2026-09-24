-- TASK-20B named capability oversight and attributable revocation.
alter table public.training_capability_grants add column revoked_reason text;
create function public.training_grants() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
 if not private.has_active_role('SUPER_ADMIN') then raise exception 'Grant oversight denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'personId',g.person_id,'personName',p.display_name,'capability',g.capability,'grantedBy',g.granted_by,'grantedAt',g.granted_at,'reason',g.reason,'revokedBy',g.revoked_by,'revokedAt',g.revoked_at,'revokedReason',g.revoked_reason) order by g.granted_at desc),'[]'::jsonb) into v_rows
 from public.training_capability_grants g join public.people p on p.id=g.person_id;
 return v_rows;
end $$;
revoke all on function public.training_grants() from public,anon,authenticated;
grant execute on function public.training_grants() to authenticated;
create or replace function public.training_revoke(p_grant uuid,p_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.current_person_id(); v_grant public.training_capability_grants%rowtype;
begin
 if not private.has_active_role('SUPER_ADMIN') or length(trim(p_reason)) not between 10 and 300 then raise exception 'Revoke denied'; end if;
 update public.training_capability_grants set revoked_by=v_actor,revoked_at=now(),revoked_reason=trim(p_reason) where id=p_grant and revoked_at is null returning * into v_grant;
 if not found then raise exception 'Grant not found'; end if;
end $$;
