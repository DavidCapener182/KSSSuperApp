import "server-only";

import { CONTROLLED_BUCKET } from "@/lib/controlled/policy";
import { downloadPrivatePdf } from "@/lib/documents/private-pdf-storage";

/**
 * Operational PDFs are fetched only after the caller's exact assignment has
 * been checked with their own session. Never return this client, key or URL.
 */
export async function downloadOperationalPdf(objectKey: string, expectedSha256: string) {
  return downloadPrivatePdf(CONTROLLED_BUCKET, objectKey, expectedSha256);
}
