-- TASK-19A: synthetic operational controlled documents. No live source or migration.
alter table public.controlled_documents drop constraint controlled_documents_family_check;
alter table public.controlled_documents add constraint controlled_documents_family_check
  check (family in ('ONBOARDING_TERMS_SYNTHETIC','OPERATIONAL_SYNTHETIC'));

create table public.operational_document_grants (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.people(id),
 capability text not null check (capability in ('PUBLISH','ASSIGN')),
 effective_from timestamptz not null default now(),
 effective_until timestamptz not null,
 revoked_at timestamptz,
 granted_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default now(),
 check (effective_until>effective_from)
);
create index operational_document_grants_person_idx on public.operational_document_grants(person_id,capability,effective_until);
alter table public.operational_document_grants enable row level security;
revoke all on public.operational_document_grants from public,anon,authenticated;

create function private.can_operational_document(capability_code text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.current_person_id() is not null and
 (private.has_active_role('SUPER_ADMIN') or
  (private.has_active_role('OFFICE_ADMIN') and exists (
   select 1 from public.operational_document_grants g where g.person_id=private.current_person_id()
    and g.capability=capability_code and g.revoked_at is null
    and g.effective_from<=now() and g.effective_until>now())))
$$;
revoke all on function private.can_operational_document(text) from public,anon,authenticated;

create function public.operational_document_grant(target_person uuid,capability_code text,expires_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not private.has_active_role('SUPER_ADMIN') or target_person is null or capability_code not in ('PUBLISH','ASSIGN')
  or expires_at is null or expires_at<=now() or expires_at>now()+interval '90 days'
  or not exists(select 1 from public.role_assignments r where r.person_id=target_person and r.role_code='OFFICE_ADMIN'
    and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))
 then raise exception 'Grant denied'; end if;
 perform 1 from public.people where id=target_person for update;
 if exists(select 1 from public.operational_document_grants where person_id=target_person
  and capability=capability_code and revoked_at is null and effective_from<=now() and effective_until>now())
 then raise exception 'Active grant exists'; end if;
 insert into public.operational_document_grants(person_id,capability,effective_until,granted_by_person_id)
 values(target_person,capability_code,expires_at,private.current_person_id()) returning id into result;
 return result;
end $$;
create function public.operational_document_revoke_grant(grant_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_active_role('SUPER_ADMIN') then raise exception 'Revocation denied'; end if;
 update public.operational_document_grants set revoked_at=now() where id=grant_id and revoked_at is null;
 return found;
end $$;
revoke all on function public.operational_document_grant(uuid,text,timestamptz),
 public.operational_document_revoke_grant(uuid) from public,anon,authenticated;
grant execute on function public.operational_document_grant(uuid,text,timestamptz),
 public.operational_document_revoke_grant(uuid) to authenticated;

create or replace function private.can_publish_controlled(family_code text) returns boolean
language sql stable security definer set search_path='' as $$
 select (family_code='ONBOARDING_TERMS_SYNTHETIC' and private.has_active_role('OFFICE_ADMIN')
  and exists(select 1 from public.controlled_publisher_grants g where g.person_id=private.current_person_id()
   and g.family=family_code and g.revoked_at is null and g.effective_from<=now() and g.effective_until>now()))
  or (family_code='OPERATIONAL_SYNTHETIC' and private.can_operational_document('PUBLISH'))
$$;

create function public.create_operational_controlled_document(supplied_title text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not private.can_operational_document('PUBLISH') or supplied_title is null
  or length(trim(supplied_title)) not between 3 and 120 or supplied_title ~ '[[:cntrl:]]'
 then raise exception 'Creation denied'; end if;
 insert into public.controlled_documents(family,title,created_by_person_id)
 values('OPERATIONAL_SYNTHETIC',trim(supplied_title),private.current_person_id()) returning id into result;
 return result;
end $$;
revoke all on function public.create_operational_controlled_document(text) from public,anon,authenticated;
grant execute on function public.create_operational_controlled_document(text) to authenticated;

create function public.operational_document_capabilities() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('publish',private.can_operational_document('PUBLISH'),
  'assign',private.can_operational_document('ASSIGN'))
$$;
revoke all on function public.operational_document_capabilities() from public,anon,authenticated;
grant execute on function public.operational_document_capabilities() to authenticated;

create table public.operational_document_assignments (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.controlled_documents(id),
 version_id uuid not null references public.controlled_document_versions(id),
 target_kind text not null check (target_kind in ('SITE','SITE_SERVICE','EVENT','OPERATIONAL_ROLE','PERSON')),
 target_id uuid not null,
 context_kind text check (context_kind in ('SITE','SITE_SERVICE','EVENT')),
 context_id uuid,
 required boolean not null,
 effective_from timestamptz not null,
 effective_until timestamptz,
 closed_at timestamptz,
 close_kind text check (close_kind in ('REVOKED','REPLACED')),
 replacement_id uuid references public.operational_document_assignments(id) deferrable initially deferred,
 created_by_person_id uuid not null references public.people(id),
 created_at timestamptz not null default now(),
 closed_by_person_id uuid references public.people(id),
 close_reason text check (close_reason is null or (length(trim(close_reason)) between 3 and 300 and close_reason !~ '[[:cntrl:]]')),
 check ((target_kind='OPERATIONAL_ROLE' and context_kind is not null and context_id is not null)
  or (target_kind<>'OPERATIONAL_ROLE' and context_kind is null and context_id is null)),
 check (effective_until is null or effective_until>effective_from),
 check ((closed_at is null and close_kind is null and closed_by_person_id is null and close_reason is null)
  or (closed_at is not null and close_kind is not null and closed_by_person_id is not null and close_reason is not null))
);
create index operational_doc_assignment_target_idx on public.operational_document_assignments(target_kind,target_id,effective_from);
create index operational_doc_assignment_version_idx on public.operational_document_assignments(version_id,closed_at);
create unique index operational_doc_open_target_idx on public.operational_document_assignments
 (document_id,target_kind,target_id,coalesce(context_kind,''),coalesce(context_id,'00000000-0000-0000-0000-000000000000'::uuid))
 where closed_at is null;
create table public.operational_document_assignment_events (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.operational_document_assignments(id),
 kind text not null check (kind in ('ASSIGNED','REVOKED','REPLACED')),
 actor_person_id uuid not null references public.people(id),
 version_id uuid not null references public.controlled_document_versions(id),
 replacement_id uuid references public.operational_document_assignments(id),
 reason text check (reason is null or (length(trim(reason)) between 3 and 300 and reason !~ '[[:cntrl:]]')),
 occurred_at timestamptz not null default now(),
 unique(assignment_id,kind)
);
create table public.operational_document_accesses (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.operational_document_assignments(id),
 person_id uuid not null references public.people(id),
 version_id uuid not null references public.controlled_document_versions(id),
 opened_at timestamptz not null default now()
);
create index operational_doc_access_person_idx on public.operational_document_accesses(person_id,version_id,opened_at);
create table public.operational_document_acknowledgements (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.operational_document_assignments(id),
 person_id uuid not null references public.people(id),
 document_id uuid not null references public.controlled_documents(id),
 version_id uuid not null references public.controlled_document_versions(id),
 acknowledged_at timestamptz not null default now(),
 unique(person_id,document_id,version_id)
);
create index operational_doc_ack_assignment_idx on public.operational_document_acknowledgements(assignment_id,person_id);
alter table public.operational_document_assignments enable row level security;
alter table public.operational_document_assignment_events enable row level security;
alter table public.operational_document_accesses enable row level security;
alter table public.operational_document_acknowledgements enable row level security;
revoke all on public.operational_document_assignments,public.operational_document_assignment_events,
 public.operational_document_accesses,public.operational_document_acknowledgements from public,anon,authenticated;

-- Current dated allocation is the only Service/Event audience. A prior shift grants no current file access.
create function private.operational_document_target_matches(a public.operational_document_assignments,person uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare context_type text; context_uuid uuid; role_uuid uuid;
begin
 if person is null or not exists(select 1 from public.role_assignments ra where ra.person_id=person
   and ra.role_code='SECURITY_STAFF' and ra.revoked_at is null and ra.effective_from<=now()
   and (ra.effective_until is null or ra.effective_until>now())) then return false; end if;
 if a.target_kind='PERSON' then return a.target_id=person; end if;
 context_type:=case when a.target_kind='OPERATIONAL_ROLE' then a.context_kind else a.target_kind end;
 context_uuid:=case when a.target_kind='OPERATIONAL_ROLE' then a.context_id else a.target_id end;
 role_uuid:=case when a.target_kind='OPERATIONAL_ROLE' then a.target_id else null end;
 if context_type='SITE' then
  return exists(select 1 from public.site_assignments sa join public.sites s on s.id=sa.site_id
   where sa.site_id=context_uuid and sa.person_id=person and s.status='ACTIVE'
    and sa.revoked_at is null and sa.effective_from<=now() and (sa.effective_until is null or sa.effective_until>now())
    and role_uuid is null);
 elsif context_type='SITE_SERVICE' then
  return exists(select 1 from public.site_shift_allocations al
   join public.site_shift_demands d on d.id=al.demand_id
   join public.site_services sv on sv.id=d.service_id
   where sv.id=context_uuid and sv.state='ACTIVE' and al.person_id=person
    and al.status in ('ALLOCATED','ACCEPTED') and d.state='PLANNED' and d.shift_ends_at>now()
    and (role_uuid is null or d.role_id=role_uuid));
 elsif context_type='EVENT' then
  return exists(select 1 from public.event_staff_allocations al
   join public.event_staffing_requirements r on r.id=al.requirement_id
   join public.operational_events e on e.id=r.event_id
   where e.id=context_uuid and e.status in ('CONFIRMED','LIVE') and al.person_id=person
    and al.status in ('ALLOCATED','ACCEPTED') and r.state='PLANNED' and r.shift_ends_at>now()
    and (role_uuid is null or r.role_id=role_uuid));
 end if;
 return false;
end $$;
revoke all on function private.operational_document_target_matches(public.operational_document_assignments,uuid) from public,anon,authenticated;

create function private.operational_document_current(a public.operational_document_assignments,person uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (a.closed_at is null or a.closed_at>now()) and a.effective_from<=now()
  and (a.effective_until is null or a.effective_until>now())
  and exists(select 1 from public.controlled_document_versions v join public.controlled_documents d on d.id=v.document_id
   where v.id=a.version_id and v.document_id=a.document_id and d.family='OPERATIONAL_SYNTHETIC'
    and v.upload_state='READY' and v.state in ('PUBLISHED','SUPERSEDED')
    and v.effective_on<=(now() at time zone 'Europe/London')::date)
  and private.operational_document_target_matches(a,person)
$$;

create function private.operational_document_target_valid(kind text,target uuid,context_kind text,context_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select case
 when kind='PERSON' then context_kind is null and context_id is null
   and exists(select 1 from public.people where id=target)
 when kind='SITE' then context_kind is null and context_id is null
   and exists(select 1 from public.sites where id=target and status='ACTIVE')
 when kind='SITE_SERVICE' then context_kind is null and context_id is null
   and exists(select 1 from public.site_services where id=target and state in ('ACTIVE','PAUSED'))
 when kind='EVENT' then context_kind is null and context_id is null
   and exists(select 1 from public.operational_events where id=target and status in ('PLANNING','CONFIRMED','LIVE'))
 when kind='OPERATIONAL_ROLE' then
   exists(select 1 from public.operational_role_definitions where id=target and active)
   and ((context_kind='SITE_SERVICE' and exists(select 1 from public.site_services where id=context_id and state in ('ACTIVE','PAUSED')))
    or (context_kind='EVENT' and exists(select 1 from public.operational_events where id=context_id and status in ('PLANNING','CONFIRMED','LIVE'))))
 else false end
$$;
revoke all on function private.operational_document_target_valid(text,uuid,text,uuid) from public,anon,authenticated;

create function public.operational_document_assign(requested_version uuid,target_kind text,target_id uuid,
 context_kind text,context_id uuid,required boolean,effective_from timestamptz,effective_until timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.controlled_document_versions%rowtype; d public.controlled_documents%rowtype; result uuid;
begin
 if not private.can_operational_document('ASSIGN') or requested_version is null or required is null
  or effective_from is null or effective_from<now()-interval '5 minutes'
  or effective_from>now()+interval '90 days'
  or (effective_until is not null and effective_until<=effective_from)
  or not private.operational_document_target_valid(target_kind,target_id,context_kind,context_id)
 then raise exception 'Assignment denied'; end if;
 select * into v from public.controlled_document_versions where id=requested_version;
 select * into d from public.controlled_documents where id=v.document_id for update;
 if d.family<>'OPERATIONAL_SYNTHETIC' or v.state<>'PUBLISHED' or v.upload_state<>'READY'
  or v.effective_on>(effective_from at time zone 'Europe/London')::date then raise exception 'Exact version unavailable'; end if;
 perform set_config('kss.write_19a','allowed',true);
 insert into public.operational_document_assignments(document_id,version_id,target_kind,target_id,context_kind,
  context_id,required,effective_from,effective_until,created_by_person_id)
 values(d.id,v.id,target_kind,target_id,context_kind,context_id,required,effective_from,effective_until,
  private.current_person_id()) returning id into result;
 insert into public.operational_document_assignment_events(assignment_id,kind,actor_person_id,version_id)
 values(result,'ASSIGNED',private.current_person_id(),v.id);
 return result;
end $$;
create function public.operational_document_revoke(assignment_id uuid,reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare a public.operational_document_assignments%rowtype;
begin
 if not private.can_operational_document('ASSIGN') or reason is null
  or length(trim(reason)) not between 3 and 300 or reason ~ '[[:cntrl:]]'
 then raise exception 'Revocation denied'; end if;
 select * into a from public.operational_document_assignments where id=assignment_id for update;
 if a.id is null or a.closed_at is not null then raise exception 'Assignment unavailable'; end if;
 perform set_config('kss.write_19a','allowed',true);
 update public.operational_document_assignments set closed_at=now(),close_kind='REVOKED',
  closed_by_person_id=private.current_person_id(),close_reason=trim(reason) where id=a.id;
 insert into public.operational_document_assignment_events(assignment_id,kind,actor_person_id,version_id,reason)
 values(a.id,'REVOKED',private.current_person_id(),a.version_id,trim(reason));
 return true;
end $$;
create function public.operational_document_replace(old_assignment_ids uuid[],new_version uuid,
 replacement_at timestamptz,reason text) returns uuid[]
language plpgsql security definer set search_path='' as $$
declare a public.operational_document_assignments%rowtype; v public.controlled_document_versions%rowtype;
 result uuid[]:='{}'::uuid[]; created uuid; old_id uuid;
begin
 if not private.can_operational_document('ASSIGN') or old_assignment_ids is null
  or array_length(old_assignment_ids,1) not between 1 and 50
  or (select count(distinct x) from unnest(old_assignment_ids) x)<>array_length(old_assignment_ids,1)
  or replacement_at is null or replacement_at<now() or replacement_at>now()+interval '90 days'
  or reason is null or length(trim(reason)) not between 3 and 300 or reason ~ '[[:cntrl:]]'
 then raise exception 'Replacement denied'; end if;
 select * into v from public.controlled_document_versions where id=new_version;
 if v.state<>'PUBLISHED' or v.upload_state<>'READY' or v.effective_on>(replacement_at at time zone 'Europe/London')::date
  or not exists(select 1 from public.controlled_documents where id=v.document_id and family='OPERATIONAL_SYNTHETIC')
 then raise exception 'Replacement version unavailable'; end if;
 perform 1 from public.controlled_documents where id=v.document_id for update;
 perform set_config('kss.write_19a','allowed',true);
 foreach old_id in array old_assignment_ids loop
  select * into a from public.operational_document_assignments where id=old_id for update;
  if a.id is null or a.document_id<>v.document_id or a.version_id=v.id
   or (a.closed_at is not null and a.closed_at<=replacement_at)
   or (a.effective_until is not null and a.effective_until<=replacement_at)
   or a.effective_from>=replacement_at then raise exception 'Replacement source changed'; end if;
  insert into public.operational_document_assignments(document_id,version_id,target_kind,target_id,
   context_kind,context_id,required,effective_from,effective_until,created_by_person_id)
  values(a.document_id,v.id,a.target_kind,a.target_id,a.context_kind,a.context_id,a.required,replacement_at,
   a.effective_until,private.current_person_id()) returning id into created;
  update public.operational_document_assignments set closed_at=replacement_at,close_kind='REPLACED',
   replacement_id=created,closed_by_person_id=private.current_person_id(),close_reason=trim(reason)
   where id=a.id;
  insert into public.operational_document_assignment_events(assignment_id,kind,actor_person_id,version_id,replacement_id,reason)
   values(a.id,'REPLACED',private.current_person_id(),a.version_id,created,trim(reason));
  insert into public.operational_document_assignment_events(assignment_id,kind,actor_person_id,version_id,reason)
   values(created,'ASSIGNED',private.current_person_id(),v.id,trim(reason));
  result:=array_append(result,created);
 end loop;
 return result;
end $$;

create function public.operational_document_my_list() returns jsonb
language sql stable security definer set search_path='' as $$
 with mine as (
  select a.id,a.document_id,a.version_id,a.target_kind,a.target_id,a.context_kind,a.context_id,
   a.required,a.effective_from,a.effective_until,a.closed_at,a.close_kind,
   v.version_number,v.title, private.operational_document_current(a,private.current_person_id()) as current,
   exists(select 1 from public.operational_document_accesses x where x.assignment_id=a.id
    and x.person_id=private.current_person_id()) as opened,
   (select min(x.acknowledged_at) from public.operational_document_acknowledgements x
    where x.person_id=private.current_person_id() and x.document_id=a.document_id and x.version_id=a.version_id) as acknowledged_at
  from public.operational_document_assignments a
  join public.controlled_document_versions v on v.id=a.version_id
  where private.has_active_role('SECURITY_STAFF') and
   (private.operational_document_current(a,private.current_person_id()) or
    exists(select 1 from public.operational_document_acknowledgements x
     where x.assignment_id=a.id and x.person_id=private.current_person_id()))
 )
 select jsonb_build_object('asOf',now(),'assignments',coalesce(jsonb_agg(
  to_jsonb(mine) || jsonb_build_object('conflict',current and exists(select 1 from mine other
   where other.document_id=mine.document_id and other.version_id<>mine.version_id and other.current))
  order by mine.effective_from desc), '[]'::jsonb)) from mine
$$;
create function public.operational_document_open(assignment_id uuid,server_proof text) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.operational_document_assignments%rowtype; result uuid;
begin
 select * into a from public.operational_document_assignments where id=assignment_id for update;
 if a.id is null or not private.operational_document_current(a,private.current_person_id())
  or exists(select 1 from public.operational_document_assignments other
    where other.document_id=a.document_id and other.version_id<>a.version_id
     and private.operational_document_current(other,private.current_person_id()))
  or not private.valid_document_server_proof(concat_ws(chr(31),'operational_open',a.id::text,a.version_id::text),server_proof)
 then raise exception 'Open denied'; end if;
 perform set_config('kss.write_19a','allowed',true);
 insert into public.operational_document_accesses(assignment_id,person_id,version_id)
 values(a.id,private.current_person_id(),a.version_id) returning id into result;
 return result;
end $$;
create function public.operational_document_acknowledge(assignment_id uuid,server_proof text) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.operational_document_assignments%rowtype; result uuid;
begin
 select * into a from public.operational_document_assignments where id=assignment_id for update;
 if a.id is null or not private.operational_document_current(a,private.current_person_id())
  or exists(select 1 from public.operational_document_assignments other
    where other.document_id=a.document_id and other.version_id<>a.version_id
     and private.operational_document_current(other,private.current_person_id()))
  or not private.valid_document_server_proof(concat_ws(chr(31),'operational_ack',a.id::text,a.version_id::text),server_proof)
  or not exists(select 1 from public.operational_document_accesses x where x.assignment_id=a.id
   and x.person_id=private.current_person_id() and x.version_id=a.version_id)
 then raise exception 'Acknowledgement denied'; end if;
 select id into result from public.operational_document_acknowledgements
  where person_id=private.current_person_id() and document_id=a.document_id and version_id=a.version_id;
 if result is not null then return result; end if;
 perform set_config('kss.write_19a','allowed',true);
 insert into public.operational_document_acknowledgements(assignment_id,person_id,document_id,version_id)
 values(a.id,private.current_person_id(),a.document_id,a.version_id) returning id into result;
 return result;
end $$;
create function public.operational_document_manager_list() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('asOf',now(),'assignments',coalesce(jsonb_agg(jsonb_build_object(
  'id',a.id,'documentId',a.document_id,'versionId',a.version_id,'title',v.title,
  'version',v.version_number,'targetKind',a.target_kind,'targetId',a.target_id,
  'contextKind',a.context_kind,'contextId',a.context_id,'required',a.required,
  'effectiveFrom',a.effective_from,'effectiveUntil',a.effective_until,
  'closedAt',a.closed_at,'closeKind',a.close_kind,'replacementId',a.replacement_id)
  order by a.created_at desc),'[]'::jsonb))
 from public.operational_document_assignments a
 join public.controlled_document_versions v on v.id=a.version_id
 where private.can_operational_document('ASSIGN')
$$;

revoke all on function public.operational_document_assign(uuid,text,uuid,text,uuid,boolean,timestamptz,timestamptz),
 public.operational_document_revoke(uuid,text),public.operational_document_replace(uuid[],uuid,timestamptz,text),
 public.operational_document_my_list(),public.operational_document_open(uuid,text),
 public.operational_document_acknowledge(uuid,text),public.operational_document_manager_list()
 from public,anon,authenticated;
grant execute on function public.operational_document_assign(uuid,text,uuid,text,uuid,boolean,timestamptz,timestamptz),
 public.operational_document_revoke(uuid,text),public.operational_document_replace(uuid[],uuid,timestamptz,text),
 public.operational_document_my_list(),public.operational_document_open(uuid,text),
 public.operational_document_acknowledge(uuid,text),public.operational_document_manager_list() to authenticated;
revoke all on function private.operational_document_current(public.operational_document_assignments,uuid) from public,anon,authenticated;

create or replace function private.can_download_controlled_key(requested_key text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.controlled_document_versions v join public.controlled_documents d on d.id=v.document_id
  where v.object_key=requested_key and v.upload_state='READY' and (
   (d.family='ONBOARDING_TERMS_SYNTHETIC' and
    ((private.can_publish_controlled(d.family) and d.created_by_person_id=private.current_person_id())
     or exists(select 1 from public.onboarding_controlled_assignments a join public.onboarding_cases c on c.id=a.case_id
      where a.version_id=v.id and c.state='IN_PROGRESS' and
       (private.has_active_role('SUPER_ADMIN') or
        (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id=private.current_person_id()) or
        (private.has_active_role('SECURITY_STAFF') and c.person_id=private.current_person_id() and
         exists(select 1 from public.controlled_document_accesses x where x.assignment_id=a.id
          and x.person_id=c.person_id and x.version_id=v.id))))))
   or (d.family='OPERATIONAL_SYNTHETIC' and
    (private.can_operational_document('PUBLISH') or private.can_operational_document('ASSIGN') or
     exists(select 1 from public.operational_document_assignments a
      where a.version_id=v.id and private.operational_document_current(a,private.current_person_id())
       and exists(select 1 from public.operational_document_accesses x where x.assignment_id=a.id
        and x.person_id=private.current_person_id() and x.version_id=v.id))))))
$$;

-- A caller obtains a Storage key only after a guarded open event or management authority.
create function public.operational_document_file_info(assignment_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.operational_document_assignments%rowtype; v public.controlled_document_versions%rowtype;
begin
 select * into a from public.operational_document_assignments where id=assignment_id;
 if a.id is null or not (private.can_operational_document('PUBLISH') or
  private.can_operational_document('ASSIGN') or
  (private.operational_document_current(a,private.current_person_id()) and
   exists(select 1 from public.operational_document_accesses x where x.assignment_id=a.id
    and x.person_id=private.current_person_id() and x.version_id=a.version_id)))
 then raise exception 'File unavailable'; end if;
 select * into v from public.controlled_document_versions where id=a.version_id;
 if v.upload_state<>'READY' then raise exception 'File unavailable'; end if;
 return jsonb_build_object('versionId',v.id,'objectKey',v.object_key,'sha256',v.sha256);
end $$;
revoke all on function public.operational_document_file_info(uuid) from public,anon,authenticated;
grant execute on function public.operational_document_file_info(uuid) to authenticated;

-- Factual status is recomputed against current qualifying source allocations.
create function public.operational_document_status(assignment_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.operational_document_assignments%rowtype; total_count integer; ack_count integer;
begin
 select * into a from public.operational_document_assignments where id=assignment_id;
 if a.id is null or not private.can_operational_document('ASSIGN') then raise exception 'Status denied'; end if;
 with recipients as (
  select p.id from public.people p where private.operational_document_current(a,p.id)
 ) select count(*),count(*) filter (where exists(
   select 1 from public.operational_document_acknowledgements x
    where x.person_id=recipients.id and x.document_id=a.document_id and x.version_id=a.version_id))
 into total_count,ack_count from recipients;
 return jsonb_build_object('asOf',now(),'assignmentId',a.id,'versionId',a.version_id,
  'required',a.required,'recipientCount',total_count,'acknowledgedCount',ack_count,
  'outstandingCount',total_count-ack_count);
end $$;
revoke all on function public.operational_document_status(uuid) from public,anon,authenticated;
grant execute on function public.operational_document_status(uuid) to authenticated;

-- No ordinary client may mutate history even if a later table grant is broadened.
create function private.guard_operational_document_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_19a',true) is distinct from 'allowed' then
  raise exception 'Operational document direct write denied'; end if;
 if tg_op='DELETE' or (tg_op='UPDATE' and tg_table_name<>'operational_document_assignments') then
  raise exception 'Operational document history is immutable'; end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.document_id is distinct from old.document_id
  or new.version_id is distinct from old.version_id or new.target_kind is distinct from old.target_kind
  or new.target_id is distinct from old.target_id or new.context_kind is distinct from old.context_kind
  or new.context_id is distinct from old.context_id or new.required is distinct from old.required
  or new.effective_from is distinct from old.effective_from or new.effective_until is distinct from old.effective_until
  or old.closed_at is not null) then raise exception 'Assignment history is immutable'; end if;
 return new;
end $$;
revoke all on function private.guard_operational_document_history() from public,anon,authenticated;
create trigger guard_operational_document_assignments before insert or update or delete
 on public.operational_document_assignments for each row execute function private.guard_operational_document_history();
create trigger guard_operational_document_events before insert or update or delete
 on public.operational_document_assignment_events for each row execute function private.guard_operational_document_history();
create trigger guard_operational_document_accesses before insert or update or delete
 on public.operational_document_accesses for each row execute function private.guard_operational_document_history();
create trigger guard_operational_document_acks before insert or update or delete
 on public.operational_document_acknowledgements for each row execute function private.guard_operational_document_history();
