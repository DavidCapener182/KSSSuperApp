-- TASK-03B review fix: value equality alone cannot prove no intervening required edit.
alter table public.person_profiles add column required_change_seq bigint not null default 0;
alter table public.person_profile_revisions add column required_change_seq bigint not null default 0;
alter table public.person_sia_credentials add column credential_change_seq bigint not null default 0;
alter table public.person_sia_credential_revisions add column credential_change_seq bigint not null default 0;

create function private.track_profile_required_changes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.required_change_seq:=1;
  elsif old.legal_first_name is distinct from new.legal_first_name
    or old.surname is distinct from new.surname
    or old.contact_email is distinct from new.contact_email
    or old.mobile is distinct from new.mobile
    or old.address_line1 is distinct from new.address_line1
    or old.town_city is distinct from new.town_city
    or old.postcode is distinct from new.postcode then
    new.required_change_seq:=old.required_change_seq+1;
  else new.required_change_seq:=old.required_change_seq;
  end if;
  return new;
end;
$$;
create trigger track_profile_required_changes before insert or update on public.person_profiles
  for each row execute function private.track_profile_required_changes();

create function private.track_sia_credential_changes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then new.credential_change_seq:=1;
  elsif old.synthetic_reference is distinct from new.synthetic_reference
    or old.expires_on is distinct from new.expires_on then
    new.credential_change_seq:=old.credential_change_seq+1;
  else new.credential_change_seq:=old.credential_change_seq;
  end if;
  return new;
end;
$$;
create trigger track_sia_credential_changes before insert or update on public.person_sia_credentials
  for each row execute function private.track_sia_credential_changes();

create function private.capture_profile_submission_sequence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.required_change_seq:=(select required_change_seq from public.person_profiles
    where person_id=new.person_id);
  if new.required_change_seq is null then raise exception 'Profile source missing'; end if;
  return new;
end;
$$;
create trigger capture_profile_submission_sequence before insert on public.person_profile_revisions
  for each row execute function private.capture_profile_submission_sequence();

create function private.capture_sia_submission_sequence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.credential_change_seq:=(select credential_change_seq from public.person_sia_credentials
    where id=new.credential_id and person_id=new.person_id and category=new.category);
  if new.credential_change_seq is null then raise exception 'Credential source missing'; end if;
  return new;
end;
$$;
create trigger capture_sia_submission_sequence before insert on public.person_sia_credential_revisions
  for each row execute function private.capture_sia_submission_sequence();
