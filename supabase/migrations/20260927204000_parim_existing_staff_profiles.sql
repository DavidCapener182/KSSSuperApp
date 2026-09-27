-- Link an existing Person to a stable PARiM identity without creating a second account.
create table if not exists public.person_source_links (
  source_system text not null,
  source_id text not null,
  person_id uuid not null references public.people(id),
  imported_at timestamptz not null default now(),
  primary key (source_system, source_id),
  unique (source_system, person_id)
);
alter table public.person_source_links enable row level security;
revoke all on public.person_source_links from anon, authenticated;

create table if not exists public.person_work_positions (
  person_id uuid not null references public.people(id),
  source_system text not null,
  position_name text not null,
  imported_at timestamptz not null default now(),
  primary key (person_id, source_system, position_name)
);
alter table public.person_work_positions enable row level security;
revoke all on public.person_work_positions from anon, authenticated;
grant select on public.person_work_positions to authenticated;
create policy person_work_positions_directory_read on public.person_work_positions
  for select to authenticated using (
    person_id = private.current_person_id()
    or private.has_active_role('SUPER_ADMIN')
    or private.has_active_role('OFFICE_ADMIN')
    or private.has_active_role('OPERATIONS')
  );

-- Existing staff have no onboarding case. Give Super Admin an audited, exact
-- imported-Person profile read without widening onboarding profile RLS.
create function public.read_imported_person_profile(requested_person uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid; result jsonb;
begin
  actor := private.current_person_id();
  if actor is null or not private.has_active_role('SUPER_ADMIN') or not exists (
    select 1 from public.person_source_links l where l.source_system='PARIM' and l.person_id=requested_person
  ) then raise exception 'Imported profile denied'; end if;
  select to_jsonb(p) into result from public.person_profiles p where p.person_id=requested_person;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(actor,requested_person,'person_profile',requested_person,'READ',
      jsonb_build_object('scope','SUPER_ADMIN_IMPORTED_PERSON_READ'));
  return result;
end;
$$;
revoke all on function public.read_imported_person_profile(uuid) from public,anon,authenticated;
grant execute on function public.read_imported_person_profile(uuid) to authenticated;
