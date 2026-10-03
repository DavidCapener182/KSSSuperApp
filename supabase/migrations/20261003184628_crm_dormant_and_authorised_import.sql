-- David authorised importing the supplied sales CSV and adding Dormant on 3 October 2026.
alter table public.crm_opportunities drop constraint crm_opportunities_stage_check;
alter table public.crm_opportunities add constraint crm_opportunities_stage_check check (stage in ('NEW_LEAD','CONTACTED','QUALIFIED','PROPOSAL_TENDER','NEGOTIATION','DORMANT','WON','LOST'));
create table public.crm_import_records (
 opportunity_id uuid primary key references public.crm_opportunities(id),
 source_lead_id text not null,
 source_name text not null,
 source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
 source_data jsonb not null check (jsonb_typeof(source_data)='object'),
 imported_by_person_id uuid not null references public.people(id),
 imported_at timestamptz not null default now(),
 unique(source_name,source_lead_id)
);
alter table public.crm_import_records enable row level security;
revoke all on public.crm_import_records from public,anon,authenticated;
grant select on public.crm_import_records to authenticated;
create policy crm_import_read on public.crm_import_records for select to authenticated using (private.crm_authorised());
create or replace function public.crm_transition_opportunity(p_id uuid,p_stage text,p_reason text default null) returns void
language plpgsql security definer set search_path='' as $$
declare old_row public.crm_opportunities%rowtype; old_org public.crm_organisations%rowtype;
declare old_rank int; new_rank int; actor uuid:=private.current_person_id();
begin
 if not private.crm_authorised() then raise exception 'CRM action denied'; end if;
 select * into old_row from public.crm_opportunities where id=p_id for update;
 if not found or old_row.stage in ('WON','LOST') or p_stage=old_row.stage
  or p_stage not in ('NEW_LEAD','CONTACTED','QUALIFIED','PROPOSAL_TENDER','NEGOTIATION','DORMANT','WON','LOST') then raise exception 'Invalid CRM transition'; end if;
 old_rank:=array_position(array['NEW_LEAD','CONTACTED','QUALIFIED','PROPOSAL_TENDER','NEGOTIATION'],old_row.stage);
 new_rank:=array_position(array['NEW_LEAD','CONTACTED','QUALIFIED','PROPOSAL_TENDER','NEGOTIATION'],p_stage);
 if ((new_rank is not null and new_rank<old_rank) or p_stage in ('LOST','DORMANT') or old_row.stage='DORMANT') and (p_reason is null or length(trim(p_reason))<3) then raise exception 'Reason required'; end if;
 if p_stage='WON' then
  select * into old_org from public.crm_organisations where id=old_row.organisation_id for update;
  if old_org.relationship_status in ('FORMER_CLIENT','PARTNER') then raise exception 'Relationship conversion requires separate rule'; end if;
 end if;
 update public.crm_opportunities set stage=p_stage,lost_reason=case when p_stage='LOST' then trim(p_reason) else null end,updated_at=now() where id=p_id;
 insert into public.crm_opportunity_events(opportunity_id,kind,old_stage,new_stage,reason,actor_person_id)
 values(p_id,'STAGE',old_row.stage,p_stage,nullif(trim(p_reason),''),actor);
 perform private.crm_audit('crm_opportunity_event',p_id,'UPDATE',array['stage']);
 if p_stage='WON' and old_org.relationship_status='PROSPECT' then
  update public.crm_organisations set relationship_status='CLIENT',updated_at=now() where id=old_org.id;
  insert into public.crm_relationship_events(organisation_id,opportunity_id,old_status,new_status,actor_person_id)
  values(old_org.id,p_id,'PROSPECT','CLIENT',actor);
  perform private.crm_audit('crm_relationship_event',old_org.id,'UPDATE',array['relationship_status']);
 end if;
end $$;

-- TASK-05B grounded counts, all under the same active CRM role predicate.
create or replace function public.crm_operational_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date; tomorrow date; next_week date;
begin
 if not private.crm_authorised() then raise exception 'CRM access denied'; end if;
 today := (now() at time zone 'Europe/London')::date;
 tomorrow := today + 1;
 next_week := today + 7;
 return jsonb_build_object(
  'dueToday',(select count(*) from public.tasks t where t.task_type='CRM_FOLLOW_UP' and t.state='OPEN'
    and t.due_at is not null and (t.due_at at time zone 'Europe/London')::date=today),
  'overdue',(select count(*) from public.tasks t where t.task_type='CRM_FOLLOW_UP' and t.state='OPEN'
    and t.due_at<now()),
  'noFutureFollowUp',(select count(*) from public.crm_opportunities o where o.stage not in ('WON','LOST','DORMANT')
    and not exists(select 1 from public.tasks t where t.task_type='CRM_FOLLOW_UP'
      and t.source_kind='CRM_OPPORTUNITY' and t.source_id=o.id and t.state='OPEN'
      and t.due_at>=now())),
  'decisionsNextSevenDays',(select count(*) from public.crm_opportunities o where o.stage not in ('WON','LOST','DORMANT')
    and o.expected_decision_date>=today and o.expected_decision_date<next_week));
end $$;
revoke all on function public.crm_operational_summary() from public,anon,authenticated;
grant execute on function public.crm_operational_summary() to authenticated;

notify pgrst, 'reload schema';
