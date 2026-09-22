-- TASK-01D synthetic-only access fixtures. DML only; no schema change.
-- Requires confirmed Supabase Auth users in the dedicated KSS Enterprise Dev project.
-- The unmapped Auth user deliberately has no Person or AuthIdentity row.
insert into public.people (id, display_name) values
  ('10000000-0000-4000-8000-000000000007', 'Synthetic Operations'),
  ('10000000-0000-4000-8000-000000000008', 'Synthetic Security Staff Zero Sites')
on conflict (id) do nothing;

insert into public.auth_identities (person_id, provider, provider_subject)
select mapping.person_id, 'supabase', users.id::text
from (values
  ('10000000-0000-4000-8000-000000000007'::uuid, 'kss01d.operations@example.test'),
  ('10000000-0000-4000-8000-000000000008'::uuid, 'kss01d.staff-zero@example.test')
) as mapping(person_id, email)
join auth.users users on users.email = mapping.email
on conflict (person_id, provider) do update
  set provider_subject = excluded.provider_subject, active = true;

insert into public.role_assignments (id, person_id, role_code, effective_from, effective_until) values
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007', 'OPERATIONS', now() - interval '1 day', null),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000008', 'SECURITY_STAFF', now() - interval '1 day', null)
on conflict (id) do nothing;
