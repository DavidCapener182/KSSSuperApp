import { getPrincipal } from "@/lib/auth/principal";
import { canUseDocuments, publicDocument, readDocumentRequest } from "@/lib/documents/policy";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canUseDocuments(principal)) return forbidden();
  const item = await readDocumentRequest(client, (await params).id);
  if (!item) return notFound();
  return privateJson({ request: publicDocument(item) });
}
