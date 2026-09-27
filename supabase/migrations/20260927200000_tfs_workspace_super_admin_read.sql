-- An active Super Admin can read every active Client Loss Prevention workspace.
-- A recorded exact grant remains necessary for issue writes.
alter table public.client_workspaces add column slug text;
alter table public.client_workspaces add constraint client_workspaces_slug_format check (slug is null or slug ~ '^[a-z][a-z0-9-]{1,39}$');
create unique index client_workspaces_slug_unique on public.client_workspaces(slug) where slug is not null;

create or replace function private.cw_access(p_workspace uuid,p_level text) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (select private.current_person_id()) is not null
 and (select private.has_any_active_role())
 and exists (
  select 1 from public.client_workspaces w
  join public.client_workspace_modules m on m.workspace_id=w.id
  join public.crm_organisations o on o.id=w.organisation_id and o.relationship_status='CLIENT'
  where w.id=p_workspace and w.status='ACTIVE' and m.code='LOSS_PREVENTION' and m.enabled
  and ((p_level='VIEW' and (select private.has_active_role('SUPER_ADMIN')))
   or exists (
    select 1 from public.client_workspace_grants g
    where g.workspace_id=w.id and g.module_code=m.code
     and g.person_id=(select private.current_person_id()) and g.revoked_at is null
     and g.effective_from<=now() and (g.effective_until is null or g.effective_until>now())
     and case p_level when 'VIEW' then g.permission in ('VIEW','OPERATE','MANAGE')
      when 'OPERATE' then g.permission in ('OPERATE','MANAGE')
      when 'MANAGE' then g.permission='MANAGE' else false end
   ))
 );
$$;
revoke all on function private.cw_access(uuid,text) from public,anon,authenticated;
grant execute on function private.cw_access(uuid,text) to authenticated;

create or replace function public.cw_directory() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := private.current_person_id(); result jsonb;
begin
 if (select auth.uid()) is null or actor is null then raise exception 'Workspace denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'organisationId',w.organisation_id,'name',o.name,'permission',
  coalesce((select g.permission from public.client_workspace_grants g where g.workspace_id=w.id and g.person_id=actor
   and g.module_code='LOSS_PREVENTION' and g.revoked_at is null and g.effective_from<=now()
   and (g.effective_until is null or g.effective_until>now()) order by case g.permission when 'MANAGE' then 3 when 'OPERATE' then 2 else 1 end desc limit 1),
   case when private.has_active_role('SUPER_ADMIN') then 'VIEW' end)) order by o.name),'[]'::jsonb)
 into result from public.client_workspaces w join public.crm_organisations o on o.id=w.organisation_id
 where private.cw_access(w.id,'VIEW');
 return result;
end; $$;

create or replace function public.cw_workspace(p_workspace uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.cw_access(p_workspace,'VIEW') then raise exception 'Workspace denied' using errcode='42501'; end if;
 select jsonb_build_object('id',w.id,'organisationId',w.organisation_id,'name',o.name,'status',w.status,
  'permission',coalesce((select g.permission from public.client_workspace_grants g where g.workspace_id=w.id and g.person_id=private.current_person_id()
   and g.module_code='LOSS_PREVENTION' and g.revoked_at is null and g.effective_from<=now()
   and (g.effective_until is null or g.effective_until>now()) order by case g.permission when 'MANAGE' then 3 when 'OPERATE' then 2 else 1 end desc limit 1),
   case when private.has_active_role('SUPER_ADMIN') then 'VIEW' end))
 into result from public.client_workspaces w join public.crm_organisations o on o.id=w.organisation_id where w.id=p_workspace;
 return result;
end; $$;

create function public.cw_tfs_entry() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare result uuid;
begin
 if (select auth.uid()) is null or private.current_person_id() is null then raise exception 'Workspace denied' using errcode='42501'; end if;
 select w.id into result from public.client_workspaces w where w.slug='tfs' and private.cw_access(w.id,'VIEW');
 return result;
end; $$;
revoke all on function public.cw_directory(),public.cw_workspace(uuid),public.cw_tfs_entry() from public,anon,authenticated;
grant execute on function public.cw_directory(),public.cw_workspace(uuid),public.cw_tfs_entry() to authenticated;
