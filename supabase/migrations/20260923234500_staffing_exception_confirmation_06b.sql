-- Explicit guarded confirmation for high demand, unusually long shifts, and early reporting.
-- The first guarded functions remain internal implementation helpers, not authenticated RPCs.
revoke execute on function public.staffing_create(uuid,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text,boolean) from authenticated;
revoke execute on function public.staffing_amend(uuid,uuid,integer,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text,boolean) from authenticated;

create function public.staffing_create_confirmed(p_event uuid,p_role uuid,p_quantity integer,p_report timestamptz,
 p_start timestamptz,p_end timestamptz,p_area text,p_instructions text,p_reason text,
 p_confirm_duplicate boolean,p_confirm_exception boolean) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if (p_quantity>100 or p_end>p_start+interval '24 hours' or p_report<p_start-interval '12 hours') and
   p_confirm_exception is distinct from true then raise exception 'Unusual staffing requirement needs explicit confirmation'; end if;
 return public.staffing_create(p_event,p_role,p_quantity,p_report,p_start,p_end,p_area,p_instructions,p_reason,p_confirm_duplicate);
end $$;
revoke all on function public.staffing_create_confirmed(uuid,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.staffing_create_confirmed(uuid,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean) to authenticated;

create function public.staffing_amend_confirmed(p_event uuid,p_requirement uuid,p_expected_revision integer,p_role uuid,p_quantity integer,
 p_report timestamptz,p_start timestamptz,p_end timestamptz,p_area text,p_instructions text,p_reason text,
 p_confirm_duplicate boolean,p_confirm_exception boolean) returns integer
language plpgsql security definer set search_path='' as $$
begin
 if (p_quantity>100 or p_end>p_start+interval '24 hours' or p_report<p_start-interval '12 hours') and
   p_confirm_exception is distinct from true then raise exception 'Unusual staffing requirement needs explicit confirmation'; end if;
 return public.staffing_amend(p_event,p_requirement,p_expected_revision,p_role,p_quantity,p_report,p_start,p_end,p_area,p_instructions,p_reason,p_confirm_duplicate);
end $$;
revoke all on function public.staffing_amend_confirmed(uuid,uuid,integer,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.staffing_amend_confirmed(uuid,uuid,integer,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean) to authenticated;
