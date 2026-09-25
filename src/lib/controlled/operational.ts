import type { SupabaseClient } from "@supabase/supabase-js";

export async function operationalCapabilities(client: SupabaseClient) {
  const { data, error } = await client.rpc("operational_document_capabilities");
  if (error || !data || typeof data !== "object") return { publish: false, assign: false };
  const value = data as { publish?: unknown; assign?: unknown };
  return { publish: value.publish === true, assign: value.assign === true };
}
