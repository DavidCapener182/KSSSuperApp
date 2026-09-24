-- TASK-15A choices reveal only safe names/IDs needed by an authorised asset manager.
create function public.asset_holder_choices() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id();
begin
  if actor is null or not (private.has_active_role('OPERATIONS') or private.has_active_role('OFFICE_ADMIN'))
    then raise exception 'Asset holder choices denied'; end if;
  return pg_catalog.jsonb_build_object(
    'people',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind','PERSON','id',p.id,'name',p.display_name))
      from public.people p where exists(select 1 from public.role_assignments r where r.person_id=p.id
        and r.role_code='SECURITY_STAFF' and r.revoked_at is null and r.effective_from<=transaction_timestamp()
        and (r.effective_until is null or r.effective_until>transaction_timestamp()))), '[]'::jsonb),
    'places',coalesce((select pg_catalog.jsonb_agg(x.value) from (
      select pg_catalog.jsonb_build_object('kind','STORE','id',s.id,'name',s.name) value
        from public.asset_stores s where private.asset_has_grant(actor,'STORE',s.id)
      union all select pg_catalog.jsonb_build_object('kind','SITE','id',s.id,'name',s.name)
        from public.sites s where private.asset_has_grant(actor,'SITE',s.id)
      union all select pg_catalog.jsonb_build_object('kind','SITE_SERVICE','id',s.id,'name',s.name)
        from public.site_services s where private.asset_has_grant(actor,'SITE_SERVICE',s.id)
      union all select pg_catalog.jsonb_build_object('kind','EVENT','id',e.id,'name',e.name)
        from public.operational_events e where private.asset_has_grant(actor,'EVENT',e.id)
    ) x), '[]'::jsonb)
  );
end $$;
revoke all on function public.asset_holder_choices() from public,anon,authenticated;
grant execute on function public.asset_holder_choices() to authenticated;
