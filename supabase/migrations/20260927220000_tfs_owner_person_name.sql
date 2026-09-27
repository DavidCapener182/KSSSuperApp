-- Resolve the already stored KSS Person link in authorised workspace reads.
create or replace function public.cw_issues(p_workspace uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.cw_access(p_workspace,'VIEW') then raise exception 'Workspace denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(i) || jsonb_build_object('ownerPersonName',p.display_name)
  order by i.updated_at desc,i.id),'[]'::jsonb) into result
 from public.tfs_lp_issues i left join public.people p on p.id=i.owner_person_id
 where i.workspace_id=p_workspace;
 return result;
end; $$;

create or replace function public.cw_issue(p_workspace uuid,p_issue uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.cw_access(p_workspace,'VIEW') then raise exception 'Workspace denied' using errcode='42501'; end if;
 select to_jsonb(i) || jsonb_build_object('ownerPersonName',p.display_name,'history',(select coalesce(jsonb_agg(jsonb_build_object(
  'revision',e.revision,'action',e.action,'actorPersonId',e.actor_person_id,'reason',e.reason,
  'occurredAt',e.occurred_at,'before',e.before_value,'after',e.after_value) order by e.revision desc),'[]'::jsonb)
  from public.tfs_lp_issue_events e where e.issue_id=i.id)) into result
 from public.tfs_lp_issues i left join public.people p on p.id=i.owner_person_id
 where i.workspace_id=p_workspace and i.id=p_issue;
 return result;
end; $$;
