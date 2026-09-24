-- TASK-18A: reasoned link correction; source records and old links stay intact.
alter table public.mobilisation_links drop constraint mobilisation_links_mobilisation_id_source_type_source_id_key;
create unique index mobilisation_one_current_source_idx on public.mobilisation_links(mobilisation_id,source_type,source_id) where unlinked_at is null;
create function public.mobilisation_unlink(p_id uuid,p_link uuid,p_expected integer,p_reason text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); m public.mobilisations%rowtype; l public.mobilisation_links%rowtype;
 old_request public.mobilisation_requests%rowtype; digest text; result jsonb;
begin
 if actor is null or not private.crm_authorised() or p_key is null or p_reason is null or length(trim(p_reason)) not between 3 and 500 or p_reason ~ '[[:cntrl:]]' then raise exception 'Link correction denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_key::text,0));
 digest:=md5(jsonb_build_array(p_id,p_link,p_expected,p_reason)::text);
 select * into old_request from public.mobilisation_requests where actor_person_id=actor and request_key=p_key;
 if found then if old_request.payload_hash<>digest then raise exception 'Idempotency key conflict'; end if; return old_request.result; end if;
 select * into m from public.mobilisations where id=p_id for update;
 if not found or m.status in ('HANDED_OVER','CANCELLED') or m.revision<>p_expected then raise exception 'Stale or terminal mobilisation'; end if;
 select * into l from public.mobilisation_links where id=p_link and mobilisation_id=p_id and unlinked_at is null for update;
 if not found then raise exception 'Current link not found'; end if;
 update public.mobilisation_links set unlinked_at=transaction_timestamp() where id=p_link;
 update public.mobilisations set revision=revision+1,updated_at=transaction_timestamp() where id=p_id;
 insert into public.mobilisation_history(mobilisation_id,kind,actor_person_id,revision,subject_id,after_value,reason)
 values(p_id,'LINK',actor,m.revision+1,p_link,jsonb_build_object('sourceType',l.source_type,'sourceId',l.source_id,'unlinked',true),trim(p_reason));
 result:=jsonb_build_object('id',p_id,'revision',m.revision+1,'linkId',p_link);
 insert into public.mobilisation_requests(actor_person_id,request_key,payload_hash,result) values(actor,p_key,digest,result);
 return result;
end $$;
revoke all on function public.mobilisation_unlink(uuid,uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.mobilisation_unlink(uuid,uuid,integer,text,uuid) to authenticated;
