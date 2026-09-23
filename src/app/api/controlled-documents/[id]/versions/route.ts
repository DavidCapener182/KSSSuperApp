import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { boundedMultipart } from "@/lib/documents/body";
import { checkedBytes, sha256 } from "@/lib/documents/file";
import { documentServerProof } from "@/lib/documents/server-proof";
import { CONTROLLED_BUCKET, CONTROLLED_MAX_BYTES, hasControlledPublisherGrant } from "@/lib/controlled/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!(await hasControlledPublisherGrant(client, principal))) return forbidden();
  const id = (await params).id;
  if (!isUuid(id)) return privateJson({ error: "Invalid document" }, 400);
  const { data: doc } = await client.from("controlled_documents")
    .select("id,created_by_person_id").eq("id", id).maybeSingle<{ id: string; created_by_person_id: string }>();
  if (!doc || doc.created_by_person_id !== principal.personId) return forbidden();
  let form: FormData | null;
  try { form = await boundedMultipart(request, CONTROLLED_MAX_BYTES + 262144); }
  catch (error) { if (error instanceof RangeError) return privateJson({ error: "PDF too large" }, 413); throw error; }
  const file = form?.get("file");
  if (!(file instanceof File)) return privateJson({ error: "Choose a synthetic PDF" }, 400);
  const checked = await checkedBytes(file);
  if (!checked || checked.mimeType !== "application/pdf" || checked.bytes.length > CONTROLLED_MAX_BYTES ||
    !/^[a-z0-9][a-z0-9._ -]{0,160}\.pdf$/i.test(checked.filename))
    return privateJson({ error: "Choose a valid PDF below 1 MB" }, 400);
  const { data: pending, error: pendingError } = await client.rpc("begin_controlled_version", {
    requested_document: id, supplied_name: checked.filename, supplied_size: checked.bytes.length,
    supplied_sha256: checked.sha256,
    server_proof: documentServerProof("controlled_begin", id, checked.filename,
      String(checked.bytes.length), checked.sha256),
  });
  const attempt = pending?.[0] as { version_id: string; object_key: string } | undefined;
  if (pendingError || !attempt) return privateJson({ error: "Controlled draft version denied" }, 409);
  const upload = await client.storage.from(CONTROLLED_BUCKET).upload(attempt.object_key, checked.bytes, {
    contentType: "application/pdf", upsert: false, cacheControl: "0",
  });
  if (upload.error) return privateJson({ error: "Private PDF upload failed" }, 503);
  const stored = await client.storage.from(CONTROLLED_BUCKET).download(attempt.object_key);
  if (stored.error || !stored.data) return privateJson({ error: "Private PDF readback failed" }, 503);
  const bytes = await stored.data.arrayBuffer();
  if (bytes.byteLength !== checked.bytes.length || sha256(bytes) !== checked.sha256)
    return privateJson({ error: "PDF byte verification failed" }, 409);
  const { data: ready, error: readyError } = await client.rpc("finalize_controlled_version", {
    requested_version: attempt.version_id,
    server_proof: documentServerProof("controlled_finalize", attempt.version_id, checked.sha256),
  });
  return readyError || !ready ? privateJson({ error: "PDF finalisation denied" }, 503)
    : privateJson({ versionId: attempt.version_id, state: "DRAFT", scanState: "NOT_SCANNED" }, 201);
}
