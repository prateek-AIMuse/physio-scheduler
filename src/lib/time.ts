/* All scheduling is in India time. India has no daylight saving, so a fixed +05:30 offset is exact. */
const OFFSET_MIN = 330;
export const TIME_ZONE = "Asia/Kolkata";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* A calendar day in India as YYYY-MM-DD */
export type Day = string;

export function istDay(date: Date): Day {
  return new Date(date.getTime() + OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/* Minutes since India midnight */
export function istMinutes(date: Date): number {
  const shifted = new Date(date.getTime() + OFFSET_MIN * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/* 1 = Monday … 7 = Sunday */
export function weekdayOf(day: Day): number {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(day: Day, n: number): Day {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* The Monday on or before the day */
export const mondayOf = (day: Day): Day => addDays(day, 1 - weekdayOf(day));

/* The instant at a given India day and minute */
export function istInstant(day: Day, minutes: number): Date {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + (minutes - OFFSET_MIN) * 60_000);
}

export const isDay = (s: unknown): s is Day => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

/* "09:30" or "09:30:00" → 570 */
export function parseTime(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

/* 570 → "09:30" (for inputs and the database) */
export const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/* 570 → "9:30 am" */
export function formatTime(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export const formatInstantTime = (date: Date) => formatTime(istMinutes(date));

/* "2026-11-02" → "Mon 2 Nov" */
export function formatDay(day: Day, long = false): string {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { timeZone: "UTC", weekday: long ? "long" : "short", day: "numeric", month: "short" });
}
