/* Each practice works in its own time zone (Settings → Time zone). Calendar days are YYYY-MM-DD in
   that zone and times of day are minutes since its midnight. Daylight saving is handled. */
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type Day = string;

const formats = new Map<string, Intl.DateTimeFormat>();
function wallClock(tz: string, date: Date) {
  let f = formats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    formats.set(tz, f);
  }
  const v = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
  return { y: +v.year, mo: +v.month, d: +v.day, h: +v.hour % 24, mi: +v.minute, s: +v.second };
}

/* Minutes the zone is ahead of UTC at that instant */
function offsetMinutes(tz: string, date: Date) {
  const w = wallClock(tz, date);
  return Math.round((Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - date.getTime()) / 60_000);
}

export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/* Day and time helpers for one time zone */
export function zone(tz: string = DEFAULT_TIME_ZONE) {
  const name = isTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
  const day = (date: Date): Day => {
    const w = wallClock(name, date);
    return `${w.y}-${String(w.mo).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`;
  };
  const minutes = (date: Date) => { const w = wallClock(name, date); return w.h * 60 + w.mi; };
  /* The instant at a local day and minute. Checked twice so days when the clocks change come out right. */
  const instant = (d: Day, min: number) => {
    const local = Date.parse(`${d}T00:00:00Z`) + min * 60_000;
    let t = local - offsetMinutes(name, new Date(local)) * 60_000;
    t = local - offsetMinutes(name, new Date(t)) * 60_000;
    return new Date(t);
  };
  return { tz: name, day, minutes, instant, time: (date: Date) => formatTime(minutes(date)) };
}
export type Zone = ReturnType<typeof zone>;

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

/* "2026-11-02" → "Mon 2 Nov" */
export function formatDay(day: Day, long = false): string {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { timeZone: "UTC", weekday: long ? "long" : "short", day: "numeric", month: "short" });
}
