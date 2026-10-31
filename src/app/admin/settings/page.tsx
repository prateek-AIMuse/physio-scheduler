import { saveSettings } from "@/app/admin/actions";
import { Flash, type FlashParams } from "@/components/flash";
import { env, whatsappApiConfigured } from "@/lib/env";
import { getGateways } from "@/lib/gateways";

/* Shows only the start and end of a saved key */
const mask = (k: string) => (k.length > 10 ? `${k.slice(0, 8)}…${k.slice(-4)}` : "Saved");
import { COUNTRIES, CURRENCIES, timeZones } from "@/lib/regions";
import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";

export default async function SettingsPage({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const { db, practice } = await requireAdmin();
  const [s, g] = await Promise.all([getSettings(db), getGateways(practice.id)]);
  const site = env.siteUrl || "https://<your-site>";
  return (
    <main className="stack">
      <h1>Settings</h1>
      <Flash {...flash} />
      <form action={saveSettings} className="stack">
        <section className="card stack-sm">
          <h2>Practice</h2>
          <div className="fields">
            <label>Practice name (signs messages)<input name="practice_name" defaultValue={s.practice_name} /></label>
            <label>Your name<input name="physio_name" defaultValue={s.physio_name} /></label>
            <label>Clinic name<input name="clinic_name" defaultValue={s.clinic_name} /></label>
          </div>
          <label>Clinic location link (Google Maps)<input name="clinic_maps_url" type="url" defaultValue={s.clinic_maps_url} /></label>
        </section>
        <section className="card stack-sm">
          <h2>Fees and travel</h2>
          <div className="fields">
            <label>Extra fee per home visit ({s.currency})<input name="home_visit_fee" type="number" min={0} step="any" required defaultValue={s.home_visit_fee} /></label>
            <label>Travel time around home visits (minutes)<input name="travel_buffer_minutes" type="number" min={0} max={180} step={5} required defaultValue={s.travel_buffer_minutes} /></label>
          </div>
          <p className="small muted">Package sizes and prices are set per patient, on the patient&apos;s page.</p>
        </section>
        <section className="card stack-sm">
          <h2>Region</h2>
          <div className="fields">
            <label>Time zone<select name="time_zone" defaultValue={s.time_zone}>
              {timeZones().map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
            </select></label>
            <label>Currency<select name="currency" defaultValue={s.currency}>
              {(CURRENCIES.includes(s.currency) ? CURRENCIES : [s.currency, ...CURRENCIES]).map((c) => <option key={c} value={c}>{c}</option>)}
            </select></label>
            <label>Country for phone numbers<select name="country_code" defaultValue={s.country_code}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name} (+{c.code})</option>)}
            </select></label>
          </div>
          <p className="small muted">Visits, reminders and the weekly plan use this time zone. Numbers typed without a country code get this country&apos;s.</p>
        </section>
        <section className="card stack-sm">
          <h2>Payments</h2>
          <div className="fields">
            <label>UPI ID (India, rupee payments)<input name="upi_id" defaultValue={s.upi_id} placeholder="name@okhdfcbank" /></label>
            <label>Name on the UPI account<input name="upi_payee_name" defaultValue={s.upi_payee_name} /></label>
          </div>
          <label>Payment instructions (shown when UPI doesn&apos;t apply)<textarea name="payment_instructions" rows={3} defaultValue={s.payment_instructions} placeholder="e.g. Bank transfer to: Account name, sort code / IBAN, reference: your name" /></label>
        </section>
        <section className="card stack-sm" id="online-payments">
          <h2>Online payments</h2>
          <p className="small muted">Connect your own Razorpay (India) or Stripe (worldwide) account. Patients then get a Pay online button, and payments are marked paid automatically. Leave a key blank to keep the saved one.</p>
          <div className="fields">
            <label>Razorpay key ID<input name="razorpay_key_id" autoComplete="off" placeholder={g?.razorpay_key_id ? mask(g.razorpay_key_id) : "rzp_live_…"} /></label>
            <label>Razorpay key secret<input name="razorpay_key_secret" type="password" autoComplete="off" placeholder={g?.razorpay_key_secret ? "Saved" : ""} /></label>
            <label>Razorpay webhook secret<input name="razorpay_webhook_secret" type="password" autoComplete="off" placeholder={g?.razorpay_webhook_secret ? "Saved" : ""} /></label>
          </div>
          <p className="small muted">Razorpay → Settings → Webhooks: add <code>{site}/api/payments/razorpay/{practice.id}</code> with the event <b>payment_link.paid</b> and the webhook secret above.</p>
          <div className="fields">
            <label>Stripe secret key<input name="stripe_secret_key" type="password" autoComplete="off" placeholder={g?.stripe_secret_key ? mask(g.stripe_secret_key) : "sk_live_…"} /></label>
            <label>Stripe webhook signing secret<input name="stripe_webhook_secret" type="password" autoComplete="off" placeholder={g?.stripe_webhook_secret ? "Saved" : "whsec_…"} /></label>
          </div>
          <p className="small muted">Stripe → Developers → Webhooks: add <code>{site}/api/payments/stripe/{practice.id}</code> with the events <b>checkout.session.completed</b> and <b>checkout.session.async_payment_succeeded</b>.</p>
          {(g?.razorpay_key_id || g?.stripe_secret_key) && <label className="check"><input type="checkbox" name="remove_gateways" /> Disconnect online payments (removes the saved keys)</label>}
        </section>
        <section className="card stack-sm">
          <h2>Patient self-booking</h2>
          <label className="check"><input type="checkbox" name="self_booking" defaultChecked={s.self_booking} /> Let patients book, move and cancel their own sessions</label>
          <div className="fields">
            <label>Up to how many hours before a session<input name="booking_notice_hours" type="number" min={0} max={168} required defaultValue={s.booking_notice_hours} /></label>
            <label>Show open times for the next (days)<input name="booking_window_days" type="number" min={1} max={60} required defaultValue={s.booking_window_days} /></label>
          </div>
          <p className="small muted">Patients only see times inside your free slots that don&apos;t clash with other visits (with travel time around home visits). Their bookings show on Today.</p>
        </section>
        <section className="card stack-sm">
          <h2>WhatsApp</h2>
          <label className="check"><input type="radio" name="whatsapp_mode" value="manual" defaultChecked={s.whatsapp_mode === "manual"} /> One-tap: I send each message from my own WhatsApp</label>
          <label className="check"><input type="radio" name="whatsapp_mode" value="cloud_api" defaultChecked={s.whatsapp_mode === "cloud_api"} disabled={!whatsappApiConfigured() && s.whatsapp_mode !== "cloud_api"} /> Automatic: send through the WhatsApp Business API</label>
          {!whatsappApiConfigured() && <p className="small muted">Automatic sending needs a WhatsApp Business number and approved message templates. See the README for setup.</p>}
        </section>
        <div><button className="btn primary">Save settings</button></div>
      </form>
    </main>
  );
}
