import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { OperationalContactsManager } from "@/components/operational-contacts-manager";
import "../operational-contacts.css";

export const dynamic = "force-dynamic";
export default async function OperationalContactsManagePage({ searchParams }: {
 searchParams:Promise<{kind?:string;id?:string}>
}) {
 const principal=await getPrincipal(await createServerSupabase());
 if (!principal) redirect("/?next=%2Foperational-contacts%2Fmanage");
 if (!principal.roles.some((role)=>["OFFICE_ADMIN","SUPER_ADMIN","OPERATIONS"].includes(role))) notFound();
 const q=await searchParams;
 if (!q.id||!isUuid(q.id)||!["SITE","SITE_SERVICE","EVENT"].includes(q.kind??"")) notFound();
 return <main className="enterprise-main operational-contacts"><header><p className="enterprise-eyebrow">Synthetic development · Exact context</p>
  <h1>Operational contacts</h1><p>Publish only reviewed operational values for this specific context. Publication does not indicate availability or response.</p>
  </header><OperationalContactsManager kind={q.kind!} contextId={q.id} isSuper={principal.roles.includes("SUPER_ADMIN")} /></main>;
}
