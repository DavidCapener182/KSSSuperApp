import { parseDeadline } from "@/lib/tasks/calendar";

export type CrmActionTask = {
  id: string; title: string; state: "OPEN" | "DONE" | "CANCELLED";
  sourceKind: "CRM_OPPORTUNITY" | "CRM_ORGANISATION"; sourceId: string; sourceTitle: string;
  sourceHref: string; dueAt: string | null; completedAt: string | null;
};
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const timestamp = (value: unknown): value is string | null => value === null || (typeof value === "string" && parseDeadline(value) !== null);
export function sameCrmTask(a: CrmActionTask, b: CrmActionTask) {
  return a.id === b.id && a.sourceKind === b.sourceKind && a.sourceId === b.sourceId && a.sourceHref === b.sourceHref;
}
export function readCrmActionTask(value: unknown, expected?: CrmActionTask): CrmActionTask | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!uuid(row.id) || !uuid(row.sourceId) || typeof row.title !== "string" || typeof row.sourceTitle !== "string" ||
    !["OPEN", "DONE", "CANCELLED"].includes(String(row.state)) ||
    (row.sourceKind !== "CRM_OPPORTUNITY" && row.sourceKind !== "CRM_ORGANISATION") ||
    !timestamp(row.dueAt) || !timestamp(row.completedAt) || (row.state === "DONE" && !row.completedAt)) return null;
  const sourceHref = `/crm/${row.sourceKind === "CRM_OPPORTUNITY" ? "opportunities" : "organisations"}/${row.sourceId}`;
  if (row.sourceHref !== sourceHref) return null;
  const task: CrmActionTask = { id: row.id, title: row.title, state: row.state as CrmActionTask["state"],
    sourceKind: row.sourceKind, sourceId: row.sourceId, sourceTitle: row.sourceTitle, sourceHref,
    dueAt: row.dueAt, completedAt: row.completedAt };
  return !expected || sameCrmTask(task, expected) ? task : null;
}
export function sameCrmDue(a: string | null, b: string | null) {
  return a === null || b === null ? a === b : parseDeadline(a)?.instant === parseDeadline(b)?.instant && parseDeadline(a) !== null;
}
export function sameReviewedCrmTask(a: CrmActionTask, b: CrmActionTask) {
  return sameCrmTask(a, b) && a.state === b.state && sameCrmDue(a.dueAt, b.dueAt) &&
    a.title === b.title && a.sourceTitle === b.sourceTitle && a.completedAt === b.completedAt;
}
export function confirmsCrmAction(before: CrmActionTask, after: CrmActionTask, kind: "COMPLETE" | "RESCHEDULE", intendedDue: string | null) {
  return before.state === "OPEN" && sameCrmTask(before, after) && (kind === "COMPLETE" ? after.state === "DONE" && sameCrmDue(after.dueAt, before.dueAt) :
    after.state === "OPEN" && sameCrmDue(after.dueAt, intendedDue));
}
const dueLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short", hourCycle: "h23" });
const inputLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const crmTaskDueLabel = (value: string | null) => value ? `${dueLabel.format(new Date(value))} · Europe/London` : "No deadline";
export function crmTaskDueInput(value: string | null) {
  if (!value) return "";
  const parts = Object.fromEntries(inputLabel.formatToParts(new Date(value)).map(item => [item.type, item.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
