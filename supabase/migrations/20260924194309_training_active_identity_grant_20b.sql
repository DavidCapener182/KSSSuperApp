-- TASK-20B forward correction: active mapped identity required for named capability.
create or replace function public.training_grant(p_person uuid,p_capability text,p_reason text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := private.current_person_id(); v_id uuid;
begin
 if not private.has_active_role('SUPER_ADMIN') or p_capability not in ('TRAINING_AUTHOR','TRAINING_PUBLISHER') or length(trim(p_reason)) not between 10 and 300 or
 not exists(select 1 from public.role_assignments r where r.person_id=p_person and r.role_code='OFFICE_ADMIN' and r.revoked_at is null and r.effective_from <= now() and (r.effective_until is null or r.effective_until > now())) or
 not exists(select 1 from public.auth_identities ai where ai.person_id=p_person and ai.active) then raise exception 'Grant denied'; end if;
 insert into public.training_capability_grants(person_id,capability,granted_by,reason) values(p_person,p_capability,v_actor,trim(p_reason)) returning id into v_id;
 return v_id;
end $$;
