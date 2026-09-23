-- TASK-03G synthetic staging foundation. DML only; no credentials or real data.
-- Apply only to KSS Enterprise - Staging (kwpgjbxepxuhwxxydaca) after its
-- four kss-stage.*@example.test Supabase Auth users have been created.
-- Sites, assignments and onboarding/evidence decisions occur through guarded app workflows.
do $$ begin
  if (select count(*) from auth.users) = 4 and
    (select count(*) from auth.users where email in (
      'kss-stage.admin@example.test', 'kss-stage.office@example.test',
      'kss-stage.staff@example.test', 'kss-stage.operations@example.test')) = 4 then

insert into public.people(id,display_name) values
  ('10000000-0000-4000-8000-000000000001','Synthetic Super Admin'),
  ('10000000-0000-4000-8000-000000000002','Synthetic Office Admin'),
  ('10000000-0000-4000-8000-000000000003','Synthetic Security Staff A'),
  ('10000000-0000-4000-8000-000000000007','Synthetic Operations')
on conflict (id) do nothing;

insert into public.auth_identities(person_id,provider,provider_subject)
select mapping.person_id::uuid,'supabase',u.id::text
from (values
  ('kss-stage.admin@example.test','10000000-0000-4000-8000-000000000001'),
  ('kss-stage.office@example.test','10000000-0000-4000-8000-000000000002'),
  ('kss-stage.staff@example.test','10000000-0000-4000-8000-000000000003'),
  ('kss-stage.operations@example.test','10000000-0000-4000-8000-000000000007')
) mapping(email,person_id) join auth.users u on u.email=mapping.email
on conflict (person_id,provider) do nothing;

insert into public.role_assignments(id,person_id,role_code,effective_from,granted_by) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','SUPER_ADMIN',now()-interval '1 day','10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','OFFICE_ADMIN',now()-interval '1 day','10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','SECURITY_STAFF',now()-interval '1 day','10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000007','OPERATIONS',now()-interval '1 day','10000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

  elsif (select count(*) from auth.users where email like 'kss-stage.%@example.test') = 0 then
    -- Other KSS environments record this migration without receiving staging fixtures.
    null;
  else
    raise exception 'Incomplete or mixed synthetic staging Auth users';
  end if;
end $$;
