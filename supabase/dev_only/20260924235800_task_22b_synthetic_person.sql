-- TASK-22B synthetic Dev only; do not apply to protected Staging or production.
-- This Person has no AuthIdentity and contains no real KSS contact details.
do $$
declare synthetic_person uuid;
begin
 insert into public.people(display_name) values('TASK-22B Synthetic Operational Person') returning id into synthetic_person;
 insert into public.person_profiles(person_id,contact_email,mobile)
 values(synthetic_person,'task-22b-person@example.test','+441234567899');
 insert into public.role_assignments(person_id,role_code,effective_from)
 values(synthetic_person,'OPERATIONS',transaction_timestamp());
end $$;
