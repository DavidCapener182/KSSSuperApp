-- TASK-14A forward read model and idempotency correction.
create or replace function public.site_book_next_shift_14a(p_service uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); svc public.site_services%rowtype; h public.site_book_handovers%rowtype;
 open_rows jsonb; notes jsonb; handover_events jsonb; acks jsonb; open_total integer; own_ack timestamptz;
begin
 if actor is null or not private.site_book_can_read_14a(p_service) or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Book access denied'; end if;
 select * into svc from public.site_services where id=p_service;
 if svc.id is null then raise exception 'Book access denied'; end if;
 select count(*) into open_total from public.site_book_items where service_id=p_service and status='OPEN';
 select coalesce(jsonb_agg(x.row order by x.created_at,x.id),'[]'::jsonb) into open_rows from (
  select i.created_at,i.id,jsonb_build_object('id',i.id,'status',i.status,'revision',i.revision,'entryId',i.entry_id,
   'body',v.body,'occurredAt',v.occurred_at,'recordedAt',v.recorded_at,'author',p.display_name,'authorId',p.id,
   'history',(select coalesce(jsonb_agg(jsonb_build_object('kind',ev.kind,'revision',ev.revision,'note',ev.note,'reason',ev.reason,'actor',ep.display_name,'recordedAt',ev.recorded_at) order by ev.revision),'[]'::jsonb)
    from public.site_book_item_events ev join public.people ep on ep.id=ev.actor_person_id where ev.item_id=i.id)) as row
  from public.site_book_items i join public.site_book_entries e on e.id=i.entry_id
  join public.site_book_entry_versions v on v.entry_id=e.id and v.version=e.current_version join public.people p on p.id=e.author_person_id
  where i.service_id=p_service and i.status='OPEN' order by i.created_at,i.id limit 100 offset p_offset
 ) x;
 select coalesce(jsonb_agg(x.row order by x.recorded_at desc,x.id desc),'[]'::jsonb) into notes from (
  select e.id,v.recorded_at,jsonb_build_object('id',e.id,'type',e.entry_type,'source',e.source_kind,'version',e.current_version,
   'body',v.body,'occurredAt',v.occurred_at,'recordedAt',v.recorded_at,'author',p.display_name,'authorId',p.id,'itemId',i.id,
   'history',(select coalesce(jsonb_agg(jsonb_build_object('version',old.version,'body',old.body,'occurredAt',old.occurred_at,'recordedAt',old.recorded_at,'actor',ap.display_name,'reason',old.correction_reason) order by old.version),'[]'::jsonb)
    from public.site_book_entry_versions old join public.people ap on ap.id=old.actor_person_id where old.entry_id=e.id)) as row
  from public.site_book_entries e join public.site_book_entry_versions v on v.entry_id=e.id and v.version=e.current_version
  join public.people p on p.id=e.author_person_id left join public.site_book_items i on i.entry_id=e.id
  where e.service_id=p_service and e.recorded_at>=transaction_timestamp()-interval '48 hours'
  order by e.recorded_at desc,e.id desc limit 25
 ) x;
 select * into h from public.site_book_handovers where service_id=p_service order by created_at desc,id desc limit 1;
 if h.id is not null then
  select coalesce(jsonb_agg(jsonb_build_object('revision',ev.revision,'kind',ev.kind,'body',ev.body,'actor',p.display_name,'recordedAt',ev.recorded_at) order by ev.revision),'[]'::jsonb)
   into handover_events from public.site_book_handover_events ev join public.people p on p.id=ev.actor_person_id where ev.handover_id=h.id;
  select coalesce(jsonb_agg(jsonb_build_object('revision',a.revision,'receiver',p.display_name,'receiverId',a.receiver_person_id,'recordedAt',a.recorded_at) order by a.recorded_at),'[]'::jsonb)
   into acks from public.site_book_acknowledgements a join public.people p on p.id=a.receiver_person_id where a.handover_id=h.id;
  select a.recorded_at into own_ack from public.site_book_acknowledgements a where a.handover_id=h.id and a.revision=h.revision and a.receiver_person_id=actor;
 end if;
 if private.site_book_manager_14a(p_service) then
  insert into public.site_book_access_audit(service_id,actor_person_id,action,target_id) values(p_service,actor,'BOOK_READ',h.id);
 end if;
 return jsonb_build_object('service',jsonb_build_object('id',svc.id,'name',svc.name,'siteId',svc.site_id,'siteName',(select name from public.sites where id=svc.site_id)),
  'canWrite',private.site_book_can_write_14a(p_service),'manager',private.site_book_manager_14a(p_service),'actorId',actor,
  'openTotal',open_total,'openItems',open_rows,'recentNotes',notes,
  'handover',case when h.id is null then null else jsonb_build_object('id',h.id,'revision',h.revision,'from',h.outgoing_from,'until',h.outgoing_until,
   'createdAt',h.created_at,'createdBy',(select display_name from public.people where id=h.created_by),'closedAt',h.closed_at,
   'closeReason',h.close_reason,'events',handover_events,'acknowledgements',acks,'acknowledgedByYouAt',own_ack) end);
