import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteBookWorkspace } from "@/components/site-book-workspace";
import "../site-book.css";

export const dynamic = "force-dynamic";
export default async function SiteBookServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  if (!isUuid(serviceId)) notFound();
  if (!await getPrincipal(await createServerSupabase())) redirect(`/?next=${encodeURIComponent(`/site-book/${serviceId}`)}`);
  return <main className="enterprise-main site-book-page"><SiteBookWorkspace serviceId={serviceId} /></main>;
}
