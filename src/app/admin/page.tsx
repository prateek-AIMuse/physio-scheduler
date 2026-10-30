import Link from "next/link";
import { Flash, type FlashParams } from "@/components/flash";
import { MessageItem } from "@/components/message-item";
import { VisitCard } from "@/components/visit-card";
import { rupees } from "@/lib/format";
import { refreshQueue } from "@/lib/messages";
import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";
import { addDays, formatDay, istDay, istInstant } from "@/lib/time";
import type { Message, Patient, Visit } from "@/lib/types";

export default async function Today({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const { db, practice, user } = await requireAdmin();
  const now = new Date();
  await refreshQueue(db, now);
  const today = istDay(now), tomorrow = addDays(today, 1);
  const [s, { data: patients }, { data: visits }, { data: due }, { data: pending }, { count: proposed }] = await Promise.all([
    getSettings(db),
    db.from("patients").select("*"),
    db.from("visits").select("*").neq("status", "proposed")
      .gte("starts_at", istInstant(today, 0).toISOString()).lt("starts_at", istInstant(addDays(today, 2), 0).toISOString()).order("starts_at"),
    db.from("messages").select("*").eq("status", "pending").lte("due_at", now.toISOString()).order("due_at").limit(10),
    db.from("payment_requests").select("amount").eq("status", "pending"),
    db.from("visits").select("id", { count: "exact", head: true }).eq("status", "proposed"),
  ]);
  const byId = new Map(((patients ?? []) as Patient[]).map((p) => [p.id, p]));
  const list = (visits ?? []) as Visit[];
  const todays = list.filter((v) => istDay(new Date(v.starts_at)) === today);
  const tomorrows = list.filter((v) => istDay(new Date(v.starts_at)) === tomorrow && v.status !== "cancelled");
  const owed = (pending ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const messages = (due ?? []) as Message[];
  /* First-run checklist for a new practice */
  const [{ count: slots }, { count: patientCount }] = await Promise.all([
    db.from("availability").select("id", { count: "exact", head: true }),
    db.from("patients").select("id", { count: "exact", head: true }),
  ]);
  const setup = [
    !s.physio_name || !s.clinic_name ? { label: "Add your name and clinic", action: "Settings", href: "/admin/settings" } : null,
    !s.upi_id ? { label: "Add your UPI ID so patients can pay you", action: "Settings", href: "/admin/settings" } : null,
    !slots ? { label: "Set the weekly hours you see patients", action: "Hours", href: "/admin/hours" } : null,
    !patientCount ? { label: "Add your first patient", action: "Add patient", href: "/admin/patients/new" } : null,
  ].filter((t): t is { label: string; action: string; href: string } => t !== null);

  return (
    <main className="stack">
      <div className="row between">
        <div>
          <p className="muted small">{formatDay(today, true)}</p>
          <h1>Welcome, {s.physio_name || practice.physio_name || user.email}</h1>
        </div>
        <Link href="/admin/calendar" className="btn">Calendar</Link>
      </div>
      <Flash {...flash} />

      <div className="grid2">
        <div className="card stat-card"><p className="muted small">Visits today</p><p className="stat">{todays.filter((v) => v.status !== "cancelled").length}</p></div>
        <div className="card stat-card"><p className="muted small">Payments waiting</p><p className="stat">{rupees(owed)}</p><Link href="/admin/payments" className="small">{pending?.length ?? 0} request{pending?.length === 1 ? "" : "s"}</Link></div>
      </div>

      {setup.length > 0 && (
        <section className="card">
          <h2>Get your practice ready</h2>
          <ul className="list">
            {setup.map((t) => <li key={t.label} className="row between"><span>{t.label}</span><Link className="btn sm primary" href={t.href}>{t.action}</Link></li>)}
          </ul>
        </section>
      )}

      {!!proposed && <p className="notice warn">{proposed} suggested visit{proposed === 1 ? " is" : "s are"} waiting for your approval. <Link href="/admin/calendar">Review in Calendar</Link></p>}

      {s.whatsapp_mode === "manual" && messages.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>WhatsApp messages to send</h2><Link href="/admin/messages" className="small">All messages</Link></div>
          <p className="small muted" style={{ marginBottom: 12 }}>Tap Send: WhatsApp opens with the message typed in. Press send there.</p>
          <ul className="list">{messages.map((m) => <li key={m.id}><MessageItem m={m} p={byId.get(m.patient_id)} manual back="/admin" now={now} /></li>)}</ul>
        </section>
      )}

      <section className="card">
        <h2>Today</h2>
        {todays.length ? <ul className="list">{todays.map((v) => <li key={v.id}><VisitCard v={v} p={byId.get(v.patient_id)} s={s} back="/admin" now={now} /></li>)}</ul>
          : <p className="empty">No visits today.</p>}
      </section>

      <section className="card">
        <h2>Tomorrow · {formatDay(tomorrow)}</h2>
        {tomorrows.length ? <ul className="list">{tomorrows.map((v) => <li key={v.id}><VisitCard v={v} p={byId.get(v.patient_id)} s={s} back="/admin" now={now} /></li>)}</ul>
          : <p className="empty">No visits tomorrow.</p>}
      </section>
    </main>
  );
}
