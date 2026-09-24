-- Narrow exact-Site projection for Operations and CRM deep links; existing Site API/RLS stays unchanged.
create function public.operational_site_detail(p_site uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() then raise exception 'Operational read denied'; end if;
 select jsonb_build_object(
  'id',s.id,'site_reference',s.site_reference,'name',s.name,'address_line1',s.address_line1,
  'town_city',s.town_city,'postcode',s.postcode,'reporting_point',s.reporting_point,'status',s.status,'site_type',s.site_type,
  'organisation_id',l.organisation_id,'client_name',o.name,'client_status',o.relationship_status,
  'can_manage',private.has_active_role('SUPER_ADMIN') or
    (private.has_active_role('OFFICE_ADMIN') and s.created_by_person_id=private.current_person_id()),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'starts_at',e.starts_at,'ends_at',e.ends_at,'status',e.status)
       order by e.starts_at,e.id) from (select id,name,starts_at,ends_at,status from public.operational_events
       where site_id=s.id and status not in ('CANCELLED','COMPLETED') order by starts_at,id limit 20) e),'[]'::jsonb)) into result
 from public.sites s left join public.site_client_links l on l.site_id=s.id and l.effective_until is null
 left join public.crm_organisations o on o.id=l.organisation_id
 where s.id=p_site and (private.has_active_role('SUPER_ADMIN') or private.has_active_role('OPERATIONS') or
   (private.has_active_role('OFFICE_ADMIN') and (s.created_by_person_id=private.current_person_id() or l.id is not null)));
 return result;
end $$;
revoke all on function public.operational_site_detail(uuid) from public,anon,authenticated;
grant execute on function public.operational_site_detail(uuid) to authenticated;
