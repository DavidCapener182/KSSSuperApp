import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { checkedBytes, sha256 } from "@/lib/documents/file";
import { boundedMultipart } from "@/lib/documents/body";
import { documentServerProof } from "@/lib/documents/server-proof";
import { canSubmitDocument, DOCUMENT_BUCKET, MAX_DOCUMENT_BYTES, readDocumentRequest } from "@/lib/documents/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canSubmitDocument(principal)) return forbidden();
  const id = (await params).id;
  const item = await readDocumentRequest(client, id);
  if (!item || item.request.target_person_id !== principal.personId) return notFound();
  const latest = item.versions.find((row) => row.upload_state === "SUBMITTED");
  const latestReview = latest && item.reviews.find((row) => row.version_id === latest.id);
  if (latest && latestReview?.decision !== "REJECTED") return privateJson({ error: "Review or accepted evidence prevents replacement" }, 409);
  if (item.request.status === "SUBMITTED" && !latest) return privateJson({ error: "Upload conflict" }, 409);
  let form: FormData | null;
  try { form = await boundedMultipart(request, MAX_DOCUMENT_BYTES + 262144); }
  catch (error) { if (error instanceof RangeError) return privateJson({ error: "File too large" }, 413); throw error; }
  const file = form?.get("file");
  if (!(file instanceof File)) return privateJson({ error: "Choose a file" }, 400);
  const checked = await checkedBytes(file);
  if (!checked) return privateJson({ error: "Unsupported or invalid file" }, 400);
  const { data: pending, error: pendingError } = await client.rpc("begin_document_upload", {
    requested_id: id, supplied_name: checked.filename, supplied_mime: checked.mimeType,
    supplied_size: checked.bytes.length, supplied_sha256: checked.sha256,
    server_proof: documentServerProof("begin", id, checked.filename, checked.mimeType, String(checked.bytes.length), checked.sha256),
  });
  const attempt = pending?.[0] as { version_id: string; object_key: string } | undefined;
  if (pendingError || !attempt) return privateJson({ error: "Upload conflict or denied" }, 409);
  const upload = await client.storage.from(DOCUMENT_BUCKET).upload(attempt.object_key, checked.bytes, {
    contentType: checked.mimeType, upsert: false, cacheControl: "0",
  });
  if (upload.error) {
    // A retry may find the first attempt's object. Reconcile exact bytes below.
    const probe = await client.storage.from(DOCUMENT_BUCKET).download(attempt.object_key);
    if (probe.error || !probe.data) return privateJson({ error: "Upload failed; retry this request" }, 503);
  }
  const stored = await client.storage.from(DOCUMENT_BUCKET).download(attempt.object_key);
  if (stored.error || !stored.data) return privateJson({ error: "Upload pending; retry this request" }, 503);
  const actual = await stored.data.arrayBuffer();
  if (actual.byteLength !== checked.bytes.length || sha256(actual) !== checked.sha256) {
    return privateJson({ error: "Upload conflict; contact an administrator" }, 409);
  }
  const { data: finalised, error: finaliseError } = await client.rpc("finalize_document_upload", {
    requested_id: id, version_id: attempt.version_id,
    server_proof: documentServerProof("finalize", id, attempt.version_id, checked.sha256),
  });
  if (finaliseError || !finalised) return privateJson({ error: "Upload stored but pending confirmation; retry this request" }, 503);
  return privateJson({ status: "SUBMITTED", versionId: attempt.version_id, scanState: "NOT_SCANNED" }, 201);
}
