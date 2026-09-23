-- TASK-06B: synthetic Event staffing demand. No Person allocations or eligibility claims.
create table public.operational_role_definitions (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
 display_name text not null check (length(trim(display_name)) between 2 and 80 and display_name !~ '[[:cntrl:]]'),
 description text not null default '' check (length(description)<=240 and description !~ '[[:cntrl:]]'),
 active boolean not null default true,
 created_at timestamptz not null default transaction_timestamp(),
 retired_at timestamptz,
 check ((active and retired_at is null) or (not active and retired_at is not null))
);
insert into public.operational_role_definitions(code,display_name) values
 ('DEPLOYMENT_MANAGER','Deployment Manager'),('STAND_MANAGER','Stand Manager'),
 ('STAND_SUPERVISOR','Stand Supervisor'),('SIA','SIA'),('STEWARD','Steward'),
 ('RESPONSE','Response'),('SEARCH','Search'),('GATE_SECURITY','Gate Security');

create table public.event_staffing_requirements (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.operational_events(id),
 role_id uuid not null references public.operational_role_definitions(id),
 service_date date not null,
 required_quantity integer not null check (required_quantity between 1 and 10000),
 report_at timestamptz not null,
 shift_starts_at timestamptz not null,
 shift_ends_at timestamptz not null,
 area_label text not null check (length(trim(area_label)) between 1 and 100 and area_label !~ '[[:cntrl:]]'),
 instructions text not null default '' check (length(instructions)<=500 and instructions !~ '[[:cntrl:]]'),
 state text not null default 'PLANNED' check (state in ('PLANNED','CANCELLED')),
 revision integer not null default 1 check (revision>0),
 created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(),
 updated_at timestamptz not null default transaction_timestamp(),
 check (isfinite(report_at) and isfinite(shift_starts_at) and isfinite(shift_ends_at)
  and report_at<=shift_starts_at and shift_starts_at<shift_ends_at
  and shift_ends_at<=shift_starts_at+interval '14 days'
  and report_at>=shift_starts_at-interval '7 days'
  and service_date=(report_at at time zone 'Europe/London')::date),
 unique(id,event_id)
);
create index event_staffing_plan_idx on public.event_staffing_requirements(event_id,service_date,state,id);
create index event_staffing_role_idx on public.event_staffing_requirements(role_id,event_id);

-- Typed immutable snapshots are the authoritative business history for each revision.
create table public.event_staffing_requirement_revisions (
 id uuid primary key default gen_random_uuid(),
 requirement_id uuid not null,
 event_id uuid not null,
 revision integer not null check (revision>0),
 kind text not null check (kind in ('CREATED','AMENDED','CANCELLED')),
 role_id uuid not null references public.operational_role_definitions(id),
 service_date date not null,
 required_quantity integer not null check (required_quantity between 1 and 10000),
 report_at timestamptz not null,
 shift_starts_at timestamptz not null,
 shift_ends_at timestamptz not null,
 area_label text not null,
 instructions text not null,
 state text not null check (state in ('PLANNED','CANCELLED')),
 reason text check (reason is null or (length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]')),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default transaction_timestamp(),
 foreign key(requirement_id,event_id) references public.event_staffing_requirements(id,event_id),
 unique(requirement_id,revision)
);
create index event_staffing_history_idx on public.event_staffing_requirement_revisions(requirement_id,revision desc);

alter table public.operational_role_definitions enable row level security;
alter table public.event_staffing_requirements enable row level security;
alter table public.event_staffing_requirement_revisions enable row level security;
revoke all on public.operational_role_definitions,public.event_staffing_requirements,public.event_staffing_requirement_revisions from public,anon,authenticated;

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
 'role_assignment','site_assignment','site','document_request','document_version','document_review','task',
 'onboarding_case','onboarding_requirement','onboarding_verification','person_profile','profile_submission',
 'sia_credential','sia_submission','controlled_publisher_grant','controlled_document','controlled_version',
 'controlled_publication','controlled_assignment','controlled_access','controlled_acknowledgement',
 'onboarding_team','onboarding_team_membership','onboarding_cover','onboarding_owner_change','task_assignment',
 'crm_organisation','crm_contact','crm_opportunity','crm_opportunity_event','crm_relationship_event',
 'crm_organisation_owner_event','crm_activity','crm_follow_up','crm_task_event',
 'site_client_link','operational_event','operational_event_event','operational_role','event_staffing_requirement'));

