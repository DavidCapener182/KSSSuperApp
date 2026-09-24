create or replace function private.service_delivery_owner_ok(target uuid, allow_super boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select target is not null and (exists(select 1 from public.role_assignments r where r.person_id=target and r.role_code='OFFICE_ADMIN' and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))
 or (coalesce(allow_super,false) and exists(select 1 from public.role_assignments r where r.person_id=target and r.role_code='SUPER_ADMIN' and r.revoked_at is null and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()))))
$$;
revoke all on function private.service_delivery_owner_ok(uuid,boolean) from public,anon,authenticated;

create or replace function public.service_delivery_start(p_service uuid,p_link uuid,p_source text,p_mobilisation uuid,p_decision uuid,p_owner uuid,p_super_oversight boolean,p_reason_code text,p_explanation text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.service_delivery_actor(); prior public.service_delivery_requests%rowtype;
 digest text; source_row public.site_services%rowtype; mid public.mobilisations%rowtype; did uuid; result jsonb;
begin
 if p_key is null then raise exception 'Request key required'; end if;
 digest:=md5(jsonb_build_array(p_service,p_link,p_source,p_mobilisation,p_decision,p_owner,p_super_oversight,p_reason_code,p_explanation)::text);
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_key::text,0));
 select * into prior from public.service_delivery_requests where actor_person_id=actor and request_key=p_key;
 if found then if prior.payload_hash<>digest then raise exception 'Idempotency key conflict'; end if; return prior.result; end if;
 if not private.service_delivery_owner_ok(p_owner,p_super_oversight and private.has_active_role('SUPER_ADMIN')) then raise exception 'Owner ineligible'; end if;
 select * into source_row from public.site_services where id=p_service and site_client_link_id=p_link for share;
 if not found or not exists(select 1 from public.site_client_links l where l.id=p_link and l.site_id=source_row.site_id and l.organisation_id=source_row.organisation_id) then raise exception 'Exact source membership denied'; end if;
 if p_source='MOBILISATION_HANDOVER' then
  select * into mid from public.mobilisations where id=p_mobilisation and status='HANDED_OVER' and organisation_id=source_row.organisation_id for share;
  if not found or p_reason_code is not null or p_explanation is not null or not exists(
   select 1 from public.mobilisation_decisions d where d.id=p_decision and d.mobilisation_id=mid.id and d.kind='HANDOVER' and d.outcome='APPROVED' and d.occurred_at<=mid.handed_over_at
  ) or not exists(select 1 from public.mobilisation_links ml where ml.mobilisation_id=mid.id and ml.source_type='SITE_SERVICE' and ml.source_id=p_service and ml.unlinked_at is null and ml.linked_at<=mid.handed_over_at)
  then raise exception 'Exact 18A handover provenance denied'; end if;
 elsif p_source='LEGACY_EXISTING' then
  if source_row.state='DRAFT' then raise exception 'Legacy Service must already exist operationally'; end if;
  if p_mobilisation is not null or p_decision is not null or p_reason_code<>'LEGACY_EXISTING_SERVICE' or p_explanation is null or length(trim(p_explanation)) not between 10 and 500 or p_explanation ~ '[[:cntrl:]]' then raise exception 'Legacy start reason required'; end if;
 else raise exception 'Invalid start source'; end if;
 insert into public.service_deliveries(organisation_id,site_id,site_client_link_id,site_service_id,start_source,mobilisation_id,handover_decision_id,legacy_reason_code,legacy_explanation,owner_person_id,created_by_person_id)
 values(source_row.organisation_id,source_row.site_id,p_link,p_service,p_source,p_mobilisation,p_decision,p_reason_code,nullif(trim(p_explanation),''),p_owner,actor) returning id into did;
 insert into public.service_delivery_history(service_delivery_id,kind,subject_id,actor_person_id,after_value,service_revision,reason)
 values(did,'CREATED',did,actor,jsonb_build_object('source',p_source,'serviceId',p_service,'linkId',p_link,'mobilisationId',p_mobilisation,'handoverDecisionId',p_decision,'ownerId',p_owner,'reasonCode',p_reason_code),1,p_explanation);
 result:=jsonb_build_object('id',did,'revision',1);
 insert into public.service_delivery_requests(actor_person_id,request_key,payload_hash,result) values(actor,p_key,digest,result);
 return result;
end $$;
revoke all on function public.service_delivery_start(uuid,uuid,text,uuid,uuid,uuid,boolean,text,text,uuid) from public,anon,authenticated;
grant execute on function public.service_delivery_start(uuid,uuid,text,uuid,uuid,uuid,boolean,text,text,uuid) to authenticated;
