-- RLS evaluates this private helper as the authenticated role. The private
-- schema remains outside the Data API; the helper itself returns only boolean.
grant execute on function private.onboarding_owner_authorised(uuid,uuid) to authenticated;
