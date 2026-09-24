-- A team with unresolved leave must keep its approver path until a separate
-- reassignment/closure policy exists. Terminal history may remain on an inactive team.
create function private.time_away_open_team_guard_17b() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.active and not new.active and exists(select 1 from public.time_away_requests r
  where r.team_id=old.id and r.state in ('SUBMITTED','APPROVED','CANCELLATION_REQUESTED'))
 then raise exception 'Time Away team has unresolved requests'; end if;
 return new;
end $$;
create trigger guard_time_away_open_team before update on public.time_away_teams
 for each row execute function private.time_away_open_team_guard_17b();
revoke all on function private.time_away_open_team_guard_17b() from public,anon,authenticated;
