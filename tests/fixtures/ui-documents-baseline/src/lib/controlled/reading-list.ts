export type ReadingAssignment = { id: string; document_id: string; version_id: string; version_number: number; title: string;
  target_kind: string; target_id: string; required: boolean; effective_from: string;
  current: boolean; conflict: boolean; opened: boolean; acknowledged_at: string | null; close_kind: string | null;
  context_label?: string };

export type ReadingStatus = "CONFLICT" | "HISTORICAL" | "ACKNOWLEDGED" | "OPENED" | "NOT_OPENED";
export type ReadingFilter = "ALL" | ReadingStatus;

// Preserve the existing exact document/version group and selected assignment rules.
export function groupReadingAssignments(assignments: ReadingAssignment[]) {
  const grouped = new Map<string, ReadingAssignment[]>();
  for (const item of assignments) {
    const key = `${item.document_id}:${item.version_id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return Array.from(grouped.values()).map((items) => {
    const currentItems = items.filter((item) => item.current);
    const selected = currentItems.find((item) => item.opened) ?? currentItems[0] ?? items[0];
    return { ...selected, contexts: items.map((item) => item.context_label ?? item.target_kind.replaceAll("_", " ")),
      current: currentItems.length > 0, conflict: items.some((item) => item.conflict),
      opened: currentItems.some((item) => item.opened),
      acknowledged_at: items.find((item) => item.acknowledged_at)?.acknowledged_at ?? null,
      required: items.some((item) => item.required) };
  });
}
export type ReadingItem = ReturnType<typeof groupReadingAssignments>[number];

export function readingStatus(item: ReadingItem): ReadingStatus {
  if (item.conflict) return "CONFLICT";
  if (!item.current) return "HISTORICAL";
  if (item.acknowledged_at) return "ACKNOWLEDGED";
  return item.opened ? "OPENED" : "NOT_OPENED";
}

// Search only the title and context text already displayed by a grouped card.
export function filterReadingList(items: ReadingItem[], status: ReadingFilter, search: string) {
  const query = search.trim().toLocaleLowerCase("en-GB");
  return items.filter((item) => (status === "ALL" || readingStatus(item) === status) &&
    [item.title, ...item.contexts].join(" ").toLocaleLowerCase("en-GB").includes(query));
}
