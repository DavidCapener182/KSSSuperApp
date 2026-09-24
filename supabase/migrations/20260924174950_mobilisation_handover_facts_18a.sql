-- TASK-18A: keep an immutable, source-specific factual snapshot on handover.
create function private.mobilisation_handover_facts() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.kind<>'HANDOVER' then return new; end if;
 new.facts:=new.facts||jsonb_build_object(
  'sourceStates',coalesce((select jsonb_agg(jsonb_build_object('type',l.source_type,'id',l.source_id,
    'state',case when not private.mobilisation_link_valid(l.mobilisation_id,l.source_type,l.source_id) then 'RESTRICTED_OR_CHANGED'
    when l.source_type='SITE' then (select s.status from public.sites s where s.id=l.source_id)
    when l.source_type='SITE_SERVICE' then (select s.state from public.site_services s where s.id=l.source_id)
    when l.source_type='EVENT' then (select e.status from public.operational_events e where e.id=l.source_id)
    when l.source_type='TASK' then (select t.state from public.tasks t where t.id=l.source_id)
    when l.source_type='DOCUMENT_VERSION' then (select v.upload_state from public.document_versions v where v.id=l.source_id)
    when l.source_type='CONTACT' then (select case when c.active then 'ACTIVE' else 'INACTIVE' end from public.crm_contacts c where c.id=l.source_id)
    else 'LINKED' end) order by l.linked_at,l.id)
    from public.mobilisation_links l where l.mobilisation_id=new.mobilisation_id and l.unlinked_at is null),'[]'::jsonb),
  'openBlockers',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'reason',b.reason,'actionId',b.action_id) order by b.opened_at,b.id)
    from public.mobilisation_blockers b where b.mobilisation_id=new.mobilisation_id and b.resolved_at is null),'[]'::jsonb),
  'outstandingActions',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'state',a.state,'title',a.title) order by a.template_ordinal nulls last,a.created_at,a.id)
    from public.mobilisation_actions a where a.mobilisation_id=new.mobilisation_id and a.state not in ('DONE','CANCELLED')),'[]'::jsonb)
 );
 return new;
end $$;
revoke all on function private.mobilisation_handover_facts() from public,anon,authenticated;
create trigger mobilisation_handover_facts_before_insert before insert on public.mobilisation_decisions
for each row execute function private.mobilisation_handover_facts();
