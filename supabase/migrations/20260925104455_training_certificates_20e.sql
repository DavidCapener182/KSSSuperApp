-- TASK-20E synthetic Development only. A certificate is a separate, explicit manager decision.
-- The private bucket has no authenticated object policy; PDF bytes move through the 19A server boundary.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('training-certificates','training-certificates',false,1048576,array['application/pdf']);

create table public.training_certificate_template_versions (
 id uuid primary key default gen_random_uuid(), version_number integer not null unique check(version_number>0),
 title text not null check(length(trim(title)) between 3 and 32),
 issuer_label text not null check(length(trim(issuer_label)) between 3 and 40),
 statement text not null check(length(trim(statement)) between 10 and 180),
 template_hash text not null check(template_hash ~ '^[0-9a-f]{64}$'),
 published_by uuid not null references public.people(id), published_at timestamptz not null default now()
);
create table public.training_certificate_issues (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique default ('KSS-T-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20))),
 completion_id uuid not null references public.training_completions(id),
 assignment_id uuid not null references public.training_assignments(id),
 person_id uuid not null references public.people(id),
 course_version_id uuid not null references public.training_course_versions(id),
 rule_version_id uuid not null references public.training_completion_rule_versions(id),
 template_version_id uuid not null references public.training_certificate_template_versions(id),
 issued_by uuid not null references public.people(id), issued_at timestamptz not null default now(),
 issue_date date not null, validity_months integer, expiry_on date,
 reason text not null check(length(trim(reason)) between 10 and 300),
 reissue_of uuid references public.training_certificate_issues(id),
 state text not null default 'PENDING' check(state in ('PENDING','ISSUED','FAILED','REVOKED')),
 object_key text not null unique,
 pdf_sha256 text check(pdf_sha256 ~ '^[0-9a-f]{64}$'), pdf_bytes integer check(pdf_bytes between 1 and 1048576),
 finalised_at timestamptz, revoked_by uuid references public.people(id), revoked_at timestamptz,
 revoke_reason text check(revoke_reason is null or length(trim(revoke_reason)) between 10 and 300),
 check ((state='PENDING' and pdf_sha256 is null and pdf_bytes is null and finalised_at is null and revoked_at is null)
   or (state='FAILED' and pdf_sha256 is null and pdf_bytes is null and finalised_at is null and revoked_at is null)
   or (state='ISSUED' and pdf_sha256 is not null and pdf_bytes is not null and finalised_at is not null and revoked_at is null)
   or (state='REVOKED' and pdf_sha256 is not null and pdf_bytes is not null and finalised_at is not null and revoked_at is not null
       and revoked_by is not null and revoke_reason is not null)),
 check ((validity_months is null and expiry_on is null) or (validity_months between 1 and 120 and expiry_on is not null))
);
create unique index training_certificate_one_live_issue on public.training_certificate_issues(completion_id)
 where state in ('PENDING','ISSUED');
create unique index training_certificate_one_reissue on public.training_certificate_issues(reissue_of)
 where reissue_of is not null and state<>'FAILED';
create index training_certificate_person_history on public.training_certificate_issues(person_id,issued_at desc);
create table public.training_certificate_events (
 id uuid primary key default gen_random_uuid(), issue_id uuid not null references public.training_certificate_issues(id),
 actor_person_id uuid not null references public.people(id),
 action text not null check(action in ('RESERVED','ISSUED','FAILED','REVOKED')),
 reason text, occurred_at timestamptz not null default now()
);
create table public.training_certificate_requests (
 actor_person_id uuid not null references public.people(id), request_key uuid not null,
 action text not null, payload_hash text not null, result jsonb,
 created_at timestamptz not null default now(), primary key(actor_person_id,request_key)
);
alter table public.training_certificate_template_versions enable row level security;
alter table public.training_certificate_issues enable row level security;
alter table public.training_certificate_events enable row level security;
alter table public.training_certificate_requests enable row level security;
revoke all on public.training_certificate_template_versions,public.training_certificate_issues,
 public.training_certificate_events,public.training_certificate_requests from public,anon,authenticated;

create trigger training_certificate_template_seal before update or delete on public.training_certificate_template_versions
 for each row execute function private.training_completion_seal();
create trigger training_certificate_event_seal before update or delete on public.training_certificate_events
 for each row execute function private.training_completion_seal();
create function private.training_certificate_issue_seal() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or
 (new.id,new.reference,new.completion_id,new.assignment_id,new.person_id,new.course_version_id,
  new.rule_version_id,new.template_version_id,new.issued_by,new.issued_at,new.issue_date,
  new.validity_months,new.expiry_on,new.reason,new.reissue_of,new.object_key) is distinct from
 (old.id,old.reference,old.completion_id,old.assignment_id,old.person_id,old.course_version_id,
  old.rule_version_id,old.template_version_id,old.issued_by,old.issued_at,old.issue_date,
  old.validity_months,old.expiry_on,old.reason,old.reissue_of,old.object_key) or
 not ((old.state='PENDING' and new.state in ('ISSUED','FAILED')) or
      (old.state='ISSUED' and new.state='REVOKED')) then
  raise exception 'Certificate issue immutable';
 end if;
 return new;
end $$;
create trigger training_certificate_issue_seal before update or delete on public.training_certificate_issues
 for each row execute function private.training_certificate_issue_seal();

create function private.training_certificate_request(p_actor uuid,p_key uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h text:=encode(extensions.digest(p_payload::text,'sha256'),'hex'); r public.training_certificate_requests%rowtype;
begin
 if p_actor is null or p_key is null then raise exception 'Certificate request denied'; end if;
 insert into public.training_certificate_requests(actor_person_id,request_key,action,payload_hash)
 values(p_actor,p_key,p_action,h) on conflict do nothing;
 select * into r from public.training_certificate_requests where actor_person_id=p_actor and request_key=p_key for update;
 if r.action<>p_action or r.payload_hash<>h then raise exception 'Changed certificate request replay'; end if;
 return r.result;
end $$;

create function public.training_certificate_publish_template(p_title text,p_issuer_label text,p_statement text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); n integer; result uuid; payload jsonb;
begin
 if actor is null or not private.has_active_role('OFFICE_ADMIN') or not exists
 (select 1 from public.training_capability_grants g where g.person_id=actor and g.capability='TRAINING_PUBLISHER' and g.revoked_at is null)
 or length(trim(coalesce(p_title,''))) not between 3 and 32 or
 length(trim(coalesce(p_issuer_label,''))) not between 3 and 40 or
 length(trim(coalesce(p_statement,''))) not between 10 and 180 then raise exception 'Template publication denied'; end if;
 perform pg_advisory_xact_lock(hashtext('training_certificate_template_versions'));
 select coalesce(max(version_number),0)+1 into n from public.training_certificate_template_versions;
 payload:=jsonb_build_object('version',n,'title',trim(p_title),'issuerLabel',trim(p_issuer_label),'statement',trim(p_statement));
 insert into public.training_certificate_template_versions(version_number,title,issuer_label,statement,template_hash,published_by)
 values(n,trim(p_title),trim(p_issuer_label),trim(p_statement),encode(extensions.digest(payload::text,'sha256'),'hex'),actor)
 returning id into result;
 return result;
end $$;

create function public.training_certificate_templates() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if private.current_person_id() is null or not (private.training_completion_manager() or
  (private.has_active_role('OFFICE_ADMIN') and exists(select 1 from public.training_capability_grants g
   where g.person_id=private.current_person_id() and g.capability='TRAINING_PUBLISHER' and g.revoked_at is null)))
 then raise exception 'Template access denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'version',t.version_number,'title',t.title,
  'issuerLabel',t.issuer_label,'statement',t.statement,'hash',t.template_hash,'publishedAt',t.published_at)
  order by t.version_number desc),'[]'::jsonb) into result from public.training_certificate_template_versions t;
 return result;
