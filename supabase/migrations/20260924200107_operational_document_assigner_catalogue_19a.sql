-- TASK-19A: a finite Assigner may select approved operational versions published by another owner.
alter policy controlled_documents_read on public.controlled_documents using (
 private.has_active_role('SUPER_ADMIN') or
 (created_by_person_id=private.current_person_id() and private.can_publish_controlled(family)) or
 (family='OPERATIONAL_SYNTHETIC' and private.can_operational_document('ASSIGN')) or
 exists(select 1 from public.onboarding_controlled_assignments a
  where a.document_id=id and private.can_read_controlled_assignment(a.id))
);
alter policy controlled_versions_read on public.controlled_document_versions using (
 private.has_active_role('SUPER_ADMIN') or
 exists(select 1 from public.controlled_documents d where d.id=document_id and
  ((d.created_by_person_id=private.current_person_id() and private.can_publish_controlled(d.family))
   or (d.family='OPERATIONAL_SYNTHETIC' and private.can_operational_document('ASSIGN')))) or
 exists(select 1 from public.onboarding_controlled_assignments a
  where a.version_id=id and private.can_read_controlled_assignment(a.id))
);
