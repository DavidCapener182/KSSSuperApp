const DAY_MS = 86_400_000;

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function addCivilDays(value: string, days: number): string {
  const date = new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY_MS);
  return date.toISOString().slice(0, 10);
}

export function londonToday(now = new Date()): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", day: "2-digit", month: "2-digit", year: "numeric",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function londonWeekStart(value: string): string | null {
  if (!validDate(value)) return null;
  const weekday = new Date(`${value}T00:00:00Z`).getUTCDay();
  return addCivilDays(value, -(weekday === 0 ? 6 : weekday - 1));
}
