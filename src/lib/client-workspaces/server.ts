import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

import type { Issue, Workspace } from "./types";
export async function workspaceClient() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect("/?next=%2Fclient-workspaces");
  return client;
}
export async function readWorkspace(client: SupabaseClient, id: string): Promise<Workspace> {
  if (!isUuid(id)) notFound();
  const { data, error } = await client.rpc("cw_workspace", { p_workspace: id });
  if (error || !data) notFound();
  return data as Workspace;
}
export async function readIssues(client: SupabaseClient, id: string): Promise<Issue[]> {
  if (!isUuid(id)) notFound();
  const { data, error } = await client.rpc("cw_issues", { p_workspace: id });
  if (error || !Array.isArray(data)) notFound();
  return data as Issue[];
}
export async function readIssue(client: SupabaseClient, workspaceId: string, issueId: string): Promise<Issue> {
  if (!isUuid(workspaceId) || !isUuid(issueId)) notFound();
  const { data, error } = await client.rpc("cw_issue", { p_workspace: workspaceId, p_issue: issueId });
  if (error || !data) notFound();
  return data as Issue;
}

export type { Issue, Workspace } from "./types";
