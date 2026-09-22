import { notFound, redirect } from "next/navigation";
import { DocumentsClient } from "@/components/documents-client";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function DocumentDetail({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  if (!isUuid(requestId)) notFound();
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect(`/?next=${encodeURIComponent(`/documents/${requestId}`)}`);
  const mayReview = hasCapability(principal, "DOCUMENT_OFFICE_REVIEW");
  if (!mayReview && !hasCapability(principal, "DOCUMENT_SELF_READ")) notFound();
  return <DocumentsClient requestId={requestId} mayCreate={hasCapability(principal, "DOCUMENT_REQUEST_CREATE")} mayUpload={hasCapability(principal, "DOCUMENT_SELF_SUBMIT")} isSuperAdmin={principal.roles.includes("SUPER_ADMIN")} />;
}
