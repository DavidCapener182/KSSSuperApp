-- TASK-22B: identify the exact Staff source context by name as well as ID.
create or replace function public.contact_for_allocation_22b(source text,allocation uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare event_id uuid; service_id uuid; site_id uuid; event_name text; service_name text; site_name text;
begin
 if allocation is null or not private.has_active_role('SECURITY_STAFF') then raise exception 'Contact read denied'; end if;
 if source='EVENT' then
  select d.event_id,e.name into event_id,event_name from public.event_staff_allocations a
   join public.event_staffing_requirements d on d.id=a.requirement_id
   join public.operational_events e on e.id=d.event_id
   where a.id=allocation and a.person_id=private.current_person_id() and a.status='ACCEPTED';
  if event_id is null or not private.contact_staff_22b('EVENT',event_id,allocation,transaction_timestamp())
  then raise exception 'Contact read denied'; end if;
  return jsonb_build_object('source','EVENT','contexts',jsonb_build_array(
   public.contact_current_22b('EVENT',event_id,allocation)||jsonb_build_object('context_name',event_name)));
 elsif source='SITE_SHIFT' then
  select d.service_id,x.site_id,x.name,s.name into service_id,site_id,service_name,site_name from public.site_shift_allocations a
   join public.site_shift_demands d on d.id=a.demand_id
   join public.site_services x on x.id=d.service_id
   join public.sites s on s.id=x.site_id
   where a.id=allocation and a.person_id=private.current_person_id() and a.status='ACCEPTED';
  if service_id is null or not private.contact_staff_22b('SITE_SERVICE',service_id,allocation,transaction_timestamp())
  then raise exception 'Contact read denied'; end if;
  return jsonb_build_object('source','SITE_SHIFT','contexts',jsonb_build_array(
   public.contact_current_22b('SITE',site_id,allocation)||jsonb_build_object('context_name',site_name),
   public.contact_current_22b('SITE_SERVICE',service_id,allocation)||jsonb_build_object('context_name',service_name)));
 end if;
 raise exception 'Contact read denied';
end $$;
