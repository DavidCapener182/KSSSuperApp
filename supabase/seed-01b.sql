-- Synthetic TASK-01B development fixtures for the dedicated KSS Enterprise project.
-- Run only after creating the four kss01b.*@example.test Auth accounts.
-- No credentials are stored here. Idempotent so access checks can be repeated.
insert into public.people (id, display_name) values
  ('10000000-0000-4000-8000-000000000001', 'Synthetic Super Admin'),
  ('10000000-0000-4000-8000-000000000002', 'Synthetic Office Admin'),
  ('10000000-0000-4000-8000-000000000003', 'Synthetic Security Staff A'),
  ('10000000-0000-4000-8000-000000000004', 'Synthetic Security Staff B'),
  ('10000000-0000-4000-8000-000000000005', 'Synthetic Expired Staff')
on conflict (id) do nothing;

insert into public.auth_identities (person_id, provider, provider_subject)
select mapping.person_id::uuid, 'supabase', users.id::text
from (values
  ('kss01b.admin@example.test', '10000000-0000-4000-8000-000000000001'),
  ('kss01b.office@example.test', '10000000-0000-4000-8000-000000000002'),
  ('kss01b.staff-a@example.test', '10000000-0000-4000-8000-000000000003'),
  ('kss01b.staff-b@example.test', '10000000-0000-4000-8000-000000000004')
) as mapping(email, person_id)
join auth.users users on users.email = mapping.email
on conflict (provider, provider_subject) do nothing;

insert into public.role_assignments (id, person_id, role_code, effective_from, effective_until) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'SUPER_ADMIN', now() - interval '1 day', null),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'OFFICE_ADMIN', now() - interval '1 day', null),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'SECURITY_STAFF', now() - interval '1 day', null),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'SECURITY_STAFF', now() - interval '1 day', null),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'SECURITY_STAFF', now() - interval '2 days', now() - interval '1 day')
on conflict (id) do nothing;

insert into public.sites (id, name) values
  ('30000000-0000-4000-8000-000000000001', 'Synthetic Site A'),
  ('30000000-0000-4000-8000-000000000002', 'Synthetic Site B')
on conflict (id) do nothing;

insert into public.site_assignments (id, person_id, site_id, effective_from, effective_until) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', now() - interval '1 day', null),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000002', now() - interval '1 day', null),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', now() - interval '2 days', now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', now() - interval '1 day', null)
on conflict (id) do nothing;
