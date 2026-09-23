import { getPrincipal, hasRole } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canUseSites, parseSiteFields, PUBLIC_SITE_FIELDS, SITE_COLUMNS, type Site } from "@/lib/sites/policy";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canUseSites(principal)) return forbidden();
  if (!hasRole(principal, "SUPER_ADMIN") && !hasRole(principal, "OFFICE_ADMIN") && !hasRole(principal, "SECURITY_STAFF")) return forbidden();
  const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
  if (search.length > 80 || !/^[a-zA-Z0-9 -]*$/.test(search)) return privateJson({ error: "Invalid search" }, 400);
  let query = client.from("sites").select(SITE_COLUMNS, { count: "exact" }).order("name").limit(50);
  if (!hasRole(principal, "SUPER_ADMIN")) {
    const office = hasRole(principal, "OFFICE_ADMIN");
    let assignedIds: string[] = [];
    if (hasRole(principal, "SECURITY_STAFF")) {
      const now = new Date().toISOString();
      const { data: assignments, error: assignmentError } = await client.from("site_assignments")
        .select("site_id").eq("person_id", principal.personId).is("revoked_at", null)
        .lte("effective_from", now).or(`effective_until.is.null,effective_until.gt.${now}`);
      if (assignmentError) return privateJson({ error: "Unable to load Sites" }, 500);
      assignedIds = [...new Set((assignments ?? []).map((row) => row.site_id))];
    }
    if (office && assignedIds.length) query = query.or(`created_by_person_id.eq.${principal.personId},and(status.eq.ACTIVE,id.in.(${assignedIds.join(",")}))`);
    else if (office) query = query.eq("created_by_person_id", principal.personId);
    else if (assignedIds.length) query = query.eq("status", "ACTIVE").in("id", assignedIds);
    else return privateJson({ count: 0, sites: [] });
  }
  if (search) query = query.or(`name.ilike.%${search}%,site_reference.ilike.%${search}%`);
  const { data, error, count } = await query.returns<Site[]>();
  if (error || !data) return privateJson({ error: "Unable to load Sites" }, 500);
  return privateJson({ count: count ?? 0, sites: data.map((site) => ({
    id: site.id, siteReference: site.site_reference, name: site.name,
    townCity: site.town_city, status: site.status,
    canManage: hasRole(principal, "SUPER_ADMIN") ||
      (hasRole(principal, "OFFICE_ADMIN") && site.created_by_person_id === principal.personId),
  })) });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!hasRole(principal, "SUPER_ADMIN") && !hasRole(principal, "OFFICE_ADMIN")) return forbidden();
  const fields = parseSiteFields(await request.json().catch(() => null), true);
  if (!fields) return privateJson({ error: "Invalid Site" }, 400);
  const { data, error } = await client.from("sites").insert({
    ...fields, status: "DRAFT", created_by_person_id: principal.personId,
  }).select(PUBLIC_SITE_FIELDS).single();
  if (error || !data) return privateJson({ error: "Site could not be created" }, 400);
  return privateJson({ site: data }, 201);
}
