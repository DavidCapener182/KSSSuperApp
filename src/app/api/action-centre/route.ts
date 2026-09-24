import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

const sections = ["UNREAD", "REQUIRES_ACTION", "RECENT", "DISMISSED"] as const;

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();

  const params = new URL(request.url).searchParams;
  const section = params.get("section") ?? "UNREAD";
  const offset = Number(params.get("offset") ?? "0");
  if (!(sections as readonly string[]).includes(section) || !Number.isInteger(offset) || offset < 0 || offset > 10000) {
    return privateJson({ error: "Invalid Action Centre view" }, 400);
  }
  const { data, error } = await client.rpc("staff_action_centre", {
    p_section: section, p_offset: offset, p_limit: 25,
  });
  if (error) return privateJson({ error: "Action Centre unavailable" }, 503);
  return privateJson(data);
}
