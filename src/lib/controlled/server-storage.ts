import "server-only";

import { createClient } from "@supabase/supabase-js";
import { CONTROLLED_BUCKET } from "@/lib/controlled/policy";
import { sha256 } from "@/lib/documents/file";

/**
 * Operational PDFs are fetched only after the caller's exact assignment has
 * been checked with their own session. Never return this client, key or URL.
 */
export async function downloadOperationalPdf(objectKey: string, expectedSha256: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret || secret === process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(objectKey) ||
    !/^[0-9a-f]{64}$/.test(expectedSha256)) return null;
  const storage = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await storage.storage.from(CONTROLLED_BUCKET).download(objectKey);
  if (error || !data) return null;
  const bytes = await data.arrayBuffer();
  return sha256(bytes) === expectedSha256 ? bytes : null;
}
