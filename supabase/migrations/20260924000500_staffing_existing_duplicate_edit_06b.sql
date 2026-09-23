-- A line deliberately created alongside an identical line can change quantity without reconfirming its unchanged identity.
do $$
declare source text;
begin
 select pg_get_functiondef('public.staffing_amend(uuid,uuid,integer,uuid,integer,timestamptz,timestamptz,timestamptz,text,text,text,boolean)'::regprocedure) into source;
 if position('if not p_confirm_duplicate and exists(' in source)=0 then raise exception 'Expected staffing amend guard not found'; end if;
 execute replace(source,
  'if not p_confirm_duplicate and exists(',
  'if not p_confirm_duplicate and (old.role_id is distinct from p_role or old.service_date is distinct from day or old.report_at is distinct from p_report or old.shift_starts_at is distinct from p_start or old.shift_ends_at is distinct from p_end or lower(trim(old.area_label)) is distinct from lower(trim(p_area))) and exists(');
end $$;
