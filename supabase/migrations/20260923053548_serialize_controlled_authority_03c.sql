-- TASK-03C review fixes: serialize publisher grants and publication/assignment,
-- and require an exact typed access event before direct Staff Storage GET.
create or replace function public.grant_controlled_publisher(target_person uuid, expires_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare grant_id uuid;
begin
  if not private.has_active_role('SUPER_ADMIN') or target_person=private.current_person_id()
    or expires_at is null or expires_at<=now() or expires_at>now()+interval '90 days'
  then raise exception 'Publisher grant denied'; end if;
  perform 1 from public.people where id=target_person for update;
  if not found or not exists(select 1 from public.role_assignments r where r.person_id=target_person and r.role_code='OFFICE_ADMIN'
      and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))
    or exists(select 1 from public.controlled_publisher_grants g where g.person_id=target_person
      and g.family='ONBOARDING_TERMS_SYNTHETIC' and g.revoked_at is null and g.effective_until>now())
  then raise exception 'Publisher grant denied'; end if;
  insert into public.controlled_publisher_grants(person_id,family,effective_until,granted_by_person_id)
    values(target_person,'ONBOARDING_TERMS_SYNTHETIC',expires_at,private.current_person_id()) returning id into grant_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(private.current_person_id(),target_person,'controlled_publisher_grant',grant_id,'INSERT',
      jsonb_build_object('family','ONBOARDING_TERMS_SYNTHETIC','expires_at',expires_at));
  return grant_id;
