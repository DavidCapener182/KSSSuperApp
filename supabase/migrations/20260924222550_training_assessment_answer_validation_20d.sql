-- TASK-20D remove ambiguous unused PL/pgSQL variable.
create or replace function private.training_assessment_answers_valid(p_questions jsonb,p_answers jsonb,p_required boolean) returns boolean
 language plpgsql set search_path='' as $$
declare item record; q jsonb; choice jsonb; used text[]; valid_ids text[]; count_answers integer:=0;
begin
 if jsonb_typeof(p_answers)<>'object' then return false; end if;
 for item in select key,value from jsonb_each(p_answers) loop
  select x into q from jsonb_array_elements(p_questions) x where x->>'id'=item.key;
  if q is null or jsonb_typeof(item.value)<>'array' or jsonb_array_length(item.value)<1 then return false; end if;
  used:='{}'; valid_ids:=array(select x->>'id' from jsonb_array_elements(q->'options') x);
  for choice in select x from jsonb_array_elements(item.value) x loop
   if jsonb_typeof(choice)<>'string' or choice#>>'{}'=any(used) or
    not choice#>>'{}'=any(valid_ids) then return false; end if;
   used:=array_append(used,choice#>>'{}');
  end loop;
  if q->>'type'='SINGLE' and cardinality(used)<>1 then return false; end if;
  count_answers:=count_answers+1;
 end loop;
 return not p_required or count_answers=jsonb_array_length(p_questions);
end $$;
