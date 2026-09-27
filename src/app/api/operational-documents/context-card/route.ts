import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { operationalCapabilities } from "@/lib/controlled/operational";
import { createServerSupabase } from "@/lib/supabase/server";

type Assignment = { id: string; title: string; version: number; targetKind: string; targetId: string;
  contextKind: string | null; contextId: string | null; required: boolean;
  effectiveFrom: string; effectiveUntil: string | null; closedAt: string | null };

// Status-only composition. It never returns controlled version bytes, Storage keys or recipient identities.
export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind"), id = params.get("id");
  if (!kind || !["SITE", "SITE_SERVICE", "EVENT"].includes(kind) || !id || !isUuid(id))
    return privateJson({ error: "Invalid exact context" }, 400);

  const capabilities = await operationalCapabilities(client);
  if (principal.roles.includes("OPERATIONS")) {
    const { data, error } = await client.rpc("operational_document_context_status", { p_kind: kind, p_id: id });
    if (!error && data) return privateJson(data);
  }
  if (!capabilities.assign) return forbidden();
  const { data, error } = await client.rpc("operational_document_manager_list");
  if (error || !data || !Array.isArray(data.assignments))
    return privateJson({ error: "Document status unavailable" }, 503);
  const now = Date.now();
  const matching = (data.assignments as Assignment[]).filter((row) =>
    ((row.targetKind === kind && row.targetId === id) ||
      (row.targetKind === "OPERATIONAL_ROLE" && row.contextKind === kind && row.contextId === id)) &&
    Date.parse(row.effectiveFrom) <= now &&
    (!row.effectiveUntil || Date.parse(row.effectiveUntil) > now) &&
    (!row.closedAt || Date.parse(row.closedAt) > now));
  if (matching.length > 50) return privateJson({ error: "Open the document workspace for this large context" }, 503);
  const statuses = await Promise.all(matching.map((row) => client.rpc("operational_document_status", {
    assignment_id: row.id,
  })));
  if (statuses.some((result) => result.error || !result.data))
    return privateJson({ error: "Document status unavailable" }, 503);
  return privateJson({ asOf: new Date().toISOString(), contextKind: kind, contextId: id,
    assignments: matching.map((row, index) => ({ assignmentId: row.id, title: row.title,
      version: row.version, required: row.required, effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.effectiveUntil, recipientCount: statuses[index].data.recipientCount,
      acknowledgedCount: statuses[index].data.acknowledgedCount })) });
}
