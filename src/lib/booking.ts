import type { PracticeDb } from "@/lib/practice-db";
import type { Location } from "@/lib/scheduler";
import { openSlots } from "@/lib/slots";
import { addDays, parseTime, zone } from "@/lib/time";
import type { Availability, Patient, Settings, Visit } from "@/lib/types";

/* The times this patient could book (or move a session to) right now */
export async function patientSlots(db: PracticeDb, s: Settings, patient: Patient, opts: { location: Location; moving?: Visit; now?: Date }) {
  const z = zone(s.time_zone);
  const now = opts.now ?? new Date();
  const from = z.day(now);
  const until = addDays(from, s.booking_window_days + 1);
  const [{ data: avail }, { data: visits }] = await Promise.all([
    db.from("availability").select("*"),
    db.from("visits").select("*").in("status", ["proposed", "scheduled", "completed"])
      .gte("starts_at", z.instant(addDays(from, -1), 0).toISOString()).lt("starts_at", z.instant(until, 0).toISOString()),
  ]);
  const minutes = opts.moving ? Math.round((Date.parse(opts.moving.ends_at) - Date.parse(opts.moving.starts_at)) / 60_000) : patient.session_minutes;
  return openSlots({
    from, days: s.booking_window_days,
    availability: ((avail ?? []) as Availability[]).map((a) => ({ weekday: a.weekday, start: parseTime(a.start_time), end: parseTime(a.end_time) })),
    booked: ((visits ?? []) as Visit[]).filter((v) => v.id !== opts.moving?.id)
      .map((v) => ({ patientId: v.patient_id, start: new Date(v.starts_at), end: new Date(v.ends_at), location: v.location })),
    sessionMinutes: minutes, location: opts.location, bufferMinutes: s.travel_buffer_minutes,
    noticeHours: s.booking_notice_hours, now, zone: z,
  });
}

/* Whether the patient may still change this session themselves */
export const changeable = (v: Pick<Visit, "status" | "starts_at">, s: Pick<Settings, "self_booking" | "booking_notice_hours">, now = new Date()) =>
  s.self_booking && v.status === "scheduled" && Date.parse(v.starts_at) - now.getTime() >= s.booking_notice_hours * 3_600_000;
