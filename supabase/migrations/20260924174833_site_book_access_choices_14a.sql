-- TASK-14A bounded grant administration choices, synthetic Dev only.
create function public.site_book_grant_choices_14a() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_person_id(); services jsonb; people jsonb;
begin
 if actor is null or not (private.has_active_role('SUPER_ADMIN') or private.has_active_role('OFFICE_ADMIN')) then raise exception 'Book grant choices denied'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'siteName',t.name) order by t.name,s.name),'[]'::jsonb) into services
 from public.site_services s join public.sites t on t.id=s.site_id
 where private.has_active_role('SUPER_ADMIN') or private.office_owns_site(s.site_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'role',r.role_code) order by p.display_name,p.id),'[]'::jsonb) into people
 from public.people p join public.role_assignments r on r.person_id=p.id
 where r.role_code in ('SECURITY_STAFF','OPERATIONS') and r.revoked_at is null and r.effective_from<=transaction_timestamp()
  and (r.effective_until is null or r.effective_until>transaction_timestamp());
 return jsonb_build_object('services',services,'people',people);
end $$;
revoke all on function public.site_book_grant_choices_14a() from public,anon,authenticated;
grant execute on function public.site_book_grant_choices_14a() to authenticated;
