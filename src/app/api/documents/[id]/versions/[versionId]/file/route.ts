import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { canUseDocuments, DOCUMENT_BUCKET, readDocumentRequest } from "@/lib/documents/policy";
import { documentServerProof } from "@/lib/documents/server-proof";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canUseDocuments(principal)) return forbidden();
  const { id, versionId } = await params;
  const item = await readDocumentRequest(client, id);
  const version = item?.versions.find((row) => row.id === versionId && row.upload_state === "SUBMITTED");
  if (!item || !version) return notFound();
  const { data, error } = await client.storage.from(DOCUMENT_BUCKET).download(version.object_key);
  if (error || !data) return notFound();
  if (principal.roles.includes("SUPER_ADMIN")) {
    const audit = await client.rpc("audit_document_privileged_read", {
      requested_id: id, requested_version: version.id,
      server_proof: documentServerProof("read", id, version.id),
    });
    if (audit.error || !audit.data) return privateJson({ error: "Unable to complete retrieval" }, 503);
  }
  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": version.mime_type,
      "Content-Disposition": `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(version.original_filename)}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
