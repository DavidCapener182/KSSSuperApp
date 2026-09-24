-- TASK-17B: synthetic Dev Time Away authority and request ledger.
-- No allocation, availability, attendance, worked-time or pay writer is called here.
create table public.time_away_teams (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check (length(trim(name)) between 3 and 100 and name !~ '[[:cntrl:]]'),
 description text check (description is null or (length(trim(description)) between 3 and 200 and description !~ '[[:cntrl:]]')),
 active boolean not null default true,
 revision integer not null default 1 check (revision>0),
 created_by uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp()
);
create table public.time_away_team_memberships (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.time_away_teams(id),
 person_id uuid not null references public.people(id),
 effective_from date not null,
 effective_until date,
 added_by uuid not null references public.people(id),
 reason text not null check (length(trim(reason)) between 10 and 300 and reason !~ '[[:cntrl:]]'),
 revision integer not null default 1 check (revision>0),
 revoked_at timestamptz,
 revoked_by uuid references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 check (effective_until is null or effective_until>=effective_from),
 check ((revoked_at is null)=(revoked_by is null))
);
create index time_away_members_person_idx on public.time_away_team_memberships(person_id,effective_from,effective_until) where revoked_at is null;
create table public.time_away_approver_grants (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.time_away_teams(id),
 person_id uuid not null references public.people(id),
 actions text[] not null check (array_length(actions,1) between 1 and 5 and actions <@ array['VIEW_REQUESTS','DECIDE_REQUEST','DECIDE_CANCELLATION','VIEW_CALENDAR','VIEW_COVERAGE']::text[]),
 effective_from timestamptz not null,
 effective_until timestamptz,
 granted_by uuid not null references public.people(id),
 reason text not null check (length(trim(reason)) between 10 and 300 and reason !~ '[[:cntrl:]]'),
 revoked_at timestamptz,
 revoked_by uuid references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 check (effective_until is null or effective_until>effective_from),
 check ((revoked_at is null)=(revoked_by is null))
);
create index time_away_approver_idx on public.time_away_approver_grants(person_id,team_id) where revoked_at is null;
create table public.time_away_authority_events (
 id uuid primary key default gen_random_uuid(),
 entity_type text not null check(entity_type in ('TEAM','MEMBERSHIP','APPROVER_GRANT')),
 entity_id uuid not null,
 revision integer not null check(revision>0),
 actor_person_id uuid not null references public.people(id),
 kind text not null check(kind in ('CREATED','UPDATED','REVOKED')),
 snapshot jsonb not null,
 occurred_at timestamptz not null default transaction_timestamp(),
 unique(entity_type,entity_id,revision)
);
create table public.time_away_categories (
 code text not null,
 version integer not null check(version>0),
 label text not null,
 active boolean not null default true,
 primary key(code,version),
 check(code in ('ANNUAL_LEAVE','UNPAID_LEAVE','OTHER_TIME_AWAY'))
);
insert into public.time_away_categories(code,version,label) values
 ('ANNUAL_LEAVE',1,'Annual Leave'),('UNPAID_LEAVE',1,'Unpaid Leave'),('OTHER_TIME_AWAY',1,'Other Time Away');
