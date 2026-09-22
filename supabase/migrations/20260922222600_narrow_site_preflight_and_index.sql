-- The exposed boolean preflight uses authenticated invoker privileges. The
-- private helper retains the narrow, role-bound security-definer lookup.
alter function public.can_delegate_site_assignment(uuid,uuid,timestamptz,timestamptz)
  security invoker;

-- Site assignment administrative history and RLS site lookups use site_id.
create index site_assignments_site_id_idx on public.site_assignments(site_id);
