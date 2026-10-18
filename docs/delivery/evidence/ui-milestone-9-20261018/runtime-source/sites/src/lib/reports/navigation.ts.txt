import { addCivilDays, londonToday, validDate } from "@/lib/events/workforce-week";

export const REPORT_MEASURES = ["REQUIRED", "ALLOCATED", "ACCEPTED", "REMAINING", "EXPLICIT_CONFLICTS"] as const;
export type ReportMeasure = (typeof REPORT_MEASURES)[number];
export type ReportNavigation = {
  preset: "today" | "last7" | "last28" | "custom";
  mode: "CURRENT" | "HISTORICAL";
  start: string; end: string; // Inclusive London UI dates; API end is exclusive.
  client: string; site: string; service: string; event: string;
  source: "" | "EVENT" | "SITE_SHIFT";
  offset: number; measure: ReportMeasure | null;
};
type Query = URLSearchParams | Record<string, string | string[] | undefined>;
const fields = ["preset", "mode", "start", "end", "client", "site", "service", "event", "source", "offset", "measure"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function defaultReportNavigation(today = londonToday()): ReportNavigation {
  return { preset: "last28", mode: "CURRENT", start: addCivilDays(today, -27), end: today,
    client: "", site: "", service: "", event: "", source: "", offset: 0, measure: null };
}

export function parseReportNavigation(query: Query, today = londonToday()): ReportNavigation | null {
  const values: Record<string, string> = {};
  const entries = query instanceof URLSearchParams ? [...query.entries()] : Object.entries(query);
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (!fields.includes(key) || Array.isArray(value) || Object.hasOwn(values, key)) return null;
    values[key] = value;
  }
  const state = defaultReportNavigation(today);
  if (values.preset !== undefined) {
    if (!["today", "last7", "last28", "custom"].includes(values.preset)) return null;
    state.preset = values.preset as ReportNavigation["preset"];
  }
  if (values.mode !== undefined) {
    if (!["CURRENT", "HISTORICAL"].includes(values.mode)) return null;
    state.mode = values.mode as ReportNavigation["mode"];
  }
  if (state.preset === "custom") {
    if (!validDate(values.start ?? "") || !validDate(values.end ?? "") || values.end < values.start ||
      !validDate(addCivilDays(values.end, 1)) || addCivilDays(values.end, 1) > addCivilDays(values.start, 90)) return null;
    state.start = values.start; state.end = values.end;
  } else {
    if (values.start !== undefined || values.end !== undefined) return null;
    state.start = addCivilDays(today, state.preset === "today" ? 0 : state.preset === "last7" ? -6 : -27);
  }
  for (const key of ["client", "site", "service", "event"] as const) {
    if (values[key] && !uuid.test(values[key])) return null;
    state[key] = (values[key] ?? "").toLowerCase();
  }
  if (values.source && !["EVENT", "SITE_SHIFT"].includes(values.source)) return null;
  state.source = (values.source ?? "") as ReportNavigation["source"];
  if (values.offset !== undefined && !/^(0|[1-9]\d*)$/.test(values.offset)) return null;
  state.offset = Number(values.offset ?? 0);
  if (!Number.isInteger(state.offset) || state.offset < 0 || state.offset > 10000 || state.offset % 30 !== 0) return null;
  if (values.measure !== undefined) {
    if (!REPORT_MEASURES.includes(values.measure as ReportMeasure)) return null;
    state.measure = values.measure as ReportMeasure;
  }
  return state;
}

export function reportNavigationQuery(state: ReportNavigation): string {
  const query = new URLSearchParams({ preset: state.preset, mode: state.mode });
  if (state.preset === "custom") { query.set("start", state.start); query.set("end", state.end); }
  for (const key of ["client", "site", "service", "event", "source"] as const) if (state[key]) query.set(key, state[key]);
  query.set("offset", String(state.offset));
  if (state.measure) query.set("measure", state.measure);
  return query.toString();
}

export function validReportNavigation(state: ReportNavigation): boolean {
  return parseReportNavigation(new URLSearchParams(reportNavigationQuery(state))) !== null;
}

export function reportHref(state: ReportNavigation): string {
  return `/management-reports?${reportNavigationQuery(state)}`;
}

export function reportApiQuery(state: ReportNavigation): string {
  const query = new URLSearchParams(reportNavigationQuery(state));
  query.delete("measure");
  if (state.preset === "custom") query.set("end", addCivilDays(state.end, 1));
  return query.toString();
}

export function safeReportReturn(value: unknown): string | undefined {
  if (typeof value !== "string" || !value || value.length > 1600 || /[%#\\\u0000-\u0020\u007f]/.test(value) ||
    (value !== "/management-reports" && !value.startsWith("/management-reports?"))) return undefined;
  try {
    const url = new URL(value, "http://kss.local");
    if (url.origin !== "http://kss.local" || url.pathname !== "/management-reports" || url.hash) return undefined;
    const state = parseReportNavigation(url.searchParams);
    return state ? reportHref(state) : undefined;
  } catch { return undefined; }
}

export function reportSourceHref(line: { source: "EVENT" | "SITE_SHIFT"; source_id: string; parent_id: string; site_id: string }, state: ReportNavigation): string | null {
  if (!["EVENT", "SITE_SHIFT"].includes(line.source) || ![line.source_id, line.parent_id, line.site_id].every(value => uuid.test(value)) || !validReportNavigation(state)) return null;
  const query = new URLSearchParams({ [line.source === "EVENT" ? "requirement" : "demand"]: line.source_id, reportReturn: reportHref(state) });
  return `${line.source === "EVENT" ? `/events/${line.parent_id}` : `/sites/${line.site_id}/services/${line.parent_id}`}?${query}`;
}