create table public.time_away_requests (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.people(id),
 team_id uuid references public.time_away_teams(id),
 category_code text not null,
 category_version integer not null,
 category_label text not null,
 state text not null default 'DRAFT' check(state in ('DRAFT','SUBMITTED','APPROVED','CANCELLATION_REQUESTED','DECLINED','WITHDRAWN','CANCELLED')),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default transaction_timestamp(),
 submitted_at timestamptz,
 updated_at timestamptz not null default transaction_timestamp(),
 foreign key(category_code,category_version) references public.time_away_categories(code,version),
 check ((state='DRAFT' and submitted_at is null) or (state<>'DRAFT' and submitted_at is not null))
);
create index time_away_requests_person_idx on public.time_away_requests(person_id,created_at desc);
create index time_away_requests_team_idx on public.time_away_requests(team_id,state,created_at desc);
create table public.time_away_segments (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.time_away_requests(id),
 ordinal integer not null check(ordinal>0),
 kind text not null check(kind in ('WHOLE_DAY','PARTIAL_DAY')),
 local_date date not null,
 starts_local time,
 ends_local time,
 starts_at timestamptz,
 ends_at timestamptz,
 unique(request_id,ordinal),
 check ((kind='WHOLE_DAY' and starts_local is null and ends_local is null and starts_at is null and ends_at is null)
  or (kind='PARTIAL_DAY' and starts_local is not null and ends_local is not null and starts_at is not null and ends_at is not null
   and starts_local<ends_local and starts_at<ends_at))
);
create table public.time_away_request_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.time_away_requests(id),
 revision integer not null check(revision>0),
 actor_person_id uuid not null references public.people(id),
 kind text not null check(kind in ('DRAFT_CREATED','DRAFT_EDITED','SUBMITTED','WITHDRAWN','APPROVED','DECLINED','CANCELLATION_REQUESTED','CANCELLATION_APPROVED','CANCELLATION_REJECTED')),
 old_state text,
 new_state text not null,
 team_id uuid references public.time_away_teams(id),
 category_code text not null,
 category_version integer not null,
 segment_snapshot jsonb not null,
 idempotency_key uuid not null,
 occurred_at timestamptz not null default transaction_timestamp(),
 unique(request_id,revision),
 unique(actor_person_id,kind,idempotency_key)
);
create table public.time_away_decisions (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.time_away_requests(id),
 request_revision integer not null,
 actor_person_id uuid not null references public.people(id),
 kind text not null check(kind in ('APPROVED','DECLINED','CANCELLATION_APPROVED','CANCELLATION_REJECTED')),
 reason_code text not null check(reason_code in ('APPROVED_AS_REQUESTED','STAFFING_CONFLICT','REQUEST_NOT_SUPPORTED','OTHER','CANCELLATION_ACCEPTED','CANCELLATION_NOT_SUPPORTED')),
 note text check(note is null or (length(trim(note)) between 3 and 200 and note !~ '[[:cntrl:]]')),
 category_code text not null,
 category_version integer not null,
 team_id uuid not null references public.time_away_teams(id),
 segment_snapshot jsonb not null,
 occurred_at timestamptz not null default transaction_timestamp(),
 unique(request_id,request_revision)
);

-- No direct table access. All reads and writes pass through bounded RPCs.
alter table public.time_away_teams enable row level security;
alter table public.time_away_team_memberships enable row level security;
alter table public.time_away_approver_grants enable row level security;
alter table public.time_away_authority_events enable row level security;
alter table public.time_away_categories enable row level security;
alter table public.time_away_requests enable row level security;
alter table public.time_away_segments enable row level security;
alter table public.time_away_request_events enable row level security;
alter table public.time_away_decisions enable row level security;
revoke all on public.time_away_teams,public.time_away_team_memberships,public.time_away_approver_grants,
 public.time_away_authority_events,public.time_away_categories,public.time_away_requests,
 public.time_away_segments,public.time_away_request_events,public.time_away_decisions from public,anon,authenticated;

create function private.time_away_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')
$$;
create function private.time_away_london_today() returns date language sql stable set search_path='' as $$
 select (transaction_timestamp() at time zone 'Europe/London')::date
$$;
create function private.time_away_member(p_person uuid,p_team uuid,p_day date) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.time_away_team_memberships m join public.time_away_teams t on t.id=m.team_id
  where m.person_id=p_person and m.team_id=p_team and t.active and m.revoked_at is null
   and m.effective_from<=p_day and (m.effective_until is null or m.effective_until>=p_day))
$$;
create function private.time_away_granted(p_team uuid,p_action text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.time_away_approver_grants g join public.time_away_teams t on t.id=g.team_id
  where g.person_id=private.current_person_id() and g.team_id=p_team and t.active and g.revoked_at is null
   and g.effective_from<=transaction_timestamp() and (g.effective_until is null or g.effective_until>transaction_timestamp())
   and p_action=any(g.actions))
$$;
-- PostgreSQL's default DST coercion is not used: exactly one valid London instant must exist.
create function private.time_away_resolve_local(p_local timestamp) returns timestamptz
language plpgsql stable set search_path='' as $$
declare result timestamptz; matches integer;
begin
 select count(distinct candidate),min(candidate) into matches,result from (
  select (p_local at time zone 'Europe/London')+(n*interval '1 hour') as candidate
  from generate_series(-2,2) n) x
 where candidate at time zone 'Europe/London'=p_local;
 if matches<>1 then raise exception 'Ambiguous or nonexistent Europe/London time'; end if;
 return result;
