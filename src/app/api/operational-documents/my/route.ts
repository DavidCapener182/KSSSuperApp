import { getPrincipal } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const { data, error } = await client.rpc("operational_document_my_list");
  return error ? privateJson({ error: "Required reading unavailable" }, 503) : privateJson(data);
}
