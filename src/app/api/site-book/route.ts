import { getPrincipal } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase();
  if (!await getPrincipal(client)) return unauthorised();
  const { data, error } = await client.rpc("site_book_services_14a");
  return error ? privateJson({ error: "Site books unavailable" }, 503) : privateJson({ services: data });
}
