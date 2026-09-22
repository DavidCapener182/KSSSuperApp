import type { SupabaseClient } from "@supabase/supabase-js";
import { hasRole, type Principal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";

export type Site = {
  id: string;
  site_reference: string;
  name: string;
  address_line1: string;
  town_city: string;
  postcode: string;
  reporting_point: string;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  created_by_person_id: string;
  created_at: string;
  updated_at: string;
};

export const SITE_COLUMNS = "id,site_reference,name,address_line1,town_city,postcode,reporting_point,status,created_by_person_id,created_at,updated_at";
export const PUBLIC_SITE_FIELDS = "id,site_reference,name,address_line1,town_city,postcode,reporting_point,status";

export function canUseSites(principal: Principal) {
  return hasCapability(principal, "SITES_VIEW");
}

export function canManageSite(principal: Principal, site: Site) {
  return hasRole(principal, "SUPER_ADMIN") ||
    (hasRole(principal, "OFFICE_ADMIN") && site.created_by_person_id === principal.personId);
}

export async function canViewSite(client: SupabaseClient, principal: Principal, site: Site) {
  if (canManageSite(principal, site)) return true;
  if (!hasRole(principal, "SECURITY_STAFF") || site.status !== "ACTIVE") return false;
  const { data, error } = await client.from("site_assignments")
    .select("effective_from,effective_until,revoked_at")
    .eq("site_id", site.id).eq("person_id", principal.personId);
  if (error || !data) return false;
  const now = Date.now();
  return data.some((row) => !row.revoked_at && Date.parse(row.effective_from) <= now &&
    (!row.effective_until || Date.parse(row.effective_until) > now));
}

export function parseSiteFields(value: unknown, create: boolean) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const fields = ["name", "address_line1", "town_city", "postcode", "reporting_point"] as const;
  const limits = { name: 120, address_line1: 160, town_city: 100, postcode: 20, reporting_point: 500 };
  const output: Partial<Record<(typeof fields)[number], string>> & { site_reference?: string; status?: string } = {};
  for (const field of fields) {
    if (body[field] === undefined && !create) continue;
    if (typeof body[field] !== "string" || !body[field].trim() || body[field].trim().length > limits[field]) return null;
    output[field] = body[field].trim();
  }
  if (create) {
    if (typeof body.site_reference !== "string" || !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(body.site_reference)) return null;
    output.site_reference = body.site_reference;
  } else if (body.site_reference !== undefined || body.created_by_person_id !== undefined || body.id !== undefined) {
    return null;
  }
  if (body.status !== undefined) {
    if (create || !["ACTIVE", "RETIRED"].includes(String(body.status))) return null;
    output.status = String(body.status);
  }
  return Object.keys(output).length ? output : null;
}
