-- TASK-08C: add a typed static Site shift source to the existing 08B ledger.
-- Existing Event columns, FKs and rows retain their Event meaning.

-- Make the event-to-allocation Person binding enforceable, then bind the new
-- notification source pair to the exact immutable initial allocation event.
alter table public.site_shift_allocations
 add constraint site_shift_allocations_id_person_08c_key unique(id,person_id);
alter table public.site_shift_allocation_events
 add constraint site_shift_allocation_events_id_allocation_person_08c_key unique(id,allocation_id,person_id),
 add constraint site_shift_allocation_events_allocation_person_08c_fkey
  foreign key(allocation_id,person_id) references public.site_shift_allocations(id,person_id);

alter table public.staff_in_app_notifications
 alter column source_allocation_event_id drop not null,
 alter column allocation_id drop not null,
 add column source_kind text not null default 'EVENT' check(source_kind in ('EVENT','SITE_SHIFT')),
 add column site_shift_allocation_event_id uuid,
 add column site_shift_allocation_id uuid,
 drop constraint staff_in_app_notifications_notification_kind_check,
 add constraint staff_in_app_notifications_notification_kind_check
  check(notification_kind in ('DEPLOYMENT_CREATED','SITE_SHIFT_ALLOCATION_CREATED')),
 add constraint staff_in_app_notifications_source_pair_08c_check check (
  (source_kind='EVENT' and source_allocation_event_id is not null and allocation_id is not null
   and site_shift_allocation_event_id is null and site_shift_allocation_id is null
   and notification_kind='DEPLOYMENT_CREATED')
  or
  (source_kind='SITE_SHIFT' and source_allocation_event_id is null and allocation_id is null
   and site_shift_allocation_event_id is not null and site_shift_allocation_id is not null
   and notification_kind='SITE_SHIFT_ALLOCATION_CREATED')
 ),
 add constraint staff_in_app_notifications_site_alloc_person_08c_fkey
  foreign key(site_shift_allocation_id,recipient_person_id)
  references public.site_shift_allocations(id,person_id),
 add constraint staff_in_app_notifications_site_event_alloc_person_08c_fkey
  foreign key(site_shift_allocation_event_id,site_shift_allocation_id,recipient_person_id)
  references public.site_shift_allocation_events(id,allocation_id,person_id),
 add constraint staff_in_app_notifications_site_event_08c_key unique(site_shift_allocation_event_id),
 add constraint staff_in_app_notifications_site_alloc_kind_08c_key
  unique(site_shift_allocation_id,notification_kind);

alter table public.staff_in_app_notification_events
 alter column source_allocation_event_id drop not null,
 alter column allocation_id drop not null,
 add column source_kind text not null default 'EVENT' check(source_kind in ('EVENT','SITE_SHIFT')),
 add column site_shift_allocation_event_id uuid,
 add column site_shift_allocation_id uuid,
 add constraint staff_in_app_notification_events_source_pair_08c_check check (
  (source_kind='EVENT' and source_allocation_event_id is not null and allocation_id is not null
   and site_shift_allocation_event_id is null and site_shift_allocation_id is null)
  or
  (source_kind='SITE_SHIFT' and source_allocation_event_id is null and allocation_id is null
   and site_shift_allocation_event_id is not null and site_shift_allocation_id is not null)
 ),
 add constraint staff_in_app_notification_events_site_alloc_person_08c_fkey
  foreign key(site_shift_allocation_id,recipient_person_id)
  references public.site_shift_allocations(id,person_id),
 add constraint staff_in_app_notification_events_site_event_alloc_person_08c_fkey
  foreign key(site_shift_allocation_event_id,site_shift_allocation_id,recipient_person_id)
  references public.site_shift_allocation_events(id,allocation_id,person_id);

-- Every notification can have each presentation-history transition only once.
-- Existing 08B writes already enforce these transitions under a row lock.
create unique index staff_in_app_notification_events_action_once_08c_idx
 on public.staff_in_app_notification_events(notification_id,action);

