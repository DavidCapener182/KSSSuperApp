-- TASK-15A quantity movement history remains separate from current balance.
create function public.asset_stock_history(p_stock uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); row0 public.asset_stock%rowtype;
begin
  if actor is null then raise exception 'Stock history denied'; end if;
  select * into row0 from public.asset_stock where id=p_stock;
  if not found or (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')
    or private.asset_has_grant(actor,'STORE',row0.store_id)) is not true
    then raise exception 'Stock history denied'; end if;
  return pg_catalog.jsonb_build_object('id',row0.id,'sku',row0.sku,'garment',row0.garment,'size',row0.size,
    'events',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',e.id,'revision',e.revision,'action',e.action,'quantity',e.quantity,
      'availableAfter',e.available_after,'outstandingAfter',e.outstanding_after,
      'personId',e.person_id,'issueId',e.issue_id,'actorId',e.actor_person_id,
      'reason',e.reason,'recordedAt',e.recorded_at) order by e.revision)
      from public.asset_stock_events e where e.stock_id=p_stock), '[]'::jsonb));
end $$;
revoke all on function public.asset_stock_history(uuid) from public,anon,authenticated;
grant execute on function public.asset_stock_history(uuid) to authenticated;
