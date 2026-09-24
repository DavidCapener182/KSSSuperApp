-- Calendar adds exact segment times to the same scoped rows/count projection.
create function public.time_away_calendar(p_team uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb; items jsonb;
begin
 if p_team is null or p_from is null or p_to is null then raise exception 'Time Away calendar denied'; end if;
 base:=public.time_away_list(p_team,p_from,p_to,0,50,'VIEW_CALENDAR');
 select coalesce(jsonb_agg(day_item.value || jsonb_build_object('segments',
  private.time_away_snapshot((day_item.value->>'id')::uuid))),'[]'::jsonb)
  into items from jsonb_array_elements(base->'items') as day_item(value);
 return jsonb_set(base,'{items}',items);
end $$;
revoke all on function public.time_away_calendar(uuid,date,date) from public,anon,authenticated;
grant execute on function public.time_away_calendar(uuid,date,date) to authenticated;
