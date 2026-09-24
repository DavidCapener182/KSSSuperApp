-- TASK-16B: synthetic credential facts only. Existing onboarding SIA rows are untouched.
create type public.credential_verification_method_16b as enum
 ('STAFF_DECLARED','OFFICE_CHECKED_EVIDENCE','EXTERNALLY_CONFIRMED');
create table public.credential_types_16b (
  code text primary key check (code in ('SECURITY_GUARDING','DOOR_SUPERVISION','PUBLIC_SPACE_SURVEILLANCE_CCTV')),
  version integer not null default 1 check (version = 1),
  label text not null,
  published_at timestamptz not null default now()
);
insert into public.credential_types_16b(code,label) values
 ('SECURITY_GUARDING','Security Guarding'),
 ('DOOR_SUPERVISION','Door Supervision'),
 ('PUBLIC_SPACE_SURVEILLANCE_CCTV','Public Space Surveillance (CCTV)');

create table public.credential_reviewer_grants_16b (
 id uuid primary key default gen_random_uuid(),
 reviewer_person_id uuid not null references public.people(id),
 subject_person_id uuid not null references public.people(id),
 type_code text not null references public.credential_types_16b(code),
 granted_by_person_id uuid not null references public.people(id),
 effective_from timestamptz not null default now(),
 effective_until timestamptz not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 check (effective_until > effective_from),
 check (reviewer_person_id <> subject_person_id)
);
create index credential_grants_subject_idx on public.credential_reviewer_grants_16b(subject_person_id,type_code,reviewer_person_id);
create index credential_grants_reviewer_idx on public.credential_reviewer_grants_16b(reviewer_person_id,effective_until);
create index credential_grants_granter_idx on public.credential_reviewer_grants_16b(granted_by_person_id);

create table public.credential_claims_16b (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.people(id),
 type_code text not null references public.credential_types_16b(code),
 draft_reference text,
 draft_issued_on date,
 draft_expires_on date,
 draft_change_seq bigint not null default 0,
 latest_revision_id uuid,
 withdrawn_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(person_id,type_code),
 check (draft_reference is null or (draft_reference ~ '^SYN-SIA-[A-Z0-9-]{3,40}$')),
 check (draft_issued_on is null or draft_expires_on is null or draft_issued_on <= draft_expires_on)
);
create table public.credential_revisions_16b (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null references public.credential_claims_16b(id),
 person_id uuid not null references public.people(id),
 type_code text not null references public.credential_types_16b(code),
 type_version integer not null check (type_version = 1),
 revision_number integer not null check (revision_number > 0),
 synthetic_reference text not null check (synthetic_reference ~ '^SYN-SIA-[A-Z0-9-]{3,40}$'),
 issued_on date,
 expires_on date,
 draft_change_seq bigint not null,
 evidence_version_id uuid not null references public.document_versions(id),
 evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
 submitted_by_person_id uuid not null references public.people(id),
 declaration_method public.credential_verification_method_16b not null default 'STAFF_DECLARED' check (declaration_method='STAFF_DECLARED'),
 submitted_at timestamptz not null default now(),
 unique(claim_id,revision_number),
 check (issued_on is null or expires_on is null or issued_on <= expires_on)
);
alter table public.credential_claims_16b add constraint credential_latest_revision_fk
 foreign key(latest_revision_id) references public.credential_revisions_16b(id);
create index credential_claim_latest_idx on public.credential_claims_16b(latest_revision_id);
create index credential_revisions_person_idx on public.credential_revisions_16b(person_id,submitted_at desc);
create index credential_revisions_evidence_idx on public.credential_revisions_16b(evidence_version_id);
create index credential_revisions_submitter_idx on public.credential_revisions_16b(submitted_by_person_id);

