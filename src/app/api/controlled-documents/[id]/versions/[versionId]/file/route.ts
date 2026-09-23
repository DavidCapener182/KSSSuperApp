import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, unauthorised } from "@/lib/auth/responses";
import { CONTROLLED_BUCKET, hasControlledPublisherGrant, readControlledVersion } from "@/lib/controlled/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!(await hasControlledPublisherGrant(client, principal))) return forbidden();
  const { id, versionId } = await params;
  const version = await readControlledVersion(client, versionId);
  if (!isUuid(id) || !version || version.document_id !== id || version.upload_state !== "READY") return notFound();
  const { data: doc } = await client.from("controlled_documents").select("created_by_person_id")
    .eq("id", id).maybeSingle<{ created_by_person_id: string }>();
  if (!doc || doc.created_by_person_id !== principal.personId) return forbidden();
  const { data, error } = await client.storage.from(CONTROLLED_BUCKET).download(version.object_key);
  if (error || !data) return notFound();
  return new Response(await data.arrayBuffer(), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=synthetic-controlled-document.pdf",
    "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff",
  } });
}
