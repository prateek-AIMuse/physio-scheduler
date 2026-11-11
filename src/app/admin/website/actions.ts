"use server";
import { revalidatePath } from "next/cache";
import { ensurePatientAccount } from "@/lib/accounts";
import { requireAdmin } from "@/lib/auth";
import { back, str } from "@/lib/forms";
import { bookingConfirmedText, queueMessage } from "@/lib/messages";
import { cleanServices, MAX_SERVICES, slugError, slugify, type BookingRequest } from "@/lib/practice-page";
import { getSettings } from "@/lib/settings";
import { zone } from "@/lib/time";
import type { Patient, Visit } from "@/lib/types";
import { findClash } from "@/lib/visits";

const HOME = "/admin/website";

/* Saves the practice's mini website: its address, what it says and whether it's live */
export async function savePracticePage(fd: FormData) {
  const { db } = await requireAdmin(HOME);
  const slug = slugify(str(fd, "slug"));
  const problem = slugError(slug);
  if (problem) back(fd, HOME, { error: problem });
  const services = cleanServices(Array.from({ length: MAX_SERVICES }, (_, i) => ({
    name: str(fd, `service_name_${i}`), minutes: str(fd, `service_minutes_${i}`), price: str(fd, `service_price_${i}`), where: str(fd, `service_where_${i}`),
  })));
  const publish = fd.get("published") === "on";
  const { error } = await db.from("practice_pages").upsert({
    slug, published: publish, headline: str(fd, "headline").slice(0, 120), about: str(fd, "about").slice(0, 2000),
    qualifications: str(fd, "qualifications").slice(0, 300), specialities: str(fd, "specialities").slice(0, 300),
    home_areas: str(fd, "home_areas").slice(0, 300), services,
    show_whatsapp: fd.get("show_whatsapp") === "on", accept_bookings: fd.get("accept_bookings") === "on",
    updated_at: new Date().toISOString(),
  }, { onConflict: "practice_id" });
  if (error) {
    back(fd, HOME, { error: error.code === "23505" ? "Another practice already uses that address. Please choose another."
      : /practice_pages/.test(error.message) && /not exist|schema cache/.test(error.message) ? "The website isn't set up in the database yet: run supabase/migrations/0008_practice_page.sql."
      : error.message });
  }
  revalidatePath(`/${slug}`);
  revalidatePath("/admin", "layout");
  back(fd, HOME, { ok: publish ? "Saved. Your page is live." : "Saved. Tick Publish when you're ready for people to see it." });
}

async function ownRequest(fd: FormData) {
  const { db } = await requireAdmin();
  const { data } = await db.from("booking_requests").select("*").eq("id", str(fd, "id")).eq("status", "new").maybeSingle();
  if (!data) back(fd, "/admin", { error: "That request has already been answered." });
  return { db, r: data as unknown as BookingRequest };
}

/* Accepting a request books the visit. A new person becomes a patient of the practice. */
export async function acceptBooking(fd: FormData) {
  const { db, r } = await ownRequest(fd);
  const s = await getSettings(db);
  const start = new Date(r.starts_at), end = new Date(r.ends_at);
  const clash = await findClash(db, { start, end, location: r.location }, s.travel_buffer_minutes, zone(s.time_zone));
  if (clash) back(fd, "/admin", { error: `That time now clashes with ${clash.patients?.full_name ?? "another visit"}. Message ${r.full_name} to agree another time, then decline this request.` });

  const { data: existing } = await db.from("patients").select("*").eq("phone", r.phone).maybeSingle();
  let patient = existing as Patient | null;
  if (!patient) {
    const { data, error } = await db.from("patients").insert({
      full_name: r.full_name, phone: r.phone, condition: r.note.slice(0, 120) || "New patient, to be assessed", address: r.address,
      session_minutes: Math.round((end.getTime() - start.getTime()) / 60_000), default_location: r.location,
      /* Not planned into the week automatically until the physio sets how often they come */
      visits_per_week: 0, notes: `Booked from the practice page${r.service ? ` (${r.service})` : ""}.${r.note ? ` They wrote: ${r.note}` : ""}`,
    }).select().single();
    if (error || !data) back(fd, "/admin", { error: `Couldn't add the patient: ${error?.message ?? "unknown error"}` });
    patient = data as Patient;
    try { await ensurePatientAccount(db, patient); } catch { /* They can still be sent a login link later */ }
  } else {
    /* Someone who came before: make them active again, and keep a home address if there wasn't one */
    const changes = { ...(patient.active ? {} : { active: true }), ...(r.location === "home" && r.address && !patient.address ? { address: r.address } : {}) };
    if (Object.keys(changes).length) await db.from("patients").update(changes).eq("id", patient.id);
  }

  const { data: visit, error } = await db.from("visits").insert({
    patient_id: patient.id, starts_at: r.starts_at, ends_at: r.ends_at, location: r.location,
    status: "scheduled", booked_by: "patient", changed_at: new Date().toISOString(),
  }).select().single();
  if (error || !visit) back(fd, "/admin", { error: `Couldn't book the visit: ${error?.message ?? "unknown error"}` });
  await db.from("booking_requests").update({ status: "accepted", patient_id: patient.id, visit_id: visit!.id, decided_at: new Date().toISOString() }).eq("id", r.id);
  const text = bookingConfirmedText(visit as Visit, patient, s);
  await queueMessage(db, { patient_id: patient.id, kind: "custom", body: text.body, params: text.params, visit_id: visit!.id });
  revalidatePath("/admin", "layout");
  back(fd, "/admin", { ok: `Booked ${patient.full_name}. A confirmation is ready to send on WhatsApp.` });
}

export async function declineBooking(fd: FormData) {
  const { db, r } = await ownRequest(fd);
  await db.from("booking_requests").update({ status: "declined", decided_at: new Date().toISOString() }).eq("id", r.id);
  revalidatePath("/admin", "layout");
  back(fd, "/admin", { ok: `Declined ${r.full_name}'s request. The time is open again.` });
}
