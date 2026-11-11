import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requestBooking } from "@/app/[slug]/actions";
import { Logo } from "@/components/logo";
import { openTimes } from "@/lib/booking";
import { APP_NAME } from "@/lib/brand";
import { money } from "@/lib/format";
import { bookableServices, initials, tags } from "@/lib/practice-page";
import { getPublicPractice } from "@/lib/public-practice";
import type { Location } from "@/lib/scheduler";
import { formatDay, zone } from "@/lib/time";
import { waLink } from "@/lib/whatsapp";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string; where?: string; start?: string; sent?: string; error?: string }> };

const WHERE_LABEL = { clinic: "At the clinic", home: "Home visit", both: "Clinic or home" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await getPublicPractice((await params).slug);
  if (!found) return { title: "Page not found" };
  const { page, practice, settings: s } = found;
  const name = s.physio_name || practice.physio_name;
  const title = s.practice_name && s.practice_name !== name ? `${name} · ${s.practice_name}` : name;
  const description = page.headline || page.about.slice(0, 150) || `Book a physiotherapy session with ${name}${practice.city ? ` in ${practice.city}` : ""}.`;
  /* Unlike the rest of the app, a practice's page is meant to be found */
  return { title, description, robots: { index: true, follow: true }, openGraph: { title, description, type: "profile" } };
}