create table public.credential_claim_events_16b (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null references public.credential_claims_16b(id),
 person_id uuid not null references public.people(id),
 actor_person_id uuid not null references public.people(id),
 event text not null check (event in ('WITHDRAWN','REOPENED')),
 occurred_at timestamptz not null default now()
);
create index credential_claim_events_claim_idx on public.credential_claim_events_16b(claim_id,occurred_at desc);
create index credential_claim_events_person_idx on public.credential_claim_events_16b(person_id);
create index credential_claim_events_actor_idx on public.credential_claim_events_16b(actor_person_id);
create table public.credential_decisions_16b (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null references public.credential_claims_16b(id),
 revision_id uuid not null references public.credential_revisions_16b(id),
 reviewer_person_id uuid not null references public.people(id),
 decision text not null check (decision in ('VERIFIED','REJECTED','REVOKED')),
 method public.credential_verification_method_16b not null check (method in ('STAFF_DECLARED','OFFICE_CHECKED_EVIDENCE')),
 verified_issued_on date,
 verified_expires_on date,
 reason_code text check (reason_code in ('EVIDENCE_MISMATCH','UNREADABLE','EXPIRED','CORRECTION','OTHER')),
 decided_at timestamptz not null default now(),
 check ((decision='VERIFIED' and reason_code is null and method='OFFICE_CHECKED_EVIDENCE')
     or (decision in ('REJECTED','REVOKED') and reason_code is not null and verified_issued_on is null and verified_expires_on is null))
);
comment on column public.credential_decisions_16b.method is
 'EXTERNALLY_CONFIRMED is reserved for a separately approved external verification source and is deliberately rejected by this schema.';
create index credential_decisions_claim_idx on public.credential_decisions_16b(claim_id,decided_at desc);
create index credential_decisions_reviewer_idx on public.credential_decisions_16b(reviewer_person_id);
create unique index credential_one_verification_16b on public.credential_decisions_16b(revision_id)
 where decision in ('VERIFIED','REJECTED');
create unique index credential_one_revocation_16b on public.credential_decisions_16b(revision_id)
 where decision='REVOKED';

alter table public.credential_types_16b enable row level security;
alter table public.credential_reviewer_grants_16b enable row level security;
alter table public.credential_claims_16b enable row level security;
alter table public.credential_revisions_16b enable row level security;
alter table public.credential_decisions_16b enable row level security;
alter table public.credential_claim_events_16b enable row level security;
revoke all on public.credential_types_16b,public.credential_reviewer_grants_16b,
 public.credential_claims_16b,public.credential_revisions_16b,public.credential_decisions_16b,
 public.credential_claim_events_16b from public,anon,authenticated;
grant select on public.credential_types_16b,public.credential_reviewer_grants_16b,
 public.credential_claims_16b,public.credential_revisions_16b,public.credential_decisions_16b,
 public.credential_claim_events_16b to authenticated;
create policy credential_types_read_16b on public.credential_types_16b for select to authenticated using (true);

create function private.credential_reviewer_16b(subject uuid, category text) returns boolean
 language sql stable security definer set search_path='' as $$
 select private.has_active_role('OFFICE_ADMIN') and exists (
   select 1 from public.credential_reviewer_grants_16b g
   where g.reviewer_person_id=private.current_person_id() and g.subject_person_id=subject
     and g.type_code=category and g.effective_from<=now() and g.effective_until>now()
     and g.revoked_at is null)
 $$;
revoke all on function private.credential_reviewer_16b(uuid,text) from public,anon,authenticated;
grant execute on function private.credential_reviewer_16b(uuid,text) to authenticated;
create policy credential_grants_read_16b on public.credential_reviewer_grants_16b for select to authenticated using
 (private.has_active_role('SUPER_ADMIN') or (reviewer_person_id=private.current_person_id() and private.has_active_role('OFFICE_ADMIN') and revoked_at is null and effective_from<=now() and effective_until>now()));
