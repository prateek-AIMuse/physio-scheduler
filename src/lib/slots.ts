import { clashes, type Booked, type Location, type Window } from "@/lib/scheduler";
import { addDays, weekdayOf, type Day, type Zone } from "@/lib/time";

export type Slot = { day: Day; start: Date; end: Date };

/* Times a patient can book themselves: inside the physio's free slots, at least `noticeHours` from now,
   and not clashing with any booked visit (with travel time around home visits). Starts every 30 minutes. */
export function openSlots(input: {
  from: Day;
  days: number;
  availability: Window[];
  booked: Booked[];
  sessionMinutes: number;
  location: Location;
  bufferMinutes: number;
  noticeHours: number;
  now: Date;
  zone: Zone;
  /* A visit being moved doesn't block its own new time */
  ignorePatientVisit?: { start: Date };
}): Slot[] {
  const { zone: z, sessionMinutes } = input;
  const earliest = input.now.getTime() + input.noticeHours * 3_600_000;
  const booked = input.ignorePatientVisit
    ? input.booked.filter((b) => b.start.getTime() !== input.ignorePatientVisit!.start.getTime())
    : input.booked;
  const out: Slot[] = [];
  for (let i = 0; i < input.days; i++) {
    const day = addDays(input.from, i);
    for (const w of input.availability.filter((a) => a.weekday === weekdayOf(day)).sort((a, b) => a.start - b.start)) {
      for (let m = Math.ceil(w.start / 30) * 30; m + sessionMinutes <= w.end; m += 30) {
        const start = z.instant(day, m);
        if (start.getTime() < earliest) continue;
        const v: Booked = { patientId: "", start, end: new Date(start.getTime() + sessionMinutes * 60_000), location: input.location };
        if (booked.some((b) => clashes(b, v, input.bufferMinutes))) continue;
        if (!out.some((s) => s.start.getTime() === start.getTime())) out.push({ day, start, end: v.end });
      }
    }
  }
  return out;
}