end $$;
revoke all on function private.time_away_admin(),private.time_away_london_today(),
 private.time_away_member(uuid,uuid,date),private.time_away_granted(uuid,text),
 private.time_away_resolve_local(timestamp) from public,anon,authenticated;

create function public.time_away_admin_action(p_action text,p_id uuid default null,p_team uuid default null,
 p_person uuid default null,p_name text default null,p_description text default null,p_start date default null,
 p_end date default null,p_until timestamptz default null,p_actions text[] default null,p_reason text default null,
 p_expected_revision integer default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; result uuid; old_team public.time_away_teams%rowtype; old_member public.time_away_team_memberships%rowtype;
 old_grant public.time_away_approver_grants%rowtype; revision_number integer;
begin
 actor:=private.current_person_id();
 if actor is null or not private.time_away_admin() or p_reason is null or length(trim(p_reason)) not between 10 and 300
  or p_reason ~ '[[:cntrl:]]' then raise exception 'Time Away administration denied'; end if;
 if p_action='CREATE_TEAM' then
  if p_name is null or length(trim(p_name)) not between 3 and 100 or p_name ~ '[[:cntrl:]]'
   or (p_description is not null and (length(trim(p_description)) not between 3 and 200 or p_description ~ '[[:cntrl:]]'))
  then raise exception 'Invalid Time Away team'; end if;
  insert into public.time_away_teams(name,description,created_by) values(trim(p_name),nullif(trim(p_description),''),actor)
   returning id into result;
  insert into public.time_away_authority_events(entity_type,entity_id,revision,actor_person_id,kind,snapshot)
   values('TEAM',result,1,actor,'CREATED',jsonb_build_object('name',trim(p_name),'active',true,'reason',trim(p_reason)));
 elsif p_action='SET_TEAM_ACTIVE' then
  select * into old_team from public.time_away_teams where id=p_id for update;
  if old_team.id is null or p_expected_revision is distinct from old_team.revision
   or p_actions is null or p_actions not in (array['ACTIVE']::text[],array['INACTIVE']::text[]) then
   raise exception 'Time Away team stale or invalid'; end if;
  update public.time_away_teams set active=(p_actions=array['ACTIVE']::text[]),revision=revision+1 where id=p_id;
  revision_number:=old_team.revision+1;result:=p_id;
  insert into public.time_away_authority_events(entity_type,entity_id,revision,actor_person_id,kind,snapshot)
   values('TEAM',result,revision_number,actor,'UPDATED',jsonb_build_object('active',p_actions=array['ACTIVE']::text[],'reason',trim(p_reason)));
 elsif p_action='ADD_MEMBER' then
  if p_person is null or p_team is null or p_start is null or p_start<private.time_away_london_today()
   or (p_end is not null and p_end<p_start) or not exists(select 1 from public.people where id=p_person)
   or not exists(select 1 from public.time_away_teams where id=p_team and active)
  then raise exception 'Time Away membership denied'; end if;
  -- An exact duplicate active membership is rejected; overlapping memberships across different teams are visible.
  if exists(select 1 from public.time_away_team_memberships m where m.person_id=p_person and m.team_id=p_team
   and m.revoked_at is null and m.effective_from<=coalesce(p_end,'infinity'::date)
   and coalesce(m.effective_until,'infinity'::date)>=p_start) then raise exception 'Overlapping team membership'; end if;
  insert into public.time_away_team_memberships(team_id,person_id,effective_from,effective_until,added_by,reason)
   values(p_team,p_person,p_start,p_end,actor,trim(p_reason)) returning id into result;
  insert into public.time_away_authority_events(entity_type,entity_id,revision,actor_person_id,kind,snapshot)
   values('MEMBERSHIP',result,1,actor,'CREATED',jsonb_build_object('teamId',p_team,'personId',p_person,
    'effectiveFrom',p_start,'effectiveUntil',p_end,'reason',trim(p_reason)));
 elsif p_action='REVOKE_MEMBER' then
  select * into old_member from public.time_away_team_memberships where id=p_id for update;
  if old_member.id is null then raise exception 'Time Away membership denied'; end if;
  result:=p_id;
  if old_member.revoked_at is not null then return result; end if;
  update public.time_away_team_memberships set revoked_at=transaction_timestamp(),revoked_by=actor,revision=revision+1 where id=p_id;
  insert into public.time_away_authority_events(entity_type,entity_id,revision,actor_person_id,kind,snapshot)
   values('MEMBERSHIP',result,old_member.revision+1,actor,'REVOKED',jsonb_build_object('teamId',old_member.team_id,
    'personId',old_member.person_id,'reason',trim(p_reason)));
 elsif p_action='GRANT_APPROVER' then
  if p_person is null or p_team is null or p_until is null or p_until<=transaction_timestamp()
   or p_until>transaction_timestamp()+interval '366 days' or p_actions is null or array_length(p_actions,1) not between 1 and 5
   or not p_actions <@ array['VIEW_REQUESTS','DECIDE_REQUEST','DECIDE_CANCELLATION','VIEW_CALENDAR','VIEW_COVERAGE']::text[]
   or not exists(select 1 from public.people where id=p_person)
   or not exists(select 1 from public.time_away_teams where id=p_team and active)
  then raise exception 'Time Away grant denied'; end if;
  insert into public.time_away_approver_grants(team_id,person_id,actions,effective_from,effective_until,granted_by,reason)
   values(p_team,p_person,p_actions,transaction_timestamp(),p_until,actor,trim(p_reason)) returning id into result;
  insert into public.time_away_authority_events(entity_type,entity_id,revision,actor_person_id,kind,snapshot)
   values('APPROVER_GRANT',result,1,actor,'CREATED',jsonb_build_object('teamId',p_team,'personId',p_person,
    'actions',p_actions,'effectiveUntil',p_until,'reason',trim(p_reason)));
 elsif p_action='REVOKE_APPROVER' then
  select * into old_grant from public.time_away_approver_grants where id=p_id for update;
  if old_grant.id is null then raise exception 'Time Away grant denied'; end if;
  result:=p_id;
  if old_grant.revoked_at is not null then return result; end if;
  update public.time_away_approver_grants set revoked_at=transaction_timestamp(),revoked_by=actor where id=p_id;
  insert into public.time_away_authority_events(entity_type,entity_id,revision,actor_person_id,kind,snapshot)
   values('APPROVER_GRANT',result,2,actor,'REVOKED',jsonb_build_object('teamId',old_grant.team_id,
    'personId',old_grant.person_id,'reason',trim(p_reason)));
 else raise exception 'Time Away administration denied'; end if;
 return result;
end $$;

create function public.time_away_authority() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
 actor:=private.current_person_id();
 if actor is null then return '{}'::jsonb; end if;
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

create function public.time_away_admin_read() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.time_away_admin() then raise exception 'Time Away administration denied'; end if;
 select jsonb_build_object(
  'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'active',t.active,
   'description',t.description,'revision',t.revision) order by t.name) from public.time_away_teams t),'[]'::jsonb),
  'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'teamId',m.team_id,'personId',m.person_id,
   'personName',p.display_name,'effectiveFrom',m.effective_from,'effectiveUntil',m.effective_until,'revokedAt',m.revoked_at)
   order by p.display_name) from public.time_away_team_memberships m join public.people p on p.id=m.person_id),'[]'::jsonb),
  'grants',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'teamId',g.team_id,'personId',g.person_id,
   'personName',p.display_name,'actions',g.actions,'effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,
   'revokedAt',g.revoked_at) order by p.display_name) from public.time_away_approver_grants g
   join public.people p on p.id=g.person_id),'[]'::jsonb),
  'people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name)
   order by p.display_name) from public.people p),'[]'::jsonb)) into result;
 return result;