end $$;

create function public.training_certificate_issue_begin(p_completion uuid,p_template uuid,p_request uuid,p_reissue_of uuid,p_reason text,p_proof text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); replay jsonb; c public.training_completions%rowtype;
 r public.training_completion_rule_versions%rowtype; t public.training_certificate_template_versions%rowtype;
 v public.training_course_versions%rowtype; person_name text; previous public.training_certificate_issues%rowtype;
 issue public.training_certificate_issues%rowtype; payload jsonb; london_date date; issue_id uuid:=gen_random_uuid();
begin
 if not private.training_completion_manager() or p_request is null or
 length(trim(coalesce(p_reason,''))) not between 10 and 300 or
 not private.valid_document_server_proof(concat_ws(chr(31),'certificate_begin',p_completion::text,p_template::text,
  p_request::text,coalesce(p_reissue_of::text,''),trim(p_reason)),p_proof)
 then raise exception 'Certificate issue denied'; end if;
 payload:=jsonb_build_object('completion',p_completion,'template',p_template,'reissueOf',p_reissue_of,'reason',trim(p_reason));
 replay:=private.training_certificate_request(actor,p_request,'ISSUE',payload);
 if replay is not null then
  select * into issue from public.training_certificate_issues where id=(replay->>'issueId')::uuid;
  return replay || jsonb_build_object('state',issue.state);
 end if;
 select * into c from public.training_completions where id=p_completion for update;
 select * into t from public.training_certificate_template_versions where id=p_template;
 if c.id is null or c.voided_at is not null or t.id is null then raise exception 'Completion or template unavailable'; end if;
 if p_reissue_of is not null then
  select * into previous from public.training_certificate_issues where id=p_reissue_of;
  if previous.id is null or previous.completion_id<>c.id or previous.state<>'REVOKED' or
   exists(select 1 from public.training_certificate_issues i where i.reissue_of=previous.id and i.state<>'FAILED')
  then raise exception 'Reissue source unavailable'; end if;
 else
  if exists(select 1 from public.training_certificate_issues i where i.completion_id=c.id and i.state<>'FAILED')
  then raise exception 'Existing issue requires reasoned reissue'; end if;
 end if;
 select * into r from public.training_completion_rule_versions where id=c.rule_version_id;
 select * into v from public.training_course_versions where id=c.course_version_id;
 select display_name into person_name from public.people where id=c.person_id;
 london_date:=(c.completed_at at time zone 'Europe/London')::date;
 insert into public.training_certificate_issues(id,completion_id,assignment_id,person_id,course_version_id,rule_version_id,
  template_version_id,issued_by,issue_date,validity_months,expiry_on,reason,reissue_of,object_key)
 values(issue_id,c.id,c.assignment_id,c.person_id,c.course_version_id,c.rule_version_id,t.id,actor,
  (now() at time zone 'Europe/London')::date,r.validity_months,
  case when r.validity_months is null then null else (london_date+make_interval(months=>r.validity_months))::date end,
  trim(p_reason),p_reissue_of,c.person_id::text||'/'||issue_id::text) returning * into issue;
 insert into public.training_certificate_events(issue_id,actor_person_id,action,reason)
 values(issue.id,actor,'RESERVED',trim(p_reason));
 replay:=jsonb_build_object('issueId',issue.id,'reference',issue.reference,'completionId',c.id,'assignmentId',c.assignment_id,
  'personName',person_name,'courseTitle',v.title,'courseVersion',v.version_number,
  'templateTitle',t.title,'issuerLabel',t.issuer_label,'statement',t.statement,
  'templateVersion',t.version_number,'templateHash',t.template_hash,
  'issuedAt',issue.issued_at,'issueDate',issue.issue_date,'expiryOn',issue.expiry_on,
  'objectKey',c.person_id::text||'/'||issue.id::text,'state','PENDING');
 update public.training_certificate_requests set result=replay where actor_person_id=actor and request_key=p_request;
 return replay;
