-- TASK-08A bounded dated exceptions and safe operational reads.
create function public.site_shift_amend(p_service uuid,p_demand uuid,p_expected_revision integer,p_kind text,
 p_quantity integer,p_report_at timestamptz,p_shift_starts_at timestamptz,p_shift_ends_at timestamptz,
 p_area text,p_reporting text,p_reason text) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); d public.site_shift_demands%rowtype; active_count integer; next_revision integer;
begin
 if actor is null or not private.operational_authorised() or p_kind not in ('SKIP','CHANGE_TIME','CHANGE_QUANTITY','CHANGE_REPORT_POINT','CANCEL')
  or p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]'
  then raise exception 'Dated exception denied'; end if;
 select * into d from public.site_shift_demands where id=p_demand and service_id=p_service for update;
 if d.id is null or d.state<>'PLANNED' or d.revision is distinct from p_expected_revision
  or d.service_date<private.uk_today() then raise exception 'Dated exception denied'; end if;
 select count(*) into active_count from public.site_shift_allocations a where a.demand_id=d.id and a.status in ('ALLOCATED','ACCEPTED');
 if p_kind in ('SKIP','CANCEL') and active_count>0 then raise exception 'Active allocations require reconciliation'; end if;
 if p_kind='CHANGE_QUANTITY' and (p_quantity is null or p_quantity<active_count or p_quantity<1 or p_quantity>10000)
  then raise exception 'Capacity reduction denied'; end if;
 if p_kind in ('CHANGE_TIME','CHANGE_REPORT_POINT') and active_count>0 then raise exception 'Active allocations require reconciliation'; end if;
 if p_kind='CHANGE_TIME' and (p_report_at is null or p_shift_starts_at is null or p_shift_ends_at is null
  or p_report_at>p_shift_starts_at or p_shift_starts_at>=p_shift_ends_at
  or p_shift_ends_at>p_shift_starts_at+interval '14 days'
  or (p_report_at at time zone 'Europe/London')::date<>d.service_date) then raise exception 'Shift time denied'; end if;
 if p_kind='CHANGE_REPORT_POINT' and (p_area is null or length(trim(p_area)) not between 1 and 100 or p_area ~ '[[:cntrl:]]'
  or length(coalesce(p_reporting,''))>180 or coalesce(p_reporting,'') ~ '[[:cntrl:]]') then raise exception 'Reporting point denied'; end if;
 perform set_config('kss.write_08a','allowed',true);
 next_revision:=d.revision+1;
 update public.site_shift_demands set
  required_quantity=case when p_kind='CHANGE_QUANTITY' then p_quantity else required_quantity end,
  report_at=case when p_kind='CHANGE_TIME' then p_report_at else report_at end,
  shift_starts_at=case when p_kind='CHANGE_TIME' then p_shift_starts_at else shift_starts_at end,
  shift_ends_at=case when p_kind='CHANGE_TIME' then p_shift_ends_at else shift_ends_at end,
  area_label=case when p_kind='CHANGE_REPORT_POINT' then trim(p_area) else area_label end,
  reporting_point=case when p_kind='CHANGE_REPORT_POINT' then coalesce(trim(p_reporting),'') else reporting_point end,
  state=case when p_kind in ('SKIP','CANCEL') then 'CANCELLED' else state end,
  manual_override=true,revision=next_revision,updated_by_person_id=actor,updated_at=transaction_timestamp()
  where id=d.id;
 insert into public.site_shift_exceptions(service_id,demand_id,kind,service_date,reason,actor_person_id,demand_revision)
  values(p_service,d.id,p_kind,d.service_date,trim(p_reason),actor,next_revision);
 insert into public.site_shift_demand_events(demand_id,service_id,kind,revision,snapshot,reason,actor_person_id)
  values(d.id,p_service,case when p_kind in ('SKIP','CANCEL') then 'CANCELLED' else 'EXCEPTION' end,
   next_revision,private.site_shift_snapshot_08a(d.id),trim(p_reason),actor);
 return next_revision;
