-- TASK-15A bounded Super Admin grant audit readback.
create or replace function public.asset_admin_choices() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if private.current_person_id() is null or not private.has_active_role('SUPER_ADMIN')
    then raise exception 'Asset administration denied'; end if;
  return pg_catalog.jsonb_build_object(
    'operations',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',p.id,'name',p.display_name))
      from public.people p where exists(select 1 from public.role_assignments r where r.person_id=p.id
        and r.role_code='OPERATIONS' and r.revoked_at is null
        and r.effective_from<=transaction_timestamp()
        and (r.effective_until is null or r.effective_until>transaction_timestamp()))), '[]'::jsonb),
    'scopes',coalesce((select pg_catalog.jsonb_agg(x.value) from (
      select pg_catalog.jsonb_build_object('kind','STORE','id',s.id,'name',s.name) value from public.asset_stores s
      union all select pg_catalog.jsonb_build_object('kind','SITE','id',s.id,'name',s.name) from public.sites s
      union all select pg_catalog.jsonb_build_object('kind','SITE_SERVICE','id',s.id,'name',s.name) from public.site_services s
      union all select pg_catalog.jsonb_build_object('kind','EVENT','id',e.id,'name',e.name) from public.operational_events e
    ) x), '[]'::jsonb),
    'grants',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',g.id,'personId',g.person_id,'scopeKind',g.scope_kind,
      'scopeId',coalesce(g.store_id,g.site_id,g.site_service_id,g.event_id),
      'effectiveUntil',g.effective_until,'revokedAt',g.revoked_at))
      from public.asset_capability_grants g where g.revoked_at is null and g.effective_until>transaction_timestamp()), '[]'::jsonb),
    'grantEvents',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',e.id,'grantId',e.grant_id,'kind',e.kind,'actorId',e.actor_person_id,
      'reason',e.reason,'occurredAt',e.occurred_at) order by e.occurred_at desc,e.id desc)
      from (select * from public.asset_grant_events order by occurred_at desc,id desc limit 50) e), '[]'::jsonb)
  );
end $$;
