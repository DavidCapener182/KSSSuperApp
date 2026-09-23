-- TASK-03E: a coordinator cannot reassign somebody else's case to themselves.
create or replace function public.reassign_onboarding_case(requested_case uuid,new_owner uuid,reason_text text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.onboarding_cases%rowtype; change_id uuid; clean_reason text;
begin
  actor:=private.current_person_id(); clean_reason:=trim(reason_text);
  select * into c from public.onboarding_cases where id=requested_case for update;
  if actor is null or c.id is null or c.state<>'IN_PROGRESS' or actor=c.person_id
    or new_owner is null or new_owner=c.person_id or new_owner=c.owner_person_id
    or (actor<>c.owner_person_id and actor=new_owner and not private.has_active_role('SUPER_ADMIN'))
    or clean_reason is null or length(clean_reason) not between 10 and 500 or clean_reason ~ '[[:cntrl:]]'
    or not private.active_onboarding_team_member(c.team_id,new_owner)
    or not (private.has_active_role('SUPER_ADMIN') or
      (private.active_onboarding_team_member(c.team_id,actor) and
        (c.owner_person_id=actor or private.onboarding_team_coordinator(c.team_id,actor))))
  then raise exception 'Onboarding reassignment denied'; end if;
  insert into public.onboarding_case_owner_changes(case_id,old_owner_person_id,
    new_owner_person_id,actor_person_id,reason)
    values(c.id,c.owner_person_id,new_owner,actor,clean_reason) returning id into change_id;
  update public.onboarding_cases set owner_person_id=new_owner where id=c.id;
  update public.tasks t set assignee_person_id=new_owner,updated_at=transaction_timestamp()
    from public.document_versions v join public.documents d on d.id=v.document_id
    where t.source_kind='DOCUMENT_VERSION' and t.source_id=v.id and d.request_id is not null
      and t.state='OPEN' and t.assignee_person_id=c.owner_person_id
      and private.onboarding_request_case(d.request_id)=c.id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,before_value,after_value)
    values(actor,c.person_id,'onboarding_owner_change',change_id,'INSERT',
      jsonb_build_object('owner_person_id',c.owner_person_id),
      jsonb_build_object('owner_person_id',new_owner,'case_id',c.id,'reason',clean_reason));
  return change_id;
end;$$;
