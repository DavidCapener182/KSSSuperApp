import { getPrincipal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { londonToday, londonWeekStart } from "@/lib/events/workforce-week";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!hasCapability(principal, "WORKFORCE_USE")) return forbidden();
  const week = londonWeekStart(new URL(request.url).searchParams.get("week") ?? londonToday());
  if (!week) return privateJson({ error: "Invalid Workforce week" }, 400);
  const { data, error } = await client.rpc("workforce_filter_choices", { p_week: week });
  return error ? privateJson({ error: "Workforce filters unavailable" }, 503) : privateJson({ choices: data });
}
