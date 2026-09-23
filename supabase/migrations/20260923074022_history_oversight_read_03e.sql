-- Typed history is read-only to authenticated Super Admin oversight. Ordinary
-- Office and Staff continue to use bounded case/team projections and RPCs.
grant select on public.onboarding_case_owner_changes,public.task_assignment_changes to authenticated;
create policy onboarding_owner_history_super_read on public.onboarding_case_owner_changes
  for select to authenticated using (private.has_active_role('SUPER_ADMIN'));
create policy task_assignment_history_super_read on public.task_assignment_changes
  for select to authenticated using (private.has_active_role('SUPER_ADMIN'));
