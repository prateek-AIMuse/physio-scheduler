import { Flash, type FlashParams } from "@/components/flash";
import { MessageItem } from "@/components/message-item";
import { whatsappApiConfigured } from "@/lib/env";
import { refreshQueue } from "@/lib/messages";
import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";
import type { Message, Patient } from "@/lib/types";

export default async function Messages({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const { db } = await requireAdmin();
  const now = new Date();
  await refreshQueue(db, now);
  const [s, { data: patients }, { data: pending }, { data: history }] = await Promise.all([
    getSettings(db),
    db.from("patients").select("*"),
    db.from("messages").select("*").in("status", ["pending", "failed"]).order("due_at"),
    db.from("messages").select("*").in("status", ["sent", "skipped"]).order("created_at", { ascending: false }).limit(40),
  ]);
  const byId = new Map(((patients ?? []) as Patient[]).map((p) => [p.id, p]));
  const all = (pending ?? []) as Message[];
  const due = all.filter((m) => m.status === "failed" || Date.parse(m.due_at) <= now.getTime());
  const later = all.filter((m) => !due.includes(m));
  const manual = s.whatsapp_mode === "manual";
  const item = (m: Message) => <li key={m.id}><MessageItem m={m} p={byId.get(m.patient_id)} manual={manual} back="/admin/messages" now={now} /></li>;

  return (
    <main className="stack">
      <h1>WhatsApp messages</h1>
      <Flash {...flash} />
      {manual ? (
        <p className="notice">One-tap mode: tap <b>Send on WhatsApp</b>, check the message and press send in WhatsApp. Day-before reminders appear at 10 am the day before; weekly schedules on Sunday at 6 pm.</p>
      ) : (
        <p className={`notice ${whatsappApiConfigured() ? "" : "error"}`}>
          {whatsappApiConfigured() ? "Automatic mode: messages are sent through the WhatsApp Business API when they're due." : "Automatic mode is on, but the WhatsApp API keys aren't set, so nothing can be sent. Switch back to one-tap mode in Settings."}
        </p>
      )}
      <section className="card">
        <h2>To send now</h2>
        {due.length ? <ul className="list">{due.map(item)}</ul> : <p className="empty">All caught up.</p>}
      </section>
      {later.length > 0 && <section className="card"><h2>Coming up</h2><ul className="list">{later.map(item)}</ul></section>}
      <section className="card">
        <h2>Sent and skipped</h2>
        {history?.length ? <ul className="list">{(history as Message[]).map(item)}</ul> : <p className="empty">Nothing yet.</p>}
      </section>
    </main>
  );
}
