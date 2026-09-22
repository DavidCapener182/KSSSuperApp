import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { canCreateDocumentRequest } from "@/lib/documents/policy";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canCreateDocumentRequest(principal)) return forbidden();
  const site = new URL(request.url).searchParams.get("siteId");
  if (site && !isUuid(site)) return privateJson({ error: "Invalid Site" }, 400);
  const { data, error } = await client.rpc("eligible_document_targets", { requested_site: site || null });
  if (error) return privateJson({ error: "Unable to load targets" }, 500);
  return privateJson({ targets: data ?? [] });
}
