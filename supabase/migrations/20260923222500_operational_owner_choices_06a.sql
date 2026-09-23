-- Eligible Event owners are an operational projection, independent of CRM/People-private access.
create function public.operational_owner_choices() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.operational_authorised() then raise exception 'Operational read denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by p.display_name,p.id),'[]'::jsonb)
 into result from public.people p where exists(select 1 from public.role_assignments r where r.person_id=p.id
 and r.role_code in ('OFFICE_ADMIN','OPERATIONS') and r.revoked_at is null and r.effective_from<=now()
 and (r.effective_until is null or r.effective_until>now()));
 return result;
end $$;
revoke all on function public.operational_owner_choices() from public,anon,authenticated;
grant execute on function public.operational_owner_choices() to authenticated;
