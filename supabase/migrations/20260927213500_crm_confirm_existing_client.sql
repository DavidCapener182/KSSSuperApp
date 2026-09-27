-- A Super Admin can record an already established client without inventing a won Opportunity.
-- The reason and actor remain in the immutable audit stream.
create function public.crm_confirm_existing_client(p_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.current_person_id(); previous public.crm_organisations%rowtype;
begin
  if actor is null or not private.has_active_role('SUPER_ADMIN')
    or p_reason is null or length(trim(p_reason)) < 3 or length(trim(p_reason)) > 500 then
    raise exception 'Client confirmation denied';
  end if;
  select * into previous from public.crm_organisations where id=p_id for update;
  if not found or previous.relationship_status <> 'PROSPECT' then
    raise exception 'Client confirmation denied';
  end if;
  update public.crm_organisations set relationship_status='CLIENT', updated_at=now() where id=p_id;
  insert into public.audit_events(actor_person_id,affected_person_id,entity_type,entity_id,action,before_value,after_value,reason)
  values(actor,actor,'crm_organisation',p_id,'UPDATE',
    jsonb_build_object('relationship_status','PROSPECT'),
    jsonb_build_object('relationship_status','CLIENT'),trim(p_reason));
  return p_id;
end $$;
revoke all on function public.crm_confirm_existing_client(uuid,text) from public,anon,authenticated;
grant execute on function public.crm_confirm_existing_client(uuid,text) to authenticated;
