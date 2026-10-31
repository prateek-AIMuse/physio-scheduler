"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { loginLink, ensurePatientAccount } from "@/lib/accounts";
import { back, isTime, num, str } from "@/lib/forms";
import { normalizePhone } from "@/lib/format";
import { loginText, paymentText, queueMessage } from "@/lib/messages";
import { planWeek, type Location } from "@/lib/scheduler";
import { getSettings } from "@/lib/settings";
import type { PracticeDb } from "@/lib/practice-db";
import { addDays, formatDay, isDay, isTimeZone, mondayOf, parseTime, zone, type Zone } from "@/lib/time";
import { findClash } from "@/lib/visits";
import { insertPreference } from "@/lib/preferences";
import type { Patient, PaymentRequest, Preference, Visit } from "@/lib/types";

/* Saves the practice's Razorpay/Stripe keys. Blank fields keep what's saved; returns an error message or null. */
async function saveGateways(db: PracticeDb, fd: FormData): Promise<string | null> {
  const raw = db.raw.from("payment_gateways");
  if (fd.get("remove_gateways") === "on") {
    await raw.delete().eq("practice_id", db.practiceId);
    return null;
  }
  const keys = ["razorpay_key_id", "razorpay_key_secret", "razorpay_webhook_secret", "stripe_secret_key", "stripe_webhook_secret"] as const;
  const changes = Object.fromEntries(keys.map((k) => [k, str(fd, k)]).filter(([, v]) => v));
  if (!Object.keys(changes).length) return null;
  if (changes.razorpay_key_id && !/^rzp_(live|test)_\w+$/.test(changes.razorpay_key_id)) return "That Razorpay key ID doesn't look right (it starts with rzp_live_ or rzp_test_)";
  if (changes.stripe_secret_key && !/^(sk|rk)_(live|test)_\w+$/.test(changes.stripe_secret_key)) return "That Stripe key doesn't look right (it starts with sk_live_ or sk_test_)";
  if (changes.stripe_webhook_secret && !changes.stripe_webhook_secret.startsWith("whsec_")) return "The Stripe signing secret starts with whsec_";
  const { error } = await raw.upsert({ practice_id: db.practiceId, ...changes, updated_at: new Date().toISOString() }, { onConflict: "practice_id" });
  return error ? error.message : null;
}

/* Every action works on the signed-in physio's own practice only */
async function admin() {
  return (await requireAdmin()).db;
}

/* complete_visit and reopen_visit take a visit id, so check it belongs to this practice first */
async function ownVisit(db: PracticeDb, id: string) {
  const { data } = await db.from("visits").select("id").eq("id", id).maybeSingle();
  return Boolean(data);
}
const loc = (s: string): Location => (s === "home" ? "home" : "clinic");
const done = () => revalidatePath("/admin", "layout");

/* ---------- Settings and hours ---------- */

export async function saveSettings(fd: FormData) {
  const db = await admin();
  const buffer = num(fd, "travel_buffer_minutes"), fee = num(fd, "home_visit_fee");
  if (buffer === null || buffer < 0 || buffer > 180) back(fd, "/admin/settings", { error: "Travel time must be between 0 and 180 minutes" });
  if (fee === null || fee < 0) back(fd, "/admin/settings", { error: "Enter the home-visit fee (0 if none)" });
  const upi = str(fd, "upi_id");
  if (upi && !/^[\w.\-]+@[\w.\-]+$/.test(upi)) back(fd, "/admin/settings", { error: "That UPI ID doesn't look right (it's like name@okhdfcbank)" });
  const timeZone = str(fd, "time_zone"), currency = str(fd, "currency").toUpperCase(), countryCode = str(fd, "country_code").replace(/\D/g, "");
  if (!isTimeZone(timeZone)) back(fd, "/admin/settings", { error: "Pick a time zone" });
  if (!/^[A-Z]{3}$/.test(currency)) back(fd, "/admin/settings", { error: "Pick a currency" });
  if (!/^[1-9]\d{0,3}$/.test(countryCode)) back(fd, "/admin/settings", { error: "Pick a country for phone numbers" });
  /* The practice's own settings row (practiceDb limits the update to it) */
  const { error } = await db.from("settings").update({
    practice_name: str(fd, "practice_name"), physio_name: str(fd, "physio_name"),
    clinic_name: str(fd, "clinic_name"), clinic_maps_url: str(fd, "clinic_maps_url"),
    upi_id: upi, upi_payee_name: str(fd, "upi_payee_name"), payment_instructions: str(fd, "payment_instructions"),
    home_visit_fee: fee, travel_buffer_minutes: buffer,
    time_zone: timeZone, currency, country_code: countryCode,
    self_booking: fd.get("self_booking") === "on",
    booking_notice_hours: Math.min(168, Math.max(0, Math.round(num(fd, "booking_notice_hours") ?? 12))),
    booking_window_days: Math.min(60, Math.max(1, Math.round(num(fd, "booking_window_days") ?? 14))),
    whatsapp_mode: str(fd, "whatsapp_mode") === "cloud_api" ? "cloud_api" : "manual",
    updated_at: new Date().toISOString(),
  });
  if (error) back(fd, "/admin/settings", { error: error.message });
  const gw = await saveGateways(db, fd);
  done();
  back(fd, "/admin/settings", gw ? { error: gw } : { ok: "Settings saved" });
}

