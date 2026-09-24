-- TASK-08D: scheduled, bounded static demand maintenance in synthetic Dev.
-- Supabase Cron is database-local; the function never calls an HTTP endpoint.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create table private.site_shift_maintenance_runs_08d (
 id uuid primary key default gen_random_uuid(),
 trigger_kind text not null check (trigger_kind in ('SCHEDULED','MANUAL_RERUN')),
 window_from date not null,
 window_until date not null,
 horizon_weeks integer not null check (horizon_weeks between 1 and 26),
 state text not null check (state in ('RUNNING','SUCCEEDED','PARTIAL_FAILURE','FAILED','SKIPPED_LOCKED')),
 started_at timestamptz not null default transaction_timestamp(),
 completed_at timestamptz,
 services_total integer not null default 0 check (services_total>=0),
 services_succeeded integer not null default 0 check (services_succeeded>=0),
 services_failed integer not null default 0 check (services_failed>=0),
 check (window_until>window_from),
 check (completed_at is null or completed_at>=started_at)
);
create index site_shift_maintenance_runs_08d_latest_idx
 on private.site_shift_maintenance_runs_08d(started_at desc,id);

create table private.site_shift_maintenance_service_runs_08d (
 run_id uuid not null references private.site_shift_maintenance_runs_08d(id),
 service_id uuid not null references public.site_services(id),
 state text not null check (state in ('RUNNING','SUCCEEDED','FAILED')),
 changed_count integer not null default 0 check (changed_count>=0),
 failure_code text check (failure_code is null or failure_code in
  ('ACTIVE_ALLOCATIONS_REQUIRE_RECONCILIATION','INVALID_TEMPLATE_DUTY','INVALID_LOCAL_TIME','GENERATION_REJECTED','DATABASE_ERROR')),
 started_at timestamptz not null default transaction_timestamp(),
 completed_at timestamptz,
 primary key(run_id,service_id),
 check ((state='FAILED')=(failure_code is not null))
);
create index site_shift_maintenance_service_runs_08d_failed_idx
 on private.site_shift_maintenance_service_runs_08d(run_id,state,service_id);
revoke all on private.site_shift_maintenance_runs_08d,
 private.site_shift_maintenance_service_runs_08d from public,anon,authenticated;

alter table public.site_shift_demands
 alter column created_by_person_id drop not null,
 alter column updated_by_person_id drop not null;
alter table public.site_shift_demands
 add column created_by_maintenance_run_id uuid references private.site_shift_maintenance_runs_08d(id),
 add column updated_by_maintenance_run_id uuid references private.site_shift_maintenance_runs_08d(id),
 add constraint site_shift_demand_created_actor_08d check
  ((created_by_person_id is not null and created_by_maintenance_run_id is null) or
   (created_by_person_id is null and created_by_maintenance_run_id is not null)),
 add constraint site_shift_demand_updated_actor_08d check
  ((updated_by_person_id is not null and updated_by_maintenance_run_id is null) or
   (updated_by_person_id is null and updated_by_maintenance_run_id is not null));

alter table public.site_shift_demand_events alter column actor_person_id drop not null;
alter table public.site_shift_demand_events
 add column maintenance_run_id uuid references private.site_shift_maintenance_runs_08d(id),
 add constraint site_shift_demand_event_actor_08d check
  ((actor_person_id is not null and maintenance_run_id is null) or
   (actor_person_id is null and maintenance_run_id is not null));

create or replace function private.site_shift_generate_08a(
 p_service uuid,p_from date,p_until date,p_actor uuid,p_reason text
) returns integer language plpgsql security definer set search_path='' as $$
declare
 s public.site_services%rowtype;
 setting_weeks integer;
 day date;
 template_row public.site_shift_template_versions%rowtype;
 d public.site_shift_demands%rowtype;
 report_instant timestamptz;
 start_instant timestamptz;
 end_instant timestamptz;
 next_revision integer;
 changed integer:=0;
 desired boolean;
 maintenance_run uuid;