end $$;
revoke all on function public.site_shift_amend(uuid,uuid,integer,text,integer,timestamptz,timestamptz,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.site_shift_amend(uuid,uuid,integer,text,integer,timestamptz,timestamptz,timestamptz,text,text,text) to authenticated;

create function public.site_shift_extra(p_service uuid,p_service_date date,p_role uuid,p_quantity integer,
 p_report_at timestamptz,p_shift_starts_at timestamptz,p_shift_ends_at timestamptz,
 p_area text,p_reporting text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); s public.site_services%rowtype; result uuid;
begin
 if actor is null or not private.operational_authorised() or p_service_date is null or p_service_date<private.uk_today()
  or p_quantity not between 1 and 10000 or p_report_at is null or p_shift_starts_at is null or p_shift_ends_at is null
  or p_report_at>p_shift_starts_at or p_shift_starts_at>=p_shift_ends_at
  or p_shift_ends_at>p_shift_starts_at+interval '14 days'
  or (p_report_at at time zone 'Europe/London')::date<>p_service_date
  or p_area is null or length(trim(p_area)) not between 1 and 100 or p_area ~ '[[:cntrl:]]'
  or length(coalesce(p_reporting,''))>180 or coalesce(p_reporting,'') ~ '[[:cntrl:]]'
  or p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]'
  or not exists(select 1 from public.operational_role_definitions where id=p_role and active)
  then raise exception 'Extra shift denied'; end if;
 select * into s from public.site_services where id=p_service for update;
 if s.id is null or s.state not in ('ACTIVE','PAUSED') or p_service_date<s.effective_from
  or (s.effective_until is not null and p_service_date>=s.effective_until)
  or exists(select 1 from public.site_service_pauses p where p.service_id=s.id and p.starts_on<=p_service_date
   and p_service_date<p.ends_before) then raise exception 'Extra shift denied'; end if;
 perform set_config('kss.write_08a','allowed',true);
 insert into public.site_shift_demands(service_id,service_date,role_id,required_quantity,report_at,shift_starts_at,
  shift_ends_at,area_label,reporting_point,origin,manual_override,created_by_person_id,updated_by_person_id)
 values(p_service,p_service_date,p_role,p_quantity,p_report_at,p_shift_starts_at,p_shift_ends_at,trim(p_area),
  coalesce(trim(p_reporting),''),'EXTRA',true,actor,actor) returning id into result;
 insert into public.site_shift_exceptions(service_id,demand_id,kind,service_date,reason,actor_person_id,demand_revision)
 values(p_service,result,'ADD',p_service_date,trim(p_reason),actor,1);
 insert into public.site_shift_demand_events(demand_id,service_id,kind,revision,snapshot,reason,actor_person_id)
 values(result,p_service,'EXTRA',1,private.site_shift_snapshot_08a(result),trim(p_reason),actor);
 return result;
end $$;
revoke all on function public.site_shift_extra(uuid,date,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.site_shift_extra(uuid,date,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text) to authenticated;

create function public.site_services_list(p_site uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_site is null then raise exception 'Service read denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',sv.id,'site_id',sv.site_id,'name',sv.name,'type',sv.type,
  'state',sv.state,'effective_from',sv.effective_from,'effective_until',sv.effective_until,
  'owner_person_id',sv.owner_person_id,'owner_name',p.display_name,'client_name',o.name,'site_name',s.name,
  'revision',sv.revision) order by sv.name,sv.id),'[]'::jsonb) into result
 from public.site_services sv join public.sites s on s.id=sv.site_id
 join public.crm_organisations o on o.id=sv.organisation_id join public.people p on p.id=sv.owner_person_id
 where sv.site_id=p_site;
 return result;
end $$;
revoke all on function public.site_services_list(uuid) from public,anon,authenticated;
grant execute on function public.site_services_list(uuid) to authenticated;