export async function addAvailability(fd: FormData) {
  const db = await admin();
  const days = fd.getAll("weekday").map(Number).filter((d) => d >= 1 && d <= 7);
  const start = str(fd, "start_time"), end = str(fd, "end_time");
  if (!days.length) back(fd, "/admin/hours", { error: "Pick at least one day" });
  if (!isTime(start) || !isTime(end) || parseTime(end) <= parseTime(start)) back(fd, "/admin/hours", { error: "The end time must be after the start time" });
  const { error } = await db.from("availability").insert(days.map((weekday) => ({ weekday, start_time: start, end_time: end })));
  done();
  back(fd, "/admin/hours", error ? { error: error.message } : { ok: "Free slot added" });
}

export async function deleteAvailability(fd: FormData) {
  const db = await admin();
  await db.from("availability").delete().eq("id", str(fd, "id"));
  done();
  back(fd, "/admin/hours", { ok: "Free slot removed" });
}

/* ---------- Patients ---------- */

export async function savePatient(fd: FormData) {
  const db = await admin();
  const id = str(fd, "id");
  const fallback = id ? `/admin/patients/${id}` : "/admin/patients/new";
  const phone = normalizePhone(str(fd, "phone"), (await getSettings(db)).country_code);
  const name = str(fd, "full_name");
  const minutes = num(fd, "session_minutes"), perWeek = num(fd, "visits_per_week");
  if (!name) back(fd, fallback, { error: "Enter the patient's name" });
  const condition = str(fd, "condition");
  if (!condition) back(fd, fallback, { error: "Enter the condition being treated" });
  if (!phone) back(fd, fallback, { error: "Enter a valid mobile number (10 digits for India, or with the country code)" });
  if (!minutes || minutes < 15 || minutes > 180) back(fd, fallback, { error: "Session length must be between 15 and 180 minutes" });
  if (perWeek === null || perWeek < 0 || perWeek > 7) back(fd, fallback, { error: "Visits a week must be between 0 and 7" });
  const row = {
    full_name: name, phone, condition, address: str(fd, "address"), maps_url: str(fd, "maps_url"),
    session_minutes: minutes, visits_per_week: perWeek, default_location: loc(str(fd, "default_location")), notes: str(fd, "notes"),
  };
  const { data, error } = id
    ? await db.from("patients").update(row).eq("id", id).select().single()
    : await db.from("patients").insert(row).select().single();
  if (error) back(fd, fallback, { error: error.code === "23505" ? "Another patient already has this phone number" : error.message });
  /* A login account lets the patient sign in with a text-message code */
  let warning = "";
  try { await ensurePatientAccount(db, data as Patient); } catch (e) { warning = ` (login not set up: ${e instanceof Error ? e.message : e})`; }
  done();
  redirect(`/admin/patients/${data!.id}?ok=${encodeURIComponent(`${id ? "Saved" : "Patient added"}${warning}`)}`);
}

export async function setPatientActive(fd: FormData) {
  const db = await admin();
  const active = str(fd, "active") === "true";
  await db.from("patients").update({ active }).eq("id", str(fd, "id"));
  if (!active) {
    await db.from("visits").update({ status: "cancelled" }).eq("patient_id", str(fd, "id")).in("status", ["proposed", "scheduled"]).gt("starts_at", new Date().toISOString());
  }
  done();
  back(fd, "/admin/patients", { ok: active ? "Patient is active again" : "Patient archived and their upcoming visits cancelled" });
}

