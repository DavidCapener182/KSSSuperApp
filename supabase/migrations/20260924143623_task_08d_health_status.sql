-- Narrow administrator readout for the 08D scheduler and its 36-hour stale-success threshold.
create or replace function public.site_shift_maintenance_health_08d()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 weeks integer;
 latest_id uuid;
 latest_state text;
 latest_started timestamptz;
 latest_completed timestamptz;
 latest_total integer;
 latest_succeeded integer;
 latest_failed integer;
 last_success timestamptz;
begin
 if not private.site_shift_admin_08a() then raise exception 'Maintenance health denied'; end if;
 select horizon_weeks into weeks from public.site_shift_settings where singleton;
 select r.id,r.state,r.started_at,r.completed_at,r.services_total,r.services_succeeded,r.services_failed
  into latest_id,latest_state,latest_started,latest_completed,latest_total,latest_succeeded,latest_failed
  from private.site_shift_maintenance_runs_08d r order by r.started_at desc limit 1;
 select max(completed_at) into last_success from private.site_shift_maintenance_runs_08d where state='SUCCEEDED';
 return jsonb_build_object(
  'checked_at',transaction_timestamp(),
  'window_from',private.uk_today(),
  'window_until',private.uk_today()+(weeks*7),
  'horizon_weeks',weeks,
  'last_run_id',latest_id,
  'last_run_state',latest_state,
  'last_run_started_at',latest_started,
  'last_run_completed_at',latest_completed,
  'last_run_services_total',latest_total,
  'last_run_services_succeeded',latest_succeeded,
  'last_run_services_failed',latest_failed,
  'last_success_at',last_success,
  'overdue_after_hours',36,
  'overdue',last_success is null or last_success<transaction_timestamp()-interval '36 hours');
end $$;
revoke all on function public.site_shift_maintenance_health_08d() from public,anon,authenticated;
grant execute on function public.site_shift_maintenance_health_08d() to authenticated;