/* A practice's own mini website: who the physio is, what they offer, where, and open times to book */
export default async function PracticeSite({ params, searchParams }: Props) {
  const { slug } = await params;
  const q = await searchParams;
  const found = await getPublicPractice(slug);
  if (!found) notFound();
  const { page, practice, db, settings: s } = found;
  const z = zone(s.time_zone);
  const name = s.physio_name || practice.physio_name;
  const services = bookableServices(page);
  const specialities = tags(page.specialities);
  const whatsapp = page.show_whatsapp && practice.phone ? waLink(practice.phone, `Hi ${name}, I found your page on ${APP_NAME} and would like to book a session.`) : "";

  /* Booking, a step at a time through the URL, so it works without JavaScript */
  const serviceIndex = q.service !== undefined && services[Number(q.service)] ? Number(q.service) : services.length === 1 ? 0 : -1;
  const service = serviceIndex >= 0 ? services[serviceIndex] : null;
  const where: Location | null = !service ? null
    : service.where !== "both" ? service.where
    : q.where === "clinic" || q.where === "home" ? q.where : null;
  const slots = page.accept_bookings && service && where ? await openTimes(db, s, { minutes: service.minutes, location: where }) : [];
  const chosen = q.start ? slots.find((x) => x.start.toISOString() === q.start) : undefined;
  const days = [...new Set(slots.map((x) => x.day))].slice(0, 10);
  const step = (o: { service?: number; where?: string; start?: string }) => {
    const p = new URLSearchParams();
    if (o.service !== undefined) p.set("service", String(o.service));
    if (o.where) p.set("where", o.where);
    if (o.start) p.set("start", o.start);
    return `/${slug}?${p}#book`;
  };
  const sentAt = q.sent && !isNaN(Date.parse(q.sent)) ? new Date(q.sent) : null;

  return (
    <div className="site">
      <header className="site-hero">
        <div className="site-wrap">
          <div className="site-id">
            <span className="site-avatar" aria-hidden>{initials(name)}</span>
            <div>
              <h1>{name}</h1>
              {page.headline && <p className="site-headline">{page.headline}</p>}
              <p className="site-meta">
                {[s.practice_name && s.practice_name !== name ? s.practice_name : "", practice.city, practice.registration_no ? `Reg. ${practice.registration_no}` : ""].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="row site-cta">
            {page.accept_bookings && <a href="#book" className="btn light lg">Book a session</a>}
            {whatsapp && <a href={whatsapp} className="btn ghost lg" target="_blank" rel="noopener noreferrer">Message on WhatsApp</a>}
          </div>
        </div>
      </header>

      <main className="site-wrap site-main">
        {(page.about || page.qualifications || specialities.length > 0) && (
          <section className="card stack-sm">
            <h2>About</h2>
            {page.about && <p className="prose">{page.about}</p>}
            {page.qualifications && <p className="prose muted"><span className="strong">Qualifications: </span>{page.qualifications}</p>}
            {specialities.length > 0 && <div className="row">{specialities.map((t) => <span key={t} className="chip clinic">{t}</span>)}</div>}
          </section>
        )}

        <section className="card">
          <h2>Services</h2>
          <ul className="list">
            {services.map((sv) => (
              <li key={sv.name} className="row between">
                <span><span className="strong">{sv.name}</span><br /><span className="small muted">{sv.minutes} min · {WHERE_LABEL[sv.where]}</span></span>
                {sv.price !== null && <span className="site-price">{money(sv.price, s.currency)}</span>}
              </li>
            ))}
          </ul>
          {s.home_visit_fee > 0 && <p className="small muted" style={{ marginTop: 10 }}>Home visits add {money(s.home_visit_fee, s.currency)} per visit.</p>}
        </section>

        {(s.clinic_name || page.home_areas) && (
          <section className="card stack-sm">
            <h2>Where</h2>
            {s.clinic_name && (
              <div className="row between">
                <span><span className="chip clinic">Clinic</span> <span className="strong">{s.clinic_name}</span>{practice.city && <span className="muted">, {practice.city}</span>}</span>
                {s.clinic_maps_url && <a href={s.clinic_maps_url} className="btn sm" target="_blank" rel="noopener noreferrer">Directions</a>}
              </div>
            )}
            {page.home_areas && <p><span className="chip home">Home visits</span> {page.home_areas}</p>}
          </section>
        )}

        <section className="card stack" id="book">
          <div>
            <h2>Book a session</h2>
            <p className="small muted">Times shown in {z.tz.replace(/_/g, " ")} time.</p>
          </div>
          {q.error && <p className="notice error" role="alert">{q.error}</p>}
          {q.sent ? (
            <div className="notice stack-sm" role="status">
              <p className="strong">Request sent{sentAt ? `: ${formatDay(z.day(sentAt), true)} at ${z.time(sentAt)}` : ""}.</p>
              <p>{name} will confirm on WhatsApp. The time is held for you until then.</p>
            </div>
          ) : !page.accept_bookings ? (
            <p className="muted">Online booking isn&apos;t open right now.{whatsapp && <> <a href={whatsapp} target="_blank" rel="noopener noreferrer">Message {name} on WhatsApp</a> to book.</>}</p>
          ) : (
            <>
              {services.length > 1 && (
                <div className="stack-sm">
                  <p className="step-label">1. Choose a service</p>
                  <div className="row">
                    {services.map((sv, i) => (
                      <Link key={sv.name} href={step({ service: i })} scroll={false} className={`pick ${i === serviceIndex ? "on" : ""}`}>{sv.name}<small>{sv.minutes} min{sv.price !== null ? ` · ${money(sv.price, s.currency)}` : ""}</small></Link>
                    ))}
                  </div>
                </div>
              )}
              {service?.where === "both" && (
                <div className="stack-sm">
                  <p className="step-label">{services.length > 1 ? "2. " : "1. "}Where?</p>
                  <div className="row">
                    {(["clinic", "home"] as const).map((w) => (
                      <Link key={w} href={step({ service: serviceIndex, where: w })} scroll={false} className={`pick ${where === w ? "on" : ""}`}>{w === "clinic" ? `At ${s.clinic_name || "the clinic"}` : "At my home"}</Link>
                    ))}
                  </div>
                </div>
              )}
              {service && where && !chosen && (
                <div className="stack-sm">
                  <p className="step-label">Pick a time</p>
                  {days.length ? days.map((day) => (
                    <div key={day} className="slot-day">
                      <span className="small strong">{formatDay(day, true)}</span>
                      <div className="row">
                        {slots.filter((x) => x.day === day).map((x) => (
                          <Link key={x.start.toISOString()} href={step({ service: serviceIndex, where, start: x.start.toISOString() })} scroll={false} className="btn sm">{z.time(x.start)}</Link>
                        ))}
                      </div>
                    </div>
                  )) : (
                    <p className="notice warn">No open times in the next {s.booking_window_days} days.{whatsapp && <> <a href={whatsapp} target="_blank" rel="noopener noreferrer">Message {name}</a> to find a time.</>}</p>
                  )}
                </div>
              )}
              {service && where && chosen && (
                <form action={requestBooking} className="stack-sm">
                  <p className="notice">
                    <span className="strong">{service.name}</span>, {formatDay(chosen.day, true)} at {z.time(chosen.start)} ({service.minutes} min, {where === "home" ? "at your home" : `at ${s.clinic_name || "the clinic"}`}).{" "}
                    <Link href={step({ service: serviceIndex, where })} scroll={false}>Change time</Link>
                  </p>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="service" value={serviceIndex} />
                  <input type="hidden" name="where" value={where} />
                  <input type="hidden" name="start" value={chosen.start.toISOString()} />
                  <div className="fields">
                    <label>Your name<input name="full_name" required minLength={2} maxLength={80} autoComplete="name" /></label>
                    <label>WhatsApp number<input name="phone" type="tel" inputMode="tel" required autoComplete="tel" placeholder={`+${s.country_code} …`} /></label>
                  </div>
                  {where === "home" && <label>Address for the home visit<textarea name="address" required rows={2} maxLength={300} autoComplete="street-address" /></label>}
                  <label>What do you need help with? (optional)<textarea name="note" rows={2} maxLength={500} placeholder="e.g. knee pain after a fall, 3 weeks ago" /></label>
                  <label className="trap" aria-hidden>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
                  <button className="btn primary lg">Request this time</button>
                  <p className="small muted">{name} will confirm on WhatsApp. Your details go only to this practice.</p>
                </form>
              )}
              {!service && <p className="muted small">Choose a service to see open times.</p>}
            </>
          )}
        </section>
      </main>

      <footer className="site-footer site-wrap">
        <Link href="/" className="brand"><Logo /><span>{APP_NAME}<small>Practice pages for physiotherapists</small></span></Link>
        <span className="row" style={{ gap: 16 }}>
          <Link href="/login">Already a patient? Log in</Link>
          <Link href="/signup">Get your own page</Link>
        </span>
      </footer>
    </div>
  );
}
