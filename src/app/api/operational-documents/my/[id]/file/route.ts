import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { notFound, unauthorised } from "@/lib/auth/responses";
import { downloadOperationalPdf } from "@/lib/controlled/server-storage";
import { documentServerProof } from "@/lib/documents/server-proof";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const { data: mine, error: listError } = await client.rpc("operational_document_my_list");
  const assignment = (mine?.assignments as Array<{ id: string; version_id: string; current: boolean; conflict: boolean }> | undefined)
    ?.find((item) => item.id === id);
  if (listError || !assignment?.current || assignment.conflict) return notFound();
  const { error: openError } = await client.rpc("operational_document_open", {
    assignment_id: id, server_proof: documentServerProof("operational_open", id, assignment.version_id),
  });
  if (openError) return notFound();
  const { data: info, error: infoError } = await client.rpc("operational_document_file_info", {
    assignment_id: id, server_proof: documentServerProof("operational_file_info", id),
  });
  if (infoError || !info?.objectKey || info.versionId !== assignment.version_id) return notFound();
  const bytes = await downloadOperationalPdf(info.objectKey, info.sha256);
  if (!bytes) return notFound();
  const { data: stillAllowed, error: recheckError } = await client.rpc("operational_document_file_info", {
    assignment_id: id, server_proof: documentServerProof("operational_file_info", id),
  });
  if (recheckError || stillAllowed?.objectKey !== info.objectKey ||
    stillAllowed?.versionId !== info.versionId) return notFound();
  return new Response(bytes, { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=synthetic-operational-document.pdf",
    "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff",
  } });
}
