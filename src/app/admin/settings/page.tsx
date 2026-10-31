import { saveSettings } from "@/app/admin/actions";
import { Flash, type FlashParams } from "@/components/flash";
import { whatsappApiConfigured } from "@/lib/env";
import { COUNTRIES, CURRENCIES, timeZones } from "@/lib/regions";
import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";

export default async function SettingsPage({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const s = await getSettings((await requireAdmin()).db);
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
