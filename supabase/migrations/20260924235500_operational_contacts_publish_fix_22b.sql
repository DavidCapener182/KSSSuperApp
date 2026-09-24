-- TASK-22B: resolve PL/pgSQL purpose-variable ambiguity found by authenticated proof.
create or replace function public.contact_publish_22b(p jsonb) returns uuid
 language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.current_person_id(); r public.operational_contact_routes_22b%rowtype;
 k text:=p->>'context_kind'; target uuid; purpose text:=p->>'purpose'; src text:=p->>'source_type'; source uuid;
 route uuid; expected int; effective_start timestamptz; effective_end timestamptz;
 local_start time; local_end time; review_date date; prio int;
 nm text; descriptor text; tel text; mail text; marker text; origin text; reason text:=trim(p->>'reason');
 prior uuid; next_version uuid; action text; org uuid; accountable uuid;
begin
 if actor is null or jsonb_typeof(p)<>'object' or k not in ('SITE','SITE_SERVICE','EVENT')
 or purpose not in ('CLIENT_OPERATIONAL','SITE_MANAGEMENT','KSS_DUTY_MANAGER','KSS_ESCALATION','FACILITIES_MAINTENANCE','HEALTH_SAFETY','EMERGENCY_SITE_CONTACT','OTHER_OPERATIONAL')
 or src not in ('CRM_CONTACT','KSS_PERSON','MANUAL_OPERATIONAL')
 or reason is null or length(reason) not between 3 and 300 or reason ~ '[[:cntrl:]]'
 then raise exception 'Contact publication denied'; end if;
 target:=(p->>'context_id')::uuid;
 if not private.contact_context_exists_22b(k,target) or not private.contact_manager_22b(k,target) then raise exception 'Contact publication denied'; end if;
 effective_start:=(p->>'effective_from')::timestamptz; effective_end:=(p->>'effective_until')::timestamptz;
 review_date:=(p->>'reviewed_on')::date; prio:=(p->>'priority')::int;
 local_start:=nullif(p->>'london_start','')::time; local_end:=nullif(p->>'london_end','')::time;
 if effective_start is null or effective_end is null or effective_end<=effective_start or effective_end<=transaction_timestamp()
 or review_date is null or review_date>(transaction_timestamp() at time zone 'Europe/London')::date
 or prio not between 1 and 20 or (local_start is null)<>(local_end is null) or local_start=local_end
 then raise exception 'Contact publication denied'; end if;
 if p ? 'route_id' and p->>'route_id' is not null then
  route:=(p->>'route_id')::uuid; expected:=(p->>'expected_revision')::int;
  select * into r from public.operational_contact_routes_22b where id=route for update;
  if not found or r.state<>'PUBLISHED' or r.revision<>expected or r.context_kind<>k or r.context_id<>target
   or r.purpose<>purpose or r.source_type<>src or r.source_id is distinct from nullif(p->>'source_id','')::uuid
   then raise exception 'Contact publication denied'; end if;
  prior:=r.current_version_id;
  action:=p->>'action';
  if action not in ('CORRECTED','REVIEWED','REORDERED') then raise exception 'Contact publication denied'; end if;
 else
  if p ? 'expected_revision' or p ? 'action' then raise exception 'Contact publication denied'; end if;
  action:='PUBLISHED';
 end if;
 org:=private.contact_context_org_22b(k,target);
 if src='CRM_CONTACT' then
  source:=(p->>'source_id')::uuid;
  select trim(c.first_name||' '||c.last_name),trim(coalesce(c.job_title||' / ','')||o.name),
   case when coalesce((p->>'use_phone')::boolean,false) then c.business_phone end,
   case when coalesce((p->>'use_email')::boolean,false) then c.business_email end
   into nm,descriptor,tel,mail
  from public.crm_contacts c join public.crm_organisations o on o.id=c.organisation_id
  where c.id=source and c.active and c.organisation_id=org;
  marker:=private.contact_source_marker_22b(src,source);
 elsif src='KSS_PERSON' then
  source:=(p->>'source_id')::uuid;
  select x.display_name,trim(p->>'role_organisation'),
   case when coalesce((p->>'use_phone')::boolean,false) then f.mobile end,
   case when coalesce((p->>'use_email')::boolean,false) then f.contact_email end
   into nm,descriptor,tel,mail
  from public.people x join public.person_profiles f on f.person_id=x.id where x.id=source;
  marker:=private.contact_source_marker_22b(src,source);
 else
  if p->>'source_id' is not null then raise exception 'Contact publication denied'; end if;
  nm:=trim(p->>'display_name'); descriptor:=trim(p->>'role_organisation');
  tel:=nullif(trim(p->>'phone'),''); mail:=nullif(lower(trim(p->>'email')),'');
  origin:=trim(p->>'manual_origin');
  marker:=md5(jsonb_build_array(nm,descriptor,tel,mail)::text);
  accountable:=coalesce(nullif(p->>'accountable_manager_id','')::uuid,case when private.has_active_role('OFFICE_ADMIN') then actor end);
  if origin is null or length(origin) not between 3 and 300 or origin ~ '[[:cntrl:]]'
   or (k='EVENT' and effective_end is null)
   or (k<>'EVENT' and (p->>'reviewed_on') is null)
   or accountable is null or not exists(select 1 from public.operational_contact_grants_22b g
    where g.person_id=accountable and g.context_kind=k and g.context_id=target and g.revoked_at is null
     and g.valid_from<=transaction_timestamp() and g.valid_until>transaction_timestamp())
   or not exists(select 1 from public.role_assignments ra where ra.person_id=accountable and ra.role_code='OFFICE_ADMIN'
    and ra.revoked_at is null and ra.effective_from<=transaction_timestamp()
    and (ra.effective_until is null or ra.effective_until>transaction_timestamp()))
   then raise exception 'Contact publication denied'; end if;
 end if;
 if nm is null or descriptor is null or length(nm) not between 2 and 120 or length(descriptor) not between 2 and 180
 or tel is null and mail is null or (src<>'MANUAL_OPERATIONAL' and marker is null)
 or (src='CRM_CONTACT' and org is null) then raise exception 'Contact publication denied'; end if;
 if marker is distinct from p->>'preview_marker' then raise exception 'Contact preview is stale'; end if;
 if route is not null and (r.source_id is distinct from source or r.manual_origin is distinct from origin
  or (src='MANUAL_OPERATIONAL' and r.accountable_manager_id is distinct from accountable)) then raise exception 'Contact publication denied'; end if;
 -- Serialise all publications in the same exact context and purpose, including separate route IDs.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(k||':'||target::text||':'||purpose,22));
 if exists(select 1 from public.operational_contact_routes_22b other
  join public.operational_contact_versions_22b v on v.id=other.current_version_id
  where other.context_kind=k and other.context_id=target and other.purpose=purpose
   and other.state='PUBLISHED' and other.id is distinct from route and v.priority=prio
   and tstzrange(v.effective_from,v.effective_until,'[)') && tstzrange(effective_start,effective_end,'[)')
   and private.contact_windows_overlap_22b(v.london_start,v.london_end,local_start,local_end))
 then raise exception 'Contact priority conflict'; end if;
 perform set_config('kss.contact_write_22b','allowed',true);
 if route is null then
  insert into public.operational_contact_routes_22b(context_kind,context_id,purpose,source_type,source_id,manual_origin,accountable_manager_id,created_by)
  values(k,target,purpose,src,source,origin,accountable,actor) returning id into route;
 end if;
 insert into public.operational_contact_versions_22b(route_id,version,display_name,role_organisation,phone,email,
  priority,effective_from,effective_until,london_start,london_end,reviewed_on,source_marker,published_by,reason)
 values(route,coalesce(r.revision+1,1),nm,descriptor,tel,mail,prio,effective_start,effective_end,local_start,local_end,
  review_date,marker,actor,reason) returning id into next_version;
 update public.operational_contact_routes_22b set current_version_id=next_version,
  revision=case when prior is null then 1 else revision+1 end where id=route;
 insert into public.operational_contact_events_22b(route_id,action,old_version_id,new_version_id,actor_person_id,reason)
 values(route,action,prior,next_version,actor,reason);
 return route;
end $$;
