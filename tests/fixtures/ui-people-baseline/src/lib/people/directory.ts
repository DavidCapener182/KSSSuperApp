import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal, RoleCode } from "@/lib/auth/principal";

export type DirectoryPerson = {
  id: string;
  displayName: string;
  roles: RoleCode[];
  sites: string[];
  onboardingState: "NONE" | "DRAFT" | "IN_PROGRESS";
  completed: number | null;
  totalRequirements: number | null;
  onboardingCaseId: string | null;
};
export type DirectoryResult = { total: number; items: DirectoryPerson[] };
export type DirectoryFilters = {
  search: string; role: string; onboarding: string; offset: number; limit: number;
};

const ROLES = new Set(["", "SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS", "SECURITY_STAFF"]);
const STATES = new Set(["", "NONE", "DRAFT", "IN_PROGRESS"]);

export function parseDirectoryFilters(params: URLSearchParams): DirectoryFilters | null {
  const search = params.get("search") ?? "";
  const role = params.get("role") ?? "";
  const onboarding = params.get("onboarding") ?? "";
  const offset = Number(params.get("offset") ?? "0");
  const limit = Number(params.get("limit") ?? "25");
  if (search.length > 100 || /[\x00-\x1f\x7f]/.test(search) || !ROLES.has(role) || !STATES.has(onboarding)
    || !Number.isInteger(offset) || offset < 0 || offset > 10000
    || !Number.isInteger(limit) || limit < 1 || limit > 50) return null;
  return { search, role, onboarding, offset, limit };
}

export function mayUseDirectory(principal: Principal): boolean {
  return principal.roles.some((role) => role === "SUPER_ADMIN" || role === "OFFICE_ADMIN" || role === "OPERATIONS" || role === "SECURITY_STAFF");
}

export async function readDirectory(client: SupabaseClient, principal: Principal,
  filters: DirectoryFilters, personId?: string): Promise<DirectoryResult | null> {
  if (!mayUseDirectory(principal)) return null;
  const { data, error } = await client.rpc("people_directory_04a", {
    requested_person: personId ?? null,
    search_text: filters.search,
    role_filter: filters.role,
    onboarding_filter: filters.onboarding,
    page_offset: filters.offset,
    page_size: filters.limit,
  });
  if (error || !data || typeof data !== "object") return null;
  return data as DirectoryResult;
}
