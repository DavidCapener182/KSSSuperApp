-- TASK-18A: narrow Office-only creation choices, including exact Won provenance.
create function public.mobilisation_choices(p_organisation uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if not private.crm_authorised() then raise exception 'Mobilisation choices denied'; end if;
 select jsonb_build_object(
  'clients',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name,o.id)
    from public.crm_organisations o where o.relationship_status='CLIENT'),'[]'::jsonb),
  'owners',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by p.display_name,p.id)
    from public.people p where private.crm_owner_eligible(p.id)),'[]'::jsonb),
  'wonOpportunities',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'title',o.title) order by o.title,o.id)
    from public.crm_opportunities o where o.organisation_id=p_organisation and o.stage='WON'),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.mobilisation_choices(uuid) from public,anon,authenticated;
grant execute on function public.mobilisation_choices(uuid) to authenticated;
