import { isUuid } from "./principal";

export type AssignmentInput = { personId: string; siteId?: string; roleCode?: string; effectiveFrom: string; effectiveUntil: string | null; reason?: string };

export function parseAssignment(value: unknown, kind: "role" | "site"): AssignmentInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.personId !== "string" || !isUuid(body.personId)) return null;
  if (kind === "site" && (typeof body.siteId !== "string" || !isUuid(body.siteId))) return null;
  if (kind === "role" && !["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS", "SECURITY_STAFF"].includes(String(body.roleCode))) return null;
  if (typeof body.effectiveFrom !== "string" || !Number.isFinite(Date.parse(body.effectiveFrom))) return null;
  if (body.effectiveUntil !== null && body.effectiveUntil !== undefined && (typeof body.effectiveUntil !== "string" || !Number.isFinite(Date.parse(body.effectiveUntil)))) return null;
  const until = body.effectiveUntil ? String(body.effectiveUntil) : null;
  if (until && Date.parse(until) <= Date.parse(body.effectiveFrom)) return null;
  if (kind === "site" && (!until || typeof body.reason !== "string" || !body.reason.trim() || body.reason.trim().length > 500)) return null;
  return {
    personId: body.personId,
    siteId: kind === "site" ? String(body.siteId) : undefined,
    roleCode: kind === "role" ? String(body.roleCode) : undefined,
    effectiveFrom: body.effectiveFrom,
    effectiveUntil: until,
    reason: kind === "site" ? String(body.reason).trim() : undefined,
  };
}
