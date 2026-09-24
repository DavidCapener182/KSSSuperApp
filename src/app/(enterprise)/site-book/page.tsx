import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteBookWorkspace } from "@/components/site-book-workspace";
import "./site-book.css";

export const dynamic = "force-dynamic";
export default async function SiteBookPage() {
  if (!await getPrincipal(await createServerSupabase())) redirect("/?next=%2Fsite-book");
  return <main className="enterprise-main site-book-page"><header className="site-book-header"><p>KSS Enterprise · Synthetic development</p><h1>Site Book</h1><p>Routine operational notes, open items and shift handovers for your authorised Site Services.</p></header><SiteBookWorkspace /></main>;
}
