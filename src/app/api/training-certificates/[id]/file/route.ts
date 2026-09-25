import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { notFound, unauthorised } from "@/lib/auth/responses";
import { downloadPrivatePdf } from "@/lib/documents/private-pdf-storage";
import { documentServerProof } from "@/lib/documents/server-proof";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const proof = documentServerProof("certificate_file_info", id);
  const { data: info, error } = await client.rpc("training_certificate_file_info", { p_issue: id, p_proof: proof });
  if (error || !info?.objectKey || !info?.sha256) return notFound();
  const bytes = await downloadPrivatePdf("training-certificates", info.objectKey, info.sha256);
  if (!bytes || bytes.byteLength !== info.bytes) return notFound();
  const { data: current, error: recheckError } = await client.rpc("training_certificate_file_info", { p_issue: id, p_proof: proof });
  if (recheckError || current?.objectKey !== info.objectKey || current?.sha256 !== info.sha256) return notFound();
  return new Response(bytes, { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=training-certificate.pdf",
    "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff",
  } });
}