create policy credential_claims_read_16b on public.credential_claims_16b for select to authenticated using
 ((person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
   or private.credential_reviewer_16b(person_id,type_code) or private.has_active_role('SUPER_ADMIN'));
create policy credential_revisions_read_16b on public.credential_revisions_16b for select to authenticated using
 ((person_id=private.current_person_id() and private.has_active_role('SECURITY_STAFF'))
   or private.credential_reviewer_16b(person_id,type_code) or private.has_active_role('SUPER_ADMIN'));
create policy credential_claim_events_read_16b on public.credential_claim_events_16b for select to authenticated using
 (exists(select 1 from public.credential_claims_16b c where c.id=claim_id));
create policy credential_decisions_read_16b on public.credential_decisions_16b for select to authenticated using
 (exists(select 1 from public.credential_claims_16b c where c.id=claim_id));

-- Supabase/PostgREST clients receive SELECT only. These guards also stop privileged accidental edits.
create function private.credential_immutable_16b() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Credential history is immutable'; end $$;
create trigger credential_types_immutable_16b before update or delete on public.credential_types_16b
 for each row execute function private.credential_immutable_16b();
create trigger credential_revisions_immutable_16b before update or delete on public.credential_revisions_16b
 for each row execute function private.credential_immutable_16b();
create trigger credential_claim_events_immutable_16b before update or delete on public.credential_claim_events_16b
 for each row execute function private.credential_immutable_16b();
create trigger credential_decisions_immutable_16b before update or delete on public.credential_decisions_16b
 for each row execute function private.credential_immutable_16b();
revoke all on function private.credential_immutable_16b() from public,anon,authenticated;

alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in (
 'role_assignment','site_assignment','site','document_request','document_version',
 'document_review','task','onboarding_case','onboarding_requirement','onboarding_verification',
 'person_profile','profile_submission','sia_credential','sia_submission','controlled_publisher_grant',
 'controlled_document','controlled_version','controlled_publication','controlled_assignment','controlled_access',
 'controlled_acknowledgement','onboarding_team','onboarding_team_membership','onboarding_cover','onboarding_owner_change',
 'task_assignment','crm_organisation','crm_contact','crm_opportunity','crm_opportunity_event',
 'crm_relationship_event','crm_organisation_owner_event','crm_activity','crm_follow_up','crm_task_event',
 'site_client_link','operational_event','operational_event_event','operational_role','event_staffing_requirement',
 'event_staff_allocation','event_staff_allocation_event','credential_claim','credential_revision','credential_decision',
 'credential_reviewer_grant'));
alter table public.audit_events drop constraint audit_events_target_check;
alter table public.audit_events add constraint audit_events_target_check check (
 (entity_type='site' and site_id is not null) or
 (entity_type='site_assignment' and site_id is not null and affected_person_id is not null) or
 (entity_type='role_assignment' and affected_person_id is not null) or
 (entity_type<>'site' and entity_type<>'site_assignment' and entity_type<>'role_assignment' and affected_person_id is not null));

create function public.grant_credential_reviewer_16b(subject uuid, category text, reviewer uuid, until_at timestamptz)
 returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); created uuid;
begin
 if actor is null or not private.has_active_role('SUPER_ADMIN') or reviewer=subject or until_at<=now()
   or until_at>now()+interval '90 days' or category not in
   ('SECURITY_GUARDING','DOOR_SUPERVISION','PUBLIC_SPACE_SURVEILLANCE_CCTV')
   or not exists(select 1 from public.people where id=subject)
   or not exists(select 1 from public.role_assignments r where r.person_id=reviewer and r.role_code='OFFICE_ADMIN'
     and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))
 then raise exception 'Reviewer grant denied'; end if;
 if exists(select 1 from public.credential_reviewer_grants_16b g where g.subject_person_id=subject
   and g.type_code=category and g.reviewer_person_id=reviewer and g.revoked_at is null and g.effective_until>now())
 then raise exception 'Reviewer grant already active'; end if;
 insert into public.credential_reviewer_grants_16b(reviewer_person_id,subject_person_id,type_code,granted_by_person_id,effective_until)
 values(reviewer,subject,category,actor,until_at) returning id into created;
 insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
 values(actor,subject,'credential_reviewer_grant',created,'INSERT',jsonb_build_object('type',category));
 return created;
