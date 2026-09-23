-- Explicit output columns avoid adding future private Event columns to the Operations projection.
create or replace function public.operational_event_detail(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; office boolean;
begin
 if not private.operational_authorised() then raise exception 'Operational read denied'; end if;
 office:=private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN');
 select jsonb_build_object(
  'id',e.id,'name',e.name,'event_type',e.event_type,'starts_at',e.starts_at,'ends_at',e.ends_at,
  'status',e.status,'site_id',e.site_id,'organisation_id',e.organisation_id,'owner_person_id',e.owner_person_id,
  'site_name',s.name,'site_reference',s.site_reference,'site_type',s.site_type,'site_status',s.status,
  'site_address_line1',s.address_line1,'site_town_city',s.town_city,'site_postcode',s.postcode,'site_reporting_point',s.reporting_point,
  'client_name',o.name,'client_status',o.relationship_status,'owner_name',p.display_name,
  'contact_name',case when c.id is null then null else c.first_name||' '||c.last_name end,'contact_job_title',c.job_title,
  'history',coalesce((select jsonb_agg(jsonb_build_object(
    'id',h.id,'kind',h.kind,'old_status',h.old_status,'new_status',h.new_status,
    'old_owner_person_id',h.old_owner_person_id,'new_owner_person_id',h.new_owner_person_id,
    'old_starts_at',h.old_starts_at,'new_starts_at',h.new_starts_at,
    'old_ends_at',h.old_ends_at,'new_ends_at',h.new_ends_at,
    'reason',h.reason,'occurred_at',h.occurred_at,'actor_name',hp.display_name)
    order by h.occurred_at desc,h.id desc)
   from (select * from public.operational_event_events where event_id=e.id order by occurred_at desc,id desc limit 100) h
   join public.people hp on hp.id=h.actor_person_id),'[]'::jsonb)) ||
   case when office then jsonb_build_object('source_opportunity_id',e.source_opportunity_id) else '{}'::jsonb end
 into result
 from public.operational_events e join public.sites s on s.id=e.site_id join public.crm_organisations o on o.id=e.organisation_id
 join public.people p on p.id=e.owner_person_id left join public.crm_contacts c on c.id=e.primary_contact_id where e.id=p_event;
 return result;
end $$;
