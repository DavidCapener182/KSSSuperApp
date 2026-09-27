-- PRODUCT-07 forward correction: do not offer an unacknowledged uniform issue for return.
-- The accepted asset_stock_move RETURN contract rejects PENDING acknowledgement.
create or replace function public.asset_stock_issue_choices(p_stock uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); row0 public.asset_stock%rowtype;
begin
  if actor is null or not (private.has_active_role('OPERATIONS') or private.has_active_role('OFFICE_ADMIN'))
    then raise exception 'Stock issue choices denied'; end if;
  select * into row0 from public.asset_stock where id=p_stock;
  if not found or not (private.has_active_role('OFFICE_ADMIN') or private.asset_has_grant(actor,'STORE',row0.store_id))
    then raise exception 'Stock issue choices denied'; end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('issueId',i.id,
    'personId',i.person_id,'personName',p.display_name,'outstanding',i.quantity_outstanding,
    'acknowledgement',i.acknowledgement)
    order by p.display_name,i.id)
    from public.asset_stock_issues i join public.people p on p.id=i.person_id
    where i.stock_id=p_stock and i.quantity_outstanding>0 and i.acknowledgement<>'PENDING'),'[]'::jsonb);
end $$;
revoke all on function public.asset_stock_issue_choices(uuid) from public,anon,authenticated;
grant execute on function public.asset_stock_issue_choices(uuid) to authenticated;
