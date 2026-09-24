import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const text = (v: unknown, min: number, max: number): v is string => typeof v === "string" && v.trim().length >= min && v.trim().length <= max && !/[\x00-\x1f\x7f]/.test(v);
const instant = (v: unknown): v is string => typeof v === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const revision = (v: unknown): v is number => Number.isInteger(v) && Number(v) > 0;
type Context = { params: Promise<{ serviceId: string }> };

export async function GET(request: Request, { params }: Context) {
  const client = await createServerSupabase();
  if (!await getPrincipal(client)) return unauthorised();
  const { serviceId } = await params;
  if (!isUuid(serviceId)) return notFound();
  const q = new URL(request.url).searchParams;
  const offset = Number(q.get("offset") ?? 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) return privateJson({ error: "Invalid page" }, 400);
  if (q.get("mode") === "item") {
    const itemId = q.get("itemId");
    if (!itemId || !isUuid(itemId)) return notFound();
    const { data, error } = await client.rpc("site_book_item_history_14a", { p_item: itemId });
    return error ? notFound() : privateJson({ item: data });
  }
  if (q.get("mode") === "search") {
    const search = q.get("search") ?? "", type = q.get("type") || null, from = q.get("from"), until = q.get("until");
    if (search.length > 80 || (from && !instant(from)) || (until && !instant(until))) return privateJson({ error: "Invalid search" }, 400);
    const { data, error } = await client.rpc("site_book_search_14a", { p_service: serviceId, p_search: search, p_type: type,
      p_from: from, p_until: until, p_offset: offset });
    return error ? notFound() : privateJson({ search: data });
  }
  const { data, error } = await client.rpc("site_book_next_shift_14a", { p_service: serviceId, p_offset: offset });
  return error ? notFound() : privateJson({ book: data });
}

export async function POST(request: Request, { params }: Context) {
  const client = await createServerSupabase();
  if (!await getPrincipal(client)) return unauthorised();
  const { serviceId } = await params;
  if (!isUuid(serviceId)) return notFound();
  const b = await request.json().catch(() => null);
  if (!b || typeof b.action !== "string") return privateJson({ error: "Invalid book action" }, 400);
  let rpc: string; let args: Record<string, unknown>;
  switch (b.action) {
    case "submit":
      if (!isUuid(b.key) || !instant(b.occurredAt) || !text(b.local, 16, 35) || !/^[+-]\d{2}:\d{2}$/.test(b.offset) ||
        !["VISITOR_CONTRACTOR_DELIVERY", "KEYS_EQUIPMENT", "MAINTENANCE", "CLIENT_INSTRUCTION", "ROUTINE_OBSERVATION", "HANDOVER", "OUTSTANDING_ITEM"].includes(b.type) ||
        !["OBSERVED", "REPORTED_TO_ME"].includes(b.source) || !text(b.body, 5, 1200) ||
        (b.demandId != null && !isUuid(b.demandId)) || (b.allocationId != null && !isUuid(b.allocationId))) return privateJson({ error: "Check the entry details" }, 400);
      rpc = "site_book_submit_14a"; args = { p_service: serviceId, p_demand: b.demandId ?? null, p_allocation: b.allocationId ?? null,
        p_type: b.type, p_source: b.source, p_occurred: b.occurredAt, p_local: b.local, p_offset: b.offset, p_body: b.body.trim(), p_key: b.key }; break;
    case "correct":
      if (!isUuid(b.entryId) || !revision(b.expectedVersion) || !instant(b.occurredAt) || !text(b.local, 16, 35) ||
        !/^[+-]\d{2}:\d{2}$/.test(b.offset) || !text(b.body, 5, 1200) || !text(b.reason, 3, 300) || !isUuid(b.key)) return privateJson({ error: "Check the correction" }, 400);
      rpc = "site_book_correct_14a"; args = { p_entry: b.entryId, p_expected: b.expectedVersion, p_occurred: b.occurredAt,
        p_local: b.local, p_offset: b.offset, p_body: b.body.trim(), p_reason: b.reason.trim(), p_key: b.key }; break;
    case "item":
      if (!isUuid(b.itemId) || !revision(b.expectedRevision) || !["UPDATED", "RESOLVED", "REOPENED"].includes(b.kind) ||
        !text(b.note, 3, 600) || (b.kind !== "UPDATED" && !text(b.reason, 3, 300)) || !isUuid(b.key)) return privateJson({ error: "Check the item update" }, 400);
      rpc = "site_book_item_action_14a"; args = { p_item: b.itemId, p_expected: b.expectedRevision, p_action: b.kind,
        p_note: b.note.trim(), p_reason: b.kind === "UPDATED" ? null : b.reason.trim(), p_key: b.key }; break;
    case "handoverStart":
      if (!instant(b.from) || !instant(b.until) || !text(b.body, 3, 1200) || !isUuid(b.key)) return privateJson({ error: "Check the handover" }, 400);
      rpc = "site_book_handover_start_14a"; args = { p_service: serviceId, p_from: b.from, p_until: b.until, p_body: b.body.trim(), p_key: b.key }; break;
    case "handoverContribute":
      if (!isUuid(b.handoverId) || !revision(b.expectedRevision) || !text(b.body, 3, 1200) || !isUuid(b.key)) return privateJson({ error: "Check the handover update" }, 400);
      rpc = "site_book_handover_contribute_14a"; args = { p_handover: b.handoverId, p_expected: b.expectedRevision, p_body: b.body.trim(), p_key: b.key }; break;
    case "handoverAcknowledge":
      if (!isUuid(b.handoverId) || !revision(b.revision) || !isUuid(b.key)) return privateJson({ error: "Check the acknowledgement" }, 400);
      rpc = "site_book_handover_ack_14a"; args = { p_handover: b.handoverId, p_revision: b.revision, p_key: b.key }; break;
    case "handoverClose":
      if (!isUuid(b.handoverId) || !revision(b.expectedRevision) || !text(b.reason, 3, 300)) return privateJson({ error: "Check the closure reason" }, 400);
      rpc = "site_book_handover_close_14a"; args = { p_handover: b.handoverId, p_expected: b.expectedRevision, p_reason: b.reason.trim() }; break;
    default: return privateJson({ error: "Invalid book action" }, 400);
  }
  const { data, error } = await client.rpc(rpc, args);
  return error ? privateJson({ error: "Not recorded. Refresh the book, then retry if needed." }, 409) : privateJson({ result: data });
}
