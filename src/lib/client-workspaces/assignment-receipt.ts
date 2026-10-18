// Existing cw_issue readback includes exact issue identity and immutable history.
// This checks that readback, not database permission or persistence itself.
type Expected = { workspaceId: string; issueId?: string; revision?: number; previousOwner?: string | null; ownerPersonId: string | null; sourceOwner: string; reason: string };
const row = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export function assignmentReceipt(value: unknown, expected: Expected): { id: string; revision: number } | null {
  const issue = row(value), revision = expected.issueId ? (expected.revision ?? 0) + 1 : 1;
  if (!issue || !uuid(issue.id) || issue.workspace_id !== expected.workspaceId ||
    (expected.issueId && issue.id !== expected.issueId) || issue.revision !== revision ||
    issue.owner_person_id !== expected.ownerPersonId || issue.source_owner !== expected.sourceOwner.trim() || !Array.isArray(issue.history)) return null;
  const event = issue.history.map(row).find((item) => item?.revision === revision), after = row(event?.after);
  if (!event || !after || !uuid(event.actorPersonId) || typeof event.occurredAt !== "string" || !Number.isFinite(Date.parse(event.occurredAt)) ||
    event.action !== (expected.issueId ? "UPDATED" : "CREATED") || after.id !== issue.id || after.workspace_id !== expected.workspaceId ||
    after.revision !== revision || after.owner_person_id !== expected.ownerPersonId || after.source_owner !== expected.sourceOwner.trim()) return null;
  if (expected.issueId) {
    const before = row(event.before);
    if (!before || before.id !== expected.issueId || before.workspace_id !== expected.workspaceId || before.revision !== expected.revision ||
      before.owner_person_id !== expected.previousOwner || event.reason !== expected.reason.trim()) return null;
  }
  return { id: issue.id, revision };
}
