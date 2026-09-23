import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("OFFICE_ADMIN") && !principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "MY_CASES";
  const search = url.searchParams.get("search") ?? "";
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? "25");
  if (!Number.isInteger(offset) || !Number.isInteger(limit) || offset < 0 || offset > 10000 || limit < 1 || limit > 50 ||
    search.length > 100 || !["MY_CASES", "TEAM_QUEUE", "NEEDS_OFFICE", "WAITING_STAFF", "BLOCKED", "CANCELLED"].includes(view))
    return privateJson({ error: "Invalid queue filter" }, 400);
  const { data, error } = await client.rpc("list_onboarding_queue", {
    queue_view: view, search_text: search, page_offset: offset, page_size: limit,
  });
  return error || !data ? privateJson({ error: "Onboarding queue unavailable" }, 503) : privateJson(data);
}
