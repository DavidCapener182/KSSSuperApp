import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const kinds = new Set(["SITE", "SITE_SERVICE", "EVENT"]);
const actions = new Set(["preview", "publish", "revoke", "expire", "grant", "revoke_grant"]);
const offsetInstant = (value: unknown) => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,6})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value);
const invalid = () => privateJson({ error: "Invalid contact request" }, 400);
const unavailable = () => privateJson({ error: "Operational contacts unavailable or action denied" }, 403);

export async function GET(request: Request) {
  const client = await createServerSupabase();
  if (!await getPrincipal(client)) return unauthorised();
  const q = new URL(request.url).searchParams;
  const view = q.get("view") ?? "current";
  const kind = q.get("kind");
  const id = q.get("id");
  const allocation = q.get("allocationId");
  if (view === "allocation") {
    const source = q.get("source");
    if (!allocation || !isUuid(allocation) || !["EVENT", "SITE_SHIFT"].includes(source ?? "")) return invalid();
    const { data, error } = await client.rpc("contact_for_allocation_22b", { source, allocation });
    return error ? unavailable() : privateJson(data);
  }
  if (view === "history") {
    const reason = q.get("reason");
    if (!id || !isUuid(id) || !reason || reason.length < 3 || reason.length > 300) return invalid();
    const { data, error } = await client.rpc("contact_history_22b", { route: id, reason });
    return error ? unavailable() : privateJson(data);
  }
  if (!kind || !kinds.has(kind) || !id || !isUuid(id) || !["current", "manage", "grants"].includes(view)
    || (allocation && !isUuid(allocation)) || (view === "manage" && allocation)) return invalid();
  const { data, error } = view === "manage"
    ? await client.rpc("contact_manage_22b", { k: kind, target: id })
    : view === "grants" ? await client.rpc("contact_grants_22b", { k: kind, target: id })
    : await client.rpc("contact_current_22b", { k: kind, target: id, allocation: allocation || null });
  return error ? unavailable() : privateJson(data);
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  if (!await getPrincipal(client)) return unauthorised();
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return invalid(); }
  if (!body || typeof body !== "object" || !actions.has(String(body.action))) return invalid();
  if (body.action === "preview" || body.action === "publish") {
    const p = body.contact;
    if (!p || typeof p !== "object" || Array.isArray(p)) return invalid();
    const contact = p as Record<string, unknown>;
    if (!offsetInstant(contact.effective_from) || !offsetInstant(contact.effective_until)) return invalid();
    const normalized = contact.source_type === "MANUAL_OPERATIONAL" ? { ...contact, source_id: null } : contact;
    const { data, error } = await client.rpc(body.action === "preview" ? "contact_preview_22b" : "contact_publish_22b", { p: normalized });
    return error ? unavailable() : privateJson(body.action === "preview" ? data : { routeId: data });
  }
  if (body.action === "revoke") {
    if (!isUuid(String(body.routeId)) || !Number.isInteger(body.expectedRevision) || typeof body.reason !== "string") return invalid();
    const { error } = await client.rpc("contact_revoke_22b", {
      route: body.routeId, expected: body.expectedRevision, reason: body.reason,
    });
    return error ? unavailable() : privateJson({ revoked: true });
  }
  if (body.action === "expire") {
    if (!isUuid(String(body.routeId)) || typeof body.reason !== "string") return invalid();
    const { error } = await client.rpc("contact_mark_expired_22b", { route: body.routeId, reason: body.reason });
    return error ? unavailable() : privateJson({ recorded: true });
  }
  if (body.action === "grant") {
    if (!kinds.has(String(body.kind)) || !isUuid(String(body.contextId)) || !isUuid(String(body.personId))
      || !offsetInstant(body.validFrom) || !offsetInstant(body.validUntil) || typeof body.reason !== "string") return invalid();
    const { data, error } = await client.rpc("contact_grant_22b", {
      k: body.kind, target: body.contextId, person: body.personId,
      starts: body.validFrom, ends: body.validUntil, reason: body.reason,
    });
    return error ? unavailable() : privateJson({ grantId: data });
  }
  if (!isUuid(String(body.grantId)) || typeof body.reason !== "string") return invalid();
  const { error } = await client.rpc("contact_revoke_grant_22b", { p_grant: body.grantId, reason: body.reason });
  return error ? unavailable() : privateJson({ revoked: true });
}
