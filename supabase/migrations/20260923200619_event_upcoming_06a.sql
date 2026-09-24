-- Upcoming is a derived operational view, not a persisted Event status.
do $$
declare definition text; adjusted text;
begin
 select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='operational_events_list';
 adjusted:=replace(definition,
  'and (p_status is null or e.status=p_status) and (p_type is null or e.event_type=p_type)',
  'and (p_status is null or (p_status=''UPCOMING'' and e.status in (''PLANNING'',''CONFIRMED'',''LIVE'') and e.ends_at>=now()) or e.status=p_status) and (p_type is null or e.event_type=p_type)');
 if adjusted=definition then raise exception 'Expected Event status predicate not found'; end if;
 execute adjusted;
end $$;
