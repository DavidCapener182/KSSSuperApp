-- Exact Person assignment with the existing grant, revision and immutable history boundary.
create or replace function public.cw_issue_save(p_workspace uuid,p_issue uuid,p_revision integer,p_data jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.current_person_id(); old_row public.tfs_lp_issues%rowtype; new_row public.tfs_lp_issues%rowtype;
 v_store text := trim(coalesce(p_data->>'storeName','')); v_number text := nullif(trim(coalesce(p_data->>'storeNumber','')),'');
 v_region text := p_data->>'region'; v_owner text := trim(coalesce(p_data->>'owner',''));
 v_type text := p_data->>'type'; v_priority text := p_data->>'priority'; v_status text := p_data->>'status';
 v_evidence text := trim(coalesce(p_data->>'evidenceSummary','')); v_action text := trim(coalesce(p_data->>'nextAction',''));
 v_source text := nullif(trim(coalesce(p_data->>'sourceNote','')),''); v_date date; v_internal boolean; v_person uuid;
begin
 if not private.cw_access(p_workspace,'OPERATE') then raise exception 'Issue denied' using errcode='42501'; end if;
 if length(v_store) not between 1 and 160 or length(coalesce(v_number,''))>40 or coalesce(v_region,'') not in ('north','south','unassigned')
  or length(v_owner) not between 1 and 120 or coalesce(v_type,'') not in ('Stock loss','External theft','Tester orders','Stock discrepancy','Other')
  or coalesce(v_priority,'') not in ('Urgent','High','Review','Monitor')
  or coalesce(v_status,'') not in ('Needs triage','Investigating','Visit needed','Waiting on store','Monitoring','Closed')
  or length(v_evidence) not between 1 and 2000 or length(v_action) not between 1 and 1000
  or length(coalesce(v_source,''))>1000 or coalesce(p_data->>'potentialInternalTheftReview','') not in ('true','false')
  then raise exception 'Invalid issue' using errcode='23514'; end if;
 v_internal := (p_data->>'potentialInternalTheftReview')::boolean;
 if nullif(p_data->>'evidenceDate','') is not null then v_date := (p_data->>'evidenceDate')::date; end if;
 if p_issue is not null then
  select * into old_row from public.tfs_lp_issues where id=p_issue and workspace_id=p_workspace for update;
  if not found then raise exception 'Issue denied' using errcode='42501'; end if;
  if p_revision is distinct from old_row.revision then raise exception 'Issue changed; reload' using errcode='P0001'; end if;
  if length(trim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'Reason required' using errcode='23514'; end if;
 end if;
 if p_data ? 'ownerPersonId' then
  v_person := nullif(p_data->>'ownerPersonId','')::uuid;
  if v_person is not null and v_person is distinct from old_row.owner_person_id and not exists(select 1 from public.people p where p.id=v_person) then
   raise exception 'Owner Person unavailable' using errcode='23514';
  end if;
 else
  v_person := old_row.owner_person_id;
 end if;
 if p_issue is null then
  if p_revision is not null then raise exception 'Invalid revision' using errcode='23514'; end if;
  insert into public.tfs_lp_issues(workspace_id,store_name,store_number,source_region,source_owner,owner_person_id,issue_type,priority,status,evidence_date,evidence_summary,next_action,source_note,potential_internal_theft_review,created_by_person_id)
  values(p_workspace,v_store,v_number,v_region,v_owner,v_person,v_type,v_priority,v_status,v_date,v_evidence,v_action,v_source,v_internal,actor) returning * into new_row;
  insert into public.tfs_lp_issue_events(workspace_id,issue_id,revision,action,actor_person_id,after_value)
  values(p_workspace,new_row.id,1,'CREATED',actor,to_jsonb(new_row));
 else
  update public.tfs_lp_issues set store_name=v_store,store_number=v_number,source_region=v_region,source_owner=v_owner,owner_person_id=v_person,
   issue_type=v_type,priority=v_priority,status=v_status,evidence_date=v_date,evidence_summary=v_evidence,
   next_action=v_action,source_note=v_source,potential_internal_theft_review=v_internal,
   revision=revision+1,updated_at=now() where id=p_issue returning * into new_row;
  insert into public.tfs_lp_issue_events(workspace_id,issue_id,revision,action,actor_person_id,reason,before_value,after_value)
  values(p_workspace,p_issue,new_row.revision,'UPDATED',actor,trim(p_reason),to_jsonb(old_row),to_jsonb(new_row));
 end if;
 return new_row.id;
end; $$;

-- Assignment is a Person reference only; it creates no workspace grant.
create function public.cw_owner_choices(p_workspace uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.cw_access(p_workspace,'OPERATE') then raise exception 'Issue denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by p.display_name,p.id),'[]'::jsonb) into result
 from public.people p;
 return result;
end; $$;
revoke all on function public.cw_owner_choices(uuid) from public,anon;
grant execute on function public.cw_owner_choices(uuid) to authenticated;
