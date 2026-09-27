import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal } from "@/lib/auth/principal";
import type { Issue, Workspace } from "@/lib/client-workspaces/types";

export type TfsWorkTask = {
  id: string;
  title: string;
  state: "OPEN";
  covering: false;
  createdAt: string;
  completedAt: null;
  sourceKind: "TFS_LP_ISSUE";
  sourceId: string;
  sourceTitle: string;
  clientLabel: string;
  sourceStatus: string;
  priority: Issue["priority"];
  redStockLoss: boolean;
  potentialInternalTheftReview: boolean;
  nextAction: string;
  dueAt: null;
  sourceHref: string;
};

function projectIssue(issue: Issue, workspace: Workspace, personId: string): TfsWorkTask | null {
  const redStockLoss = issue.issue_type === "Stock loss" && issue.priority === "Urgent";
  if (issue.workspace_id !== workspace.id || issue.owner_person_id !== personId || issue.status === "Closed" ||
    (!issue.potential_internal_theft_review && !redStockLoss)) return null;
  return {
    id: issue.id,
    title: `${issue.store_name} · ${issue.issue_type}`,
    state: "OPEN",
    covering: false,
    createdAt: issue.created_at,
    completedAt: null,
    sourceKind: "TFS_LP_ISSUE",
    sourceId: issue.id,
    sourceTitle: `${workspace.name}${issue.store_number ? ` · Store ${issue.store_number}` : ""}`,
    clientLabel: workspace.name === "The Fragrance Shop" ? "TFS" : workspace.name,
    sourceStatus: issue.status,
    priority: issue.priority,
    redStockLoss,
    potentialInternalTheftReview: issue.potential_internal_theft_review,
    nextAction: issue.next_action,
    dueAt: null,
    sourceHref: `/client-workspaces/${workspace.id}/loss-prevention/${issue.id}`,
  };
}

export async function listTfsIssueWork(client: SupabaseClient, principal: Principal): Promise<TfsWorkTask[] | null> {
  const { data: directory, error: directoryError } = await client.rpc("cw_directory");
  if (directoryError || !Array.isArray(directory)) return null;
  const workspaces = directory as Workspace[];
  const results = await Promise.all(workspaces.map((workspace) => client.rpc("cw_issues", { p_workspace: workspace.id })));
  if (results.some((result) => result.error || !Array.isArray(result.data))) return null;
  return results.flatMap((result, index) => (result.data as Issue[])
    .map((issue) => projectIssue(issue, workspaces[index], principal.personId))
    .filter((task): task is TfsWorkTask => task !== null));
}
