-- Correct the searched CASE expression in the handoff source name projection.
create or replace function public.commercial_handoff(p_organisation uuid, p_opportunity uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.crm_authorised() then raise exception 'Commercial handoff read denied'; end if;
  if not exists (select 1 from public.crm_organisations where id = p_organisation) then raise exception 'Organisation unavailable'; end if;
  if p_opportunity is not null and not exists (
    select 1 from public.crm_opportunities where id = p_opportunity and organisation_id = p_organisation
  ) then raise exception 'Opportunity unavailable'; end if;

  select jsonb_build_object(
    'organisation', jsonb_build_object('id', o.id, 'name', o.name, 'relationshipStatus', o.relationship_status),
    'opportunity', (select jsonb_build_object('id', q.id, 'title', q.title, 'stage', q.stage,
      'ownerId', q.owner_person_id) from public.crm_opportunities q where q.id = p_opportunity),
    'mobilisationTotal', (select count(*) from public.mobilisations m where m.organisation_id = o.id
      and (p_opportunity is null or m.source_opportunity_id = p_opportunity)),
    'mobilisations', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'title', m.title, 'status', m.status, 'ownerName', owner.display_name,
      'targetDate', m.target_go_live, 'opportunityId', m.source_opportunity_id,
      'handedOverAt', m.handed_over_at,
      'openActions', (select count(*) from public.mobilisation_actions a where a.mobilisation_id = m.id and a.state not in ('DONE','CANCELLED')),
      'openBlockers', (select count(*) from public.mobilisation_blockers b where b.mobilisation_id = m.id and b.resolved_at is null),
      'sources', (select coalesce(jsonb_agg(jsonb_build_object(
        'type', l.source_type, 'id', case when private.mobilisation_link_valid(m.id,l.source_type,l.source_id) then l.source_id end,
        'name', case when not private.mobilisation_link_valid(m.id,l.source_type,l.source_id) then null when l.source_type = 'SITE' then (select s.name from public.sites s where s.id = l.source_id)
          when l.source_type = 'SITE_SERVICE' then (select s.name from public.site_services s where s.id = l.source_id)
          when l.source_type = 'EVENT' then (select e.name from public.operational_events e where e.id = l.source_id) end,
        'siteId', case when private.mobilisation_link_valid(m.id,l.source_type,l.source_id) and l.source_type = 'SITE_SERVICE' then (select s.site_id from public.site_services s where s.id = l.source_id) end,
        'state', case when not private.mobilisation_link_valid(m.id,l.source_type,l.source_id) then 'RESTRICTED_OR_CHANGED'
          when l.source_type = 'SITE' then (select s.status from public.sites s where s.id = l.source_id)
          when l.source_type = 'SITE_SERVICE' then (select s.state from public.site_services s where s.id = l.source_id)
          when l.source_type = 'EVENT' then (select e.status from public.operational_events e where e.id = l.source_id) end
      ) order by l.linked_at,l.id),'[]'::jsonb)
        from public.mobilisation_links l where l.mobilisation_id = m.id and l.unlinked_at is null
          and l.source_type in ('SITE','SITE_SERVICE','EVENT')),
      'serviceDeliveries', (select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',s.name,'state',d.state,
        'siteServiceId',d.site_service_id) order by d.created_at,d.id),'[]'::jsonb)
        from public.service_deliveries d join public.site_services s on s.id=d.site_service_id
        where d.mobilisation_id=m.id)
    ) order by m.created_at desc,m.id desc),'[]'::jsonb)
      from (select * from public.mobilisations where organisation_id=o.id
        and (p_opportunity is null or source_opportunity_id=p_opportunity)
        order by created_at desc,id desc limit 50) m
      join public.people owner on owner.id=m.owner_person_id),
    'sites', (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'state',s.status)
      order by s.name,s.id),'[]'::jsonb) from public.site_client_links l join public.sites s on s.id=l.site_id
      where l.organisation_id=o.id and l.effective_until is null),
    'siteServices', (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'state',s.state,'siteId',s.site_id)
      order by s.name,s.id),'[]'::jsonb) from public.site_services s where s.organisation_id=o.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'state',e.status,'siteId',e.site_id)
      order by e.starts_at,e.id),'[]'::jsonb) from public.operational_events e where e.organisation_id=o.id),
    'serviceDeliveries', (select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',s.name,'state',d.state,
      'siteServiceId',d.site_service_id,'mobilisationId',d.mobilisation_id) order by d.created_at,d.id),'[]'::jsonb)
      from public.service_deliveries d join public.site_services s on s.id=d.site_service_id where d.organisation_id=o.id)
  ) into result from public.crm_organisations o where o.id=p_organisation;
  return result;
end $$;
revoke all on function public.commercial_handoff(uuid,uuid) from public,anon,authenticated;
grant execute on function public.commercial_handoff(uuid,uuid) to authenticated;
