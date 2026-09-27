import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal, RoleCode } from "@/lib/auth/principal";

export type RoleGrant = {
  id: string; role_code: RoleCode; effective_from: string; effective_until: string | null;
  revoked_at: string | null; granted_by: string | null;
};
export type SiteGrant = {
  id: string; site_id: string; effective_from: string; effective_until: string | null;
  revoked_at: string | null; granted_by: string | null; change_reason: string;
};
export type DomainGrant = {
  grantId: string; domain: string; capability: string; scopeKind: string;
  scopeId: string | null; scopeName: string;
  effectiveFrom: string; effectiveUntil: string | null;
  grantedBy: string | null; reason: string | null;
  revokedAt: string | null; revocationReason: string | null; sourceHref: string;
};
export type PersonAccessReview = {
  person: { id: string; displayName: string };
  roles: RoleGrant[];
  sites: (SiteGrant & { siteName: string; siteStatus: string })[];
  grantors: Record<string, string>;
  domainGrants: DomainGrant[];
};

/** Existing source reads only. This is not a permission decision or a grant ledger. */
export async function readPersonAccessReview(client: SupabaseClient, principal: Principal, personId: string): Promise<PersonAccessReview | null> {
  if (!principal.roles.includes("SUPER_ADMIN")) return null;
  const personRead = await client.from("people").select("id,display_name").eq("id", personId).maybeSingle<{ id: string; display_name: string }>();
  if (personRead.error || !personRead.data) return null;
  const person = personRead.data;

  const [roleRead, siteRead, domainRead] = await Promise.all([
    client.from("role_assignments").select("id,role_code,effective_from,effective_until,revoked_at,granted_by")
      .eq("person_id", personId).order("effective_from", { ascending: false }),
    client.from("site_assignments").select("id,site_id,effective_from,effective_until,revoked_at,granted_by,change_reason")
      .eq("person_id", personId).order("effective_from", { ascending: false }),
    client.rpc("person_domain_grants_review_10", { p_person: personId }),
  ]);
  if (roleRead.error || siteRead.error || domainRead.error || !Array.isArray(domainRead.data)) return null;
  const roles = roleRead.data as RoleGrant[];
  const siteRows = siteRead.data as SiteGrant[];
  const domainGrants = domainRead.data as DomainGrant[];
  const siteIds = [...new Set(siteRows.map((row) => row.site_id))];
  const grantorIds = [...new Set([
    ...roles.map((row) => row.granted_by), ...siteRows.map((row) => row.granted_by),
    ...domainGrants.map((row) => row.grantedBy),
  ].filter((id): id is string => Boolean(id)))];
  const [sitesRead, grantorsRead] = await Promise.all([
    siteIds.length ? client.from("sites").select("id,name,status").in("id", siteIds) : Promise.resolve({ data: [], error: null }),
    grantorIds.length ? client.from("people").select("id,display_name").in("id", grantorIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (sitesRead.error || grantorsRead.error) return null;
  const sitesById = new Map((sitesRead.data as { id: string; name: string; status: string }[]).map((site) => [site.id, site]));
  const grantors = Object.fromEntries((grantorsRead.data as { id: string; display_name: string }[]).map((row) => [row.id, row.display_name]));
  return {
    person: { id: person.id, displayName: person.display_name }, roles,
    sites: siteRows.map((row) => ({ ...row, siteName: sitesById.get(row.site_id)?.name ?? "Site unavailable", siteStatus: sitesById.get(row.site_id)?.status ?? "UNKNOWN" })),
    grantors, domainGrants,
  };
}
