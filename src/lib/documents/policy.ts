import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { isUuid } from "@/lib/auth/principal";

export const DOCUMENT_BUCKET = "enterprise-personnel-evidence";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export type DocumentRequest = {
  id: string; title: string; status: "REQUESTED" | "SUBMITTED";
  target_person_id: string; requester_person_id: string; site_id: string | null;
  created_at: string; submitted_at: string | null;
};
export type DocumentVersion = {
  id: string; document_id: string; version_number: number; object_key: string;
  original_filename: string; mime_type: string; byte_size: number; sha256: string;
  uploader_person_id: string; upload_state: "PENDING_UPLOAD" | "SUBMITTED"; scan_state: "NOT_SCANNED";
  submitted_at: string | null;
};
export type DocumentReview = {
  id: string; version_id: string; reviewer_person_id: string;
  decision: "ACCEPTED_AS_EVIDENCE" | "REJECTED";
  reason_code: string | null; reviewer_comment: string | null; decided_at: string;
};

export function canUseDocuments(principal: Principal) {
  return hasCapability(principal, "DOCUMENT_SELF_READ") || hasCapability(principal, "DOCUMENT_OFFICE_REVIEW");
}
export function canCreateDocumentRequest(principal: Principal) {
  return hasCapability(principal, "DOCUMENT_REQUEST_CREATE");
}
export function canSubmitDocument(principal: Principal) {
  return hasCapability(principal, "DOCUMENT_SELF_SUBMIT");
}
export function canReviewDocument(principal: Principal) {
  return hasCapability(principal, "DOCUMENT_EVIDENCE_REVIEW");
}
export async function readDocumentRequest(client: SupabaseClient, id: string) {
  if (!isUuid(id)) return null;
  const { data: request, error } = await client.from("document_requests")
    .select("id,title,status,target_person_id,requester_person_id,site_id,created_at,submitted_at")
    .eq("id", id).maybeSingle<DocumentRequest>();
  if (error || !request) return null;
  const { data: doc, error: docError } = await client.from("documents")
    .select("id").eq("request_id", id).maybeSingle<{ id: string }>();
  if (docError || !doc) return null;
  const { data: versions, error: versionError } = await client.from("document_versions")
    .select("id,document_id,version_number,object_key,original_filename,mime_type,byte_size,sha256,uploader_person_id,upload_state,scan_state,submitted_at")
    .eq("document_id", doc.id).order("version_number", { ascending: false }).returns<DocumentVersion[]>();
  if (versionError) return null;
  const { data: reviews, error: reviewError } = await client.from("document_reviews")
    .select("id,version_id,reviewer_person_id,decision,reason_code,reviewer_comment,decided_at")
    .eq("request_id", id).order("decided_at", { ascending: false }).returns<DocumentReview[]>();
  if (reviewError) return null;
  const { data: subjectName } = await client.rpc("document_subject_name", { requested_id: id });
  return { request, documentId: doc.id, versions: versions ?? [], reviews: reviews ?? [],
    subjectName: typeof subjectName === "string" ? subjectName : null };
}
export function publicDocument(value: NonNullable<Awaited<ReturnType<typeof readDocumentRequest>>>) {
  const submitted = value.versions.filter((row) => row.upload_state === "SUBMITTED");
  const version = submitted[0];
  const pending = value.versions.find((row) => row.upload_state === "PENDING_UPLOAD");
  const reviewFor = (id: string) => value.reviews.find((row) => row.version_id === id);
  const review = version ? reviewFor(version.id) : null;
  const workflowStatus = !version ? "REQUESTED" : review?.decision === "REJECTED"
    ? "REJECTED_ACTION_REQUIRED" : review?.decision === "ACCEPTED_AS_EVIDENCE"
      ? "ACCEPTED_AS_EVIDENCE" : "AWAITING_REVIEW";
  const publicVersion = (row: DocumentVersion) => ({
    id: row.id, number: row.version_number, filename: row.original_filename,
    mimeType: row.mime_type, byteSize: row.byte_size, sha256: row.sha256,
    scanState: row.scan_state, submittedAt: row.submitted_at,
    review: reviewFor(row.id) ?? null,
  });
  return {
    id: value.request.id, title: value.request.title, status: value.request.status,
    targetPersonId: value.request.target_person_id, requesterPersonId: value.request.requester_person_id,
    siteId: value.request.site_id, createdAt: value.request.created_at, submittedAt: value.request.submitted_at,
    subjectName: value.subjectName, workflowStatus, hasPendingUpload: Boolean(pending),
    canUploadReplacement: workflowStatus === "REJECTED_ACTION_REQUIRED",
    version: version ? publicVersion(version) : null,
    versions: submitted.map(publicVersion),
  };
}
