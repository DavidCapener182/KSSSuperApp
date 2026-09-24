-- TASK-08A synthetic Dev: ongoing Site Service and stable dated shift demand.
-- This migration deliberately adds no public allocation operation. The shared 06C/07A gate follows separately.
create table public.site_shift_settings (
 singleton boolean primary key default true check (singleton),
 horizon_weeks integer not null default 8 check (horizon_weeks between 1 and 26)
);
insert into public.site_shift_settings(singleton,horizon_weeks) values(true,8);

create table public.site_services (
 id uuid primary key default gen_random_uuid(),
 site_client_link_id uuid not null references public.site_client_links(id),
 site_id uuid not null references public.sites(id),
 organisation_id uuid not null references public.crm_organisations(id),
 name text not null check (length(trim(name)) between 2 and 180 and name !~ '[[:cntrl:]]'),
 type text not null check (type in ('STATIC_GUARDING','GATEHOUSE','RETAIL_SECURITY','PATROL','RECEPTION_SECURITY','OTHER')),
 state text not null default 'DRAFT' check (state in ('DRAFT','ACTIVE','PAUSED','ENDED')),
 effective_from date not null,
 effective_until date,
 owner_person_id uuid not null references public.people(id),
 created_by_person_id uuid not null references public.people(id),
 updated_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 updated_at timestamptz not null default transaction_timestamp(),
 revision integer not null default 1 check (revision>0),
 foreign key(site_client_link_id,site_id,organisation_id) references public.site_client_links(id,site_id,organisation_id),
 check (effective_until is null or effective_until>effective_from),
 unique(id,site_id)
);
create index site_services_site_idx on public.site_services(site_id,state,id);

-- Future pauses and historical pauses are exact London report-date intervals.
create table public.site_service_pauses (
 id uuid primary key default gen_random_uuid(),
 service_id uuid not null references public.site_services(id),
 starts_on date not null,
 ends_before date not null,
 reason text not null check (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]'),
 actor_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 check (ends_before>starts_on),
 unique(service_id,starts_on)
);
create index site_service_pauses_range_idx on public.site_service_pauses(service_id,starts_on,ends_before);

