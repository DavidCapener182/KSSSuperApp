-- TASK-22B: typed history labels must describe the change actually made.
create function private.contact_event_semantics_22b() returns trigger
 language plpgsql security definer set search_path='' as $$
declare old_v public.operational_contact_versions_22b%rowtype;
 new_v public.operational_contact_versions_22b%rowtype;
 r public.operational_contact_routes_22b%rowtype;
begin
 if tg_op<>'INSERT' then raise exception 'Contact history immutable'; end if;
 select * into r from public.operational_contact_routes_22b where id=new.route_id;
 if r.id is null then raise exception 'Contact history invalid'; end if;
 if new.old_version_id is not null then
  select * into old_v from public.operational_contact_versions_22b where id=new.old_version_id and route_id=new.route_id;
  if old_v.id is null then raise exception 'Contact history invalid'; end if;
 end if;
 if new.new_version_id is not null then
  select * into new_v from public.operational_contact_versions_22b where id=new.new_version_id and route_id=new.route_id;
  if new_v.id is null or r.current_version_id is distinct from new_v.id then raise exception 'Contact history invalid'; end if;
 end if;
 if new.action='PUBLISHED' then
  if old_v.id is not null or new_v.id is null or new_v.version<>1 then raise exception 'Contact publication history invalid'; end if;
 elsif new.action in ('CORRECTED','REVIEWED','REORDERED') then
  if old_v.id is null or new_v.id is null or new_v.version<>old_v.version+1 then raise exception 'Contact version history invalid'; end if;
  if new.action='REORDERED' and
   (to_jsonb(old_v)-array['id','version','priority','published_by','published_at','reason'])
    is distinct from (to_jsonb(new_v)-array['id','version','priority','published_by','published_at','reason'])
   then raise exception 'Reorder may change priority only'; end if;
  if new.action='REVIEWED' and
   (to_jsonb(old_v)-array['id','version','reviewed_on','source_marker','published_by','published_at','reason'])
    is distinct from (to_jsonb(new_v)-array['id','version','reviewed_on','source_marker','published_by','published_at','reason'])
   then raise exception 'Review may not silently correct values'; end if;
 elsif new.action in ('EXPIRED','REVOKED') then
  if old_v.id is null or new_v.id is not null or r.current_version_id is distinct from old_v.id then
   raise exception 'Contact terminal history invalid'; end if;
 else raise exception 'Contact history action invalid'; end if;
 return new;
end $$;
revoke all on function private.contact_event_semantics_22b() from public,anon,authenticated;
create trigger contact_events_semantics_22b before insert on public.operational_contact_events_22b
 for each row execute function private.contact_event_semantics_22b();
