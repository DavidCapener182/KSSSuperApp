-- TASK-17B: active Enterprise role required; calendar-only grant cannot read full request history.
create or replace function private.time_away_granted(p_team uuid,p_action text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_any_active_role() and exists(select 1 from public.time_away_approver_grants g join public.time_away_teams t on t.id=g.team_id
  where g.person_id=private.current_person_id() and g.team_id=p_team and t.active and g.revoked_at is null
   and g.effective_from<=transaction_timestamp() and (g.effective_until is null or g.effective_until>transaction_timestamp())
   and p_action=any(g.actions))
$$;

create or replace function public.time_away_authority() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
 actor:=private.current_person_id();
 if actor is null or not private.has_any_active_role() then return '{}'::jsonb; end if;
 select jsonb_build_object(
  'categories',(select jsonb_agg(jsonb_build_object('code',c.code,'version',c.version,'label',c.label) order by c.label)
   from public.time_away_categories c where c.active),
  'myTeams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) order by t.name),'[]'::jsonb)
   from public.time_away_team_memberships m join public.time_away_teams t on t.id=m.team_id
   where m.person_id=actor and t.active and m.revoked_at is null and m.effective_from<=private.time_away_london_today()
    and (m.effective_until is null or m.effective_until>=private.time_away_london_today())),
  'managerTeams',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'actions',x.actions)
   order by x.name),'[]'::jsonb) from (select t.id,t.name,array_agg(distinct grant_action.code) as actions
   from public.time_away_approver_grants g join public.time_away_teams t on t.id=g.team_id
    cross join lateral unnest(g.actions) as grant_action(code)
   where g.person_id=actor and t.active and g.revoked_at is null and g.effective_from<=transaction_timestamp()
    and (g.effective_until is null or g.effective_until>transaction_timestamp()) group by t.id,t.name) x),
  'canAdmin',private.time_away_admin()) into result;
 return result;
end $$;

