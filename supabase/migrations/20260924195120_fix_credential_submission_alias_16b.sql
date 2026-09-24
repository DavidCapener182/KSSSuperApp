-- Fix the table alias shadowed by the PL/pgSQL row variable.
create or replace function public.submit_credential_16b(requested_claim uuid, requested_version uuid)
 returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); c public.credential_claims_16b%rowtype;
 v public.document_versions%rowtype; created uuid; next_no integer;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') then raise exception 'Submission denied'; end if;
 select * into c from public.credential_claims_16b where id=requested_claim for update;
 if not found or c.person_id<>actor or c.withdrawn_at is not null or c.draft_reference is null
   or (c.draft_expires_on is not null and c.draft_expires_on<private.uk_today())
 then raise exception 'Submission denied'; end if;
 select dv.* into v from public.document_versions dv join public.documents d on d.id=dv.document_id
 join public.document_requests r on r.id=d.request_id
 join public.document_reviews dr on dr.version_id=dv.id and dr.decision='ACCEPTED_AS_EVIDENCE'
 where dv.id=requested_version and dv.upload_state='SUBMITTED' and d.owner_person_id=actor
   and r.target_person_id=actor and r.site_id is null and r.title='Synthetic credential evidence: '||c.type_code
   and exists(select 1 from public.credential_reviewer_grants_16b g where g.subject_person_id=actor
     and g.type_code=c.type_code and g.reviewer_person_id=r.requester_person_id
     and g.revoked_at is null and g.effective_from<=now() and g.effective_until>now())
   and not exists(select 1 from public.document_versions later where later.document_id=dv.document_id
     and later.upload_state='SUBMITTED' and later.version_number>dv.version_number);
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
