-- TASK-19A: Staff sees the exact operational context beside each controlled version.
create or replace function public.operational_document_my_list() returns jsonb
language sql stable security definer set search_path='' as $$
 with mine as (
  select a.id,a.document_id,a.version_id,a.target_kind,a.target_id,a.context_kind,a.context_id,
   a.required,a.effective_from,a.effective_until,a.closed_at,a.close_kind,
   v.version_number,v.title, private.operational_document_current(a,private.current_person_id()) as current,
   case a.target_kind
    when 'PERSON' then 'Direct assignment'
    when 'SITE' then (select s.name from public.sites s where s.id=a.target_id)
    when 'SITE_SERVICE' then (select sv.name from public.site_services sv where sv.id=a.target_id)
    when 'EVENT' then (select e.name from public.operational_events e where e.id=a.target_id)
    when 'OPERATIONAL_ROLE' then
     (select r.display_name from public.operational_role_definitions r where r.id=a.target_id)
      || ' · ' || case a.context_kind
       when 'SITE_SERVICE' then (select sv.name from public.site_services sv where sv.id=a.context_id)
       when 'EVENT' then (select e.name from public.operational_events e where e.id=a.context_id)
       else 'Unknown context' end
   end as context_label,
   exists(select 1 from public.operational_document_accesses x where x.assignment_id=a.id
    and x.person_id=private.current_person_id()) as opened,
   (select min(x.acknowledged_at) from public.operational_document_acknowledgements x
    where x.person_id=private.current_person_id() and x.document_id=a.document_id and x.version_id=a.version_id) as acknowledged_at
  from public.operational_document_assignments a
  join public.controlled_document_versions v on v.id=a.version_id
  where private.has_active_role('SECURITY_STAFF') and
   (private.operational_document_current(a,private.current_person_id()) or
    exists(select 1 from public.operational_document_acknowledgements x
     where x.assignment_id=a.id and x.person_id=private.current_person_id()))
 )
 select jsonb_build_object('asOf',now(),'assignments',coalesce(jsonb_agg(
  to_jsonb(mine) || jsonb_build_object('conflict',current and exists(select 1 from mine other
   where other.document_id=mine.document_id and other.version_id<>mine.version_id and other.current))
  order by mine.effective_from desc), '[]'::jsonb)) from mine
$$;
