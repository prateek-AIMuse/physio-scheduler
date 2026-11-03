import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Photo } from "@/components/photo";
import { Pricing } from "@/components/pricing";
import { Reveal } from "@/components/reveal";
import { getViewer } from "@/lib/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { supabaseConfigured } from "@/lib/env";
import { TRIAL_DAYS } from "@/lib/plans";

/* The public home page. It describes the platform, not any one practice: practice and clinic
   names appear only after login and in the practice's own WhatsApp messages. */

/* Small line icons (24px grid, stroke = currentColor) */
const ICONS = {
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3",
  package: "M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10",
  rupee: "M7 5h10M7 9h10M7 5c5 0 7 1.5 7 4s-2 4-7 4l7 7",
  chat: "M4 5h16v11H9l-5 4zM8 10h8M8 13h5",
  home: "M3 11l9-7 9 7M6 9v11h12V9M10 20v-6h4v6",
  dumbbell: "M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  phone: "M8 3h8v18H8zM11 18h2",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6",
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

const PHYSIO_FEATURES: { icon: keyof typeof ICONS; title: string; text: string }[] = [
  { icon: "spark", title: "A week that plans itself", text: "One tap fits every patient into your free hours, around their preferred times, with travel time kept free around home visits." },
  { icon: "package", title: "Packages that count themselves", text: "Mark a visit done and the counter moves on. When a package runs out, the next one and its payment request are ready." },
  { icon: "rupee", title: "Get paid, without the awkward ask", text: "UPI requests with a QR code, or online payment through your own Razorpay or Stripe. Money goes straight to your bank." },
  { icon: "chat", title: "WhatsApp, written for you", text: "Day-before reminders, Sunday schedules, payment links and login links, written and ready to send with one tap, or fully automatic." },
  { icon: "globe", title: "Your own mini website", text: "A practice page with your profile, services, prices, clinic map and a Book button that fills your calendar, not someone else's directory." },
  { icon: "home", title: "Clinic and home visits, together", text: "Each patient's address, map link and usual place. Mix clinic and home sessions in one package, with your home-visit fee added." },
  { icon: "dumbbell", title: "Home exercise programmes", text: "Build programmes from your exercise library with sets, reps and video links. See which patients actually did them this week." },
  { icon: "calendar", title: "Self-booking on your terms", text: "Let patients book, move or cancel open slots, only as far ahead as you allow. You see every change on your Today page." },
  { icon: "shield", title: "Your patients stay yours", text: "Every practice's patients, notes and payments are kept apart. No marketplace, no lead fees, no one else marketing to them." },
];

const PATIENT_FEATURES: { icon: keyof typeof ICONS; title: string; text: string }[] = [
  { icon: "clock", title: "Sessions around your week", text: "Tell your physio the days and times that suit you; your sessions are planned around them." },
  { icon: "chat", title: "Reminders on WhatsApp", text: "Your week's schedule on Sunday, and a reminder the day before each session with the time and place." },
  { icon: "package", title: "Always know where you are", text: "See how many sessions of your package are done, what's coming up and anything due." },
  { icon: "rupee", title: "Pay in one tap", text: "GPay, PhonePe, any UPI app or card, straight from the payment link." },
];

/* What a physio gets here, compared with the usual ways of running a practice */
type Mark = "yes" | "partial" | "no";
const COMPARE: { what: string; us: Mark; software: Mark; manual: Mark }[] = [
  { what: "Plans your week from patients' preferred times", us: "yes", software: "no", manual: "no" },
  { what: "Home visits with travel time built in", us: "yes", software: "partial", manual: "no" },
  { what: "Prepaid packages with automatic counter", us: "yes", software: "partial", manual: "no" },
  { what: "WhatsApp reminders included, no extra SMS credits", us: "yes", software: "no", manual: "partial" },
  { what: "Payments straight to your bank, no commission", us: "yes", software: "partial", manual: "yes" },
  { what: "Your own practice website with online booking", us: "yes", software: "partial", manual: "no" },
  { what: "Your patients never shown other physios", us: "yes", software: "no", manual: "yes" },
  { what: "Set up in an afternoon, on your phone", us: "yes", software: "no", manual: "yes" },
  { what: "Free plan, no contract", us: "yes", software: "no", manual: "yes" },
];

const MARK = { yes: { label: "Yes", cls: "yes" }, partial: { label: "Partly", cls: "partial" }, no: { label: "No", cls: "no" } } as const;

const FAQ: { q: string; a: string }[] = [
  { q: "Do patients pay anything to use it?", a: `No. ${APP_NAME} is always free for patients. They log in with their phone number; there's nothing to download.` },
  { q: "Do you take a cut of my fees?", a: "Never. UPI payments go straight to your bank, and online payments go through your own Razorpay or Stripe account. Your subscription is the only thing you pay us." },
  { q: "What happens when the free trial ends?", a: `After ${TRIAL_DAYS} days on Professional you choose a plan. If you don't, you move to Starter: nothing is deleted, and you keep working with up to 15 active patients.` },
  { q: "Can I bring my existing patients?", a: "Yes. Add them with their name and WhatsApp number in a minute each, or on the Clinic plan we import your list for you. Each patient gets a one-tap login link on WhatsApp." },
  { q: "What is the mini website?", a: "A public page for your practice: your photo, qualifications, services and prices, clinic location and a Book button that shows your real open slots. Share it on Instagram, Google Maps or your visiting card." },
  { q: "Does it work outside India?", a: "Yes. Each practice sets its own country, time zone and currency. UPI is offered for rupee payments; elsewhere patients pay online with Stripe or by your own instructions." },
];

export default async function Home() {
  const viewer = supabaseConfigured() ? await getViewer() : null;
  if (viewer?.role === "physio") redirect(viewer.practice.status === "approved" ? "/admin" : "/pending");
  if (viewer?.owner && viewer.role === "unknown") redirect("/owner");
  if (viewer?.role === "patient") redirect("/me");

  return (
    <div className="landing">
      <Reveal />
      <header className="hero">
        <Photo name="hero" zoom />
        <nav className="hero-nav">
          <span className="brand"><Logo /><span>{APP_NAME}<small>{APP_TAGLINE}</small></span></span>
          <span className="hero-links">
            <a href="#physios" className="hide-sm">For physios</a>
            <a href="#patients" className="hide-sm">For patients</a>
            <a href="#pricing" className="hide-sm">Pricing</a>
            <Link href="/login" className="btn ghost sm">Log in</Link>
          </span>
        </nav>
        <div className="hero-inner">
          <span className="eyebrow reveal">The practice platform built by and for physiotherapists</span>
          <h1 className="reveal d1">Run your practice. <em>Not your admin.</em></h1>
          <p className="lede reveal d2">
            {APP_NAME} plans your week, counts every package, chases payments and sends WhatsApp reminders, and gives you your own practice website. Patients get sessions that fit their life. You get your evenings back.
          </p>
          <div className="cta reveal d3">
            <Link href="/signup" className="btn light lg">I&apos;m a physio · start free</Link>
            <Link href="/login" className="btn ghost lg">I&apos;m a patient · log in</Link>
          </div>
          {viewer?.role === "unknown" && (
            <p className="notice warn reveal" style={{ marginTop: 18, color: "var(--ink)" }}>
              You&apos;re signed in as {viewer.user.phone ? `+${viewer.user.phone}` : viewer.user.email}, but that isn&apos;t on a patient list. Ask your physio to add this number.{" "}
              <form action="/auth/signout" method="post" className="inline"><button className="linkbtn">Log out</button></form>
            </p>
          )}
          <div className="hero-stats reveal d3">
            <div><b>0% commission</b><span>payments go straight to you</span></div>
            <div><b>Free plan</b><span>no card, no contract</span></div>
            <div><b>Clinic + home</b><span>in one calendar</span></div>
            <div><b>Free for patients</b><span>always</span></div>
          </div>
        </div>
      </header>

      {/* Two audiences at a glance */}
      <section className="section">
        <div className="section-head reveal">
          <span className="kicker">One platform, two sides</span>
          <h2>Built for the physio. Loved by the patient.</h2>
          <p className="muted">Whichever side of the treatment table you&apos;re on, here&apos;s what you get from joining.</p>
        </div>
        <div className="audiences">
          <article className="audience physio reveal">
            <span className="audience-tag"><Icon name="user" />For physiotherapists</span>
            <h3>Less admin. More treating. Better paid.</h3>
            <ul className="ticks">
              <li>Your whole week planned in one tap</li>
              <li>Packages, payments and reminders that run themselves</li>
              <li>Your own practice website with online booking</li>
              <li>Keep 100% of your fees and 100% of your patients</li>
            </ul>
            <div className="row">
              <Link href="/signup" className="btn primary">Join as a physio</Link>
              <Link href="/login?as=physio" className="btn">Physio login</Link>
            </div>
          </article>
          <article className="audience patient reveal d1">
            <span className="audience-tag"><Icon name="clock" />For patients</span>
            <h3>Physio that fits around your life.</h3>
            <ul className="ticks">
              <li>Sessions planned around the times that suit you</li>
              <li>At the clinic or at home, mixed as you need</li>
              <li>WhatsApp reminders and your weekly schedule</li>
              <li>Track your package, exercises and payments in one place</li>
            </ul>
            <div className="row">
              <Link href="/login" className="btn primary">Patient login</Link>
            </div>
            <p className="small muted">New patient? Your physio adds your number and sends you a login link on WhatsApp.</p>
          </article>
        </div>
      </section>

      {/* Physio features */}
      <section className="section" id="physios" style={{ paddingTop: 0 }}>
        <div className="section-head reveal">
          <span className="kicker">For physiotherapists</span>
          <h2>Everything your practice runs on, in one place</h2>
          <p className="muted">Not a generic clinic system with physio bolted on. Every feature was designed around how independent physios actually work: clinic in the morning, home visits in the afternoon, packages, and patients on WhatsApp.</p>
        </div>
        <div className="features">
          {PHYSIO_FEATURES.map((f, i) => (
            <div key={f.title} className={`feature reveal d${i % 3}`}>
              <span className="feature-icon"><Icon name={f.icon} /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why switch */}
      <section className="section compare-section" style={{ paddingTop: 0 }}>
        <div className="section-head reveal">
          <span className="kicker">Why physios switch</span>
          <h2>Better than the clinic software you&apos;ve tried</h2>
          <p className="muted">Most practice software is built for hospitals and multi-speciality clinics, or for directories that sell your patients&apos; attention back to you. {APP_NAME} is built for you.</p>
        </div>
        <div className="compare reveal" role="table" aria-label={`${APP_NAME} compared with other options`}>
          <div className="compare-row compare-head" role="row">
            <span role="columnheader">What you get</span>
            <span role="columnheader" className="us">{APP_NAME}</span>
            <span role="columnheader">Typical clinic software</span>
            <span role="columnheader">Notebook + WhatsApp</span>
          </div>
          {COMPARE.map((r) => (
            <div key={r.what} className="compare-row" role="row">
              <span role="rowheader">{r.what}</span>
              {([["us", APP_NAME], ["software", "Typical clinic software"], ["manual", "Notebook + WhatsApp"]] as const).map(([k, label]) => (
                <span key={k} role="cell" className={k === "us" ? "us" : ""}>
                  <i className={`mark ${MARK[r[k]].cls}`} aria-label={`${label}: ${MARK[r[k]].label}`}>{MARK[r[k]].label}</i>
                  <small className="mobile-col">{label}</small>
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="proof">
          <div className="reveal"><b>Hours back</b><span>every week, from scheduling, reminders and payment follow-ups</span></div>
          <div className="reveal d1"><b>Fewer no-shows</b><span>with a reminder on WhatsApp the day before every session</span></div>
          <div className="reveal d2"><b>Paid faster</b><span>the payment request is ready the moment a package ends</span></div>
        </div>
      </section>

      {/* Mini website */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="split-feature">
          <div className="reveal">
            <span className="kicker">Your own mini website</span>
            <h2>A home for your practice online, that books straight into your calendar</h2>
            <p className="muted">Every physio on {APP_NAME} gets a practice page. Share the link on Instagram, Google Maps, WhatsApp or your visiting card; new patients see your real open slots and book in seconds.</p>
            <ul className="ticks">
              <li>Your photo, qualifications, registration number and specialities</li>
              <li>Services and prices: clinic sessions, home visits and packages</li>
              <li>Clinic location with a map, and the areas you cover for home visits</li>
              <li>A Book button showing only the slots you&apos;ve opened</li>
              <li>On Clinic: your own domain, logo and colours</li>
            </ul>
          </div>
          <div className="browser reveal d1" aria-hidden>
            <div className="browser-bar"><i /><i /><i /><span>movera.app/dr-priya-shah</span></div>
            <div className="browser-body">
              <div className="mini-hero">
                <span className="mini-avatar">PS</span>
                <div>
                  <b>Dr Priya Shah, PT</b>
                  <small>Sports &amp; post-surgery rehab · Andheri, Mumbai</small>
                </div>
              </div>
              <div className="mini-services">
                <div><span>Clinic session · 45 min</span><b>₹800</b></div>
                <div><span>Home visit · 60 min</span><b>₹1,200</b></div>
                <div><span>Package · 6 sessions</span><b>₹4,500</b></div>
              </div>
              <div className="mini-slots">
                <small>Open this week</small>
                <div><span>Mon 9:00</span><span>Mon 17:30</span><span className="on">Wed 11:15</span><span>Thu 8:00</span><span>Sat 10:00</span></div>
              </div>
              <span className="btn primary block sm">Book a session</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section" id="pricing" style={{ paddingTop: 0 }}>
        <div className="section-head center reveal">
          <span className="kicker">Plans for physios</span>
          <h2>Simple pricing. Free for patients, always.</h2>
          <p className="muted">Start free and upgrade when your practice grows. Every paid plan starts with a {TRIAL_DAYS}-day free trial, no card needed. No commission on your fees, ever.</p>
        </div>
        <Pricing />
        <p className="small muted center" style={{ marginTop: 16 }}>Prices in Indian rupees, plus GST. Practices outside India are billed the equivalent in their own currency.</p>
      </section>

      {/* Patients */}
      <section className="section" id="patients" style={{ paddingTop: 0 }}>
        <div className="section-head reveal">
          <span className="kicker">For patients</span>
          <h2>Less juggling, more getting better</h2>
          <p className="muted">Each session can be at your physio&apos;s clinic or at home, and you can mix both within one package.</p>
        </div>
        <div className="places">
          <article className="place reveal">
            <Photo name="clinic" />
            <div className="place-body">
              <span className="place-tag">Clinic</span>
              <h3>At the clinic</h3>
              <p>Full equipment, strength and mobility work, and sports rehab. The clinic&apos;s map link comes with every reminder.</p>
            </div>
          </article>
          <article className="place reveal d1">
            <Photo name="home" />
            <div className="place-body">
              <span className="place-tag">Home visits</span>
              <h3>Treatment at your door</h3>
              <p>For post-surgery recovery, limited mobility, or when getting to the clinic is hard.</p>
            </div>
          </article>
        </div>
        <div className="features compact" style={{ marginTop: 18 }}>
          {PATIENT_FEATURES.map((f, i) => (
            <div key={f.title} className={`feature reveal d${i % 4}`}>
              <span className="feature-icon"><Icon name={f.icon} /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Getting started */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head reveal">
          <span className="kicker">Getting started as a physio</span>
          <h2>Up and running this afternoon</h2>
        </div>
        <div className="steps">
          <div className="step reveal"><h3>Sign up</h3><p>Your name, practice, city and registration number. We verify every physio, usually within a day.</p></div>
          <div className="step reveal d1"><h3>Set your hours and fees</h3><p>Your weekly free slots, clinic location, home-visit fee and UPI ID or payment account.</p></div>
          <div className="step reveal d2"><h3>Add your patients</h3><p>Name and WhatsApp number is enough. Each gets a one-tap login link.</p></div>
          <div className="step reveal d3"><h3>Plan the week</h3><p>Tap Suggest visits, review, approve. Reminders and schedules go out from there.</p></div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head reveal">
          <span className="kicker">Questions</span>
          <h2>Before you join</h2>
        </div>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q} className="reveal">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="band reveal">
        <Photo name="rehab" />
        <div className="band-inner">
          <span className="kicker" style={{ color: "#5EEAD4", background: "none" }}>Ready when you are</span>
          <h2>Give your practice the platform it deserves</h2>
          <p>Start free in minutes. Bring your patients, open your mini website, and let {APP_NAME} handle the rest. Already a patient? Log in to see your sessions.</p>
          <div className="row">
            <Link href="/signup" className="btn light lg">Join as a physio</Link>
            <Link href="/login" className="btn ghost lg">Patient login</Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} {APP_NAME}</span>
        <span className="row" style={{ gap: 16 }}>
          <a href="#pricing">Pricing</a>
          <Link href="/signup">Join as a physio</Link>
          <Link href="/login?as=physio">Physio login</Link>
          <Link href="/login">Patient login</Link>
        </span>
      </footer>
    </div>
  );
}
