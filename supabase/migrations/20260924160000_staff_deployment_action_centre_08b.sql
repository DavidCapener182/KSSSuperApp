-- TASK-08B: one in-app, exact-recipient notification for an Event allocation.
-- No Tasks, external channel, static-shift producer, or caller-supplied message.

create table public.staff_in_app_notifications (
 id uuid primary key default gen_random_uuid(),
 source_allocation_event_id uuid not null unique references public.event_staff_allocation_events(id),
 allocation_id uuid not null references public.event_staff_allocations(id),
 recipient_person_id uuid not null references public.people(id),
 notification_kind text not null check (notification_kind='DEPLOYMENT_CREATED'),
 created_at timestamptz not null default transaction_timestamp(),
 read_at timestamptz,
 dismissed_at timestamptz,
 updated_at timestamptz not null default transaction_timestamp(),
 unique(allocation_id,notification_kind)
);
create index staff_in_app_notifications_recipient_created_idx
 on public.staff_in_app_notifications(recipient_person_id,created_at desc,id desc);
create index staff_in_app_notifications_recipient_unread_idx
 on public.staff_in_app_notifications(recipient_person_id,created_at desc,id desc)
 where read_at is null and dismissed_at is null;

create table public.staff_in_app_notification_events (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references public.staff_in_app_notifications(id),
 source_allocation_event_id uuid not null references public.event_staff_allocation_events(id),
 allocation_id uuid not null references public.event_staff_allocations(id),
 recipient_person_id uuid not null references public.people(id),
 action text not null check (action in ('CREATED','READ','DISMISSED')),
 actor_person_id uuid not null references public.people(id),
 occurred_at timestamptz not null default transaction_timestamp()
);
create index staff_in_app_notification_events_notification_idx
 on public.staff_in_app_notification_events(notification_id,occurred_at,id);

alter table public.staff_in_app_notifications enable row level security;
alter table public.staff_in_app_notification_events enable row level security;
revoke all on public.staff_in_app_notifications,public.staff_in_app_notification_events from public,anon,authenticated;

create function private.guard_staff_action_notification_08b() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('kss.write_08b',true) is distinct from 'allowed' then
   raise exception 'Notification state write denied';
 end if;
 if tg_table_name='staff_in_app_notifications' and tg_op='INSERT' then
   if new.read_at is not null or new.dismissed_at is not null then
     raise exception 'Notification starts unread';
   end if;
 elsif tg_table_name='staff_in_app_notifications' and tg_op='UPDATE' then
   if new.id is distinct from old.id or
      new.source_allocation_event_id is distinct from old.source_allocation_event_id or
      new.allocation_id is distinct from old.allocation_id or
      new.recipient_person_id is distinct from old.recipient_person_id or
      new.notification_kind is distinct from old.notification_kind or
      new.created_at is distinct from old.created_at or
      (old.read_at is not null and new.read_at is distinct from old.read_at) or
      (old.dismissed_at is not null and new.dismissed_at is distinct from old.dismissed_at) then
     raise exception 'Notification identity/state is immutable';
   end if;
 elsif tg_table_name='staff_in_app_notification_events' and tg_op<>'INSERT' then
   raise exception 'Notification history is immutable';
 elsif tg_op='DELETE' then
   raise exception 'Notification history cannot be deleted';
 end if;
 return new;
end $$;
revoke all on function private.guard_staff_action_notification_08b() from public,anon,authenticated;
create trigger guard_staff_in_app_notifications_08b
 before insert or update or delete on public.staff_in_app_notifications
 for each row execute function private.guard_staff_action_notification_08b();
create trigger guard_staff_in_app_notification_events_08b
 before insert or update or delete on public.staff_in_app_notification_events
 for each row execute function private.guard_staff_action_notification_08b();

