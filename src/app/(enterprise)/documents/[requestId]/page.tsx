import { notFound, redirect } from "next/navigation";
import { DocumentsClient } from "@/components/documents-client";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function DocumentDetail({ params, searchParams }: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ version?: string | string[] }>;
}) {
  const { requestId } = await params;
  if (!isUuid(requestId)) notFound();
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect(`/?next=${encodeURIComponent(`/documents/${requestId}`)}`);
  const mayReview = hasCapability(principal, "DOCUMENT_OFFICE_REVIEW");
  if (!mayReview && !hasCapability(principal, "DOCUMENT_SELF_READ")) notFound();
  const requestedVersion = (await searchParams).version;
  const highlightVersionId = typeof requestedVersion === "string" && isUuid(requestedVersion) ? requestedVersion : undefined;
  return <DocumentsClient requestId={requestId} highlightVersionId={highlightVersionId} mayCreate={hasCapability(principal, "DOCUMENT_REQUEST_CREATE")} mayUpload={hasCapability(principal, "DOCUMENT_SELF_SUBMIT")} mayReview={hasCapability(principal, "DOCUMENT_EVIDENCE_REVIEW")} isSuperAdmin={principal.roles.includes("SUPER_ADMIN")} personId={principal.personId} />;
}