create function private.guard_staffing_06b() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_06b',true) is distinct from 'allowed' then raise exception 'Staffing direct write denied'; end if;
 if tg_op='DELETE' then raise exception 'Staffing records cannot be deleted'; end if;
 if tg_table_name='event_staffing_requirement_revisions' and tg_op='UPDATE' then raise exception 'Staffing history is immutable'; end if;
 if tg_table_name='event_staffing_requirements' and tg_op='UPDATE' and
   (new.id is distinct from old.id or new.event_id is distinct from old.event_id or
    new.created_by_person_id is distinct from old.created_by_person_id or new.created_at is distinct from old.created_at or
    new.revision<>old.revision+1 or old.state='CANCELLED') then raise exception 'Staffing identity/history cannot be changed'; end if;
 if tg_table_name='operational_role_definitions' and tg_op='UPDATE' and
   (new.id is distinct from old.id or new.code is distinct from old.code or new.display_name is distinct from old.display_name or
    new.description is distinct from old.description or new.created_at is distinct from old.created_at or not old.active) then
    raise exception 'Operational role meaning is immutable'; end if;
 return new;
end $$;
revoke all on function private.guard_staffing_06b() from public,anon,authenticated;
create trigger guard_staffing_roles before insert or update or delete on public.operational_role_definitions for each row execute function private.guard_staffing_06b();
create trigger guard_staffing_requirements before insert or update or delete on public.event_staffing_requirements for each row execute function private.guard_staffing_06b();
create trigger guard_staffing_revisions before insert or update or delete on public.event_staffing_requirement_revisions for each row execute function private.guard_staffing_06b();

create function private.validate_staffing_06b(p_event public.operational_events,p_role uuid,p_quantity integer,
 p_report timestamptz,p_start timestamptz,p_end timestamptz,p_area text,p_instructions text,p_reason text) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if p_event.id is null or p_event.status not in ('PLANNING','CONFIRMED','LIVE') or
  not exists(select 1 from public.operational_role_definitions where id=p_role and active) or
  p_quantity is null or p_quantity not between 1 and 10000 or
  p_report is null or p_start is null or p_end is null or
  not isfinite(p_report) or not isfinite(p_start) or not isfinite(p_end) or
  p_report>p_start or p_start>=p_end or p_end>p_start+interval '14 days' or
  p_report<p_start-interval '7 days' or
  p_area is null or length(trim(p_area)) not between 1 and 100 or p_area ~ '[[:cntrl:]]' or
  p_instructions is null or length(p_instructions)>500 or p_instructions ~ '[[:cntrl:]]' or
  (p_report at time zone 'Europe/London')::date not between
    (p_event.starts_at at time zone 'Europe/London')::date and (p_event.ends_at at time zone 'Europe/London')::date or
  (p_reason is not null and (length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]')) then
    raise exception 'Invalid staffing requirement'; end if;
 if (p_end>p_start+interval '24 hours' or p_report<p_start-interval '12 hours') and p_reason is null then
   raise exception 'Unusually long duty or early reporting requires confirmation reason'; end if;
end $$;
revoke all on function private.validate_staffing_06b(public.operational_events,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text) from public,anon,authenticated;

create function public.staffing_role_choices() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() then raise exception 'Staffing read denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',display_name,'active',active)
   order by display_name),'[]'::jsonb) into result from public.operational_role_definitions;
 return result;
end $$;
revoke all on function public.staffing_role_choices() from public,anon,authenticated;
grant execute on function public.staffing_role_choices() to authenticated;

