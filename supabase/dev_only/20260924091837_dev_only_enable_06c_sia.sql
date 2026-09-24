-- TASK-06C development-only policy activation. Keep outside supabase/migrations.
-- Apply only to the exact KSS Enterprise Dev project dnfhkmmnlbiabqypclqg.
-- Normal migration replay leaves the synthetic SIA rule disabled in staging/production.
do $$ begin
 if (select count(*) from public.operational_role_check_policies where
  rule_code='SYNTHETIC_SIA_SECURITY_GUARDING' and development_only and version=1 and not enabled)<>1 then
  raise exception 'Expected one disabled synthetic SIA rule'; end if;
 update public.operational_role_check_policies set enabled=true
  where rule_code='SYNTHETIC_SIA_SECURITY_GUARDING' and development_only and version=1;
end $$;
