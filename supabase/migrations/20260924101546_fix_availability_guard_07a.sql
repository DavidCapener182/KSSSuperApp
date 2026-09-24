-- Forward-only correction: the version row has no declaration id or interval fields.
create or replace function private.guard_availability_07a() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_07a',true) is distinct from 'allowed' then
  raise exception 'Availability direct write denied'; end if;
 if tg_op='DELETE' then raise exception 'Availability history cannot be deleted'; end if;
 if tg_op='UPDATE' then
  if tg_table_name='staff_availability_history' then
   raise exception 'Availability history is immutable';
  elsif tg_table_name='staff_availability_versions' then
   if new.person_id is distinct from old.person_id or new.revision<>old.revision+1 then
    raise exception 'Availability revision invalid'; end if;
  elsif tg_table_name='staff_availability_declarations' then
   if new.id is distinct from old.id or new.person_id is distinct from old.person_id or
    new.state is distinct from old.state or new.starts_at is distinct from old.starts_at or
    new.ends_at is distinct from old.ends_at or new.note is distinct from old.note or
    new.origin_declaration_id is distinct from old.origin_declaration_id or
    new.change_set_id is distinct from old.change_set_id or new.created_by_person_id is distinct from old.created_by_person_id or
    new.created_at is distinct from old.created_at or old.lifecycle<>'CURRENT' or new.lifecycle not in ('SUPERSEDED','CANCELLED')
   then raise exception 'Availability declaration is immutable'; end if;
  end if;
 end if;
 return new;
end $$;
