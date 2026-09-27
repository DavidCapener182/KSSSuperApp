-- PRODUCT-10: Super Admin read-only composition of independently owned grant facts.
-- No grant writer, permission table, private evidence, credential values or case content.
create function private.person_domain_grants_review_10(p_person uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_person is null or private.current_person_id() is null or not private.has_active_role('SUPER_ADMIN')
    or not exists (select 1 from public.people where id = p_person) then
    raise exception 'Access review denied';
  end if;
  select coalesce(jsonb_agg(fact order by recorded_at desc, grant_id desc), '[]'::jsonb) into v_result
  from (
    select g.id grant_id, g.created_at recorded_at, jsonb_build_object(
      'grantId',g.id,'domain','INCIDENT','capability','INCIDENT_REVIEWER','scopeKind','PERSON','scopeId',p_person,
      'scopeName','Incident review','effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,
      'grantedBy',g.granted_by_person_id,'reason',g.grant_reason,'revokedAt',g.revoked_at,
      'revocationReason',g.revocation_reason,'sourceHref','/access/incident-reviewers') fact
    from public.incident_reviewer_grants g where g.reviewer_person_id=p_person
    union all
    select g.id,g.created_at,jsonb_build_object(
      'grantId',g.id,'domain','ONBOARDING','capability',case when g.can_coordinate then 'TEAM_COORDINATOR' else 'TEAM_TRIAGE' end,
      'scopeKind','TEAM','scopeId',g.team_id,'scopeName',t.name,'effectiveFrom',g.effective_from,
      'effectiveUntil',g.effective_until,'grantedBy',g.granted_by_person_id,'reason',null,
      'revokedAt',g.revoked_at,'revocationReason',null,'sourceHref','/onboarding')
    from public.onboarding_team_memberships g join public.onboarding_teams t on t.id=g.team_id where g.person_id=p_person
    union all
    select g.id,g.granted_at,jsonb_build_object(
      'grantId',g.id,'domain','ONBOARDING','capability','NAMED_CASE_COVER','scopeKind','CASE','scopeId',g.case_id,
      'scopeName','Exact case cover','effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,
      'grantedBy',g.grantor_person_id,'reason',g.reason,'revokedAt',g.revoked_at,
      'revocationReason',null,'sourceHref','/onboarding/'||g.case_id::text)
    from public.onboarding_case_cover_grants g where g.covering_person_id=p_person
    union all
    select g.id,g.issued_at,jsonb_build_object(
      'grantId',g.id,'domain','SITE_BOOK','capability',g.kind,'scopeKind','SITE_SERVICE','scopeId',g.service_id,
      'scopeName',s.name,'effectiveFrom',g.valid_from,'effectiveUntil',g.valid_until,'grantedBy',g.issued_by,
      'reason',g.reason,'revokedAt',g.revoked_at,'revocationReason',g.revoke_reason,'sourceHref','/site-book/access')
    from public.site_book_grants g join public.site_services s on s.id=g.service_id where g.person_id=p_person
    union all
    select g.id,g.granted_at,jsonb_build_object(
      'grantId',g.id,'domain','SERVICE_CHANGE','capability',g.capability,'scopeKind','SERVICE_DELIVERY',
      'scopeId',g.service_delivery_id,'scopeName',s.name,'effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,
      'grantedBy',g.granted_by_person_id,'reason',g.reason,'revokedAt',g.revoked_at,
      'revocationReason',g.revocation_reason,'sourceHref','/service-delivery/'||g.service_delivery_id::text)
    from public.service_change_grants g join public.service_deliveries d on d.id=g.service_delivery_id
      join public.site_services s on s.id=d.site_service_id where g.person_id=p_person
    union all
    select g.id,g.created_at,jsonb_build_object(
      'grantId',g.id,'domain','EVENT_WORK_TIME','capability',g.capability,'scopeKind','EVENT','scopeId',g.event_id,
      'scopeName',e.name,'effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,
      'grantedBy',g.granted_by_person_id,'reason',g.reason,'revokedAt',g.revoked_at,
      'revocationReason',g.revocation_reason,'sourceHref','/events/'||g.event_id::text||'/work-time')
    from public.event_work_time_grants g join public.operational_events e on e.id=g.event_id where g.person_id=p_person
    union all
    select g.id,g.created_at,jsonb_build_object(
      'grantId',g.id,'domain','CREDENTIAL_REVIEW','capability','CREDENTIAL_REVIEWER','scopeKind','PERSON_TYPE',
      'scopeId',g.subject_person_id,'scopeName',g.type_code,'effectiveFrom',g.effective_from,
      'effectiveUntil',g.effective_until,'grantedBy',g.granted_by_person_id,'reason',null,
      'revokedAt',g.revoked_at,'revocationReason',null,'sourceHref','/credentials')
    from public.credential_reviewer_grants_16b g where g.reviewer_person_id=p_person
    union all
    select g.id,g.granted_at,jsonb_build_object(
      'grantId',g.id,'domain','TRAINING','capability',g.capability,'scopeKind','GLOBAL','scopeId',null,
      'scopeName','Training catalogue','effectiveFrom',g.granted_at,'effectiveUntil',null,
      'grantedBy',g.granted_by,'reason',g.reason,'revokedAt',g.revoked_at,
      'revocationReason',g.revoked_reason,'sourceHref','/training-admin')
    from public.training_capability_grants g where g.person_id=p_person
    union all
    select g.id,g.granted_at,jsonb_build_object(
      'grantId',g.id,'domain','TRAINING','capability','TRAINING_ASSIGNER','scopeKind','GLOBAL','scopeId',null,
      'scopeName','Training assignments','effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,
      'grantedBy',g.granted_by,'reason',g.grant_reason,'revokedAt',g.revoked_at,
      'revocationReason',g.revoke_reason,'sourceHref','/training-admin/assignments')
    from public.training_assigner_grants g where g.person_id=p_person
    union all
    select g.id,g.granted_at,jsonb_build_object(
      'grantId',g.id,'domain','TRAINING','capability',g.capability,'scopeKind','GLOBAL','scopeId',null,
      'scopeName','Training assessments','effectiveFrom',g.granted_at,'effectiveUntil',null,
      'grantedBy',g.granted_by,'reason',g.reason,'revokedAt',g.revoked_at,
      'revocationReason',g.revoke_reason,'sourceHref','/training-admin/assessments')
    from public.training_assessment_grants g where g.person_id=p_person
    union all
    select g.id,g.granted_at,jsonb_build_object(
      'grantId',g.id,'domain','TRAINING','capability','COMPLETION_MANAGER','scopeKind','GLOBAL','scopeId',null,
      'scopeName','Training completions','effectiveFrom',g.granted_at,'effectiveUntil',null,
      'grantedBy',g.granted_by,'reason',g.grant_reason,'revokedAt',g.revoked_at,
      'revocationReason',g.revoke_reason,'sourceHref','/training-admin/completions')
    from public.training_completion_manager_grants g where g.person_id=p_person
    union all
    select g.id,g.created_at,jsonb_build_object(
      'grantId',g.id,'domain','DOCUMENTS','capability','ONBOARDING_TERMS_PUBLISHER','scopeKind','DOCUMENT_FAMILY',
      'scopeId',null,'scopeName',g.family,'effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,
      'grantedBy',g.granted_by_person_id,'reason',null,'revokedAt',g.revoked_at,
      'revocationReason',null,'sourceHref','/onboarding')
    from public.controlled_publisher_grants g where g.person_id=p_person
    union all
    select g.id,g.created_at,jsonb_build_object(
      'grantId',g.id,'domain','DOCUMENTS','capability','OPERATIONAL_DOCUMENT_'||g.capability,'scopeKind','GLOBAL',
      'scopeId',null,'scopeName','Operational documents','effectiveFrom',g.effective_from,
      'effectiveUntil',g.effective_until,'grantedBy',g.granted_by_person_id,'reason',null,
      'revokedAt',g.revoked_at,'revocationReason',null,'sourceHref','/operational-documents')
    from public.operational_document_grants g where g.person_id=p_person
    union all
    select g.id,g.created_at,jsonb_build_object(
      'grantId',g.id,'domain','ASSETS','capability','ASSET_MANAGER','scopeKind',g.scope_kind,
      'scopeId',coalesce(g.store_id,g.site_id,g.site_service_id,g.event_id),'scopeName',g.scope_kind,
      'effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,'grantedBy',g.granted_by,
      'reason',g.grant_reason,'revokedAt',g.revoked_at,'revocationReason',g.revocation_reason,
      'sourceHref','/assets')
    from public.asset_capability_grants g where g.person_id=p_person
    union all
    select g.id,g.created_at,jsonb_build_object(
      'grantId',g.id,'domain','OPERATIONAL_CONTACTS','capability','CONTACT_MANAGER','scopeKind',g.context_kind,
      'scopeId',g.context_id,'scopeName',g.context_kind,'effectiveFrom',g.valid_from,'effectiveUntil',g.valid_until,
      'grantedBy',g.granted_by,'reason',null,'revokedAt',g.revoked_at,
      'revocationReason',null,'sourceHref','/operational-contacts/manage')
    from public.operational_contact_grants_22b g where g.person_id=p_person
    union all
    select g.id,g.created_at,jsonb_build_object(
      'grantId',g.id,'domain','TIME_AWAY','capability','TEAM_MEMBER','scopeKind','TEAM','scopeId',g.team_id,
      'scopeName',t.name,'effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,
      'grantedBy',g.added_by,'reason',g.reason,'revokedAt',g.revoked_at,
      'revocationReason',null,'sourceHref','/time-away')
    from public.time_away_team_memberships g join public.time_away_teams t on t.id=g.team_id where g.person_id=p_person
    union all
    select g.id,g.created_at,jsonb_build_object(
      'grantId',g.id,'domain','TIME_AWAY','capability',array_to_string(g.actions,', '),'scopeKind','TEAM',
      'scopeId',g.team_id,'scopeName',t.name,'effectiveFrom',g.effective_from,'effectiveUntil',g.effective_until,
      'grantedBy',g.granted_by,'reason',g.reason,'revokedAt',g.revoked_at,
      'revocationReason',null,'sourceHref','/time-away')
    from public.time_away_approver_grants g join public.time_away_teams t on t.id=g.team_id where g.person_id=p_person
  ) source;
  return v_result;
end $$;
revoke all on function private.person_domain_grants_review_10(uuid) from public,anon,authenticated;
grant execute on function private.person_domain_grants_review_10(uuid) to authenticated;

create function public.person_domain_grants_review_10(p_person uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.person_domain_grants_review_10(p_person)
$$;
revoke all on function public.person_domain_grants_review_10(uuid) from public,anon,authenticated;
grant execute on function public.person_domain_grants_review_10(uuid) to authenticated;
