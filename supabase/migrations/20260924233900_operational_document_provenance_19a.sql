-- TASK-19A: typed initial reasons, attributable grant revocation, and safe role-at-Site configuration.
alter table public.operational_document_assignments add column assign_reason text
 check (assign_reason is null or (length(trim(assign_reason)) between 3 and 300 and assign_reason !~ '[[:cntrl:]]'));
alter table public.operational_document_grants add column revoked_by_person_id uuid references public.people(id);
create or replace function public.operational_document_revoke_grant(grant_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_active_role('SUPER_ADMIN') then raise exception 'Revocation denied'; end if;
 update public.operational_document_grants set revoked_at=now(),revoked_by_person_id=private.current_person_id()
  where id=grant_id and revoked_at is null;
 return found;
end $$;

drop function public.operational_document_assign(uuid,text,uuid,text,uuid,boolean,timestamptz,timestamptz);
create function public.operational_document_assign(requested_version uuid,target_kind text,target_id uuid,
 context_kind text,context_id uuid,required boolean,effective_from timestamptz,effective_until timestamptz,
 assignment_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.controlled_document_versions%rowtype; d public.controlled_documents%rowtype; result uuid;
begin
 if not private.can_operational_document('ASSIGN') or requested_version is null or required is null
  or effective_from is null or effective_from<now()-interval '5 minutes'
  or effective_from>now()+interval '90 days'
  or (effective_until is not null and effective_until<=effective_from)
  or assignment_reason is null or length(trim(assignment_reason)) not between 3 and 300
  or assignment_reason ~ '[[:cntrl:]]'
  or not private.operational_document_target_valid(target_kind,target_id,context_kind,context_id)
 then raise exception 'Assignment denied'; end if;
 select * into v from public.controlled_document_versions where id=requested_version;
 select * into d from public.controlled_documents where id=v.document_id for update;
 if d.family<>'OPERATIONAL_SYNTHETIC' or v.state<>'PUBLISHED' or v.upload_state<>'READY'
  or v.effective_on>(effective_from at time zone 'Europe/London')::date then raise exception 'Exact version unavailable'; end if;
 perform set_config('kss.write_19a','allowed',true);
 insert into public.operational_document_assignments(document_id,version_id,target_kind,target_id,context_kind,
  context_id,required,effective_from,effective_until,created_by_person_id,assign_reason)
 values(d.id,v.id,target_kind,target_id,context_kind,context_id,required,effective_from,effective_until,
  private.current_person_id(),trim(assignment_reason)) returning id into result;
 insert into public.operational_document_assignment_events(assignment_id,kind,actor_person_id,version_id,reason)
 values(result,'ASSIGNED',private.current_person_id(),v.id,trim(assignment_reason));
 return result;
end $$;
revoke all on function public.operational_document_assign(uuid,text,uuid,text,uuid,boolean,timestamptz,timestamptz,text)
 from public,anon,authenticated;
grant execute on function public.operational_document_assign(uuid,text,uuid,text,uuid,boolean,timestamptz,timestamptz,text)
 to authenticated;

create or replace function private.operational_document_target_valid(kind text,target uuid,context_kind text,context_id uuid)
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
   and ((context_kind='SITE' and exists(select 1 from public.sites where id=context_id and status='ACTIVE'))
    or (context_kind='SITE_SERVICE' and exists(select 1 from public.site_services where id=context_id and state in ('ACTIVE','PAUSED')))
    or (context_kind='EVENT' and exists(select 1 from public.operational_events where id=context_id and status in ('PLANNING','CONFIRMED','LIVE'))))
 else false end
$$;

create index operational_doc_access_assignment_idx on public.operational_document_accesses(assignment_id);
create index operational_doc_access_version_idx on public.operational_document_accesses(version_id);
create index operational_doc_ack_document_idx on public.operational_document_acknowledgements(document_id);
create index operational_doc_ack_version_idx on public.operational_document_acknowledgements(version_id);
create index operational_doc_event_actor_idx on public.operational_document_assignment_events(actor_person_id);
create index operational_doc_event_replacement_idx on public.operational_document_assignment_events(replacement_id);
create index operational_doc_event_version_idx on public.operational_document_assignment_events(version_id);
create index operational_doc_assignment_closer_idx on public.operational_document_assignments(closed_by_person_id);
create index operational_doc_assignment_creator_idx on public.operational_document_assignments(created_by_person_id);
create index operational_doc_assignment_replacement_idx on public.operational_document_assignments(replacement_id);
create index operational_doc_grant_granter_idx on public.operational_document_grants(granted_by_person_id);
create index operational_doc_grant_revoker_idx on public.operational_document_grants(revoked_by_person_id);
