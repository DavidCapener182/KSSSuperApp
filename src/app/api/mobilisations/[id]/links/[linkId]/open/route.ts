import { NextResponse } from "next/server";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { canUseDocuments, readDocumentRequest } from "@/lib/documents/policy";
import { notFound, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

type LinkedSource = { id: string; sourceType: string; sourceId: string | null };

// DOCUMENT_VERSION is the personnel document_versions identity in the 18A contract.
// Resolve it on every navigation; a Mobilisation link never grants evidence access.
export async function GET(request: Request, { params }: {
  params: Promise<{ id: string; linkId: string }>;
}) {
  const { id, linkId } = await params;
  if (!isUuid(id) || !isUuid(linkId)) return notFound();
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!(principal.roles.includes("OFFICE_ADMIN") || principal.roles.includes("SUPER_ADMIN")) ||
    !canUseDocuments(principal)) return notFound();

  const { data: detail, error: detailError } = await client.rpc("mobilisation_detail", { p_id: id });
  if (detailError || !detail || typeof detail !== "object") return notFound();
  const links = Array.isArray(detail.links) ? detail.links as LinkedSource[] : [];
  const link = links.find((row) => row.id === linkId && row.sourceType === "DOCUMENT_VERSION" &&
    typeof row.sourceId === "string" && isUuid(row.sourceId));
  if (!link?.sourceId) return notFound();

  const { data: version, error: versionError } = await client.from("document_versions")
    .select("id,document_id,upload_state").eq("id", link.sourceId).maybeSingle<{
      id: string; document_id: string; upload_state: string;
    }>();
  if (versionError || !version || version.upload_state !== "SUBMITTED") return notFound();
  const { data: document, error: documentError } = await client.from("documents")
    .select("request_id").eq("id", version.document_id).maybeSingle<{ request_id: string }>();
  if (documentError || !document) return notFound();
  const evidence = await readDocumentRequest(client, document.request_id);
  if (!evidence || !evidence.versions.some((row) => row.id === version.id && row.upload_state === "SUBMITTED"))
    return notFound();

  const destination = new URL(`/documents/${evidence.request.id}?version=${version.id}`, request.url);
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
