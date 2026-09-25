import "server-only";

import { createClient } from "@supabase/supabase-js";
import { sha256 } from "@/lib/documents/file";

const keyPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const buckets = new Set(["enterprise-controlled-documents", "training-certificates"]);

function serverStorage(bucket: string, objectKey: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!buckets.has(bucket) || !keyPattern.test(objectKey) || !url || !secret ||
    secret === process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucket);
}

export async function downloadPrivatePdf(bucket: string, objectKey: string, expectedSha256: string) {
  if (!/^[0-9a-f]{64}$/.test(expectedSha256)) return null;
  const storage = serverStorage(bucket, objectKey);
  if (!storage) return null;
  const { data, error } = await storage.download(objectKey);
  if (error || !data) return null;
  const bytes = await data.arrayBuffer();
  return sha256(bytes) === expectedSha256 ? bytes : null;
}

export async function uploadPrivatePdf(bucket: "training-certificates", objectKey: string, bytes: Uint8Array) {
  const storage = serverStorage(bucket, objectKey);
  if (!storage || bytes.length < 1 || bytes.length > 1048576 ||
    bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) return false;
  const { error } = await storage.upload(objectKey, Buffer.from(bytes), {
    contentType: "application/pdf", cacheControl: "0", upsert: false,
  });
  return !error;
}
