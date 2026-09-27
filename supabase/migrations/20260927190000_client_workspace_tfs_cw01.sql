-- CW01/CW02: synthetic Client Workspace and TFS Loss Prevention. No imported TFS data.
create table public.client_workspaces (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null unique references public.crm_organisations(id),
 status text not null default 'ACTIVE' check (status in ('ACTIVE','RETIRED')),
 created_by_person_id uuid not null references public.people(id),
 creation_reason text not null check (length(trim(creation_reason)) between 10 and 500),
 created_at timestamptz not null default now(), retired_at timestamptz,
 check ((status='RETIRED') = (retired_at is not null))
);
create table public.client_workspace_modules (
 workspace_id uuid not null references public.client_workspaces(id),
 code text not null check (code='LOSS_PREVENTION'),
 enabled boolean not null default true,
 primary key(workspace_id,code)
);
create table public.client_workspace_grants (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 module_code text not null default 'LOSS_PREVENTION' check (module_code='LOSS_PREVENTION'),
 person_id uuid not null references public.people(id),
 permission text not null check (permission in ('VIEW','OPERATE','MANAGE')),
 effective_from timestamptz not null default now(), effective_until timestamptz,
 revoked_at timestamptz,
 granted_by_person_id uuid not null references public.people(id),
 reason text not null check (length(trim(reason)) between 10 and 500),
 created_at timestamptz not null default now(),
 foreign key (workspace_id,module_code) references public.client_workspace_modules(workspace_id,code),
 check (effective_until is null or effective_until>effective_from)
);
create index client_workspace_grants_current_idx on public.client_workspace_grants(person_id,workspace_id,module_code,effective_from,effective_until) where revoked_at is null;
create table public.client_workspace_grant_events (
 id uuid primary key default gen_random_uuid(), grant_id uuid not null references public.client_workspace_grants(id),
 action text not null check (action in ('GRANTED','REVOKED')),
 actor_person_id uuid not null references public.people(id), reason text not null check (length(trim(reason)) between 10 and 500),
 occurred_at timestamptz not null default now()
);
create table public.tfs_lp_issues (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.client_workspaces(id),
 store_name text not null check (length(trim(store_name)) between 1 and 160),
 store_number text check (store_number is null or length(store_number)<=40),
 site_id uuid references public.sites(id),
 source_region text not null default 'unassigned' check (source_region in ('north','south','unassigned')),
 source_owner text not null default 'Unassigned' check (length(source_owner) between 1 and 120),
 owner_person_id uuid references public.people(id),
 issue_type text not null check (issue_type in ('Stock loss','External theft','Tester orders','Stock discrepancy','Other')),
 priority text not null check (priority in ('Urgent','High','Review','Monitor')),
 status text not null default 'Needs triage' check (status in ('Needs triage','Investigating','Visit needed','Waiting on store','Monitoring','Closed')),
 evidence_date date, evidence_summary text not null check (length(trim(evidence_summary)) between 1 and 2000),
 next_action text not null check (length(trim(next_action)) between 1 and 1000),
 source_note text check (source_note is null or length(source_note)<=1000),
 source_system text check (source_system is null or source_system = 'TFS_LOCAL_EXPORT'),
 source_key text, source_snapshot_sha256 text, source_imported_at timestamptz,
 check ((source_system is null and source_key is null and source_snapshot_sha256 is null and source_imported_at is null)
 or (source_system = 'TFS_LOCAL_EXPORT' and source_key is not null and length(source_key) between 1 and 100
 and source_snapshot_sha256 is not null and source_snapshot_sha256 ~ '^[0-9a-f]{64}$' and source_imported_at is not null)),
 potential_internal_theft_review boolean not null default false,
 created_by_person_id uuid not null references public.people(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), revision integer not null default 1 check (revision>0),
 unique(id,workspace_id)
);
create unique index tfs_lp_import_key_idx on public.tfs_lp_issues(workspace_id,source_system,source_snapshot_sha256,source_key) where source_key is not null;
create index tfs_lp_issues_board_idx on public.tfs_lp_issues(workspace_id,status,priority,updated_at desc);
create table public.tfs_lp_issue_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
 issue_id uuid not null, revision integer not null,
 action text not null check (action in ('CREATED','UPDATED')),
 actor_person_id uuid not null references public.people(id), reason text,
 before_value jsonb, after_value jsonb not null, occurred_at timestamptz not null default now(),
 foreign key(issue_id,workspace_id) references public.tfs_lp_issues(id,workspace_id),
 unique(issue_id,revision)
);
create index tfs_lp_issue_events_order_idx on public.tfs_lp_issue_events(issue_id,revision desc);