begin
 maintenance_run:=nullif(current_setting('kss.maintenance_run_08d',true),'')::uuid;
 if p_actor is null and (maintenance_run is null or not exists(
   select 1 from private.site_shift_maintenance_runs_08d r where r.id=maintenance_run and r.state='RUNNING')) then
  raise exception 'Generation actor denied';
 end if;
 if p_actor is not null and maintenance_run is not null then raise exception 'Generation actor denied'; end if;
 select * into s from public.site_services where id=p_service for update;
 select horizon_weeks into setting_weeks from public.site_shift_settings where singleton;
 if s.id is null or p_from is null or p_until is null or p_from<private.uk_today() or
  p_until<=p_from or p_until>p_from+(setting_weeks*7) or setting_weeks is null then
  raise exception 'Generation range denied'; end if;
 perform set_config('kss.write_08a','allowed',true);
 for day in select generate_series(p_from,p_until-1,interval '1 day')::date loop
  for template_row in select tv.* from public.site_shift_template_versions tv
   where tv.service_id=p_service and tv.effective_from<=day and (tv.effective_until is null or tv.effective_until>day)
    and extract(isodow from day)::integer=any(tv.weekdays)
   order by tv.line_id loop
   desired:=(s.state in ('ACTIVE','PAUSED') or (s.state='ENDED' and s.effective_until is not null and day<s.effective_until))
    and day>=s.effective_from and (s.effective_until is null or day<s.effective_until)
    and not exists(select 1 from public.site_service_pauses p where p.service_id=p_service
     and p.starts_on<=day and day<p.ends_before);
   if not desired then continue; end if;
   report_instant:=private.site_shift_time_08a(day,template_row.report_time);
   start_instant:=private.site_shift_time_08a(day,template_row.shift_start_time);
   end_instant:=private.site_shift_time_08a(day+case when template_row.shift_end_time<=template_row.shift_start_time then 1 else 0 end,
    template_row.shift_end_time);
   if report_instant>start_instant or end_instant<=start_instant then raise exception 'Invalid template duty'; end if;
   select * into d from public.site_shift_demands where template_line_id=template_row.line_id and service_date=day for update;
   if d.id is null then
    insert into public.site_shift_demands(service_id,template_line_id,template_version_id,service_date,role_id,
     required_quantity,report_at,shift_starts_at,shift_ends_at,area_label,reporting_point,origin,
     created_by_person_id,updated_by_person_id,created_by_maintenance_run_id,updated_by_maintenance_run_id)
    values(p_service,template_row.line_id,template_row.id,day,template_row.role_id,template_row.required_quantity,
     report_instant,start_instant,end_instant,template_row.area_label,template_row.reporting_point,'TEMPLATE',
     p_actor,p_actor,maintenance_run,maintenance_run) returning * into d;
    insert into public.site_shift_demand_events(demand_id,service_id,kind,revision,snapshot,actor_person_id,maintenance_run_id)
     values(d.id,p_service,'GENERATED',1,private.site_shift_snapshot_08a(d.id),p_actor,maintenance_run);
    changed:=changed+1;
   elsif not d.manual_override and (d.template_version_id is distinct from template_row.id or d.role_id is distinct from template_row.role_id
    or d.required_quantity is distinct from template_row.required_quantity or d.report_at is distinct from report_instant
    or d.shift_starts_at is distinct from start_instant or d.shift_ends_at is distinct from end_instant
    or d.area_label is distinct from template_row.area_label or d.reporting_point is distinct from template_row.reporting_point
    or d.state<>'PLANNED') then
    if d.state='CANCELLED' or d.service_date<private.uk_today() or exists(
      select 1 from public.site_shift_allocations a where a.demand_id=d.id and a.status in ('ALLOCATED','ACCEPTED')) then
     raise exception 'Dated demand requires explicit reconciliation';
    end if;
    next_revision:=d.revision+1;
    update public.site_shift_demands set template_version_id=template_row.id,role_id=template_row.role_id,
     required_quantity=template_row.required_quantity,report_at=report_instant,shift_starts_at=start_instant,
     shift_ends_at=end_instant,area_label=template_row.area_label,reporting_point=template_row.reporting_point,
     revision=next_revision,updated_by_person_id=p_actor,updated_by_maintenance_run_id=maintenance_run,
     updated_at=transaction_timestamp() where id=d.id;
    insert into public.site_shift_demand_events(demand_id,service_id,kind,revision,snapshot,reason,actor_person_id,maintenance_run_id)
     values(d.id,p_service,'RECONCILED',next_revision,private.site_shift_snapshot_08a(d.id),p_reason,p_actor,maintenance_run);
    changed:=changed+1;
   end if;
  end loop;
 end loop;

 -- Remove an occurrence only when its template line/version no longer produces that date.
 -- Lifecycle boundaries (PAUSED/ENDED/effective dates) suppress creation but preserve existing rows.
 for d in select x.* from public.site_shift_demands x
  where x.service_id=p_service and x.origin='TEMPLATE' and x.service_date>=p_from and x.service_date<p_until
   and x.state='PLANNED' and not x.manual_override
   and not exists(select 1 from public.site_shift_template_versions candidate_version
    where candidate_version.line_id=x.template_line_id and candidate_version.effective_from<=x.service_date
     and (candidate_version.effective_until is null or candidate_version.effective_until>x.service_date)
     and extract(isodow from x.service_date)::integer=any(candidate_version.weekdays))
  order by x.service_date,x.id for update loop
  if exists(select 1 from public.site_shift_allocations a where a.demand_id=d.id
    and a.status in ('ALLOCATED','ACCEPTED')) then
   raise exception 'Dated demand requires explicit allocation reconciliation';
  end if;
  next_revision:=d.revision+1;
  update public.site_shift_demands set state='CANCELLED',revision=next_revision,
   updated_by_person_id=p_actor,updated_by_maintenance_run_id=maintenance_run,updated_at=transaction_timestamp()
   where id=d.id;
  insert into public.site_shift_demand_events(demand_id,service_id,kind,revision,snapshot,reason,actor_person_id,maintenance_run_id)
   values(d.id,p_service,'CANCELLED',next_revision,private.site_shift_snapshot_08a(d.id),p_reason,p_actor,maintenance_run);
  changed:=changed+1;
 end loop;
 return changed;
