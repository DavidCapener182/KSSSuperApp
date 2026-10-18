import Link from "next/link";
import styles from "../workspace-directory.module.css";
import { readWorkspace, workspaceClient } from "@/lib/client-workspaces/server";
export const dynamic = "force-dynamic";
export default async function Page({params}:{params:Promise<{workspaceId:string}>}) {
 const {workspaceId}=await params; const client=await workspaceClient(); const workspace=await readWorkspace(client,workspaceId);
 return <main className={`cw-page ${styles.page}`}><Link className="cw-back" href="/client-workspaces">← All client workspaces</Link><header className="cw-header"><div><p className="cw-eyebrow">Restricted client workspace · {workspace.permission.toLowerCase()} access</p><h1>{workspace.name}</h1><p>Modules here use this exact Organisation identity and their own access grant.</p></div></header><section className={styles.module} aria-label="Available workspace module"><div><p className="cw-eyebrow">Available module</p><h2>Loss Prevention</h2><p>Review source evidence, record the next action and follow attributable issue history within this workspace.</p></div><Link className={styles.moduleLink} href={`/client-workspaces/${workspace.id}/loss-prevention`}>Open Loss Prevention <span aria-hidden="true">→</span></Link></section></main>;
}
