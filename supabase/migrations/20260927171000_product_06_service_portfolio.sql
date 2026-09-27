-- PRODUCT-06: scoped, factual Service Delivery portfolio. No source writes or service score.
create function public.service_delivery_portfolio(
 p_view text default 'all', p_client text default null, p_site text default null,
 p_service text default null, p_owner uuid default null, p_state text default null,
 p_date_from date default null, p_date_to date default null,
 p_offset integer default 0, p_limit integer default 25
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := private.service_delivery_actor(); today_london date := (transaction_timestamp() at time zone 'Europe/London')::date;
begin
 if p_view not in ('all','mine','reviews_due','actions_overdue','meetings_upcoming','changes_awaiting')
   or p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50
   or length(coalesce(p_client,''))>80 or length(coalesce(p_site,''))>80 or length(coalesce(p_service,''))>80
   or (p_state is not null and p_state not in ('PROPOSED','ACTIVE','CLOSING','CLOSED','CANCELLED'))
   or (p_date_from is not null and p_date_to is not null and p_date_from>p_date_to)
 then raise exception 'Invalid portfolio selection'; end if;

 return (
 with scoped as materialized (
  select d.id,d.created_at,d.state,d.owner_person_id,owner.display_name owner_name,
   o.name client_name,si.name site_name,s.name service_name,
   private.service_delivery_owner_ok(d.owner_person_id,true) owner_eligible,
   review.next_review_on,review.due_count review_due_count,
   actions.open_count open_action_count,actions.overdue_count overdue_action_count,actions.earliest_overdue_on,
   blockers.open_count open_blocker_count,
   meetings.next_meeting_at,
   changes.awaiting_count changes_awaiting_count,changes.earliest_requested_on,changes.source_drift_count
  from public.service_deliveries d
  join public.crm_organisations o on o.id=d.organisation_id
  join public.sites si on si.id=d.site_id
  join public.site_services s on s.id=d.site_service_id
  join public.site_client_links link on link.id=d.site_client_link_id and link.site_id=d.site_id and link.organisation_id=d.organisation_id
  join public.people owner on owner.id=d.owner_person_id
  cross join lateral (select min(p.ends_on) filter (where p.state='OPEN') next_review_on,
    count(*) filter (where p.state='OPEN' and p.ends_on<=today_london) due_count
    from public.service_review_periods p where p.service_delivery_id=d.id) review
  cross join lateral (select count(*) filter (where a.state not in ('DONE','CANCELLED')) open_count,
    count(*) filter (where a.state not in ('DONE','CANCELLED') and a.due_on<today_london) overdue_count,
    min(a.due_on) filter (where a.state not in ('DONE','CANCELLED') and a.due_on<today_london) earliest_overdue_on
    from public.service_delivery_actions a where a.service_delivery_id=d.id) actions
  cross join lateral (select count(*) open_count from public.service_delivery_blockers b
    join public.service_delivery_actions a on a.id=b.action_id
    where a.service_delivery_id=d.id and b.resolved_at is null) blockers
  cross join lateral (select min(m.scheduled_at) filter (where m.state='SCHEDULED' and m.scheduled_at>=transaction_timestamp()) next_meeting_at
    from public.service_review_meetings m join public.service_review_periods p on p.id=m.period_id
    where p.service_delivery_id=d.id) meetings
  cross join lateral (select count(*) filter (where c.state='APPROVED' and c.application_outcome is null) awaiting_count,
    min((c.requested_effective_at at time zone 'Europe/London')::date) filter (where c.state='APPROVED' and c.application_outcome is null) earliest_requested_on,
    count(*) filter (where c.application_outcome='APPLIED' and c.application_revision is distinct from s.revision) source_drift_count
    from public.service_change_requests c where c.service_delivery_id=d.id) changes
  where (nullif(trim(p_client),'') is null or o.name ilike '%'||trim(p_client)||'%')
    and (nullif(trim(p_site),'') is null or si.name ilike '%'||trim(p_site)||'%')
    and (nullif(trim(p_service),'') is null or s.name ilike '%'||trim(p_service)||'%')
    and (p_owner is null or d.owner_person_id=p_owner)
    and (p_state is null or d.state=p_state)
 ), dated as (
  select x.*,
   case p_view
    when 'reviews_due' then x.next_review_on
    when 'actions_overdue' then x.earliest_overdue_on
    when 'meetings_upcoming' then (x.next_meeting_at at time zone 'Europe/London')::date
    when 'changes_awaiting' then x.earliest_requested_on
    else coalesce(x.next_review_on,(x.next_meeting_at at time zone 'Europe/London')::date,(x.created_at at time zone 'Europe/London')::date)
   end focus_date
  from scoped x
 ), filtered as materialized (
  select * from dated x where
   (p_view='all' or (p_view='mine' and x.owner_person_id=actor)
    or (p_view='reviews_due' and x.review_due_count>0)
    or (p_view='actions_overdue' and x.overdue_action_count>0)
    or (p_view='meetings_upcoming' and x.next_meeting_at is not null)
    or (p_view='changes_awaiting' and x.changes_awaiting_count>0))
   and (p_date_from is null or x.focus_date>=p_date_from)
   and (p_date_to is null or x.focus_date<=p_date_to)
 ), page as (
  select * from filtered order by focus_date nulls last,created_at desc,id limit p_limit offset p_offset
 )
 select jsonb_build_object(
  'asOf',transaction_timestamp(),'londonToday',today_london,'total',(select count(*) from filtered),
  'owners',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by p.display_name,p.id),'[]'::jsonb)
    from public.people p where exists(select 1 from public.service_deliveries owned where owned.owner_person_id=p.id)),
  'items',(select coalesce(jsonb_agg(to_jsonb(page) order by focus_date nulls last,created_at desc,id),'[]'::jsonb) from page)
 )
 );