export async function addPreference(fd: FormData) {
  const db = await admin();
  const pid = str(fd, "patient_id");
  await insertPreference(db, pid, fd, `/admin/patients/${pid}`);
  done();
  back(fd, `/admin/patients/${pid}`, { ok: "Preferred time added" });
}

export async function deletePreference(fd: FormData) {
  const db = await admin();
  await db.from("preferences").delete().eq("id", str(fd, "id"));
  done();
  back(fd, "/admin/patients", { ok: "Preferred time removed" });
}

export async function sendLoginLink(fd: FormData) {
  const db = await admin();
  const { data: p } = await db.from("patients").select("*").eq("id", str(fd, "patient_id")).single();
  if (!p) back(fd, "/admin/patients", { error: "Patient not found" });
  const s = await getSettings(db);
  let link: string;
  try { link = await loginLink(db, p as Patient); } catch (e) { back(fd, `/admin/patients/${p.id}`, { error: e instanceof Error ? e.message : String(e) }); }
  const t = loginText(p as Patient, s, link);
  await queueMessage(db, { patient_id: p.id, kind: "login_link", body: t.body, params: t.params });
  done();
  back(fd, `/admin/patients/${p.id}`, { ok: "Login link is ready to send under Messages" });
}

/* ---------- Packages and payments ---------- */

async function createRequest(db: PracticeDb, r: { patient_id: string; amount: number; description: string; package_id?: string | null }) {
  const { data, error } = await db.from("payment_requests").insert({ ...r, package_id: r.package_id ?? null }).select().single();
  if (error) throw new Error(error.message);
  await queuePaymentMessage(db, data as PaymentRequest);
}

async function queuePaymentMessage(db: PracticeDb, r: PaymentRequest) {
  const [{ data: p }, s] = await Promise.all([db.from("patients").select("*").eq("id", r.patient_id).single(), getSettings(db)]);
  const t = paymentText({ ...r, amount: Number(r.amount) }, p as Patient, s);
  await queueMessage(db, { patient_id: r.patient_id, kind: "payment_request", dedupe_key: `pay:${r.id}`, body: t.body, params: t.params });
}

export async function addPackage(fd: FormData) {
  const db = await admin();
  const pid = str(fd, "patient_id");
  const total = num(fd, "total_visits"), price = num(fd, "price");
  const path = `/admin/patients/${pid}`;
  if (!total || total < 1 || total > 200 || !Number.isInteger(total)) back(fd, path, { error: "Number of visits must be a whole number from 1 to 200" });
  if (price === null || price < 0) back(fd, path, { error: "Enter the package price" });
  const paid = fd.get("paid") === "on";
  const { data, error } = await db.from("packages").insert({
    patient_id: pid, total_visits: total, price, notes: str(fd, "notes"), paid_at: paid ? new Date().toISOString() : null,
  }).select().single();
  if (error) back(fd, path, { error: error.message });
  if (!paid && price > 0 && fd.get("request") === "on") {
    await createRequest(db, { patient_id: pid, amount: price, description: `Package: ${total} visits`, package_id: data.id });
  }
  done();
  back(fd, path, { ok: paid ? "Package added and marked paid" : fd.get("request") === "on" ? "Package added; payment request is ready under Messages" : "Package added" });
}

export async function markPackagePaid(fd: FormData) {
  const db = await admin();
  const id = str(fd, "id");
  const now = new Date().toISOString();
  await db.from("packages").update({ paid_at: now }).eq("id", id);
  await db.from("payment_requests").update({ status: "paid", paid_at: now }).eq("package_id", id).eq("status", "pending");
  done();
  back(fd, "/admin/patients", { ok: "Package marked paid" });
}

export async function deletePackage(fd: FormData) {
  const db = await admin();
  const id = str(fd, "id");
  const { count } = await db.from("visits").select("id", { count: "exact", head: true }).eq("package_id", id);
  if (count) back(fd, "/admin/patients", { error: "This package already has visits counted against it, so it can't be deleted" });
  await db.from("payment_requests").update({ status: "cancelled" }).eq("package_id", id).eq("status", "pending");
  await db.from("packages").delete().eq("id", id);
  done();
  back(fd, "/admin/patients", { ok: "Package deleted" });
}

