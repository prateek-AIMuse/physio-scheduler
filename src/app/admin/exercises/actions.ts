"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { STARTER_EXERCISES } from "@/lib/exercise-library";
import { back, num, str } from "@/lib/forms";

const done = () => revalidatePath("/admin", "layout");
const validUrl = (u: string) => !u || /^https?:\/\/\S+$/i.test(u);

export async function saveExercise(fd: FormData) {
  const { db } = await requireAdmin();
  const id = str(fd, "id"), name = str(fd, "name"), video = str(fd, "video_url");
  if (!name) back(fd, "/admin/exercises", { error: "Give the exercise a name" });
  if (!validUrl(video)) back(fd, "/admin/exercises", { error: "The video link should start with https://" });
  const row = { name, body_area: str(fd, "body_area"), instructions: str(fd, "instructions"), video_url: video };
  const { error } = id ? await db.from("exercises").update(row).eq("id", id) : await db.from("exercises").insert(row);
  done();
  back(fd, "/admin/exercises", error ? { error: error.message } : { ok: id ? "Exercise saved" : "Exercise added" });
}

export async function deleteExercise(fd: FormData) {
  const { db } = await requireAdmin();
  const { error } = await db.from("exercises").delete().eq("id", str(fd, "id"));
  done();
  back(fd, "/admin/exercises", error ? { error: error.message } : { ok: "Exercise deleted (and removed from patients' programmes)" });
}

export async function addStarterExercises(fd: FormData) {
  const { db } = await requireAdmin();
  const { data: existing } = await db.from("exercises").select("name");
  const have = new Set((existing ?? []).map((e) => e.name.toLowerCase()));
  const rows = STARTER_EXERCISES.filter((e) => !have.has(e.name.toLowerCase()));
  if (rows.length) await db.from("exercises").insert(rows);
  done();
  back(fd, "/admin/exercises", { ok: rows.length ? `Added ${rows.length} starter exercises. Add your own videos and adjust the instructions.` : "You already have all the starter exercises" });
}

export async function assignExercise(fd: FormData) {
  const { db } = await requireAdmin();
  const pid = str(fd, "patient_id"), path = `/admin/patients/${pid}`;
  const sets = num(fd, "sets"), reps = num(fd, "reps"), hold = num(fd, "hold_seconds"), perDay = num(fd, "times_per_day");
  if (!str(fd, "exercise_id")) back(fd, path, { error: "Pick an exercise" });
  if (!sets || sets < 1 || sets > 20 || !reps || reps < 1 || reps > 200) back(fd, path, { error: "Sets must be 1–20 and reps 1–200" });
  const { error } = await db.from("patient_exercises").insert({
    patient_id: pid, exercise_id: str(fd, "exercise_id"), sets, reps,
    hold_seconds: hold && hold > 0 ? Math.min(600, Math.round(hold)) : null,
    times_per_day: Math.min(10, Math.max(1, Math.round(perDay ?? 1))), notes: str(fd, "notes"),
  });
  done();
  back(fd, path, error ? { error: /another practice|not found/i.test(error.message) ? "Exercise not found" : error.message } : { ok: "Exercise added to the programme" });
}

export async function removeAssignment(fd: FormData) {
  const { db } = await requireAdmin();
  await db.from("patient_exercises").update({ active: false }).eq("id", str(fd, "id"));
  done();
  back(fd, "/admin/patients", { ok: "Exercise removed from the programme" });
}
