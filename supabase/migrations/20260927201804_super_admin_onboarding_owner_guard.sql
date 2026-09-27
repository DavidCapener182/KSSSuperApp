-- Keep the exact case lifecycle guard, allowing only an authenticated Super Admin
-- to create a draft for a named active Office member of the selected team.
create or replace function private.guard_onboarding_case() returns trigger
language plpgsql security definer set search_path = '' as $$
declare change_id uuid;
begin
  if tg_op = 'DELETE' then raise exception 'Onboarding case history cannot be deleted'; end if;
  if tg_op = 'INSERT' then
    if new.state <> 'DRAFT' or new.started_at is not null or new.cancelled_at is not null
      or new.person_id = new.owner_person_id
      or new.team_id is null or not private.active_onboarding_team_member(new.team_id, new.owner_person_id)
      or not (new.created_by_person_id = new.owner_person_id
        or (new.created_by_person_id = private.current_person_id()
          and private.has_active_role('SUPER_ADMIN')))
    then raise exception 'Invalid onboarding case'; end if;
    return new;
  end if;
  if new.id <> old.id or new.person_id <> old.person_id or new.intended_role <> old.intended_role
    or new.site_id is distinct from old.site_id or new.template_version_id <> old.template_version_id
    or new.created_by_person_id <> old.created_by_person_id or new.team_id <> old.team_id
    or new.client_request_id <> old.client_request_id or new.created_at <> old.created_at
  then raise exception 'Onboarding case identity is immutable'; end if;
  if new.owner_person_id is distinct from old.owner_person_id then
    if new.state <> old.state or new.started_at is distinct from old.started_at
      or new.cancelled_at is distinct from old.cancelled_at or old.state = 'CANCELLED'
      or not private.active_onboarding_team_member(new.team_id, new.owner_person_id)
    then raise exception 'Onboarding owner transition denied'; end if;
    select id into change_id from public.onboarding_case_owner_changes
      where case_id = old.id and old_owner_person_id = old.owner_person_id
        and new_owner_person_id = new.owner_person_id and transaction_id = txid_current()
        and actor_person_id = private.current_person_id() order by changed_at desc limit 1;
    if change_id is null then raise exception 'Onboarding owner history required'; end if;
    return new;
  end if;
  if not ((old.state = 'DRAFT' and new.state = 'IN_PROGRESS' and new.started_at is not null and new.cancelled_at is null)
    or (old.state in ('DRAFT','IN_PROGRESS') and new.state = 'CANCELLED'
      and new.started_at is not distinct from old.started_at and new.cancelled_at is not null))
  then raise exception 'Onboarding case transition denied'; end if;
  return new;
end;$$;
