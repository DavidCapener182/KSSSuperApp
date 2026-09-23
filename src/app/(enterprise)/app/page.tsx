import Link from "next/link";
import { redirect } from "next/navigation";
import { navigationFor } from "@/lib/auth/capabilities";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fapp");
  const links = navigationFor(principal).filter((item) => item.href !== "/app");
  const staffOnly = principal.roles.length === 1 && principal.roles[0] === "SECURITY_STAFF";
  return <main className="enterprise-main">
    <p className="eyebrow">Development workspace</p>
    <h1>{staffOnly ? "My Work" : "Home"}</h1>
    <p className="enterprise-intro">Welcome, {principal.displayName}. These are the functions currently available to your account.</p>
    <div className="enterprise-card-grid">
      {links.map((link) => <Link className="enterprise-card" href={link.href} key={link.href}><strong>{link.label}</strong><span>{link.href === "/people" ? "Find staff and open a permission-scoped staff record." : link.href === "/work" ? "Open your assigned document reviews and CRM follow-ups." : link.href === "/crm" ? "Manage the commercial pipeline, activities and follow-ups." : link.href === "/sites" ? "Open the Sites you are authorised to use." : link.href === "/documents" ? "View your authorised synthetic document requests." : link.href === "/onboarding" ? "See your authorised synthetic starter checklist and next actions." : "View your current Enterprise identity and roles."}</span></Link>)}
    </div>
    <p className="enterprise-honesty">This development workspace does not contain live operational data.</p>
  </main>;
}
