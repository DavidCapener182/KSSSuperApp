import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal } from "@/lib/auth/principal";
import { isUuid } from "@/lib/auth/principal";

export const CONTROLLED_BUCKET = "enterprise-controlled-documents";
export const CONTROLLED_MAX_BYTES = 1024 * 1024;
export const CONTROLLED_FAMILY = "ONBOARDING_TERMS_SYNTHETIC";

export type ControlledVersion = {
  id: string; document_id: string; version_number: number; title: string; object_key: string;
  original_filename: string; mime_type: string; byte_size: number; sha256: string;
  upload_state: "PENDING_UPLOAD" | "READY"; state: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  scan_state: "NOT_SCANNED"; published_at: string | null; effective_on: string | null;
};

export async function hasControlledPublisherGrant(client: SupabaseClient, principal: Principal) {
  if (!principal.roles.includes("OFFICE_ADMIN")) return false;
  const now = new Date().toISOString();
  const { data, error } = await client.from("controlled_publisher_grants").select("id")
    .eq("person_id", principal.personId).eq("family", CONTROLLED_FAMILY)
    .is("revoked_at", null).lte("effective_from", now).gt("effective_until", now).limit(1);
  return !error && Boolean(data?.length);
}

export async function readControlledVersion(client: SupabaseClient, versionId: string) {
  if (!isUuid(versionId)) return null;
  const { data, error } = await client.from("controlled_document_versions").select("*")
    .eq("id", versionId).maybeSingle<ControlledVersion>();
  return error ? null : data;
}
