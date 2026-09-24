-- Forward correction: evaluate table-specific fields only for allocation rows.
create or replace function private.guard_allocations_06c() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_06c',true) is distinct from 'allowed' then
  raise exception 'Allocation direct write denied';
 end if;
 if tg_op='DELETE' then raise exception 'Allocation history cannot be deleted'; end if;
 if tg_table_name='event_staff_allocation_events' then
  if tg_op='UPDATE' then raise exception 'Allocation history is immutable'; end if;
  return new;
 end if;
 if tg_table_name='event_staff_allocations' and tg_op='UPDATE' then
  if new.id is distinct from old.id or new.requirement_id is distinct from old.requirement_id or
     new.person_id is distinct from old.person_id or
     new.requirement_revision_at_allocation is distinct from old.requirement_revision_at_allocation or
     new.allocated_by_person_id is distinct from old.allocated_by_person_id or
     new.allocated_at is distinct from old.allocated_at or
     new.revision<>old.revision+1 or old.status in ('DECLINED','CANCELLED') then
   raise exception 'Allocation identity/history cannot be changed';
  end if;
 end if;
 return new;
end $$;
