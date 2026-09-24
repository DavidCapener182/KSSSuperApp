import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const id = (value: unknown): value is string => typeof value === "string" && isUuid(value);
const revision = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
const reason = (value: unknown): value is string => typeof value === "string" && value.trim().length >= 10 && value.trim().length <= 300;
const answers = (value: unknown): value is Record<string, string[]> => value !== null && typeof value === "object" && !Array.isArray(value);

export async function GET(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  const assignment = url.searchParams.get("assignmentId");
  const operation = view === "staff" && id(assignment) ? client.rpc("training_assessment_staff", { p_assignment: assignment })
    : view === "access" ? client.rpc("training_assessment_access")
    : view === "admin" ? client.rpc("training_assessment_admin")
    : view === "courses" ? client.rpc("training_assessment_course_choices")
    : view === "grants" ? client.rpc("training_assessment_grants_read")
    : view === "history" && id(assignment) ? client.rpc("training_assessment_admin_history", { p_assignment: assignment }) : null;
  if (!operation) return privateJson({ error: "Invalid assessment view" }, 400);
  const { data, error } = await operation;
  return error ? privateJson({ error: "Assessment view unavailable" }, 403) : privateJson({ data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return privateJson({ error: "Invalid request" }, 400);
  let operation: ReturnType<typeof client.rpc> | null = null;
  switch (body.action) {
    case "GRANT": if (id(body.personId) && ["ASSESSMENT_AUTHOR", "ASSESSMENT_PUBLISHER"].includes(body.capability) && reason(body.reason))
      operation = client.rpc("training_assessment_grant", { p_person: body.personId, p_capability: body.capability, p_reason: body.reason }); break;
    case "REVOKE": if (id(body.grantId) && reason(body.reason)) operation = client.rpc("training_assessment_revoke", { p_grant: body.grantId, p_reason: body.reason }); break;
    case "CREATE": if (id(body.courseVersionId) && Array.isArray(body.questions)) operation = client.rpc("training_assessment_create", { p_course_version: body.courseVersionId, p_questions: body.questions }); break;
    case "EDIT": if (id(body.versionId) && revision(body.revision) && Array.isArray(body.questions)) operation = client.rpc("training_assessment_edit", { p_version: body.versionId, p_revision: body.revision, p_questions: body.questions }); break;
    case "PUBLISH": if (id(body.versionId) && revision(body.revision)) operation = client.rpc("training_assessment_publish", { p_version: body.versionId, p_revision: body.revision }); break;
    case "RETIRE": if (id(body.versionId) && reason(body.reason)) operation = client.rpc("training_assessment_retire", { p_version: body.versionId, p_reason: body.reason }); break;
    case "ABANDON_DRAFT": if (id(body.versionId) && revision(body.revision) && reason(body.reason)) operation = client.rpc("training_assessment_abandon_draft", { p_version: body.versionId, p_revision: body.revision, p_reason: body.reason }); break;
    case "START": if (id(body.assignmentId) && id(body.versionId) && id(body.requestId)) operation = client.rpc("training_assessment_start", { p_assignment: body.assignmentId, p_version: body.versionId, p_request: body.requestId }); break;
    case "SAVE": if (id(body.attemptId) && revision(body.revision) && answers(body.answers) && id(body.requestId)) operation = client.rpc("training_assessment_save", { p_attempt: body.attemptId, p_revision: body.revision, p_answers: body.answers, p_request: body.requestId }); break;
    case "SUBMIT": if (id(body.attemptId) && revision(body.revision) && answers(body.answers) && id(body.requestId)) operation = client.rpc("training_assessment_submit", { p_attempt: body.attemptId, p_revision: body.revision, p_answers: body.answers, p_request: body.requestId }); break;
    case "ABANDON": if (id(body.attemptId) && revision(body.revision) && id(body.requestId)) operation = client.rpc("training_assessment_abandon", { p_attempt: body.attemptId, p_revision: body.revision, p_request: body.requestId }); break;
  }
  if (!operation) return privateJson({ error: "Invalid assessment action" }, 400);
  const { data, error } = await operation;
  return error ? privateJson({ error: "Assessment action denied or stale" }, 403) : privateJson({ data });
}
