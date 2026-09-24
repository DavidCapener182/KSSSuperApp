-- TASK-19A: invoker RLS policies need EXECUTE on their guarded boolean helper.
grant execute on function private.can_operational_document(text) to authenticated;
