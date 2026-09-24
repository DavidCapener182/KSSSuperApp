-- TASK-18A: synthetic development mobilisation. RPC-only writes; source modules retain authority.
create table public.mobilisation_templates (
 id uuid primary key default gen_random_uuid(), code text not null, version integer not null,
 title text not null, definition jsonb not null, published_at timestamptz not null default transaction_timestamp(),
 unique(code,version), check (code in ('STATIC_SITE','EVENT')), check (version>0)
);
insert into public.mobilisation_templates(code,version,title,definition) values
('STATIC_SITE',1,'Static Site Mobilisation', '["Commercial handover","Client contacts","Site creation","Site Service setup","Staffing requirement","Recruitment gap review","Site SOPs","Staff induction/training requirement","Uniform/equipment requirement","Systems/access setup","Reporting requirements","Go-live review","Operational handover"]'::jsonb),
('EVENT',1,'Event Mobilisation', '["Commercial handover","Client/Event contacts","Site/Venue confirmation","Event creation","Staffing plan","Recruitment/staffing gaps","Event documentation","Briefing/induction requirements","Equipment requirement","Reporting/control requirements","Event operational review","Operational handover"]'::jsonb);
create table public.mobilisations (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.crm_organisations(id),
 source_opportunity_id uuid references public.crm_opportunities(id), template_id uuid not null references public.mobilisation_templates(id),
 title text not null check (length(trim(title)) between 3 and 180 and title !~ '[[:cntrl:]]'),
 owner_person_id uuid not null references public.people(id), target_go_live date,
 status text not null default 'PLANNING' check (status in ('PLANNING','IN_PROGRESS','GO_LIVE_REVIEW','HANDED_OVER','CANCELLED')),
 revision integer not null default 1 check (revision>0), created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default transaction_timestamp(), updated_at timestamptz not null default transaction_timestamp(),
 handed_over_at timestamptz, cancelled_at timestamptz, duplicate_reason text check (duplicate_reason is null or length(trim(duplicate_reason)) between 3 and 500)
);
create index mobilisations_org_idx on public.mobilisations(organisation_id,created_at desc,id);
create index mobilisations_owner_idx on public.mobilisations(owner_person_id,status,target_go_live);
create table public.mobilisation_actions (
 id uuid primary key default gen_random_uuid(), mobilisation_id uuid not null references public.mobilisations(id),
 title text not null check (length(trim(title)) between 3 and 180 and title !~ '[[:cntrl:]]'),
 category text not null check (category in ('COMMERCIAL','CONTACTS','SITE_EVENT','STAFFING','RECRUITMENT','TRAINING','DOCUMENTS','ASSETS','SYSTEMS','REPORTING','GO_LIVE','HANDOVER')),
 template_ordinal integer, owner_person_id uuid not null references public.people(id), due_on date,
 state text not null default 'OPEN' check (state in ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
 created_at timestamptz not null default transaction_timestamp(), updated_at timestamptz not null default transaction_timestamp(),
 unique(id,mobilisation_id), unique(mobilisation_id,template_ordinal)
);
create table public.mobilisation_dependencies (
 mobilisation_id uuid not null references public.mobilisations(id), action_id uuid not null, depends_on_id uuid not null,
 created_at timestamptz not null default transaction_timestamp(), actor_person_id uuid not null references public.people(id),
 primary key(action_id,depends_on_id), foreign key(action_id,mobilisation_id) references public.mobilisation_actions(id,mobilisation_id),
 foreign key(depends_on_id,mobilisation_id) references public.mobilisation_actions(id,mobilisation_id), check(action_id<>depends_on_id)
);
create table public.mobilisation_blockers (
 id uuid primary key default gen_random_uuid(), mobilisation_id uuid not null references public.mobilisations(id),
 action_id uuid, reason text not null check(length(trim(reason)) between 3 and 500 and reason !~ '[[:cntrl:]]'),
 owner_person_id uuid not null references public.people(id), opened_by_person_id uuid not null references public.people(id),
 opened_at timestamptz not null default transaction_timestamp(), resolved_by_person_id uuid references public.people(id),
 resolved_at timestamptz, resolution_note text check(resolution_note is null or length(trim(resolution_note)) between 3 and 500),
 foreign key(action_id,mobilisation_id) references public.mobilisation_actions(id,mobilisation_id),
 check ((resolved_at is null and resolved_by_person_id is null and resolution_note is null) or
        (resolved_at is not null and resolved_by_person_id is not null and resolution_note is not null))
);
create index mobilisation_blockers_open_idx on public.mobilisation_blockers(mobilisation_id,resolved_at);
create table public.mobilisation_decisions (
 id uuid primary key default gen_random_uuid(), mobilisation_id uuid not null references public.mobilisations(id),
 kind text not null check(kind in ('GENERAL','HANDOVER')), outcome text not null check(outcome in ('APPROVED','REJECTED','DEFERRED')),
 note text not null check(length(trim(note)) between 3 and 1000 and note !~ '[[:cntrl:]]'),
 actor_person_id uuid not null references public.people(id), occurred_at timestamptz not null default transaction_timestamp(),
 facts jsonb not null default '{}'::jsonb
);
create table public.mobilisation_links (
 id uuid primary key default gen_random_uuid(), mobilisation_id uuid not null references public.mobilisations(id),
 source_type text not null check(source_type in ('CONTACT','SITE','SITE_SERVICE','EVENT','TASK','DOCUMENT_VERSION')),
 source_id uuid not null, linked_by_person_id uuid not null references public.people(id),
 linked_at timestamptz not null default transaction_timestamp(), unlinked_at timestamptz,
 unique(mobilisation_id,source_type,source_id)
);
create table public.mobilisation_history (
 id uuid primary key default gen_random_uuid(), mobilisation_id uuid not null references public.mobilisations(id),
 kind text not null check(kind in ('CREATED','STATUS','OWNER','TARGET_DATE','ACTION','DEPENDENCY','BLOCKER','DECISION','LINK')),
 actor_person_id uuid not null references public.people(id), occurred_at timestamptz not null default transaction_timestamp(),
 revision integer not null, subject_id uuid, before_value jsonb, after_value jsonb, reason text,
 unique(mobilisation_id,revision)
);
create table public.mobilisation_requests (
 actor_person_id uuid not null references public.people(id), request_key uuid not null,
 payload_hash text not null, result jsonb not null, created_at timestamptz not null default transaction_timestamp(),
 primary key(actor_person_id,request_key)
);
-- Direct table writes are denied. The guarded RPCs below are the only authenticated mutation path.
do $$ declare t text; begin
 foreach t in array array['mobilisation_templates','mobilisations','mobilisation_actions','mobilisation_dependencies','mobilisation_blockers','mobilisation_decisions','mobilisation_links','mobilisation_history','mobilisation_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
 end loop;
end $$;
create policy mobilisation_template_read on public.mobilisation_templates for select to authenticated using(private.crm_authorised());
create policy mobilisation_read on public.mobilisations for select to authenticated using(private.crm_authorised());
create policy mobilisation_action_read on public.mobilisation_actions for select to authenticated using(private.crm_authorised());
create policy mobilisation_dependency_read on public.mobilisation_dependencies for select to authenticated using(private.crm_authorised());
create policy mobilisation_blocker_read on public.mobilisation_blockers for select to authenticated using(private.crm_authorised());
create policy mobilisation_decision_read on public.mobilisation_decisions for select to authenticated using(private.crm_authorised());
create policy mobilisation_link_read on public.mobilisation_links for select to authenticated using(private.crm_authorised());
create policy mobilisation_history_read on public.mobilisation_history for select to authenticated using(private.crm_authorised());
-- No grants on base tables: RPCs project only curated fields.

create function private.mobilisation_link_valid(mid uuid, typ text, sid uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare oid uuid; begin
 select organisation_id into oid from public.mobilisations where id=mid;
 if oid is null then return false; end if;
 case typ
 when 'CONTACT' then return exists(select 1 from public.crm_contacts c where c.id=sid and c.organisation_id=oid and c.active);
 when 'SITE' then return exists(select 1 from public.site_client_links l where l.site_id=sid and l.organisation_id=oid and l.effective_until is null);
 when 'SITE_SERVICE' then return exists(select 1 from public.site_services s where s.id=sid and s.organisation_id=oid);
 when 'EVENT' then return exists(select 1 from public.operational_events e where e.id=sid and e.organisation_id=oid);
 when 'TASK' then return exists(select 1 from public.tasks t where t.id=sid and t.task_type='CRM_FOLLOW_UP' and
   ((t.source_kind='CRM_ORGANISATION' and t.source_id=oid) or
    (t.source_kind='CRM_OPPORTUNITY' and exists(select 1 from public.crm_opportunities o where o.id=t.source_id and o.organisation_id=oid))));
 when 'DOCUMENT_VERSION' then return exists(select 1 from public.document_versions v join public.documents d on d.id=v.document_id where v.id=sid and v.upload_state='SUBMITTED' and private.document_can_read_request(d.request_id));
 else return false;
 end case;
end $$;
-- TASK source shape is not universal; restrict it to an exact authorised CRM task through its accepted source contract.
revoke all on function private.mobilisation_link_valid(uuid,text,uuid) from public,anon,authenticated;

create function private.mobilisation_duplicate_count(oid uuid, opp uuid) returns integer
language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.mobilisations m where m.organisation_id=oid and m.source_opportunity_id is not distinct from opp and m.status<>'CANCELLED'
$$;
revoke all on function private.mobilisation_duplicate_count(uuid,uuid) from public,anon,authenticated;

create function public.mobilisation_authorise(p_organisation uuid,p_opportunity uuid,p_template text,p_title text,p_owner uuid,p_target date,p_duplicate_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); old_request public.mobilisation_requests%rowtype; digest text; tid uuid; mid uuid; item text; ordinal integer:=0; cat text; result jsonb;
begin
 if not private.crm_authorised() or actor is null or p_key is null then raise exception 'Mobilisation action denied'; end if;
 digest:=md5(jsonb_build_array(p_organisation,p_opportunity,p_template,p_title,p_owner,p_target,p_duplicate_reason)::text);
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_key::text,0));
 select * into old_request from public.mobilisation_requests where actor_person_id=actor and request_key=p_key;
 if found then if old_request.payload_hash<>digest then raise exception 'Idempotency key conflict'; end if; return old_request.result; end if;
 if p_title is null or length(trim(p_title)) not between 3 and 180 or p_title ~ '[[:cntrl:]]' or p_template not in ('STATIC_SITE','EVENT') or not private.crm_owner_eligible(p_owner)
 or not exists(select 1 from public.crm_organisations where id=p_organisation and relationship_status='CLIENT') then raise exception 'Mobilisation input denied'; end if;
 if p_opportunity is not null and not exists(select 1 from public.crm_opportunities where id=p_opportunity and organisation_id=p_organisation and stage='WON') then raise exception 'Opportunity provenance denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_organisation::text||coalesce(p_opportunity::text,''),0));
 if exists(select 1 from public.mobilisations where organisation_id=p_organisation and lower(title)=lower(trim(p_title)) and status<>'CANCELLED') then raise exception 'Duplicate scope name'; end if;
 if p_opportunity is not null and private.mobilisation_duplicate_count(p_organisation,p_opportunity)>0 and
   (p_duplicate_reason is null or length(trim(p_duplicate_reason)) not between 3 and 500) then raise exception 'Duplicate scope requires reason'; end if;
 select id into tid from public.mobilisation_templates where code=p_template and version=1;
 insert into public.mobilisations(organisation_id,source_opportunity_id,template_id,title,owner_person_id,target_go_live,created_by_person_id,duplicate_reason)
 values(p_organisation,p_opportunity,tid,trim(p_title),p_owner,p_target,actor,nullif(trim(p_duplicate_reason),'')) returning id into mid;
 for item in select jsonb_array_elements_text(definition) from public.mobilisation_templates where id=tid loop
  ordinal:=ordinal+1;
  cat:=case when ordinal=1 then 'COMMERCIAL' when item ilike '%contact%' then 'CONTACTS' when item ilike '%staff%' then 'STAFFING' when item ilike '%recruit%' then 'RECRUITMENT' when item ilike '%induction%' or item ilike '%training%' then 'TRAINING' when item ilike '%SOP%' or item ilike '%document%' then 'DOCUMENTS' when item ilike '%equipment%' or item ilike '%uniform%' then 'ASSETS' when item ilike '%systems%' then 'SYSTEMS' when item ilike '%report%' then 'REPORTING' when item ilike '%handover%' then 'HANDOVER' when item ilike '%review%' then 'GO_LIVE' else 'SITE_EVENT' end;
  insert into public.mobilisation_actions(mobilisation_id,title,category,template_ordinal,owner_person_id) values(mid,item,cat,ordinal,p_owner);
 end loop;
 insert into public.mobilisation_history(mobilisation_id,kind,actor_person_id,revision,after_value)
 values(mid,'CREATED',actor,1,jsonb_build_object('organisationId',p_organisation,'opportunityId',p_opportunity,'template',p_template,'ownerId',p_owner,'target',p_target));
 result:=jsonb_build_object('id',mid,'revision',1);
 insert into public.mobilisation_requests(actor_person_id,request_key,payload_hash,result) values(actor,p_key,digest,result);
 return result;
end $$;
revoke all on function public.mobilisation_authorise(uuid,uuid,text,text,uuid,date,text,uuid) from public,anon,authenticated;
grant execute on function public.mobilisation_authorise(uuid,uuid,text,text,uuid,date,text,uuid) to authenticated;

create function public.mobilisation_command(p_id uuid,p_action text,p_data jsonb,p_expected integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); m public.mobilisations%rowtype; old_request public.mobilisation_requests%rowtype;
 digest text; result jsonb; sid uuid; sid2 uuid; state_text text; old_text text; note_text text; old_date date;
 kind_text text; before_json jsonb; after_json jsonb; unresolved integer; facts jsonb; target_owner uuid;
begin
 if not private.crm_authorised() or actor is null or p_id is null or p_key is null or p_expected is null or jsonb_typeof(p_data)<>'object' then raise exception 'Mobilisation action denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_key::text,0));
 digest:=md5(jsonb_build_array(p_id,p_action,p_data,p_expected)::text);
 select * into old_request from public.mobilisation_requests where actor_person_id=actor and request_key=p_key;
 if found then if old_request.payload_hash<>digest then raise exception 'Idempotency key conflict'; end if; return old_request.result; end if;
 select * into m from public.mobilisations where id=p_id for update;
 if not found or m.revision<>p_expected then raise exception 'Stale or missing mobilisation'; end if;
 if m.status in ('HANDED_OVER','CANCELLED') then raise exception 'Terminal mobilisation'; end if;
 note_text:=nullif(trim(p_data->>'note'),'');
 if note_text is not null and (length(note_text)>1000 or note_text ~ '[[:cntrl:]]') then raise exception 'Invalid note'; end if;
 case p_action
 when 'STATUS' then
  state_text:=p_data->>'state'; old_text:=m.status;
  if not ((old_text='PLANNING' and state_text='IN_PROGRESS') or (old_text='IN_PROGRESS' and state_text='GO_LIVE_REVIEW') or
    (old_text='GO_LIVE_REVIEW' and state_text='HANDED_OVER') or (old_text in ('PLANNING','IN_PROGRESS','GO_LIVE_REVIEW') and state_text='CANCELLED')) then raise exception 'Invalid mobilisation transition'; end if;
  if state_text in ('CANCELLED','HANDED_OVER') and (note_text is null or length(note_text)<3) then raise exception 'Decision reason required'; end if;
  if state_text='HANDED_OVER' then
   select count(*) into unresolved from public.mobilisation_actions where mobilisation_id=p_id and state not in ('DONE','CANCELLED');
   select jsonb_build_object('actions',jsonb_build_object('total',count(*),'done',count(*) filter(where state='DONE'),'open',count(*) filter(where state='OPEN'),'blocked',count(*) filter(where state='BLOCKED')))
    into facts from public.mobilisation_actions where mobilisation_id=p_id;
   facts:=facts||jsonb_build_object('unresolvedBlockers',(select count(*) from public.mobilisation_blockers where mobilisation_id=p_id and resolved_at is null),
    'linkedSources',(select coalesce(jsonb_agg(jsonb_build_object('type',source_type,'id',source_id)), '[]'::jsonb) from public.mobilisation_links where mobilisation_id=p_id and unlinked_at is null));
   insert into public.mobilisation_decisions(mobilisation_id,kind,outcome,note,actor_person_id,facts) values(p_id,'HANDOVER','APPROVED',note_text,actor,facts);
  end if;
  update public.mobilisations set status=state_text,revision=revision+1,updated_at=transaction_timestamp(),
   handed_over_at=case when state_text='HANDED_OVER' then transaction_timestamp() else null end,
   cancelled_at=case when state_text='CANCELLED' then transaction_timestamp() else null end where id=p_id;
  kind_text:='STATUS'; before_json:=jsonb_build_object('state',old_text); after_json:=jsonb_build_object('state',state_text,'facts',facts);
 when 'OWNER' then
  target_owner:=nullif(p_data->>'ownerId','')::uuid;
  if target_owner is null or target_owner=m.owner_person_id or not private.crm_owner_eligible(target_owner) or note_text is null or length(note_text)<3 then raise exception 'Owner change denied'; end if;
  update public.mobilisations set owner_person_id=target_owner,revision=revision+1,updated_at=transaction_timestamp() where id=p_id;
  kind_text:='OWNER'; before_json:=jsonb_build_object('ownerId',m.owner_person_id); after_json:=jsonb_build_object('ownerId',target_owner);
 when 'TARGET_DATE' then
  old_date:=m.target_go_live;
  if p_data->>'targetDate' is not null and (p_data->>'targetDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid target date'; end if;
  if old_date is not distinct from nullif(p_data->>'targetDate','')::date or note_text is null or length(note_text)<3 then raise exception 'Target change denied'; end if;
  update public.mobilisations set target_go_live=nullif(p_data->>'targetDate','')::date,revision=revision+1,updated_at=transaction_timestamp() where id=p_id;
  kind_text:='TARGET_DATE'; before_json:=jsonb_build_object('targetDate',old_date); after_json:=jsonb_build_object('targetDate',p_data->>'targetDate');
 when 'ACTION_STATE' then
  sid:=(p_data->>'actionId')::uuid; state_text:=p_data->>'state';
  if state_text not in ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED') then raise exception 'Invalid action state'; end if;
  select state into old_text from public.mobilisation_actions where id=sid and mobilisation_id=p_id for update;
  if old_text is null or old_text=state_text then raise exception 'Action change denied'; end if;
  if state_text='DONE' and exists(select 1 from public.mobilisation_dependencies d join public.mobilisation_actions a on a.id=d.depends_on_id where d.action_id=sid and a.state<>'DONE') then raise exception 'Dependency incomplete'; end if;
  if state_text='CANCELLED' and (note_text is null or length(note_text)<3) then raise exception 'Cancellation reason required'; end if;
  update public.mobilisation_actions set state=state_text,updated_at=transaction_timestamp() where id=sid;
  update public.mobilisations set revision=revision+1,updated_at=transaction_timestamp() where id=p_id;
  kind_text:='ACTION'; before_json:=jsonb_build_object('state',old_text); after_json:=jsonb_build_object('state',state_text);
 when 'ACTION_ADD' then
  state_text:=trim(p_data->>'title'); target_owner:=nullif(p_data->>'ownerId','')::uuid;
  if state_text is null or length(state_text) not between 3 and 180 or state_text ~ '[[:cntrl:]]' or p_data->>'category' not in ('COMMERCIAL','CONTACTS','SITE_EVENT','STAFFING','RECRUITMENT','TRAINING','DOCUMENTS','ASSETS','SYSTEMS','REPORTING','GO_LIVE','HANDOVER') or not private.crm_owner_eligible(target_owner) then raise exception 'Action input denied'; end if;
  insert into public.mobilisation_actions(mobilisation_id,title,category,owner_person_id,due_on) values(p_id,state_text,p_data->>'category',target_owner,nullif(p_data->>'dueOn','')::date) returning id into sid;
  update public.mobilisations set revision=revision+1,updated_at=transaction_timestamp() where id=p_id;
  kind_text:='ACTION'; after_json:=jsonb_build_object('title',state_text,'ownerId',target_owner,'category',p_data->>'category');
 when 'ACTION_OWNER_DATE' then
  sid:=(p_data->>'actionId')::uuid; target_owner:=nullif(p_data->>'ownerId','')::uuid;
  if note_text is null or length(note_text)<3 or not private.crm_owner_eligible(target_owner) then raise exception 'Action amendment denied'; end if;
  select jsonb_build_object('ownerId',owner_person_id,'dueOn',due_on) into before_json from public.mobilisation_actions where id=sid and mobilisation_id=p_id for update;
  if before_json is null then raise exception 'Action not found'; end if;
  update public.mobilisation_actions set owner_person_id=target_owner,due_on=nullif(p_data->>'dueOn','')::date,updated_at=transaction_timestamp() where id=sid;
  update public.mobilisations set revision=revision+1,updated_at=transaction_timestamp() where id=p_id;
  kind_text:='ACTION'; after_json:=jsonb_build_object('ownerId',target_owner,'dueOn',p_data->>'dueOn');
 when 'DEPENDENCY_ADD' then
  sid:=(p_data->>'actionId')::uuid; sid2:=(p_data->>'dependsOnId')::uuid;
  if sid=sid2 or not exists(select 1 from public.mobilisation_actions where id=sid and mobilisation_id=p_id) or not exists(select 1 from public.mobilisation_actions where id=sid2 and mobilisation_id=p_id) then raise exception 'Dependency denied'; end if;
  if exists(with recursive chain(id) as (select depends_on_id from public.mobilisation_dependencies where action_id=sid2 union select d.depends_on_id from public.mobilisation_dependencies d join chain c on d.action_id=c.id) select 1 from chain where id=sid) then raise exception 'Dependency cycle'; end if;
  insert into public.mobilisation_dependencies(mobilisation_id,action_id,depends_on_id,actor_person_id) values(p_id,sid,sid2,actor);
  update public.mobilisations set revision=revision+1,updated_at=transaction_timestamp() where id=p_id;
  kind_text:='DEPENDENCY'; after_json:=jsonb_build_object('dependsOnId',sid2);
 when 'BLOCKER_OPEN' then
  sid:=nullif(p_data->>'actionId','')::uuid; target_owner:=nullif(p_data->>'ownerId','')::uuid; state_text:=trim(p_data->>'reason');
  if state_text is null or length(state_text) not between 3 and 500 or state_text ~ '[[:cntrl:]]' or not private.crm_owner_eligible(target_owner) or
   (sid is not null and not exists(select 1 from public.mobilisation_actions where id=sid and mobilisation_id=p_id)) then raise exception 'Blocker input denied'; end if;
  insert into public.mobilisation_blockers(mobilisation_id,action_id,reason,owner_person_id,opened_by_person_id) values(p_id,sid,state_text,target_owner,actor) returning id into sid2;
  update public.mobilisations set revision=revision+1,updated_at=transaction_timestamp() where id=p_id;
  kind_text:='BLOCKER'; sid:=sid2; after_json:=jsonb_build_object('opened',true,'ownerId',target_owner);
 when 'BLOCKER_RESOLVE' then
  sid:=(p_data->>'blockerId')::uuid;
  if note_text is null or length(note_text)<3 then raise exception 'Resolution note required'; end if;
  update public.mobilisation_blockers set resolved_at=transaction_timestamp(),resolved_by_person_id=actor,resolution_note=note_text where id=sid and mobilisation_id=p_id and resolved_at is null;
  if not found then raise exception 'Blocker not open'; end if;
  update public.mobilisations set revision=revision+1,updated_at=transaction_timestamp() where id=p_id;
  kind_text:='BLOCKER'; after_json:=jsonb_build_object('resolved',true);
 when 'DECISION' then
  if p_data->>'outcome' not in ('APPROVED','REJECTED','DEFERRED') or note_text is null or length(note_text)<3 then raise exception 'Decision denied'; end if;
  insert into public.mobilisation_decisions(mobilisation_id,kind,outcome,note,actor_person_id) values(p_id,'GENERAL',p_data->>'outcome',note_text,actor) returning id into sid;
  update public.mobilisations set revision=revision+1,updated_at=transaction_timestamp() where id=p_id;
  kind_text:='DECISION'; after_json:=jsonb_build_object('outcome',p_data->>'outcome');
 when 'LINK_ADD' then
  sid:=(p_data->>'sourceId')::uuid; state_text:=p_data->>'sourceType';
  if not private.mobilisation_link_valid(p_id,state_text,sid) then raise exception 'Source link denied'; end if;
  insert into public.mobilisation_links(mobilisation_id,source_type,source_id,linked_by_person_id) values(p_id,state_text,sid,actor) returning id into sid2;
  update public.mobilisations set revision=revision+1,updated_at=transaction_timestamp() where id=p_id;
  kind_text:='LINK'; sid:=sid2; after_json:=jsonb_build_object('sourceType',state_text,'sourceId',p_data->>'sourceId');
 else raise exception 'Unknown mobilisation action';
 end case;
 insert into public.mobilisation_history(mobilisation_id,kind,actor_person_id,revision,subject_id,before_value,after_value,reason)
 values(p_id,kind_text,actor,m.revision+1,sid,before_json,after_json,note_text);
 result:=jsonb_build_object('id',p_id,'revision',m.revision+1,'subjectId',sid);
 insert into public.mobilisation_requests(actor_person_id,request_key,payload_hash,result) values(actor,p_key,digest,result);
 return result;
end $$;
revoke all on function public.mobilisation_command(uuid,text,jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function public.mobilisation_command(uuid,text,jsonb,integer,uuid) to authenticated;

create function public.mobilisation_list(p_organisation uuid default null,p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if not private.crm_authorised() or p_offset<0 or p_offset>10000 or p_limit<1 or p_limit>50 then raise exception 'Mobilisation read denied'; end if;
 with scoped as (select m.id,m.title,m.status,m.revision,m.organisation_id,m.source_opportunity_id,m.owner_person_id,m.target_go_live,m.created_at,
  o.name as organisation_name,p.display_name as owner_name,t.code as template_code,t.version as template_version
  from public.mobilisations m join public.crm_organisations o on o.id=m.organisation_id
  join public.people p on p.id=m.owner_person_id join public.mobilisation_templates t on t.id=m.template_id
  where p_organisation is null or m.organisation_id=p_organisation),
 paged as (select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),'items',coalesce(jsonb_agg(to_jsonb(paged) order by created_at desc,id desc),'[]'::jsonb)) into result from paged;
 return result;
end $$;
revoke all on function public.mobilisation_list(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.mobilisation_list(uuid,integer,integer) to authenticated;

create function public.mobilisation_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if not private.crm_authorised() then raise exception 'Mobilisation read denied'; end if;
 select jsonb_build_object('mobilisation',to_jsonb(m)||jsonb_build_object('organisationName',o.name,'ownerName',p.display_name,'templateCode',t.code,'templateVersion',t.version),
  'actions',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('ownerName',ap.display_name) order by a.template_ordinal nulls last,a.created_at,a.id),'[]'::jsonb) from public.mobilisation_actions a join public.people ap on ap.id=a.owner_person_id where a.mobilisation_id=m.id),
  'dependencies',(select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from public.mobilisation_dependencies d where d.mobilisation_id=m.id),
  'blockers',(select coalesce(jsonb_agg(to_jsonb(b) order by b.opened_at desc),'[]'::jsonb) from public.mobilisation_blockers b where b.mobilisation_id=m.id),
  'decisions',(select coalesce(jsonb_agg(to_jsonb(d) order by d.occurred_at desc),'[]'::jsonb) from public.mobilisation_decisions d where d.mobilisation_id=m.id),
  'links',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'sourceType',l.source_type,'sourceId',l.source_id,
   'sourceState',case when not private.mobilisation_link_valid(m.id,l.source_type,l.source_id) then 'RESTRICTED_OR_CHANGED'
    when l.source_type='SITE' then (select s.status from public.sites s where s.id=l.source_id)
    when l.source_type='SITE_SERVICE' then (select s.state from public.site_services s where s.id=l.source_id)
    when l.source_type='EVENT' then (select e.status from public.operational_events e where e.id=l.source_id)
    when l.source_type='DOCUMENT_VERSION' then (select v.upload_state from public.document_versions v where v.id=l.source_id)
    else 'LINKED' end)),'[]'::jsonb) from public.mobilisation_links l where l.mobilisation_id=m.id and l.unlinked_at is null),
  'history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.revision desc),'[]'::jsonb) from public.mobilisation_history h where h.mobilisation_id=m.id),
  'counts',(select jsonb_build_object('total',count(*),'done',count(*) filter(where state='DONE'),'open',count(*) filter(where state='OPEN'),'blocked',count(*) filter(where state='BLOCKED')) from public.mobilisation_actions a where a.mobilisation_id=m.id)) into result
 from public.mobilisations m join public.crm_organisations o on o.id=m.organisation_id join public.people p on p.id=m.owner_person_id join public.mobilisation_templates t on t.id=m.template_id where m.id=p_id;
 return result;
end $$;
revoke all on function public.mobilisation_detail(uuid) from public,anon,authenticated;
grant execute on function public.mobilisation_detail(uuid) to authenticated;
