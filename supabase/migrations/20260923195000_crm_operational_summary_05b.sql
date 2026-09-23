-- TASK-05B grounded counts, all under the same active CRM role predicate.
create function public.crm_operational_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date; tomorrow date; next_week date;
begin
 if not private.crm_authorised() then raise exception 'CRM access denied'; end if;
 today := (now() at time zone 'Europe/London')::date;
 tomorrow := today + 1;
 next_week := today + 7;
 return jsonb_build_object(
  'dueToday',(select count(*) from public.tasks t where t.task_type='CRM_FOLLOW_UP' and t.state='OPEN'
    and t.due_at is not null and (t.due_at at time zone 'Europe/London')::date=today),
  'overdue',(select count(*) from public.tasks t where t.task_type='CRM_FOLLOW_UP' and t.state='OPEN'
    and t.due_at<now()),
  'noFutureFollowUp',(select count(*) from public.crm_opportunities o where o.stage not in ('WON','LOST')
    and not exists(select 1 from public.tasks t where t.task_type='CRM_FOLLOW_UP'
      and t.source_kind='CRM_OPPORTUNITY' and t.source_id=o.id and t.state='OPEN'
      and t.due_at>=now())),
  'decisionsNextSevenDays',(select count(*) from public.crm_opportunities o where o.stage not in ('WON','LOST')
    and o.expected_decision_date>=today and o.expected_decision_date<next_week));
end $$;
revoke all on function public.crm_operational_summary() from public,anon,authenticated;
grant execute on function public.crm_operational_summary() to authenticated;
