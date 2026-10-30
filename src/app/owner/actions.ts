"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { back, str } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/server";

/* The platform owner approves, pauses or restores a physio's practice */
export async function setPracticeStatus(fd: FormData) {
  await requireOwner();
  const status = str(fd, "status");
  if (!["approved", "suspended", "pending"].includes(status)) back(fd, "/owner", { error: "Unknown status" });
  const db = createAdminClient();
  const { data: p } = await db.from("practices").select("id, physio_name, approved_at").eq("id", str(fd, "id")).maybeSingle();
  if (!p) back(fd, "/owner", { error: "Practice not found" });
  await db.from("practices").update({ status, approved_at: status === "approved" ? p.approved_at ?? new Date().toISOString() : p.approved_at }).eq("id", p.id);
  /* Older practices created before sign-ups may lack a settings row */
  await db.from("settings").upsert({ practice_id: p.id, physio_name: p.physio_name }, { onConflict: "practice_id", ignoreDuplicates: true });
  revalidatePath("/owner");
  back(fd, "/owner", { ok: `${p.physio_name || "Practice"}: ${status === "approved" ? "approved" : status === "suspended" ? "paused" : "set back to pending"}` });
}