end $$;
revoke all on function public.service_delivery_portfolio(text,text,text,text,uuid,text,date,date,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.service_delivery_portfolio(text,text,text,text,uuid,text,date,date,integer,integer) to authenticated;

-- A candidate is an exact current source event eligible for the existing 21D recorder command.
-- This read never applies a change and exposes no event snapshot or private source content.
create function public.service_change_application_candidate(p_delivery uuid,p_change uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := private.service_delivery_actor(); d public.service_deliveries%rowtype;
 r public.service_change_requests%rowtype; s public.site_services%rowtype; result jsonb;
begin
 d := private.service_change_scope(p_delivery);
 if not private.service_change_has_grant(p_delivery,actor,'SERVICE_CHANGE_RECORDER') then raise exception 'Recorder grant required'; end if;
 select * into r from public.service_change_requests where id=p_change and service_delivery_id=d.id;
 if not found or r.state<>'APPROVED' or r.application_outcome is not null or r.target_domain<>'SITE_SERVICE' or r.target_id<>d.site_service_id then
  raise exception 'Pending exact change unavailable';
 end if;
 select * into s from public.site_services where id=d.site_service_id;
 select jsonb_build_object('eventId',e.id,'kind',e.kind,'previousRevision',e.previous_revision,
  'newRevision',e.new_revision,'effectiveOn',e.effective_on,'occurredAt',e.occurred_at)
 into result from public.site_service_events e
 where e.service_id=s.id and e.previous_revision=r.baseline_revision and e.new_revision=s.revision
  and e.new_revision>r.baseline_revision and e.occurred_at>=r.decided_at
  and e.effective_on>=(r.decided_at at time zone 'Europe/London')::date;
 return jsonb_build_object('changeId',r.id,'currentSourceRevision',s.revision,'candidate',result);
end $$;
revoke all on function public.service_change_application_candidate(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.service_change_application_candidate(uuid,uuid) to authenticated;
