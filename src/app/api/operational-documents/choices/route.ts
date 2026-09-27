import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { operationalCapabilities } from "@/lib/controlled/operational";
import { readDirectory } from "@/lib/people/directory";
import { createServerSupabase } from "@/lib/supabase/server";

type Choice = { id: string; label: string; parent?: string };
const kinds = new Set(["DOCUMENT", "SITE", "SITE_SERVICE", "EVENT", "PERSON", "OPERATIONAL_ROLE"]);

// Only return display metadata for an authorised Assigner or an Operations context lookup.
// The selected UUID is revalidated by the guarded 19A assignment/status action.
export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") ?? "";
  const search = (params.get("search") ?? "").trim();
  const site = params.get("site");
  const offset = Number(params.get("offset") ?? "0");
  if (!kinds.has(kind) || search.length < 2 || search.length > 80 || /[\x00-\x1f\x7f]/.test(search) ||
    !Number.isInteger(offset) || offset < 0 || offset > 1000 ||
    (kind === "SITE_SERVICE" ? !site || !isUuid(site) : site !== null))
    return privateJson({ error: "Invalid search" }, 400);
  const assign = (await operationalCapabilities(client)).assign;
  const statusOnly = principal.roles.includes("OPERATIONS") && ["SITE", "SITE_SERVICE", "EVENT"].includes(kind);
  if (!assign && !statusOnly) return forbidden();

  let items: Choice[] = [];
  let total = 0;
  if (kind === "DOCUMENT") {
    const { data, error, count } = await client.from("controlled_document_versions")
      .select("id,version_number,effective_on,controlled_documents!inner(title,family)", { count: "exact" })
      .eq("state", "PUBLISHED").eq("upload_state", "READY")
      .eq("controlled_documents.family", "OPERATIONAL_SYNTHETIC")
      .ilike("controlled_documents.title", `%${search}%`)
      .order("version_number", { ascending: false }).range(offset, offset + 19);
    if (error) return privateJson({ error: "Document choices unavailable" }, 503);
    items = (data ?? []).map((version) => ({ id: version.id,
      label: `${version.controlled_documents[0]?.title ?? "Operational document"} · v${version.version_number}`,
      parent: version.effective_on ?? undefined }));
    total = count ?? 0;
  } else if (kind === "SITE") {
    const { data, error } = await client.rpc("operational_sites", { p_search: search, p_organisation: null,
      p_type: null, p_status: "ACTIVE", p_offset: offset, p_limit: 20 });
    if (error) return privateJson({ error: "Site choices unavailable" }, 503);
    items = (data?.items ?? []).map((row: { id: string; name: string; client_name?: string }) =>
      ({ id: row.id, label: row.name, parent: row.client_name }));
    total = data?.total ?? 0;
  } else if (kind === "SITE_SERVICE") {
    const { data, error } = await client.rpc("site_services_list", { p_site: site });
    if (error) return privateJson({ error: "Service choices unavailable" }, 503);
    const matching = (Array.isArray(data) ? data : []).filter((row: { name: string; state: string }) =>
      ["ACTIVE", "PAUSED"].includes(row.state) && row.name.toLowerCase().includes(search.toLowerCase()));
    total = matching.length;
    items = matching.slice(offset, offset + 20).map((row: { id: string; name: string; site_name: string; client_name: string }) =>
      ({ id: row.id, label: row.name, parent: `${row.site_name} · ${row.client_name}` }));
  } else if (kind === "EVENT") {
    const { data, error } = await client.rpc("operational_events_list", { p_search: search,
      p_organisation: null, p_site: null, p_status: null, p_type: null, p_owner: null,
      p_from: null, p_until: null, p_offset: offset, p_limit: 20 });
    if (error) return privateJson({ error: "Event choices unavailable" }, 503);
    const available = (data?.items ?? []).filter((row: { status: string }) =>
      ["PLANNING", "CONFIRMED", "LIVE"].includes(row.status));
    items = available.map((row: { id: string; name: string; site_name: string; client_name: string }) =>
      ({ id: row.id, label: row.name, parent: `${row.site_name} · ${row.client_name}` }));
    total = data?.total ?? 0;
  } else if (kind === "PERSON") {
    const result = await readDirectory(client, principal, { search, role: "SECURITY_STAFF", onboarding: "",
      offset, limit: 20 });
    if (!result) return privateJson({ error: "Person choices unavailable" }, 503);
    items = result.items.map((row) => ({ id: row.id, label: row.displayName }));
    total = result.total;
  } else {
    const { data, error } = await client.rpc("staffing_role_choices");
    if (error) return privateJson({ error: "Role choices unavailable" }, 503);
    const matching = (Array.isArray(data) ? data : []).filter((row: { name: string; active: boolean }) =>
      row.active && row.name.toLowerCase().includes(search.toLowerCase()));
    total = matching.length;
    items = matching.slice(offset, offset + 20).map((row: { id: string; name: string }) =>
      ({ id: row.id, label: row.name }));
  }
  return privateJson({ items, total, offset });
}
