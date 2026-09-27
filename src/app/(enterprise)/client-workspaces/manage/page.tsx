import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { WorkspaceAccessAdmin } from "@/components/workspace-access-admin";
export const dynamic="force-dynamic";
export default async function Page() {
 const client=await createServerSupabase(); const principal=await getPrincipal(client);
 if(!principal?.roles.includes("SUPER_ADMIN")) notFound();
 const [registry,choices]=await Promise.all([client.rpc("cw_admin_registry"),client.rpc("cw_admin_choices")]);
 if(registry.error||choices.error) return <main className="cw-page"><p role="alert">Workspace access is unavailable.</p></main>;
 return <main className="cw-page"><Link href="/settings" className="cw-back">← Settings</Link><header className="cw-header"><div><p className="cw-eyebrow">Super Admin · reasoned oversight</p><h1>Workspace access</h1><p>Provision an existing Client Organisation and grant an exact Person the Loss Prevention module.</p></div></header><WorkspaceAccessAdmin registry={registry.data||[]} choices={choices.data||{organisations:[],people:[]}}/></main>;
}