end $$;
revoke all on function private.site_shift_generate_08a(uuid,date,date,uuid,text) from public,anon,authenticated;

create or replace function private.guard_site_shift_08a() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_08a',true) is distinct from 'allowed' then raise exception 'Site shift direct write denied'; end if;
 if tg_op='DELETE' then raise exception 'Site shift history cannot be deleted'; end if;
 if tg_op='INSERT' then return new; end if;
 if tg_table_name in ('site_service_events','site_service_pauses','site_shift_demand_events',
  'site_shift_exceptions','site_shift_template_lines','site_shift_template_events') then
  raise exception 'Site shift history is immutable';
 elsif tg_table_name='site_services' then
  if new.id is distinct from old.id or new.site_id is distinct from old.site_id or
   new.site_client_link_id is distinct from old.site_client_link_id or new.organisation_id is distinct from old.organisation_id or
   new.created_by_person_id is distinct from old.created_by_person_id or new.created_at is distinct from old.created_at or
   new.revision<>old.revision+1 then raise exception 'Service identity cannot change'; end if;
 elsif tg_table_name='site_shift_demands' then
  if new.id is distinct from old.id or new.service_id is distinct from old.service_id or
   new.template_line_id is distinct from old.template_line_id or new.origin is distinct from old.origin or
   new.service_date is distinct from old.service_date or new.created_by_person_id is distinct from old.created_by_person_id or
   new.created_by_maintenance_run_id is distinct from old.created_by_maintenance_run_id or
   new.created_at is distinct from old.created_at or new.revision<>old.revision+1 or old.state='CANCELLED' then
   raise exception 'Dated demand identity cannot change'; end if;
 elsif tg_table_name='site_shift_template_versions' then
  if new.id is distinct from old.id or new.line_id is distinct from old.line_id or new.service_id is distinct from old.service_id or
   new.version is distinct from old.version or new.effective_from is distinct from old.effective_from or
   new.weekdays is distinct from old.weekdays or new.role_id is distinct from old.role_id or
   new.required_quantity is distinct from old.required_quantity or new.report_time is distinct from old.report_time or
   new.shift_start_time is distinct from old.shift_start_time or new.shift_end_time is distinct from old.shift_end_time or
   new.area_label is distinct from old.area_label or new.reporting_point is distinct from old.reporting_point or
   new.actor_person_id is distinct from old.actor_person_id or new.published_at is distinct from old.published_at or
   new.reason is distinct from old.reason or old.effective_until is not null or new.effective_until<=old.effective_from then
   raise exception 'Published template is immutable'; end if;
 end if;
 return new;