end $$;

create function public.training_certificate_issue_finish(p_issue uuid,p_sha256 text,p_bytes integer,p_proof text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); issue public.training_certificate_issues%rowtype; result jsonb;
begin
 if not private.training_completion_manager() or p_sha256 !~ '^[0-9a-f]{64}$' or p_bytes not between 1 and 1048576 or
 not private.valid_document_server_proof(concat_ws(chr(31),'certificate_finish',p_issue::text,p_sha256,p_bytes::text),p_proof)
 then raise exception 'Certificate finalisation denied'; end if;
 select * into issue from public.training_certificate_issues where id=p_issue for update;
 if issue.id is null or issue.issued_by<>actor then raise exception 'Issue unavailable'; end if;
 if issue.state='ISSUED' and issue.pdf_sha256=p_sha256 and issue.pdf_bytes=p_bytes then
  return jsonb_build_object('issueId',issue.id,'reference',issue.reference,'state','ISSUED'); end if;
 if issue.state<>'PENDING' or exists(select 1 from public.training_completions c where c.id=issue.completion_id and c.voided_at is not null)
 or not exists(select 1 from storage.objects o where o.bucket_id='training-certificates' and o.name=issue.object_key
  and o.metadata->>'mimetype'='application/pdf' and (o.metadata->>'size')::integer=p_bytes)
 then raise exception 'Issue unavailable or PDF not stored'; end if;
 update public.training_certificate_issues set state='ISSUED',pdf_sha256=p_sha256,pdf_bytes=p_bytes,finalised_at=now()
 where id=issue.id;
 insert into public.training_certificate_events(issue_id,actor_person_id,action)
 values(issue.id,actor,'ISSUED');
 return jsonb_build_object('issueId',issue.id,'reference',issue.reference,'state','ISSUED');