-- Internal, idempotent producer. The event row is immutable and binds the exact
-- allocation and Person. A unique source-event key makes retry/concurrent calls safe.
create function private.ensure_deployment_notification_08b(p_source_event uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare created_id uuid; source_row public.event_staff_allocation_events%rowtype;
begin
 select * into source_row from public.event_staff_allocation_events
  where id=p_source_event and kind='ALLOCATED' and old_status is null
    and new_status='ALLOCATED' and new_revision=1;
 if source_row.id is null then return null; end if;
 perform set_config('kss.write_08b','allowed',true);
 insert into public.staff_in_app_notifications(
   source_allocation_event_id,allocation_id,recipient_person_id,notification_kind)
 values(source_row.id,source_row.allocation_id,source_row.person_id,'DEPLOYMENT_CREATED')
 on conflict (source_allocation_event_id) do nothing
 returning id into created_id;
 if created_id is not null then
   insert into public.staff_in_app_notification_events(
    notification_id,source_allocation_event_id,allocation_id,recipient_person_id,action,actor_person_id)
   values(created_id,source_row.id,source_row.allocation_id,source_row.person_id,'CREATED',source_row.actor_person_id);
 end if;
 return coalesce(created_id,(select n.id from public.staff_in_app_notifications n
   where n.source_allocation_event_id=source_row.id));
end $$;
revoke all on function private.ensure_deployment_notification_08b(uuid) from public,anon,authenticated;

create function private.create_deployment_notification_08b() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.kind='ALLOCATED' and new.old_status is null and new.new_status='ALLOCATED' and new.new_revision=1 then
   perform private.ensure_deployment_notification_08b(new.id);
 end if;
 return new;
end $$;
revoke all on function private.create_deployment_notification_08b() from public,anon,authenticated;
create trigger create_deployment_notification_08b
 after insert on public.event_staff_allocation_events
 for each row execute function private.create_deployment_notification_08b();

-- Safe self-only projection. Names and current allocation state are reloaded from
-- the authoritative source; the notification row grants no source visibility.
create function public.staff_action_centre(p_section text default 'UNREAD',p_offset integer default 0,p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); result jsonb;
begin
 if (select auth.uid()) is null or actor is null or not private.has_active_role('SECURITY_STAFF') or
    p_section is null or p_section not in ('UNREAD','REQUIRES_ACTION','RECENT','DISMISSED') or
    p_offset is null or p_offset<0 or p_offset>10000 or p_limit is null or p_limit<1 or p_limit>50 then
   raise exception 'Action Centre read denied';
 end if;
 with base as materialized (
  select n.id,n.allocation_id,n.created_at,n.read_at,n.dismissed_at,a.status as allocation_status,
   e.status as event_status,r.state as requirement_state,e.name as event_name,s.name as site_name,
   role.display_name as role_name,r.service_date,r.report_at,r.shift_starts_at,r.shift_ends_at,
   (a.status='ALLOCATED' and r.state='PLANNED' and e.status in ('PLANNING','CONFIRMED','LIVE')) as action_required
  from public.staff_in_app_notifications n
  join public.event_staff_allocations a on a.id=n.allocation_id and a.person_id=n.recipient_person_id
  join public.event_staff_allocation_events source_event on source_event.id=n.source_allocation_event_id
   and source_event.allocation_id=a.id and source_event.person_id=a.person_id
  join public.event_staffing_requirements r on r.id=a.requirement_id
  join public.operational_events e on e.id=r.event_id
  join public.sites s on s.id=e.site_id
  join public.operational_role_definitions role on role.id=r.role_id
  where n.recipient_person_id=actor and n.notification_kind='DEPLOYMENT_CREATED'
 ), selected as materialized (
  select * from base b where
   (p_section='UNREAD' and b.read_at is null and b.dismissed_at is null) or
   (p_section='REQUIRES_ACTION' and b.action_required and b.dismissed_at is null) or
   (p_section='RECENT' and b.created_at>=transaction_timestamp()-interval '30 days' and b.dismissed_at is null) or
   (p_section='DISMISSED' and b.dismissed_at is not null)
 ), page as (
  select * from selected order by created_at desc,id desc offset p_offset limit p_limit
 )
 select jsonb_build_object(
  'section',p_section,
  'counts',jsonb_build_object(
   'unread',(select count(*) from base where read_at is null and dismissed_at is null),
   'requires_action',(select count(*) from base where action_required and dismissed_at is null),
   'recent',(select count(*) from base where created_at>=transaction_timestamp()-interval '30 days' and dismissed_at is null),
   'dismissed',(select count(*) from base where dismissed_at is not null)),
  'total',(select count(*) from selected),
  'items',coalesce((select jsonb_agg(jsonb_build_object(
   'id',p.id,'allocationId',p.allocation_id,'createdAt',p.created_at,'readAt',p.read_at,'dismissedAt',p.dismissed_at,
   'allocationStatus',p.allocation_status,'eventStatus',p.event_status,'requirementState',p.requirement_state,
   'eventName',p.event_name,'siteName',p.site_name,'roleName',p.role_name,'serviceDate',p.service_date,
   'reportAt',p.report_at,'shiftStartsAt',p.shift_starts_at,'shiftEndsAt',p.shift_ends_at,
   'requiresAction',p.action_required,
   'currentMessage',case when p.action_required then 'Your response is required in My Deployments.'
    when p.allocation_status='CANCELLED' or p.event_status='CANCELLED' or p.requirement_state='CANCELLED'
      then 'This deployment is no longer active.'
    when p.allocation_status='ACCEPTED' then 'You accepted this deployment.'
    when p.allocation_status='DECLINED' then 'You declined this deployment.'
    else 'This deployment is no longer active.' end)
   order by p.created_at desc,p.id desc) from page p),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.staff_action_centre(text,integer,integer) from public,anon,authenticated;
grant execute on function public.staff_action_centre(text,integer,integer) to authenticated;

create function public.staff_action_notification_change(p_notification uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); target public.staff_in_app_notifications%rowtype;
begin
 if (select auth.uid()) is null or actor is null or not private.has_active_role('SECURITY_STAFF') or p_notification is null or
    p_action is null or p_action not in ('READ','DISMISS') then
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
    updated_at=transaction_timestamp()
   where id=target.id;
   insert into public.staff_in_app_notification_events(
    notification_id,source_allocation_event_id,allocation_id,recipient_person_id,action,actor_person_id)
   values(target.id,target.source_allocation_event_id,target.allocation_id,actor,
    case when p_action='DISMISS' then 'DISMISSED' else 'READ' end,actor);
 end if;
 return jsonb_build_object('notificationId',target.id,'readAt',
  case when p_action='READ' then coalesce(target.read_at,transaction_timestamp()) else target.read_at end,
  'dismissedAt',case when p_action='DISMISS' then coalesce(target.dismissed_at,transaction_timestamp()) else target.dismissed_at end);
end $$;
revoke all on function public.staff_action_notification_change(uuid,text) from public,anon,authenticated;
grant execute on function public.staff_action_notification_change(uuid,text) to authenticated;
