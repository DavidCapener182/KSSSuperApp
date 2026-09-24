import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const operational = ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"];
const administrative = ["SUPER_ADMIN", "OFFICE_ADMIN"];
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const iso = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value)) && value.length <= 40;
const plain = (value: unknown, max: number) => typeof value === "string" && value.trim().length >= 3 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const revision = (value: unknown) => Number.isInteger(value) && (value as number) > 0;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((role) => operational.includes(role))) return forbidden();
  const { id } = await params; if (!isUuid(id)) return notFound();
  const q = new URL(request.url).searchParams;
  const site = q.get("site"), from = q.get("from"), until = q.get("until");
  if (!site || !isUuid(site) || !date(from) || !date(until)) return privateJson({ error: "Invalid Service range" }, 400);
  const { data, error } = await client.rpc("site_service_detail", { p_site: site, p_service: id, p_from: from, p_until: until });
  return error ? notFound() : privateJson({ detail: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((role) => operational.includes(role))) return forbidden();
  const { id } = await params; if (!isUuid(id)) return notFound();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== "string") return privateJson({ error: "Invalid Service action" }, 400);
  const admin = principal.roles.some((role) => administrative.includes(role));
  let functionName: string; let args: Record<string, unknown>;
  switch (body.action) {
    case "transition":
      if (!admin) return forbidden();
      if (!["ACTIVE", "PAUSED", "ENDED"].includes(body.state) || !date(body.effectiveOn) ||
        !revision(body.expectedRevision) || !plain(body.reason, 500) || (body.resumeOn != null && !date(body.resumeOn)))
        return privateJson({ error: "Invalid transition" }, 400);
      functionName = "site_service_transition";
      args = { p_service: id, p_state: body.state, p_effective_on: body.effectiveOn,
        p_expected_revision: body.expectedRevision, p_reason: body.reason.trim(), p_resume_on: body.resumeOn ?? null }; break;
    case "template":
      if (!admin) return forbidden();
      if (body.lineId != null && !isUuid(body.lineId) || !date(body.effectiveFrom) ||
        !Array.isArray(body.weekdays) || body.weekdays.length < 1 || body.weekdays.length > 7 ||
        !body.weekdays.every((day: unknown) => Number.isInteger(day) && Number(day) >= 1 && Number(day) <= 7) ||
        !isUuid(body.roleId) || !revision(body.quantity) ||
        ![body.reportTime, body.startTime, body.endTime].every((time) => typeof time === "string" && /^\d\d:\d\d$/.test(time)) ||
        typeof body.area !== "string" || !body.area.trim() || body.area.length > 100 ||
        typeof body.reporting !== "string" || body.reporting.length > 180 || !plain(body.reason, 500))
        return privateJson({ error: "Invalid template" }, 400);
      functionName = "site_shift_template_publish";
      args = { p_service: id, p_line: body.lineId ?? null, p_effective_from: body.effectiveFrom,
        p_weekdays: body.weekdays, p_role: body.roleId, p_quantity: body.quantity,
        p_report: body.reportTime, p_starts: body.startTime, p_ends: body.endTime,
        p_area: body.area.trim(), p_reporting: body.reporting.trim(), p_reason: body.reason.trim() }; break;
    case "generate":
      if (!admin) return forbidden();
      if (!date(body.from) || !date(body.until)) return privateJson({ error: "Invalid generation range" }, 400);
      functionName = "site_shift_generate"; args = { p_service: id, p_from: body.from, p_until: body.until }; break;
    case "extra":
      if (!date(body.serviceDate) || !isUuid(body.roleId) || !revision(body.quantity) ||
        ![body.reportAt, body.shiftStartsAt, body.shiftEndsAt].every(iso) ||
        typeof body.area !== "string" || !body.area.trim() || body.area.length > 100 ||
        typeof body.reporting !== "string" || body.reporting.length > 180 || !plain(body.reason, 500))
        return privateJson({ error: "Invalid extra shift" }, 400);
      functionName = "site_shift_extra";
      args = { p_service: id, p_service_date: body.serviceDate, p_role: body.roleId, p_quantity: body.quantity,
        p_report_at: body.reportAt, p_shift_starts_at: body.shiftStartsAt, p_shift_ends_at: body.shiftEndsAt,
        p_area: body.area.trim(), p_reporting: body.reporting.trim(), p_reason: body.reason.trim() }; break;
    case "amend":
      if (!isUuid(body.demandId) || !revision(body.expectedRevision) ||
        !["SKIP", "CANCEL", "CHANGE_TIME", "CHANGE_QUANTITY", "CHANGE_REPORT_POINT"].includes(body.kind) || !plain(body.reason, 500))
        return privateJson({ error: "Invalid dated exception" }, 400);
      functionName = "site_shift_amend";
      args = { p_service: id, p_demand: body.demandId, p_expected_revision: body.expectedRevision, p_kind: body.kind,
        p_quantity: body.quantity ?? null, p_report_at: body.reportAt ?? null,
        p_shift_starts_at: body.shiftStartsAt ?? null, p_shift_ends_at: body.shiftEndsAt ?? null,
        p_area: body.area ?? null, p_reporting: body.reporting ?? null, p_reason: body.reason.trim() }; break;
    case "history":
      if (!isUuid(body.siteId) || !Number.isInteger(body.offset) || body.offset < 0 || body.offset > 10000)
        return privateJson({ error: "Invalid Service history" }, 400);
      functionName = "site_service_history";
      args = { p_site: body.siteId, p_service: id, p_offset: body.offset, p_limit: 50 }; break;
    case "candidates":
      if (!isUuid(body.demandId) || typeof body.search !== "string" || body.search.length > 80 ||
        !Number.isInteger(body.offset) || body.offset < 0 || body.offset > 10000)
        return privateJson({ error: "Invalid candidates" }, 400);
      functionName = "site_shift_candidates";
      args = { p_service: id, p_demand: body.demandId, p_search: body.search, p_offset: body.offset, p_limit: 20 }; break;
    case "allocations":
      if (!isUuid(body.demandId)) return privateJson({ error: "Invalid demand" }, 400);
      functionName = "site_shift_allocation_detail"; args = { p_service: id, p_demand: body.demandId }; break;
    case "allocate":
      if (!isUuid(body.demandId) || !isUuid(body.personId) || !revision(body.expectedRevision) ||
        typeof body.acknowledgeWarnings !== "boolean" || (body.reason != null && !plain(body.reason, 300)))
        return privateJson({ error: "Invalid allocation" }, 400);
      functionName = "site_shift_allocate";
      args = { p_service: id, p_demand: body.demandId, p_person: body.personId,
        p_expected_revision: body.expectedRevision, p_acknowledge_warnings: body.acknowledgeWarnings,
        p_reason: body.reason?.trim() ?? null }; break;
    case "cancelAllocation":
      if (!isUuid(body.demandId) || !isUuid(body.allocationId) || !revision(body.expectedRevision) || !plain(body.reason, 300))
        return privateJson({ error: "Invalid cancellation" }, 400);
      functionName = "site_shift_cancel_allocation";
      args = { p_service: id, p_demand: body.demandId, p_allocation: body.allocationId,
        p_expected_revision: body.expectedRevision, p_reason: body.reason.trim() }; break;
    default: return privateJson({ error: "Invalid Service action" }, 400);
  }
  const { data, error } = await client.rpc(functionName, args);
  return error ? privateJson({ error: error.message.includes("APPROVED_TIME_AWAY_CONFLICT")
    ? "APPROVED_TIME_AWAY_CONFLICT: Approved time away overlaps this duty. Reload the allocation."
    : "Service action could not be completed" }, error.message.includes("APPROVED_TIME_AWAY_CONFLICT") ? 409 : 400)
    : privateJson({ result: data });
}
