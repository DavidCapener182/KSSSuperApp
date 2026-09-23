-- TASK-06A: additive synthetic Client -> existing Site -> Event foundation.
-- The Site row and its existing RLS/creator/onboarding authority stay unchanged.
alter table public.sites add column site_type text
  check (site_type is null or site_type in ('STADIUM','VENUE','RETAIL','WAREHOUSE','OFFICE','FESTIVAL_SITE','STATIC_SITE','OTHER'));

create table public.site_client_links (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.sites(id),
 organisation_id uuid not null references public.crm_organisations(id),
 effective_from timestamptz not null default transaction_timestamp(),
 effective_until timestamptz,
 linked_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 unique(id,site_id,organisation_id),
 check (effective_until is null or effective_until>effective_from)
);
create unique index site_client_one_current_idx on public.site_client_links(site_id) where effective_until is null;
create index site_client_org_idx on public.site_client_links(organisation_id,site_id);

create table public.site_client_link_events (
 id uuid primary key default gen_random_uuid(),
 link_id uuid not null references public.site_client_links(id),
 kind text not null check (kind='LINKED'),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default transaction_timestamp()
);

create table public.operational_events (
 id uuid primary key default gen_random_uuid(),
 site_client_link_id uuid not null,
 site_id uuid not null references public.sites(id),
 organisation_id uuid not null references public.crm_organisations(id),
 name text not null check (length(trim(name)) between 1 and 180 and name !~ '[[:cntrl:]]'),
 event_type text not null check (event_type in ('FOOTBALL_MATCH','FESTIVAL','CONCERT','PARADE','CONFERENCE','CORPORATE_EVENT','OTHER')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'PLANNING' check (status in ('PLANNING','CONFIRMED','LIVE','COMPLETED','CANCELLED')),
 owner_person_id uuid not null references public.people(id),
 primary_contact_id uuid,
 source_opportunity_id uuid,
 created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 updated_at timestamptz not null default transaction_timestamp(),
 foreign key(site_client_link_id,site_id,organisation_id) references public.site_client_links(id,site_id,organisation_id),
 foreign key(primary_contact_id,organisation_id) references public.crm_contacts(id,organisation_id),
 check (isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at)
);
create index operational_events_site_time_idx on public.operational_events(site_id,starts_at,id);
create index operational_events_org_time_idx on public.operational_events(organisation_id,starts_at,id);
create index operational_events_status_time_idx on public.operational_events(status,starts_at,id);

create table public.operational_event_events (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.operational_events(id),
 kind text not null check (kind in ('CREATED','STATUS','OWNER','DATES')),
 old_status text,new_status text,
 old_owner_person_id uuid references public.people(id),new_owner_person_id uuid references public.people(id),
 old_starts_at timestamptz,new_starts_at timestamptz,old_ends_at timestamptz,new_ends_at timestamptz,
 reason text check (reason is null or (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]')),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default transaction_timestamp()
);
create index operational_event_history_idx on public.operational_event_events(event_id,occurred_at desc,id);

alter table public.site_client_links enable row level security;
alter table public.site_client_link_events enable row level security;
alter table public.operational_events enable row level security;
alter table public.operational_event_events enable row level security;
revoke all on public.site_client_links,public.site_client_link_events,public.operational_events,public.operational_event_events from public,anon,authenticated;

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
 'role_assignment','site_assignment','site','document_request','document_version','document_review','task',
 'onboarding_case','onboarding_requirement','onboarding_verification','person_profile','profile_submission',
 'sia_credential','sia_submission','controlled_publisher_grant','controlled_document','controlled_version',
 'controlled_publication','controlled_assignment','controlled_access','controlled_acknowledgement',
 'onboarding_team','onboarding_team_membership','onboarding_cover','onboarding_owner_change','task_assignment',
 'crm_organisation','crm_contact','crm_opportunity','crm_opportunity_event','crm_relationship_event',
 'crm_organisation_owner_event','crm_activity','crm_follow_up','crm_task_event',
 'site_client_link','operational_event','operational_event_event'));

create function private.operational_authorised() returns boolean language sql stable security definer set search_path='' as $$
 select private.current_person_id() is not null and
 (private.has_active_role('SUPER_ADMIN') or private.has_active_role('OFFICE_ADMIN') or private.has_active_role('OPERATIONS'))
$$;
revoke all on function private.operational_authorised() from public,anon,authenticated;

create function private.operational_owner_eligible(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.role_assignments r where r.person_id=target and r.role_code in ('OFFICE_ADMIN','OPERATIONS')
 and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))
$$;
revoke all on function private.operational_owner_eligible(uuid) from public,anon,authenticated;

