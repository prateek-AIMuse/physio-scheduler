import QRCode from "qrcode";
import Link from "next/link";
import { savePracticePage } from "@/app/admin/website/actions";
import { Flash, type FlashParams } from "@/components/flash";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { MAX_SERVICES, slugify } from "@/lib/practice-page";
import { getPracticePage } from "@/lib/public-practice";
import { getSettings } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";

export const metadata = { title: "Website" };

/* The physio sets up their practice's public page here */
export default async function Website({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const { db, practice } = await requireAdmin("/admin/website");
  const [s, page, { count: hours }] = await Promise.all([
    getSettings(db), getPracticePage(db), db.from("availability").select("id", { count: "exact", head: true }),
  ]);
  const name = s.physio_name || practice.physio_name;
  const site = env.siteUrl || "";
  const host = site.replace(/^https?:\/\//, "") || "your-site";
  const url = page.slug ? `${site}/${page.slug}` : "";
  const qr = page.slug && page.published && site ? await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : "";
  const rows = [...page.services, ...Array.from({ length: MAX_SERVICES - page.services.length }, () => null)];

  return (
    <main className="stack">
      <div>
        <h1>Website</h1>
        <p className="muted">Your practice&apos;s own page: who you are, what you offer, and open times new patients can ask for.</p>
      </div>
      <Flash {...flash} />

      {page.slug && page.published && (
        <section className="card share">
          <div className="stack-sm grow">
            <h2>Your page is live</h2>
            <p><a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer" className="strong">{host}/{page.slug}</a></p>
            <p className="small muted">Put this link in your Instagram bio, Google Business profile and WhatsApp status. The QR code works on a visiting card or a poster at the clinic.</p>
            <div className="row">
              <a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer" className="btn sm primary">View page</a>
              <a href={waLink("", `Book a physio session with ${name}: ${url}`)} target="_blank" rel="noopener noreferrer" className="btn sm wa">Share on WhatsApp</a>
            </div>
          </div>
          {qr && <div className="qr sm" role="img" aria-label="QR code for your page" dangerouslySetInnerHTML={{ __html: qr }} />}
        </section>
      )}
      {page.slug && !page.published && <p className="notice warn">Your page is saved but not published yet. <Link href="#publish">Tick Publish</Link> when you&apos;re ready.</p>}
      {!hours && <p className="notice warn">You haven&apos;t set your weekly hours, so your page has no open times to offer. <Link href="/admin/hours">Set hours</Link></p>}

      <form action={savePracticePage} className="stack">
        <section className="card stack-sm">
          <h2>Page address</h2>
          <label>Your page will be at
            <span className="prefixed"><span>{host}/</span><input name="slug" required minLength={3} maxLength={40} defaultValue={page.slug ?? slugify(name)} autoCapitalize="none" spellCheck={false} /></span>
          </label>
          <p className="small muted">Small letters, numbers and hyphens. Printed links break if you change this later, so pick one to keep.</p>
        </section>

        <section className="card stack-sm">
          <h2>About you</h2>
          <label>One line about your practice<input name="headline" maxLength={120} defaultValue={page.headline} placeholder="e.g. Sports and post-surgery rehab, at the clinic or at your home" /></label>
          <label>About<textarea name="about" rows={5} maxLength={2000} defaultValue={page.about} placeholder="Your experience, how you work and who you help." /></label>
          <label>Qualifications<input name="qualifications" maxLength={300} defaultValue={page.qualifications} placeholder="e.g. BPT, MPT (Orthopaedics), 8 years' experience" /></label>
          <label>Specialities (separate with commas)<input name="specialities" maxLength={300} defaultValue={page.specialities} placeholder="e.g. Sports injuries, Knee replacement rehab, Back pain" /></label>
          <label>Areas you cover for home visits<input name="home_areas" maxLength={300} defaultValue={page.home_areas} placeholder="e.g. Andheri, Bandra, Juhu" /></label>
          <p className="small muted">Your name, practice name, clinic and map link come from <Link href="/admin/settings">Settings</Link>. Your city{practice.registration_no ? " and registration number" : ""} come from your sign-up.</p>
        </section>

        <section className="card stack-sm">
          <h2>Services and prices</h2>
          <p className="small muted">Up to {MAX_SERVICES}. Leave a row&apos;s name blank to remove it, and the price blank to hide it. With no services, visitors can book one 60-minute session.</p>
          <div className="service-rows">
            {rows.map((sv, i) => (
              <div key={i} className="service-row">
                <label>Service<input name={`service_name_${i}`} maxLength={60} defaultValue={sv?.name ?? ""} placeholder={i === 0 ? "e.g. Clinic session" : ""} /></label>
                <label>Minutes<input name={`service_minutes_${i}`} type="number" min={15} max={180} step={5} defaultValue={sv?.minutes ?? 60} /></label>
                <label>Price ({s.currency})<input name={`service_price_${i}`} type="number" min={0} step="any" defaultValue={sv?.price ?? ""} /></label>
                <label>Where<select name={`service_where_${i}`} defaultValue={sv?.where ?? "both"}>
                  <option value="both">Clinic or home</option><option value="clinic">Clinic only</option><option value="home">Home only</option>
                </select></label>
              </div>
            ))}
          </div>
        </section>

        <section className="card stack-sm" id="publish">
          <h2>Booking and publishing</h2>
          <label className="check"><input type="checkbox" name="accept_bookings" defaultChecked={page.accept_bookings} /> Let new patients ask for an open time</label>
          <p className="small muted">They see only times inside your <Link href="/admin/hours">hours</Link> that are free, at least {s.booking_notice_hours} hours ahead, for the next {s.booking_window_days} days (change these under Settings → Patient self-booking). Nothing is booked until you accept the request on Today.</p>
          <label className="check"><input type="checkbox" name="show_whatsapp" defaultChecked={page.show_whatsapp} /> Show a Message on WhatsApp button (to +{practice.phone || "your number"})</label>
          <label className="check"><input type="checkbox" name="published" defaultChecked={page.published} /> Publish: anyone with the link can see my page</label>
        </section>
        <div><button className="btn primary">Save website</button></div>
      </form>
    </main>
  );
}