end $$;

create or replace function private.site_book_same_request_14a(p_key uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.site_book_idempotency%rowtype; actor uuid:=private.current_person_id();
begin
 if p_key is null or actor is null then raise exception 'Book request denied'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || ':' || p_key::text,0));
 select * into old from public.site_book_idempotency where actor_person_id=actor and idempotency_key=p_key;
 if found then
  if old.action<>p_action or old.payload_hash<>md5(p_payload::text) then raise exception 'Book request key reused with changed content'; end if;
  return old.result;
 end if;
 return null;
end $$;
revoke all on function private.site_book_same_request_14a(uuid,text,jsonb) from public,anon,authenticated;

create function public.site_book_item_history_14a(p_item uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.site_book_items%rowtype; result jsonb;
begin
 select * into i from public.site_book_items where id=p_item;
 if i.id is null or not private.site_book_can_read_14a(i.service_id) then raise exception 'Book item unavailable'; end if;
 select jsonb_build_object('id',i.id,'status',i.status,'revision',i.revision,'entryId',i.entry_id,
  'original',(select jsonb_build_object('body',v.body,'occurredAt',v.occurred_at,'recordedAt',v.recorded_at)
   from public.site_book_entry_versions v where v.entry_id=i.entry_id and v.version=1),
  'events',(select coalesce(jsonb_agg(jsonb_build_object('kind',ev.kind,'revision',ev.revision,'note',ev.note,'reason',ev.reason,'actor',p.display_name,'recordedAt',ev.recorded_at) order by ev.revision),'[]'::jsonb)
   from public.site_book_item_events ev join public.people p on p.id=ev.actor_person_id where ev.item_id=i.id)) into result;
 return result;
end $$;
revoke all on function public.site_book_item_history_14a(uuid) from public,anon,authenticated;
grant execute on function public.site_book_item_history_14a(uuid) to authenticated;

create function public.site_book_search_14a(p_service uuid,p_search text default '',p_type text default null,p_from timestamptz default null,p_until timestamptz default null,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); manager boolean:=private.site_book_manager_14a(p_service); result jsonb; total integer;
begin
 if actor is null or not private.site_book_can_read_14a(p_service) or p_search is null or length(p_search)>80
 or (p_type is not null and p_type not in ('VISITOR_CONTRACTOR_DELIVERY','KEYS_EQUIPMENT','MAINTENANCE','CLIENT_INSTRUCTION','ROUTINE_OBSERVATION','HANDOVER','OUTSTANDING_ITEM'))
 or (p_from is not null and p_until is not null and p_until<=p_from) or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Book search denied'; end if;
 select count(*) into total from public.site_book_entries e join public.site_book_entry_versions v on v.entry_id=e.id and v.version=e.current_version
 where e.service_id=p_service and (manager or e.recorded_at>=transaction_timestamp()-interval '48 hours')
 and (p_type is null or e.entry_type=p_type) and (p_from is null or v.occurred_at>=p_from) and (p_until is null or v.occurred_at<p_until)
 and (p_search='' or v.body ilike '%'||replace(replace(p_search,'%','\%'),'_','\_')||'%' escape '\');
 select coalesce(jsonb_agg(x.row order by x.recorded_at desc,x.id desc),'[]'::jsonb) into result from (
  select e.id,e.recorded_at,jsonb_build_object('id',e.id,'type',e.entry_type,'version',e.current_version,'body',v.body,
   'occurredAt',v.occurred_at,'recordedAt',v.recorded_at,'author',p.display_name,'authorId',p.id,'itemId',i.id,'itemStatus',i.status) row
  from public.site_book_entries e join public.site_book_entry_versions v on v.entry_id=e.id and v.version=e.current_version
  join public.people p on p.id=e.author_person_id left join public.site_book_items i on i.entry_id=e.id
  where e.service_id=p_service and (manager or e.recorded_at>=transaction_timestamp()-interval '48 hours')
  and (p_type is null or e.entry_type=p_type) and (p_from is null or v.occurred_at>=p_from) and (p_until is null or v.occurred_at<p_until)
  and (p_search='' or v.body ilike '%'||replace(replace(p_search,'%','\%'),'_','\_')||'%' escape '\')
  order by e.recorded_at desc,e.id desc limit 25 offset p_offset
 ) x;
 if manager then insert into public.site_book_access_audit(service_id,actor_person_id,action) values(p_service,actor,'BOOK_SEARCH'); end if;
 return jsonb_build_object('items',result,'total',total);
end $$;
revoke all on function public.site_book_search_14a(uuid,text,text,timestamptz,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.site_book_search_14a(uuid,text,text,timestamptz,timestamptz,integer) to authenticated;