end $$;
create function public.revoke_credential_reviewer_16b(requested_grant uuid) returns void
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); g public.credential_reviewer_grants_16b%rowtype;
begin
 if actor is null or not private.has_active_role('SUPER_ADMIN') then raise exception 'Reviewer grant denied'; end if;
 select * into g from public.credential_reviewer_grants_16b where id=requested_grant for update;
 if not found or g.revoked_at is not null then raise exception 'Reviewer grant denied'; end if;
 update public.credential_reviewer_grants_16b set revoked_at=now() where id=g.id;
 insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
 values(actor,g.subject_person_id,'credential_reviewer_grant',g.id,'UPDATE',jsonb_build_object('state','REVOKED'));
end $$;
create function public.save_credential_draft_16b(category text, supplied_reference text, supplied_issue date, supplied_expiry date)
 returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); existing public.credential_claims_16b%rowtype; created uuid; clean_ref text:=upper(trim(supplied_reference));
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or category not in
   ('SECURITY_GUARDING','DOOR_SUPERVISION','PUBLIC_SPACE_SURVEILLANCE_CCTV')
   or clean_ref is null or clean_ref !~ '^SYN-SIA-[A-Z0-9-]{3,40}$'
   or (supplied_issue is not null and supplied_expiry is not null and supplied_issue>supplied_expiry)
 then raise exception 'Credential draft denied'; end if;
 select * into existing from public.credential_claims_16b where person_id=actor and type_code=category for update;
 if found then
   if existing.withdrawn_at is not null then
     insert into public.credential_claim_events_16b(claim_id,person_id,actor_person_id,event)
     values(existing.id,actor,actor,'REOPENED');
   end if;
   update public.credential_claims_16b set draft_reference=clean_ref,draft_issued_on=supplied_issue,
     draft_expires_on=supplied_expiry,draft_change_seq=draft_change_seq+1,withdrawn_at=null,updated_at=now() where id=existing.id;
   created:=existing.id;
 else
   insert into public.credential_claims_16b(person_id,type_code,draft_reference,draft_issued_on,draft_expires_on,draft_change_seq)
   values(actor,category,clean_ref,supplied_issue,supplied_expiry,1) returning id into created;
 end if;
 insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
 values(actor,actor,'credential_claim',created,'UPDATE',jsonb_build_object('state','DRAFT_SAVED','type',category));
 return created;
end $$;
create function public.submit_credential_16b(requested_claim uuid, requested_version uuid)
 returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); c public.credential_claims_16b%rowtype;
 v public.document_versions%rowtype; created uuid; next_no integer;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') then raise exception 'Submission denied'; end if;
 select * into c from public.credential_claims_16b where id=requested_claim for update;
 if not found or c.person_id<>actor or c.withdrawn_at is not null or c.draft_reference is null
   or (c.draft_expires_on is not null and c.draft_expires_on<private.uk_today())
 then raise exception 'Submission denied'; end if;
 select v.* into v from public.document_versions v join public.documents d on d.id=v.document_id
 join public.document_requests r on r.id=d.request_id
 join public.document_reviews dr on dr.version_id=v.id and dr.decision='ACCEPTED_AS_EVIDENCE'
 where v.id=requested_version and v.upload_state='SUBMITTED' and d.owner_person_id=actor
   and r.target_person_id=actor and r.site_id is null and r.title='Synthetic credential evidence: '||c.type_code
   and exists(select 1 from public.credential_reviewer_grants_16b g where g.subject_person_id=actor
     and g.type_code=c.type_code and g.reviewer_person_id=r.requester_person_id
     and g.revoked_at is null and g.effective_from<=now() and g.effective_until>now())
   and not exists(select 1 from public.document_versions later where later.document_id=v.document_id
     and later.upload_state='SUBMITTED' and later.version_number>v.version_number);
 if not found or exists(select 1 from public.credential_revisions_16b old where old.evidence_version_id=requested_version)
 then raise exception 'Evidence version denied'; end if;
 select coalesce(max(revision_number),0)+1 into next_no from public.credential_revisions_16b where claim_id=c.id;
 insert into public.credential_revisions_16b(claim_id,person_id,type_code,type_version,revision_number,
   synthetic_reference,issued_on,expires_on,draft_change_seq,evidence_version_id,evidence_sha256,submitted_by_person_id)
 values(c.id,actor,c.type_code,1,next_no,c.draft_reference,c.draft_issued_on,c.draft_expires_on,
   c.draft_change_seq,v.id,v.sha256,actor) returning id into created;
 update public.credential_claims_16b set latest_revision_id=created,updated_at=now() where id=c.id;
 insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
 values(actor,actor,'credential_revision',created,'INSERT',jsonb_build_object('type',c.type_code,'revision',next_no));
 return created;
