-- TASK-18A: preserve exact private handover facts internally, mask inaccessible file IDs on every read path.
create function private.mobilisation_redact_facts(mid uuid, facts jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb:=coalesce(facts,'{}'::jsonb); field text; items jsonb; item jsonb; output_items jsonb;
begin
 foreach field in array array['sourceStates','linkedSources'] loop
  items:=result->field;
  if jsonb_typeof(items)='array' then
   output_items:='[]'::jsonb;
   for item in select value from jsonb_array_elements(items) loop
    if coalesce(item->>'type','')='DOCUMENT_VERSION' and item->>'id' is not null and
      not private.mobilisation_link_valid(mid,'DOCUMENT_VERSION',(item->>'id')::uuid) then
      item:=(item-'id'-'state')||jsonb_build_object('id',null,'state','RESTRICTED_OR_CHANGED');
    end if;
    output_items:=output_items||jsonb_build_array(item);
   end loop;
   result:=jsonb_set(result,array[field],output_items);
  end if;
 end loop;
 return result;
end $$;
revoke all on function private.mobilisation_redact_facts(uuid,jsonb) from public,anon,authenticated;
create or replace function public.mobilisation_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if not private.crm_authorised() then raise exception 'Mobilisation read denied'; end if;
 select jsonb_build_object('mobilisation',to_jsonb(m)||jsonb_build_object('organisationName',o.name,'ownerName',p.display_name,'templateCode',t.code,'templateVersion',t.version),
  'actions',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('ownerName',ap.display_name) order by a.template_ordinal nulls last,a.created_at,a.id),'[]'::jsonb) from public.mobilisation_actions a join public.people ap on ap.id=a.owner_person_id where a.mobilisation_id=m.id),
  'dependencies',(select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from public.mobilisation_dependencies d where d.mobilisation_id=m.id),
  'blockers',(select coalesce(jsonb_agg(to_jsonb(b) order by b.opened_at desc),'[]'::jsonb) from public.mobilisation_blockers b where b.mobilisation_id=m.id),
  'decisions',(select coalesce(jsonb_agg((to_jsonb(d)-'facts')||jsonb_build_object('facts',private.mobilisation_redact_facts(m.id,d.facts)) order by d.occurred_at desc),'[]'::jsonb) from public.mobilisation_decisions d where d.mobilisation_id=m.id),
  'links',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'sourceType',l.source_type,'sourceId',case when l.source_type='DOCUMENT_VERSION' and not private.mobilisation_link_valid(m.id,l.source_type,l.source_id) then null else l.source_id end,
   'siteId',case when l.source_type='SITE_SERVICE' then (select s.site_id from public.site_services s where s.id=l.source_id) else null end,
   'sourceState',case when not private.mobilisation_link_valid(m.id,l.source_type,l.source_id) then 'RESTRICTED_OR_CHANGED'
    when l.source_type='SITE' then (select s.status from public.sites s where s.id=l.source_id)
    when l.source_type='SITE_SERVICE' then (select s.state from public.site_services s where s.id=l.source_id)
    when l.source_type='EVENT' then (select e.status from public.operational_events e where e.id=l.source_id)
    when l.source_type='DOCUMENT_VERSION' then (select v.upload_state from public.document_versions v where v.id=l.source_id)
    else 'LINKED' end)),'[]'::jsonb) from public.mobilisation_links l where l.mobilisation_id=m.id and l.unlinked_at is null),
  'history',(select coalesce(jsonb_agg(case when h.kind='LINK' and h.after_value->>'sourceType'='DOCUMENT_VERSION'
   and not private.mobilisation_link_valid(m.id,'DOCUMENT_VERSION',(h.after_value->>'sourceId')::uuid)
   then (to_jsonb(h)-'after_value')||jsonb_build_object('after_value',jsonb_build_object('sourceType','DOCUMENT_VERSION','restricted',true))
   when h.kind='STATUS' and h.after_value ? 'facts' then jsonb_set(to_jsonb(h),'{after_value,facts}',private.mobilisation_redact_facts(m.id,h.after_value->'facts'))
   else to_jsonb(h) end order by h.revision desc),'[]'::jsonb)
   from (select * from public.mobilisation_history where mobilisation_id=m.id order by revision desc limit 100) h),
  'counts',(select jsonb_build_object('total',count(*),'done',count(*) filter(where state='DONE'),'open',count(*) filter(where state='OPEN'),'blocked',count(*) filter(where state='BLOCKED')) from public.mobilisation_actions a where a.mobilisation_id=m.id)) into result
 from public.mobilisations m join public.crm_organisations o on o.id=m.organisation_id join public.people p on p.id=m.owner_person_id join public.mobilisation_templates t on t.id=m.template_id where m.id=p_id;
 return result;
end $$;
revoke all on function public.mobilisation_detail(uuid) from public,anon,authenticated;
grant execute on function public.mobilisation_detail(uuid) to authenticated;
