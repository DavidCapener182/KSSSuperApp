const londonDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
});

export function crmDueStatus(dueAt: string | null | undefined, asOf: Date = new Date()): "Overdue" | "Due today" | "Upcoming" | "No due date" {
  if (!dueAt) return "No due date";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "No due date";
  if (due.getTime() < asOf.getTime()) return "Overdue";
  return londonDate.format(due) === londonDate.format(asOf) ? "Due today" : "Upcoming";
}