alter table public.client_workspaces enable row level security;
alter table public.client_workspace_modules enable row level security;
alter table public.client_workspace_grants enable row level security;
alter table public.client_workspace_grant_events enable row level security;
alter table public.tfs_lp_issues enable row level security;
alter table public.tfs_lp_issue_events enable row level security;
revoke all on public.client_workspaces,public.client_workspace_modules,public.client_workspace_grants,public.client_workspace_grant_events,public.tfs_lp_issues,public.tfs_lp_issue_events from public,anon,authenticated;

create function private.cw_access(p_workspace uuid,p_level text) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (select private.current_person_id()) is not null
 and (select private.has_any_active_role())
 and exists (
  select 1 from public.client_workspaces w join public.client_workspace_modules m on m.workspace_id=w.id
  join public.crm_organisations o on o.id=w.organisation_id and o.relationship_status='CLIENT'
  join public.client_workspace_grants g on g.workspace_id=w.id and g.module_code=m.code
  where w.id=p_workspace and w.status='ACTIVE' and m.code='LOSS_PREVENTION' and m.enabled
   and g.person_id=(select private.current_person_id()) and g.revoked_at is null
   and g.effective_from<=now() and (g.effective_until is null or g.effective_until>now())
   and case p_level when 'VIEW' then g.permission in ('VIEW','OPERATE','MANAGE')
      when 'OPERATE' then g.permission in ('OPERATE','MANAGE')
      when 'MANAGE' then g.permission='MANAGE' else false end
 );
$$;
revoke all on function private.cw_access(uuid,text) from public,anon,authenticated;
grant execute on function private.cw_access(uuid,text) to authenticated;

create function public.cw_directory() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := private.current_person_id(); result jsonb;
begin
 if (select auth.uid()) is null or actor is null then raise exception 'Workspace denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'organisationId',w.organisation_id,'name',o.name,'permission',
  (select g.permission from public.client_workspace_grants g where g.workspace_id=w.id and g.person_id=actor
   and g.module_code='LOSS_PREVENTION' and g.revoked_at is null and g.effective_from<=now()
   and (g.effective_until is null or g.effective_until>now()) order by case g.permission when 'MANAGE' then 3 when 'OPERATE' then 2 else 1 end desc limit 1)) order by o.name),'[]'::jsonb)
 into result from public.client_workspaces w join public.crm_organisations o on o.id=w.organisation_id
 where private.cw_access(w.id,'VIEW');
 return result;
end; $$;

