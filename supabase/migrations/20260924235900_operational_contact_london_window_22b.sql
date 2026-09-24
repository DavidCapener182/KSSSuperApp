-- TASK-22B: shared simple London applicability predicate and current projection.
create function public.contact_london_window_22b(s time,e time,at_time timestamptz) returns boolean
 language sql immutable as $$
 select s is null or case when s<e then (at_time at time zone 'Europe/London')::time>=s and (at_time at time zone 'Europe/London')::time<e
 else (at_time at time zone 'Europe/London')::time>=s or (at_time at time zone 'Europe/London')::time<e end
$$;
create or replace function public.contact_current_22b(k text,target uuid,allocation uuid default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare at_time timestamptz:=transaction_timestamp(); result jsonb; actor uuid:=private.current_person_id();
begin
 if actor is null or not private.contact_context_exists_22b(k,target) or not (
  (allocation is not null and private.contact_staff_22b(k,target,allocation,at_time))
  or (allocation is null and private.has_active_role('OPERATIONS') and private.operational_authorised())
  or (allocation is null and private.contact_manager_22b(k,target)))
 then raise exception 'Contact read denied'; end if;
 select jsonb_build_object('context_kind',k,'context_id',target,
  'routes',coalesce(jsonb_agg(jsonb_build_object(
   'id',q.id,'purpose',q.purpose,'state',q.health,'priority',q.priority,
   'display_name',case when q.health='CURRENT' then q.display_name end,
   'role_organisation',case when q.health='CURRENT' then q.role_organisation end,
   'phone',case when q.health='CURRENT' then q.phone end,
   'email',case when q.health='CURRENT' then q.email end,
   'effective_from',q.effective_from,'effective_until',q.effective_until,
   'london_start',q.london_start,'london_end',q.london_end,'reviewed_on',q.reviewed_on)
   order by q.purpose,q.priority,q.id),'[]'::jsonb)) into result
 from (select r.id,r.purpose,v.priority,v.display_name,v.role_organisation,v.phone,v.email,
   v.effective_from,v.effective_until,v.london_start,v.london_end,v.reviewed_on,
   case when r.source_type<>'MANUAL_OPERATIONAL' and private.contact_source_marker_22b(r.source_type,r.source_id) is null then 'SOURCE_UNAVAILABLE'
    when r.source_type<>'MANUAL_OPERATIONAL' and private.contact_source_marker_22b(r.source_type,r.source_id)<>v.source_marker then 'REVIEW_REQUIRED'
    when v.effective_until<=at_time then 'EXPIRED'
    when v.effective_from>at_time or not public.contact_london_window_22b(v.london_start,v.london_end,at_time) then 'NOT_APPLICABLE'
    else 'CURRENT' end as health
  from public.operational_contact_routes_22b r join public.operational_contact_versions_22b v on v.id=r.current_version_id
  where r.context_kind=k and r.context_id=target and r.state='PUBLISHED') q;
 return result;
end $$;