end $$;

create function private.time_away_normalize_segments(p_segments jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item jsonb; result jsonb:='[]'::jsonb; d date; previous_date date; previous_end time;
 local_start time; local_end time; exact_start timestamptz; exact_end timestamptz; kind text;
begin
 if p_segments is null or jsonb_typeof(p_segments)<>'array' or jsonb_array_length(p_segments) not between 1 and 366
 then raise exception 'Enter 1 to 366 ordered dates'; end if;
 for item in select value from jsonb_array_elements(p_segments) loop
  if jsonb_typeof(item)<>'object' or (item->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
  then raise exception 'Invalid time-away date'; end if;
  d:=(item->>'date')::date;
  if d<private.time_away_london_today() or d>private.time_away_london_today()+interval '2 years'
  then raise exception 'Time-away date outside first-slice range'; end if;
  if previous_date is not null and d<previous_date then raise exception 'Segments must be ordered'; end if;
  kind:=item->>'kind';
  if kind='WHOLE_DAY' then
   if item ? 'startsLocal' or item ? 'endsLocal' or (previous_date is not null and d=previous_date)
   then raise exception 'Whole-day segment overlaps'; end if;
   result:=result || jsonb_build_array(jsonb_build_object('kind',kind,'date',d));
   previous_end:='24:00'::time;
  elsif kind='PARTIAL_DAY' then
   if (item->>'startsLocal') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or (item->>'endsLocal') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   then raise exception 'Enter explicit local hours and minutes'; end if;
   local_start:=(item->>'startsLocal')::time;local_end:=(item->>'endsLocal')::time;
   if local_start>=local_end or (previous_date=d and previous_end>local_start)
   then raise exception 'Partial segments overlap or cross midnight'; end if;
   exact_start:=private.time_away_resolve_local(d+local_start);
   exact_end:=private.time_away_resolve_local(d+local_end);
   if exact_end<=exact_start then raise exception 'Invalid partial-day instant order'; end if;
   result:=result || jsonb_build_array(jsonb_build_object('kind',kind,'date',d,
    'startsLocal',to_char(local_start,'HH24:MI'),'endsLocal',to_char(local_end,'HH24:MI'),
    'startsAt',exact_start,'endsAt',exact_end));
   previous_end:=local_end;
  else raise exception 'Invalid time-away segment kind'; end if;
  previous_date:=d;
 end loop;
 return result;
end $$;
create function private.time_away_snapshot(p_request uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('kind',s.kind,'date',s.local_date,
  'startsLocal',s.starts_local,'endsLocal',s.ends_local,'startsAt',s.starts_at,'endsAt',s.ends_at)
  order by s.ordinal),'[]'::jsonb) from public.time_away_segments s where s.request_id=p_request
$$;
revoke all on function private.time_away_normalize_segments(jsonb),private.time_away_snapshot(uuid) from public,anon,authenticated;

create function public.time_away_save_draft(p_request uuid,p_category text,p_segments jsonb,
 p_expected_revision integer,p_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; r public.time_away_requests%rowtype; normalized jsonb; category public.time_away_categories%rowtype;
 item jsonb; ordinal_number integer:=0; prior public.time_away_request_events%rowtype; new_revision integer;
begin
 actor:=private.current_person_id();
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_key is null or p_expected_revision is null
 then raise exception 'Time Away draft denied'; end if;
 normalized:=private.time_away_normalize_segments(p_segments);
 select * into category from public.time_away_categories where code=p_category and active order by version desc limit 1;
 if category.code is null then raise exception 'Invalid Time Away category'; end if;
 select * into prior from public.time_away_request_events
  where actor_person_id=actor and kind in ('DRAFT_CREATED','DRAFT_EDITED') and idempotency_key=p_key;
 if prior.id is not null then
  if prior.segment_snapshot<>normalized or prior.category_code<>p_category then raise exception 'Idempotency key reused'; end if;
  return prior.request_id;
 end if;
 if p_request is null then
  if p_expected_revision<>0 then raise exception 'Stale Time Away draft'; end if;
  insert into public.time_away_requests(person_id,category_code,category_version,category_label)
   values(actor,category.code,category.version,category.label) returning * into r;
  new_revision:=1;
 else
  select * into r from public.time_away_requests where id=p_request for update;
  if r.id is null or r.person_id<>actor or r.state<>'DRAFT' or r.revision<>p_expected_revision
  then raise exception 'Stale or inaccessible Time Away draft'; end if;
  new_revision:=r.revision+1;
  update public.time_away_requests set category_code=category.code,category_version=category.version,
   category_label=category.label,revision=new_revision,updated_at=transaction_timestamp() where id=r.id;
  delete from public.time_away_segments where request_id=r.id;
 end if;
 for item in select value from jsonb_array_elements(normalized) loop
  ordinal_number:=ordinal_number+1;
  insert into public.time_away_segments(request_id,ordinal,kind,local_date,starts_local,ends_local,starts_at,ends_at)
   values(r.id,ordinal_number,item->>'kind',(item->>'date')::date,(item->>'startsLocal')::time,
    (item->>'endsLocal')::time,(item->>'startsAt')::timestamptz,(item->>'endsAt')::timestamptz);
 end loop;
 insert into public.time_away_request_events(request_id,revision,actor_person_id,kind,old_state,new_state,team_id,
  category_code,category_version,segment_snapshot,idempotency_key)
 values(r.id,new_revision,actor,case when p_request is null then 'DRAFT_CREATED' else 'DRAFT_EDITED' end,
  case when p_request is null then null else 'DRAFT' end,'DRAFT',null,category.code,category.version,normalized,p_key);
 return r.id;
end $$;

create function public.time_away_submit(p_request uuid,p_team uuid,p_expected_revision integer,p_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; r public.time_away_requests%rowtype; chosen uuid; team_count integer;
begin
 actor:=private.current_person_id();
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_key is null
 then raise exception 'Time Away submission denied'; end if;
 if exists(select 1 from public.time_away_request_events e where e.actor_person_id=actor and e.kind='SUBMITTED'
  and e.idempotency_key=p_key and e.request_id=p_request) then return p_request; end if;
 select * into r from public.time_away_requests where id=p_request for update;
 if r.id is null or r.person_id<>actor or r.state<>'DRAFT' or r.revision<>p_expected_revision
 then raise exception 'Stale or inaccessible Time Away draft'; end if;
 if not exists(select 1 from public.time_away_segments where request_id=r.id)
  or exists(select 1 from public.time_away_segments where request_id=r.id and local_date<private.time_away_london_today())
 then raise exception 'Retroactive or empty Time Away request denied'; end if;
 select count(distinct m.team_id),(array_agg(distinct m.team_id))[1] into team_count,chosen
 from public.time_away_team_memberships m join public.time_away_teams t on t.id=m.team_id
 where m.person_id=actor and t.active and m.revoked_at is null
  and m.effective_from<=private.time_away_london_today()
  and (m.effective_until is null or m.effective_until>=private.time_away_london_today());
 if team_count=0 or (team_count>1 and p_team is null) then raise exception 'Select one active Time Away team'; end if;
 if p_team is not null then
  if not private.time_away_member(actor,p_team,private.time_away_london_today())
  then raise exception 'Selected Time Away team denied'; end if;
  chosen:=p_team;
 end if;
 update public.time_away_requests set team_id=chosen,state='SUBMITTED',revision=revision+1,
  submitted_at=transaction_timestamp(),updated_at=transaction_timestamp() where id=r.id;
 insert into public.time_away_request_events(request_id,revision,actor_person_id,kind,old_state,new_state,team_id,
  category_code,category_version,segment_snapshot,idempotency_key)
 values(r.id,r.revision+1,actor,'SUBMITTED','DRAFT','SUBMITTED',chosen,r.category_code,r.category_version,
  private.time_away_snapshot(r.id),p_key);
 return r.id;
end $$;

create function public.time_away_transition(p_request uuid,p_action text,p_expected_revision integer,
 p_key uuid,p_reason text default null,p_note text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid; r public.time_away_requests%rowtype; next_state text; required_action text;
 decision_kind text; snapshot jsonb; prior public.time_away_request_events%rowtype;
begin
 actor:=private.current_person_id();
 if actor is null or p_key is null or p_expected_revision is null then raise exception 'Time Away action denied'; end if;
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

create function private.time_away_can_read(p_request uuid,p_action text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.time_away_requests r where r.id=p_request and
  (r.person_id=private.current_person_id() or
   (r.team_id is not null and private.time_away_granted(r.team_id,p_action))))
$$;
revoke all on function private.time_away_can_read(uuid,text) from public,anon,authenticated;

create function public.time_away_list(p_team uuid default null,p_from date default null,p_to date default null,
 p_offset integer default 0,p_limit integer default 25,p_action text default 'VIEW_REQUESTS') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
 actor:=private.current_person_id();
 if actor is null or p_offset not between 0 and 10000 or p_limit not between 1 and 50
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

create function public.time_away_detail(p_request uuid,p_action text default 'VIEW_REQUESTS') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.time_away_requests%rowtype; actor uuid; result jsonb; is_owner boolean;
begin
 actor:=private.current_person_id();
 if actor is null or p_action not in ('VIEW_REQUESTS','VIEW_CALENDAR','VIEW_COVERAGE')
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

revoke all on function public.time_away_admin_action(text,uuid,uuid,uuid,text,text,date,date,timestamptz,text[],text,integer),
 public.time_away_authority(),public.time_away_admin_read(),
 public.time_away_save_draft(uuid,text,jsonb,integer,uuid),
 public.time_away_submit(uuid,uuid,integer,uuid),
 public.time_away_transition(uuid,text,integer,uuid,text,text),
 public.time_away_list(uuid,date,date,integer,integer,text),
 public.time_away_detail(uuid,text) from public,anon,authenticated;
grant execute on function public.time_away_admin_action(text,uuid,uuid,uuid,text,text,date,date,timestamptz,text[],text,integer),
 public.time_away_authority(),public.time_away_admin_read(),
 public.time_away_save_draft(uuid,text,jsonb,integer,uuid),
 public.time_away_submit(uuid,uuid,integer,uuid),
 public.time_away_transition(uuid,text,integer,uuid,text,text),
 public.time_away_list(uuid,date,date,integer,integer,text),
 public.time_away_detail(uuid,text) to authenticated;

-- Factual allocation overlap is available only after exact leave-team access and
-- the existing operational-source role gate. Counts derive from these same rows.
create function public.time_away_conflicts(p_request uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.time_away_requests%rowtype; rows jsonb; total integer; with_remaining integer;
begin
 select * into r from public.time_away_requests where id=p_request;
 if r.id is null or r.team_id is null or not private.time_away_granted(r.team_id,'VIEW_COVERAGE')
  or not private.operational_authorised() then raise exception 'Time Away coverage denied'; end if;
 with candidate_rows as (
  select 'EVENT'::text as source,a.id as allocation_id,a.status,rq.id as duty_id,
   e.name as duty_name,rq.report_at,rq.shift_ends_at,rq.required_quantity,
   (select count(*) from public.event_staff_allocations occupied where occupied.requirement_id=rq.id
    and occupied.status in ('ALLOCATED','ACCEPTED')) as active_count
  from public.event_staff_allocations a join public.event_staffing_requirements rq on rq.id=a.requirement_id
   join public.operational_events e on e.id=rq.event_id
  where a.person_id=r.person_id and a.status in ('ALLOCATED','ACCEPTED') and rq.state='PLANNED'
   and e.status<>'CANCELLED' and exists(select 1 from public.time_away_segments s where s.request_id=r.id and
    ((s.kind='WHOLE_DAY' and s.local_date between (rq.report_at at time zone 'Europe/London')::date
      and ((rq.shift_ends_at-interval '1 microsecond') at time zone 'Europe/London')::date)
     or (s.kind='PARTIAL_DAY' and s.starts_at<rq.shift_ends_at and s.ends_at>rq.report_at)))
  union all
  select 'SITE_SHIFT',a.id,a.status,d.id,sv.name,d.report_at,d.shift_ends_at,d.required_quantity,
   (select count(*) from public.site_shift_allocations occupied where occupied.demand_id=d.id
    and occupied.status in ('ALLOCATED','ACCEPTED'))
  from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
   join public.site_services sv on sv.id=d.service_id
  where a.person_id=r.person_id and a.status in ('ALLOCATED','ACCEPTED') and d.state='PLANNED'
   and sv.state='ACTIVE' and exists(select 1 from public.time_away_segments s where s.request_id=r.id and
    ((s.kind='WHOLE_DAY' and s.local_date between (d.report_at at time zone 'Europe/London')::date
      and ((d.shift_ends_at-interval '1 microsecond') at time zone 'Europe/London')::date)
     or (s.kind='PARTIAL_DAY' and s.starts_at<d.shift_ends_at and s.ends_at>d.report_at)))
 ), deduped as (select distinct on (source,allocation_id) * from candidate_rows order by source,allocation_id)
 select coalesce(jsonb_agg(jsonb_build_object('source',source,'allocationId',allocation_id,
  'allocationResponse',status,'dutyId',duty_id,'duty',duty_name,'reportAt',report_at,
  'endsAt',shift_ends_at,'remainingPositions',greatest(0,required_quantity-active_count))
  order by report_at,source,allocation_id),'[]'::jsonb),count(*),
  count(*) filter(where required_quantity>active_count)
 into rows,total,with_remaining from deduped;
 return jsonb_build_object('allocations',rows,'activeAllocationCount',total,
  'affectedDutyCountWithRemainingPositions',with_remaining,'allocationChanged',false);
end $$;
revoke all on function public.time_away_conflicts(uuid) from public,anon,authenticated;
grant execute on function public.time_away_conflicts(uuid) to authenticated;
