import { londonWeekStart } from "@/lib/events/workforce-week";

export type WorkforceReturnState = {
  week: string; day: string; client: string; site: string; event: string;
  role: string; open: boolean; duty: string; source: "EVENT" | "SITE_SHIFT" | "";
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = /^\d{4}-\d{2}-\d{2}$/;

export function parseWorkforceReturnState(query: Record<string, string | undefined>): Partial<WorkforceReturnState> {
  const week = query.week && date.test(query.week) && londonWeekStart(query.week) === query.week ? query.week : undefined;
  const day = query.day && date.test(query.day) && londonWeekStart(query.day) === week ? query.day : undefined;
  const source = query.source === "EVENT" || query.source === "SITE_SHIFT" ? query.source : undefined;
  return {
    ...(week ? { week } : {}), ...(day ? { day } : {}),
    ...(query.client && query.client.length <= 80 && !/[\x00-\x1f\x7f]/.test(query.client) ? { client: query.client } : {}),
    ...(query.site && uuid.test(query.site) ? { site: query.site } : {}),
    ...(query.event && uuid.test(query.event) ? { event: query.event } : {}),
    ...(query.role && uuid.test(query.role) ? { role: query.role } : {}),
    ...(query.open === "1" ? { open: true } : {}),
    ...(query.duty && uuid.test(query.duty) ? { duty: query.duty } : {}),
    ...(source ? { source } : {}),
  };
}

export function buildWorkforceReturn(state: WorkforceReturnState): string {
  const query = new URLSearchParams({ week: state.week, day: state.day });
  for (const field of ["client", "site", "event", "role"] as const) if (state[field]) query.set(field, state[field]);
  if (state.open) query.set("open", "1");
  if (state.duty && state.source) { query.set("duty", state.duty); query.set("source", state.source); }
  return `/workforce?${query}`;
}

export function safeWorkforceReturn(value: string | undefined): string | undefined {
  if (!value || value.length > 1200 || !value.startsWith("/workforce?")) return undefined;
  try {
    const url = new URL(value, "http://kss.local");
    if (url.origin !== "http://kss.local" || url.pathname !== "/workforce") return undefined;
    const query = Object.fromEntries(url.searchParams);
    const state = parseWorkforceReturnState(query);
    return state.week ? buildWorkforceReturn({ week: state.week, day: state.day ?? state.week,
      client: state.client ?? "", site: state.site ?? "", event: state.event ?? "", role: state.role ?? "",
      open: state.open ?? false, duty: state.duty ?? "", source: state.source ?? "" }) : undefined;
  } catch { return undefined; }
}
