import type { PracticeDb } from "@/lib/practice-db";
import type { Location } from "@/lib/scheduler";
import { openSlots } from "@/lib/slots";
import { addDays, parseTime, zone } from "@/lib/time";
import type { Availability, Patient, Settings, Visit } from "@/lib/types";

/* The practice's open times for a session of this length: inside the physio's free slots, far enough
   ahead, and clear of every booked visit and every booking request still waiting for an answer */
export async function openTimes(db: PracticeDb, s: Settings, opts: { minutes: number; location: Location; ignoreVisitId?: string; now?: Date }) {
  const z = zone(s.time_zone);
  const now = opts.now ?? new Date();
  const from = z.day(now);
  const until = addDays(from, s.booking_window_days + 1);
  const range = [z.instant(addDays(from, -1), 0).toISOString(), z.instant(until, 0).toISOString()] as const;
  const [{ data: avail }, { data: visits }, { data: requests }] = await Promise.all([
    db.from("availability").select("*"),
    db.from("visits").select("*").in("status", ["proposed", "scheduled", "completed"]).gte("starts_at", range[0]).lt("starts_at", range[1]),
    /* Empty until 0008_practice_page.sql has been run */
    db.from("booking_requests").select("starts_at, ends_at, location").eq("status", "new").gte("starts_at", range[0]).lt("starts_at", range[1]),
  ]);
  const waiting = ((requests ?? []) as unknown as Pick<Visit, "starts_at" | "ends_at" | "location">[])
    .map((r) => ({ patientId: "", start: new Date(r.starts_at), end: new Date(r.ends_at), location: r.location }));
  return openSlots({
    from, days: s.booking_window_days,
    availability: ((avail ?? []) as Availability[]).map((a) => ({ weekday: a.weekday, start: parseTime(a.start_time), end: parseTime(a.end_time) })),
    booked: [
      ...((visits ?? []) as Visit[]).filter((v) => v.id !== opts.ignoreVisitId)
        .map((v) => ({ patientId: v.patient_id, start: new Date(v.starts_at), end: new Date(v.ends_at), location: v.location })),
      ...waiting,
    ],
    sessionMinutes: opts.minutes, location: opts.location, bufferMinutes: s.travel_buffer_minutes,
    noticeHours: s.booking_notice_hours, now, zone: z,
  });
}

/* The times this patient could book (or move a session to) right now */
export function patientSlots(db: PracticeDb, s: Settings, patient: Patient, opts: { location: Location; moving?: Visit; now?: Date }) {
  const minutes = opts.moving ? Math.round((Date.parse(opts.moving.ends_at) - Date.parse(opts.moving.starts_at)) / 60_000) : patient.session_minutes;
  return openTimes(db, s, { minutes, location: opts.location, ignoreVisitId: opts.moving?.id, now: opts.now });
}

/* Whether the patient may still change this session themselves */
export const changeable = (v: Pick<Visit, "status" | "starts_at">, s: Pick<Settings, "self_booking" | "booking_notice_hours">, now = new Date()) =>
  s.self_booking && v.status === "scheduled" && Date.parse(v.starts_at) - now.getTime() >= s.booking_notice_hours * 3_600_000;
