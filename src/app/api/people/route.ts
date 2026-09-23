import { getPrincipal } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { parseDirectoryFilters, readDirectory } from "@/lib/people/directory";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const filters = parseDirectoryFilters(new URL(request.url).searchParams);
  if (!filters) return privateJson({ error: "Invalid directory filter" }, 400);
  const result = await readDirectory(client, principal, filters);
  return result ? privateJson(result) : privateJson({ error: "People directory unavailable" }, 503);
}
