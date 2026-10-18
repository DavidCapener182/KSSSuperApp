import Link from "next/link";
import styles from "@/components/tfs-workspace.module.css";
import { readIssues, readWorkspace, workspaceClient, readOwnerChoices } from "@/lib/client-workspaces/server";
import { TfsBoard } from "@/components/tfs-workspace-board";
export const dynamic = "force-dynamic";
export default async function Page({params}:{params:Promise<{workspaceId:string}>}) {
 const {workspaceId}=await params; const client=await workspaceClient();
 const workspace=await readWorkspace(client,workspaceId); const issues=await readIssues(client,workspaceId);
 const owners=workspace.permission!=="VIEW" ? await readOwnerChoices(client,workspaceId) : [];
 return <main className={`cw-page ${styles.page}`}><Link className="cw-back" href={`/client-workspaces/${workspaceId}`}>← {workspace.name}</Link><header className="cw-header cw-tfs-header"><div><p className="cw-eyebrow">KSS / {workspace.name}</p><h1>Loss prevention desk</h1><p>Store issues, evidence and next actions. {workspace.name === "The Fragrance Shop" ? "Source: TFSLossPrevention Outlook group." : "Review the source notes on each issue."}</p></div><span className="cw-workspace-name">{workspace.name === "The Fragrance Shop" ? "Saved board export · 27 Sep 2026 · Historical import in progress" : "Workspace issue board"}</span></header><TfsBoard workspaceId={workspaceId} workspaceName={workspace.name} issues={issues} owners={owners} canOperate={workspace.permission!=="VIEW"}/></main>;
}