-- No direct table writes, including through authenticated Data API; future transfer must be a new guarded operation.
create function private.guard_06a_tables() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.06a_write',true) is distinct from 'allowed' then raise exception 'Operational direct write denied'; end if;
 if tg_op='DELETE' then raise exception 'Operational history cannot be deleted'; end if;
 if tg_table_name in ('site_client_link_events','operational_event_events') and tg_op='UPDATE' then raise exception 'Operational history cannot be changed'; end if;
 if tg_table_name='site_client_links' and tg_op='UPDATE' then raise exception 'Site Client transfer is not available in 06A'; end if;
 if tg_table_name='operational_events' and tg_op='UPDATE' then
  if new.id is distinct from old.id or new.site_client_link_id is distinct from old.site_client_link_id or
     new.site_id is distinct from old.site_id or new.organisation_id is distinct from old.organisation_id or
     new.name is distinct from old.name or new.event_type is distinct from old.event_type or
     new.primary_contact_id is distinct from old.primary_contact_id or new.source_opportunity_id is distinct from old.source_opportunity_id or
     new.created_by_person_id is distinct from old.created_by_person_id or new.created_at is distinct from old.created_at then
   raise exception 'Event identity and provenance are immutable'; end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_06a_tables() from public,anon,authenticated;
create trigger guard_site_client_links before insert or update or delete on public.site_client_links for each row execute function private.guard_06a_tables();
create trigger guard_site_client_link_events before insert or update or delete on public.site_client_link_events for each row execute function private.guard_06a_tables();
create trigger guard_operational_events before insert or update or delete on public.operational_events for each row execute function private.guard_06a_tables();
create trigger guard_operational_event_events before insert or update or delete on public.operational_event_events for each row execute function private.guard_06a_tables();

