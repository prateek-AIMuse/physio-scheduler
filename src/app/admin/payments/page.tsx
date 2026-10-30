import Link from "next/link";
import { cancelPayment, markPaymentPaid, newPaymentRequest, updatePaymentAmount } from "@/app/admin/actions";
import { Flash, type FlashParams } from "@/components/flash";
import { rupees } from "@/lib/format";
import { payUrl } from "@/lib/messages";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDay, istDay } from "@/lib/time";
import type { Patient, PaymentRequest } from "@/lib/types";

export default async function Payments({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const db = createAdminClient();
  const [{ data: patients }, { data: requests }] = await Promise.all([
    db.from("patients").select("*").order("full_name"),
    db.from("payment_requests").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const byId = new Map(((patients ?? []) as Patient[]).map((p) => [p.id, p]));
  const list = ((requests ?? []) as PaymentRequest[]).map((r) => ({ ...r, amount: Number(r.amount) }));
  const pending = list.filter((r) => r.status === "pending");
  const settled = list.filter((r) => r.status !== "pending");
  const day = (iso: string) => formatDay(istDay(new Date(iso)));

  return (
    <main className="stack">
      <h1>Payments</h1>
      <Flash {...flash} />
      <section className="card">
        <div className="card-head"><h2>Waiting for payment</h2><span className="strong">{rupees(pending.reduce((s, r) => s + r.amount, 0))}</span></div>
        <p className="small muted" style={{ marginBottom: 12 }}>Patients pay by UPI to your UPI ID. Check your bank app, then mark the request paid here.</p>
        {pending.length ? (
          <ul className="list">
            {pending.map((r) => (
              <li key={r.id} className="stack-sm">
                <div className="row between">
                  <div><Link href={`/admin/patients/${r.patient_id}`} className="strong">{byId.get(r.patient_id)?.full_name}</Link> <span className="small muted">· {day(r.created_at)}{r.description && ` · ${r.description}`}</span></div>
                  <span className="strong">{rupees(r.amount)}</span>
                </div>
                <div className="row">
                  <form action={markPaymentPaid} className="inline"><input type="hidden" name="id" value={r.id} /><button className="btn sm primary">Mark paid</button></form>
                  <a className="btn sm" href={payUrl(r)} target="_blank" rel="noreferrer">Payment page</a>
                  <form action={cancelPayment} className="inline"><input type="hidden" name="id" value={r.id} /><button className="btn sm danger">Withdraw</button></form>
                </div>
                <details>
                  <summary>Change amount</summary>
                  <form action={updatePaymentAmount} className="fields">
                    <input type="hidden" name="id" value={r.id} />
                    <label>Amount (₹)<input type="number" name="amount" min={1} step="any" required defaultValue={r.amount} /></label>
                    <label>What it&apos;s for<input name="description" defaultValue={r.description} /></label>
                    <button className="btn primary">Save and re-send</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="empty">Nothing outstanding.</p>}
      </section>

      <section className="card">
        <h2>Ask for a payment</h2>
        <form action={newPaymentRequest} className="fields">
          <label>Patient<select name="patient_id" required defaultValue=""><option value="" disabled>Choose…</option>
            {((patients ?? []) as Patient[]).filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
          <label>Amount (₹)<input type="number" name="amount" min={1} step="any" required /></label>
          <label>What it&apos;s for<input name="description" placeholder="e.g. Assessment" /></label>
          <button className="btn primary">Create request</button>
        </form>
        <p className="small muted" style={{ marginTop: 8 }}>For a new package, add it on the patient&apos;s page instead, so the visits are counted.</p>
      </section>

      <section className="card">
        <h2>History</h2>
        {settled.length ? (
          <table>
            <thead><tr><th>Patient</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{settled.map((r) => (
              <tr key={r.id}>
                <td>{byId.get(r.patient_id)?.full_name}<div className="small muted">{r.description}</div></td>
                <td className="nowrap">{rupees(r.amount)}</td>
                <td><span className={`chip ${r.status}`}>{r.status === "paid" ? `Paid ${r.paid_at ? day(r.paid_at) : ""}` : "Withdrawn"}</span></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="empty">No payments yet.</p>}
      </section>
    </main>
  );
}
