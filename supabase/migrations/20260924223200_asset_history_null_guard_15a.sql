-- TASK-15A deny former-holder history when nullable holder comparison yields NULL.
create or replace function public.asset_history(p_asset uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); item public.asset_items%rowtype;
begin
  if actor is null then raise exception 'Asset access denied'; end if;
  select * into item from public.asset_items where id=p_asset;
  if not found or (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')
    or item.holder_person_id=actor or private.asset_has_grant(actor,item.holder_kind,private.asset_holder_id(item))
    or (item.holder_kind='PERSON' and private.asset_has_grant(actor,'STORE',item.home_store_id))) is not true
    then raise exception 'Asset access denied'; end if;
  return pg_catalog.jsonb_build_object('id',item.id,'reference',item.reference,'class',item.class,
    'serial',case when item.class='KEY_CARD' and not (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')) then null else item.serial end,
    'events',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',e.id,'revision',e.revision,'action',e.action,'actorId',e.actor_person_id,'holderBefore',e.holder_before,
      'holderAfter',e.holder_after,'conditionBefore',e.condition_before,'conditionAfter',e.condition_after,
      'maintenanceAfter',e.maintenance_after,'exceptionAfter',e.exception_after,'recordedAt',e.recorded_at,
      'reason',case when item.class='KEY_CARD' and not (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')) then null else e.reason end)
      order by e.revision) from public.asset_events e where e.asset_id=p_asset), '[]'::jsonb));
end $$;
