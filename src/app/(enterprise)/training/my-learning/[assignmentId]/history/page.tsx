import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import type { TrainingAssignment } from "@/lib/training/learning-types";
import "../../../training.css";

export const dynamic = "force-dynamic";
type Event = { id: string; action: string; details: Record<string, unknown>; occurredAt: string };
function description(event: Event) {
  const d = event.details;
  if (event.action === "ASSIGNED") return `Assigned version · due ${d.dueOn ?? ""}${d.replacesAssignmentId ? " · replaces an earlier assignment" : ""}`;
  if (event.action === "DUE_CHANGED") return `Due date moved from ${d.oldDueOn} to ${d.newDueOn} · ${d.reason ?? ""}`;
  if (event.action === "COURSE_PUBLISHED") return "A newer course version was published. This assignment stayed on its exact version.";
  if (event.action === "SUPERSEDED") return `Explicitly superseded by a new assignment · ${d.reason ?? ""}`;
  if (event.action === "CANCELLED") return `Assignment cancelled · ${d.reason ?? ""}`;
  return event.action;
}
export default async function MyAssignmentHistory({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) notFound();
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) notFound();
  const [{ data: mine, error }, { data: events, error: historyError }] = await Promise.all([
    client.rpc("training_my_learning"), client.rpc("training_assignment_history", { p_assignment: assignmentId }),
  ]);
  const assignment = !error && Array.isArray(mine) ? (mine as TrainingAssignment[]).find(a => a.id === assignmentId) : null;
  if (!assignment || historyError) notFound();
  return <main className="training-area"><Link href="/training/my-learning">← My Learning</Link><header><p className="training-eyebrow">Synthetic learning · Assignment history</p><h1>{assignment.title} · Version {assignment.versionNumber}</h1><p>{assignment.state} · {assignment.viewedCount} of {assignment.pageCount} pages marked viewed</p></header>
    {assignment.retired && assignment.state === "ACTIVE" && <p role="status">Content retired — assignment needs review.</p>}
    <ol className="training-event-list">{(Array.isArray(events) ? events as Event[] : []).map(event => <li key={event.id}><time>{new Date(event.occurredAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}</time><p>{description(event)}</p></li>)}</ol>
    <p className="training-boundary">This is an assignment and page-progress record. It does not assert a course result.</p>
  </main>;
}
