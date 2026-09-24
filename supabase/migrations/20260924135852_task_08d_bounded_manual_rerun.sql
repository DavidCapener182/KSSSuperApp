-- TASK-08D operator recovery: rerun only the current configured forward horizon.
alter table private.site_shift_maintenance_runs_08d
 add column requested_by_person_id uuid references public.people(id),
 add constraint site_shift_maintenance_requester_08d check
  ((trigger_kind='SCHEDULED' and requested_by_person_id is null) or
   (trigger_kind='MANUAL_RERUN' and requested_by_person_id is not null));

create or replace function private.site_shift_maintenance_run_08d()
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_run_id uuid;
 v_trigger text:=coalesce(nullif(current_setting('kss.maintenance_trigger_08d',true),''),'SCHEDULED');
 v_requester uuid:=nullif(current_setting('kss.maintenance_requested_by_08d',true),'')::uuid;
 start_day date:=private.uk_today();
 setting_weeks integer;
 svc record;
 changed integer;
 succeeded integer:=0;
 failed integer:=0;
 v_failure_code text;
begin
 if v_trigger not in ('SCHEDULED','MANUAL_RERUN') or
  (v_trigger='SCHEDULED' and v_requester is not null) or
  (v_trigger='MANUAL_RERUN' and v_requester is null) then
  raise exception 'Maintenance trigger denied';
 end if;
 select horizon_weeks into setting_weeks from public.site_shift_settings where singleton;
 if setting_weeks is null or setting_weeks not between 1 and 26 then raise exception 'Maintenance settings invalid'; end if;
 insert into private.site_shift_maintenance_runs_08d(trigger_kind,requested_by_person_id,window_from,window_until,
  horizon_weeks,state)
 values(v_trigger,v_requester,start_day,start_day+(setting_weeks*7),setting_weeks,'RUNNING') returning id into v_run_id;
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
   changed:=private.site_shift_generate_08a(svc.id,start_day,start_day+(setting_weeks*7),null,
    case when v_trigger='SCHEDULED' then 'Scheduled horizon maintenance' else 'Admin bounded horizon rerun' end);
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
  completed_at=transaction_timestamp(),services_total=succeeded+failed,
  services_succeeded=succeeded,services_failed=failed where id=v_run_id;
 return v_run_id;
end $$;
revoke all on function private.site_shift_maintenance_run_08d() from public,anon,authenticated;
grant execute on function private.site_shift_maintenance_run_08d() to postgres;

create or replace function public.site_shift_maintenance_rerun_08d()
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid;
begin
 if actor is null or not private.site_shift_admin_08a() then raise exception 'Maintenance rerun denied'; end if;
 perform set_config('kss.maintenance_trigger_08d','MANUAL_RERUN',true);
 perform set_config('kss.maintenance_requested_by_08d',actor::text,true);
 result:=private.site_shift_maintenance_run_08d();
 return result;
end $$;
revoke all on function public.site_shift_maintenance_rerun_08d() from public,anon,authenticated;
grant execute on function public.site_shift_maintenance_rerun_08d() to authenticated;
