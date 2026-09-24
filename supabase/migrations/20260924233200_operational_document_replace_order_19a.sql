-- TASK-19A: close the old unique active target before inserting its exact replacement.
create or replace function public.operational_document_replace(old_assignment_ids uuid[],new_version uuid,
 replacement_at timestamptz,reason text) returns uuid[]
language plpgsql security definer set search_path='' as $$
declare a public.operational_document_assignments%rowtype; v public.controlled_document_versions%rowtype;
 result uuid[]:='{}'::uuid[]; created uuid; old_id uuid;
begin
 if not private.can_operational_document('ASSIGN') or old_assignment_ids is null
  or array_length(old_assignment_ids,1) not between 1 and 50
  or (select count(distinct x) from unnest(old_assignment_ids) x)<>array_length(old_assignment_ids,1)
  or replacement_at is null or replacement_at<now() or replacement_at>now()+interval '90 days'
  or reason is null or length(trim(reason)) not between 3 and 300 or reason ~ '[[:cntrl:]]'
 then raise exception 'Replacement denied'; end if;
 select * into v from public.controlled_document_versions where id=new_version;
 if v.state<>'PUBLISHED' or v.upload_state<>'READY' or v.effective_on>(replacement_at at time zone 'Europe/London')::date
  or not exists(select 1 from public.controlled_documents where id=v.document_id and family='OPERATIONAL_SYNTHETIC')
 then raise exception 'Replacement version unavailable'; end if;
 perform 1 from public.controlled_documents where id=v.document_id for update;
 perform set_config('kss.write_19a','allowed',true);
 foreach old_id in array old_assignment_ids loop
  select * into a from public.operational_document_assignments where id=old_id for update;
  if a.id is null or a.document_id<>v.document_id or a.version_id=v.id
   or a.closed_at is not null
   or (a.effective_until is not null and a.effective_until<=replacement_at)
   or a.effective_from>=replacement_at then raise exception 'Replacement source changed'; end if;
  created:=gen_random_uuid();
  update public.operational_document_assignments set closed_at=replacement_at,close_kind='REPLACED',
   replacement_id=created,closed_by_person_id=private.current_person_id(),close_reason=trim(reason)
   where id=a.id;
  insert into public.operational_document_assignments(id,document_id,version_id,target_kind,target_id,
   context_kind,context_id,required,effective_from,effective_until,created_by_person_id)
  values(created,a.document_id,v.id,a.target_kind,a.target_id,a.context_kind,a.context_id,a.required,replacement_at,
   a.effective_until,private.current_person_id());
  insert into public.operational_document_assignment_events(assignment_id,kind,actor_person_id,version_id,replacement_id,reason)
   values(a.id,'REPLACED',private.current_person_id(),a.version_id,created,trim(reason));
  insert into public.operational_document_assignment_events(assignment_id,kind,actor_person_id,version_id,reason)
   values(created,'ASSIGNED',private.current_person_id(),v.id,trim(reason));
  result:=array_append(result,created);
 end loop;
 return result;
end $$;
