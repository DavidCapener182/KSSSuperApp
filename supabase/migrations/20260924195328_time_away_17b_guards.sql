-- TASK-17B: keep exact submitted versions and authority history immutable even
-- for privileged accidental table writes. Guarded RPCs remain the only normal path.
create function private.guard_time_away_history_17b() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Time Away history is immutable'; end if;
 return new;
end $$;
create trigger guard_time_away_authority_history before update or delete on public.time_away_authority_events
 for each row execute function private.guard_time_away_history_17b();
create trigger guard_time_away_request_history before update or delete on public.time_away_request_events
 for each row execute function private.guard_time_away_history_17b();
create trigger guard_time_away_decision_history before update or delete on public.time_away_decisions
 for each row execute function private.guard_time_away_history_17b();

create function private.guard_time_away_authority_17b() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Time Away authority history cannot be deleted'; end if;
 if tg_op='INSERT' then return new; end if;
 if tg_table_name='time_away_teams' then
  if new.id<>old.id or new.name<>old.name or new.description is distinct from old.description
   or new.created_by<>old.created_by or new.created_at<>old.created_at
   or new.revision<>old.revision+1 or new.active=old.active
  then raise exception 'Invalid Time Away team revision'; end if;
 elsif tg_table_name='time_away_team_memberships' then
  if new.id<>old.id or new.team_id<>old.team_id or new.person_id<>old.person_id
   or new.effective_from<>old.effective_from or new.effective_until is distinct from old.effective_until
   or new.added_by<>old.added_by or new.reason<>old.reason or new.created_at<>old.created_at
   or new.revision<>old.revision+1 or old.revoked_at is not null or new.revoked_at is null
   or new.revoked_by is null
  then raise exception 'Invalid Time Away membership revision'; end if;
 elsif tg_table_name='time_away_approver_grants' then
  if new.id<>old.id or new.team_id<>old.team_id or new.person_id<>old.person_id
   or new.actions<>old.actions or new.effective_from<>old.effective_from
   or new.effective_until is distinct from old.effective_until or new.granted_by<>old.granted_by
   or new.reason<>old.reason or new.created_at<>old.created_at
   or old.revoked_at is not null or new.revoked_at is null or new.revoked_by is null
  then raise exception 'Invalid Time Away approver revocation'; end if;
 end if;
 return new;
end $$;
create trigger guard_time_away_teams before update or delete on public.time_away_teams
 for each row execute function private.guard_time_away_authority_17b();
create trigger guard_time_away_memberships before update or delete on public.time_away_team_memberships
 for each row execute function private.guard_time_away_authority_17b();
create trigger guard_time_away_grants before update or delete on public.time_away_approver_grants
 for each row execute function private.guard_time_away_authority_17b();

create function private.guard_time_away_request_17b() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Time Away request cannot be deleted'; end if;
 if tg_op='INSERT' then return new; end if;
 if new.id<>old.id or new.person_id<>old.person_id or new.created_at<>old.created_at
  or new.revision<>old.revision+1 or
  (old.state<>'DRAFT' and (new.team_id is distinct from old.team_id or
   new.category_code<>old.category_code or new.category_version<>old.category_version
   or new.category_label<>old.category_label or new.submitted_at is distinct from old.submitted_at))
  or (old.state='DRAFT' and new.state not in ('DRAFT','SUBMITTED'))
  or (new.state='DRAFT' and new.team_id is not null)
  or (new.state='SUBMITTED' and new.team_id is null)
  or (old.state='SUBMITTED' and new.state not in ('APPROVED','DECLINED','WITHDRAWN'))
  or (old.state='APPROVED' and new.state<>'CANCELLATION_REQUESTED')
  or (old.state='CANCELLATION_REQUESTED' and new.state not in ('APPROVED','CANCELLED'))
  or old.state in ('DECLINED','WITHDRAWN','CANCELLED')
 then raise exception 'Invalid Time Away request transition'; end if;
 return new;
end $$;
create trigger guard_time_away_requests before update or delete on public.time_away_requests
 for each row execute function private.guard_time_away_request_17b();

create function private.guard_time_away_segment_17b() returns trigger
language plpgsql security definer set search_path='' as $$
declare request_state text; target_request uuid;
begin
 if tg_op='UPDATE' then raise exception 'Time Away segment must be replaced through draft save'; end if;
 target_request:=case when tg_op='DELETE' then old.request_id else new.request_id end;
 select state into request_state from public.time_away_requests where id=target_request;
 if request_state<>'DRAFT' then raise exception 'Submitted Time Away segments are immutable'; end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger guard_time_away_segments before insert or update or delete on public.time_away_segments
 for each row execute function private.guard_time_away_segment_17b();

revoke all on function private.guard_time_away_history_17b(),private.guard_time_away_authority_17b(),
 private.guard_time_away_request_17b(),private.guard_time_away_segment_17b() from public,anon,authenticated;
