"use server";
import { revalidatePath } from "next/cache";
import { insertPreference } from "@/lib/preferences";
import { requirePatient } from "@/lib/auth";
import { back, str } from "@/lib/forms";

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
