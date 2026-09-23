const localPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

// A local date/time is accepted only if it maps to exactly one London instant.
// This rejects both missing spring-forward times and ambiguous autumn times.
export function londonDueToIso(value: unknown): string | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const match = localPattern.exec(value);
  if (!match) return undefined;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const validCalendar = new Date(localAsUtc);
  if (validCalendar.getUTCFullYear() !== year || validCalendar.getUTCMonth() !== month - 1 ||
    validCalendar.getUTCDate() !== day || hour > 23 || minute > 59) return undefined;
  const matches: number[] = [];
  for (const offsetMinutes of [-120, -60, 0, 60, 120]) {
    const instant = localAsUtc - offsetMinutes * 60_000;
    const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
    if (Number(parts.year) === year && Number(parts.month) === month && Number(parts.day) === day &&
      Number(parts.hour) === hour && Number(parts.minute) === minute) matches.push(instant);
  }
  return matches.length === 1 ? new Date(matches[0]).toISOString() : undefined;
}