end;
$$;
create or replace function public.revoke_controlled_publisher(grant_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare g public.controlled_publisher_grants%rowtype;
begin
  if not private.has_active_role('SUPER_ADMIN') then raise exception 'Revocation denied'; end if;
  select * into g from public.controlled_publisher_grants where id=grant_id;
  if not found then raise exception 'Grant unavailable'; end if;
  perform 1 from public.people where id=g.person_id for update;
  select * into g from public.controlled_publisher_grants where id=grant_id for update;
  if g.revoked_at is null then
    update public.controlled_publisher_grants set revoked_at=now() where id=grant_id;
    insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
      values(private.current_person_id(),g.person_id,'controlled_publisher_grant',grant_id,'UPDATE',
        jsonb_build_object('revoked',true));
  end if;
  return true;
end;
$$;

create or replace function public.publish_controlled_version(requested_version uuid, requested_effective_on date) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v public.controlled_document_versions%rowtype; d public.controlled_documents%rowtype;
  prior public.controlled_document_versions%rowtype;
begin
  select * into v from public.controlled_document_versions where id=requested_version;
  if not found then raise exception 'Version unavailable'; end if;
  -- Document row is the shared serialization point for publication and assignment.
  select * into d from public.controlled_documents where id=v.document_id for update;
  select * into v from public.controlled_document_versions where id=requested_version for update;
  if d.created_by_person_id<>private.current_person_id() or not private.can_publish_controlled(d.family)
    or v.state<>'DRAFT' or v.upload_state<>'READY' or requested_effective_on is null
    or requested_effective_on>current_date+30 or requested_effective_on<current_date-30
  then raise exception 'Publication denied'; end if;
  select * into prior from public.controlled_document_versions
    where document_id=d.id and state='PUBLISHED' for update;
  if found and exists(select 1 from public.onboarding_controlled_assignments a
    join public.onboarding_cases c on c.id=a.case_id
    where a.version_id=prior.id and c.state='IN_PROGRESS'
      and not exists(select 1 from public.controlled_acknowledgements ack where ack.assignment_id=a.id))
  then raise exception 'Unresolved assignment prevents supersession'; end if;
  if prior.id is not null then
    update public.controlled_document_versions set state='SUPERSEDED',superseded_at=now(),
      superseded_by_person_id=private.current_person_id() where id=prior.id;
    insert into public.controlled_publication_events(document_id,version_id,action,actor_person_id)
      values(d.id,prior.id,'SUPERSEDED',private.current_person_id());
    insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
      values(private.current_person_id(),private.current_person_id(),'controlled_publication',prior.id,'UPDATE',
        jsonb_build_object('action','SUPERSEDED','new_version_id',v.id));
  end if;
  update public.controlled_document_versions set state='PUBLISHED',published_at=now(),
    published_by_person_id=private.current_person_id(),effective_on=requested_effective_on where id=v.id;
  insert into public.controlled_publication_events(document_id,version_id,action,actor_person_id)
    values(d.id,v.id,'PUBLISHED',private.current_person_id());
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(private.current_person_id(),private.current_person_id(),'controlled_publication',v.id,'INSERT',
      jsonb_build_object('action','PUBLISHED','document_id',d.id,'version',v.version_number));
  return true;
end;
$$;

create or replace function public.assign_onboarding_controlled(requested_case uuid,requested_requirement uuid,
  requested_version uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.onboarding_cases%rowtype; r public.onboarding_case_requirements%rowtype;
  d public.onboarding_requirement_definitions%rowtype; v public.controlled_document_versions%rowtype;
  cd public.controlled_documents%rowtype; created_id uuid;
begin
  select * into v from public.controlled_document_versions where id=requested_version;
  if not found then raise exception 'Assignment denied'; end if;
  -- Lock document before version in the same order as publication, then recheck.
  select * into cd from public.controlled_documents where id=v.document_id for update;
  select * into v from public.controlled_document_versions where id=requested_version for update;
  select * into c from public.onboarding_cases where id=requested_case for update;
  select * into r from public.onboarding_case_requirements where id=requested_requirement and case_id=requested_case;
  select * into d from public.onboarding_requirement_definitions where id=r.definition_id;
  if c.id is null or c.state<>'IN_PROGRESS' or c.owner_person_id<>private.current_person_id()
    or c.person_id=private.current_person_id() or not private.has_active_role('OFFICE_ADMIN')
    or not private.can_publish_controlled('ONBOARDING_TERMS_SYNTHETIC')
    or r.id is null or d.code<>'CONTRACT_TERMS' or d.fulfilment_kind<>'CONTROLLED_ACKNOWLEDGEMENT'
    or d.provider_state<>'NOT_AVAILABLE' or d.template_version_id<>c.template_version_id
    or v.id is null or v.state<>'PUBLISHED' or v.effective_on>current_date or cd.family<>'ONBOARDING_TERMS_SYNTHETIC'
    or cd.created_by_person_id<>private.current_person_id()
    or exists(select 1 from public.onboarding_controlled_assignments where requirement_id=r.id)
  then raise exception 'Assignment denied'; end if;
  insert into public.onboarding_controlled_assignments(case_id,requirement_id,target_person_id,
    document_id,version_id,assigned_by_person_id)
    values(c.id,r.id,c.person_id,cd.id,v.id,private.current_person_id()) returning id into created_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
    values(private.current_person_id(),c.person_id,'controlled_assignment',created_id,'INSERT',
      jsonb_build_object('case_id',c.id,'requirement_id',r.id,'version_id',v.id));
  return created_id;
end;
$$;

create or replace function private.can_download_controlled_key(requested_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.controlled_document_versions v
    join public.controlled_documents d on d.id=v.document_id
    where v.object_key=requested_key and v.upload_state='READY' and (
      (private.can_publish_controlled(d.family) and d.created_by_person_id=private.current_person_id())
      or exists(select 1 from public.onboarding_controlled_assignments a
        join public.onboarding_cases c on c.id=a.case_id
        where a.version_id=v.id and c.state='IN_PROGRESS'
          and (private.has_active_role('SUPER_ADMIN')
            or (private.has_active_role('OFFICE_ADMIN') and c.owner_person_id=private.current_person_id())
            or (private.has_active_role('SECURITY_STAFF') and c.person_id=private.current_person_id()
              and exists(select 1 from public.controlled_document_accesses x where x.assignment_id=a.id
                and x.person_id=c.person_id and x.version_id=v.id))))
    ))
$$;
