import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { readDirectory } from "@/lib/people/directory";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: RouteContext<"/api/people/directory/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const result = await readDirectory(client, principal,
    { search: "", role: "", onboarding: "", offset: 0, limit: 1 }, id);
  return result?.items[0] ? privateJson(result.items[0]) : notFound();
}