end $$;
create function public.decide_credential_16b(requested_revision uuid, supplied_decision text,
 supplied_method text, supplied_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); r public.credential_revisions_16b%rowtype;
 c public.credential_claims_16b%rowtype; created uuid;
begin
 if actor is null or not (private.has_active_role('SUPER_ADMIN') or private.has_active_role('OFFICE_ADMIN'))
   or supplied_decision not in ('VERIFIED','REJECTED','REVOKED')
   or supplied_method not in ('STAFF_DECLARED','OFFICE_CHECKED_EVIDENCE')
   or (supplied_decision='VERIFIED' and (supplied_method<>'OFFICE_CHECKED_EVIDENCE' or supplied_reason is not null))
   or (supplied_decision<>'VERIFIED' and supplied_reason not in
      ('EVIDENCE_MISMATCH','UNREADABLE','EXPIRED','CORRECTION','OTHER'))
 then raise exception 'Credential decision denied'; end if;
 select * into r from public.credential_revisions_16b where id=requested_revision;
 if not found then raise exception 'Credential decision denied'; end if;
 select * into c from public.credential_claims_16b where id=r.claim_id for update;
 if actor=r.person_id
   or (not private.has_active_role('SUPER_ADMIN') and not private.credential_reviewer_16b(r.person_id,r.type_code))
   or (supplied_decision<>'REVOKED' and (c.latest_revision_id<>r.id or c.withdrawn_at is not null or c.draft_change_seq<>r.draft_change_seq))
 then raise exception 'Stale credential decision'; end if;
 if supplied_decision='REVOKED' then
   if not exists(select 1 from public.credential_decisions_16b d where d.revision_id=r.id and d.decision='VERIFIED')
     or exists(select 1 from public.credential_decisions_16b d where d.revision_id=r.id and d.decision='REVOKED')
   then raise exception 'Revocation denied'; end if;
 else
   if exists(select 1 from public.credential_decisions_16b d where d.revision_id=r.id and d.decision in ('VERIFIED','REJECTED'))
     or (supplied_decision='VERIFIED' and r.expires_on is not null and r.expires_on<private.uk_today())
     or not exists(select 1 from public.document_versions v join public.document_reviews dr
       on dr.version_id=v.id and dr.decision='ACCEPTED_AS_EVIDENCE'
       where v.id=r.evidence_version_id and v.sha256=r.evidence_sha256 and v.upload_state='SUBMITTED'
         and not exists(select 1 from public.document_versions newer where newer.document_id=v.document_id
           and newer.upload_state='SUBMITTED' and newer.version_number>v.version_number))
   then raise exception 'Evidence decision denied'; end if;
 end if;
 insert into public.credential_decisions_16b(claim_id,revision_id,reviewer_person_id,decision,method,reason_code,verified_issued_on,verified_expires_on)
 values(c.id,r.id,actor,supplied_decision,supplied_method::public.credential_verification_method_16b,supplied_reason,
   case when supplied_decision='VERIFIED' then r.issued_on else null end,
   case when supplied_decision='VERIFIED' then r.expires_on else null end) returning id into created;
 insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
 values(actor,r.person_id,'credential_decision',created,'INSERT',jsonb_build_object('decision',supplied_decision,'method',supplied_method));
 return created;
