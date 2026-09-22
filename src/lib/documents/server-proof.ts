import { createHmac } from "node:crypto";

/** Server-only proof for trusted byte validation; never import in a client component. */
export function documentServerProof(...parts: string[]) {
  const secret = process.env.KSS_DOCUMENT_SIGNING_SECRET;
  if (!secret || !/^[0-9a-f]{64}$/.test(secret)) throw new Error("Document signing secret is not configured");
  return createHmac("sha256", Buffer.from(secret, "hex")).update(parts.join("\x1f"), "utf8").digest("hex");
}
