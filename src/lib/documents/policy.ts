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
  upload_state: "PENDING_UPLOAD" | "SUBMITTED"; scan_state: "NOT_SCANNED";
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
    .select("id,document_id,version_number,object_key,original_filename,mime_type,byte_size,sha256,upload_state,scan_state")
    .eq("document_id", doc.id).order("version_number", { ascending: false }).returns<DocumentVersion[]>();
  if (versionError) return null;
  return { request, documentId: doc.id, versions: versions ?? [] };
}
export function publicDocument(value: NonNullable<Awaited<ReturnType<typeof readDocumentRequest>>>) {
  const version = value.versions.find((row) => row.upload_state === "SUBMITTED");
  return {
    id: value.request.id, title: value.request.title, status: value.request.status,
    targetPersonId: value.request.target_person_id, requesterPersonId: value.request.requester_person_id,
    siteId: value.request.site_id, createdAt: value.request.created_at, submittedAt: value.request.submitted_at,
    version: version ? { id: version.id, number: version.version_number, filename: version.original_filename,
      mimeType: version.mime_type, byteSize: version.byte_size, sha256: version.sha256, scanState: version.scan_state } : null,
  };
}