-- Functions below use a transaction-local guard and each independently checks mapped Person and current role.
create function public.operational_link_site(p_site uuid,p_organisation uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result uuid;
begin
 if actor is null or not (private.has_active_role('SUPER_ADMIN') or private.office_owns_site(p_site)) or
    not exists(select 1 from public.crm_organisations where id=p_organisation and relationship_status='CLIENT') or
    exists(select 1 from public.site_client_links where site_id=p_site and effective_until is null) then raise exception 'Site Client link denied'; end if;
 perform set_config('kss.06a_write','allowed',true);
 insert into public.site_client_links(site_id,organisation_id,linked_by_person_id) values(p_site,p_organisation,actor) returning id into result;
 insert into public.site_client_link_events(link_id,kind,actor_person_id) values(result,'LINKED',actor);
 perform private.crm_audit('site_client_link',result,'INSERT',array['site_id','organisation_id']);
 return result;
end $$;
revoke all on function public.operational_link_site(uuid,uuid) from public,anon,authenticated;
grant execute on function public.operational_link_site(uuid,uuid) to authenticated;

create function public.operational_create_event(p_site uuid,p_organisation uuid,p_name text,p_type text,p_starts timestamptz,p_ends timestamptz,p_owner uuid,p_contact uuid default null,p_opportunity uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); link_id uuid; result uuid;
begin
 if actor is null or not (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')) or
    not private.operational_owner_eligible(p_owner) or
    p_name is null or length(trim(p_name)) not between 1 and 180 or p_name ~ '[[:cntrl:]]' or
    p_type not in ('FOOTBALL_MATCH','FESTIVAL','CONCERT','PARADE','CONFERENCE','CORPORATE_EVENT','OTHER') or
    p_starts is null or p_ends is null or not isfinite(p_starts) or not isfinite(p_ends) or p_ends<=p_starts or
    p_ends>p_starts+interval '31 days' then raise exception 'Event creation denied'; end if;
 select l.id into link_id from public.site_client_links l join public.sites s on s.id=l.site_id
 join public.crm_organisations o on o.id=l.organisation_id
 where l.site_id=p_site and l.organisation_id=p_organisation and l.effective_until is null
 and s.status='ACTIVE' and o.relationship_status='CLIENT';
 if link_id is null or (p_contact is not null and not exists(select 1 from public.crm_contacts c where c.id=p_contact and c.organisation_id=p_organisation and c.active)) or
    (p_opportunity is not null and not exists(select 1 from public.crm_opportunities x where x.id=p_opportunity and x.organisation_id=p_organisation and x.stage='WON')) then
  raise exception 'Event creation denied'; end if;
 perform set_config('kss.06a_write','allowed',true);
 insert into public.operational_events(site_client_link_id,site_id,organisation_id,name,event_type,starts_at,ends_at,owner_person_id,primary_contact_id,source_opportunity_id,created_by_person_id)
 values(link_id,p_site,p_organisation,trim(p_name),p_type,p_starts,p_ends,p_owner,p_contact,p_opportunity,actor) returning id into result;
 insert into public.operational_event_events(event_id,kind,new_status,new_owner_person_id,new_starts_at,new_ends_at,actor_person_id)
 values(result,'CREATED','PLANNING',p_owner,p_starts,p_ends,actor);
 perform private.crm_audit('operational_event',result,'INSERT',array['site_id','organisation_id','name','event_type','starts_at','ends_at','owner_person_id']);
 return result;
end $$;
revoke all on function public.operational_create_event(uuid,uuid,text,text,timestamptz,timestamptz,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.operational_create_event(uuid,uuid,text,text,timestamptz,timestamptz,uuid,uuid,uuid) to authenticated;

create function public.operational_change_event(p_event uuid,p_action text,p_status text default null,p_owner uuid default null,p_starts timestamptz default null,p_ends timestamptz default null,p_reason text default null) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); old public.operational_events%rowtype;
begin
 if actor is null or not private.operational_authorised() then raise exception 'Event action denied'; end if;
 select * into old from public.operational_events where id=p_event for update;
 if old.id is null or old.status in ('COMPLETED','CANCELLED') then raise exception 'Event action denied'; end if;
 if p_action='STATUS' then
  if not ((old.status='PLANNING' and p_status='CONFIRMED') or (old.status='CONFIRMED' and p_status='LIVE') or
    (old.status='LIVE' and p_status='COMPLETED') or (p_status='CANCELLED' and old.status in ('PLANNING','CONFIRMED','LIVE'))) or
    (p_status='CANCELLED' and (p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]')) then raise exception 'Event transition denied'; end if;
  perform set_config('kss.06a_write','allowed',true);
  update public.operational_events set status=p_status,updated_at=transaction_timestamp() where id=p_event;
  insert into public.operational_event_events(event_id,kind,old_status,new_status,reason,actor_person_id)
  values(p_event,'STATUS',old.status,p_status,case when p_status='CANCELLED' then trim(p_reason) else null end,actor);
 elsif p_action='OWNER' then
  if p_owner is null or p_owner=old.owner_person_id or not private.operational_owner_eligible(p_owner) or
    p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]' then raise exception 'Event owner change denied'; end if;
  perform set_config('kss.06a_write','allowed',true);
  update public.operational_events set owner_person_id=p_owner,updated_at=transaction_timestamp() where id=p_event;
  insert into public.operational_event_events(event_id,kind,old_owner_person_id,new_owner_person_id,reason,actor_person_id)
  values(p_event,'OWNER',old.owner_person_id,p_owner,trim(p_reason),actor);
 elsif p_action='DATES' then
  if p_starts is null or p_ends is null or not isfinite(p_starts) or not isfinite(p_ends) or p_ends<=p_starts or
    p_ends>p_starts+interval '31 days' or (p_starts=old.starts_at and p_ends=old.ends_at) or
    (old.status<>'PLANNING' and (p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]')) then raise exception 'Event date change denied'; end if;
  perform set_config('kss.06a_write','allowed',true);
  update public.operational_events set starts_at=p_starts,ends_at=p_ends,updated_at=transaction_timestamp() where id=p_event;
  insert into public.operational_event_events(event_id,kind,old_starts_at,new_starts_at,old_ends_at,new_ends_at,reason,actor_person_id)
  values(p_event,'DATES',old.starts_at,p_starts,old.ends_at,p_ends,case when p_reason is not null then trim(p_reason) else null end,actor);
 else raise exception 'Event action denied'; end if;
 perform private.crm_audit('operational_event_event',p_event,'UPDATE',array['status','owner_person_id','starts_at','ends_at']);
end $$;
revoke all on function public.operational_change_event(uuid,text,text,uuid,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.operational_change_event(uuid,text,text,uuid,timestamptz,timestamptz,text) to authenticated;

-- Narrow JSON projections are the only read surface for new tables. No raw CRM SELECT for Operations.
create function public.operational_sites(p_search text default '',p_organisation uuid default null,p_type text default null,p_status text default null,p_offset int default 0,p_limit int default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_offset<0 or p_offset>10000 or p_limit<1 or p_limit>50 or length(p_search)>80 then raise exception 'Operational read denied'; end if;
 with scoped as (select s.id,s.site_reference,s.name,s.address_line1,s.town_city,s.postcode,s.reporting_point,s.status,s.site_type,
   l.organisation_id,o.name as client_name,o.trading_name as client_trading_name,
   s.created_by_person_id
  from public.sites s left join public.site_client_links l on l.site_id=s.id and l.effective_until is null
  left join public.crm_organisations o on o.id=l.organisation_id
  where (private.has_active_role('SUPER_ADMIN') or private.has_active_role('OPERATIONS') or
        (private.has_active_role('OFFICE_ADMIN') and (s.created_by_person_id=private.current_person_id() or l.id is not null)))
  and (p_organisation is null or l.organisation_id=p_organisation)
  and (p_type is null or s.site_type=p_type) and (p_status is null or s.status=p_status)
  and (p_search='' or s.name ilike '%'||p_search||'%' or s.site_reference ilike '%'||p_search||'%' or o.name ilike '%'||p_search||'%')),
 page as (select * from scoped order by name,id offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),'items',coalesce((select jsonb_agg(to_jsonb(page)-'created_by_person_id' ||
   jsonb_build_object('can_manage',private.has_active_role('SUPER_ADMIN') or (private.has_active_role('OFFICE_ADMIN') and page.created_by_person_id=private.current_person_id()))) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.operational_sites(text,uuid,text,text,int,int) from public,anon,authenticated;
grant execute on function public.operational_sites(text,uuid,text,text,int,int) to authenticated;

create function public.operational_events_list(p_search text default '',p_organisation uuid default null,p_site uuid default null,p_status text default null,p_type text default null,p_owner uuid default null,p_from timestamptz default null,p_until timestamptz default null,p_offset int default 0,p_limit int default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or p_offset<0 or p_offset>10000 or p_limit<1 or p_limit>50 or length(p_search)>80 then raise exception 'Operational read denied'; end if;
 with scoped as (select e.id,e.name,e.event_type,e.starts_at,e.ends_at,e.status,e.owner_person_id,e.site_id,e.organisation_id,
  s.name as site_name,s.status as site_status,o.name as client_name,o.relationship_status as client_status,p.display_name as owner_name
  from public.operational_events e join public.sites s on s.id=e.site_id join public.crm_organisations o on o.id=e.organisation_id
  join public.people p on p.id=e.owner_person_id
  where (p_organisation is null or e.organisation_id=p_organisation) and (p_site is null or e.site_id=p_site)
  and (p_status is null or e.status=p_status) and (p_type is null or e.event_type=p_type)
  and (p_owner is null or e.owner_person_id=p_owner) and (p_from is null or e.ends_at>=p_from)
  and (p_until is null or e.starts_at<=p_until)
  and (p_search='' or e.name ilike '%'||p_search||'%' or s.name ilike '%'||p_search||'%' or o.name ilike '%'||p_search||'%')),
 page as (select * from scoped order by starts_at,id offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),'items',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.operational_events_list(text,uuid,uuid,text,text,uuid,timestamptz,timestamptz,int,int) from public,anon,authenticated;
grant execute on function public.operational_events_list(text,uuid,uuid,text,text,uuid,timestamptz,timestamptz,int,int) to authenticated;

create function public.operational_event_detail(p_event uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; office boolean;
begin
 if not private.operational_authorised() then raise exception 'Operational read denied'; end if;
 office:=private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN');
 select to_jsonb(e)-'site_client_link_id'-'created_by_person_id'-'primary_contact_id' || jsonb_build_object(
  'site_name',s.name,'site_reference',s.site_reference,'site_type',s.site_type,'site_status',s.status,
  'site_address_line1',s.address_line1,'site_town_city',s.town_city,'site_postcode',s.postcode,'site_reporting_point',s.reporting_point,
  'client_name',o.name,'client_status',o.relationship_status,'owner_name',p.display_name,
  'contact_name',case when c.id is null then null else c.first_name||' '||c.last_name end,'contact_job_title',c.job_title,
  'source_opportunity_id',case when office then e.source_opportunity_id else null end,
  'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.occurred_at desc,h.id desc) from (
    select * from public.operational_event_events where event_id=e.id order by occurred_at desc,id desc limit 100) h),'[]'::jsonb))
 into result
 from public.operational_events e join public.sites s on s.id=e.site_id join public.crm_organisations o on o.id=e.organisation_id
 join public.people p on p.id=e.owner_person_id left join public.crm_contacts c on c.id=e.primary_contact_id where e.id=p_event;
 if not office and result is not null then result:=result-'source_opportunity_id'; end if;
 return result;
end $$;
revoke all on function public.operational_event_detail(uuid) from public,anon,authenticated;
grant execute on function public.operational_event_detail(uuid) to authenticated;

create function public.operational_client_choices() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() then raise exception 'Operational read denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) into result
 from public.crm_organisations o where relationship_status='CLIENT' and
 (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN') or
  exists(select 1 from public.site_client_links l where l.organisation_id=o.id and l.effective_until is null));
 return result;
end $$;
revoke all on function public.operational_client_choices() from public,anon,authenticated;
grant execute on function public.operational_client_choices() to authenticated;

create function public.operational_contact_choices(p_organisation uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN')) then raise exception 'Operational read denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',first_name||' '||last_name,'job_title',job_title) order by last_name,first_name),'[]'::jsonb)
 into result from public.crm_contacts where organisation_id=p_organisation and active; return result;
end $$;
revoke all on function public.operational_contact_choices(uuid) from public,anon,authenticated;
grant execute on function public.operational_contact_choices(uuid) to authenticated;
