// Presentation-only return state. Existing portfolio APIs retain their own validation/authority.
export type ServicePortfolioFilters = { client: string; site: string; service: string; owner: string; state: string; from: string; to: string };
export type ServicePortfolioContext = { view: string; offset: number; filters: ServicePortfolioFilters };
export type ServicePortfolioQuery = Record<string, string | string[] | undefined>;
const views = new Set(["all", "mine", "reviews_due", "actions_overdue", "meetings_upcoming", "changes_awaiting"]);
const states = new Set(["PROPOSED", "ACTIVE", "CLOSING", "CLOSED", "CANCELLED"]);
const filterKeys = ["client", "site", "service", "owner", "state", "from", "to"] as const;
const keys = new Set<string>(["view", "offset", ...filterKeys]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controls = (value: string) => [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}
export function parseServicePortfolioQuery(query: ServicePortfolioQuery): ServicePortfolioContext | null {
  if (Object.entries(query).some(([key, value]) => !keys.has(key) || Array.isArray(value) || (value !== undefined && typeof value !== "string"))) return null;
  const view = query.view === undefined ? "all" : String(query.view);
  const offset = query.offset === undefined ? "0" : String(query.offset);
  if (!views.has(view) || !/^(0|[1-9]\d*)$/.test(offset) || Number(offset) > 10000) return null;
  const filters: ServicePortfolioFilters = { client: "", site: "", service: "", owner: "", state: "", from: "", to: "" };
  for (const key of filterKeys) filters[key] = String(query[key] ?? "");
  for (const key of ["client", "site", "service"] as const) {
    filters[key] = filters[key].trim();
    if (filters[key].length > 80 || controls(filters[key])) return null;
  }
  if ((filters.owner && !uuid.test(filters.owner)) || (filters.state && !states.has(filters.state)) ||
    (filters.from && !calendarDate(filters.from)) || (filters.to && !calendarDate(filters.to)) ||
    (filters.from && filters.to && filters.from > filters.to)) return null;
  return { view, offset: Number(offset), filters };
}
export function servicePortfolioReturn(context: ServicePortfolioContext): string {
  const valid = parseServicePortfolioQuery({ view: context.view, offset: String(context.offset), ...context.filters });
  if (!valid) return "/service-delivery";
  const query = new URLSearchParams();
  if (valid.view !== "all") query.set("view", valid.view);
  if (valid.offset) query.set("offset", String(valid.offset));
  for (const key of filterKeys) if (valid.filters[key]) query.set(key, valid.filters[key]);
  return `/service-delivery${query.size ? `?${query}` : ""}`;
}
export function readServicePortfolioReturn(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 2000 || raw.includes("#") || raw.includes("\\") || [...raw].some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return "/service-delivery";
  const [path, query = "", ...extra] = raw.split("?");
  if (path !== "/service-delivery" || extra.length || /%(?![0-9a-f]{2})/i.test(query)) return "/service-delivery";
  try { decodeURIComponent(query); } catch { return "/service-delivery"; }
  const selection: ServicePortfolioQuery = {};
  for (const [key, value] of new URLSearchParams(query)) {
    if (!keys.has(key) || Object.hasOwn(selection, key)) return "/service-delivery";
    selection[key] = value;
  }
  const context = parseServicePortfolioQuery(selection);
  return context ? servicePortfolioReturn(context) : "/service-delivery";
}
export function serviceDeliveryRecordHref(id: string, context: ServicePortfolioContext): string {
  return uuid.test(id) ? `/service-delivery/${id}?returnTo=${encodeURIComponent(servicePortfolioReturn(context))}` : "/service-delivery";
}
