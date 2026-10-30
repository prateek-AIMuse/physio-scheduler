import type { PracticeDb } from "@/lib/practice-db";
import { clashes, type Location } from "@/lib/scheduler";
import { addDays, istDay, istInstant } from "@/lib/time";
import type { Visit } from "@/lib/types";

type Db = PracticeDb;

/* The first live visit that would clash with this one (overlap, or too little travel time around a home visit) */
export async function findClash(db: Db, v: { id?: string; start: Date; end: Date; location: Location }, bufferMinutes: number) {
  const day = istDay(v.start);
  const { data } = await db.from("visits").select("*, patients(full_name)").in("status", ["proposed", "scheduled", "completed"])
    .gte("starts_at", istInstant(addDays(day, -1), 0).toISOString()).lt("starts_at", istInstant(addDays(day, 2), 0).toISOString());
  const rows = (data ?? []) as (Visit & { patients: { full_name: string } | null })[];
  return rows.find((r) => r.id !== v.id && clashes(
    { patientId: r.patient_id, start: new Date(r.starts_at), end: new Date(r.ends_at), location: r.location },
    { patientId: "", start: v.start, end: v.end, location: v.location }, bufferMinutes)) ?? null;
}
