import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { londonToday, londonWeekStart } from "@/lib/events/workforce-week";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!hasCapability(principal, "WORKFORCE_USE")) return forbidden();
  const q = new URL(request.url).searchParams;
  const rawWeek = q.get("week") ?? londonToday();
  const week = londonWeekStart(rawWeek);
  const event = q.get("event") || null; const site = q.get("site") || null;
  const role = q.get("role") || null; const owner = q.get("owner") || null;
  const clientName = q.get("client")?.trim() || null;
  const offset = Number(q.get("offset") ?? 0);
  const yesNo = (value: string | null) => value === null || value === "true" || value === "false";
  if (!week || [event,site,role,owner].some((id) => id && !isUuid(id)) ||
    (clientName && (clientName.length > 80 || /[\x00-\x1f\x7f]/.test(clientName))) ||
    !yesNo(q.get("gaps")) || !yesNo(q.get("conflicts")) ||
    !Number.isInteger(offset) || offset < 0 || offset > 10000)
    return privateJson({ error: "Invalid Workforce filter" }, 400);
  const { data, error } = await client.rpc("workforce_week_08a", {
    p_week: week, p_event: event, p_site: site, p_client: clientName, p_role: role, p_owner: owner,
    p_gaps: q.get("gaps") === "true", p_conflicts: q.get("conflicts") === "true", p_offset: offset, p_limit: 40,
  });
  return error ? privateJson({ error: "Workforce schedule unavailable" }, 503) : privateJson({ schedule: data });
}
