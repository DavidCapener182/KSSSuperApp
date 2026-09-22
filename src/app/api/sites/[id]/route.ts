import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageSite, canUseSites, canViewSite, parseSiteFields, SITE_COLUMNS, type Site } from "@/lib/sites/policy";

export async function GET(_request: Request, { params }: RouteContext<"/api/sites/[id]">) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canUseSites(principal)) return forbidden();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const { data: site, error } = await client.from("sites").select(SITE_COLUMNS).eq("id", id).maybeSingle<Site>();
  if (error || !site || !await canViewSite(client, principal, site)) return notFound();
  return privateJson({ site: {
    id: site.id, site_reference: site.site_reference, name: site.name,
    address_line1: site.address_line1, town_city: site.town_city,
    postcode: site.postcode, reporting_point: site.reporting_point, status: site.status,
  }, canManage: canManageSite(principal, site) });
}

export async function PATCH(request: Request, { params }: RouteContext<"/api/sites/[id]">) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const { data: site, error } = await client.from("sites").select(SITE_COLUMNS).eq("id", id).maybeSingle<Site>();
  if (error || !site) return notFound();
  if (!canManageSite(principal, site)) return forbidden();
  const fields = parseSiteFields(await request.json().catch(() => null), false);
  if (!fields) return privateJson({ error: "Invalid Site change" }, 400);
  if (fields.status && !(
    (site.status === "DRAFT" && fields.status === "ACTIVE") ||
    (site.status === "ACTIVE" && fields.status === "RETIRED")
  )) return privateJson({ error: "Invalid Site status transition" }, 400);
  const { data, error: updateError } = await client.from("sites").update(fields)
    .eq("id", id).eq("status", site.status).select("id,name,status").maybeSingle();
  if (updateError) return privateJson({ error: "Site could not be changed" }, 400);
  if (!data) return privateJson({ error: "Site changed; reload before editing" }, 409);
  return privateJson({ site: data });
}
