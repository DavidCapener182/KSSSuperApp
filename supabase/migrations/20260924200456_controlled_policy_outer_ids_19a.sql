-- TASK-19A: preserve 03C case-bound reads with explicitly qualified outer IDs.
alter policy controlled_documents_read on public.controlled_documents using (
 private.has_active_role('SUPER_ADMIN') or
 (controlled_documents.created_by_person_id=private.current_person_id()
  and private.can_publish_controlled(controlled_documents.family)) or
 (controlled_documents.family='OPERATIONAL_SYNTHETIC' and private.can_operational_document('ASSIGN')) or
 exists(select 1 from public.onboarding_controlled_assignments a
  where a.document_id=controlled_documents.id and private.can_read_controlled_assignment(a.id))
);
alter policy controlled_versions_read on public.controlled_document_versions using (
 private.has_active_role('SUPER_ADMIN') or
 exists(select 1 from public.controlled_documents d where d.id=controlled_document_versions.document_id and
  ((d.created_by_person_id=private.current_person_id() and private.can_publish_controlled(d.family))
   or (d.family='OPERATIONAL_SYNTHETIC' and private.can_operational_document('ASSIGN')))) or
 exists(select 1 from public.onboarding_controlled_assignments a
  where a.version_id=controlled_document_versions.id and private.can_read_controlled_assignment(a.id))
);
