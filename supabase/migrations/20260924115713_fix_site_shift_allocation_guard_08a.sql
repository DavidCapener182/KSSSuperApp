create or replace function private.guard_site_shift_allocation_08a() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_08a',true) is distinct from 'allowed' then raise exception 'Static allocation direct write denied'; end if;
 if tg_op='DELETE' then raise exception 'Static allocation history is immutable'; end if;
 if tg_op='INSERT' then return new; end if;
 if tg_table_name='site_shift_allocation_events' then raise exception 'Static allocation history is immutable'; end if;
 if new.id is distinct from old.id or new.demand_id is distinct from old.demand_id or
  new.person_id is distinct from old.person_id or new.allocated_by_person_id is distinct from old.allocated_by_person_id or
  new.allocated_at is distinct from old.allocated_at or new.demand_revision_at_allocation is distinct from old.demand_revision_at_allocation or
  new.revision<>old.revision+1 or old.status in ('DECLINED','CANCELLED') then raise exception 'Static allocation identity cannot change'; end if;
 return new;
end $$;