end $$;

create or replace function public.site_service_history(p_site uuid,p_service uuid,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_offset is null or p_offset<0 or p_offset>10000 or
  p_limit is null or p_limit<1 or p_limit>100 or
  not exists(select 1 from public.site_services where id=p_service and site_id=p_site)
  then raise exception 'Service history denied'; end if;
 with entries as materialized (
  select 'SERVICE'::text as source,e.service_id as record_id,e.kind,e.new_revision as revision,
   e.occurred_at,e.actor_person_id,null::uuid as maintenance_run_id,e.reason,e.snapshot
  from public.site_service_events e where e.service_id=p_service
  union all
  select 'TEMPLATE',e.line_id,e.kind,v.version,e.occurred_at,e.actor_person_id,null::uuid,e.reason,
   jsonb_build_object('version_id',e.version_id,'effective_on',e.effective_on)
  from public.site_shift_template_events e join public.site_shift_template_versions v on v.id=e.version_id
   where v.service_id=p_service
  union all
  select 'DATED_SHIFT',e.demand_id,e.kind,e.revision,e.occurred_at,e.actor_person_id,e.maintenance_run_id,e.reason,e.snapshot
   from public.site_shift_demand_events e where e.service_id=p_service
  union all
  select 'ALLOCATION',e.allocation_id,e.kind,e.new_revision,e.occurred_at,e.actor_person_id,null::uuid,null::text,
   jsonb_build_object('demand_id',e.demand_id,'status',e.new_status)
  from public.site_shift_allocation_events e join public.site_shift_demands d on d.id=e.demand_id
   where d.service_id=p_service
 ), page as (
  select e.*,coalesce(p.display_name,'SYSTEM maintenance') as actor_name,
   case when e.actor_person_id is null then 'SYSTEM' else 'PERSON' end as actor_kind
  from entries e left join public.people p on p.id=e.actor_person_id
  order by e.occurred_at desc,e.source,e.record_id offset p_offset limit p_limit
 )
 select jsonb_build_object('total',(select count(*) from entries),
  'items',coalesce((select jsonb_agg(to_jsonb(page) order by occurred_at desc,source,record_id) from page),'[]'::jsonb))
  into result;
 return result;
end $$;
revoke all on function public.site_service_history(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.site_service_history(uuid,uuid,integer,integer) to authenticated;

create or replace function private.site_shift_maintenance_run_08d()
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_run_id uuid;
 start_day date:=private.uk_today();
 setting_weeks integer;
 svc record;
 changed integer;
 succeeded integer:=0;
 failed integer:=0;
 v_failure_code text;
begin
 select horizon_weeks into setting_weeks from public.site_shift_settings where singleton;
 if setting_weeks is null or setting_weeks not between 1 and 26 then raise exception 'Maintenance settings invalid'; end if;
 insert into private.site_shift_maintenance_runs_08d(trigger_kind,window_from,window_until,horizon_weeks,state)
 values('SCHEDULED',start_day,start_day+(setting_weeks*7),setting_weeks,'RUNNING') returning id into v_run_id;
 if not pg_try_advisory_xact_lock(hashtextextended('kss.site_shift_maintenance_08d',0)) then
  update private.site_shift_maintenance_runs_08d set state='SKIPPED_LOCKED',completed_at=transaction_timestamp()
   where id=v_run_id;
  return v_run_id;
 end if;
 perform set_config('kss.maintenance_run_08d',v_run_id::text,true);
 perform set_config('kss.write_08a','allowed',true);
 for svc in select id from public.site_services
  where state in ('ACTIVE','PAUSED') or (state='ENDED' and effective_until>start_day)
  order by id loop
  insert into private.site_shift_maintenance_service_runs_08d(run_id,service_id,state)
   values(v_run_id,svc.id,'RUNNING');
  begin
   changed:=private.site_shift_generate_08a(svc.id,start_day,start_day+(setting_weeks*7),null,'Scheduled horizon maintenance');
   update private.site_shift_maintenance_service_runs_08d as sr set state='SUCCEEDED',changed_count=changed,
    completed_at=transaction_timestamp() where sr.run_id=v_run_id and sr.service_id=svc.id;
   succeeded:=succeeded+1;
  exception when others then
   v_failure_code:=case
    when sqlerrm like '%allocation reconciliation%' or sqlerrm like '%Active allocations%' then 'ACTIVE_ALLOCATIONS_REQUIRE_RECONCILIATION'
    when sqlerrm like '%Local shift time%' then 'INVALID_LOCAL_TIME'
    when sqlerrm like '%Invalid template duty%' then 'INVALID_TEMPLATE_DUTY'
    when sqlerrm like '%Generation range%' or sqlerrm like '%Generation actor%' then 'GENERATION_REJECTED'
    else 'DATABASE_ERROR' end;
   update private.site_shift_maintenance_service_runs_08d as sr set state='FAILED',failure_code=v_failure_code,
    completed_at=transaction_timestamp() where sr.run_id=v_run_id and sr.service_id=svc.id;
   failed:=failed+1;
  end;
 end loop;
 update private.site_shift_maintenance_runs_08d set
  state=case when failed=0 then 'SUCCEEDED' when succeeded=0 then 'FAILED' else 'PARTIAL_FAILURE' end,
  completed_at=transaction_timestamp(),
  services_total=succeeded+failed,services_succeeded=succeeded,services_failed=failed
  where id=v_run_id;
 return v_run_id;
end $$;
revoke all on function private.site_shift_maintenance_run_08d() from public,anon,authenticated;
grant execute on function private.site_shift_maintenance_run_08d() to postgres;

create or replace function public.site_shift_maintenance_status_08d(p_limit integer default 10)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.site_shift_admin_08a() or p_limit is null or p_limit<1 or p_limit>30 then
  raise exception 'Maintenance status denied';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'run_id',r.id,'state',r.state,'window_from',r.window_from,'window_until',r.window_until,
  'horizon_weeks',r.horizon_weeks,'started_at',r.started_at,'completed_at',r.completed_at,
  'services_total',r.services_total,'services_succeeded',r.services_succeeded,'services_failed',r.services_failed,
  'services',(select coalesce(jsonb_agg(jsonb_build_object('service_id',sr.service_id,'service_name',sv.name,
    'state',sr.state,'changed_count',sr.changed_count,'failure_code',sr.failure_code,
    'started_at',sr.started_at,'completed_at',sr.completed_at) order by sv.name,sr.service_id),'[]'::jsonb)
    from private.site_shift_maintenance_service_runs_08d sr join public.site_services sv on sv.id=sr.service_id
    where sr.run_id=r.id)
  ) order by r.started_at desc),'[]'::jsonb) into result
 from (select * from private.site_shift_maintenance_runs_08d order by started_at desc limit p_limit) r;
 return result;
end $$;
revoke all on function public.site_shift_maintenance_status_08d(integer) from public,anon,authenticated;
grant execute on function public.site_shift_maintenance_status_08d(integer) to authenticated;

-- A status read returns maintenance state only and cannot materialise demand.

do $$ declare existing_job record; begin
 for existing_job in select jobid from cron.job where jobname='kss-site-shift-horizon-08d' loop
  perform cron.unschedule(existing_job.jobid);
 end loop;
 perform cron.schedule('kss-site-shift-horizon-08d','17 3 * * *',
  'select private.site_shift_maintenance_run_08d();');
end $$;
