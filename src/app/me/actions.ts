"use server";
import { revalidatePath } from "next/cache";
import { insertPreference } from "@/lib/preferences";
import { requirePatient } from "@/lib/auth";
import { back, str } from "@/lib/forms";
import { changeable, patientSlots } from "@/lib/booking";
import type { PracticeDb } from "@/lib/practice-db";
import type { Location } from "@/lib/scheduler";
import { getSettings } from "@/lib/settings";
import { formatDay, zone } from "@/lib/time";
import type { Visit } from "@/lib/types";

export async function addMyPreference(fd: FormData) {
  const { patient, db } = await requirePatient(str(fd, "practice") || undefined);
  await insertPreference(db, patient.id, fd, "/me");
  revalidatePath("/me");
  back(fd, "/me", { ok: "Added. Your physio will plan around it." });
}

export async function deleteMyPreference(fd: FormData) {
  const { patient, db } = await requirePatient(str(fd, "practice") || undefined);
  /* Only the patient's own rows */
  await db.from("preferences").delete().eq("id", str(fd, "id")).eq("patient_id", patient.id);
  revalidatePath("/me");
  back(fd, "/me", { ok: "Removed" });
}

/* ---------- Self-booking (when the physio has switched it on) ---------- */

async function bookingContext(fd: FormData) {
  const ctx = await requirePatient(str(fd, "practice") || undefined);
  const s = await getSettings(ctx.db);
  const home = `/me?practice=${ctx.patient.practice_id}`;
  if (!s.self_booking) back(fd, home, { error: "Your physio books sessions for you. Message them to change anything." });
  return { ...ctx, s, home };
}

const where = (fd: FormData, fallback: Location): Location => {
  const w = str(fd, "location");
  return w === "home" || w === "clinic" ? w : fallback;
};

export async function bookSession(fd: FormData) {
  const { patient, db, s, home } = await bookingContext(fd);
  const location = where(fd, patient.default_location);
  const start = new Date(str(fd, "start"));
  /* Check again: someone else may have taken the time since the page loaded */
  const slots = await patientSlots(db, s, patient, { location });
  const slot = slots.find((x) => x.start.getTime() === start.getTime());
  if (!slot) back(fd, `/me/book?practice=${patient.practice_id}`, { error: "Sorry, that time has just gone. Please pick another." });
  const { error } = await db.from("visits").insert({
    patient_id: patient.id, starts_at: slot.start.toISOString(), ends_at: slot.end.toISOString(), location,
    status: "scheduled", booked_by: "patient", changed_at: new Date().toISOString(),
  });
  revalidatePath("/me");
  const z = zone(s.time_zone);
  back(fd, home, error ? { error: error.message } : { ok: `Booked: ${formatDay(z.day(slot.start), true)} at ${z.time(slot.start)}. You'll get a reminder the day before.` });
}

async function ownVisit(db: PracticeDb, patientId: string, id: string) {
  const { data } = await db.from("visits").select("*").eq("id", id).eq("patient_id", patientId).maybeSingle();
  return data as Visit | null;
}

export async function moveSession(fd: FormData) {
  const { patient, db, s, home } = await bookingContext(fd);
  const v = await ownVisit(db, patient.id, str(fd, "visit"));
  if (!v || !changeable(v, s)) back(fd, home, { error: `This session can't be moved online any more. Please message your physio.` });
  const start = new Date(str(fd, "start"));
  const slots = await patientSlots(db, s, patient, { location: v.location, moving: v });
  const slot = slots.find((x) => x.start.getTime() === start.getTime());
  if (!slot) back(fd, `/me/book?practice=${patient.practice_id}&visit=${v.id}`, { error: "Sorry, that time has just gone. Please pick another." });
  await db.from("visits").update({ starts_at: slot.start.toISOString(), ends_at: slot.end.toISOString(), booked_by: "patient", changed_at: new Date().toISOString() })
    .eq("id", v.id).eq("status", "scheduled");
  revalidatePath("/me");
  const z = zone(s.time_zone);
  back(fd, home, { ok: `Moved to ${formatDay(z.day(slot.start), true)} at ${z.time(slot.start)}.` });
}

export async function cancelSession(fd: FormData) {
  const { patient, db, s, home } = await bookingContext(fd);
  const v = await ownVisit(db, patient.id, str(fd, "visit"));
  if (!v || !changeable(v, s)) back(fd, home, { error: `This session can't be cancelled online any more. Please message your physio.` });
  await db.from("visits").update({ status: "cancelled", booked_by: "patient", changed_at: new Date().toISOString() }).eq("id", v.id).eq("status", "scheduled");
  revalidatePath("/me");
  back(fd, home, { ok: "Session cancelled. It won't count against your package." });
}
