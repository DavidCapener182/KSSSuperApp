-- TASK-22B: revoked/expired phone and email require an audited exact-route history read.
create or replace function public.contact_manage_22b(k text,target uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.contact_context_exists_22b(k,target) or not private.contact_manager_22b(k,target)
 then raise exception 'Contact management denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'purpose',r.purpose,'source_type',r.source_type,
  'source_id',r.source_id,'manual_origin',r.manual_origin,'accountable_manager_id',r.accountable_manager_id,
  'state',r.state,'revision',r.revision,'current_version_id',r.current_version_id,
  'source_health',case when r.source_type='MANUAL_OPERATIONAL' then 'CURRENT'
   when private.contact_source_marker_22b(r.source_type,r.source_id) is null then 'SOURCE_UNAVAILABLE'
   when private.contact_source_marker_22b(r.source_type,r.source_id)<>v.source_marker then 'REVIEW_REQUIRED' else 'CURRENT' end,
  'display_name',v.display_name,'role_organisation',v.role_organisation,
  'phone',case when r.state='PUBLISHED' and v.effective_until>transaction_timestamp() then v.phone end,
  'email',case when r.state='PUBLISHED' and v.effective_until>transaction_timestamp() then v.email end,
  'priority',v.priority,'effective_from',v.effective_from,'effective_until',v.effective_until,
  'london_start',v.london_start,'london_end',v.london_end,'reviewed_on',v.reviewed_on)
  order by r.purpose,v.priority,r.id),'[]'::jsonb) into result
 from public.operational_contact_routes_22b r join public.operational_contact_versions_22b v on v.id=r.current_version_id
 where r.context_kind=k and r.context_id=target;
 return jsonb_build_object('context_kind',k,'context_id',target,'routes',result);
end $$;
