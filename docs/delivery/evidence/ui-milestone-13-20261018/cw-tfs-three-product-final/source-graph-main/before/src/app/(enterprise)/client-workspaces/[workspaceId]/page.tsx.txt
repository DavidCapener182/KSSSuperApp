import Link from "next/link";
import { readWorkspace, workspaceClient } from "@/lib/client-workspaces/server";
export const dynamic = "force-dynamic";
export default async function Page({params}:{params:Promise<{workspaceId:string}>}) {
 const {workspaceId}=await params; const client=await workspaceClient(); const workspace=await readWorkspace(client,workspaceId);
 return <main className="cw-page"><Link className="cw-back" href="/client-workspaces">← All client workspaces</Link><header className="cw-header"><div><p className="cw-eyebrow">Restricted client workspace · {workspace.permission.toLowerCase()} access</p><h1>{workspace.name}</h1><p>Modules here use this exact Organisation identity and their own access grant.</p></div></header><div className="cw-directory"><Link className="cw-directory-card" href={`/client-workspaces/${workspace.id}/loss-prevention`}><span className="cw-eyebrow">TFS module</span><strong>Loss Prevention</strong><span>Evidence-first issue board and attributable history</span><span className="cw-card-arrow" aria-hidden>→</span></Link></div></main>;
}