create function public.site_service_detail(p_site uuid,p_service uuid,p_from date,p_until date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_from is null or p_until is null or p_until<=p_from
  or p_until>p_from+93 or not exists(select 1 from public.site_services where id=p_service and site_id=p_site)
  then raise exception 'Service read denied'; end if;
 select jsonb_build_object('service',jsonb_build_object('id',sv.id,'site_id',sv.site_id,'name',sv.name,'type',sv.type,
  'state',sv.state,'effective_from',sv.effective_from,'effective_until',sv.effective_until,
  'owner_person_id',sv.owner_person_id,'client_name',o.name,'site_name',s.name,'revision',sv.revision),
  'pauses',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'starts_on',p.starts_on,'ends_before',p.ends_before)
    order by p.starts_on) from public.site_service_pauses p where p.service_id=sv.id),'[]'::jsonb),
  'templates',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'line_id',v.line_id,'version',v.version,
    'effective_from',v.effective_from,'effective_until',v.effective_until,'weekdays',v.weekdays,
    'role_id',v.role_id,'role_name',r.display_name,'required_quantity',v.required_quantity,
    'report_time',v.report_time,'shift_start_time',v.shift_start_time,'shift_end_time',v.shift_end_time,
    'area_label',v.area_label,'reporting_point',v.reporting_point) order by v.effective_from,v.line_id,v.version)
    from public.site_shift_template_versions v join public.operational_role_definitions r on r.id=v.role_id
    where v.service_id=sv.id),'[]'::jsonb),
  'demands',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'service_date',d.service_date,'role_id',d.role_id,
    'role_name',r.display_name,'required_quantity',d.required_quantity,'report_at',d.report_at,
    'shift_starts_at',d.shift_starts_at,'shift_ends_at',d.shift_ends_at,'area_label',d.area_label,
    'reporting_point',d.reporting_point,'state',d.state,'origin',d.origin,'revision',d.revision,
    'allocated',(select count(*) from public.site_shift_allocations a where a.demand_id=d.id and a.status in ('ALLOCATED','ACCEPTED')),
    'accepted',(select count(*) from public.site_shift_allocations a where a.demand_id=d.id and a.status='ACCEPTED'))
    order by d.service_date,d.report_at,d.id) from public.site_shift_demands d
    join public.operational_role_definitions r on r.id=d.role_id where d.service_id=sv.id
    and d.service_date>=p_from and d.service_date<p_until),'[]'::jsonb)) into result
 from public.site_services sv join public.sites s on s.id=sv.site_id
 join public.crm_organisations o on o.id=sv.organisation_id where sv.id=p_service and sv.site_id=p_site;
 return result;
end $$;
revoke all on function public.site_service_detail(uuid,uuid,date,date) from public,anon,authenticated;
grant execute on function public.site_service_detail(uuid,uuid,date,date) to authenticated;

create function public.site_shift_allocation_detail(p_service uuid,p_demand uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or not exists(select 1 from public.site_shift_demands where id=p_demand and service_id=p_service)
  then raise exception 'Allocation read denied'; end if;
 select jsonb_build_object('required',d.required_quantity,
  'allocated',count(a.id) filter(where a.status in ('ALLOCATED','ACCEPTED')),
  'accepted',count(a.id) filter(where a.status='ACCEPTED'),
  'remaining',d.required_quantity-count(a.id) filter(where a.status in ('ALLOCATED','ACCEPTED')),
  'allocations',coalesce(jsonb_agg(jsonb_build_object('id',a.id,'person_id',a.person_id,'person_name',p.display_name,
   'status',a.status,'revision',a.revision,'allocated_at',a.allocated_at) order by a.allocated_at,a.id)
   filter(where a.id is not null),'[]'::jsonb)) into result
 from public.site_shift_demands d left join public.site_shift_allocations a on a.demand_id=d.id
 left join public.people p on p.id=a.person_id where d.id=p_demand group by d.id;
 return result;
end $$;
revoke all on function public.site_shift_allocation_detail(uuid,uuid) from public,anon,authenticated;
grant execute on function public.site_shift_allocation_detail(uuid,uuid) to authenticated;
