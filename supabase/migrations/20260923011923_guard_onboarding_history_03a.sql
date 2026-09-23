-- Existing submitted bytes remain in history, but cancellation also closes
-- the decision path for their document review and its Task transition.
create function private.guard_cancelled_onboarding_document_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.onboarding_case_requirements cr
    join public.onboarding_cases oc on oc.id = cr.case_id
    where cr.document_request_id = new.request_id and oc.state = 'CANCELLED'
  ) then raise exception 'Cancelled onboarding evidence cannot be reviewed'; end if;
  return new;
end;
$$;
revoke all on function private.guard_cancelled_onboarding_document_review() from public,anon,authenticated;
create trigger guard_cancelled_onboarding_document_review
  before insert on public.document_reviews for each row
  execute function private.guard_cancelled_onboarding_document_review();

-- A draft definition must not be moved into a published version. Existing
-- published definitions and all historical version bindings remain fixed.
create or replace function private.guard_onboarding_catalog() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Published onboarding catalog cannot be deleted'; end if;
  if tg_table_name = 'onboarding_templates' and tg_op = 'UPDATE' then
    raise exception 'Onboarding template identity is immutable'; end if;
  if tg_table_name = 'onboarding_template_versions' and tg_op = 'UPDATE' then
    if old.published_at is not null or new.id <> old.id or new.template_id <> old.template_id
      or new.version_number <> old.version_number or new.created_at <> old.created_at
      or new.published_at is null then raise exception 'Onboarding version is immutable'; end if;
    return new;
  end if;
  if tg_table_name = 'onboarding_requirement_definitions' then
    if tg_op = 'INSERT' and exists (select 1 from public.onboarding_template_versions v
      where v.id = new.template_version_id and v.published_at is not null) then
      raise exception 'Published onboarding definition is immutable'; end if;
    if tg_op = 'UPDATE' and (new.template_version_id <> old.template_version_id
      or exists (select 1 from public.onboarding_template_versions v
        where v.id = old.template_version_id and v.published_at is not null)) then
      raise exception 'Onboarding definition version binding is immutable'; end if;
  end if;
  return new;
end;
$$;
