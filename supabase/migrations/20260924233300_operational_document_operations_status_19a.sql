-- TASK-19A: Operations gets factual status for an exact operational context only.
create function public.operational_document_context_status(p_kind text,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_active_role('OPERATIONS') or p_id is null or
  not ((p_kind='SITE' and exists(select 1 from public.sites where id=p_id and status='ACTIVE'))
   or (p_kind='SITE_SERVICE' and exists(select 1 from public.site_services where id=p_id and state in ('ACTIVE','PAUSED')))
   or (p_kind='EVENT' and exists(select 1 from public.operational_events where id=p_id and status in ('CONFIRMED','LIVE'))))
 then raise exception 'Context unavailable'; end if;
 select jsonb_build_object('asOf',now(),'contextKind',p_kind,'contextId',p_id,
  'assignments',coalesce(jsonb_agg(jsonb_build_object(
   'assignmentId',a.id,'title',v.title,'version',v.version_number,'required',a.required,
   'effectiveFrom',a.effective_from,'effectiveUntil',a.effective_until,
   'recipientCount',(select count(*) from public.people p where private.operational_document_current(a,p.id)),
   'acknowledgedCount',(select count(*) from public.people p where private.operational_document_current(a,p.id)
     and exists(select 1 from public.operational_document_acknowledgements x
      where x.person_id=p.id and x.document_id=a.document_id and x.version_id=a.version_id)))
   order by a.effective_from desc),'[]'::jsonb)) into result
 from public.operational_document_assignments a
 join public.controlled_document_versions v on v.id=a.version_id
 where (a.closed_at is null or a.closed_at>now()) and a.effective_from<=now()
  and (a.effective_until is null or a.effective_until>now())
  and ((a.target_kind=p_kind and a.target_id=p_id)
   or (a.target_kind='OPERATIONAL_ROLE' and a.context_kind=p_kind and a.context_id=p_id));
 return result;
end $$;
revoke all on function public.operational_document_context_status(text,uuid) from public,anon,authenticated;
grant execute on function public.operational_document_context_status(text,uuid) to authenticated;
