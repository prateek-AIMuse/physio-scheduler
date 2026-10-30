import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { adminEmails, supabaseConfigured } from "@/lib/env";
import type { Patient } from "@/lib/types";

export type Viewer =
  | { role: "admin"; user: User }
  | { role: "patient"; user: User; patient: Patient }
  | { role: "unknown"; user: User };

/* Who is signed in. The physio is whoever's email is in ADMIN_EMAILS; a patient is matched by
   their account, or on first login by their phone number. */
export async function getViewer(): Promise<Viewer | null> {
  await connection();
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (user.email && user.email_confirmed_at && adminEmails().includes(user.email.toLowerCase())) return { role: "admin", user };

  const db = createAdminClient();
  const { data: linked } = await db.from("patients").select("*").eq("user_id", user.id).maybeSingle();
  if (linked) return { role: "patient", user, patient: linked as Patient };
  if (user.phone) {
    const { data: byPhone } = await db.from("patients").select("*").eq("phone", user.phone.replace(/\D/g, "")).is("user_id", null).maybeSingle();
    if (byPhone) {
      await db.from("patients").update({ user_id: user.id }).eq("id", byPhone.id);
      return { role: "patient", user, patient: { ...(byPhone as Patient), user_id: user.id } };
    }
  }
  return { role: "unknown", user };
}

export async function requireAdmin(path = "/admin") {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (viewer.role !== "admin") redirect("/");
  return viewer;
}

export async function requirePatient() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "patient") redirect("/");
  return viewer;
}