export async function requestPackagePayment(fd: FormData) {
  const db = await admin();
  const { data: pkg } = await db.from("packages").select("*").eq("id", str(fd, "id")).single();
  if (!pkg || pkg.paid_at) back(fd, "/admin/patients", { error: "That package is already paid" });
  const { data: open } = await db.from("payment_requests").select("id").eq("package_id", pkg.id).eq("status", "pending").limit(1);
  if (open?.length) back(fd, "/admin/patients", { error: "There's already a pending request for this package (see Payments)" });
  await createRequest(db, { patient_id: pkg.patient_id, amount: Number(pkg.price), description: `Package: ${pkg.total_visits} visits`, package_id: pkg.id });
  done();
  back(fd, "/admin/patients", { ok: "Payment request is ready under Messages" });
}

export async function newPaymentRequest(fd: FormData) {
  const db = await admin();
  const amount = num(fd, "amount");
  if (!amount || amount <= 0) back(fd, "/admin/payments", { error: "Enter an amount" });
  if (!str(fd, "patient_id")) back(fd, "/admin/payments", { error: "Pick a patient" });
  await createRequest(db, { patient_id: str(fd, "patient_id"), amount, description: str(fd, "description") });
  done();
  back(fd, "/admin/payments", { ok: "Payment request is ready under Messages" });
}

export async function markPaymentPaid(fd: FormData) {
  const db = await admin();
  const now = new Date().toISOString();
  const { data: r } = await db.from("payment_requests").update({ status: "paid", paid_at: now }).eq("id", str(fd, "id")).eq("status", "pending").select().single();
  if (r?.package_id) await db.from("packages").update({ paid_at: now }).eq("id", r.package_id).is("paid_at", null);
  done();
  back(fd, "/admin/payments", { ok: "Marked as paid" });
}

export async function cancelPayment(fd: FormData) {
  const db = await admin();
  await db.from("payment_requests").update({ status: "cancelled" }).eq("id", str(fd, "id")).eq("status", "pending");
  done();
  back(fd, "/admin/payments", { ok: "Payment request withdrawn" });
}

export async function updatePaymentAmount(fd: FormData) {
  const db = await admin();
  const amount = num(fd, "amount");
  if (!amount || amount <= 0) back(fd, "/admin/payments", { error: "Enter an amount" });
  const { data: r } = await db.from("payment_requests").update({ amount, description: str(fd, "description") }).eq("id", str(fd, "id")).eq("status", "pending").select().single();
  if (r) {
    /* Re-queue the WhatsApp message with the new amount, even if the old one was already sent */
    const { data: m } = await db.from("messages").select("id,status").eq("dedupe_key", `pay:${r.id}`).maybeSingle();
    if (m && m.status !== "pending") await db.from("messages").update({ dedupe_key: `pay:${r.id}:old:${m.id}` }).eq("id", m.id);
    else if (m) await db.from("messages").delete().eq("id", m.id);
    await queuePaymentMessage(db, r as PaymentRequest);
  }
  done();
  back(fd, "/admin/payments", { ok: "Amount updated; the new request is ready under Messages" });
}

/* ---------- Visits ---------- */

function visitTimes(fd: FormData, minutes: number, z: Zone) {
  const day = str(fd, "day"), time = str(fd, "time");
  if (!isDay(day) || !isTime(time)) return null;
  const start = z.instant(day, parseTime(time));
  return { start, end: new Date(start.getTime() + minutes * 60_000) };
}

export async function addVisit(fd: FormData) {
  const db = await admin();
  const s = await getSettings(db);
  const z = zone(s.time_zone);
  const { data: p } = await db.from("patients").select("*").eq("id", str(fd, "patient_id")).single();
  if (!p) back(fd, "/admin/calendar", { error: "Pick a patient" });
  const minutes = num(fd, "minutes") || p.session_minutes;
  const t = visitTimes(fd, minutes, z);
  if (!t) back(fd, "/admin/calendar", { error: "Pick a date and time" });
  const location = str(fd, "location") ? loc(str(fd, "location")) : p.default_location;
  if (fd.get("allow_clash") !== "on") {
    const clash = await findClash(db, { ...t, location }, s.travel_buffer_minutes, z);
    if (clash) back(fd, "/admin/calendar", { error: `Clashes with ${clashName(clash)} at ${z.time(new Date(clash.starts_at))}. Tick "Book anyway" to book it regardless.` });
  }
  const { error } = await db.from("visits").insert({ patient_id: p.id, starts_at: t.start.toISOString(), ends_at: t.end.toISOString(), location, status: "scheduled" });
  done();
  back(fd, "/admin/calendar", error ? { error: error.message } : { ok: `Booked ${p.full_name}, ${formatDay(z.day(t.start))} ${z.time(t.start)}` });
}

