import type { PracticeDb } from "@/lib/practice-db";
import { env } from "@/lib/env";
import { formatPhone, money } from "@/lib/format";
import { clinicLabel, getSettings, practiceLabel } from "@/lib/settings";
import { addDays, formatDay, mondayOf, zone } from "@/lib/time";
import { sendTemplate } from "@/lib/whatsapp";
import type { Message, MessageKind, Patient, PaymentRequest, Settings, Visit } from "@/lib/types";

type Db = PracticeDb;

/* Day-before reminders become due at 10 am the day before; the weekly summary at 6 pm on Sunday */
const REMINDER_HOUR = 10;
const SUMMARY_HOUR = 18;

const firstName = (p: Pick<Patient, "full_name">) => p.full_name.trim().split(/\s+/)[0] || p.full_name;

function place(v: Pick<Visit, "location">, s: Settings, p: Patient, withLink: boolean) {
  if (v.location === "home") return "at your home";
  const link = withLink && s.clinic_maps_url ? ` (${s.clinic_maps_url})` : "";
  return `at ${clinicLabel(s)}${link}`;
}

const when = (v: Pick<Visit, "starts_at">, s: Settings) => {
  const z = zone(s.time_zone);
  return `${formatDay(z.day(new Date(v.starts_at)), true)} at ${z.time(new Date(v.starts_at))}`;
};
const sign = (s: Settings) => `– ${practiceLabel(s)}`;

export function dayReminderText(v: Visit, p: Patient, s: Settings) {
  const minutes = Math.round((Date.parse(v.ends_at) - Date.parse(v.starts_at)) / 60_000);
  return {
    body: `Hi ${firstName(p)}, a reminder of your physio session tomorrow, ${when(v, s)} (${minutes} min), ${place(v, s, p, true)}.\nReply here if you need to change it.\n${sign(s)}`,
    params: [firstName(p), when(v, s), place(v, s, p, false)],
  };
}

export function weeklySummaryText(visits: Visit[], p: Patient, s: Settings, weekStart: string) {
  const z = zone(s.time_zone);
  const lines = visits.map((v) => `${formatDay(z.day(new Date(v.starts_at)))}, ${z.time(new Date(v.starts_at))} – ${v.location === "home" ? "Home visit" : clinicLabel(s)}`);
  const clinic = visits.some((v) => v.location === "clinic") && s.clinic_maps_url ? `\n${clinicLabel(s)}: ${s.clinic_maps_url}` : "";
  return {
    body: `Hi ${firstName(p)}, your physio sessions for the week of ${formatDay(weekStart)}:\n${lines.map((l) => `• ${l}`).join("\n")}${clinic}\nReply here if any of these don't work for you.\n${sign(s)}`,
    params: [firstName(p), formatDay(weekStart), lines.join(" | ")],
  };
}

/* UPI only works for rupee payments to an Indian UPI ID */
export const usesUpi = (s: Pick<Settings, "currency" | "upi_id">) => s.currency === "INR" && Boolean(s.upi_id);

export const payUrl = (r: Pick<PaymentRequest, "token">) => `${env.siteUrl}/pay/${r.token}`;

export function paymentText(r: PaymentRequest, p: Patient, s: Settings) {
  const why = r.description ? ` (${r.description})` : "";
  const amount = money(r.amount, s.currency);
  /* UPI in India; elsewhere the payment page shows the practice's own instructions */
  const how = usesUpi(s)
    ? `Pay by UPI here: ${payUrl(r)}\nor send it to UPI ID ${s.upi_id}${s.upi_payee_name ? ` (${s.upi_payee_name})` : ""}.`
    : `Payment details: ${payUrl(r)}`;
  return {
    body: `Hi ${firstName(p)}, thank you for completing your sessions! The amount due is ${amount}${why}.\n${how}\n${sign(s)}`,
    params: [firstName(p), amount, payUrl(r)],
  };
}

export function loginText(p: Patient, s: Settings, link: string) {
  return {
    body: `Hi ${firstName(p)}, here is your link to see your physio sessions and choose the times that suit you:\n${link}\nThe link works once, within 24 hours. Afterwards you can log in with your phone number.\n${sign(s)}`,
    params: [firstName(p), link],
  };
}

export async function queueMessage(db: Db, m: { patient_id: string; kind: MessageKind; body: string; params: string[]; visit_id?: string; dedupe_key?: string; due_at?: Date }) {
  const row = {
    patient_id: m.patient_id, kind: m.kind, body: m.body, template_params: m.params, visit_id: m.visit_id ?? null,
    dedupe_key: m.dedupe_key ?? null, due_at: (m.due_at ?? new Date()).toISOString(),
  };
  const { error } = m.dedupe_key
    ? await db.from("messages").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
    : await db.from("messages").insert(row);
  if (error) throw new Error(error.message);
}

/* Brings the queue up to date: adds day-before reminders and weekly summaries that are due, rewrites
   pending ones if a visit moved, and drops ones that no longer apply. Safe to run any number of times. */
