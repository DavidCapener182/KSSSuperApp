import { notFound, redirect } from "next/navigation";
import { DocumentsClient } from "@/components/documents-client";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function DocumentsPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fdocuments");
  const mayReview = hasCapability(principal, "DOCUMENT_OFFICE_REVIEW");
  if (!mayReview && !hasCapability(principal, "DOCUMENT_SELF_READ")) notFound();
  return <DocumentsClient mayCreate={hasCapability(principal, "DOCUMENT_REQUEST_CREATE")} mayUpload={hasCapability(principal, "DOCUMENT_SELF_SUBMIT")} isSuperAdmin={principal.roles.includes("SUPER_ADMIN")} />;
}
