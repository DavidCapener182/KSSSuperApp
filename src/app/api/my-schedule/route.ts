import { getPrincipal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { londonToday, londonWeekStart } from "@/lib/events/workforce-week";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!hasCapability(principal, "SCHEDULE_SELF_READ")) return forbidden();
  const q = new URL(request.url).searchParams;
  const week = londonWeekStart(q.get("week") ?? londonToday());
  const offset = Number(q.get("offset") ?? 0);
  if (!week || !Number.isInteger(offset) || offset < 0 || offset > 10000)
    return privateJson({ error: "Invalid schedule week" }, 400);
  const { data, error } = await client.rpc("my_schedule", { p_week: week, p_offset: offset, p_limit: 50 });
  return error ? privateJson({ error: "My Schedule unavailable" }, 503) : privateJson({ schedule: data });
}