end $$;

create function public.training_certificate_issue_fail(p_issue uuid,p_proof text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); issue public.training_certificate_issues%rowtype;
begin
 if not private.training_completion_manager() or
 not private.valid_document_server_proof(concat_ws(chr(31),'certificate_fail',p_issue::text),p_proof)
 then raise exception 'Failure record denied'; end if;
 select * into issue from public.training_certificate_issues where id=p_issue for update;
 if issue.id is null or issue.state<>'PENDING' or
  (issue.issued_by<>actor and issue.issued_at>now()-interval '10 minutes')
 then raise exception 'Issue unavailable'; end if;
 update public.training_certificate_issues set state='FAILED' where id=issue.id;
 insert into public.training_certificate_events(issue_id,actor_person_id,action) values(issue.id,actor,'FAILED');
end $$;

create function public.training_certificate_revoke(p_issue uuid,p_reason text,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); issue public.training_certificate_issues%rowtype; replay jsonb;
begin
 if not private.training_completion_manager() or length(trim(coalesce(p_reason,''))) not between 10 and 300
 then raise exception 'Revocation denied'; end if;
 replay:=private.training_certificate_request(actor,p_request,'REVOKE',jsonb_build_object('issue',p_issue,'reason',trim(p_reason)));
 if replay is not null then return replay; end if;
 select * into issue from public.training_certificate_issues where id=p_issue for update;
 if issue.id is null or issue.state<>'ISSUED' then raise exception 'Current certificate unavailable'; end if;
 update public.training_certificate_issues set state='REVOKED',revoked_by=actor,revoked_at=now(),revoke_reason=trim(p_reason)
 where id=issue.id;
 insert into public.training_certificate_events(issue_id,actor_person_id,action,reason)
 values(issue.id,actor,'REVOKED',trim(p_reason));
 replay:=jsonb_build_object('issueId',issue.id,'assignmentId',issue.assignment_id,'state','REVOKED');
 update public.training_certificate_requests set result=replay where actor_person_id=actor and request_key=p_request;
 return replay;
end $$;

