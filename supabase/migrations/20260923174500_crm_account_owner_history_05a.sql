-- Forward correction: account-owner changes retain typed history.
create table public.crm_organisation_owner_events (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.crm_organisations(id),
 old_owner_person_id uuid references public.people(id),
 new_owner_person_id uuid references public.people(id),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default now(),
 check (old_owner_person_id is distinct from new_owner_person_id)
);
create index crm_org_owner_events_at_idx on public.crm_organisation_owner_events(organisation_id,occurred_at,id);
alter table public.crm_organisation_owner_events enable row level security;
revoke all on public.crm_organisation_owner_events from public,anon,authenticated;
grant select on public.crm_organisation_owner_events to authenticated;
create policy crm_org_owner_event_read on public.crm_organisation_owner_events for select to authenticated using (private.crm_authorised());

create or replace function public.crm_update_organisation(p_id uuid,p_name text,p_trading_name text,p_website text,p_email text,p_phone text,p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare previous public.crm_organisations%rowtype;
begin
 if not private.crm_authorised() or (p_owner is not null and not private.crm_owner_eligible(p_owner)) then raise exception 'CRM action denied'; end if;
 select * into previous from public.crm_organisations where id=p_id for update;
 if not found then raise exception 'CRM action denied'; end if;
 update public.crm_organisations set name=trim(p_name),trading_name=nullif(trim(p_trading_name),''),
 website=nullif(trim(p_website),''),general_email=nullif(lower(trim(p_email)),''),
 main_phone=nullif(trim(p_phone),''),owner_person_id=p_owner,updated_at=now() where id=p_id;
 if previous.owner_person_id is distinct from p_owner then
  insert into public.crm_organisation_owner_events(organisation_id,old_owner_person_id,new_owner_person_id,actor_person_id)
  values(p_id,previous.owner_person_id,p_owner,private.current_person_id());
 end if;
 perform private.crm_audit('crm_organisation',p_id,'UPDATE',array['name','trading_name','website','general_email','main_phone','owner_person_id']);
end $$;
