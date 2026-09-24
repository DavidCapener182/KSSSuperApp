import { londonDueToIso } from "../crm/due-time.ts";

type AvailabilityInput = {
  mode?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  startsLocal?: unknown;
  endsLocal?: unknown;
  startsIso?: unknown;
  endsIso?: unknown;
};

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const londonDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
});
function londonDay(now: Date): string {
  const parts = Object.fromEntries(londonDate.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function nextDay(date: string): string | null {
  if (!dayPattern.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

export function parseAvailabilityRange(input: AvailabilityInput, now = new Date()): { starts: string; ends: string } | null {
  if (input.mode === "EXACT") {
    if (typeof input.startsIso !== "string" || typeof input.endsIso !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.startsIso) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.endsIso)) return null;
    const starts = new Date(input.startsIso), ends = new Date(input.endsIso);
    return Number.isFinite(starts.getTime()) && Number.isFinite(ends.getTime()) && ends>starts ?
      { starts: starts.toISOString(), ends: ends.toISOString() } : null;
  }
  if (input.mode === "CUSTOM") {
    const starts = londonDueToIso(input.startsLocal);
    const ends = londonDueToIso(input.endsLocal);
    return starts && ends && new Date(ends) > new Date(starts) ? { starts, ends } : null;
  }
  if (input.mode === "ALL_DAY") {
    if (typeof input.startDate !== "string" || typeof input.endDate !== "string" ||
      !dayPattern.test(input.startDate) || !dayPattern.test(input.endDate)) return null;
    const exclusiveEnd = nextDay(input.endDate);
    if (!exclusiveEnd) return null;
    const starts = londonDueToIso(`${input.startDate}T00:00`);
    const ends = londonDueToIso(`${exclusiveEnd}T00:00`);
    return starts && ends && new Date(ends) > new Date(starts) ? { starts, ends } : null;
  }
  if (input.mode === "REST_TODAY") {
    const today = londonDay(now);
    const exclusiveEnd = nextDay(today);
    const ends = exclusiveEnd && londonDueToIso(`${exclusiveEnd}T00:00`);
    return ends && new Date(ends) > now ? { starts: now.toISOString(), ends } : null;
  }
  return null;
}
