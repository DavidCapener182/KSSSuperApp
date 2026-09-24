-- STAFF_DECLARED is an immutable submission provenance, never an Office decision method.
alter table public.credential_decisions_16b drop constraint credential_decisions_16b_method_check;
alter table public.credential_decisions_16b add constraint credential_decisions_16b_method_check
 check (method='OFFICE_CHECKED_EVIDENCE');