create table public.site_service_events (
 id uuid primary key default gen_random_uuid(),
 service_id uuid not null references public.site_services(id),
 kind text not null check (kind in ('CREATED','ACTIVATED','PAUSED','RESUMED','ENDED','AMENDED')),
 previous_revision integer,
 new_revision integer not null check (new_revision>0),
 previous_state text,
 new_state text not null,
 effective_on date not null,
 snapshot jsonb not null,
 reason text check (reason is null or (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]')),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default transaction_timestamp(),
 unique(service_id,new_revision)
);

create table public.site_shift_template_lines (
 id uuid primary key default gen_random_uuid(),
 service_id uuid not null references public.site_services(id),
 created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 unique(id,service_id)
);
create table public.site_shift_template_versions (
 id uuid primary key default gen_random_uuid(),
 line_id uuid not null,
 service_id uuid not null,
 version integer not null check (version>0),
 effective_from date not null,
 effective_until date,
 weekdays integer[] not null check (array_length(weekdays,1) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]),
 role_id uuid not null references public.operational_role_definitions(id),
 required_quantity integer not null check (required_quantity between 1 and 10000),
 report_time time not null,
 shift_start_time time not null,
 shift_end_time time not null,
 area_label text not null check (length(trim(area_label)) between 1 and 100 and area_label !~ '[[:cntrl:]]'),
 reporting_point text not null default '' check (length(reporting_point)<=180 and reporting_point !~ '[[:cntrl:]]'),
 actor_person_id uuid not null references public.people(id),
 reason text check (reason is null or (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]')),
 published_at timestamptz not null default transaction_timestamp(),
 foreign key(line_id,service_id) references public.site_shift_template_lines(id,service_id),
 unique(line_id,version),
 check (effective_until is null or effective_until>effective_from),
 check (report_time<=shift_start_time)
);
create index site_shift_template_current_idx on public.site_shift_template_versions(service_id,effective_from,effective_until);

create table public.site_shift_demands (
 id uuid primary key default gen_random_uuid(),
 service_id uuid not null references public.site_services(id),
 template_line_id uuid references public.site_shift_template_lines(id),
 template_version_id uuid references public.site_shift_template_versions(id),
 service_date date not null,
 role_id uuid not null references public.operational_role_definitions(id),
 required_quantity integer not null check (required_quantity between 1 and 10000),
 report_at timestamptz not null,
 shift_starts_at timestamptz not null,
 shift_ends_at timestamptz not null,
 area_label text not null check (length(trim(area_label)) between 1 and 100 and area_label !~ '[[:cntrl:]]'),
 reporting_point text not null default '' check (length(reporting_point)<=180 and reporting_point !~ '[[:cntrl:]]'),
 state text not null default 'PLANNED' check (state in ('PLANNED','CANCELLED')),
 origin text not null check (origin in ('TEMPLATE','EXTRA')),
 revision integer not null default 1 check (revision>0),
 created_by_person_id uuid not null references public.people(id),
 updated_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 updated_at timestamptz not null default transaction_timestamp(),
 check (report_at<=shift_starts_at and shift_starts_at<shift_ends_at and shift_ends_at<=shift_starts_at+interval '14 days'
  and report_at>=shift_starts_at-interval '7 days' and service_date=(report_at at time zone 'Europe/London')::date),
 check ((origin='TEMPLATE' and template_line_id is not null and template_version_id is not null)
  or (origin='EXTRA' and template_line_id is null and template_version_id is null)),
 unique(id,service_id)
);
create unique index site_shift_template_occurrence_idx on public.site_shift_demands(template_line_id,service_date) where template_line_id is not null;
create index site_shift_service_week_idx on public.site_shift_demands(service_id,service_date,state,report_at,id);
create index site_shift_role_week_idx on public.site_shift_demands(role_id,service_date,state);

create table public.site_shift_demand_events (
 id uuid primary key default gen_random_uuid(),
 demand_id uuid not null references public.site_shift_demands(id),
 service_id uuid not null references public.site_services(id),
 kind text not null check (kind in ('GENERATED','RECONCILED','EXCEPTION','EXTRA','CANCELLED')),
 revision integer not null check (revision>0),
 snapshot jsonb not null,
 reason text check (reason is null or (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]')),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default transaction_timestamp(),
 unique(demand_id,revision)
);
create table public.site_shift_exceptions (
 id uuid primary key default gen_random_uuid(),
 service_id uuid not null references public.site_services(id),
 demand_id uuid not null references public.site_shift_demands(id),
 kind text not null check (kind in ('SKIP','ADD','CHANGE_TIME','CHANGE_QUANTITY','CHANGE_REPORT_POINT','CANCEL')),
 service_date date not null,
 reason text not null check (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]'),
 actor_person_id uuid not null references public.people(id),
 demand_revision integer not null,
 created_at timestamptz not null default transaction_timestamp()
);

alter table public.site_shift_settings enable row level security;
alter table public.site_services enable row level security;
alter table public.site_service_pauses enable row level security;
alter table public.site_service_events enable row level security;
alter table public.site_shift_template_lines enable row level security;
alter table public.site_shift_template_versions enable row level security;
alter table public.site_shift_demands enable row level security;
alter table public.site_shift_demand_events enable row level security;
alter table public.site_shift_exceptions enable row level security;
revoke all on public.site_shift_settings,public.site_services,public.site_service_pauses,public.site_service_events,
 public.site_shift_template_lines,public.site_shift_template_versions,public.site_shift_demands,
 public.site_shift_demand_events,public.site_shift_exceptions from public,anon,authenticated;

create function private.guard_site_shift_08a() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_08a',true) is distinct from 'allowed' then raise exception 'Site shift direct write denied'; end if;
 if tg_op='DELETE' then raise exception 'Site shift history cannot be deleted'; end if;
 if tg_op='UPDATE' and tg_table_name in ('site_service_events','site_service_pauses','site_shift_demand_events','site_shift_exceptions','site_shift_template_lines','site_shift_template_events') then
  raise exception 'Site shift history is immutable'; end if;
 if tg_op='UPDATE' and tg_table_name='site_services' and
   (new.id is distinct from old.id or new.site_id is distinct from old.site_id or
    new.site_client_link_id is distinct from old.site_client_link_id or new.organisation_id is distinct from old.organisation_id or
    new.created_by_person_id is distinct from old.created_by_person_id or new.created_at is distinct from old.created_at or
    new.revision<>old.revision+1) then raise exception 'Service identity cannot change'; end if;
 if tg_op='UPDATE' and tg_table_name='site_shift_demands' and
   (new.id is distinct from old.id or new.service_id is distinct from old.service_id or
    new.template_line_id is distinct from old.template_line_id or new.origin is distinct from old.origin or
    new.service_date is distinct from old.service_date or new.created_by_person_id is distinct from old.created_by_person_id or
    new.created_at is distinct from old.created_at or new.revision<>old.revision+1 or old.state='CANCELLED') then
   raise exception 'Dated demand identity cannot change'; end if;
 if tg_op='UPDATE' and tg_table_name='site_shift_template_versions' and
   (new.id is distinct from old.id or new.line_id is distinct from old.line_id or new.service_id is distinct from old.service_id or
    new.version is distinct from old.version or new.effective_from is distinct from old.effective_from or
    new.weekdays is distinct from old.weekdays or new.role_id is distinct from old.role_id or
    new.required_quantity is distinct from old.required_quantity or new.report_time is distinct from old.report_time or
    new.shift_start_time is distinct from old.shift_start_time or new.shift_end_time is distinct from old.shift_end_time or
    new.area_label is distinct from old.area_label or new.reporting_point is distinct from old.reporting_point or
    new.actor_person_id is distinct from old.actor_person_id or new.published_at is distinct from old.published_at or
    new.reason is distinct from old.reason or old.effective_until is not null or new.effective_until<=old.effective_from) then
   raise exception 'Published template is immutable'; end if;
 return new;
end $$;
revoke all on function private.guard_site_shift_08a() from public,anon,authenticated;
create trigger guard_site_services before insert or update or delete on public.site_services for each row execute function private.guard_site_shift_08a();
create trigger guard_site_service_pauses before insert or update or delete on public.site_service_pauses for each row execute function private.guard_site_shift_08a();
create trigger guard_site_service_events before insert or update or delete on public.site_service_events for each row execute function private.guard_site_shift_08a();
create trigger guard_site_shift_template_lines before insert or update or delete on public.site_shift_template_lines for each row execute function private.guard_site_shift_08a();
create trigger guard_site_shift_template_versions before insert or update or delete on public.site_shift_template_versions for each row execute function private.guard_site_shift_08a();
create trigger guard_site_shift_demands before insert or update or delete on public.site_shift_demands for each row execute function private.guard_site_shift_08a();
create trigger guard_site_shift_demand_events before insert or update or delete on public.site_shift_demand_events for each row execute function private.guard_site_shift_08a();
create trigger guard_site_shift_exceptions before insert or update or delete on public.site_shift_exceptions for each row execute function private.guard_site_shift_08a();

create function private.site_shift_admin_08a() returns boolean language sql stable security definer set search_path='' as $$
 select private.current_person_id() is not null and (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN'))
$$;
revoke all on function private.site_shift_admin_08a() from public,anon,authenticated;

create function public.site_service_create(p_site uuid,p_name text,p_type text,p_effective_from date,p_owner uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); link public.site_client_links%rowtype; result uuid;
begin
 if not private.site_shift_admin_08a() or p_site is null or p_name is null or length(trim(p_name)) not between 2 and 180
  or p_name ~ '[[:cntrl:]]' or p_type not in ('STATIC_GUARDING','GATEHOUSE','RETAIL_SECURITY','PATROL','RECEPTION_SECURITY','OTHER')
  or p_effective_from is null or p_owner is null or not private.operational_owner_eligible(p_owner)
  or not exists(select 1 from public.sites where id=p_site and status='ACTIVE') then raise exception 'Service create denied'; end if;
 select l.* into link from public.site_client_links l join public.crm_organisations o on o.id=l.organisation_id
  where l.site_id=p_site and l.effective_until is null and o.relationship_status='CLIENT' for update of l;
 if link.id is null then raise exception 'Service create denied'; end if;
 perform set_config('kss.write_08a','allowed',true);
 insert into public.site_services(site_client_link_id,site_id,organisation_id,name,type,effective_from,owner_person_id,
  created_by_person_id,updated_by_person_id) values(link.id,p_site,link.organisation_id,trim(p_name),p_type,p_effective_from,p_owner,actor,actor)
  returning id into result;
 insert into public.site_service_events(service_id,kind,new_revision,new_state,effective_on,snapshot,actor_person_id)
  select id,'CREATED',revision,state,effective_from,to_jsonb(s),actor from public.site_services s where s.id=result;
 return result;
end $$;
revoke all on function public.site_service_create(uuid,text,text,date,uuid) from public,anon,authenticated;
grant execute on function public.site_service_create(uuid,text,text,date,uuid) to authenticated;

create function public.site_service_transition(p_service uuid,p_state text,p_effective_on date,p_expected_revision integer,p_reason text,p_resume_on date default null)
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
 return next_revision;
end $$;
revoke all on function public.site_service_transition(uuid,text,date,integer,text,date) from public,anon,authenticated;
grant execute on function public.site_service_transition(uuid,text,date,integer,text,date) to authenticated;

alter table public.site_shift_demands add column manual_override boolean not null default false;
create table public.site_shift_template_events (
 id uuid primary key default gen_random_uuid(),
 line_id uuid not null references public.site_shift_template_lines(id),
 version_id uuid not null references public.site_shift_template_versions(id),
 kind text not null check (kind in ('PUBLISHED','CLOSED')),
 effective_on date not null,
 reason text not null check (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]'),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default transaction_timestamp(),
 unique(version_id,kind)
);
alter table public.site_shift_template_events enable row level security;
revoke all on public.site_shift_template_events from public,anon,authenticated;
create trigger guard_site_shift_template_events before insert or update or delete on public.site_shift_template_events
 for each row execute function private.guard_site_shift_08a();
-- Keep typed snapshots for generated and manually revised demand.
create function private.site_shift_snapshot_08a(p_demand uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(d)-'created_by_person_id'-'updated_by_person_id' from public.site_shift_demands d where d.id=p_demand
$$;
revoke all on function private.site_shift_snapshot_08a(uuid) from public,anon,authenticated;
create function private.site_shift_time_08a(p_date date,p_time time) returns timestamptz
 language plpgsql immutable security definer set search_path='' as $$
declare result timestamptz;
begin
 result:=(p_date+p_time) at time zone 'Europe/London';
 if (result at time zone 'Europe/London') is distinct from (p_date+p_time) then
  raise exception 'Local shift time does not exist or is ambiguous';
 end if;
 return result;
end $$;
revoke all on function private.site_shift_time_08a(date,time) from public,anon,authenticated;

-- The only recurrence writer. This is deliberately bounded and preserves occurrence IDs.
create function private.site_shift_generate_08a(p_service uuid,p_from date,p_until date,p_actor uuid,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare s public.site_services%rowtype; setting_weeks integer; day date; v public.site_shift_template_versions%rowtype;
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
  for v in select tv.* from public.site_shift_template_versions tv
   where tv.service_id=p_service and tv.effective_from<=day and (tv.effective_until is null or tv.effective_until>day)
     and extract(isodow from day)::integer=any(tv.weekdays)
   order by tv.line_id loop
   desired:=s.state in ('ACTIVE','PAUSED') and day>=s.effective_from and (s.effective_until is null or day<s.effective_until)
     and not exists(select 1 from public.site_service_pauses p where p.service_id=p_service and p.starts_on<=day and day<p.ends_before);
   if not desired then continue; end if;
   report_instant:=private.site_shift_time_08a(day,v.report_time);
   start_instant:=private.site_shift_time_08a(day,v.shift_start_time);
   end_instant:=private.site_shift_time_08a(day+case when v.shift_end_time<=v.shift_start_time then 1 else 0 end,v.shift_end_time);
   if report_instant>start_instant or end_instant<=start_instant then raise exception 'Invalid template duty'; end if;
   select * into d from public.site_shift_demands where template_line_id=v.line_id and service_date=day for update;
   if d.id is null then
    insert into public.site_shift_demands(service_id,template_line_id,template_version_id,service_date,role_id,
     required_quantity,report_at,shift_starts_at,shift_ends_at,area_label,reporting_point,origin,
     created_by_person_id,updated_by_person_id)
    values(p_service,v.line_id,v.id,day,v.role_id,v.required_quantity,report_instant,start_instant,end_instant,
     v.area_label,v.reporting_point,'TEMPLATE',p_actor,p_actor) returning * into d;
    insert into public.site_shift_demand_events(demand_id,service_id,kind,revision,snapshot,actor_person_id)
     values(d.id,p_service,'GENERATED',1,private.site_shift_snapshot_08a(d.id),p_actor);
    changed:=changed+1;
   elsif not d.manual_override and (d.template_version_id is distinct from v.id or d.role_id is distinct from v.role_id
     or d.required_quantity is distinct from v.required_quantity or d.report_at is distinct from report_instant
     or d.shift_starts_at is distinct from start_instant or d.shift_ends_at is distinct from end_instant
     or d.area_label is distinct from v.area_label or d.reporting_point is distinct from v.reporting_point or d.state<>'PLANNED') then
    if d.state='CANCELLED' or d.service_date<private.uk_today() or exists(select 1 from public.site_shift_allocations a
      where a.demand_id=d.id and a.status in ('ALLOCATED','ACCEPTED')) then raise exception 'Dated demand requires explicit reconciliation'; end if;
    next_revision:=d.revision+1;
    update public.site_shift_demands set template_version_id=v.id,role_id=v.role_id,required_quantity=v.required_quantity,
     report_at=report_instant,shift_starts_at=start_instant,shift_ends_at=end_instant,area_label=v.area_label,
     reporting_point=v.reporting_point,revision=next_revision,updated_by_person_id=p_actor,updated_at=transaction_timestamp()
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
   and not exists(select 1 from public.site_shift_template_versions v where v.line_id=x.template_line_id
     and v.effective_from<=x.service_date and (v.effective_until is null or v.effective_until>x.service_date)
     and extract(isodow from x.service_date)::integer=any(v.weekdays)
     and s.state in ('ACTIVE','PAUSED') and x.service_date>=s.effective_from
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
revoke all on function private.site_shift_generate_08a(uuid,date,date,uuid,text) from public,anon,authenticated;

create table public.site_shift_allocations (
 id uuid primary key default gen_random_uuid(),
 demand_id uuid not null references public.site_shift_demands(id),
 person_id uuid not null references public.people(id),
 status text not null default 'ALLOCATED' check (status in ('ALLOCATED','ACCEPTED','DECLINED','CANCELLED')),
 demand_revision_at_allocation integer not null check (demand_revision_at_allocation>0),
 allocated_by_person_id uuid not null references public.people(id),
 allocated_at timestamptz not null default transaction_timestamp(),
 responded_at timestamptz,
 cancelled_at timestamptz,
 updated_at timestamptz not null default transaction_timestamp(),
 revision integer not null default 1 check (revision>0),
 check ((status='ALLOCATED' and responded_at is null and cancelled_at is null)
  or (status in ('ACCEPTED','DECLINED') and responded_at is not null and cancelled_at is null)
  or (status='CANCELLED' and cancelled_at is not null)),
 unique(id,demand_id)
);
create unique index site_shift_active_person_demand_idx on public.site_shift_allocations(demand_id,person_id)
 where status in ('ALLOCATED','ACCEPTED');
create index site_shift_alloc_person_idx on public.site_shift_allocations(person_id,status,demand_id);
create index site_shift_alloc_demand_idx on public.site_shift_allocations(demand_id,status,id);
create table public.site_shift_allocation_events (
 id uuid primary key default gen_random_uuid(),
 allocation_id uuid not null,
 demand_id uuid not null,
 person_id uuid not null references public.people(id),
 kind text not null check (kind in ('ALLOCATED','ACCEPTED','DECLINED','CANCELLED')),
 old_status text,
 new_status text not null,
 old_revision integer,
 new_revision integer not null,
 actor_person_id uuid not null references public.people(id),
 reason_code text,
 reason text check (reason is null or (length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]')),
 occurred_at timestamptz not null default transaction_timestamp(),
 foreign key(allocation_id,demand_id) references public.site_shift_allocations(id,demand_id),
 unique(allocation_id,new_revision)
);
alter table public.site_shift_allocations enable row level security;
alter table public.site_shift_allocation_events enable row level security;
revoke all on public.site_shift_allocations,public.site_shift_allocation_events from public,anon,authenticated;
create function private.guard_site_shift_allocation_08a() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_08a',true) is distinct from 'allowed' then raise exception 'Static allocation direct write denied'; end if;
 if tg_op='DELETE' or (tg_op='UPDATE' and tg_table_name='site_shift_allocation_events') then
  raise exception 'Static allocation history is immutable'; end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.demand_id is distinct from old.demand_id or
  new.person_id is distinct from old.person_id or new.allocated_by_person_id is distinct from old.allocated_by_person_id or
  new.allocated_at is distinct from old.allocated_at or new.demand_revision_at_allocation is distinct from old.demand_revision_at_allocation or
  new.revision<>old.revision+1 or old.status in ('DECLINED','CANCELLED')) then raise exception 'Static allocation identity cannot change'; end if;
 return new;
end $$;
revoke all on function private.guard_site_shift_allocation_08a() from public,anon,authenticated;
create trigger guard_site_shift_allocations before insert or update or delete on public.site_shift_allocations for each row execute function private.guard_site_shift_allocation_08a();
create trigger guard_site_shift_allocation_events before insert or update or delete on public.site_shift_allocation_events for each row execute function private.guard_site_shift_allocation_08a();

create function public.site_shift_template_publish(p_service uuid,p_line uuid,p_effective_from date,p_weekdays integer[],
 p_role uuid,p_quantity integer,p_report time,p_starts time,p_ends time,p_area text,p_reporting text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); s public.site_services%rowtype; prior public.site_shift_template_versions%rowtype;
 target_line_id uuid; result uuid; next_version integer; horizon integer;
begin
 if not private.site_shift_admin_08a() or p_effective_from is null or p_effective_from<private.uk_today()
  or p_weekdays is null or array_length(p_weekdays,1) not between 1 and 7 or not (p_weekdays <@ array[1,2,3,4,5,6,7])
  or p_quantity not between 1 and 10000 or p_report is null or p_starts is null or p_ends is null or p_report>p_starts
  or p_area is null or length(trim(p_area)) not between 1 and 100 or p_area ~ '[[:cntrl:]]'
  or length(coalesce(p_reporting,''))>180 or coalesce(p_reporting,'') ~ '[[:cntrl:]]'
  or p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]'
  or not exists(select 1 from public.operational_role_definitions where id=p_role and active)
  then raise exception 'Template publication denied'; end if;
 select * into s from public.site_services where id=p_service for update;
 if s.id is null or s.state='ENDED' or p_effective_from<s.effective_from then raise exception 'Template publication denied'; end if;
 perform set_config('kss.write_08a','allowed',true);
 if p_line is null then
  insert into public.site_shift_template_lines(service_id,created_by_person_id) values(p_service,actor) returning id into target_line_id;
  next_version:=1;
 else
  select id into target_line_id from public.site_shift_template_lines where id=p_line and service_id=p_service for update;
  if target_line_id is null then raise exception 'Template publication denied'; end if;
  select * into prior from public.site_shift_template_versions where line_id=target_line_id and effective_until is null for update;
  if prior.id is null or p_effective_from<=prior.effective_from then raise exception 'Template publication denied'; end if;
  update public.site_shift_template_versions set effective_until=p_effective_from where id=prior.id;
  insert into public.site_shift_template_events(line_id,version_id,kind,effective_on,reason,actor_person_id)
   values(target_line_id,prior.id,'CLOSED',p_effective_from,trim(p_reason),actor);
  next_version:=prior.version+1;
 end if;
 insert into public.site_shift_template_versions(line_id,service_id,version,effective_from,weekdays,role_id,
  required_quantity,report_time,shift_start_time,shift_end_time,area_label,reporting_point,actor_person_id,reason)
 values(target_line_id,p_service,next_version,p_effective_from,p_weekdays,p_role,p_quantity,p_report,p_starts,p_ends,
  trim(p_area),coalesce(trim(p_reporting),''),actor,trim(p_reason)) returning id into result;
 insert into public.site_shift_template_events(line_id,version_id,kind,effective_on,reason,actor_person_id)
  values(target_line_id,result,'PUBLISHED',p_effective_from,trim(p_reason),actor);
 select horizon_weeks into horizon from public.site_shift_settings where singleton;
 if s.state in ('ACTIVE','PAUSED') and p_effective_from<private.uk_today()+horizon*7 then
  perform private.site_shift_generate_08a(p_service,greatest(private.uk_today(),p_effective_from),
   private.uk_today()+horizon*7,actor,trim(p_reason));
 end if;
 return result;
end $$;
revoke all on function public.site_shift_template_publish(uuid,uuid,date,integer[],uuid,integer,time,time,time,text,text,text) from public,anon,authenticated;
grant execute on function public.site_shift_template_publish(uuid,uuid,date,integer[],uuid,integer,time,time,time,text,text,text) to authenticated;

create function public.site_shift_generate(p_service uuid,p_from date,p_until date)
returns integer language plpgsql security definer set search_path='' as $$
begin
 if not private.site_shift_admin_08a() then raise exception 'Generation denied'; end if;
 return private.site_shift_generate_08a(p_service,p_from,p_until,private.current_person_id(),'Scheduled generation');
end $$;
revoke all on function public.site_shift_generate(uuid,date,date) from public,anon,authenticated;
grant execute on function public.site_shift_generate(uuid,date,date) to authenticated;