const clashName = (v: Visit & { patients?: { full_name: string } | null }) => v.patients?.full_name ?? "another visit";

export async function updateVisit(fd: FormData) {
  const db = await admin();
  const s = await getSettings(db);
  const z = zone(s.time_zone);
  const { data: v } = await db.from("visits").select("*").eq("id", str(fd, "id")).single();
  if (!v || !["proposed", "scheduled"].includes(v.status)) back(fd, "/admin/calendar", { error: "Only upcoming visits can be changed" });
  const minutes = num(fd, "minutes") || Math.round((Date.parse(v.ends_at) - Date.parse(v.starts_at)) / 60_000);
  const t = visitTimes(fd, minutes, z);
  if (!t) back(fd, "/admin/calendar", { error: "Pick a date and time" });
  const location = loc(str(fd, "location"));
  if (fd.get("allow_clash") !== "on") {
    const clash = await findClash(db, { id: v.id, ...t, location }, s.travel_buffer_minutes, z);
    if (clash) back(fd, "/admin/calendar", { error: `Clashes with ${clashName(clash)} at ${z.time(new Date(clash.starts_at))}. Tick "Book anyway" to save it regardless.` });
  }
  await db.from("visits").update({ starts_at: t.start.toISOString(), ends_at: t.end.toISOString(), location }).eq("id", v.id);
  done();
  back(fd, "/admin/calendar", { ok: "Visit updated" });
}

/* approve (suggested → booked), cancel, no-show, or restore a cancelled visit */
export async function setVisitStatus(fd: FormData) {
  const db = await admin();
  const to = str(fd, "status");
  const id = str(fd, "id");
  const allowed: Record<string, string[]> = { scheduled: ["proposed", "cancelled", "no_show"], cancelled: ["proposed", "scheduled"], no_show: ["scheduled"] };
  if (!allowed[to]) back(fd, "/admin/calendar", { error: "Unknown change" });
  if (to === "cancelled") {
    /* A suggestion that's turned down is simply removed */
    await db.from("visits").delete().eq("id", id).eq("status", "proposed");
  }
  await db.from("visits").update({ status: to }).eq("id", id).in("status", allowed[to]);
  done();
  back(fd, "/admin/calendar", { ok: { scheduled: "Visit booked", cancelled: "Visit cancelled", no_show: "Marked as no-show (doesn't use a package visit)" }[to] });
}

export async function completeVisit(fd: FormData) {
  const db = await admin();
  const s = await getSettings(db);
  if (!(await ownVisit(db, str(fd, "id")))) back(fd, "/admin", { error: "Visit not found" });
  const { data, error } = await db.raw.rpc("complete_visit", { p_visit: str(fd, "id"), p_home_fee: s.home_visit_fee });
  if (error) back(fd, "/admin", { error: error.message });
  const r = data as { visit_no: number | null; total?: number; request_id: string | null };
  let msg = r.visit_no ? `Visit ${r.visit_no} of ${r.total} done` : "Visit done (the patient has no package, so it wasn't counted)";
  if (r.request_id) {
    const { data: req } = await db.from("payment_requests").select("*").eq("id", r.request_id).single();
    await queuePaymentMessage(db, req as PaymentRequest);
    msg += ". Package used up: the payment request is ready to send";
  }
  done();
  back(fd, "/admin", { ok: msg });
}

export async function reopenVisit(fd: FormData) {
  const db = await admin();
  if (!(await ownVisit(db, str(fd, "id")))) back(fd, "/admin/calendar", { error: "Visit not found" });
  const { error } = await db.raw.rpc("reopen_visit", { p_visit: str(fd, "id") });
  done();
  back(fd, "/admin/calendar", error ? { error: error.message } : { ok: "Visit set back to booked" });
}

/* ---------- Weekly planner ---------- */

