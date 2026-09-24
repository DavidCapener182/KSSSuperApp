import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteBookAccess } from "@/components/site-book-access";
import "../site-book.css";

export const dynamic = "force-dynamic";
export default async function SiteBookAccessPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fsite-book%2Faccess");
  if (!principal.roles.some(r => r === "OFFICE_ADMIN" || r === "SUPER_ADMIN")) notFound();
  return <main className="enterprise-main site-book-page"><header className="site-book-header"><p>KSS Enterprise · Synthetic development</p><h1>Site Book access</h1><p>Issue finite, reasoned contributor and manager grants for an exact Site Service.</p></header><SiteBookAccess /></main>;
}