create function public.staffing_plan(p_event uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() then raise exception 'Staffing read denied'; end if;
 if not exists(select 1 from public.operational_events where id=p_event) then return null; end if;
 select jsonb_build_object('event_id',p_event,
  'required_total',coalesce((select sum(required_quantity) from public.event_staffing_requirements where event_id=p_event and state='PLANNED'),0),
  'items',coalesce((select jsonb_agg(jsonb_build_object(
    'id',r.id,'role_id',r.role_id,'role_code',o.code,'role_name',o.display_name,'service_date',r.service_date,
    'required_quantity',r.required_quantity,'report_at',r.report_at,'shift_starts_at',r.shift_starts_at,
    'shift_ends_at',r.shift_ends_at,'area_label',r.area_label,'instructions',r.instructions,'state',r.state,
    'revision',r.revision,'created_at',r.created_at,'updated_at',r.updated_at)
    order by r.service_date,r.report_at,o.display_name,r.id)
    from public.event_staffing_requirements r join public.operational_role_definitions o on o.id=r.role_id
    where r.event_id=p_event),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.staffing_plan(uuid) from public,anon,authenticated;
grant execute on function public.staffing_plan(uuid) to authenticated;

create function public.staffing_history(p_event uuid,p_requirement uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() or not exists(select 1 from public.event_staffing_requirements where id=p_requirement and event_id=p_event) then
  raise exception 'Staffing history denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('revision',h.revision,'kind',h.kind,'role_id',h.role_id,
   'role_name',o.display_name,'service_date',h.service_date,'required_quantity',h.required_quantity,
   'report_at',h.report_at,'shift_starts_at',h.shift_starts_at,'shift_ends_at',h.shift_ends_at,
   'area_label',h.area_label,'instructions',h.instructions,'state',h.state,'reason',h.reason,
   'actor_name',p.display_name,'occurred_at',h.occurred_at) order by h.revision desc),'[]'::jsonb) into result
 from public.event_staffing_requirement_revisions h join public.operational_role_definitions o on o.id=h.role_id
 join public.people p on p.id=h.actor_person_id where h.event_id=p_event and h.requirement_id=p_requirement;
 return result;
end $$;
revoke all on function public.staffing_history(uuid,uuid) from public,anon,authenticated;
grant execute on function public.staffing_history(uuid,uuid) to authenticated;

create function public.staffing_create(p_event uuid,p_role uuid,p_quantity integer,p_report timestamptz,
 p_start timestamptz,p_end timestamptz,p_area text,p_instructions text default '',p_reason text default null,
 p_confirm_duplicate boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); ev public.operational_events%rowtype; result uuid; day date;
begin
 if actor is null or not private.operational_authorised() then raise exception 'Staffing create denied'; end if;
 select * into ev from public.operational_events where id=p_event for update;
 perform private.validate_staffing_06b(ev,p_role,p_quantity,p_report,p_start,p_end,p_area,p_instructions,p_reason);
 if ev.status<>'PLANNING' and p_reason is null then raise exception 'Confirmed or live Event change requires reason'; end if;
 day:=(p_report at time zone 'Europe/London')::date;
 if not p_confirm_duplicate and exists(select 1 from public.event_staffing_requirements r where r.event_id=p_event and r.state='PLANNED'
   and r.role_id=p_role and r.service_date=day and r.report_at=p_report and r.shift_starts_at=p_start
   and r.shift_ends_at=p_end and lower(trim(r.area_label))=lower(trim(p_area))) then
   raise exception 'Matching staffing line exists; confirm duplicate'; end if;
 perform set_config('kss.write_06b','allowed',true);
 insert into public.event_staffing_requirements(event_id,role_id,service_date,required_quantity,report_at,shift_starts_at,
   shift_ends_at,area_label,instructions,created_by_person_id) values(p_event,p_role,day,p_quantity,p_report,p_start,
   p_end,trim(p_area),trim(p_instructions),actor) returning id into result;
 insert into public.event_staffing_requirement_revisions(requirement_id,event_id,revision,kind,role_id,service_date,
   required_quantity,report_at,shift_starts_at,shift_ends_at,area_label,instructions,state,reason,actor_person_id)
 values(result,p_event,1,'CREATED',p_role,day,p_quantity,p_report,p_start,p_end,trim(p_area),trim(p_instructions),'PLANNED',nullif(trim(p_reason),''),actor);
 perform private.crm_audit('event_staffing_requirement',result,'INSERT',array['event_id','role_id','service_date','required_quantity','report_at','shift_starts_at','shift_ends_at','area_label']);
 return result;
end $$;
revoke all on function public.staffing_create(uuid,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.staffing_create(uuid,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text,boolean) to authenticated;

create function public.staffing_amend(p_event uuid,p_requirement uuid,p_expected_revision integer,p_role uuid,p_quantity integer,
 p_report timestamptz,p_start timestamptz,p_end timestamptz,p_area text,p_instructions text default '',p_reason text default null,
 p_confirm_duplicate boolean default false) returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); ev public.operational_events%rowtype; old public.event_staffing_requirements%rowtype; day date; next_revision integer;
begin
 if actor is null or not private.operational_authorised() then raise exception 'Staffing amend denied'; end if;
 select * into ev from public.operational_events where id=p_event for update;
 select * into old from public.event_staffing_requirements where id=p_requirement and event_id=p_event for update;
 if old.id is null or old.state<>'PLANNED' or old.revision is distinct from p_expected_revision then raise exception 'Stale or unavailable staffing requirement'; end if;
 perform private.validate_staffing_06b(ev,p_role,p_quantity,p_report,p_start,p_end,p_area,p_instructions,p_reason);
 if ev.status<>'PLANNING' and p_reason is null then raise exception 'Confirmed or live Event change requires reason'; end if;
 day:=(p_report at time zone 'Europe/London')::date;
 if old.role_id=p_role and old.required_quantity=p_quantity and old.report_at=p_report and old.shift_starts_at=p_start and
    old.shift_ends_at=p_end and old.area_label=trim(p_area) and old.instructions=trim(p_instructions) then
    raise exception 'No staffing change'; end if;
 if not p_confirm_duplicate and exists(select 1 from public.event_staffing_requirements r where r.event_id=p_event and r.id<>p_requirement and r.state='PLANNED'
   and r.role_id=p_role and r.service_date=day and r.report_at=p_report and r.shift_starts_at=p_start
   and r.shift_ends_at=p_end and lower(trim(r.area_label))=lower(trim(p_area))) then
   raise exception 'Matching staffing line exists; confirm duplicate'; end if;
 next_revision:=old.revision+1;
 perform set_config('kss.write_06b','allowed',true);
 update public.event_staffing_requirements set role_id=p_role,service_date=day,required_quantity=p_quantity,
  report_at=p_report,shift_starts_at=p_start,shift_ends_at=p_end,area_label=trim(p_area),instructions=trim(p_instructions),
  revision=next_revision,updated_at=transaction_timestamp() where id=p_requirement;
 insert into public.event_staffing_requirement_revisions(requirement_id,event_id,revision,kind,role_id,service_date,
   required_quantity,report_at,shift_starts_at,shift_ends_at,area_label,instructions,state,reason,actor_person_id)
 values(p_requirement,p_event,next_revision,'AMENDED',p_role,day,p_quantity,p_report,p_start,p_end,trim(p_area),trim(p_instructions),'PLANNED',nullif(trim(p_reason),''),actor);
 perform private.crm_audit('event_staffing_requirement',p_requirement,'UPDATE',array['revision','role_id','service_date','required_quantity','report_at','shift_starts_at','shift_ends_at','area_label','instructions']);
 return next_revision;
end $$;
revoke all on function public.staffing_amend(uuid,uuid,integer,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.staffing_amend(uuid,uuid,integer,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text,boolean) to authenticated;

create function public.staffing_cancel(p_event uuid,p_requirement uuid,p_expected_revision integer,p_reason text) returns integer
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); ev public.operational_events%rowtype; old public.event_staffing_requirements%rowtype; next_revision integer;
begin
 if actor is null or not private.operational_authorised() or p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]' then
  raise exception 'Staffing cancel denied'; end if;
 select * into ev from public.operational_events where id=p_event for update;
 select * into old from public.event_staffing_requirements where id=p_requirement and event_id=p_event for update;
 if ev.id is null or ev.status in ('COMPLETED','CANCELLED') or old.id is null or old.state<>'PLANNED' or
   old.revision is distinct from p_expected_revision then raise exception 'Stale or unavailable staffing requirement'; end if;
 next_revision:=old.revision+1;
 perform set_config('kss.write_06b','allowed',true);
 update public.event_staffing_requirements set state='CANCELLED',revision=next_revision,updated_at=transaction_timestamp() where id=p_requirement;
 insert into public.event_staffing_requirement_revisions(requirement_id,event_id,revision,kind,role_id,service_date,
   required_quantity,report_at,shift_starts_at,shift_ends_at,area_label,instructions,state,reason,actor_person_id)
 values(p_requirement,p_event,next_revision,'CANCELLED',old.role_id,old.service_date,old.required_quantity,old.report_at,
   old.shift_starts_at,old.shift_ends_at,old.area_label,old.instructions,'CANCELLED',trim(p_reason),actor);
 perform private.crm_audit('event_staffing_requirement',p_requirement,'UPDATE',array['state','revision']);
 return next_revision;
end $$;
revoke all on function public.staffing_cancel(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.staffing_cancel(uuid,uuid,integer,text) to authenticated;

-- Event date changes cannot orphan current demand. Earlier reporting and later finishing remain valid.
create function private.protect_staffing_event_date_06b() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
  if exists(select 1 from public.event_staffing_requirements r where r.event_id=old.id and r.state='PLANNED'
   and r.service_date not between (new.starts_at at time zone 'Europe/London')::date and
     (new.ends_at at time zone 'Europe/London')::date) then
    raise exception 'Event date conflicts with planned staffing service dates'; end if;
 end if;
 return new;
end $$;
revoke all on function private.protect_staffing_event_date_06b() from public,anon,authenticated;
create trigger protect_staffing_event_date before update on public.operational_events
 for each row execute function private.protect_staffing_event_date_06b();
