-- Synthetic TASK-01C Office B identity for creator-scope negative tests.
-- Requires the confirmed kss01c.office-b@example.test Supabase Auth account.
insert into public.people (id, display_name) values
  ('10000000-0000-4000-8000-000000000006', 'Synthetic Office Admin B')
on conflict (id) do nothing;

insert into public.auth_identities (person_id, provider, provider_subject)
select '10000000-0000-4000-8000-000000000006', 'supabase', users.id::text
from auth.users users where users.email = 'kss01c.office-b@example.test'
on conflict (person_id, provider) do update
  set provider_subject = excluded.provider_subject, active = true;

insert into public.role_assignments (id, person_id, role_code, effective_from, effective_until)
values ('20000000-0000-4000-8000-000000000006',
  '10000000-0000-4000-8000-000000000006', 'OFFICE_ADMIN', now() - interval '1 day', null)
on conflict (id) do nothing;
