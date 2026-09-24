import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const validId = (v: unknown): v is string => typeof v === "string" && isUuid(v);
const validText = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  if (courseId && !validId(courseId)) return privateJson({ error: "Invalid course" }, 400);
  const view = url.searchParams.get("view");
  const operation = view === "grants" && principal.roles.includes("SUPER_ADMIN") ? client.rpc("training_grants")
    : view === "admin" ? client.rpc("training_admin", { p_course: courseId })
    : view === "history" && courseId ? client.rpc("training_history", { p_course: courseId })
    : view === null ? client.rpc("training_catalogue", { p_course: courseId }) : null;
  if (!operation) return privateJson({ error: "Invalid view" }, 400);
  const { data, error } = await operation;
  return error ? privateJson({ error: "Training view unavailable" }, 403) : privateJson({ data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return privateJson({ error: "Invalid request" }, 400);
  const action = body.action;
  let operation: ReturnType<typeof client.rpc> | null = null;
  if (action === "CREATE_COURSE" && validText(body.title, 160) && validText(body.summary, 600) && Array.isArray(body.modules))
    operation = client.rpc("training_create_course", { p_title: body.title, p_summary: body.summary, p_content: body.modules });
  else if (action === "CREATE_DRAFT" && validId(body.courseId))
    operation = client.rpc("training_create_draft", { p_course: body.courseId });
  else if (action === "EDIT_DRAFT" && validId(body.versionId) && Number.isInteger(body.revision) && validText(body.title, 160) && validText(body.summary, 600) && Array.isArray(body.modules))
    operation = client.rpc("training_edit_draft", { p_version: body.versionId, p_revision: body.revision, p_title: body.title, p_summary: body.summary, p_content: body.modules });
  else if (action === "PUBLISH" && validId(body.versionId) && Number.isInteger(body.revision))
    operation = client.rpc("training_publish", { p_version: body.versionId, p_revision: body.revision });
  else if (action === "RETIRE" && validId(body.versionId) && validText(body.reason, 300))
    operation = client.rpc("training_retire", { p_version: body.versionId, p_reason: body.reason });
  else if (action === "ABANDON" && validId(body.versionId) && Number.isInteger(body.revision) && validText(body.reason, 300))
    operation = client.rpc("training_abandon_draft", { p_version: body.versionId, p_revision: body.revision, p_reason: body.reason });
  else if (action === "GRANT" && principal.roles.includes("SUPER_ADMIN") && validId(body.personId) && validText(body.reason, 300) && ["TRAINING_AUTHOR", "TRAINING_PUBLISHER"].includes(body.capability))
    operation = client.rpc("training_grant", { p_person: body.personId, p_capability: body.capability, p_reason: body.reason });
  else if (action === "REVOKE" && principal.roles.includes("SUPER_ADMIN") && validId(body.grantId) && validText(body.reason, 300))
    operation = client.rpc("training_revoke", { p_grant: body.grantId, p_reason: body.reason });
  if (!operation) return privateJson({ error: "Invalid training action" }, 400);
  const { data, error } = await operation;
  return error ? privateJson({ error: "Training action denied or stale" }, 403) : privateJson({ data });
}
