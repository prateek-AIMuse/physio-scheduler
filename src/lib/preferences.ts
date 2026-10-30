import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { back, isTime, str } from "@/lib/forms";
import { parseTime } from "@/lib/time";
import type { Preference } from "@/lib/types";

type Db = ReturnType<typeof createAdminClient>;

/* Adds a patient's preferred times from the form. Callers check who may edit this patient first. */
export async function insertPreference(db: Db, patientId: string, fd: FormData, fallback: string) {
  const days = fd.getAll("weekday").map(Number).filter((d) => d >= 1 && d <= 7);
  const start = str(fd, "start_time"), end = str(fd, "end_time"), where = str(fd, "location");
  if (!days.length) back(fd, fallback, { error: "Pick at least one day" });
  if (!isTime(start) || !isTime(end) || parseTime(end) <= parseTime(start)) back(fd, fallback, { error: "The end time must be after the start time" });
  const rows: Omit<Preference, "id">[] = days.map((weekday) => ({
    patient_id: patientId, weekday, start_time: start, end_time: end, location: where === "home" || where === "clinic" ? where : null,
  }));
  const { error } = await db.from("preferences").insert(rows);
  if (error) back(fd, fallback, { error: error.message });
}