export async function refreshQueue(db: Db, now = new Date()) {
  const s = await getSettings(db);
  const z = zone(s.time_zone);
  const today = z.day(now);
  const tomorrow = addDays(today, 1);
  const { data: patientRows } = await db.from("patients").select("*");
  const patients = new Map((patientRows as Patient[] ?? []).map((p) => [p.id, p]));

  /* Day-before reminders for every booked visit tomorrow */
  const { data: tomorrowVisits } = await db.from("visits").select("*").eq("status", "scheduled")
    .gte("starts_at", z.instant(tomorrow, 0).toISOString()).lt("starts_at", z.instant(addDays(tomorrow, 1), 0).toISOString());
  for (const v of (tomorrowVisits as Visit[]) ?? []) {
    const p = patients.get(v.patient_id);
    if (!p?.active) continue;
    const t = dayReminderText(v, p, s);
    await queueMessage(db, { patient_id: p.id, kind: "day_reminder", visit_id: v.id, dedupe_key: `day:${v.id}:${v.starts_at}`, body: t.body, params: t.params, due_at: z.instant(today, REMINDER_HOUR * 60) });
  }

  /* From Sunday 6 pm, a summary of next week's visits for each patient who has any */
  const nextMonday = addDays(mondayOf(today), 7);
  if (now >= z.instant(addDays(nextMonday, -1), SUMMARY_HOUR * 60)) {
    const { data: weekVisits } = await db.from("visits").select("*").eq("status", "scheduled")
      .gte("starts_at", z.instant(nextMonday, 0).toISOString()).lt("starts_at", z.instant(addDays(nextMonday, 7), 0).toISOString()).order("starts_at");
    const byPatient = Map.groupBy((weekVisits as Visit[]) ?? [], (v) => v.patient_id);
    for (const [pid, list] of byPatient) {
      const p = patients.get(pid);
      if (!p?.active) continue;
      const t = weeklySummaryText(list, p, s, nextMonday);
      await queueMessage(db, { patient_id: pid, kind: "weekly_summary", dedupe_key: `week:${pid}:${nextMonday}`, body: t.body, params: t.params, due_at: z.instant(addDays(nextMonday, -1), SUMMARY_HOUR * 60) });
    }
  }

  /* Keep pending messages true to the current calendar */
  const { data: pending } = await db.from("messages").select("*").eq("status", "pending");
  for (const m of (pending as Message[]) ?? []) {
    const p = patients.get(m.patient_id);
    let update: Partial<Message> | null = null;
    if (!p?.active) update = { status: "skipped", error: "Patient is inactive" };
    else if (m.kind === "day_reminder" && m.visit_id) {
      const { data: v } = await db.from("visits").select("*").eq("id", m.visit_id).maybeSingle();
      const visit = v as Visit | null;
      if (!visit || visit.status !== "scheduled" || m.dedupe_key !== `day:${visit.id}:${visit.starts_at}` || Date.parse(visit.starts_at) <= now.getTime())
        update = { status: "skipped", error: "The visit was moved, cancelled or has passed" };
    } else if (m.kind === "weekly_summary" && m.dedupe_key) {
      const weekStart = m.dedupe_key.split(":")[2];
      if (weekStart < mondayOf(today)) update = { status: "skipped", error: "That week has passed" };
      else {
        const { data: vs } = await db.from("visits").select("*").eq("patient_id", m.patient_id).eq("status", "scheduled")
          .gte("starts_at", z.instant(weekStart, 0).toISOString()).lt("starts_at", z.instant(addDays(weekStart, 7), 0).toISOString()).order("starts_at");
        if (!vs?.length) update = { status: "skipped", error: "No visits that week" };
        else {
          const t = weeklySummaryText(vs as Visit[], p, s, weekStart);
          if (t.body !== m.body) update = { body: t.body, template_params: t.params };
        }
      }
    } else if (m.kind === "payment_request" && m.dedupe_key) {
      const { data: r } = await db.from("payment_requests").select("*").eq("id", m.dedupe_key.split(":")[1]).maybeSingle();
      if (!r || r.status !== "pending") update = { status: "skipped", error: "The payment was already settled or withdrawn" };
      else {
        const t = paymentText({ ...(r as PaymentRequest), amount: Number(r.amount) }, p, s);
        if (t.body !== m.body) update = { body: t.body, template_params: t.params };
      }
    }
    if (update) await db.from("messages").update(update).eq("id", m.id);
  }

  if (s.whatsapp_mode === "cloud_api") await sendDue(db, patients, now);
}

/* Cloud API mode: sends every due message through WhatsApp */
async function sendDue(db: Db, patients: Map<string, Patient>, now: Date) {
  const { data: due } = await db.from("messages").select("*").eq("status", "pending").lte("due_at", now.toISOString()).order("due_at").limit(50);
  for (const m of (due as Message[]) ?? []) {
    const p = patients.get(m.patient_id);
    if (!p) continue;
    const result = await sendTemplate(p.phone, m.kind, m.template_params);
    await db.from("messages").update(result.ok
      ? { status: "sent", sent_at: new Date().toISOString(), error: null }
      : { status: "failed", error: result.error }).eq("id", m.id);
  }
}

export const recipientLabel = (p: Patient) => `${p.full_name} · ${formatPhone(p.phone)}`;
