-- Dispatch table-specific guards before referencing each table's record fields.
create or replace function private.guard_staffing_06b() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_06b',true) is distinct from 'allowed' then raise exception 'Staffing direct write denied'; end if;
 if tg_op='DELETE' then raise exception 'Staffing records cannot be deleted'; end if;
 if tg_op='UPDATE' then
  if tg_table_name='event_staffing_requirement_revisions' then raise exception 'Staffing history is immutable'; end if;
  if tg_table_name='event_staffing_requirements' then
   if new.id is distinct from old.id or new.event_id is distinct from old.event_id or
      new.created_by_person_id is distinct from old.created_by_person_id or new.created_at is distinct from old.created_at or
      new.revision<>old.revision+1 or old.state='CANCELLED' then raise exception 'Staffing identity/history cannot be changed'; end if;
  elsif tg_table_name='operational_role_definitions' then
   if new.id is distinct from old.id or new.code is distinct from old.code or
      new.display_name is distinct from old.display_name or new.description is distinct from old.description or
      new.created_at is distinct from old.created_at or not old.active then raise exception 'Operational role meaning is immutable'; end if;
  end if;
 end if;
 return new;
end $$;
