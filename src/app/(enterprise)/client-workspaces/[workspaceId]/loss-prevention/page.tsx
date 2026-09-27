import Link from "next/link";
import { readIssues, readWorkspace, workspaceClient } from "@/lib/client-workspaces/server";
import { TfsBoard } from "@/components/tfs-workspace-board";
export const dynamic = "force-dynamic";
export default async function Page({params}:{params:Promise<{workspaceId:string}>}) {
 const {workspaceId}=await params; const client=await workspaceClient();
 const workspace=await readWorkspace(client,workspaceId); const issues=await readIssues(client,workspaceId);
 return <main className="cw-page"><Link className="cw-back" href={`/client-workspaces/${workspaceId}`}>← {workspace.name}</Link><header className="cw-header cw-tfs-header"><div><p className="cw-eyebrow">TFS · restricted Loss Prevention</p><h1>Loss Prevention</h1><p>Evidence signals need review. A loss or discrepancy does not establish theft or fault.</p></div><span className="cw-workspace-name">{workspace.name}</span></header><TfsBoard workspaceId={workspaceId} issues={issues} canOperate={workspace.permission!=="VIEW"}/></main>;
}
