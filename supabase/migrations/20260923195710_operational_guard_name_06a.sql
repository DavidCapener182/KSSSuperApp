-- Forward correction: PostgreSQL custom GUC segments cannot begin with a digit.
do $$
declare item record;
begin
 for item in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='private' and p.proname='guard_06a_tables') or
        (n.nspname='public' and p.proname in ('operational_link_site','operational_create_event','operational_change_event'))
 loop
  execute replace(pg_get_functiondef(item.oid),'kss.06a_write','kss.write_06a');
 end loop;
end $$;