create function public.cw_workspace(p_workspace uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.cw_access(p_workspace,'VIEW') then raise exception 'Workspace denied' using errcode='42501'; end if;
 select jsonb_build_object('id',w.id,'organisationId',w.organisation_id,'name',o.name,'status',w.status,
  'permission',(select g.permission from public.client_workspace_grants g where g.workspace_id=w.id and g.person_id=private.current_person_id()
   and g.module_code='LOSS_PREVENTION' and g.revoked_at is null and g.effective_from<=now()
   and (g.effective_until is null or g.effective_until>now()) order by case g.permission when 'MANAGE' then 3 when 'OPERATE' then 2 else 1 end desc limit 1))
 into result from public.client_workspaces w join public.crm_organisations o on o.id=w.organisation_id where w.id=p_workspace;
 return result;
end; $$;

create function public.cw_issues(p_workspace uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.cw_access(p_workspace,'VIEW') then raise exception 'Workspace denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(i) order by i.updated_at desc,i.id),'[]'::jsonb) into result
 from public.tfs_lp_issues i where i.workspace_id=p_workspace;
 return result;
end; $$;

create function public.cw_issue(p_workspace uuid,p_issue uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.cw_access(p_workspace,'VIEW') then raise exception 'Workspace denied' using errcode='42501'; end if;
 select to_jsonb(i) || jsonb_build_object('history',(select coalesce(jsonb_agg(jsonb_build_object(
  'revision',e.revision,'action',e.action,'actorPersonId',e.actor_person_id,'reason',e.reason,
  'occurredAt',e.occurred_at,'before',e.before_value,'after',e.after_value) order by e.revision desc),'[]'::jsonb)
  from public.tfs_lp_issue_events e where e.issue_id=i.id)) into result
 from public.tfs_lp_issues i where i.workspace_id=p_workspace and i.id=p_issue;
 return result;
end; $$;

-- Establishing a workspace or changing grants is Super Admin oversight. An issue read still requires a recorded grant.
create function public.cw_create_workspace(p_organisation uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.current_person_id(); result uuid;
begin
 if (select auth.uid()) is null or actor is null or not private.has_active_role('SUPER_ADMIN')
  or length(trim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'Workspace denied' using errcode='42501'; end if;
 if not exists(select 1 from public.crm_organisations where id=p_organisation and relationship_status='CLIENT')
  then raise exception 'Client organisation required' using errcode='23514'; end if;
 insert into public.client_workspaces(organisation_id,created_by_person_id,creation_reason) values(p_organisation,actor,trim(p_reason)) returning id into result;
 insert into public.client_workspace_modules(workspace_id,code) values(result,'LOSS_PREVENTION');
 return result;
end; $$;

create function public.cw_grant(p_workspace uuid,p_person uuid,p_permission text,p_reason text,p_until timestamptz default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.current_person_id(); result uuid;
begin
 if (select auth.uid()) is null or actor is null or not private.has_active_role('SUPER_ADMIN')
  or p_permission not in ('VIEW','OPERATE','MANAGE') or length(trim(coalesce(p_reason,''))) not between 10 and 500
  or (p_until is not null and p_until<=now()) then raise exception 'Grant denied' using errcode='42501'; end if;
 if not exists(select 1 from public.client_workspaces w join public.client_workspace_modules m on m.workspace_id=w.id
  where w.id=p_workspace and w.status='ACTIVE' and m.code='LOSS_PREVENTION' and m.enabled)
  then raise exception 'Workspace denied' using errcode='42501'; end if;
 if exists(select 1 from public.client_workspace_grants g where g.workspace_id=p_workspace and g.person_id=p_person
  and g.module_code='LOSS_PREVENTION' and g.revoked_at is null and g.effective_from<=now()
  and (g.effective_until is null or g.effective_until>now())) then raise exception 'Current grant exists' using errcode='23505'; end if;
 insert into public.client_workspace_grants(workspace_id,person_id,permission,effective_until,granted_by_person_id,reason)
 values(p_workspace,p_person,p_permission,p_until,actor,trim(p_reason)) returning id into result;
 insert into public.client_workspace_grant_events(grant_id,action,actor_person_id,reason)
 values(result,'GRANTED',actor,trim(p_reason));
 return result;
end; $$;

create function public.cw_revoke(p_grant uuid,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.current_person_id(); target public.client_workspace_grants%rowtype;
begin
 if (select auth.uid()) is null or actor is null or not private.has_active_role('SUPER_ADMIN')
  or length(trim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'Revoke denied' using errcode='42501'; end if;
 select * into target from public.client_workspace_grants where id=p_grant for update;
 if not found or target.revoked_at is not null then raise exception 'Grant unavailable' using errcode='42501'; end if;
 update public.client_workspace_grants set revoked_at=now() where id=p_grant;
 insert into public.client_workspace_grant_events(grant_id,action,actor_person_id,reason)
 values(p_grant,'REVOKED',actor,trim(p_reason));
 return true;
end; $$;

create function public.cw_issue_save(p_workspace uuid,p_issue uuid,p_revision integer,p_data jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.current_person_id(); old_row public.tfs_lp_issues%rowtype; new_row public.tfs_lp_issues%rowtype;
 v_store text := trim(coalesce(p_data->>'storeName','')); v_number text := nullif(trim(coalesce(p_data->>'storeNumber','')),'');
 v_region text := p_data->>'region'; v_owner text := trim(coalesce(p_data->>'owner',''));
 v_type text := p_data->>'type'; v_priority text := p_data->>'priority'; v_status text := p_data->>'status';
 v_evidence text := trim(coalesce(p_data->>'evidenceSummary','')); v_action text := trim(coalesce(p_data->>'nextAction',''));
 v_source text := nullif(trim(coalesce(p_data->>'sourceNote','')),''); v_date date; v_internal boolean;
begin
 if not private.cw_access(p_workspace,'OPERATE') then raise exception 'Issue denied' using errcode='42501'; end if;
 if length(v_store) not between 1 and 160 or length(coalesce(v_number,''))>40 or coalesce(v_region,'') not in ('north','south','unassigned')
  or length(v_owner) not between 1 and 120 or coalesce(v_type,'') not in ('Stock loss','External theft','Tester orders','Stock discrepancy','Other')
  or coalesce(v_priority,'') not in ('Urgent','High','Review','Monitor')
  or coalesce(v_status,'') not in ('Needs triage','Investigating','Visit needed','Waiting on store','Monitoring','Closed')
  or length(v_evidence) not between 1 and 2000 or length(v_action) not between 1 and 1000
  or length(coalesce(v_source,''))>1000 or coalesce(p_data->>'potentialInternalTheftReview','') not in ('true','false')
  then raise exception 'Invalid issue' using errcode='23514'; end if;
 v_internal := (p_data->>'potentialInternalTheftReview')::boolean;
 if nullif(p_data->>'evidenceDate','') is not null then v_date := (p_data->>'evidenceDate')::date; end if;
 if p_issue is null then
  if p_revision is not null then raise exception 'Invalid revision' using errcode='23514'; end if;
  insert into public.tfs_lp_issues(workspace_id,store_name,store_number,source_region,source_owner,issue_type,priority,status,evidence_date,evidence_summary,next_action,source_note,potential_internal_theft_review,created_by_person_id)
  values(p_workspace,v_store,v_number,v_region,v_owner,v_type,v_priority,v_status,v_date,v_evidence,v_action,v_source,v_internal,actor) returning * into new_row;
  insert into public.tfs_lp_issue_events(workspace_id,issue_id,revision,action,actor_person_id,after_value)
  values(p_workspace,new_row.id,1,'CREATED',actor,to_jsonb(new_row));
 else
  select * into old_row from public.tfs_lp_issues where id=p_issue and workspace_id=p_workspace for update;
  if not found then raise exception 'Issue denied' using errcode='42501'; end if;
  if p_revision is distinct from old_row.revision then raise exception 'Issue changed; reload' using errcode='40001'; end if;
  if length(trim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'Reason required' using errcode='23514'; end if;
  update public.tfs_lp_issues set store_name=v_store,store_number=v_number,source_region=v_region,source_owner=v_owner,
   issue_type=v_type,priority=v_priority,status=v_status,evidence_date=v_date,evidence_summary=v_evidence,
   next_action=v_action,source_note=v_source,potential_internal_theft_review=v_internal,
   revision=revision+1,updated_at=now() where id=p_issue returning * into new_row;
  insert into public.tfs_lp_issue_events(workspace_id,issue_id,revision,action,actor_person_id,reason,before_value,after_value)
  values(p_workspace,p_issue,new_row.revision,'UPDATED',actor,trim(p_reason),to_jsonb(old_row),to_jsonb(new_row));
 end if;
 return new_row.id;
end; $$;

create function public.cw_admin_registry() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not private.has_active_role('SUPER_ADMIN') then raise exception 'Admin denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'organisationId',w.organisation_id,'name',o.name,
  'status',w.status,'createdAt',w.created_at,'createdByPersonId',w.created_by_person_id,
  'creationReason',w.creation_reason,'grants',(select coalesce(jsonb_agg(jsonb_build_object(
   'id',g.id,'personId',g.person_id,'personName',p.display_name,'permission',g.permission,
   'effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,'revokedAt',g.revoked_at,
   'reason',g.reason) order by g.created_at desc),'[]'::jsonb)
   from public.client_workspace_grants g join public.people p on p.id=g.person_id where g.workspace_id=w.id)) order by o.name),'[]'::jsonb)
 into result from public.client_workspaces w join public.crm_organisations o on o.id=w.organisation_id;
 return result;
end; $$;

create function public.cw_admin_choices() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare orgs jsonb; persons jsonb;
begin
 if (select auth.uid()) is null or not private.has_active_role('SUPER_ADMIN') then raise exception 'Admin denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name),'[]'::jsonb) into orgs
 from public.crm_organisations o where o.relationship_status='CLIENT' and not exists
  (select 1 from public.client_workspaces w where w.organisation_id=o.id);
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by p.display_name),'[]'::jsonb) into persons
 from public.people p where exists(select 1 from public.role_assignments r where r.person_id=p.id and r.revoked_at is null
  and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()));
 return jsonb_build_object('organisations',orgs,'people',persons);
end; $$;

revoke all on function public.cw_directory(),public.cw_workspace(uuid),public.cw_issues(uuid),public.cw_issue(uuid,uuid),
 public.cw_create_workspace(uuid,text),public.cw_grant(uuid,uuid,text,text,timestamptz),public.cw_revoke(uuid,text),
 public.cw_issue_save(uuid,uuid,integer,jsonb,text),public.cw_admin_registry(),public.cw_admin_choices() from public,anon,authenticated;
grant execute on function public.cw_directory(),public.cw_workspace(uuid),public.cw_issues(uuid),public.cw_issue(uuid,uuid),
 public.cw_create_workspace(uuid,text),public.cw_grant(uuid,uuid,text,text,timestamptz),public.cw_revoke(uuid,text),
 public.cw_issue_save(uuid,uuid,integer,jsonb,text),public.cw_admin_registry(),public.cw_admin_choices() to authenticated;
