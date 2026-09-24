-- TASK-14A Staff may see old open items and recent resolved lineage, not arbitrary historical resolved items.
create or replace function public.site_book_item_history_14a(p_item uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.site_book_items%rowtype; result jsonb;
begin
 select * into i from public.site_book_items where id=p_item;
 if i.id is null or not private.site_book_can_read_14a(i.service_id)
 or (not private.site_book_manager_14a(i.service_id) and i.status<>'OPEN' and not exists(
  select 1 from public.site_book_item_events ev where ev.item_id=i.id and ev.recorded_at>=transaction_timestamp()-interval '48 hours'))
 then raise exception 'Book item unavailable'; end if;
 select jsonb_build_object('id',i.id,'status',i.status,'revision',i.revision,'entryId',i.entry_id,
  'original',(select jsonb_build_object('body',v.body,'occurredAt',v.occurred_at,'recordedAt',v.recorded_at)
   from public.site_book_entry_versions v where v.entry_id=i.entry_id and v.version=1),
  'events',(select coalesce(jsonb_agg(jsonb_build_object('kind',ev.kind,'revision',ev.revision,'note',ev.note,'reason',ev.reason,'actor',p.display_name,'recordedAt',ev.recorded_at) order by ev.revision),'[]'::jsonb)
   from public.site_book_item_events ev join public.people p on p.id=ev.actor_person_id where ev.item_id=i.id)) into result;
 return result;
end $$;
revoke all on function public.site_book_item_history_14a(uuid) from public,anon,authenticated;
