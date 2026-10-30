"use server";
import { revalidatePath } from "next/cache";
import { insertPreference } from "@/lib/preferences";
import { requirePatient } from "@/lib/auth";
import { back, str } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/server";

export async function addMyPreference(fd: FormData) {
  const { patient } = await requirePatient();
  await insertPreference(createAdminClient(), patient.id, fd, "/me");
  revalidatePath("/me");
  back(fd, "/me", { ok: "Added. Your physio will plan around it." });
}

export async function deleteMyPreference(fd: FormData) {
  const { patient } = await requirePatient();
  /* Only the patient's own rows */
  await createAdminClient().from("preferences").delete().eq("id", str(fd, "id")).eq("patient_id", patient.id);
  revalidatePath("/me");
  back(fd, "/me", { ok: "Removed" });
}
