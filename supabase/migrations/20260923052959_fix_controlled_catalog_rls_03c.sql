-- TASK-03C forward fix: correlate Staff assignment policies to outer catalog rows.
drop policy controlled_documents_read on public.controlled_documents;
create policy controlled_documents_read on public.controlled_documents for select to authenticated using (
  private.has_active_role('SUPER_ADMIN') or
  (created_by_person_id=private.current_person_id() and private.can_publish_controlled(family)) or
  exists(select 1 from public.onboarding_controlled_assignments a
    where a.document_id=public.controlled_documents.id and private.can_read_controlled_assignment(a.id)));
drop policy controlled_versions_read on public.controlled_document_versions;
create policy controlled_versions_read on public.controlled_document_versions for select to authenticated using (
  private.has_active_role('SUPER_ADMIN') or
  exists(select 1 from public.controlled_documents d where d.id=public.controlled_document_versions.document_id
    and d.created_by_person_id=private.current_person_id() and private.can_publish_controlled(d.family)) or
  exists(select 1 from public.onboarding_controlled_assignments a
    where a.version_id=public.controlled_document_versions.id and private.can_read_controlled_assignment(a.id)));
