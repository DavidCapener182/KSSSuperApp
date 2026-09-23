import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { canReviewDocument, readDocumentRequest } from "@/lib/documents/policy";
import { createServerSupabase } from "@/lib/supabase/server";

const REASONS = new Set([
  "UNREADABLE", "WRONG_DOCUMENT", "INCOMPLETE", "EXPIRED_OR_OUTDATED", "DETAILS_DO_NOT_MATCH", "OTHER",
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canReviewDocument(principal)) return forbidden();
  const id = (await params).id;
  const item = await readDocumentRequest(client, id);
  if (!item) return notFound();
  if (principal.personId === item.request.target_person_id ||
    (!principal.roles.includes("SUPER_ADMIN") && item.request.requester_person_id !== principal.personId)) return notFound();
  const input = await request.json().catch(() => null);
  const versionId = input?.versionId;
  const decision = input?.decision;
  const reason = input?.reasonCode ?? null;
  const comment = input?.comment ?? null;
  if (!isUuid(versionId) || !["ACCEPTED_AS_EVIDENCE", "REJECTED"].includes(decision)) return privateJson({ error: "Invalid review" }, 400);
  if (decision === "REJECTED") {
    if (!REASONS.has(reason) || typeof comment !== "string" || comment.trim().length < 10 ||
      comment.trim().length > 500 || /[\u0000-\u001f\u007f]/.test(comment)) return privateJson({ error: "Choose a reason and enter 10–500 characters of feedback" }, 400);
  } else if (reason !== null || comment !== null) return privateJson({ error: "Acceptance takes no rejection reason" }, 400);
  const latest = item.versions.find((row) => row.upload_state === "SUBMITTED");
  if (!latest || latest.id !== versionId || item.reviews.some((row) => row.version_id === versionId) ||
    latest.uploader_person_id === principal.personId) return privateJson({ error: "Review conflict" }, 409);
  const { data, error } = await client.rpc("review_document_version", {
    requested_id: id, reviewed_version: versionId, supplied_decision: decision,
    supplied_reason: reason, supplied_comment: decision === "REJECTED" ? comment.trim() : null,
  });
  if (error || !data) return privateJson({ error: "Review conflict or denied" }, 409);
  return privateJson({ id: data, decision, versionId }, 201);
}