create or replace function private.guard_staff_action_notification_08b() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent_row public.staff_in_app_notifications%rowtype; source_actor uuid;
begin
 if current_setting('kss.write_08b',true) is distinct from 'allowed' then
  raise exception 'Notification state write denied';
 end if;
 if tg_table_name='staff_in_app_notifications' and tg_op='INSERT' then
  if new.read_at is not null or new.dismissed_at is not null then raise exception 'Notification starts unread'; end if;
  if new.source_kind='EVENT' then
   if not exists(select 1 from public.event_staff_allocation_events e
     join public.event_staff_allocations a on a.id=e.allocation_id and a.requirement_id=e.requirement_id
       and a.person_id=e.person_id
     where e.id=new.source_allocation_event_id and e.allocation_id=new.allocation_id
      and e.person_id=new.recipient_person_id and e.kind='ALLOCATED' and e.old_status is null
      and e.new_status='ALLOCATED' and e.new_revision=1) then
    raise exception 'Event notification source mismatch';
   end if;
  elsif new.source_kind='SITE_SHIFT' then
   if not exists(select 1 from public.site_shift_allocation_events e
     join public.site_shift_allocations a on a.id=e.allocation_id and a.demand_id=e.demand_id
       and a.person_id=e.person_id
     join public.site_shift_demands d on d.id=e.demand_id
     join public.site_services sv on sv.id=d.service_id
     join public.sites s on s.id=sv.site_id
     join public.operational_role_definitions role on role.id=d.role_id
     where e.id=new.site_shift_allocation_event_id and e.allocation_id=new.site_shift_allocation_id
      and e.person_id=new.recipient_person_id and e.kind='ALLOCATED' and e.old_status is null
      and e.new_status='ALLOCATED' and e.new_revision=1 and a.status='ALLOCATED' and a.revision=1
      and d.state='PLANNED') then
    raise exception 'Site shift notification source mismatch';
   end if;
  else raise exception 'Unknown notification source'; end if;
 elsif tg_table_name='staff_in_app_notifications' and tg_op='UPDATE' then
  if new.id is distinct from old.id or new.source_kind is distinct from old.source_kind or
     new.source_allocation_event_id is distinct from old.source_allocation_event_id or
     new.site_shift_allocation_event_id is distinct from old.site_shift_allocation_event_id or
     new.allocation_id is distinct from old.allocation_id or
     new.site_shift_allocation_id is distinct from old.site_shift_allocation_id or
     new.recipient_person_id is distinct from old.recipient_person_id or
     new.notification_kind is distinct from old.notification_kind or
     new.created_at is distinct from old.created_at or
     (old.read_at is not null and new.read_at is distinct from old.read_at) or
     (old.dismissed_at is not null and new.dismissed_at is distinct from old.dismissed_at) then
   raise exception 'Notification identity/state is immutable';
  end if;
 elsif tg_table_name='staff_in_app_notification_events' and tg_op='INSERT' then
  select n.* into parent_row from public.staff_in_app_notifications n where n.id=new.notification_id;
  if parent_row.id is null or parent_row.source_kind is distinct from new.source_kind or
     parent_row.source_allocation_event_id is distinct from new.source_allocation_event_id or
     parent_row.site_shift_allocation_event_id is distinct from new.site_shift_allocation_event_id or
     parent_row.allocation_id is distinct from new.allocation_id or
     parent_row.site_shift_allocation_id is distinct from new.site_shift_allocation_id or
     parent_row.recipient_person_id is distinct from new.recipient_person_id then
   raise exception 'Notification history source mismatch';
  end if;
  if new.source_kind='EVENT' then
   select e.actor_person_id into source_actor from public.event_staff_allocation_events e
    where e.id=new.source_allocation_event_id and e.allocation_id=new.allocation_id and e.person_id=new.recipient_person_id;
  else
   select e.actor_person_id into source_actor from public.site_shift_allocation_events e
    where e.id=new.site_shift_allocation_event_id and e.allocation_id=new.site_shift_allocation_id and e.person_id=new.recipient_person_id;
  end if;
  if source_actor is null or (new.action='CREATED' and new.actor_person_id is distinct from source_actor) or
     (new.action in ('READ','DISMISSED') and new.actor_person_id is distinct from new.recipient_person_id) then
   raise exception 'Notification history actor mismatch';
  end if;
 elsif tg_table_name='staff_in_app_notification_events' and tg_op<>'INSERT' then
  raise exception 'Notification history is immutable';
 elsif tg_op='DELETE' then raise exception 'Notification history cannot be deleted';
 end if;
 return new;