export async function suggestWeek(fd: FormData) {
  const db = await admin();
  const s = await getSettings(db);
  const z = zone(s.time_zone);
  const week = mondayOf(isDay(str(fd, "week")) ? str(fd, "week") : z.day(new Date()));
  const path = `/admin/calendar?week=${week}`;
  const [{ data: avail }, { data: patients }, { data: prefs }, { data: booked }] = await Promise.all([
    db.from("availability").select("*"),
    db.from("patients").select("*").eq("active", true),
    db.from("preferences").select("*"),
    db.from("visits").select("*").in("status", ["proposed", "scheduled", "completed", "no_show"])
      .gte("starts_at", z.instant(week, 0).toISOString()).lt("starts_at", z.instant(addDays(week, 7), 0).toISOString()),
  ]);
  if (!avail?.length) back(fd, path, { error: "Add your free slots under Hours first" });
  const plist = (patients ?? []) as Patient[];
  const { proposals, shortfalls } = planWeek({
    weekStart: week,
    availability: avail.map((a) => ({ weekday: a.weekday, start: parseTime(a.start_time), end: parseTime(a.end_time) })),
    patients: plist.map((p) => ({
      id: p.id, sessionMinutes: p.session_minutes, visitsPerWeek: p.visits_per_week, defaultLocation: p.default_location,
      preferences: ((prefs ?? []) as Preference[]).filter((x) => x.patient_id === p.id)
        .map((x) => ({ weekday: x.weekday, start: parseTime(x.start_time), end: parseTime(x.end_time), location: x.location })),
    })),
    booked: ((booked ?? []) as Visit[]).map((v) => ({ patientId: v.patient_id, start: new Date(v.starts_at), end: new Date(v.ends_at), location: v.location })),
    bufferMinutes: s.travel_buffer_minutes,
    now: new Date(),
    zone: z,
  });
  if (proposals.length) {
    const { error } = await db.from("visits").insert(proposals.map((p) => ({
      patient_id: p.patientId, starts_at: p.start.toISOString(), ends_at: p.end.toISOString(), location: p.location, status: "proposed",
    })));
    if (error) back(fd, path, { error: error.message });
  }
  const names = new Map(plist.map((p) => [p.id, p.full_name]));
  const noPrefs = plist.filter((p) => p.visits_per_week > 0 && !(prefs ?? []).some((x) => x.patient_id === p.id)).map((p) => p.id);
  const short = shortfalls.map((f) => `${names.get(f.patientId)} (${f.placed} of ${f.wanted}${noPrefs.includes(f.patientId) ? ", no preferred times set" : ""})`);
  done();
  back(fd, path, {
    ok: proposals.length ? `Suggested ${proposals.length} visit${proposals.length === 1 ? "" : "s"}. Review them below, then approve.` : "No new visits to suggest",
    error: short.length ? `Couldn't fit everyone: ${short.join(", ")}` : undefined,
  });
}

export async function approveWeek(fd: FormData) {
  const db = await admin();
  const z = zone((await getSettings(db)).time_zone);
  const week = mondayOf(isDay(str(fd, "week")) ? str(fd, "week") : z.day(new Date()));
  const { data } = await db.from("visits").update({ status: "scheduled" }).eq("status", "proposed")
    .gte("starts_at", z.instant(week, 0).toISOString()).lt("starts_at", z.instant(addDays(week, 7), 0).toISOString()).select("id");
  done();
  back(fd, `/admin/calendar?week=${week}`, { ok: `Booked ${data?.length ?? 0} visits. Patients get their weekly summary on Sunday evening and a reminder the day before each visit.` });
}

export async function clearSuggestions(fd: FormData) {
  const db = await admin();
  const z = zone((await getSettings(db)).time_zone);
  const week = mondayOf(isDay(str(fd, "week")) ? str(fd, "week") : z.day(new Date()));
  await db.from("visits").delete().eq("status", "proposed")
    .gte("starts_at", z.instant(week, 0).toISOString()).lt("starts_at", z.instant(addDays(week, 7), 0).toISOString());
  done();
  back(fd, `/admin/calendar?week=${week}`, { ok: "Suggestions cleared" });
}

/* ---------- Messages ---------- */

export async function skipMessage(fd: FormData) {
  const db = await admin();
  await db.from("messages").update({ status: "skipped", error: "Skipped by the physio" }).eq("id", str(fd, "id")).in("status", ["pending", "failed"]);
  done();
  back(fd, "/admin/messages", { ok: "Message skipped" });
}

export async function retryMessage(fd: FormData) {
  const db = await admin();
  await db.from("messages").update({ status: "pending", error: null }).eq("id", str(fd, "id")).eq("status", "failed");
  done();
  back(fd, "/admin/messages", { ok: "Message will be tried again" });
}

