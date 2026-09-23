-- TASK-03B: synthetic Staff profile and SIA credential proof. No live data or licence assertion.
alter table public.onboarding_requirement_definitions drop constraint onboarding_requirement_definitions_fulfilment_kind_check;
alter table public.onboarding_requirement_definitions add constraint onboarding_requirement_definitions_fulfilment_kind_check
  check (fulfilment_kind in ('NOT_CONFIGURED','PRIVATE_DOCUMENT','CONTROLLED_ACKNOWLEDGEMENT',
    'TRAINING_PROVIDER','PROFILE_SUBMISSION','SIA_CREDENTIAL'));
alter table public.onboarding_requirement_definitions add column expected_sia_category text
  check (expected_sia_category is null or (code = 'SIA_LICENCE' and expected_sia_category = 'SECURITY_GUARDING'));

create table public.person_profiles (
  person_id uuid primary key references public.people(id),
  legal_first_name text, surname text, preferred_name text, contact_email text, mobile text,
  address_line1 text, address_line2 text, town_city text, postcode text,
  updated_at timestamptz not null default now(),
  check (length(coalesce(legal_first_name,'')) <= 80 and length(coalesce(surname,'')) <= 80
    and length(coalesce(preferred_name,'')) <= 80 and length(coalesce(contact_email,'')) <= 254
    and length(coalesce(mobile,'')) <= 24 and length(coalesce(address_line1,'')) <= 160
    and length(coalesce(address_line2,'')) <= 160 and length(coalesce(town_city,'')) <= 100
    and length(coalesce(postcode,'')) <= 12)
);
create table public.person_profile_revisions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  submitted_by_person_id uuid not null references public.people(id),
  submitted_at timestamptz not null default now(),
  legal_first_name text not null, surname text not null, preferred_name text,
  contact_email text not null, mobile text not null, address_line1 text not null,
  address_line2 text, town_city text not null, postcode text not null,
  changed_fields text[] not null default array[]::text[]
);
create index person_profile_revisions_person_at_idx on public.person_profile_revisions(person_id,submitted_at desc);
create table public.onboarding_profile_submissions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.onboarding_cases(id),
  requirement_id uuid not null references public.onboarding_case_requirements(id),
  person_id uuid not null references public.people(id),
  revision_id uuid not null unique references public.person_profile_revisions(id),
  request_key uuid not null,
  submitted_at timestamptz not null default now(),
  unique (requirement_id,request_key)
);
create index onboarding_profile_submissions_req_at_idx on public.onboarding_profile_submissions(requirement_id,submitted_at desc);

create table public.person_sia_credentials (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  category text not null check (category in ('SECURITY_GUARDING','DOOR_SUPERVISION','PUBLIC_SPACE_SURVEILLANCE_CCTV')),
  synthetic_reference text check (synthetic_reference is null or synthetic_reference ~ '^SYN-SIA-[A-Z0-9-]{3,40}$'),
  expires_on date,
  updated_at timestamptz not null default now(),
  unique(person_id,category)
);
create table public.person_sia_credential_revisions (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.person_sia_credentials(id),
  person_id uuid not null references public.people(id),
  category text not null check (category in ('SECURITY_GUARDING','DOOR_SUPERVISION','PUBLIC_SPACE_SURVEILLANCE_CCTV')),
  synthetic_reference text not null check (synthetic_reference ~ '^SYN-SIA-[A-Z0-9-]{3,40}$'),
  expires_on date not null,
  submitted_by_person_id uuid not null references public.people(id),
  submitted_at timestamptz not null default now()
);
create index sia_revisions_person_at_idx on public.person_sia_credential_revisions(person_id,submitted_at desc);
create table public.onboarding_sia_submissions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.onboarding_cases(id),
  requirement_id uuid not null references public.onboarding_case_requirements(id),
  person_id uuid not null references public.people(id),
  revision_id uuid not null unique references public.person_sia_credential_revisions(id),
  document_request_id uuid unique references public.document_requests(id),
  request_key uuid not null,
  submitted_at timestamptz not null default now(),
  unique(requirement_id,request_key)
);
create index onboarding_sia_submissions_req_at_idx on public.onboarding_sia_submissions(requirement_id,submitted_at desc);

alter table public.onboarding_requirement_verifications add column sia_submission_id uuid
  references public.onboarding_sia_submissions(id);
