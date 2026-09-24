-- TASK-19A: do not reveal private Storage keys through a directly callable Staff RPC.
drop function public.operational_document_file_info(uuid);
create function public.operational_document_file_info(assignment_id uuid,server_proof text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.operational_document_assignments%rowtype; v public.controlled_document_versions%rowtype;
begin
 if not private.valid_document_server_proof(concat_ws(chr(31),'operational_file_info',assignment_id::text),server_proof)
 then raise exception 'File unavailable'; end if;
 select * into a from public.operational_document_assignments where id=assignment_id;
 if a.id is null or not (private.can_operational_document('PUBLISH') or
  private.can_operational_document('ASSIGN') or
  (private.operational_document_current(a,private.current_person_id()) and
   exists(select 1 from public.operational_document_accesses x where x.assignment_id=a.id
    and x.person_id=private.current_person_id() and x.version_id=a.version_id)))
 then raise exception 'File unavailable'; end if;
 select * into v from public.controlled_document_versions where id=a.version_id;
 if v.upload_state<>'READY' then raise exception 'File unavailable'; end if;
 return jsonb_build_object('versionId',v.id,'objectKey',v.object_key,'sha256',v.sha256);
end $$;
revoke all on function public.operational_document_file_info(uuid,text) from public,anon,authenticated;
grant execute on function public.operational_document_file_info(uuid,text) to authenticated;
