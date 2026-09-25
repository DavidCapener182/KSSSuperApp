import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) return forbidden();
  const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000)
    return privateJson({ error: "Invalid page" }, 400);
  const { data, error } = await client.rpc("commercial_mobilisation_portfolio", { p_offset: offset, p_limit: 25 });
  return error ? privateJson({ error: "Mobilisation portfolio unavailable" }, 503) : privateJson(data);
}