create function public.training_certificate_history(p_assignment uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); a public.training_assignments%rowtype; manager_view boolean:=false; result jsonb;
begin
 select * into a from public.training_assignments where id=p_assignment;
 if actor is null or a.id is null then raise exception 'Certificate history unavailable'; end if;
 if a.person_id<>actor then
  if not private.training_completion_manager() then raise exception 'Certificate history unavailable'; end if;
  manager_view:=true;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'reference',i.reference,'completionId',i.completion_id,
  'courseVersionId',i.course_version_id,'ruleVersionId',i.rule_version_id,'templateVersionId',i.template_version_id,
  'issuedAt',i.issued_at,'issueDate',i.issue_date,'validityMonths',i.validity_months,'expiryOn',i.expiry_on,
  'reissueOf',i.reissue_of,'state',case when c.voided_at is not null and i.state='ISSUED' then 'COMPLETION_VOIDED' else i.state end,
  'current',i.state='ISSUED' and c.voided_at is null,'revokedAt',i.revoked_at,
  'events',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'occurredAt',e.occurred_at) ||
   case when manager_view then jsonb_build_object('actorPersonId',e.actor_person_id,'reason',e.reason) else '{}'::jsonb end
   order by e.occurred_at,e.id) from public.training_certificate_events e where e.issue_id=i.id),'[]'::jsonb) ||
   case when c.voided_at is not null then jsonb_build_array(jsonb_build_object('action','COMPLETION_VOIDED',
    'occurredAt',c.voided_at) || case when manager_view then jsonb_build_object('actorPersonId',c.voided_by,
    'reason',c.void_reason) else '{}'::jsonb end) else '[]'::jsonb end) ||
  case when manager_view then jsonb_build_object('issuedBy',i.issued_by,'reason',i.reason,
    'revokedBy',i.revoked_by,'revokeReason',i.revoke_reason) else '{}'::jsonb end
  order by i.issued_at desc,i.id),'[]'::jsonb) into result
 from public.training_certificate_issues i join public.training_completions c on c.id=i.completion_id
 where i.assignment_id=a.id and (i.state in ('ISSUED','REVOKED') or (manager_view and i.state='PENDING'));
 return result;
end $$;

create function public.training_certificate_file_info(p_issue uuid,p_proof text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); i public.training_certificate_issues%rowtype; c public.training_completions%rowtype;
begin
 if actor is null or not private.valid_document_server_proof(concat_ws(chr(31),'certificate_file_info',p_issue::text),p_proof)
 then raise exception 'Certificate file unavailable'; end if;
 select * into i from public.training_certificate_issues where id=p_issue;
 if i.id is null or i.state<>'ISSUED' or (i.person_id<>actor and not private.training_completion_manager())
 then raise exception 'Certificate file unavailable'; end if;
 select * into c from public.training_completions where id=i.completion_id;
 if c.voided_at is not null then raise exception 'Certificate file unavailable'; end if;
 return jsonb_build_object('issueId',i.id,'objectKey',i.object_key,'sha256',i.pdf_sha256,'bytes',i.pdf_bytes);
end $$;

revoke all on function private.training_certificate_issue_seal(),private.training_certificate_request(uuid,uuid,text,jsonb)
 from public,anon,authenticated;
revoke all on function public.training_certificate_publish_template(text,text,text),public.training_certificate_templates(),
 public.training_certificate_issue_begin(uuid,uuid,uuid,uuid,text,text),public.training_certificate_issue_finish(uuid,text,integer,text),
 public.training_certificate_issue_fail(uuid,text),public.training_certificate_revoke(uuid,text,uuid),
 public.training_certificate_history(uuid),public.training_certificate_file_info(uuid,text) from public,anon,authenticated;
grant execute on function public.training_certificate_publish_template(text,text,text),public.training_certificate_templates(),
 public.training_certificate_issue_begin(uuid,uuid,uuid,uuid,text,text),public.training_certificate_issue_finish(uuid,text,integer,text),
 public.training_certificate_issue_fail(uuid,text),public.training_certificate_revoke(uuid,text,uuid),
 public.training_certificate_history(uuid),public.training_certificate_file_info(uuid,text) to authenticated;
