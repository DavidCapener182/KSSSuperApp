-- TASK-04A: safe organisation-wide Person discovery without widening base-table RLS.
-- Only synthetic development data. No private profile, credential, document or audit values.
create function public.people_directory_04a(
  requested_person uuid default null,
  search_text text default '',
  role_filter text default '',
  onboarding_filter text default '',
  page_offset integer default 0,
  page_size integer default 25
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid;
  office_access boolean;
  operations_access boolean;
  super_access boolean;
  result jsonb;
begin
  actor := private.current_person_id();
  office_access := private.has_active_role('OFFICE_ADMIN');
  operations_access := private.has_active_role('OPERATIONS');
  super_access := private.has_active_role('SUPER_ADMIN');
  if actor is null or not (office_access or operations_access or super_access or private.has_active_role('SECURITY_STAFF'))
    or search_text is null or length(search_text) > 100 or search_text ~ '[[:cntrl:]]'
    or role_filter is null or (role_filter <> '' and role_filter not in
      ('SUPER_ADMIN','OFFICE_ADMIN','OPERATIONS','SECURITY_STAFF'))
    or onboarding_filter is null or onboarding_filter not in ('','IN_PROGRESS','DRAFT','NONE')
    or page_offset is null or page_offset < 0 or page_offset > 10000
    or page_size is null or page_size < 1 or page_size > 50
  then
    raise exception 'People directory denied';
  end if;

  with permitted as materialized (
    select p.id, p.display_name,
      coalesce((select array_agg(distinct ra.role_code order by ra.role_code)
        from public.role_assignments ra
        where ra.person_id = p.id and ra.revoked_at is null
          and ra.effective_from <= now() and (ra.effective_until is null or ra.effective_until > now())),
        array[]::text[]) as roles,
      (select c.id from public.onboarding_cases c where c.person_id = p.id
        and c.state <> 'CANCELLED' order by c.created_at desc, c.id desc limit 1) as current_case_id,
      coalesce((select array_agg(s.name order by s.name)
        from public.site_assignments sa join public.sites s on s.id = sa.site_id
        where sa.person_id = p.id and sa.revoked_at is null
          and sa.effective_from <= now() and (sa.effective_until is null or sa.effective_until > now())
          and s.status = 'ACTIVE'
          and (super_access or (office_access and s.created_by_person_id = actor)
            or (p.id = actor and private.has_active_role('SECURITY_STAFF')))),
        array[]::text[]) as site_names
    from public.people p
    where (super_access or office_access or operations_access or p.id = actor)
      and (requested_person is null or p.id = requested_person)
  ), projected as materialized (
    select x.id, x.display_name, x.roles, x.site_names,
      case when x.current_case_id is null then 'NONE'
        else (select c.state from public.onboarding_cases c where c.id = x.current_case_id) end as onboarding_state,
      case when x.current_case_id is not null and (super_access or office_access or x.id = actor)
        then private.onboarding_case_triage(x.current_case_id) else null end as triage
    from permitted x
  ), filtered as materialized (
    select * from projected x
    where (role_filter = '' or role_filter = any(x.roles))
      and (onboarding_filter = '' or x.onboarding_state = onboarding_filter)
      and (trim(search_text) = ''
        or position(lower(trim(search_text)) in lower(x.display_name)) > 0
        or exists (select 1 from unnest(x.roles) r
          where position(lower(trim(search_text)) in lower(replace(r,'_',' '))) > 0)
        or exists (select 1 from unnest(x.site_names) site_name
          where position(lower(trim(search_text)) in lower(site_name)) > 0))
  ), counted as (select count(*) as total from filtered), rows as (
    select x.* from filtered x order by lower(x.display_name), x.id
      offset page_offset limit page_size
  )
  select jsonb_build_object(
    'total', (select total from counted),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'displayName', r.display_name, 'roles', r.roles,
      'sites', r.site_names, 'onboardingState', r.onboarding_state,
      'onboardingCaseId', case when r.current_case_id is not null and
        (r.id = actor or super_access or (office_access and
          private.onboarding_office_case_access(r.current_case_id,actor)))
        then r.current_case_id else null end,
      'completed', case when operations_access and not (office_access or super_access or r.id = actor)
        then null else (r.triage->>'verifiedCount')::integer end,
      'totalRequirements', case when operations_access and not (office_access or super_access or r.id = actor)
        then null else (r.triage->>'totalCount')::integer end
    ) order by lower(r.display_name), r.id) from rows r), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.people_directory_04a(uuid,text,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.people_directory_04a(uuid,text,text,text,integer,integer)
  to authenticated;
