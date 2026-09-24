-- TASK-22B. Synthetic Dev only. Route values live solely in restricted immutable versions.
create table public.operational_contact_grants_22b (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references public.people(id),
 context_kind text not null check(context_kind in ('SITE','SITE_SERVICE','EVENT')),
 context_id uuid not null, valid_from timestamptz not null, valid_until timestamptz not null,
 revoked_at timestamptz, granted_by uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 check(valid_until>valid_from)
);
create index operational_contact_grants_person_idx on public.operational_contact_grants_22b(person_id,context_kind,context_id,valid_from,valid_until);
create table public.operational_contact_grant_events_22b (
 id uuid primary key default gen_random_uuid(), grant_id uuid not null references public.operational_contact_grants_22b(id),
 action text not null check(action in ('GRANTED','REVOKED')), actor_person_id uuid not null references public.people(id),
 reason text not null check(length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]'),
 occurred_at timestamptz not null default transaction_timestamp()
);
create table public.operational_contact_routes_22b (
 id uuid primary key default gen_random_uuid(),
 context_kind text not null check(context_kind in ('SITE','SITE_SERVICE','EVENT')),
 context_id uuid not null,
 purpose text not null check(purpose in ('CLIENT_OPERATIONAL','SITE_MANAGEMENT','KSS_DUTY_MANAGER','KSS_ESCALATION','FACILITIES_MAINTENANCE','HEALTH_SAFETY','EMERGENCY_SITE_CONTACT','OTHER_OPERATIONAL')),
 source_type text not null check(source_type in ('CRM_CONTACT','KSS_PERSON','MANUAL_OPERATIONAL')),
 source_id uuid,
 manual_origin text,
 accountable_manager_id uuid references public.people(id),
 current_version_id uuid,
 state text not null default 'PUBLISHED' check(state in ('PUBLISHED','REVOKED')),
 revision int not null default 1 check(revision>0),
 created_by uuid not null references public.people(id), created_at timestamptz not null default transaction_timestamp(),
 check((source_type='MANUAL_OPERATIONAL' and source_id is null and manual_origin is not null and accountable_manager_id is not null)
    or (source_type<>'MANUAL_OPERATIONAL' and source_id is not null and manual_origin is null))
);
create index operational_contact_context_idx on public.operational_contact_routes_22b(context_kind,context_id,purpose,state);
create table public.operational_contact_versions_22b (
 id uuid primary key default gen_random_uuid(), route_id uuid not null references public.operational_contact_routes_22b(id),
 version int not null check(version>0), display_name text not null check(length(trim(display_name)) between 2 and 120),
 role_organisation text not null check(length(trim(role_organisation)) between 2 and 180),
 phone text check(phone is null or (length(phone) between 7 and 30 and phone ~ '^[+0-9 ()-]+$')),
 email text check(email is null or (length(email)<=254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
 priority int not null check(priority between 1 and 20),
 effective_from timestamptz not null, effective_until timestamptz not null,
 london_start time, london_end time,
 reviewed_on date not null,
 source_marker text,
 published_by uuid not null references public.people(id), published_at timestamptz not null default transaction_timestamp(),
 reason text not null check(length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]'),
 unique(route_id,version), unique(route_id,id),
 check(phone is not null or email is not null), check(effective_until>effective_from),
 check((london_start is null and london_end is null) or (london_start is not null and london_end is not null and london_start<>london_end))
);
alter table public.operational_contact_routes_22b add constraint operational_contact_current_version_fk
 foreign key(id,current_version_id) references public.operational_contact_versions_22b(route_id,id) deferrable initially deferred;
create table public.operational_contact_events_22b (
 id uuid primary key default gen_random_uuid(), route_id uuid not null references public.operational_contact_routes_22b(id),
 action text not null check(action in ('PUBLISHED','CORRECTED','REVIEWED','REORDERED','EXPIRED','REVOKED')),
 old_version_id uuid, new_version_id uuid,
 actor_person_id uuid not null references public.people(id),
 reason text not null check(length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]'),
 occurred_at timestamptz not null default transaction_timestamp()
);
create unique index operational_contact_one_expiry_event_22b on public.operational_contact_events_22b(route_id,old_version_id) where action='EXPIRED';
create table public.operational_contact_history_reads_22b (
 id uuid primary key default gen_random_uuid(), route_id uuid not null references public.operational_contact_routes_22b(id),
 actor_person_id uuid not null references public.people(id),
 reason text not null check(length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]'),
 occurred_at timestamptz not null default transaction_timestamp()
);
alter table public.operational_contact_grants_22b enable row level security;
alter table public.operational_contact_grant_events_22b enable row level security;
alter table public.operational_contact_routes_22b enable row level security;
alter table public.operational_contact_versions_22b enable row level security;
alter table public.operational_contact_events_22b enable row level security;
alter table public.operational_contact_history_reads_22b enable row level security;
revoke all on public.operational_contact_grants_22b,public.operational_contact_grant_events_22b,
 public.operational_contact_routes_22b,public.operational_contact_versions_22b,public.operational_contact_events_22b,
 public.operational_contact_history_reads_22b from public,anon,authenticated;

create function private.contact_context_exists_22b(k text, target uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select case k when 'SITE' then exists(select 1 from public.sites s where s.id=target and s.status='ACTIVE')
 when 'SITE_SERVICE' then exists(select 1 from public.site_services x join public.sites s on s.id=x.site_id
   where x.id=target and x.state='ACTIVE' and s.status='ACTIVE')
 when 'EVENT' then exists(select 1 from public.operational_events e join public.sites s on s.id=e.site_id
   where e.id=target and e.status in ('PLANNING','CONFIRMED','LIVE') and s.status='ACTIVE')
 else false end
$$;
revoke all on function private.contact_context_exists_22b(text,uuid) from public,anon,authenticated;
create function private.contact_context_org_22b(k text,target uuid) returns uuid
 language sql stable security definer set search_path='' as $$
 select case k when 'SITE' then (select l.organisation_id from public.site_client_links l where l.site_id=target and l.effective_until is null limit 1)
 when 'SITE_SERVICE' then (select x.organisation_id from public.site_services x where x.id=target)
 when 'EVENT' then (select e.organisation_id from public.operational_events e where e.id=target) end
$$;
revoke all on function private.contact_context_org_22b(text,uuid) from public,anon,authenticated;
create function private.contact_manager_22b(k text,target uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select private.has_active_role('SUPER_ADMIN') or
 (private.has_active_role('OFFICE_ADMIN') and exists(select 1 from public.operational_contact_grants_22b g
 where g.person_id=private.current_person_id() and g.context_kind=k and g.context_id=target
 and g.revoked_at is null and g.valid_from<=transaction_timestamp() and g.valid_until>transaction_timestamp()))
$$;
revoke all on function private.contact_manager_22b(text,uuid) from public,anon,authenticated;

-- Exact accepted source allocation and exact context. No parent/child inheritance.
create function public.contact_duty_window_22b(report_at timestamptz,duty_end timestamptz,at_time timestamptz) returns boolean
 language sql immutable as $$
 select report_at is not null and duty_end is not null and at_time is not null
  and at_time>=report_at-interval '2 hours' and at_time<=duty_end+interval '2 hours'
$$;
create function private.contact_staff_22b(k text,target uuid,allocation uuid,at_time timestamptz) returns boolean
 language sql stable security definer set search_path='' as $$
 select private.has_active_role('SECURITY_STAFF') and case k
 when 'EVENT' then exists(select 1 from public.event_staff_allocations a
  join public.event_staffing_requirements d on d.id=a.requirement_id
  join public.operational_events e on e.id=d.event_id
  where a.id=allocation and a.person_id=private.current_person_id() and a.status='ACCEPTED'
   and d.event_id=target and d.state='PLANNED' and e.status in ('PLANNING','CONFIRMED','LIVE')
   and public.contact_duty_window_22b(d.report_at,d.shift_ends_at,at_time))
 when 'SITE_SERVICE' then exists(select 1 from public.site_shift_allocations a
  join public.site_shift_demands d on d.id=a.demand_id
  join public.site_services x on x.id=d.service_id
  where a.id=allocation and a.person_id=private.current_person_id() and a.status='ACCEPTED'
   and d.service_id=target and d.state='PLANNED' and x.state='ACTIVE'
   and public.contact_duty_window_22b(d.report_at,d.shift_ends_at,at_time))
 when 'SITE' then exists(select 1 from public.site_shift_allocations a
  join public.site_shift_demands d on d.id=a.demand_id
  join public.site_services x on x.id=d.service_id
  where a.id=allocation and a.person_id=private.current_person_id() and a.status='ACCEPTED'
   and x.site_id=target and d.state='PLANNED' and x.state='ACTIVE'
   and public.contact_duty_window_22b(d.report_at,d.shift_ends_at,at_time))
 else false end
$$;
revoke all on function private.contact_staff_22b(text,uuid,uuid,timestamptz) from public,anon,authenticated;

create function private.contact_source_marker_22b(source_type text,source_id uuid) returns text
 language plpgsql stable security definer set search_path='' as $$
declare marker text;
begin
 if source_type='CRM_CONTACT' then
  select md5(jsonb_build_array(c.organisation_id,c.first_name,c.last_name,c.job_title,c.business_phone,c.business_email,c.active)::text) into marker
  from public.crm_contacts c where c.id=source_id and c.active;
 elsif source_type='KSS_PERSON' then
  select md5(jsonb_build_array(p.display_name,f.mobile,f.contact_email)::text) into marker
  from public.people p join public.person_profiles f on f.person_id=p.id
  where p.id=source_id and exists(select 1 from public.role_assignments ra where ra.person_id=p.id
   and ra.revoked_at is null and ra.effective_from<=transaction_timestamp()
   and (ra.effective_until is null or ra.effective_until>transaction_timestamp()));
 end if;
 return marker;
end $$;
revoke all on function private.contact_source_marker_22b(text,uuid) from public,anon,authenticated;

-- A closed daily London window; crossing midnight is supported without a rota.
create function private.contact_window_contains_22b(s time,e time,at_time timestamptz) returns boolean
 language sql immutable as $$
 select s is null or case when s<e then (at_time at time zone 'Europe/London')::time>=s and (at_time at time zone 'Europe/London')::time<e
 else (at_time at time zone 'Europe/London')::time>=s or (at_time at time zone 'Europe/London')::time<e end
$$;
create function public.contact_london_window_22b(s time,e time,at_time timestamptz) returns boolean
 language sql immutable as $$
 select s is null or case when s<e then (at_time at time zone 'Europe/London')::time>=s and (at_time at time zone 'Europe/London')::time<e
 else (at_time at time zone 'Europe/London')::time>=s or (at_time at time zone 'Europe/London')::time<e end
$$;
create function private.contact_windows_overlap_22b(a time,b time,c time,d time) returns boolean
 language sql immutable as $$
 select a is null or c is null or exists(select 1 from generate_series(0,1439) m
  where (case when a<b then m>=extract(hour from a)::int*60+extract(minute from a)::int and m<extract(hour from b)::int*60+extract(minute from b)::int
   else m>=extract(hour from a)::int*60+extract(minute from a)::int or m<extract(hour from b)::int*60+extract(minute from b)::int end)
  and (case when c<d then m>=extract(hour from c)::int*60+extract(minute from c)::int and m<extract(hour from d)::int*60+extract(minute from d)::int
   else m>=extract(hour from c)::int*60+extract(minute from c)::int or m<extract(hour from d)::int*60+extract(minute from d)::int end))
$$;
revoke all on function private.contact_windows_overlap_22b(time,time,time,time) from public,anon,authenticated;

create function public.contact_preview_22b(p jsonb) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare k text:=p->>'context_kind'; target uuid; src text:=p->>'source_type'; source uuid;
 nm text; descriptor text; tel text; mail text; marker text; org uuid;
begin
 if k not in ('SITE','SITE_SERVICE','EVENT') or src not in ('CRM_CONTACT','KSS_PERSON','MANUAL_OPERATIONAL')
 then raise exception 'Contact preview denied'; end if;
 target:=(p->>'context_id')::uuid;
 if not private.contact_context_exists_22b(k,target) or not private.contact_manager_22b(k,target) then raise exception 'Contact preview denied'; end if;
 org:=private.contact_context_org_22b(k,target);
 if src='CRM_CONTACT' then
  source:=(p->>'source_id')::uuid;
  select trim(c.first_name||' '||c.last_name),trim(coalesce(c.job_title||' / ','')||o.name),
   case when coalesce((p->>'use_phone')::boolean,false) then c.business_phone end,
   case when coalesce((p->>'use_email')::boolean,false) then c.business_email end
  into nm,descriptor,tel,mail from public.crm_contacts c join public.crm_organisations o on o.id=c.organisation_id
   where c.id=source and c.active and c.organisation_id=org;
  marker:=private.contact_source_marker_22b(src,source);
 elsif src='KSS_PERSON' then
  source:=(p->>'source_id')::uuid;
  select x.display_name,trim(p->>'role_organisation'),
   case when coalesce((p->>'use_phone')::boolean,false) then f.mobile end,
   case when coalesce((p->>'use_email')::boolean,false) then f.contact_email end
  into nm,descriptor,tel,mail from public.people x join public.person_profiles f on f.person_id=x.id where x.id=source;
  marker:=private.contact_source_marker_22b(src,source);
 else
  nm:=trim(p->>'display_name'); descriptor:=trim(p->>'role_organisation');
  tel:=nullif(trim(p->>'phone'),''); mail:=nullif(lower(trim(p->>'email')),'');
  marker:=md5(jsonb_build_array(nm,descriptor,tel,mail)::text);
 end if;
 if nm is null or descriptor is null or length(nm) not between 2 and 120 or length(descriptor) not between 2 and 180
  or tel is null and mail is null or marker is null then raise exception 'Contact preview denied'; end if;
 return jsonb_build_object('context_kind',k,'context_id',target,'purpose',p->>'purpose',
  'display_name',nm,'role_organisation',descriptor,'phone',tel,'email',mail,'priority',p->>'priority',
  'effective_from',p->>'effective_from','effective_until',p->>'effective_until',
  'london_start',p->>'london_start','london_end',p->>'london_end','reviewed_on',p->>'reviewed_on',
  'preview_marker',marker);
end $$;
revoke all on function public.contact_preview_22b(jsonb) from public,anon,authenticated;
grant execute on function public.contact_preview_22b(jsonb) to authenticated;

create function public.contact_grant_22b(k text,target uuid,person uuid,starts timestamptz,ends timestamptz,reason text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare result uuid; actor uuid:=private.current_person_id();
begin
 if actor is null or not private.has_active_role('SUPER_ADMIN') or not private.contact_context_exists_22b(k,target)
 or starts is null or ends is null or starts>=ends or ends<=transaction_timestamp()
 or reason is null or length(trim(reason)) not between 3 and 300 or reason ~ '[[:cntrl:]]'
 or not exists(select 1 from public.role_assignments ra where ra.person_id=person and ra.role_code='OFFICE_ADMIN'
  and ra.revoked_at is null and ra.effective_from<=transaction_timestamp()
  and (ra.effective_until is null or ra.effective_until>transaction_timestamp())) then raise exception 'Contact grant denied'; end if;
 perform set_config('kss.contact_write_22b','allowed',true);
 insert into public.operational_contact_grants_22b(person_id,context_kind,context_id,valid_from,valid_until,granted_by)
 values(person,k,target,starts,ends,actor) returning id into result;
 insert into public.operational_contact_grant_events_22b(grant_id,action,actor_person_id,reason)
 values(result,'GRANTED',actor,trim(reason));
 return result;
end $$;
revoke all on function public.contact_grant_22b(text,uuid,uuid,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.contact_grant_22b(text,uuid,uuid,timestamptz,timestamptz,text) to authenticated;
create function public.contact_revoke_grant_22b(p_grant uuid,reason text) returns void
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id();
begin
 if actor is null or not private.has_active_role('SUPER_ADMIN') or reason is null or length(trim(reason)) not between 3 and 300
 or reason ~ '[[:cntrl:]]' then raise exception 'Contact grant denied'; end if;
 perform set_config('kss.contact_write_22b','allowed',true);
 update public.operational_contact_grants_22b set revoked_at=transaction_timestamp() where id=p_grant and revoked_at is null;
 if not found then raise exception 'Contact grant denied'; end if;
 insert into public.operational_contact_grant_events_22b(grant_id,action,actor_person_id,reason)
 values(p_grant,'REVOKED',actor,trim(reason));
end $$;
revoke all on function public.contact_revoke_grant_22b(uuid,text) from public,anon,authenticated;
grant execute on function public.contact_revoke_grant_22b(uuid,text) to authenticated;
create function public.contact_grants_22b(k text,target uuid) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_active_role('SUPER_ADMIN') or not private.contact_context_exists_22b(k,target)
 then raise exception 'Contact grant read denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'person_id',g.person_id,'person_name',p.display_name,
  'valid_from',g.valid_from,'valid_until',g.valid_until,'revoked_at',g.revoked_at) order by g.created_at desc),'[]'::jsonb)
  into result from public.operational_contact_grants_22b g join public.people p on p.id=g.person_id
  where g.context_kind=k and g.context_id=target;
 return result;
end $$;
revoke all on function public.contact_grants_22b(text,uuid) from public,anon,authenticated;
grant execute on function public.contact_grants_22b(text,uuid) to authenticated;

create function public.contact_publish_22b(p jsonb) returns uuid
 language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.current_person_id(); r public.operational_contact_routes_22b%rowtype;
 k text:=p->>'context_kind'; target uuid; purpose text:=p->>'purpose'; src text:=p->>'source_type'; source uuid;
 route uuid; expected int; effective_start timestamptz; effective_end timestamptz;
 local_start time; local_end time; review_date date; prio int;
 nm text; descriptor text; tel text; mail text; marker text; origin text; reason text:=trim(p->>'reason');
 prior uuid; next_version uuid; action text; org uuid; accountable uuid;
begin
 if actor is null or jsonb_typeof(p)<>'object' or k not in ('SITE','SITE_SERVICE','EVENT')
 or purpose not in ('CLIENT_OPERATIONAL','SITE_MANAGEMENT','KSS_DUTY_MANAGER','KSS_ESCALATION','FACILITIES_MAINTENANCE','HEALTH_SAFETY','EMERGENCY_SITE_CONTACT','OTHER_OPERATIONAL')
 or src not in ('CRM_CONTACT','KSS_PERSON','MANUAL_OPERATIONAL')
 or reason is null or length(reason) not between 3 and 300 or reason ~ '[[:cntrl:]]'
 then raise exception 'Contact publication denied'; end if;
 target:=(p->>'context_id')::uuid;
 if not private.contact_context_exists_22b(k,target) or not private.contact_manager_22b(k,target) then raise exception 'Contact publication denied'; end if;
 effective_start:=(p->>'effective_from')::timestamptz; effective_end:=(p->>'effective_until')::timestamptz;
 review_date:=(p->>'reviewed_on')::date; prio:=(p->>'priority')::int;
 local_start:=nullif(p->>'london_start','')::time; local_end:=nullif(p->>'london_end','')::time;
 if effective_start is null or effective_end is null or effective_end<=effective_start or effective_end<=transaction_timestamp()
 or review_date is null or review_date>(transaction_timestamp() at time zone 'Europe/London')::date
 or prio not between 1 and 20 or (local_start is null)<>(local_end is null) or local_start=local_end
 then raise exception 'Contact publication denied'; end if;
 if p ? 'route_id' and p->>'route_id' is not null then
  route:=(p->>'route_id')::uuid; expected:=(p->>'expected_revision')::int;
  select * into r from public.operational_contact_routes_22b where id=route for update;
  if not found or r.state<>'PUBLISHED' or r.revision<>expected or r.context_kind<>k or r.context_id<>target
   or r.purpose<>purpose or r.source_type<>src or r.source_id is distinct from nullif(p->>'source_id','')::uuid
   then raise exception 'Contact publication denied'; end if;
  prior:=r.current_version_id;
  action:=p->>'action';
  if action not in ('CORRECTED','REVIEWED','REORDERED') then raise exception 'Contact publication denied'; end if;
 else
  if p ? 'expected_revision' or p ? 'action' then raise exception 'Contact publication denied'; end if;
  action:='PUBLISHED';
 end if;
 org:=private.contact_context_org_22b(k,target);
 if src='CRM_CONTACT' then
  source:=(p->>'source_id')::uuid;
  select trim(c.first_name||' '||c.last_name),trim(coalesce(c.job_title||' / ','')||o.name),
   case when coalesce((p->>'use_phone')::boolean,false) then c.business_phone end,
   case when coalesce((p->>'use_email')::boolean,false) then c.business_email end
   into nm,descriptor,tel,mail
  from public.crm_contacts c join public.crm_organisations o on o.id=c.organisation_id
  where c.id=source and c.active and c.organisation_id=org;
  marker:=private.contact_source_marker_22b(src,source);
 elsif src='KSS_PERSON' then
  source:=(p->>'source_id')::uuid;
  select x.display_name,trim(p->>'role_organisation'),
   case when coalesce((p->>'use_phone')::boolean,false) then f.mobile end,
   case when coalesce((p->>'use_email')::boolean,false) then f.contact_email end
   into nm,descriptor,tel,mail
  from public.people x join public.person_profiles f on f.person_id=x.id where x.id=source;
  marker:=private.contact_source_marker_22b(src,source);
 else
  if p->>'source_id' is not null then raise exception 'Contact publication denied'; end if;
  nm:=trim(p->>'display_name'); descriptor:=trim(p->>'role_organisation');
  tel:=nullif(trim(p->>'phone'),''); mail:=nullif(lower(trim(p->>'email')),'');
  origin:=trim(p->>'manual_origin');
  marker:=md5(jsonb_build_array(nm,descriptor,tel,mail)::text);
  accountable:=coalesce(nullif(p->>'accountable_manager_id','')::uuid,case when private.has_active_role('OFFICE_ADMIN') then actor end);
  if origin is null or length(origin) not between 3 and 300 or origin ~ '[[:cntrl:]]'
   or (k='EVENT' and effective_end is null)
   or (k<>'EVENT' and (p->>'reviewed_on') is null)
   or accountable is null or not exists(select 1 from public.operational_contact_grants_22b g
    where g.person_id=accountable and g.context_kind=k and g.context_id=target and g.revoked_at is null
     and g.valid_from<=transaction_timestamp() and g.valid_until>transaction_timestamp())
   or not exists(select 1 from public.role_assignments ra where ra.person_id=accountable and ra.role_code='OFFICE_ADMIN'
    and ra.revoked_at is null and ra.effective_from<=transaction_timestamp()
    and (ra.effective_until is null or ra.effective_until>transaction_timestamp()))
   then raise exception 'Contact publication denied'; end if;
 end if;
 if nm is null or descriptor is null or length(nm) not between 2 and 120 or length(descriptor) not between 2 and 180
 or tel is null and mail is null or (src<>'MANUAL_OPERATIONAL' and marker is null)
 or (src='CRM_CONTACT' and org is null) then raise exception 'Contact publication denied'; end if;
 if marker is distinct from p->>'preview_marker' then raise exception 'Contact preview is stale'; end if;
 if route is not null and (r.source_id is distinct from source or r.manual_origin is distinct from origin
  or (src='MANUAL_OPERATIONAL' and r.accountable_manager_id is distinct from accountable)) then raise exception 'Contact publication denied'; end if;
 -- Serialise all publications in the same exact context and purpose, including separate route IDs.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(k||':'||target::text||':'||purpose,22));
 if exists(select 1 from public.operational_contact_routes_22b other
  join public.operational_contact_versions_22b v on v.id=other.current_version_id
  where other.context_kind=k and other.context_id=target and other.purpose=purpose
   and other.state='PUBLISHED' and other.id is distinct from route and v.priority=prio
   and tstzrange(v.effective_from,v.effective_until,'[)') && tstzrange(effective_start,effective_end,'[)')
   and private.contact_windows_overlap_22b(v.london_start,v.london_end,local_start,local_end))
 then raise exception 'Contact priority conflict'; end if;
 perform set_config('kss.contact_write_22b','allowed',true);
 if route is null then
  insert into public.operational_contact_routes_22b(context_kind,context_id,purpose,source_type,source_id,manual_origin,accountable_manager_id,created_by)
  values(k,target,purpose,src,source,origin,accountable,actor) returning id into route;
 end if;
 insert into public.operational_contact_versions_22b(route_id,version,display_name,role_organisation,phone,email,
  priority,effective_from,effective_until,london_start,london_end,reviewed_on,source_marker,published_by,reason)
 values(route,coalesce(r.revision+1,1),nm,descriptor,tel,mail,prio,effective_start,effective_end,local_start,local_end,
  review_date,marker,actor,reason) returning id into next_version;
 update public.operational_contact_routes_22b set current_version_id=next_version,
  revision=case when prior is null then 1 else revision+1 end where id=route;
 insert into public.operational_contact_events_22b(route_id,action,old_version_id,new_version_id,actor_person_id,reason)
 values(route,action,prior,next_version,actor,reason);
 return route;
end $$;
revoke all on function public.contact_publish_22b(jsonb) from public,anon,authenticated;
grant execute on function public.contact_publish_22b(jsonb) to authenticated;

create function public.contact_revoke_22b(route uuid,expected int,reason text) returns void
 language plpgsql security definer set search_path='' as $$
declare r public.operational_contact_routes_22b%rowtype; actor uuid:=private.current_person_id();
begin
 select * into r from public.operational_contact_routes_22b where id=route for update;
 if not found or actor is null or not private.contact_manager_22b(r.context_kind,r.context_id)
  or r.state<>'PUBLISHED' or r.revision<>expected or reason is null or length(trim(reason)) not between 3 and 300
  or reason ~ '[[:cntrl:]]' then raise exception 'Contact revoke denied'; end if;
 perform set_config('kss.contact_write_22b','allowed',true);
 update public.operational_contact_routes_22b set state='REVOKED',revision=revision+1 where id=route;
 insert into public.operational_contact_events_22b(route_id,action,old_version_id,actor_person_id,reason)
 values(route,'REVOKED',r.current_version_id,actor,trim(reason));
end $$;
revoke all on function public.contact_revoke_22b(uuid,int,text) from public,anon,authenticated;
grant execute on function public.contact_revoke_22b(uuid,int,text) to authenticated;
create function public.contact_mark_expired_22b(route uuid,reason text) returns void
 language plpgsql security definer set search_path='' as $$
declare r public.operational_contact_routes_22b%rowtype; actor uuid:=private.current_person_id();
begin
 select * into r from public.operational_contact_routes_22b where id=route for update;
 if not found or actor is null or not private.contact_manager_22b(r.context_kind,r.context_id)
  or reason is null or length(trim(reason)) not between 3 and 300 or reason ~ '[[:cntrl:]]'
  or not exists(select 1 from public.operational_contact_versions_22b v where v.id=r.current_version_id
   and v.effective_until<=transaction_timestamp()) then raise exception 'Contact expiry denied'; end if;
 perform set_config('kss.contact_write_22b','allowed',true);
 insert into public.operational_contact_events_22b(route_id,action,old_version_id,actor_person_id,reason)
 values(route,'EXPIRED',r.current_version_id,actor,trim(reason)) on conflict do nothing;
end $$;
revoke all on function public.contact_mark_expired_22b(uuid,text) from public,anon,authenticated;
grant execute on function public.contact_mark_expired_22b(uuid,text) to authenticated;

create function public.contact_current_22b(k text,target uuid,allocation uuid default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare at_time timestamptz:=transaction_timestamp(); result jsonb; actor uuid:=private.current_person_id();
begin
 if actor is null or not private.contact_context_exists_22b(k,target) or not (
  (allocation is not null and private.contact_staff_22b(k,target,allocation,at_time))
  or (allocation is null and private.has_active_role('OPERATIONS') and private.operational_authorised())
  or (allocation is null and private.contact_manager_22b(k,target)))
 then raise exception 'Contact read denied'; end if;
 select jsonb_build_object('context_kind',k,'context_id',target,
  'routes',coalesce(jsonb_agg(jsonb_build_object(
   'id',q.id,'purpose',q.purpose,'state',q.health,'priority',q.priority,
   'display_name',case when q.health='CURRENT' then q.display_name end,
   'role_organisation',case when q.health='CURRENT' then q.role_organisation end,
   'phone',case when q.health='CURRENT' then q.phone end,
   'email',case when q.health='CURRENT' then q.email end,
   'effective_from',q.effective_from,'effective_until',q.effective_until,
   'london_start',q.london_start,'london_end',q.london_end,'reviewed_on',q.reviewed_on)
   order by q.purpose,q.priority,q.id),'[]'::jsonb)) into result
 from (select r.id,r.purpose,v.priority,v.display_name,v.role_organisation,v.phone,v.email,
   v.effective_from,v.effective_until,v.london_start,v.london_end,v.reviewed_on,
   case when r.source_type<>'MANUAL_OPERATIONAL' and private.contact_source_marker_22b(r.source_type,r.source_id) is null then 'SOURCE_UNAVAILABLE'
    when r.source_type<>'MANUAL_OPERATIONAL' and private.contact_source_marker_22b(r.source_type,r.source_id)<>v.source_marker then 'REVIEW_REQUIRED'
    when v.effective_until<=at_time then 'EXPIRED'
    when v.effective_from>at_time or not public.contact_london_window_22b(v.london_start,v.london_end,at_time) then 'NOT_APPLICABLE'
    else 'CURRENT' end as health
  from public.operational_contact_routes_22b r join public.operational_contact_versions_22b v on v.id=r.current_version_id
  where r.context_kind=k and r.context_id=target and r.state='PUBLISHED') q;
 return result;
end $$;
revoke all on function public.contact_current_22b(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.contact_current_22b(text,uuid,uuid) to authenticated;

create function public.contact_for_allocation_22b(source text,allocation uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare event_id uuid; service_id uuid; site_id uuid; event_name text; service_name text; site_name text;
begin
 if allocation is null or not private.has_active_role('SECURITY_STAFF') then raise exception 'Contact read denied'; end if;
 if source='EVENT' then
  select d.event_id,e.name into event_id,event_name from public.event_staff_allocations a
   join public.event_staffing_requirements d on d.id=a.requirement_id
   join public.operational_events e on e.id=d.event_id
   where a.id=allocation and a.person_id=private.current_person_id() and a.status='ACCEPTED';
  if event_id is null or not private.contact_staff_22b('EVENT',event_id,allocation,transaction_timestamp())
  then raise exception 'Contact read denied'; end if;
  return jsonb_build_object('source','EVENT','contexts',jsonb_build_array(
   public.contact_current_22b('EVENT',event_id,allocation)||jsonb_build_object('context_name',event_name)));
 elsif source='SITE_SHIFT' then
  select d.service_id,x.site_id,x.name,s.name into service_id,site_id,service_name,site_name from public.site_shift_allocations a
   join public.site_shift_demands d on d.id=a.demand_id
   join public.site_services x on x.id=d.service_id
   join public.sites s on s.id=x.site_id
   where a.id=allocation and a.person_id=private.current_person_id() and a.status='ACCEPTED';
  if service_id is null or not private.contact_staff_22b('SITE_SERVICE',service_id,allocation,transaction_timestamp())
  then raise exception 'Contact read denied'; end if;
  return jsonb_build_object('source','SITE_SHIFT','contexts',jsonb_build_array(
   public.contact_current_22b('SITE',site_id,allocation)||jsonb_build_object('context_name',site_name),
   public.contact_current_22b('SITE_SERVICE',service_id,allocation)||jsonb_build_object('context_name',service_name)));
 end if;
 raise exception 'Contact read denied';
end $$;
revoke all on function public.contact_for_allocation_22b(text,uuid) from public,anon,authenticated;
grant execute on function public.contact_for_allocation_22b(text,uuid) to authenticated;

create function public.contact_manage_22b(k text,target uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.contact_context_exists_22b(k,target) or not private.contact_manager_22b(k,target)
 then raise exception 'Contact management denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'purpose',r.purpose,'source_type',r.source_type,
  'source_id',r.source_id,'manual_origin',r.manual_origin,'accountable_manager_id',r.accountable_manager_id,
  'state',r.state,'revision',r.revision,'current_version_id',r.current_version_id,
  'source_health',case when r.source_type='MANUAL_OPERATIONAL' then 'CURRENT'
   when private.contact_source_marker_22b(r.source_type,r.source_id) is null then 'SOURCE_UNAVAILABLE'
   when private.contact_source_marker_22b(r.source_type,r.source_id)<>v.source_marker then 'REVIEW_REQUIRED' else 'CURRENT' end,
  'display_name',v.display_name,'role_organisation',v.role_organisation,
  'phone',case when r.state='PUBLISHED' and v.effective_until>transaction_timestamp() then v.phone end,
  'email',case when r.state='PUBLISHED' and v.effective_until>transaction_timestamp() then v.email end,
  'priority',v.priority,'effective_from',v.effective_from,'effective_until',v.effective_until,
  'london_start',v.london_start,'london_end',v.london_end,'reviewed_on',v.reviewed_on)
  order by r.purpose,v.priority,r.id),'[]'::jsonb) into result
 from public.operational_contact_routes_22b r join public.operational_contact_versions_22b v on v.id=r.current_version_id
 where r.context_kind=k and r.context_id=target;
 return jsonb_build_object('context_kind',k,'context_id',target,'routes',result);
end $$;
revoke all on function public.contact_manage_22b(text,uuid) from public,anon,authenticated;
grant execute on function public.contact_manage_22b(text,uuid) to authenticated;

create function public.contact_history_22b(route uuid,reason text) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare r public.operational_contact_routes_22b%rowtype; result jsonb; actor uuid:=private.current_person_id();
begin
 select * into r from public.operational_contact_routes_22b where id=route;
 if not found or actor is null or not private.contact_manager_22b(r.context_kind,r.context_id)
 or reason is null or length(trim(reason)) not between 3 and 300 or reason ~ '[[:cntrl:]]'
 then raise exception 'Contact history denied'; end if;
 perform set_config('kss.contact_write_22b','allowed',true);
 insert into public.operational_contact_history_reads_22b(route_id,actor_person_id,reason) values(route,actor,trim(reason));
 select jsonb_build_object('versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.version)
  from public.operational_contact_versions_22b v where v.route_id=route),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.occurred_at,e.id)
  from public.operational_contact_events_22b e where e.route_id=route),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.contact_history_22b(uuid,text) from public,anon,authenticated;
grant execute on function public.contact_history_22b(uuid,text) to authenticated;

-- RLS is deny-all. These triggers also protect immutable versions/history if a later grant is added accidentally.
create function private.contact_direct_write_guard_22b() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.contact_write_22b',true) is distinct from 'allowed' then
  raise exception 'Contact direct write denied'; end if;
 if tg_op='DELETE' or (tg_op='UPDATE' and tg_table_name in
  ('operational_contact_versions_22b','operational_contact_events_22b','operational_contact_grant_events_22b','operational_contact_history_reads_22b'))
 then raise exception 'Contact history immutable'; end if;
 return new;
end $$;
revoke all on function private.contact_direct_write_guard_22b() from public,anon,authenticated;
create trigger contact_grants_guard_22b before insert or update or delete on public.operational_contact_grants_22b
 for each row execute function private.contact_direct_write_guard_22b();
create trigger contact_grant_events_guard_22b before insert or update or delete on public.operational_contact_grant_events_22b
 for each row execute function private.contact_direct_write_guard_22b();
create trigger contact_routes_guard_22b before insert or update or delete on public.operational_contact_routes_22b
 for each row execute function private.contact_direct_write_guard_22b();
create trigger contact_versions_guard_22b before insert or update or delete on public.operational_contact_versions_22b
 for each row execute function private.contact_direct_write_guard_22b();
create trigger contact_events_guard_22b before insert or update or delete on public.operational_contact_events_22b
 for each row execute function private.contact_direct_write_guard_22b();
create trigger contact_history_reads_guard_22b before insert or update or delete on public.operational_contact_history_reads_22b
 for each row execute function private.contact_direct_write_guard_22b();
