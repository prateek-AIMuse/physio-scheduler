"use server";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { back, str } from "@/lib/forms";
import { normalizePhone } from "@/lib/format";
import { countryByCode } from "@/lib/regions";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/* A physio creates their account and practice. Supabase emails them a confirmation link; after
   that they wait at /pending until the platform owner approves them at /owner. */
export async function signUpPhysio(fd: FormData) {
  const name = str(fd, "physio_name"), practiceName = str(fd, "practice_name"), city = str(fd, "city");
  const email = str(fd, "email").toLowerCase(), password = String(fd.get("password") ?? "");
  const country = countryByCode(str(fd, "country"));
  const phone = normalizePhone(str(fd, "phone"), country.code);
  if (!name) back(fd, "/signup", { error: "Enter your name" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back(fd, "/signup", { error: "Enter a valid email address" });
  if (password.length < 8) back(fd, "/signup", { error: "Choose a password of at least 8 characters" });
  if (password !== String(fd.get("password2") ?? "")) back(fd, "/signup", { error: "The two passwords don't match" });
  if (!phone) back(fd, "/signup", { error: "Enter your mobile number" });
  if (fd.get("terms") !== "on") back(fd, "/signup", { error: "Please confirm you're a qualified physiotherapist" });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=/admin`, data: { full_name: name } },
  });
  if (error) back(fd, "/signup", { error: /already|registered/i.test(error.message) ? "There's already an account with this email. Log in instead." : error.message });
  /* Supabase hides existing emails by returning a user with no identities */
  if (!data.user || data.user.identities?.length === 0) back(fd, "/signup", { error: "There's already an account with this email. Log in instead." });

  const db = createAdminClient();
  const { data: practice, error: pErr } = await db.from("practices").insert({
    owner_user_id: data.user.id, status: "pending", physio_name: name, email, phone, city, registration_no: str(fd, "registration_no"),
  }).select("id").single();
  const { error: sErr } = practice
    ? await db.from("settings").insert({
        practice_id: practice.id, practice_name: practiceName, physio_name: name,
        country_code: country.code, currency: country.currency, time_zone: country.tz,
      })
    : { error: null };
  if (pErr || !practice || sErr) {
    /* Don't leave a login behind without a practice: remove it so they can simply try again */
    if (practice) await db.from("practices").delete().eq("id", practice.id);
    await db.auth.admin.deleteUser(data.user.id);
    back(fd, "/signup", { error: `Couldn't create your practice: ${(pErr ?? sErr)?.message ?? "unknown error"}. Please try again.` });
  }

  redirect(data.session ? "/pending" : `/signup?sent=${encodeURIComponent(email)}`);
}
