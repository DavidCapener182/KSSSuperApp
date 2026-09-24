-- TASK-05A: synthetic CRM foundation. No Staff/private-document authority is inherited.
create table public.crm_organisations (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 160 and name !~ '[[:cntrl:]]'),
 trading_name text check (trading_name is null or (length(trim(trading_name)) between 1 and 160 and trading_name !~ '[[:cntrl:]]')),
 website text check (website is null or (length(website) <= 300 and website ~* '^https://[^[:space:]]+$')),
 general_email text check (general_email is null or (length(general_email) <= 254 and general_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
 main_phone text check (main_phone is null or (length(main_phone) between 7 and 30 and main_phone ~ '^[+0-9 ()-]+$')),
 relationship_status text not null default 'PROSPECT' check (relationship_status in ('PROSPECT','CLIENT','FORMER_CLIENT','PARTNER')),
 owner_person_id uuid references public.people(id),
 created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index crm_organisations_name_idx on public.crm_organisations(lower(name));

create table public.crm_contacts (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.crm_organisations(id),
 first_name text not null check (length(trim(first_name)) between 1 and 100 and first_name !~ '[[:cntrl:]]'),
 last_name text not null check (length(trim(last_name)) between 1 and 100 and last_name !~ '[[:cntrl:]]'),
 job_title text check (job_title is null or (length(job_title) <= 120 and job_title !~ '[[:cntrl:]]')),
 business_email text check (business_email is null or (length(business_email) <= 254 and business_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
 business_phone text check (business_phone is null or (length(business_phone) between 7 and 30 and business_phone ~ '^[+0-9 ()-]+$')),
 active boolean not null default true,
 is_primary boolean not null default false,
 created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (id, organisation_id),
 check (active or not is_primary)
);
create unique index crm_contact_active_email_idx on public.crm_contacts(organisation_id, lower(business_email)) where active and business_email is not null;
create unique index crm_contact_primary_idx on public.crm_contacts(organisation_id) where active and is_primary;
create index crm_contacts_name_idx on public.crm_contacts(lower(last_name), lower(first_name));

create table public.crm_opportunities (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.crm_organisations(id),
 primary_contact_id uuid,
 title text not null check (length(trim(title)) between 1 and 180 and title !~ '[[:cntrl:]]'),
 opportunity_type text not null check (opportunity_type in ('TENDER','DIRECT_ENQUIRY','EXISTING_CLIENT_EXPANSION','RENEWAL','PROSPECTING')),
 stage text not null default 'NEW_LEAD' check (stage in ('NEW_LEAD','CONTACTED','QUALIFIED','PROPOSAL_TENDER','NEGOTIATION','WON','LOST')),
 owner_person_id uuid not null references public.people(id),
 estimated_value_gbp_pence bigint check (estimated_value_gbp_pence is null or estimated_value_gbp_pence >= 0),
 expected_decision_date date,
 summary text check (summary is null or (length(summary) <= 1000 and summary !~ '[[:cntrl:]]')),
 lost_reason text check (lost_reason is null or (length(trim(lost_reason)) between 3 and 500 and lost_reason !~ '[[:cntrl:]]')),
 created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (primary_contact_id, organisation_id) references public.crm_contacts(id, organisation_id),
 check ((stage='LOST') = (lost_reason is not null))
);
create index crm_opportunities_org_idx on public.crm_opportunities(organisation_id, created_at desc);
create index crm_opportunities_stage_idx on public.crm_opportunities(stage, created_at desc);
create index crm_opportunities_owner_idx on public.crm_opportunities(owner_person_id, created_at desc);

create table public.crm_opportunity_events (
 id uuid primary key default gen_random_uuid(),
 opportunity_id uuid not null references public.crm_opportunities(id),
 kind text not null check (kind in ('STAGE','OWNER','ESTIMATED_VALUE')),
 old_stage text, new_stage text,
 old_owner_person_id uuid references public.people(id), new_owner_person_id uuid references public.people(id),
 old_value_gbp_pence bigint, new_value_gbp_pence bigint,
 reason text check (reason is null or (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]')),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default now(),
 check ((kind='STAGE' and old_stage is not null and new_stage is not null and old_stage<>new_stage)
   or (kind='OWNER' and old_owner_person_id is not null and new_owner_person_id is not null and old_owner_person_id<>new_owner_person_id)
   or kind='ESTIMATED_VALUE')
);
create index crm_opportunity_events_at_idx on public.crm_opportunity_events(opportunity_id, occurred_at, id);
create table public.crm_relationship_events (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.crm_organisations(id),
 opportunity_id uuid not null references public.crm_opportunities(id),
 old_status text not null,
 new_status text not null,
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default now(),
 check (old_status='PROSPECT' and new_status='CLIENT')
);

alter table public.crm_organisations enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_opportunity_events enable row level security;
alter table public.crm_relationship_events enable row level security;
revoke all on public.crm_organisations,public.crm_contacts,public.crm_opportunities,public.crm_opportunity_events,public.crm_relationship_events from public,anon,authenticated;
grant select on public.crm_organisations,public.crm_contacts,public.crm_opportunities,public.crm_opportunity_events,public.crm_relationship_events to authenticated;
create function private.crm_authorised() returns boolean language sql stable security definer set search_path='' as $$
 select private.current_person_id() is not null and (private.has_active_role('OFFICE_ADMIN') or private.has_active_role('SUPER_ADMIN'))
$$;
revoke all on function private.crm_authorised() from public,anon,authenticated;
grant execute on function private.crm_authorised() to authenticated;
create policy crm_org_read on public.crm_organisations for select to authenticated using (private.crm_authorised());
create policy crm_contact_read on public.crm_contacts for select to authenticated using (private.crm_authorised());
create policy crm_opportunity_read on public.crm_opportunities for select to authenticated using (private.crm_authorised());
create policy crm_opportunity_event_read on public.crm_opportunity_events for select to authenticated using (private.crm_authorised());
create policy crm_relationship_event_read on public.crm_relationship_events for select to authenticated using (private.crm_authorised());

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
 'role_assignment','site_assignment','site','document_request','document_version','document_review','task',
 'onboarding_case','onboarding_requirement','onboarding_verification','person_profile','profile_submission',
 'sia_credential','sia_submission','controlled_publisher_grant','controlled_document','controlled_version',
 'controlled_publication','controlled_assignment','controlled_access','controlled_acknowledgement',
 'onboarding_team','onboarding_team_membership','onboarding_cover','onboarding_owner_change','task_assignment',
 'crm_organisation','crm_contact','crm_opportunity','crm_opportunity_event','crm_relationship_event'));

create function private.crm_owner_eligible(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.role_assignments r where r.person_id=target
 and r.role_code in ('OFFICE_ADMIN','SUPER_ADMIN') and r.revoked_at is null and r.effective_from<=now()
 and (r.effective_until is null or r.effective_until>now()))
$$;
revoke all on function private.crm_owner_eligible(uuid) from public,anon,authenticated;

create function private.crm_audit(entity text, target uuid, verb text, fields text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
 values(private.current_person_id(),private.current_person_id(),entity,target,verb,jsonb_build_object('changed_fields',fields));
end $$;
revoke all on function private.crm_audit(text,uuid,text,text[]) from public,anon,authenticated;

create function public.crm_create_organisation(p_name text,p_trading_name text default null,p_website text default null,p_email text default null,p_phone text default null,p_owner uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; actor uuid:=private.current_person_id();
begin
 if not private.crm_authorised() or (p_owner is not null and not private.crm_owner_eligible(p_owner)) then raise exception 'CRM action denied'; end if;
 insert into public.crm_organisations(name,trading_name,website,general_email,main_phone,owner_person_id,created_by_person_id)
 values(trim(p_name),nullif(trim(p_trading_name),''),nullif(trim(p_website),''),nullif(trim(p_email),''),nullif(trim(p_phone),''),coalesce(p_owner,actor),actor)
 returning id into result;
 perform private.crm_audit('crm_organisation',result,'INSERT',array['name','trading_name','website','general_email','main_phone','owner_person_id']);
 return result;
end $$;

create function public.crm_create_contact(p_organisation uuid,p_first text,p_last text,p_title text default null,p_email text default null,p_phone text default null,p_primary boolean default false,p_duplicate_confirmed boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; actor uuid:=private.current_person_id(); same_name boolean;
begin
 if not private.crm_authorised() or not exists(select 1 from public.crm_organisations where id=p_organisation) then raise exception 'CRM action denied'; end if;
 select exists(select 1 from public.crm_contacts where organisation_id=p_organisation and active
   and lower(first_name)=lower(trim(p_first)) and lower(last_name)=lower(trim(p_last))) into same_name;
 if nullif(trim(p_email),'') is null and same_name and not p_duplicate_confirmed then raise exception 'Possible duplicate contact: explicit confirmation required'; end if;
 if p_primary then update public.crm_contacts set is_primary=false,updated_at=now() where organisation_id=p_organisation and is_primary; end if;
 insert into public.crm_contacts(organisation_id,first_name,last_name,job_title,business_email,business_phone,is_primary,created_by_person_id)
 values(p_organisation,trim(p_first),trim(p_last),nullif(trim(p_title),''),nullif(lower(trim(p_email)),''),nullif(trim(p_phone),''),p_primary,actor)
 returning id into result;
 perform private.crm_audit('crm_contact',result,'INSERT',array['first_name','last_name','job_title','business_email','business_phone','is_primary']);
 return result;
end $$;

create function public.crm_create_opportunity(p_organisation uuid,p_title text,p_type text,p_owner uuid,p_contact uuid default null,p_value bigint default null,p_decision date default null,p_summary text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; actor uuid:=private.current_person_id();
begin
 if not private.crm_authorised() or not private.crm_owner_eligible(p_owner)
  or not exists(select 1 from public.crm_organisations where id=p_organisation)
  or (p_contact is not null and not exists(select 1 from public.crm_contacts where id=p_contact and organisation_id=p_organisation and active))
 then raise exception 'CRM action denied'; end if;
 insert into public.crm_opportunities(organisation_id,title,opportunity_type,owner_person_id,primary_contact_id,estimated_value_gbp_pence,expected_decision_date,summary,created_by_person_id)
 values(p_organisation,trim(p_title),p_type,p_owner,p_contact,p_value,p_decision,nullif(trim(p_summary),''),actor)
 returning id into result;
 perform private.crm_audit('crm_opportunity',result,'INSERT',array['title','opportunity_type','owner_person_id','primary_contact_id','estimated_value_gbp_pence','expected_decision_date','summary']);
 return result;
end $$;

create function public.crm_transition_opportunity(p_id uuid,p_stage text,p_reason text default null) returns void
language plpgsql security definer set search_path='' as $$
declare old_row public.crm_opportunities%rowtype; old_org public.crm_organisations%rowtype;
declare old_rank int; new_rank int; actor uuid:=private.current_person_id();
begin
 if not private.crm_authorised() then raise exception 'CRM action denied'; end if;
 select * into old_row from public.crm_opportunities where id=p_id for update;
 if not found or old_row.stage in ('WON','LOST') or p_stage=old_row.stage
  or p_stage not in ('NEW_LEAD','CONTACTED','QUALIFIED','PROPOSAL_TENDER','NEGOTIATION','WON','LOST') then raise exception 'Invalid CRM transition'; end if;
 old_rank:=array_position(array['NEW_LEAD','CONTACTED','QUALIFIED','PROPOSAL_TENDER','NEGOTIATION'],old_row.stage);
 new_rank:=array_position(array['NEW_LEAD','CONTACTED','QUALIFIED','PROPOSAL_TENDER','NEGOTIATION'],p_stage);
 if ((new_rank is not null and new_rank<old_rank) or p_stage='LOST') and (p_reason is null or length(trim(p_reason))<3) then raise exception 'Reason required'; end if;
 if p_stage='WON' then
  select * into old_org from public.crm_organisations where id=old_row.organisation_id for update;
  if old_org.relationship_status in ('FORMER_CLIENT','PARTNER') then raise exception 'Relationship conversion requires separate rule'; end if;
 end if;
 update public.crm_opportunities set stage=p_stage,lost_reason=case when p_stage='LOST' then trim(p_reason) else null end,updated_at=now() where id=p_id;
 insert into public.crm_opportunity_events(opportunity_id,kind,old_stage,new_stage,reason,actor_person_id)
 values(p_id,'STAGE',old_row.stage,p_stage,nullif(trim(p_reason),''),actor);
 perform private.crm_audit('crm_opportunity_event',p_id,'UPDATE',array['stage']);
 if p_stage='WON' and old_org.relationship_status='PROSPECT' then
  update public.crm_organisations set relationship_status='CLIENT',updated_at=now() where id=old_org.id;
  insert into public.crm_relationship_events(organisation_id,opportunity_id,old_status,new_status,actor_person_id)
  values(old_org.id,p_id,'PROSPECT','CLIENT',actor);
  perform private.crm_audit('crm_relationship_event',old_org.id,'UPDATE',array['relationship_status']);
 end if;
end $$;

create function public.crm_change_opportunity_owner(p_id uuid,p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare old_owner uuid; actor uuid:=private.current_person_id();
begin
 if not private.crm_authorised() or not private.crm_owner_eligible(p_owner) then raise exception 'CRM action denied'; end if;
 select owner_person_id into old_owner from public.crm_opportunities where id=p_id and stage not in ('WON','LOST') for update;
 if not found or old_owner=p_owner then raise exception 'Invalid CRM owner change'; end if;
 update public.crm_opportunities set owner_person_id=p_owner,updated_at=now() where id=p_id;
 insert into public.crm_opportunity_events(opportunity_id,kind,old_owner_person_id,new_owner_person_id,actor_person_id)
 values(p_id,'OWNER',old_owner,p_owner,actor);
 perform private.crm_audit('crm_opportunity_event',p_id,'UPDATE',array['owner_person_id']);
end $$;

create function public.crm_change_opportunity_value(p_id uuid,p_value bigint) returns void
language plpgsql security definer set search_path='' as $$
declare old_value bigint; actor uuid:=private.current_person_id();
begin
 if not private.crm_authorised() or (p_value is not null and p_value<0) then raise exception 'CRM action denied'; end if;
 select estimated_value_gbp_pence into old_value from public.crm_opportunities where id=p_id and stage not in ('WON','LOST') for update;
 if not found or old_value is not distinct from p_value then raise exception 'Invalid CRM value change'; end if;
 update public.crm_opportunities set estimated_value_gbp_pence=p_value,updated_at=now() where id=p_id;
 insert into public.crm_opportunity_events(opportunity_id,kind,old_value_gbp_pence,new_value_gbp_pence,actor_person_id)
 values(p_id,'ESTIMATED_VALUE',old_value,p_value,actor);
 perform private.crm_audit('crm_opportunity_event',p_id,'UPDATE',array['estimated_value_gbp_pence']);
end $$;

create function public.crm_update_organisation(p_id uuid,p_name text,p_trading_name text,p_website text,p_email text,p_phone text,p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare previous public.crm_organisations%rowtype;
begin
 if not private.crm_authorised() or (p_owner is not null and not private.crm_owner_eligible(p_owner)) then raise exception 'CRM action denied'; end if;
 select * into previous from public.crm_organisations where id=p_id for update;
 if not found then raise exception 'CRM action denied'; end if;
 update public.crm_organisations set name=trim(p_name),trading_name=nullif(trim(p_trading_name),''),
 website=nullif(trim(p_website),''),general_email=nullif(lower(trim(p_email)),''),
 main_phone=nullif(trim(p_phone),''),owner_person_id=p_owner,updated_at=now() where id=p_id;
 perform private.crm_audit('crm_organisation',p_id,'UPDATE',array['name','trading_name','website','general_email','main_phone','owner_person_id']);
end $$;

create function public.crm_update_contact(p_id uuid,p_first text,p_last text,p_title text,p_email text,p_phone text,p_active boolean,p_primary boolean,p_duplicate_confirmed boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare previous public.crm_contacts%rowtype;
begin
 if not private.crm_authorised() then raise exception 'CRM action denied'; end if;
 select * into previous from public.crm_contacts where id=p_id for update;
 if not found then raise exception 'CRM action denied'; end if;
 if p_active and nullif(trim(p_email),'') is null and not p_duplicate_confirmed and
 exists(select 1 from public.crm_contacts where organisation_id=previous.organisation_id and id<>p_id and active
 and lower(first_name)=lower(trim(p_first)) and lower(last_name)=lower(trim(p_last)))
 then raise exception 'Possible duplicate contact: explicit confirmation required'; end if;
 if not p_active and exists(select 1 from public.crm_opportunities where primary_contact_id=p_id and stage not in ('WON','LOST'))
 then raise exception 'Open opportunity uses this contact'; end if;
 if p_primary and p_active then update public.crm_contacts set is_primary=false,updated_at=now() where organisation_id=previous.organisation_id and is_primary and id<>p_id; end if;
 update public.crm_contacts set first_name=trim(p_first),last_name=trim(p_last),job_title=nullif(trim(p_title),''),
 business_email=nullif(lower(trim(p_email)),''),business_phone=nullif(trim(p_phone),''),
 active=p_active,is_primary=p_active and p_primary,updated_at=now() where id=p_id;
 perform private.crm_audit('crm_contact',p_id,'UPDATE',array['first_name','last_name','job_title','business_email','business_phone','active','is_primary']);
end $$;

revoke all on function public.crm_create_organisation(text,text,text,text,text,uuid),public.crm_create_contact(uuid,text,text,text,text,text,boolean,boolean),
 public.crm_create_opportunity(uuid,text,text,uuid,uuid,bigint,date,text),public.crm_transition_opportunity(uuid,text,text),
 public.crm_change_opportunity_owner(uuid,uuid),public.crm_change_opportunity_value(uuid,bigint),
 public.crm_update_organisation(uuid,text,text,text,text,text,uuid),public.crm_update_contact(uuid,text,text,text,text,text,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.crm_create_organisation(text,text,text,text,text,uuid),public.crm_create_contact(uuid,text,text,text,text,text,boolean,boolean),
 public.crm_create_opportunity(uuid,text,text,uuid,uuid,bigint,date,text),public.crm_transition_opportunity(uuid,text,text),
 public.crm_change_opportunity_owner(uuid,uuid),public.crm_change_opportunity_value(uuid,bigint),
 public.crm_update_organisation(uuid,text,text,text,text,text,uuid),public.crm_update_contact(uuid,text,text,text,text,text,boolean,boolean,boolean) to authenticated;