end $$;
revoke all on function private.guard_staff_action_notification_08b() from public,anon,authenticated;

create function private.ensure_site_shift_notification_08c(p_source_event uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare source_row public.site_shift_allocation_events%rowtype; created_id uuid;
begin
 select e.* into source_row from public.site_shift_allocation_events e
  join public.site_shift_allocations a on a.id=e.allocation_id and a.demand_id=e.demand_id and a.person_id=e.person_id
  join public.site_shift_demands d on d.id=e.demand_id
  where e.id=p_source_event and e.kind='ALLOCATED' and e.old_status is null
   and e.new_status='ALLOCATED' and e.new_revision=1;
 if source_row.id is null then return null; end if;
 perform set_config('kss.write_08b','allowed',true);
 insert into public.staff_in_app_notifications(source_kind,site_shift_allocation_event_id,
  site_shift_allocation_id,recipient_person_id,notification_kind)
 values('SITE_SHIFT',source_row.id,source_row.allocation_id,source_row.person_id,'SITE_SHIFT_ALLOCATION_CREATED')
 on conflict(site_shift_allocation_event_id) do nothing returning id into created_id;
 if created_id is not null then
  insert into public.staff_in_app_notification_events(notification_id,source_kind,
   site_shift_allocation_event_id,site_shift_allocation_id,recipient_person_id,action,actor_person_id)
  values(created_id,'SITE_SHIFT',source_row.id,source_row.allocation_id,source_row.person_id,
   'CREATED',source_row.actor_person_id);
 end if;
 return coalesce(created_id,(select n.id from public.staff_in_app_notifications n
  where n.source_kind='SITE_SHIFT' and n.site_shift_allocation_event_id=source_row.id
   and n.site_shift_allocation_id=source_row.allocation_id and n.recipient_person_id=source_row.person_id));
end $$;
revoke all on function private.ensure_site_shift_notification_08c(uuid) from public,anon,authenticated;

create function private.create_site_shift_notification_08c() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.kind='ALLOCATED' and new.old_status is null and new.new_status='ALLOCATED' and new.new_revision=1 then
  perform private.ensure_site_shift_notification_08c(new.id);
 end if;
 return new;
end $$;
revoke all on function private.create_site_shift_notification_08c() from public,anon,authenticated;
create trigger create_site_shift_notification_08c after insert on public.site_shift_allocation_events
 for each row execute function private.create_site_shift_notification_08c();

create or replace function public.staff_action_centre(p_section text default 'UNREAD',p_offset integer default 0,p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if (select auth.uid()) is null or actor is null or not private.has_active_role('SECURITY_STAFF') or
    p_section is null or p_section not in ('UNREAD','REQUIRES_ACTION','RECENT','DISMISSED') or
    p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50 then
  raise exception 'Action Centre read denied';
 end if;
 with base as materialized (
  select 'EVENT'::text as source,n.id,n.allocation_id,n.created_at,n.read_at,n.dismissed_at,
   a.status as allocation_status,e.status as event_status,r.state as requirement_state,
   e.name as event_name,s.name as site_name,role.display_name as role_name,
   r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,
   (a.status='ALLOCATED' and r.state='PLANNED' and e.status in ('PLANNING','CONFIRMED','LIVE')) as action_required
  from public.staff_in_app_notifications n
  join public.event_staff_allocations a on a.id=n.allocation_id and a.person_id=n.recipient_person_id
  join public.event_staff_allocation_events source_event on source_event.id=n.source_allocation_event_id
   and source_event.allocation_id=a.id and source_event.person_id=a.person_id
  join public.event_staffing_requirements r on r.id=a.requirement_id
  join public.operational_events e on e.id=r.event_id
  join public.sites s on s.id=e.site_id
  join public.operational_role_definitions role on role.id=r.role_id
  where n.source_kind='EVENT' and n.recipient_person_id=actor and n.notification_kind='DEPLOYMENT_CREATED'
  union all
  select 'SITE_SHIFT'::text,n.id,n.site_shift_allocation_id,n.created_at,n.read_at,n.dismissed_at,
   a.status,d.state,d.state,sv.name,s.name,role.display_name,d.service_date,d.report_at,
   d.shift_starts_at,d.shift_ends_at,
   (a.status='ALLOCATED' and d.state='PLANNED' and sv.state in ('ACTIVE','PAUSED'))
  from public.staff_in_app_notifications n
  join public.site_shift_allocations a on a.id=n.site_shift_allocation_id and a.person_id=n.recipient_person_id
  join public.site_shift_allocation_events source_event on source_event.id=n.site_shift_allocation_event_id
   and source_event.allocation_id=a.id and source_event.demand_id=a.demand_id and source_event.person_id=a.person_id
  join public.site_shift_demands d on d.id=a.demand_id
  join public.site_services sv on sv.id=d.service_id
  join public.sites s on s.id=sv.site_id
  join public.operational_role_definitions role on role.id=d.role_id
  where n.source_kind='SITE_SHIFT' and n.recipient_person_id=actor
   and n.notification_kind='SITE_SHIFT_ALLOCATION_CREATED'
 ), selected as materialized (
  select * from base b where
   (p_section='UNREAD' and b.read_at is null and b.dismissed_at is null) or
   (p_section='REQUIRES_ACTION' and b.action_required and b.dismissed_at is null) or
   (p_section='RECENT' and b.created_at>=transaction_timestamp()-interval '30 days' and b.dismissed_at is null) or
   (p_section='DISMISSED' and b.dismissed_at is not null)
 ), page as (select * from selected order by created_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('section',p_section,
  'counts',jsonb_build_object(
   'unread',(select count(*) from base where read_at is null and dismissed_at is null),
   'requires_action',(select count(*) from base where action_required and dismissed_at is null),
   'recent',(select count(*) from base where created_at>=transaction_timestamp()-interval '30 days' and dismissed_at is null),
   'dismissed',(select count(*) from base where dismissed_at is not null)),
  'total',(select count(*) from selected),
  'items',coalesce((select jsonb_agg(
    jsonb_build_object('id',p.id,'allocationId',p.allocation_id,'createdAt',p.created_at,
     'readAt',p.read_at,'dismissedAt',p.dismissed_at,'allocationStatus',p.allocation_status,
     'eventStatus',p.event_status,'requirementState',p.requirement_state,'eventName',p.event_name,
     'siteName',p.site_name,'roleName',p.role_name,'serviceDate',p.service_date,'reportAt',p.report_at,
     'shiftStartsAt',p.shift_starts_at,'shiftEndsAt',p.shift_ends_at,'requiresAction',p.action_required,
     'currentMessage',case when p.action_required then 'Your response is required in My Deployments.'
      when p.source='SITE_SHIFT' and (p.allocation_status='CANCELLED' or p.requirement_state='CANCELLED')
       then 'This Site shift is no longer active.'
      when p.source='EVENT' and (p.allocation_status='CANCELLED' or p.event_status='CANCELLED' or p.requirement_state='CANCELLED')
       then 'This deployment is no longer active.'
      when p.source='SITE_SHIFT' and p.allocation_status='ACCEPTED' then 'You accepted this Site shift.'
      when p.source='EVENT' and p.allocation_status='ACCEPTED' then 'You accepted this deployment.'
      when p.source='SITE_SHIFT' and p.allocation_status='DECLINED' then 'You declined this Site shift.'
      when p.source='EVENT' and p.allocation_status='DECLINED' then 'You declined this deployment.'
      when p.source='SITE_SHIFT' then 'This Site shift is no longer active.'
      else 'This deployment is no longer active.' end) ||
    case when p.source='SITE_SHIFT' then jsonb_build_object('source','SITE_SHIFT') else '{}'::jsonb end
    order by p.created_at desc,p.id desc) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.staff_action_centre(text,integer,integer) from public,anon,authenticated;
grant execute on function public.staff_action_centre(text,integer,integer) to authenticated;

create or replace function public.staff_action_notification_change(p_notification uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); target public.staff_in_app_notifications%rowtype;
begin
 if (select auth.uid()) is null or actor is null or not private.has_active_role('SECURITY_STAFF') or
    p_notification is null or p_action is null or p_action not in ('READ','DISMISS') then
  raise exception 'Action Centre update denied';
 end if;
 select * into target from public.staff_in_app_notifications n
  where n.id=p_notification and n.recipient_person_id=actor for update;
 if target.id is null then raise exception 'Action Centre update denied'; end if;
 if (p_action='READ' and target.read_at is null) or (p_action='DISMISS' and target.dismissed_at is null) then
  perform set_config('kss.write_08b','allowed',true);
  update public.staff_in_app_notifications set
   read_at=case when p_action='READ' then transaction_timestamp() else read_at end,
   dismissed_at=case when p_action='DISMISS' then transaction_timestamp() else dismissed_at end,
   updated_at=transaction_timestamp() where id=target.id;
  insert into public.staff_in_app_notification_events(notification_id,source_kind,
   source_allocation_event_id,site_shift_allocation_event_id,allocation_id,site_shift_allocation_id,
   recipient_person_id,action,actor_person_id)
  values(target.id,target.source_kind,target.source_allocation_event_id,target.site_shift_allocation_event_id,
   target.allocation_id,target.site_shift_allocation_id,actor,
   case when p_action='DISMISS' then 'DISMISSED' else 'READ' end,actor);
 end if;
 return jsonb_build_object('notificationId',target.id,'readAt',
  case when p_action='READ' then coalesce(target.read_at,transaction_timestamp()) else target.read_at end,
  'dismissedAt',case when p_action='DISMISS' then coalesce(target.dismissed_at,transaction_timestamp()) else target.dismissed_at end);
end $$;
revoke all on function public.staff_action_notification_change(uuid,text) from public,anon,authenticated;
grant execute on function public.staff_action_notification_change(uuid,text) to authenticated;

-- Preserve the original 08A RPC signature and add a source-aware exact focus
-- RPC so the in-app static deep link cannot resolve to an Event row.
create function public.my_deployments_08c(p_offset integer,p_limit integer,p_focus uuid,p_focus_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if actor is null or not private.has_active_role('SECURITY_STAFF') or p_offset is null or p_offset<0 or p_offset>10000
   or p_limit is null or p_limit<1 or p_limit>50 or
   (p_focus_source is not null and p_focus_source not in ('EVENT','SITE_SHIFT')) or
   (p_focus is null and p_focus_source is not null) then
  raise exception 'Deployment self read denied';
 end if;
 with scoped as materialized (
  select 'EVENT'::text as source,a.id,a.status,a.revision,a.allocated_at,r.service_date,r.report_at,
   r.shift_starts_at,r.shift_ends_at,r.area_label,o.display_name as role_name,e.name as event_name,
   e.status as event_status,s.name as site_name,s.reporting_point,
   case when a.status in ('ALLOCATED','ACCEPTED') then
    private.availability_allocation_indicator_07a(a.person_id,r.report_at,r.shift_ends_at) else null end as availability_conflict,
   case when a.status in ('ALLOCATED','ACCEPTED') and e.status not in ('COMPLETED','CANCELLED') then 0 else 1 end as history_rank
  from public.event_staff_allocations a join public.event_staffing_requirements r on r.id=a.requirement_id
  join public.operational_role_definitions o on o.id=r.role_id
  join public.operational_events e on e.id=r.event_id join public.sites s on s.id=e.site_id
  where a.person_id=actor and (p_focus is null or (a.id=p_focus and coalesce(p_focus_source,'EVENT')='EVENT'))
  union all
  select 'SITE_SHIFT'::text,a.id,a.status,a.revision,a.allocated_at,d.service_date,d.report_at,
   d.shift_starts_at,d.shift_ends_at,d.area_label,o.display_name,sv.name,d.state,s.name,d.reporting_point,
   case when a.status in ('ALLOCATED','ACCEPTED') then
    private.availability_allocation_indicator_07a(a.person_id,d.report_at,d.shift_ends_at) else null end,
   case when a.status in ('ALLOCATED','ACCEPTED') and d.state='PLANNED' then 0 else 1 end
  from public.site_shift_allocations a join public.site_shift_demands d on d.id=a.demand_id
  join public.operational_role_definitions o on o.id=d.role_id
  join public.site_services sv on sv.id=d.service_id join public.sites s on s.id=sv.site_id
  where a.person_id=actor and (p_focus is null or (a.id=p_focus and p_focus_source='SITE_SHIFT'))
 ), page as (select * from scoped order by history_rank,report_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from scoped),
  'items',coalesce((select jsonb_agg(to_jsonb(p)-'history_rank'
   order by p.history_rank,p.report_at desc,p.id desc) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.my_deployments_08c(integer,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.my_deployments_08c(integer,integer,uuid,text) to authenticated;
