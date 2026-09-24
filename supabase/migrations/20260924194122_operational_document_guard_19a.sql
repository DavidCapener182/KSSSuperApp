-- TASK-19A: branch on table/operation before inspecting assignment-only columns.
create or replace function private.guard_operational_document_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_19a',true) is distinct from 'allowed' then
  raise exception 'Operational document direct write denied'; end if;
 if tg_op='DELETE' then raise exception 'Operational document history is immutable'; end if;
 if tg_op='UPDATE' then
  if tg_table_name<>'operational_document_assignments' then
   raise exception 'Operational document history is immutable'; end if;
  if new.id is distinct from old.id or new.document_id is distinct from old.document_id
   or new.version_id is distinct from old.version_id or new.target_kind is distinct from old.target_kind
   or new.target_id is distinct from old.target_id or new.context_kind is distinct from old.context_kind
   or new.context_id is distinct from old.context_id or new.required is distinct from old.required
   or new.effective_from is distinct from old.effective_from or new.effective_until is distinct from old.effective_until
   or old.closed_at is not null then raise exception 'Assignment history is immutable'; end if;
 end if;
 return new;
end $$;
