type Row = Record<string, unknown>;
const row = (value: unknown): Row | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export type WorkTimeDecision = { eventId: string; caseId: string; revision: number; actorPersonId: string; kind: "RETURN" | "APPROVE"; reason: string };
export function workTimeReceipt(value: unknown, expected: WorkTimeDecision): boolean {
  const receipt = row(value);
  return Boolean(receipt && receipt.case_id === expected.caseId && receipt.revision === expected.revision &&
    receipt.status === (expected.kind === "RETURN" ? "RETURNED" : "APPROVED") && uuid(receipt.event_id));
}
export function workTimeReadback(value: unknown, expected: WorkTimeDecision): boolean {
  const data = row(value);
  if (!data || data.actor_person_id !== expected.actorPersonId || !uuid(data.actor_person_id) ||
    (expected.kind === "RETURN" ? data.can_review !== true : data.can_approve !== true) || !Array.isArray(data.items)) return false;
  const item = data.items.map(row).find((entry) => entry?.case_id === expected.caseId);
  if (!item || item.event_id !== expected.eventId || item.current_revision !== expected.revision ||
    item.status !== (expected.kind === "RETURN" ? "RETURNED" : "APPROVED") || !Array.isArray(item.revisions) || !Array.isArray(item.history)) return false;
  const submitted = item.revisions.map(row).find((entry) => entry?.revision === expected.revision && entry.kind === "SUBMITTED");
  return Boolean(submitted && submitted.author_person_id !== expected.actorPersonId && item.person_id !== expected.actorPersonId &&
    item.history.map(row).some((event) => event?.kind === (expected.kind === "RETURN" ? "RETURNED" : "WORKED_TIME_APPROVED") &&
      event.revision === expected.revision && event.actor_person_id === expected.actorPersonId &&
      typeof event.recorded_at === "string" && Number.isFinite(Date.parse(event.recorded_at)) &&
      (event.reason ?? "") === expected.reason));
}