create or replace function public.time_away_transition(p_request uuid,p_action text,p_expected_revision integer,
 p_key uuid,p_reason text default null,p_note text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid; r public.time_away_requests%rowtype; next_state text; required_action text;
 decision_kind text; snapshot jsonb; prior public.time_away_request_events%rowtype;
begin
 actor:=private.current_person_id();
 if actor is null or not private.has_any_active_role() or p_key is null or p_expected_revision is null then raise exception 'Time Away action denied'; end if;
 select * into prior from public.time_away_request_events where actor_person_id=actor and kind=p_action and idempotency_key=p_key;
 if prior.id is not null then
  if prior.request_id<>p_request then raise exception 'Idempotency key reused'; end if;
  return prior.revision;
 end if;
 select * into r from public.time_away_requests where id=p_request for update;
 if r.id is null or r.revision<>p_expected_revision then raise exception 'Stale or inaccessible Time Away request'; end if;
 if p_action='WITHDRAWN' and r.state='SUBMITTED' and r.person_id=actor then next_state:='WITHDRAWN';
 elsif p_action='CANCELLATION_REQUESTED' and r.state='APPROVED' and r.person_id=actor then next_state:='CANCELLATION_REQUESTED';
 elsif p_action in ('APPROVED','DECLINED') and r.state='SUBMITTED' and r.person_id<>actor then
  required_action:='DECIDE_REQUEST';next_state:=p_action;decision_kind:=p_action;
 elsif p_action in ('CANCELLATION_APPROVED','CANCELLATION_REJECTED') and r.state='CANCELLATION_REQUESTED'
  and r.person_id<>actor then
  required_action:='DECIDE_CANCELLATION';
  next_state:=case when p_action='CANCELLATION_APPROVED' then 'CANCELLED' else 'APPROVED' end;
  decision_kind:=p_action;
 else raise exception 'Time Away action denied'; end if;
 if required_action is not null and not private.time_away_granted(r.team_id,required_action)
 then raise exception 'Time Away approver grant required'; end if;
 if decision_kind is not null then
  if p_reason is null or p_reason not in ('APPROVED_AS_REQUESTED','STAFFING_CONFLICT','REQUEST_NOT_SUPPORTED',
   'OTHER','CANCELLATION_ACCEPTED','CANCELLATION_NOT_SUPPORTED')
   or (p_action='APPROVED' and p_reason<>'APPROVED_AS_REQUESTED')
   or (p_action='DECLINED' and p_reason not in ('STAFFING_CONFLICT','REQUEST_NOT_SUPPORTED','OTHER'))
   or (p_action='CANCELLATION_APPROVED' and p_reason<>'CANCELLATION_ACCEPTED')
   or (p_action='CANCELLATION_REJECTED' and p_reason not in ('CANCELLATION_NOT_SUPPORTED','OTHER'))
   or (p_note is not null and (length(trim(p_note)) not between 3 and 200 or p_note ~ '[[:cntrl:]]'))
  then raise exception 'Controlled Time Away reason required'; end if;
 elsif p_reason is not null or p_note is not null then raise exception 'Unexpected Time Away reason'; end if;
 snapshot:=private.time_away_snapshot(r.id);
 if decision_kind is not null then
  insert into public.time_away_decisions(request_id,request_revision,actor_person_id,kind,reason_code,note,
   category_code,category_version,team_id,segment_snapshot)
  values(r.id,r.revision,actor,decision_kind,p_reason,nullif(trim(p_note),''),r.category_code,r.category_version,
   r.team_id,snapshot);
 end if;
 update public.time_away_requests set state=next_state,revision=revision+1,updated_at=transaction_timestamp()
  where id=r.id;
 insert into public.time_away_request_events(request_id,revision,actor_person_id,kind,old_state,new_state,team_id,
  category_code,category_version,segment_snapshot,idempotency_key)
 values(r.id,r.revision+1,actor,p_action,r.state,next_state,r.team_id,r.category_code,r.category_version,snapshot,p_key);
 return r.revision+1;
end $$;

create or replace function public.time_away_list(p_team uuid default null,p_from date default null,p_to date default null,
 p_offset integer default 0,p_limit integer default 25,p_action text default 'VIEW_REQUESTS') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
 actor:=private.current_person_id();
 if actor is null or not private.has_any_active_role() or p_offset not between 0 and 10000 or p_limit not between 1 and 50
  or (p_from is not null and p_to is not null and (p_to<p_from or p_to>p_from+interval '93 days'))
  or p_action not in ('VIEW_REQUESTS','VIEW_CALENDAR','VIEW_COVERAGE')
 then raise exception 'Time Away list denied'; end if;
 if p_team is not null and not private.time_away_granted(p_team,p_action)
 then raise exception 'Time Away team denied'; end if;
 with scoped as materialized (
  select r.id,r.person_id,r.team_id,r.category_code,r.category_label,r.state,r.revision,
   r.created_at,r.submitted_at,p.display_name,
   min(s.local_date) as starts_on,max(s.local_date) as ends_on
  from public.time_away_requests r join public.people p on p.id=r.person_id
   join public.time_away_segments s on s.request_id=r.id
  where ((p_team is null and r.person_id=actor) or (p_team is not null and r.team_id=p_team))
   and (p_team is null or private.time_away_granted(r.team_id,p_action))
   and (p_from is null or s.local_date>=p_from) and (p_to is null or s.local_date<=p_to)
  group by r.id,p.display_name
 ), page as (select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'personId',q.person_id,
   'personName',q.display_name,'teamId',q.team_id,'categoryCode',q.category_code,
   'categoryLabel',q.category_label,'state',q.state,'revision',q.revision,'startsOn',q.starts_on,
   'endsOn',q.ends_on,'submittedAt',q.submitted_at) order by q.created_at desc,q.id desc) from page q),'[]'::jsonb))
 into result;
 return result;
end $$;

create or replace function public.time_away_detail(p_request uuid,p_action text default 'VIEW_REQUESTS') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.time_away_requests%rowtype; actor uuid; result jsonb; is_owner boolean;
begin
 actor:=private.current_person_id();
 if actor is null or not private.has_any_active_role() or p_action<>'VIEW_REQUESTS'
  or not private.time_away_can_read(p_request,p_action) then raise exception 'Time Away request denied'; end if;
 select * into r from public.time_away_requests where id=p_request;
 is_owner:=r.person_id=actor;
 select jsonb_build_object('id',r.id,'personId',r.person_id,'personName',p.display_name,
  'teamId',r.team_id,'teamName',t.name,'categoryCode',r.category_code,'categoryVersion',r.category_version,
  'categoryLabel',r.category_label,'state',r.state,'revision',r.revision,'submittedAt',r.submitted_at,
  'segments',private.time_away_snapshot(r.id),
  'history',(select coalesce(jsonb_agg(jsonb_build_object('revision',e.revision,'kind',e.kind,
   'oldState',e.old_state,'newState',e.new_state,'actorPersonId',e.actor_person_id,
   'occurredAt',e.occurred_at) order by e.revision),'[]'::jsonb)
   from public.time_away_request_events e where e.request_id=r.id),
  'decisions',(select coalesce(jsonb_agg(jsonb_build_object('kind',d.kind,'reasonCode',d.reason_code,
   'note',case when is_owner then d.note else null end,'requestRevision',d.request_revision,
   'actorPersonId',d.actor_person_id,'occurredAt',d.occurred_at) order by d.occurred_at),'[]'::jsonb)
   from public.time_away_decisions d where d.request_id=r.id)) into result
 from public.people p left join public.time_away_teams t on t.id=r.team_id where p.id=r.person_id;
 return result;
end $$;
