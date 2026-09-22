import type { SupabaseClient } from "@supabase/supabase-js";

export const ROLE_CODES = ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS", "SECURITY_STAFF"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];
export type Principal = { userId: string; personId: string; displayName: string; roles: RoleCode[] };
export type EnterpriseAccess =
  | { state: "unauthenticated" | "unmapped" | "no_active_role" | "unavailable" }
  | { state: "active"; principal: Principal };

type Identity = { person_id: string };
type RoleAssignment = { role_code: RoleCode; effective_from: string; effective_until: string | null; revoked_at: string | null };

export async function getEnterpriseAccess(client: SupabaseClient): Promise<EnterpriseAccess> {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return { state: "unauthenticated" };

  const { data: identity, error: identityError } = await client
    .from("auth_identities")
    .select("person_id")
    .eq("provider", "supabase")
    .eq("provider_subject", auth.user.id)
    .eq("active", true)
    .maybeSingle<Identity>();
  if (identityError) return { state: "unavailable" };
  if (!identity) return { state: "unmapped" };

  // Roles are fetched from the database on every request; JWT metadata is never authoritative.
  const { data: assignments, error: roleError } = await client
    .from("role_assignments")
    .select("role_code,effective_from,effective_until,revoked_at")
    .eq("person_id", identity.person_id)
    .returns<RoleAssignment[]>();
  if (roleError || !assignments) return { state: "unavailable" };
  const now = Date.now();
  const roles = [...new Set(assignments
    .filter((a) => !a.revoked_at && Date.parse(a.effective_from) <= now && (!a.effective_until || Date.parse(a.effective_until) > now))
    .map((a) => a.role_code)
    .filter((role): role is RoleCode => ROLE_CODES.includes(role)))];
  if (roles.length === 0) return { state: "no_active_role" };

  const { data: person, error: personError } = await client
    .from("people").select("id,display_name").eq("id", identity.person_id)
    .maybeSingle<{ id: string; display_name: string }>();
  if (personError || !person) return { state: "unavailable" };
  return { state: "active", principal: { userId: auth.user.id, personId: person.id, displayName: person.display_name, roles } };
}

export async function getPrincipal(client: SupabaseClient): Promise<Principal | null> {
  const access = await getEnterpriseAccess(client);
  return access.state === "active" ? access.principal : null;
}

export function hasRole(principal: Principal, role: RoleCode) {
  return principal.roles.includes(role);
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
