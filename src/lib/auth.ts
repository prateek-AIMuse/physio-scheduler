import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { adminEmails, supabaseConfigured } from "@/lib/env";
import { practiceDb } from "@/lib/practice-db";
import type { Patient, Practice } from "@/lib/types";

/* Who is signed in:
   - a physio owns one practice (it may still be waiting for approval);
   - a patient is matched by their login, or on first login by their phone number, and can be a
     patient of more than one practice;
   - a platform owner is an email in ADMIN_EMAILS, who approves physios at /owner. */
export type Viewer =
  | { role: "physio"; user: User; practice: Practice; owner: boolean }
  | { role: "patient"; user: User; patients: Patient[]; owner: boolean }
  | { role: "unknown"; user: User; owner: boolean };

/* Cached per request, so the layout and the page share one lookup */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  await connection();
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const owner = Boolean(user.email && user.email_confirmed_at && adminEmails().includes(user.email.toLowerCase()));
  const db = createAdminClient();

  const { data: own } = await db.from("practices").select("*").eq("owner_user_id", user.id).maybeSingle();
  if (own) return { role: "physio", user, practice: own as Practice, owner };
  if (owner) {
    /* The practice that existed before Movera had sign-ups has no owner: the platform owner takes it over */
    const { data: orphan } = await db.from("practices").select("*").is("owner_user_id", null).order("created_at").limit(1).maybeSingle();
    if (orphan) {
      const { data: claimed } = await db.from("practices")
        .update({ owner_user_id: user.id, email: orphan.email || user.email, status: "approved", approved_at: orphan.approved_at ?? new Date().toISOString() })
        .eq("id", orphan.id).is("owner_user_id", null).select().maybeSingle();
      if (claimed) return { role: "physio", user, practice: claimed as Practice, owner };
    }
  }

  const { data: linked } = await db.from("patients").select("*").eq("user_id", user.id).order("created_at");
  let patients = (linked ?? []) as Patient[];
  if (user.phone) {
    const { data: byPhone } = await db.from("patients").select("*").eq("phone", user.phone.replace(/\D/g, "")).is("user_id", null);
    if (byPhone?.length) {
      await db.from("patients").update({ user_id: user.id }).in("id", byPhone.map((p) => p.id));
      patients = [...patients, ...(byPhone as Patient[]).map((p) => ({ ...p, user_id: user.id }))];
    }
  }
  if (patients.length) return { role: "patient", user, patients, owner };
  return { role: "unknown", user, owner };
});

/* For the physio's pages: their practice, and the database limited to it. Physios still waiting for
   approval (or suspended) see /pending instead. */
export async function requireAdmin(path = "/admin") {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?as=physio&next=${encodeURIComponent(path)}`);
  if (viewer.role !== "physio") redirect(viewer.owner ? "/owner" : "/");
  if (viewer.practice.status !== "approved") redirect("/pending");
  return { ...viewer, db: practiceDb(viewer.practice.id) };
}

/* For the patient's page. With more than one physio, `practiceId` picks which one to show. */
export async function requirePatient(practiceId?: string) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "patient") redirect("/");
  const active = viewer.patients.filter((p) => p.active);
  const list = active.length ? active : viewer.patients;
  const patient = list.find((p) => p.practice_id === practiceId) ?? list[0];
  return { ...viewer, patient, others: list.filter((p) => p.id !== patient.id), db: practiceDb(patient.practice_id) };
}

export async function requireOwner() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?as=physio&next=/owner");
  if (!viewer.owner) redirect("/");
  return viewer;
}
