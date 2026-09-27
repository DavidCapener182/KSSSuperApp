-- CW01: a workspace grant must target a Person with a current active role.
create or replace function public.cw_grant(p_workspace uuid,p_person uuid,p_permission text,p_reason text,p_until timestamptz default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.current_person_id(); result uuid;
begin
 if (select auth.uid()) is null or actor is null or not private.has_active_role('SUPER_ADMIN')
  or p_permission not in ('VIEW','OPERATE','MANAGE') or length(trim(coalesce(p_reason,''))) not between 10 and 500
  or (p_until is not null and p_until<=now()) then raise exception 'Grant denied' using errcode='42501'; end if;
 if not exists(select 1 from public.client_workspaces w join public.client_workspace_modules m on m.workspace_id=w.id
  where w.id=p_workspace and w.status='ACTIVE' and m.code='LOSS_PREVENTION' and m.enabled)
  then raise exception 'Workspace denied' using errcode='42501'; end if;
 if not exists(select 1 from public.role_assignments r where r.person_id=p_person and r.revoked_at is null
  and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))
  then raise exception 'Active recipient role required' using errcode='42501'; end if;
 if exists(select 1 from public.client_workspace_grants g where g.workspace_id=p_workspace and g.person_id=p_person
  and g.module_code='LOSS_PREVENTION' and g.revoked_at is null and g.effective_from<=now()
  and (g.effective_until is null or g.effective_until>now())) then raise exception 'Current grant exists' using errcode='23505'; end if;
 insert into public.client_workspace_grants(workspace_id,person_id,permission,effective_until,granted_by_person_id,reason)
 values(p_workspace,p_person,p_permission,p_until,actor,trim(p_reason)) returning id into result;
 insert into public.client_workspace_grant_events(grant_id,action,actor_person_id,reason)
 values(result,'GRANTED',actor,trim(p_reason));
 return result;
end; $$;
