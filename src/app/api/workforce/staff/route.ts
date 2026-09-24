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
  const search = q.get("search")?.trim() ?? "";
  const person = q.get("person");
  const week = londonWeekStart(q.get("week") ?? londonToday());
  const offset = Number(q.get("offset") ?? 0);
  if (!week || search.length > 80 || /[\x00-\x1f\x7f]/.test(search) ||
    (person && !isUuid(person)) || !Number.isInteger(offset) || offset < 0 || offset > 10000)
    return privateJson({ error: "Invalid Staff schedule filter" }, 400);
  const { data, error } = person
    ? await client.rpc("workforce_person_week_08a", { p_person: person, p_week: week, p_offset: offset, p_limit: 30 })
    : await client.rpc("workforce_staff_choices", { p_search: search, p_offset: offset, p_limit: 20 });
  return error ? privateJson({ error: "Staff schedule unavailable" }, 503)
    : privateJson(person ? { schedule: data } : { choices: data });
}