create unique index onboarding_sia_verification_submission_idx on public.onboarding_requirement_verifications(sia_submission_id)
  where sia_submission_id is not null;

alter table public.person_profiles enable row level security;
alter table public.person_profile_revisions enable row level security;
alter table public.onboarding_profile_submissions enable row level security;
alter table public.person_sia_credentials enable row level security;
alter table public.person_sia_credential_revisions enable row level security;
alter table public.onboarding_sia_submissions enable row level security;
revoke all on public.person_profiles,public.person_profile_revisions,public.onboarding_profile_submissions,
  public.person_sia_credentials,public.person_sia_credential_revisions,public.onboarding_sia_submissions
  from public,anon,authenticated;
grant select on public.person_profiles,public.person_profile_revisions,public.onboarding_profile_submissions,
  public.person_sia_credentials,public.person_sia_credential_revisions,public.onboarding_sia_submissions to authenticated;

create function private.office_manages_onboarding_person(target_person uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_active_role('OFFICE_ADMIN') and exists (
    select 1 from public.onboarding_cases c where c.person_id=target_person
      and c.owner_person_id=private.current_person_id())
$$;
revoke all on function private.office_manages_onboarding_person(uuid) from public,anon,authenticated;
grant execute on function private.office_manages_onboarding_person(uuid) to authenticated;
create policy person_profiles_read on public.person_profiles for select to authenticated using (
  (person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
  or private.has_active_role('SUPER_ADMIN') or private.office_manages_onboarding_person(person_id));
create policy person_profile_revisions_read on public.person_profile_revisions for select to authenticated using (
  (person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
  or private.has_active_role('SUPER_ADMIN') or exists (
    select 1 from public.onboarding_profile_submissions s join public.onboarding_cases c on c.id=s.case_id
    where s.revision_id=public.person_profile_revisions.id and c.owner_person_id=private.current_person_id()
      and private.has_active_role('OFFICE_ADMIN')));
create policy onboarding_profile_submissions_read on public.onboarding_profile_submissions for select to authenticated
  using (private.onboarding_case_readable(case_id));
create policy person_sia_credentials_read on public.person_sia_credentials for select to authenticated using (
  (person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
  or private.has_active_role('SUPER_ADMIN') or private.office_manages_onboarding_person(person_id));
create policy sia_revisions_read on public.person_sia_credential_revisions for select to authenticated using (
  (person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
  or private.has_active_role('SUPER_ADMIN') or exists (
    select 1 from public.onboarding_sia_submissions s join public.onboarding_cases c on c.id=s.case_id
    where s.revision_id=public.person_sia_credential_revisions.id and c.owner_person_id=private.current_person_id()
      and private.has_active_role('OFFICE_ADMIN')));
create policy onboarding_sia_submissions_read on public.onboarding_sia_submissions for select to authenticated
  using (private.onboarding_case_readable(case_id));

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check
  (entity_type in ('role_assignment','site_assignment','site','document_request','document_version','document_review','task',
    'onboarding_case','onboarding_requirement','onboarding_verification','person_profile','profile_submission',
    'sia_credential','sia_submission'));
alter table public.audit_events drop constraint audit_events_target_check;
alter table public.audit_events add constraint audit_events_target_check check (
  (entity_type='site' and site_id is not null) or
  (entity_type='site_assignment' and site_id is not null and affected_person_id is not null) or
  (entity_type='role_assignment' and affected_person_id is not null) or
  (entity_type in ('document_request','document_version','document_review','task','onboarding_case',
    'onboarding_requirement','onboarding_verification','person_profile','profile_submission','sia_credential',
    'sia_submission') and affected_person_id is not null)
);

-- A new version is for future cases. V1 rows are never modified.
insert into public.onboarding_template_versions(id,template_id,version_number)
  values('40000000-0000-4000-8000-000000000020','40000000-0000-4000-8000-000000000001',2);
insert into public.onboarding_requirement_definitions
  (id,template_version_id,code,title,position,fulfilment_kind,provider_state,initial_actor,expected_sia_category)
values
  ('40000000-0000-4000-8000-000000000021','40000000-0000-4000-8000-000000000020','PERSONAL_DETAILS','Personal details',1,'PROFILE_SUBMISSION','AVAILABLE','STAFF',null),
  ('40000000-0000-4000-8000-000000000022','40000000-0000-4000-8000-000000000020','RIGHT_TO_WORK','Right to Work',2,'PRIVATE_DOCUMENT','AVAILABLE','STAFF',null),
  ('40000000-0000-4000-8000-000000000023','40000000-0000-4000-8000-000000000020','SIA_LICENCE','SIA licence',3,'SIA_CREDENTIAL','AVAILABLE','STAFF','SECURITY_GUARDING'),
  ('40000000-0000-4000-8000-000000000024','40000000-0000-4000-8000-000000000020','IDENTITY_EVIDENCE','Identity evidence',4,'NOT_CONFIGURED','NOT_CONFIGURED','STAFF',null),
  ('40000000-0000-4000-8000-000000000025','40000000-0000-4000-8000-000000000020','CONTRACT_TERMS','Contract / terms acknowledgement',5,'CONTROLLED_ACKNOWLEDGEMENT','NOT_AVAILABLE','STAFF',null),
  ('40000000-0000-4000-8000-000000000026','40000000-0000-4000-8000-000000000020','CORE_KSS_INDUCTION','Core KSS induction',6,'TRAINING_PROVIDER','NOT_CONNECTED','EXTERNAL_PROVIDER',null);
update public.onboarding_template_versions set published_at=now()
  where id='40000000-0000-4000-8000-000000000020';

create function private.uk_today() returns date
language sql stable security definer set search_path='' as $$
  select (now() at time zone 'Europe/London')::date
$$;
revoke all on function private.uk_today() from public,anon,authenticated;

create function private.valid_profile_field(value text, max_length integer) returns boolean
language sql immutable security definer set search_path='' as $$
  select value is null or (length(value) between 1 and max_length and value !~ '[[:cntrl:]]')
$$;
revoke all on function private.valid_profile_field(text,integer) from public,anon,authenticated;
create function private.profile_complete(p public.person_profiles) returns boolean
language sql stable security definer set search_path='' as $$
  select p.legal_first_name is not null and p.surname is not null and p.contact_email is not null
    and p.mobile is not null and p.address_line1 is not null and p.town_city is not null
    and p.postcode is not null
$$;
revoke all on function private.profile_complete(public.person_profiles) from public,anon,authenticated;

create function private.guard_03b_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; pr public.person_profile_revisions%rowtype;
  sr public.person_sia_credential_revisions%rowtype; req public.document_requests%rowtype;
begin
  if tg_op='DELETE' then raise exception 'Submitted history cannot be deleted'; end if;
  if tg_table_name in ('person_profile_revisions','person_sia_credential_revisions') then
    if tg_op='UPDATE' then raise exception 'Submitted revision is immutable'; end if;
    if new.person_id<>new.submitted_by_person_id or new.submitted_by_person_id is distinct from private.current_person_id()
      or not private.has_active_role('SECURITY_STAFF') then raise exception 'Submitted revision denied'; end if;
    return new;
  end if;
  if tg_table_name='onboarding_profile_submissions' then
    if tg_op='UPDATE' then raise exception 'Profile submission is immutable'; end if;
    select * into c from public.onboarding_cases where id=new.case_id;
    select * into cr from public.onboarding_case_requirements where id=new.requirement_id;
    select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
    select * into pr from public.person_profile_revisions where id=new.revision_id;
    if c.id is null or c.state<>'IN_PROGRESS' or c.person_id<>private.current_person_id()
      or not private.has_active_role('SECURITY_STAFF') or cr.case_id<>c.id or d.code<>'PERSONAL_DETAILS'
      or d.provider_state<>'AVAILABLE' or pr.person_id<>c.person_id then
      raise exception 'Profile submission source denied'; end if;
    return new;
  end if;
  if tg_table_name='onboarding_sia_submissions' then
    if tg_op='UPDATE' then
      if old.document_request_id is not null or new.document_request_id is null
        or new.id<>old.id or new.case_id<>old.case_id or new.requirement_id<>old.requirement_id
        or new.person_id<>old.person_id or new.revision_id<>old.revision_id
        or new.request_key<>old.request_key or new.submitted_at<>old.submitted_at then
        raise exception 'SIA submission is immutable'; end if;
      select * into c from public.onboarding_cases where id=old.case_id;
      select * into req from public.document_requests where id=new.document_request_id;
      if c.state<>'IN_PROGRESS' or req.id is null or req.target_person_id<>c.person_id
        or req.requester_person_id<>c.owner_person_id or req.site_id is distinct from c.site_id
        or private.current_person_id()<>c.owner_person_id or not private.has_active_role('OFFICE_ADMIN')
      then raise exception 'SIA evidence link denied'; end if;
      return new;
    end if;
    select * into c from public.onboarding_cases where id=new.case_id;
    select * into cr from public.onboarding_case_requirements where id=new.requirement_id;
    select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
    select * into sr from public.person_sia_credential_revisions where id=new.revision_id;
    if c.id is null or c.state<>'IN_PROGRESS' or c.person_id<>private.current_person_id()
      or not private.has_active_role('SECURITY_STAFF') or cr.case_id<>c.id or d.code<>'SIA_LICENCE'
      or d.provider_state<>'AVAILABLE' or sr.person_id<>c.person_id
      or sr.category<>d.expected_sia_category or new.document_request_id is not null
    then raise exception 'SIA submission source denied'; end if;
    return new;
  end if;
  raise exception 'Unsupported history operation';
end;
$$;
revoke all on function private.guard_03b_history() from public,anon,authenticated;
create trigger guard_profile_revision_03b before insert or update or delete on public.person_profile_revisions
  for each row execute function private.guard_03b_history();
create trigger guard_profile_submission_03b before insert or update or delete on public.onboarding_profile_submissions
  for each row execute function private.guard_03b_history();
create trigger guard_sia_revision_03b before insert or update or delete on public.person_sia_credential_revisions
  for each row execute function private.guard_03b_history();
create trigger guard_sia_submission_03b before insert or update or delete on public.onboarding_sia_submissions
  for each row execute function private.guard_03b_history();

create function public.save_person_profile(
  supplied_first text,supplied_surname text,supplied_preferred text,supplied_email text,
  supplied_mobile text,supplied_address1 text,supplied_address2 text,supplied_town text,supplied_postcode text
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; p public.person_profiles%rowtype; first_name text; family_name text; preferred text;
  email text; phone text; address1 text; address2 text; town text; postal text; changed text[];
begin
  actor:=private.current_person_id();
  if actor is null or not private.has_active_role('SECURITY_STAFF') then raise exception 'Profile edit denied'; end if;
  first_name:=nullif(trim(supplied_first),''); family_name:=nullif(trim(supplied_surname),'');
  preferred:=nullif(trim(supplied_preferred),''); email:=nullif(lower(trim(supplied_email)),'');
  phone:=nullif(trim(supplied_mobile),''); address1:=nullif(trim(supplied_address1),'');
  address2:=nullif(trim(supplied_address2),''); town:=nullif(trim(supplied_town),'');
  postal:=nullif(upper(regexp_replace(trim(supplied_postcode),'[[:space:]]+',' ','g')),'');
  if postal is not null and postal !~ ' ' and length(postal)>3 then
    postal:=left(postal,length(postal)-3)||' '||right(postal,3); end if;
  if not private.valid_profile_field(first_name,80) or not private.valid_profile_field(family_name,80)
    or not private.valid_profile_field(preferred,80) or not private.valid_profile_field(email,254)
    or not private.valid_profile_field(phone,24) or not private.valid_profile_field(address1,160)
    or not private.valid_profile_field(address2,160) or not private.valid_profile_field(town,100)
    or not private.valid_profile_field(postal,12)
    or (email is not null and email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
    or (phone is not null and phone !~ '^[+]?[0-9 ()-]{7,24}$')
    or (postal is not null and postal !~ '^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2}$')
  then raise exception 'Profile validation failed'; end if;
  select * into p from public.person_profiles where person_id=actor for update;
  changed:=array_remove(array[
    case when p.legal_first_name is distinct from first_name then 'legal_first_name' end,
    case when p.surname is distinct from family_name then 'surname' end,
    case when p.preferred_name is distinct from preferred then 'preferred_name' end,
    case when p.contact_email is distinct from email then 'contact_email' end,
    case when p.mobile is distinct from phone then 'mobile' end,
    case when p.address_line1 is distinct from address1 then 'address_line1' end,
    case when p.address_line2 is distinct from address2 then 'address_line2' end,
    case when p.town_city is distinct from town then 'town_city' end,
    case when p.postcode is distinct from postal then 'postcode' end],null);
  if p.person_id is null then
    insert into public.person_profiles(person_id,legal_first_name,surname,preferred_name,contact_email,mobile,
      address_line1,address_line2,town_city,postcode)
      values(actor,first_name,family_name,preferred,email,phone,address1,address2,town,postal);
  elsif cardinality(changed)>0 then
    update public.person_profiles set legal_first_name=first_name,surname=family_name,preferred_name=preferred,
      contact_email=email,mobile=phone,address_line1=address1,address_line2=address2,town_city=town,
      postcode=postal,updated_at=now() where person_id=actor;
  else return actor; end if;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,actor,'person_profile',actor,case when p.person_id is null then 'INSERT' else 'UPDATE' end,
      jsonb_build_object('changed_fields',changed));
  return actor;
end;
$$;
revoke all on function public.save_person_profile(text,text,text,text,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.save_person_profile(text,text,text,text,text,text,text,text,text) to authenticated;

create function public.submit_onboarding_profile(requested_case uuid,supplied_request_key uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  p public.person_profiles%rowtype; prior public.person_profile_revisions%rowtype;
  existing uuid; revision_id uuid; submission_id uuid; changed text[];
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if actor is null or supplied_request_key is null or c.id is null or c.state<>'IN_PROGRESS'
    or c.person_id<>actor or not private.has_active_role('SECURITY_STAFF')
  then raise exception 'Profile submission denied'; end if;
  select cr.* into cr from public.onboarding_case_requirements cr
    join public.onboarding_requirement_definitions d on d.id=cr.definition_id
    where cr.case_id=c.id and d.code='PERSONAL_DETAILS' and d.provider_state='AVAILABLE';
  if cr.id is null then raise exception 'Profile requirement unavailable'; end if;
  select id into existing from public.onboarding_profile_submissions
    where requirement_id=cr.id and request_key=supplied_request_key;
  if existing is not null then return existing; end if;
  select * into p from public.person_profiles where person_id=actor for update;
  if p.person_id is null or not private.profile_complete(p) then raise exception 'Required Personal Details missing'; end if;
  select r.* into prior from public.person_profile_revisions r
    join public.onboarding_profile_submissions s on s.revision_id=r.id
    where s.requirement_id=cr.id order by s.submitted_at desc,s.id desc limit 1;
  changed:=array_remove(array[
    case when prior.legal_first_name is distinct from p.legal_first_name then 'legal_first_name' end,
    case when prior.surname is distinct from p.surname then 'surname' end,
    case when prior.preferred_name is distinct from p.preferred_name then 'preferred_name' end,
    case when prior.contact_email is distinct from p.contact_email then 'contact_email' end,
    case when prior.mobile is distinct from p.mobile then 'mobile' end,
    case when prior.address_line1 is distinct from p.address_line1 then 'address_line1' end,
    case when prior.address_line2 is distinct from p.address_line2 then 'address_line2' end,
    case when prior.town_city is distinct from p.town_city then 'town_city' end,
    case when prior.postcode is distinct from p.postcode then 'postcode' end],null);
  insert into public.person_profile_revisions(person_id,submitted_by_person_id,legal_first_name,surname,
    preferred_name,contact_email,mobile,address_line1,address_line2,town_city,postcode,changed_fields)
    values(actor,actor,p.legal_first_name,p.surname,p.preferred_name,p.contact_email,p.mobile,
      p.address_line1,p.address_line2,p.town_city,p.postcode,changed) returning id into revision_id;
  insert into public.onboarding_profile_submissions(case_id,requirement_id,person_id,revision_id,request_key)
    values(c.id,cr.id,actor,revision_id,supplied_request_key) returning id into submission_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,actor,'profile_submission',submission_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',cr.id,'revision_id',revision_id,'changed_fields',changed));
  return submission_id;
end;
$$;
revoke all on function public.submit_onboarding_profile(uuid,uuid) from public,anon,authenticated;
grant execute on function public.submit_onboarding_profile(uuid,uuid) to authenticated;

create function public.save_person_sia_credential(supplied_category text,supplied_reference text,supplied_expiry date)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; current_row public.person_sia_credentials%rowtype; clean_reference text; result_id uuid;
  changed text[];
begin
  actor:=private.current_person_id();
  clean_reference:=nullif(upper(trim(supplied_reference)),'');
  if actor is null or not private.has_active_role('SECURITY_STAFF')
    or supplied_category not in ('SECURITY_GUARDING','DOOR_SUPERVISION','PUBLIC_SPACE_SURVEILLANCE_CCTV')
    or (clean_reference is not null and clean_reference !~ '^SYN-SIA-[A-Z0-9-]{3,40}$')
  then raise exception 'SIA draft denied'; end if;
  select * into current_row from public.person_sia_credentials
    where person_id=actor and category=supplied_category for update;
  if current_row.id is null then
    insert into public.person_sia_credentials(person_id,category,synthetic_reference,expires_on)
      values(actor,supplied_category,clean_reference,supplied_expiry) returning id into result_id;
    changed:=array['category','synthetic_reference','expires_on'];
  else
    result_id:=current_row.id;
    changed:=array_remove(array[
      case when current_row.synthetic_reference is distinct from clean_reference then 'synthetic_reference' end,
      case when current_row.expires_on is distinct from supplied_expiry then 'expires_on' end],null);
    if cardinality(changed)=0 then return result_id; end if;
    update public.person_sia_credentials set synthetic_reference=clean_reference,expires_on=supplied_expiry,
      updated_at=now() where id=result_id;
  end if;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,actor,'sia_credential',result_id,case when current_row.id is null then 'INSERT' else 'UPDATE' end,
      jsonb_build_object('changed_fields',changed,'synthetic',true));
  return result_id;
end;
$$;
revoke all on function public.save_person_sia_credential(text,text,date) from public,anon,authenticated;
grant execute on function public.save_person_sia_credential(text,text,date) to authenticated;

create function public.submit_onboarding_sia(requested_case uuid,supplied_request_key uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  expected text; current_row public.person_sia_credentials%rowtype; existing uuid;
  revision_id uuid; submission_id uuid;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if actor is null or supplied_request_key is null or c.id is null or c.state<>'IN_PROGRESS'
    or c.person_id<>actor or not private.has_active_role('SECURITY_STAFF')
  then raise exception 'SIA submission denied'; end if;
  select cr.* into cr from public.onboarding_case_requirements cr
    join public.onboarding_requirement_definitions d on d.id=cr.definition_id
    where cr.case_id=c.id and d.code='SIA_LICENCE' and d.provider_state='AVAILABLE';
  select expected_sia_category into expected from public.onboarding_requirement_definitions where id=cr.definition_id;
  if cr.id is null or expected is null then raise exception 'SIA requirement unavailable'; end if;
  select id into existing from public.onboarding_sia_submissions
    where requirement_id=cr.id and request_key=supplied_request_key;
  if existing is not null then return existing; end if;
  select * into current_row from public.person_sia_credentials
    where person_id=actor and category=expected for update;
  if current_row.id is null or current_row.synthetic_reference is null or current_row.expires_on is null
  then raise exception 'SIA details incomplete'; end if;
  insert into public.person_sia_credential_revisions(credential_id,person_id,category,synthetic_reference,
    expires_on,submitted_by_person_id)
    values(current_row.id,actor,current_row.category,current_row.synthetic_reference,
      current_row.expires_on,actor) returning id into revision_id;
  insert into public.onboarding_sia_submissions(case_id,requirement_id,person_id,revision_id,request_key)
    values(c.id,cr.id,actor,revision_id,supplied_request_key) returning id into submission_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,actor,'sia_submission',submission_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',cr.id,'revision_id',revision_id,'synthetic',true));
  return submission_id;
end;
$$;
revoke all on function public.submit_onboarding_sia(uuid,uuid) from public,anon,authenticated;
grant execute on function public.submit_onboarding_sia(uuid,uuid) to authenticated;

create function public.issue_onboarding_sia_request(requested_case uuid,requested_submission uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; s public.onboarding_sia_submissions%rowtype;
  latest_id uuid; created_request uuid;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or c.state<>'IN_PROGRESS' or actor is null or actor=c.person_id
    or actor<>c.owner_person_id or not private.has_active_role('OFFICE_ADMIN')
  then raise exception 'SIA request denied'; end if;
  select id into latest_id from public.onboarding_sia_submissions where case_id=c.id
    order by submitted_at desc,id desc limit 1;
  select * into s from public.onboarding_sia_submissions where id=requested_submission
    and case_id=c.id for update;
  if s.id is null or s.id<>latest_id then raise exception 'SIA submission stale'; end if;
  if s.document_request_id is not null then return s.document_request_id; end if;
  created_request:=public.create_document_request(c.person_id,c.site_id,
    'Synthetic onboarding SIA evidence');
  update public.onboarding_sia_submissions set document_request_id=created_request where id=s.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'sia_submission',s.id,'UPDATE',
      jsonb_build_object('case_id',c.id,'requirement_id',s.requirement_id,
        'document_request_id',created_request,'synthetic',true));
  return created_request;
end;
$$;
revoke all on function public.issue_onboarding_sia_request(uuid,uuid) from public,anon,authenticated;
grant execute on function public.issue_onboarding_sia_request(uuid,uuid) to authenticated;

create or replace function private.guard_onboarding_verification() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; v public.document_versions%rowtype;
  doc public.documents%rowtype; rev public.document_reviews%rowtype;
  s public.onboarding_sia_submissions%rowtype; sr public.person_sia_credential_revisions%rowtype;
  current_credential public.person_sia_credentials%rowtype;
begin
  if tg_op<>'INSERT' then raise exception 'Onboarding verification is immutable'; end if;
  select * into c from public.onboarding_cases where id=new.case_id;
  select * into cr from public.onboarding_case_requirements where id=new.requirement_id;
  select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
  select * into v from public.document_versions where id=new.evidence_version_id;
  select * into doc from public.documents where id=v.document_id;
  select * into rev from public.document_reviews where version_id=v.id;
  if c.id is null or c.state<>'IN_PROGRESS' or cr.case_id<>c.id
    or new.target_person_id<>c.person_id or new.verifier_person_id=c.person_id
    or new.verifier_person_id is distinct from private.current_person_id()
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id=new.verifier_person_id))
    or v.id is null or v.upload_state<>'SUBMITTED' or doc.classification<>'PERSONNEL_PRIVATE'
    or rev.decision<>'ACCEPTED_AS_EVIDENCE' or new.decision<>'VERIFIED'
    or exists(select 1 from public.document_versions later where later.document_id=v.document_id
      and later.upload_state='SUBMITTED' and later.version_number>v.version_number)
  then raise exception 'Onboarding verification source denied'; end if;
  if d.code='RIGHT_TO_WORK' then
    if new.sia_submission_id is not null or doc.request_id<>cr.document_request_id
      or (new.synthetic_valid_until is not null and new.synthetic_valid_until<=now())
    then raise exception 'RTW verification source denied'; end if;
  elsif d.code='SIA_LICENCE' then
    select * into s from public.onboarding_sia_submissions where id=new.sia_submission_id;
    select * into sr from public.person_sia_credential_revisions where id=s.revision_id;
    select * into current_credential from public.person_sia_credentials where id=sr.credential_id;
    if new.synthetic_valid_until is not null or s.id is null or s.case_id<>c.id or s.requirement_id<>cr.id
      or s.person_id<>c.person_id or s.document_request_id<>doc.request_id
      or sr.person_id<>c.person_id or sr.category<>d.expected_sia_category
      or current_credential.person_id<>c.person_id or current_credential.category<>sr.category
      or current_credential.synthetic_reference is distinct from sr.synthetic_reference
      or current_credential.expires_on is distinct from sr.expires_on
      or sr.expires_on<private.uk_today()
      or exists(select 1 from public.onboarding_sia_submissions newer where newer.requirement_id=cr.id
        and (newer.submitted_at,newer.id)>(s.submitted_at,s.id))
    then raise exception 'SIA verification source denied'; end if;
  else raise exception 'Unsupported requirement verification'; end if;
  return new;
end;
$$;

create function public.verify_onboarding_sia(requested_case uuid,requested_requirement uuid,
  requested_submission uuid,accepted_version uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; cr public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; s public.onboarding_sia_submissions%rowtype;
  sr public.person_sia_credential_revisions%rowtype; current_credential public.person_sia_credentials%rowtype;
  dr public.document_requests%rowtype; doc public.documents%rowtype;
  v public.document_versions%rowtype; rev public.document_reviews%rowtype;
  existing uuid; created_id uuid;
begin
  actor:=private.current_person_id();
  select * into c from public.onboarding_cases where id=requested_case for update;
  if c.id is null or c.state<>'IN_PROGRESS' or actor is null or actor=c.person_id
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id=actor))
  then raise exception 'SIA verification denied'; end if;
  select * into cr from public.onboarding_case_requirements
    where id=requested_requirement and case_id=c.id for update;
  select * into d from public.onboarding_requirement_definitions where id=cr.definition_id;
  select * into s from public.onboarding_sia_submissions
    where id=requested_submission and requirement_id=cr.id;
  select * into sr from public.person_sia_credential_revisions where id=s.revision_id;
  select * into current_credential from public.person_sia_credentials where id=sr.credential_id;
  select * into dr from public.document_requests where id=s.document_request_id;
  select * into doc from public.documents where request_id=dr.id and classification='PERSONNEL_PRIVATE';
  select * into v from public.document_versions where id=accepted_version and document_id=doc.id;
  select * into rev from public.document_reviews where version_id=v.id and request_id=dr.id;
  if cr.id is null or d.code<>'SIA_LICENCE' or d.provider_state<>'AVAILABLE'
    or s.id is null or s.case_id<>c.id or s.person_id<>c.person_id
    or sr.id is null or sr.person_id<>c.person_id or sr.category<>d.expected_sia_category
    or current_credential.id is null or current_credential.person_id<>c.person_id
    or current_credential.synthetic_reference is distinct from sr.synthetic_reference
    or current_credential.expires_on is distinct from sr.expires_on
    or sr.expires_on<private.uk_today() or dr.id is null
    or dr.target_person_id<>c.person_id or dr.requester_person_id<>c.owner_person_id
    or dr.site_id is distinct from c.site_id or doc.id is null
    or v.id is null or v.upload_state<>'SUBMITTED' or rev.decision<>'ACCEPTED_AS_EVIDENCE'
    or exists(select 1 from public.onboarding_sia_submissions newer where newer.requirement_id=cr.id
      and (newer.submitted_at,newer.id)>(s.submitted_at,s.id))
    or exists(select 1 from public.document_versions later where later.document_id=doc.id
      and later.upload_state='SUBMITTED' and later.version_number>v.version_number)
  then raise exception 'SIA verification source denied'; end if;
  select id into existing from public.onboarding_requirement_verifications
    where requirement_id=cr.id and sia_submission_id=s.id;
  if existing is not null then return existing; end if;
  insert into public.onboarding_requirement_verifications(case_id,requirement_id,target_person_id,
    verifier_person_id,evidence_version_id,decision,sia_submission_id)
    values(c.id,cr.id,c.person_id,actor,v.id,'VERIFIED',s.id) returning id into created_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,c.person_id,'onboarding_verification',created_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',cr.id,'sia_submission_id',s.id,
        'credential_revision_id',sr.id,'document_request_id',dr.id,'version_id',v.id,
        'synthetic',true,'super_override',private.has_active_role('SUPER_ADMIN') and actor<>c.owner_person_id));
  return created_id;
end;
$$;
revoke all on function public.verify_onboarding_sia(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.verify_onboarding_sia(uuid,uuid,uuid,uuid) to authenticated;

-- Both 03A RTW links and 03B SIA submission links obey cancellation.
create or replace function private.document_can_submit_request(requested_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.document_requests r join public.documents d on d.request_id=r.id
    where r.id=requested_id and d.classification='PERSONNEL_PRIVATE'
      and r.target_person_id=private.current_person_id()
      and private.has_active_role('SECURITY_STAFF')
      and not exists(select 1 from public.onboarding_case_requirements cr
        join public.onboarding_cases c on c.id=cr.case_id
        where cr.document_request_id=r.id and c.state='CANCELLED')
      and not exists(select 1 from public.onboarding_sia_submissions s
        join public.onboarding_cases c on c.id=s.case_id
        where s.document_request_id=r.id and c.state='CANCELLED')
      and (r.status='REQUESTED' or (r.status='SUBMITTED' and exists (
        select 1 from public.document_versions v
        join public.document_reviews rev on rev.version_id=v.id and rev.decision='REJECTED'
        where v.document_id=d.id and v.upload_state='SUBMITTED'
          and not exists(select 1 from public.document_versions newer where newer.document_id=d.id
            and newer.upload_state='SUBMITTED' and newer.version_number>v.version_number)
      )))
  )
$$;
create or replace function private.guard_cancelled_onboarding_document_review() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.onboarding_case_requirements cr
    join public.onboarding_cases c on c.id=cr.case_id
    where cr.document_request_id=new.request_id and c.state='CANCELLED')
    or exists(select 1 from public.onboarding_sia_submissions s
      join public.onboarding_cases c on c.id=s.case_id
      where s.document_request_id=new.request_id and c.state='CANCELLED')
  then raise exception 'Cancelled onboarding evidence cannot be reviewed'; end if;
  return new;
end;
$$;
