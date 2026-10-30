import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { Patient } from "@/lib/types";

type Db = ReturnType<typeof createAdminClient>;

/* Patients log in by phone, but one-time login links need an email on the account. This address
   only identifies the account; nothing is ever sent to it. */
const placeholderEmail = (p: Pick<Patient, "id">) => `patient-${p.id}@example.com`;

/* Makes sure the patient has a login account tied to their phone number, and returns its id.
   Text-message codes only go to numbers that have an account, so strangers can't trigger them. */
export async function ensurePatientAccount(db: Db, p: Patient): Promise<string> {
  if (p.user_id) {
    const { data } = await db.auth.admin.getUserById(p.user_id);
    if (data.user) {
      const updates: { phone?: string; phone_confirm?: boolean; email?: string; email_confirm?: boolean } = {};
      if (data.user.phone !== p.phone) Object.assign(updates, { phone: p.phone, phone_confirm: true });
      if (!data.user.email) Object.assign(updates, { email: placeholderEmail(p), email_confirm: true });
      if (Object.keys(updates).length) {
        const { error } = await db.auth.admin.updateUserById(p.user_id, updates);
        if (error) throw new Error(`Couldn't update the login for ${p.full_name}: ${error.message}`);
      }
      return p.user_id;
    }
  }
  const { data, error } = await db.auth.admin.createUser({ phone: p.phone, phone_confirm: true, email: placeholderEmail(p), email_confirm: true });
  let id = data.user?.id;
  if (error) {
    /* The number may already have an account (e.g. the patient was removed and added again) */
    for (let page = 1; !id && page <= 20; page++) {
      const { data: list } = await db.auth.admin.listUsers({ page, perPage: 200 });
      id = list.users.find((u) => u.phone === p.phone || u.email === placeholderEmail(p))?.id;
      if (list.users.length < 200) break;
    }
    if (!id) {
      /* Phone sign-in may be switched off in Supabase; an email-only account still takes login links */
      const retry = await db.auth.admin.createUser({ email: placeholderEmail(p), email_confirm: true });
      id = retry.data.user?.id;
      if (!id) throw new Error(`Couldn't create a login for ${p.full_name}: ${error.message}`);
    }
  }
  await db.from("patients").update({ user_id: id }).eq("id", p.id);
  return id!;
}

/* A one-time link that logs the patient straight in (valid for the Supabase email-link lifetime) */
export async function loginLink(db: Db, p: Patient): Promise<string> {
  const userId = await ensurePatientAccount(db, p);
  const { data: u } = await db.auth.admin.getUserById(userId);
  const email = u.user?.email ?? placeholderEmail(p);
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(`Couldn't make a login link: ${error?.message ?? "no token"}`);
  return `${env.siteUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=email`;
}
