const londonDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", era: "short",
});
const londonTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", timeZoneName: "short", hourCycle: "h23",
});
const civilFormat = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
const dayLabel = civilFormat({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const monthLabel = civilFormat({ month: "long", year: "numeric" });
const daysInMonth = (year: number, month: number) => [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;

export function isCivilDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}
const civilDate = (day: string) => {
  if (!isCivilDate(day)) throw new RangeError("Invalid calendar date");
  return new Date(`${day}T12:00:00Z`);
};
export const formatCalendarDay = (day: string) => dayLabel.format(civilDate(day));
export const formatCalendarMonth = (month: string) => monthLabel.format(civilDate(`${month}-01`));

export function londonDay(instant: Date) {
  const parts = londonDate.formatToParts(instant);
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? "";
  if (part("era") !== "AD") return "";
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

// Require an explicit offset and reject impossible civil fields before Date can normalise them.
export function parseDeadline(value: string | null) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match || !isCivilDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59 ||
    (match[5] !== "Z" && (Number(match[7]) > 14 || Number(match[8]) > 59 || (Number(match[7]) === 14 && Number(match[8]) !== 0)))) return null;
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) return null;
  const date = new Date(instant), day = londonDay(date);
  return isCivilDate(day) ? { instant, day, time: londonTime.format(date) } : null;
}

export function addCalendarDays(day: string, amount: number): string | null {
  if (!Number.isInteger(amount)) return null;
  const date = civilDate(day); date.setUTCDate(date.getUTCDate() + amount);
  const result = date.toISOString().slice(0, 10);
  return isCivilDate(result) ? result : null;
}
export function moveCalendarMonth(month: string, amount: number): string | null {
  if (!Number.isInteger(amount) || !isCivilDate(`${month}-01`)) return null;
  const date = civilDate(`${month}-01`); date.setUTCMonth(date.getUTCMonth() + amount);
  const result = date.toISOString().slice(0, 7);
  return isCivilDate(`${result}-01`) ? result : null;
}
export function calendarMonthDays(month: string) {
  const first = `${month}-01`, weekday = (civilDate(first).getUTCDay() + 6) % 7;
  const [year, number] = month.split("-").map(Number);
  const count = Math.ceil((weekday + daysInMonth(year, number)) / 7) * 7;
  return Array.from({ length: count }, (_, i) => addCalendarDays(first, i - weekday));
}

type CalendarTask = { id: string; sourceKind: string; dueAt: string | null; state: "OPEN" | "DONE" | "CANCELLED"; covering: boolean };
export function taskDeadlines<T extends CalendarTask>(tasks: T[]) {
  const dated: Array<{ task: T; instant: number; day: string; time: string }> = [], undated: T[] = [];
  for (const task of tasks) {
    const deadline = task.sourceKind === "CRM_OPPORTUNITY" || task.sourceKind === "CRM_ORGANISATION" ? parseDeadline(task.dueAt) : null;
    if (deadline) dated.push({ task, ...deadline }); else undated.push(task);
  }
  dated.sort((a, b) => a.instant - b.instant || (a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0));
  return { dated, undated };
}
export function deadlineCounts(tasks: CalendarTask[]) {
  return { open: tasks.filter(task => task.state === "OPEN" && !task.covering).length,
    covering: tasks.filter(task => task.state === "OPEN" && task.covering).length,
    done: tasks.filter(task => task.state === "DONE").length,
    cancelled: tasks.filter(task => task.state === "CANCELLED").length };
}
