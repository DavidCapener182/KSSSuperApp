-- Effective-dated pause/end reconciliation and strict London DST local times.
create or replace function private.site_shift_time_08a(p_date date,p_time time) returns timestamptz
 language plpgsql immutable security definer set search_path='' as $$
declare result timestamptz;
begin
 result:=(p_date+p_time) at time zone 'Europe/London';
 if (result at time zone 'Europe/London') is distinct from (p_date+p_time) or
  ((result+interval '1 hour') at time zone 'Europe/London')=(p_date+p_time) or
  ((result-interval '1 hour') at time zone 'Europe/London')=(p_date+p_time) then
  raise exception 'Local shift time does not exist or is ambiguous';
 end if;
 return result;
end $$;

create or replace function private.site_shift_generate_08a(p_service uuid,p_from date,p_until date,p_actor uuid,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare s public.site_services%rowtype; setting_weeks integer; day date; template_row public.site_shift_template_versions%rowtype;
 d public.site_shift_demands%rowtype; report_instant timestamptz; start_instant timestamptz; end_instant timestamptz;
 next_revision integer; changed integer:=0; desired boolean;
begin
 select * into s from public.site_services where id=p_service for update;
 select horizon_weeks into setting_weeks from public.site_shift_settings where singleton;
 if s.id is null or p_actor is null or p_from is null or p_until is null or p_from<private.uk_today() or
  p_until<=p_from or p_until>p_from+(setting_weeks*7) or setting_weeks is null then
  raise exception 'Generation range denied'; end if;
 perform set_config('kss.write_08a','allowed',true);
 for day in select generate_series(p_from,p_until-1,interval '1 day')::date loop
  for template_row in select tv.* from public.site_shift_template_versions tv
   where tv.service_id=p_service and tv.effective_from<=day and (tv.effective_until is null or tv.effective_until>day)
     and extract(isodow from day)::integer=any(tv.weekdays)
   order by tv.line_id loop
   desired:=s.state<>'DRAFT' and day>=s.effective_from and (s.effective_until is null or day<s.effective_until)
     and not exists(select 1 from public.site_service_pauses p where p.service_id=p_service and p.starts_on<=day and day<p.ends_before);
   if not desired then continue; end if;
   report_instant:=private.site_shift_time_08a(day,template_row.report_time);
   start_instant:=private.site_shift_time_08a(day,template_row.shift_start_time);
   end_instant:=private.site_shift_time_08a(day+case when template_row.shift_end_time<=template_row.shift_start_time then 1 else 0 end,template_row.shift_end_time);
   if report_instant>start_instant or end_instant<=start_instant then raise exception 'Invalid template duty'; end if;
   select * into d from public.site_shift_demands where template_line_id=template_row.line_id and service_date=day for update;
   if d.id is null then
    insert into public.site_shift_demands(service_id,template_line_id,template_version_id,service_date,role_id,
     required_quantity,report_at,shift_starts_at,shift_ends_at,area_label,reporting_point,origin,
     created_by_person_id,updated_by_person_id)
    values(p_service,template_row.line_id,template_row.id,day,template_row.role_id,template_row.required_quantity,report_instant,start_instant,end_instant,
     template_row.area_label,template_row.reporting_point,'TEMPLATE',p_actor,p_actor) returning * into d;
    insert into public.site_shift_demand_events(demand_id,service_id,kind,revision,snapshot,actor_person_id)
     values(d.id,p_service,'GENERATED',1,private.site_shift_snapshot_08a(d.id),p_actor);
    changed:=changed+1;
   elsif not d.manual_override and (d.template_version_id is distinct from template_row.id or d.role_id is distinct from template_row.role_id
     or d.required_quantity is distinct from template_row.required_quantity or d.report_at is distinct from report_instant
     or d.shift_starts_at is distinct from start_instant or d.shift_ends_at is distinct from end_instant
     or d.area_label is distinct from template_row.area_label or d.reporting_point is distinct from template_row.reporting_point or d.state<>'PLANNED') then
    if d.state='CANCELLED' or d.service_date<private.uk_today() or exists(select 1 from public.site_shift_allocations a
      where a.demand_id=d.id and a.status in ('ALLOCATED','ACCEPTED')) then raise exception 'Dated demand requires explicit reconciliation'; end if;
    next_revision:=d.revision+1;
    update public.site_shift_demands set template_version_id=template_row.id,role_id=template_row.role_id,required_quantity=template_row.required_quantity,
     report_at=report_instant,shift_starts_at=start_instant,shift_ends_at=end_instant,area_label=template_row.area_label,
     reporting_point=template_row.reporting_point,revision=next_revision,updated_by_person_id=p_actor,updated_at=transaction_timestamp()
     where id=d.id;
    insert into public.site_shift_demand_events(demand_id,service_id,kind,revision,snapshot,reason,actor_person_id)
     values(d.id,p_service,'RECONCILED',next_revision,private.site_shift_snapshot_08a(d.id),p_reason,p_actor);
    changed:=changed+1;
   end if;
  end loop;
 end loop;
 -- Occurrences no longer produced by a current version or paused interval are explicitly cancelled, never erased.
 for d in select * from public.site_shift_demands x where x.service_id=p_service and x.origin='TEMPLATE'
   and x.service_date>=p_from and x.service_date<p_until and x.state='PLANNED' and not x.manual_override
   and not exists(select 1 from public.site_shift_template_versions candidate_version where candidate_version.line_id=x.template_line_id
     and candidate_version.effective_from<=x.service_date and (candidate_version.effective_until is null or candidate_version.effective_until>x.service_date)
     and extract(isodow from x.service_date)::integer=any(candidate_version.weekdays)
     and s.state<>'DRAFT' and x.service_date>=s.effective_from
     and (s.effective_until is null or x.service_date<s.effective_until)
     and not exists(select 1 from public.site_service_pauses p where p.service_id=p_service
       and p.starts_on<=x.service_date and x.service_date<p.ends_before))
   order by x.service_date,x.id for update loop
  if exists(select 1 from public.site_shift_allocations a where a.demand_id=d.id and a.status in ('ALLOCATED','ACCEPTED'))
   then raise exception 'Dated demand requires explicit allocation reconciliation'; end if;
  next_revision:=d.revision+1;
  update public.site_shift_demands set state='CANCELLED',revision=next_revision,updated_by_person_id=p_actor,
   updated_at=transaction_timestamp() where id=d.id;
  insert into public.site_shift_demand_events(demand_id,service_id,kind,revision,snapshot,reason,actor_person_id)
   values(d.id,p_service,'CANCELLED',next_revision,private.site_shift_snapshot_08a(d.id),p_reason,p_actor);
  changed:=changed+1;
 end loop;
 return changed;
end $$;

create or replace function public.site_service_transition(p_service uuid,p_state text,p_effective_on date,p_expected_revision integer,p_reason text,p_resume_on date default null)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); old public.site_services%rowtype; next_revision integer;
begin
 if not private.site_shift_admin_08a() or p_reason is null or length(trim(p_reason)) not between 3 and 500
  or p_reason ~ '[[:cntrl:]]' or p_effective_on is null or p_state not in ('ACTIVE','PAUSED','ENDED')
  or p_effective_on<((transaction_timestamp() at time zone 'Europe/London')::date) then raise exception 'Service transition denied'; end if;
 select * into old from public.site_services where id=p_service for update;
 if old.id is null or old.revision is distinct from p_expected_revision or old.state='ENDED'
  or (old.state='DRAFT' and p_state<>'ACTIVE') or (old.state='ACTIVE' and p_state='ACTIVE')
  or (old.state='PAUSED' and p_state='PAUSED') or p_effective_on<old.effective_from
  or (p_state='PAUSED' and (p_resume_on is null or p_resume_on<=p_effective_on))
  or (p_state<>'PAUSED' and p_resume_on is not null) then raise exception 'Service transition denied'; end if;
 if p_state='PAUSED' and exists(select 1 from public.site_service_pauses p where p.service_id=p_service
  and p.starts_on<p_resume_on and p_effective_on<p.ends_before) then raise exception 'Pause periods overlap'; end if;
 if old.state='PAUSED' and p_state='ACTIVE' and exists(select 1 from public.site_service_pauses p
  where p.service_id=p_service and p.starts_on<=p_effective_on and p_effective_on<p.ends_before)
  then raise exception 'Pause period is still effective'; end if;
 if p_state in ('PAUSED','ENDED') and exists(select 1 from public.site_shift_allocations a
  join public.site_shift_demands d on d.id=a.demand_id where d.service_id=p_service and d.service_date>=p_effective_on
   and a.status in ('ALLOCATED','ACCEPTED')) then raise exception 'Active allocations require reconciliation'; end if;
 perform set_config('kss.write_08a','allowed',true);
 next_revision:=old.revision+1;
 if p_state='PAUSED' then
  insert into public.site_service_pauses(service_id,starts_on,ends_before,reason,actor_person_id)
   values(p_service,p_effective_on,p_resume_on,trim(p_reason),actor);
 end if;
 update public.site_services set state=p_state,effective_until=case when p_state='ENDED' then p_effective_on else effective_until end,
  revision=next_revision,updated_by_person_id=actor,updated_at=transaction_timestamp() where id=p_service;
 insert into public.site_service_events(service_id,kind,previous_revision,new_revision,previous_state,new_state,effective_on,snapshot,reason,actor_person_id)
  select id,case when p_state='ACTIVE' and old.state='PAUSED' then 'RESUMED' when p_state='ACTIVE' then 'ACTIVATED'
   when p_state='PAUSED' then 'PAUSED' else 'ENDED' end,old.revision,revision,old.state,state,p_effective_on,to_jsonb(s),trim(p_reason),actor
   from public.site_services s where id=p_service;
 perform private.site_shift_generate_08a(p_service,private.uk_today(),
  private.uk_today()+(select horizon_weeks*7 from public.site_shift_settings where singleton),actor,trim(p_reason));
 return next_revision;
end $$;
