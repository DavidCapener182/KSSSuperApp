import { isUuid } from "@/lib/auth/principal";
import { londonDueToIso } from "@/lib/crm/due-time";

export const canManageStaffing = (roles: string[]) => roles.some((role) => ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"].includes(role));

export function staffingFields(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (typeof value.roleId !== "string" || !isUuid(value.roleId) || !Number.isInteger(value.quantity) || Number(value.quantity) < 1 || Number(value.quantity) > 10000 ||
    typeof value.area !== "string" || value.area.trim().length < 1 || value.area.trim().length > 100 || /[\x00-\x1f\x7f]/.test(value.area) ||
    typeof value.instructions !== "string" || value.instructions.length > 500 || /[\x00-\x1f\x7f]/.test(value.instructions) ||
    (value.reason != null && (typeof value.reason !== "string" || value.reason.trim().length > 500 || /[\x00-\x1f\x7f]/.test(value.reason))) ||
    (value.confirmDuplicate != null && typeof value.confirmDuplicate !== "boolean") ||
    (value.confirmException != null && typeof value.confirmException !== "boolean")) return null;
  const report = londonDueToIso(value.reportLocal); const start = londonDueToIso(value.startLocal); const end = londonDueToIso(value.endLocal);
  if (!report || !start || !end || Date.parse(report) > Date.parse(start) || Date.parse(start) >= Date.parse(end)) return null;
  return { p_role: value.roleId, p_quantity: value.quantity, p_report: report, p_start: start, p_end: end,
    p_area: value.area.trim(), p_instructions: value.instructions.trim(), p_reason: typeof value.reason === "string" ? value.reason.trim() || null : null,
    p_confirm_duplicate: value.confirmDuplicate === true, p_confirm_exception: value.confirmException === true };
}

export function staffingError(message: string) {
  if (message.includes("Matching staffing line")) return { status: 409, error: "A matching staffing line exists. Confirm the duplicate to continue." };
  if (message.includes("Unusual staffing requirement")) return { status: 400, error: "Confirm this unusually large, long or early staffing requirement." };
  if (message.includes("Stale or unavailable")) return { status: 409, error: "This staffing line changed or is no longer available. Reload the plan." };
  if (message.includes("Unusually long")) return { status: 400, error: "A long duty or early report time needs a confirmation reason." };
  if (message.includes("Confirmed or live")) return { status: 400, error: "Changing a confirmed or live Event plan needs a reason." };
  return { status: 400, error: "Staffing change denied. Check Event state, dates, role and fields." };
}
