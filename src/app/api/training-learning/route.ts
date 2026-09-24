import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const uuid = (v: unknown): v is string => typeof v === "string" && isUuid(v);
const reason = (v: unknown): v is string => typeof v === "string" && v.trim().length >= 10 && v.trim().length <= 300;
const date = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
const ordinal = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

export async function GET(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  const id = url.searchParams.get("id");
  const operation = view === "mine" ? client.rpc("training_my_learning")
    : view === "content" && uuid(id) ? client.rpc("training_assignment_content", { p_assignment: id })
    : view === "admin" ? client.rpc("training_assignments_admin")
    : view === "choices" ? client.rpc("training_assignable_choices")
    : view === "access" ? client.rpc("training_assigner_access")
    : view === "grants" ? client.rpc("training_assigner_grants_read")
    : view === "candidates" ? client.rpc("training_assigner_candidates")
    : view === "history" && uuid(id) ? client.rpc("training_assignment_history", { p_assignment: id }) : null;
  if (!operation) return privateJson({ error: "Invalid learning view" }, 400);
  const { data, error } = await operation;
  return error ? privateJson({ error: "Learning view unavailable" }, 403) : privateJson({ data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return privateJson({ error: "Invalid request" }, 400);
  const action = body.action;
  let operation: ReturnType<typeof client.rpc> | null = null;
  if (action === "GRANT" && uuid(body.personId) && typeof body.from === "string" && reason(body.reason))
    operation = client.rpc("training_assigner_grant", { p_person: body.personId, p_from: body.from, p_until: body.until || null, p_reason: body.reason });
  else if (action === "REVOKE" && uuid(body.grantId) && reason(body.reason))
    operation = client.rpc("training_assigner_revoke", { p_grant: body.grantId, p_reason: body.reason });
  else if (action === "ASSIGN" && uuid(body.personId) && uuid(body.courseId) && uuid(body.versionId) && date(body.dueOn) && reason(body.reason) && uuid(body.requestId))
    operation = client.rpc("training_assign", { p_person: body.personId, p_course: body.courseId, p_version: body.versionId, p_due: body.dueOn, p_reason: body.reason, p_request: body.requestId });
  else if (action === "DUE_CHANGE" && uuid(body.assignmentId) && ordinal(body.revision) && date(body.dueOn) && reason(body.reason) && uuid(body.requestId))
    operation = client.rpc("training_change_due", { p_assignment: body.assignmentId, p_revision: body.revision, p_due: body.dueOn, p_reason: body.reason, p_request: body.requestId });
  else if (action === "CANCEL" && uuid(body.assignmentId) && ordinal(body.revision) && reason(body.reason) && uuid(body.requestId))
    operation = client.rpc("training_cancel", { p_assignment: body.assignmentId, p_revision: body.revision, p_reason: body.reason, p_request: body.requestId });
  else if (action === "SUPERSEDE" && uuid(body.assignmentId) && ordinal(body.revision) && uuid(body.versionId) && date(body.dueOn) && reason(body.reason) && uuid(body.requestId))
    operation = client.rpc("training_supersede_assignment", { p_assignment: body.assignmentId, p_revision: body.revision, p_version: body.versionId, p_due: body.dueOn, p_reason: body.reason, p_request: body.requestId });
  else if (action === "SAVE_PLACE" && uuid(body.assignmentId) && ordinal(body.module) && ordinal(body.page))
    operation = client.rpc("training_save_place", { p_assignment: body.assignmentId, p_module: body.module, p_page: body.page });
  else if (action === "MARK_PAGE" && uuid(body.assignmentId) && ordinal(body.module) && ordinal(body.page))
    operation = client.rpc("training_mark_page", { p_assignment: body.assignmentId, p_module: body.module, p_page: body.page });
  if (!operation) return privateJson({ error: "Invalid learning action" }, 400);
  const { data, error } = await operation;
  return error ? privateJson({ error: "Learning action denied or stale" }, 403) : privateJson({ data });
}
