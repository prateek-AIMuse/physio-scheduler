import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { rupees } from "@/lib/format";
import { getSettings, practiceLabel } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/server";
import { upiLink, upiQrSvg } from "@/lib/upi";
import { supabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Pay by UPI" };

/* The page a patient opens from the WhatsApp payment request. Anyone with the link can see it,
   so it shows only the first name, the amount and what it's for. */
export default async function Pay({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  if (!supabaseConfigured() || !/^[0-9a-f]{32}$/.test(token)) notFound();
  const db = createAdminClient();
  const { data: r } = await db.from("payment_requests").select("*, patients(full_name)").eq("token", token).maybeSingle();
  if (!r) notFound();
  const s = await getSettings(db);
  const amount = Number(r.amount);
  const first = (r.patients as { full_name: string } | null)?.full_name.split(" ")[0] ?? "";
  const link = upiLink({ upiId: s.upi_id, payee: s.upi_payee_name || practiceLabel(s), amount, note: r.description || `${practiceLabel(s)} sessions` });
  const qr = r.status === "pending" && s.upi_id ? await upiQrSvg(link) : "";

  return (
    <main className="auth">
      <div className="card stack" style={{ textAlign: "center" }}>
        <div>
          <p className="muted small">{practiceLabel(s)}</p>
          <h1>{first ? `Hi ${first}` : "Payment"}</h1>
        </div>
        <p className="amount">{rupees(amount)}</p>
        {r.description && <p className="muted">{r.description}</p>}
        {r.status === "paid" && <p className="notice">Paid. Thank you!</p>}
        {r.status === "cancelled" && <p className="notice warn">This request was withdrawn. Nothing to pay.</p>}
        {r.status === "pending" && s.upi_id && <>
          <a className="btn primary block" href={link}>Pay with a UPI app</a>
          <p className="small muted">Or scan with GPay, PhonePe, Paytm or your bank app:</p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="small">UPI ID: <b>{s.upi_id}</b>{s.upi_payee_name && <><br />{s.upi_payee_name}</>}</p>
          <p className="small muted">After you pay, your physio confirms it. No need to send a screenshot unless asked.</p>
        </>}
      </div>
    </main>
  );
}
