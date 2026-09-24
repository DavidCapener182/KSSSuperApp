import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { addCivilDays, londonToday, validDate } from "@/lib/events/workforce-week";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((role) => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) return forbidden();

  const query = new URL(request.url).searchParams;
  const today = londonToday();
  const preset = query.get("preset") ?? "last28";
  const range = preset === "today" ? [today, addCivilDays(today, 1)]
    : preset === "last7" ? [addCivilDays(today, -6), addCivilDays(today, 1)]
      : preset === "last28" ? [addCivilDays(today, -27), addCivilDays(today, 1)]
        : [query.get("start") ?? "", query.get("end") ?? ""];
  const [start, end] = range;
  const mode = query.get("mode") ?? "CURRENT";
  const source = query.get("source") || null;
  const ids = ["client", "site", "service", "event"] as const;
  const filters = Object.fromEntries(ids.map((key) => [key, query.get(key) || null])) as Record<(typeof ids)[number], string | null>;
  const offset = Number(query.get("offset") ?? 0);
  if (!["today", "last7", "last28", "custom"].includes(preset) || !validDate(start) || !validDate(end)
    || end <= start || end > addCivilDays(start, 90) || mode !== "CURRENT" && mode !== "HISTORICAL"
    || source !== null && source !== "EVENT" && source !== "SITE_SHIFT"
    || ids.some((key) => filters[key] && !isUuid(filters[key]!))
    || !Number.isInteger(offset) || offset < 0 || offset > 10000) {
    return privateJson({ error: "Invalid reporting filter" }, 400);
  }
  const started = performance.now();
  const { data, error } = await client.rpc("management_report_23b", {
    p_start: start, p_end: end, p_mode: mode, p_client: filters.client, p_site: filters.site,
    p_service: filters.service, p_event: filters.event, p_source: source, p_offset: offset, p_limit: 30,
  });
  if (error) return privateJson({ error: "Management report unavailable" }, 503);
  return privateJson({ report: data, query_ms: Math.round(performance.now() - started) });
}
