import { addDays, istDay, istInstant, weekdayOf, type Day } from "@/lib/time";

export type Location = "clinic" | "home";

/* A weekly window. weekday 1 = Monday … 7 = Sunday; minutes since midnight, India time. */
export type Window = { weekday: number; start: number; end: number };

export type PlannerPatient = {
  id: string;
  sessionMinutes: number;
  visitsPerWeek: number;
  defaultLocation: Location;
  preferences: (Window & { location: Location | null })[];
};

export type Booked = { patientId: string; start: Date; end: Date; location: Location };
export type Proposal = Booked;
export type Shortfall = { patientId: string; wanted: number; placed: number };

const STEP = 15;

/* Two visits clash if they overlap, or if either is a home visit and the travel gap between them is too short */
export function clashes(a: Booked, b: Booked, bufferMinutes: number): boolean {
  const gap = (a.location === "home" || b.location === "home" ? bufferMinutes : 0) * 60_000;
  return a.start.getTime() < b.end.getTime() + gap && b.start.getTime() < a.end.getTime() + gap;
}

type Candidate = { day: Day; dayIndex: number; start: Date; end: Date; location: Location };

/* Every start time, on a 15-minute grid, where the whole session fits inside both one of the
   physio's free slots and one of the patient's preferred windows */
function candidatesFor(patient: PlannerPatient, weekStart: Day, availability: Window[], now: Date): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const weekday = weekdayOf(day);
    for (const pref of patient.preferences.filter((p) => p.weekday === weekday)) {
      for (const free of availability.filter((a) => a.weekday === weekday)) {
        const from = Math.max(pref.start, free.start), to = Math.min(pref.end, free.end);
        for (let m = Math.ceil(from / STEP) * STEP; m + patient.sessionMinutes <= to; m += STEP) {
          const start = istInstant(day, m);
          if (start <= now || seen.has(`${day}-${m}`)) continue;
          seen.add(`${day}-${m}`);
          out.push({ day, dayIndex: i, start, end: istInstant(day, m + patient.sessionMinutes), location: pref.location ?? patient.defaultLocation });
        }
      }
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/* Suggests visits for one week. Each patient gets up to visitsPerWeek visits (counting ones already
   booked that week), on different days, spread out across the week, at times that suit both the
   physio and the patient, without clashing with each other or with booked visits.
   Patients with the fewest possible times are placed first, so they aren't crowded out. */
export function planWeek(input: {
  weekStart: Day;
  availability: Window[];
  patients: PlannerPatient[];
  booked: Booked[];
  bufferMinutes: number;
  now: Date;
}): { proposals: Proposal[]; shortfalls: Shortfall[] } {
  const { weekStart, availability, bufferMinutes, now } = input;
  const taken: Booked[] = [...input.booked];
  const proposals: Proposal[] = [];
  const shortfalls: Shortfall[] = [];

  const work = input.patients
    .filter((p) => p.visitsPerWeek > 0)
    .map((p) => ({ patient: p, candidates: candidatesFor(p, weekStart, availability, now) }))
    .sort((a, b) => a.candidates.length - b.candidates.length || a.patient.id.localeCompare(b.patient.id));

  const weekIndex = (d: Date) => Math.round((Date.parse(`${istDay(d)}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86_400_000);

  for (const { patient, candidates } of work) {
    const usedDays = taken.filter((b) => b.patientId === patient.id).map((b) => weekIndex(b.start));
    const wanted = patient.visitsPerWeek - usedDays.length;
    if (wanted <= 0) continue;
    /* Ideal spacing between a patient's visits, e.g. 3 days for 2 a week */
    const spacing = Math.max(1, Math.floor(7 / patient.visitsPerWeek));
    let placed = 0;

    for (let n = 0; n < wanted; n++) {
      let best: Candidate | null = null, bestScore = -1;
      for (const c of candidates) {
        if (usedDays.includes(c.dayIndex)) continue;
        const v: Booked = { patientId: patient.id, start: c.start, end: c.end, location: c.location };
        if (taken.some((t) => clashes(t, v, bufferMinutes))) continue;
        const distance = usedDays.length ? Math.min(spacing, ...usedDays.map((d) => Math.abs(d - c.dayIndex))) : spacing;
        /* Candidates are in time order, so on a tie the earliest wins */
        if (distance > bestScore) { best = c; bestScore = distance; }
      }
      if (!best) break;
      const v: Proposal = { patientId: patient.id, start: best.start, end: best.end, location: best.location };
      taken.push(v);
      proposals.push(v);
      usedDays.push(best.dayIndex);
      placed++;
    }
    if (placed < wanted) shortfalls.push({ patientId: patient.id, wanted, placed });
  }
  return { proposals: proposals.sort((a, b) => a.start.getTime() - b.start.getTime()), shortfalls };
}

