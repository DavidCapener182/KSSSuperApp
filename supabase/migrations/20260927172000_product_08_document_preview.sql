-- DOC-04: read-only, count-only preview for one exact 19A operational assignment.
-- Reuses 19A target validity and current recipient matching; no recipient identities or file keys.
create function public.operational_document_assignment_preview(
 requested_version uuid, target_kind text, target_id uuid,
 context_kind text, context_id uuid, effective_from timestamptz
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 v public.controlled_document_versions%rowtype;
 a public.operational_document_assignments%rowtype;
 recipients integer;
 existing integer;
begin
 if not private.can_operational_document('ASSIGN') or requested_version is null
  or target_id is null or effective_from is null
  or effective_from < now()-interval '5 minutes' or effective_from > now()+interval '90 days'
  or not private.operational_document_target_valid(target_kind,target_id,context_kind,context_id)
 then raise exception 'Preview denied'; end if;

 select * into v from public.controlled_document_versions where id=requested_version;
 if v.id is null or v.state<>'PUBLISHED' or v.upload_state<>'READY'
  or v.effective_on>(effective_from at time zone 'Europe/London')::date
  or not exists(select 1 from public.controlled_documents d
    where d.id=v.document_id and d.family='OPERATIONAL_SYNTHETIC')
 then raise exception 'Version unavailable'; end if;

 a.document_id:=v.document_id;
 a.version_id:=v.id;
 a.target_kind:=target_kind;
 a.target_id:=target_id;
 a.context_kind:=context_kind;
 a.context_id:=context_id;
 select count(*) into recipients from public.people p
  where private.operational_document_target_matches(a,p.id);
 select count(*) into existing from public.operational_document_assignments old
  where old.document_id=v.document_id and old.target_kind=target_kind
   and old.target_id=target_id and old.context_kind is not distinct from context_kind
   and old.context_id is not distinct from context_id
   and (old.closed_at is null or old.closed_at>now());
 return jsonb_build_object('asOf',now(),'versionId',v.id,'targetKind',target_kind,
  'targetId',target_id,'contextKind',context_kind,'contextId',context_id,
  'currentlyResolvedRecipients',recipients,'existingTargetAssignments',existing);
end $$;
revoke all on function public.operational_document_assignment_preview(uuid,text,uuid,text,uuid,timestamptz)
 from public,anon,authenticated;
grant execute on function public.operational_document_assignment_preview(uuid,text,uuid,text,uuid,timestamptz)
 to authenticated;