end $$;
create function public.withdraw_credential_16b(requested_claim uuid) returns void
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); c public.credential_claims_16b%rowtype;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') then raise exception 'Withdrawal denied'; end if;
 select * into c from public.credential_claims_16b where id=requested_claim for update;
 if not found or c.person_id<>actor or c.withdrawn_at is not null then raise exception 'Withdrawal denied'; end if;
 update public.credential_claims_16b set withdrawn_at=now(),updated_at=now() where id=c.id;
 insert into public.credential_claim_events_16b(claim_id,person_id,actor_person_id,event)
 values(c.id,actor,actor,'WITHDRAWN');
 insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
 values(actor,actor,'credential_claim',c.id,'UPDATE',jsonb_build_object('state','WITHDRAWN'));
end $$;
revoke all on function public.grant_credential_reviewer_16b(uuid,text,uuid,timestamptz),
 public.revoke_credential_reviewer_16b(uuid), public.save_credential_draft_16b(text,text,date,date),
 public.submit_credential_16b(uuid,uuid),public.decide_credential_16b(uuid,text,text,text),
 public.withdraw_credential_16b(uuid) from public,anon,authenticated;
grant execute on function public.grant_credential_reviewer_16b(uuid,text,uuid,timestamptz),
 public.revoke_credential_reviewer_16b(uuid), public.save_credential_draft_16b(text,text,date,date),
 public.submit_credential_16b(uuid,uuid),public.decide_credential_16b(uuid,text,text,text),
 public.withdraw_credential_16b(uuid) to authenticated;

create function public.request_credential_evidence_16b(subject uuid, category text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); created uuid;
begin
 if actor is null or not private.credential_reviewer_16b(subject,category)
   or not exists(select 1 from public.role_assignments r where r.person_id=subject
     and r.role_code='SECURITY_STAFF' and r.revoked_at is null and r.effective_from<=now()
     and (r.effective_until is null or r.effective_until>now()))
 then raise exception 'Credential request denied'; end if;
 if exists(select 1 from public.document_requests r where r.target_person_id=subject
   and r.requester_person_id=actor and r.title='Synthetic credential evidence: '||category
   and r.status='REQUESTED') then raise exception 'Open credential request exists'; end if;
 insert into public.document_requests(target_person_id,requester_person_id,site_id,title)
 values(subject,actor,null,'Synthetic credential evidence: '||category) returning id into created;
 insert into public.documents(request_id,owner_person_id) values(created,subject);
 insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,after_value)
 values(actor,subject,'document_request',created,'INSERT',jsonb_build_object('status','REQUESTED','source','CREDENTIAL_16B'));
 return created;
end $$;
revoke all on function public.request_credential_evidence_16b(uuid,text) from public,anon,authenticated;
grant execute on function public.request_credential_evidence_16b(uuid,text) to authenticated;

create function public.credential_review_queue_16b()
 returns table(subject_person_id uuid, display_name text, type_code text)
 language sql stable security definer set search_path='' as $$
 select distinct g.subject_person_id,p.display_name,g.type_code
 from public.credential_reviewer_grants_16b g join public.people p on p.id=g.subject_person_id
 where private.has_active_role('OFFICE_ADMIN') and g.reviewer_person_id=private.current_person_id()
   and g.revoked_at is null and g.effective_from<=now() and g.effective_until>now()
 $$;
revoke all on function public.credential_review_queue_16b() from public,anon,authenticated;
grant execute on function public.credential_review_queue_16b() to authenticated;
