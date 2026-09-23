import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { isUuid } from "@/lib/auth/principal";
import { readDocumentRequest } from "@/lib/documents/policy";

type TaskRow = {
  id: string; task_type: "DOCUMENT_REVIEW" | "CRM_FOLLOW_UP"; title: string; state: "OPEN" | "DONE" | "CANCELLED";
  assignee_person_id: string; source_kind: "DOCUMENT_VERSION" | "CRM_OPPORTUNITY" | "CRM_ORGANISATION"; source_id: string;
  created_at: string; updated_at: string; completed_at: string | null;
  completion_kind: "DOCUMENT_REVIEW_DECISION" | null; completion_event_id: string | null;
  due_at: string | null;
};

export function canUseWork(principal: Principal) {
  return hasCapability(principal, "TASK_SELF_READ");
}

export async function resolveTask(client: SupabaseClient, principal: Principal, row: TaskRow) {
  if (!canUseWork(principal)) return null;
  if (row.task_type === "CRM_FOLLOW_UP" &&
    (row.source_kind === "CRM_OPPORTUNITY" || row.source_kind === "CRM_ORGANISATION") &&
    hasCapability(principal, "CRM_USE")) {
    if (row.assignee_person_id !== principal.personId && !principal.roles.includes("SUPER_ADMIN")) return null;
    if (row.source_kind === "CRM_OPPORTUNITY") {
      const { data, error } = await client.from("crm_opportunities")
        .select("id,title,crm_organisations(name)").eq("id", row.source_id).maybeSingle();
      if (error || !data) return null;
      return { id: row.id, title: row.title, state: row.state, createdAt: row.created_at,
        completedAt: row.completed_at, covering: false, sourceKind: row.source_kind, sourceId: row.source_id,
        sourceTitle: data.title, dueAt: row.due_at, sourceHref: `/crm/opportunities/${row.source_id}` };
    }
    const { data, error } = await client.from("crm_organisations")
      .select("id,name").eq("id", row.source_id).maybeSingle();
    if (error || !data) return null;
    return { id: row.id, title: row.title, state: row.state, createdAt: row.created_at,
      completedAt: row.completed_at, covering: false, sourceKind: row.source_kind, sourceId: row.source_id,
      sourceTitle: data.name, dueAt: row.due_at, sourceHref: `/crm/organisations/${row.source_id}` };
  }
  if (row.task_type !== "DOCUMENT_REVIEW" || row.source_kind !== "DOCUMENT_VERSION" ||
  !principal.roles.some((role) => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) return null;
  const { data: version, error: versionError } = await client.from("document_versions")
    .select("id,document_id,version_number,upload_state,submitted_at")
    .eq("id", row.source_id).maybeSingle<{ id: string; document_id: string; version_number: number; upload_state: string; submitted_at: string | null }>();
  if (versionError || !version || version.upload_state !== "SUBMITTED") return null;
  const { data: document, error: documentError } = await client.from("documents")
    .select("id,request_id,classification").eq("id", version.document_id)
    .maybeSingle<{ id: string; request_id: string; classification: string }>();
  if (documentError || !document || document.classification !== "PERSONNEL_PRIVATE") return null;
  const source = await readDocumentRequest(client, document.request_id);
  if (!source || source.documentId !== document.id ||
    !source.versions.some((item) => item.id === version.id && item.upload_state === "SUBMITTED")) return null;
  if (row.state === "DONE" && !source.reviews.some((review) => review.id === row.completion_event_id &&
    review.version_id === version.id)) return null;
  if (row.state === "OPEN" && source.reviews.some((review) => review.version_id === version.id)) return null;
  if (row.state === "CANCELLED" && source.reviews.some((review) => review.version_id === version.id)) return null;
  return {
    id: row.id, title: row.title, state: row.state, createdAt: row.created_at,
    covering: row.state === "OPEN" && !principal.roles.includes("SUPER_ADMIN") &&
      row.assignee_person_id !== principal.personId,
    completedAt: row.completed_at, sourceKind: row.source_kind, sourceId: version.id,
    versionNumber: version.version_number, submittedAt: version.submitted_at,
    requestTitle: source.request.title, subjectName: source.subjectName,
    dueAt: null,
    sourceHref: `/documents/${document.request_id}?version=${version.id}`,
  };
}

export async function readTask(client: SupabaseClient, principal: Principal, id: string) {
  if (!isUuid(id) || !canUseWork(principal)) return null;
  const { data, error } = await client.from("tasks").select("*").eq("id", id).maybeSingle<TaskRow>();
  if (error || !data) return null;
  return resolveTask(client, principal, data);
}

export async function listTasks(client: SupabaseClient, principal: Principal) {
  if (!canUseWork(principal)) return [];
  const results = await Promise.all(["OPEN", "DONE", "CANCELLED"].flatMap((state) => [
    client.from("tasks").select("*").eq("task_type", "DOCUMENT_REVIEW").eq("state", state)
      .order("created_at", { ascending: false }).limit(100).returns<TaskRow[]>(),
    client.from("tasks").select("*").eq("task_type", "CRM_FOLLOW_UP")
      .eq("assignee_person_id", principal.personId).eq("state", state)
      .order("created_at", { ascending: false }).limit(100).returns<TaskRow[]>(),
  ]));
  if (results.some((result) => result.error)) return null;
  const resolved = await Promise.all(results.flatMap((result) => result.data ?? [])
    .map((row) => resolveTask(client, principal, row)));
  return resolved.filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => (a.state === b.state ? b.createdAt.localeCompare(a.createdAt) :
      a.state === "OPEN" ? -1 : b.state === "OPEN" ? 1 : a.state === "DONE" ? -1 : 1));
}
