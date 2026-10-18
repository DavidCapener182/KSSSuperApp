import Link from "next/link";
import { getPrincipal } from "@/lib/auth/principal";
import { workspaceClient, type Workspace } from "@/lib/client-workspaces/server";
export const dynamic = "force-dynamic";
export default async function Page() {
  const client = await workspaceClient();
  const principal = await getPrincipal(client);
  const { data, error } = await client.rpc("cw_directory");
  const workspaces = !error && Array.isArray(data) ? data as Workspace[] : [];
  const superAdmin = principal?.roles.includes("SUPER_ADMIN") ?? false;
  return <main className="cw-page"><header className="cw-header"><div><p className="cw-eyebrow">KSS Enterprise · restricted</p><h1>Client workspaces</h1><p>{superAdmin ? "All active Client workspaces appear here with read access." : "Only workspaces granted to your Person account appear here."}</p></div></header>
    {principal?.roles.includes("SUPER_ADMIN") && <p><Link className="cw-back" href="/client-workspaces/manage">Manage workspace access →</Link></p>}
    {error ? <p role="alert">Workspaces are unavailable. Try again later.</p> : workspaces.length === 0 ? <section className="cw-empty"><h2>{superAdmin ? "No active Client workspaces" : "No workspaces assigned"}</h2><p>{superAdmin ? "Create a workspace from an existing Client Organisation." : "Ask a Super Admin for an exact Client Workspace and module grant."}</p></section> :
      <div className="cw-directory">{workspaces.map(w => <Link className="cw-directory-card" key={w.id} href={`/client-workspaces/${w.id}`}><span className="cw-eyebrow">Client workspace</span><strong>{w.name}</strong><span>Loss Prevention · {w.permission.toLowerCase()} access</span><span className="cw-card-arrow" aria-hidden>→</span></Link>)}</div>}
  </main>;
}
