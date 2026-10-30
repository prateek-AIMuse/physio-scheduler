import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Photo } from "@/components/photo";
import { Reveal } from "@/components/reveal";
import { getViewer } from "@/lib/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { supabaseConfigured } from "@/lib/env";

/* The public home page. It describes the platform, not any one practice: practice and clinic
   names appear only after login and in the practice's own WhatsApp messages. */
export default async function Home() {
  const viewer = supabaseConfigured() ? await getViewer() : null;
  if (viewer?.role === "admin") redirect("/admin");
  if (viewer?.role === "patient") redirect("/me");

  return (
    <div className="landing">
      <Reveal />
      <header className="hero">
        <Photo name="hero" zoom />
        <nav className="hero-nav">
          <span className="brand"><Logo /><span>{APP_NAME}<small>{APP_TAGLINE}</small></span></span>
          <Link href="/login" className="btn ghost sm">Log in</Link>
        </nav>
        <div className="hero-inner">
          <span className="eyebrow reveal">Scheduling for physiotherapists and their patients</span>
          <h1 className="reveal d1">Move better. <em>Recover stronger.</em></h1>
          <p className="lede reveal d2">
            {APP_NAME} plans your physio sessions around the times that suit you, at the clinic or at home. Track your package and get reminders on WhatsApp.
          </p>
          <div className="cta reveal d3">
            <Link href="/login" className="btn light lg">Patient login</Link>
            <Link href="/login?as=physio" className="btn ghost lg">Physio login</Link>
          </div>
          {viewer?.role === "unknown" && (
            <p className="notice warn reveal" style={{ marginTop: 18, color: "var(--ink)" }}>
              You&apos;re signed in as {viewer.user.phone ? `+${viewer.user.phone}` : viewer.user.email}, but that isn&apos;t on a patient list. Ask your physio to add this number.{" "}
              <form action="/auth/signout" method="post" className="inline"><button className="linkbtn">Log out</button></form>
            </p>
          )}
          <div className="hero-stats reveal d3">
            <div><b>45–60 min</b><span>one-to-one sessions</span></div>
            <div><b>Clinic or home</b><span>mix both in one package</span></div>
            <div><b>WhatsApp</b><span>reminders, the day before</span></div>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="section-head reveal">
          <span className="kicker">Where you&apos;re seen</span>
          <h2>Wherever recovery works best for you</h2>
          <p className="muted">Each session can be at your physio&apos;s clinic or at home, and you can mix both within one package.</p>
        </div>
        <div className="places">
          <article className="place reveal">
            <Photo name="clinic" />
            <div className="place-body">
              <span className="place-tag">Clinic</span>
              <h3>At the clinic</h3>
              <p>Full equipment, strength and mobility work, and sports rehab. Your clinic&apos;s map link comes with every reminder.</p>
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
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head reveal">
          <span className="kicker">For patients</span>
          <h2>Less juggling, more getting better</h2>
        </div>
        <div className="steps">
          <div className="step reveal"><h3>Tell us your times</h3><p>Log in with your phone number and add the days and hours you can usually make.</p></div>
          <div className="step reveal d1"><h3>Your week, planned</h3><p>Your physio fits your sessions into the week, and you get the schedule every Sunday.</p></div>
          <div className="step reveal d2"><h3>Reminders on WhatsApp</h3><p>A message the day before each session, with the time and the place.</p></div>
          <div className="step reveal d3"><h3>Pay by UPI</h3><p>When a package is complete, pay in one tap with GPay, PhonePe or any UPI app.</p></div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head reveal">
          <span className="kicker">For physiotherapists</span>
          <h2>Your calendar, packages and payments, handled</h2>
          <p className="muted">Built for independent physios who treat patients at a clinic and at home.</p>
        </div>
        <div className="steps">
          <div className="step reveal"><h3>Plan the week in one tap</h3><p>Suggests visits from your free slots and each patient&apos;s preferred times, with travel time around home visits.</p></div>
          <div className="step reveal d1"><h3>Session counter</h3><p>Every completed visit moves the patient&apos;s package forward. Cancellations and no-shows don&apos;t count.</p></div>
          <div className="step reveal d2"><h3>Payment requests</h3><p>When a package is used up, a UPI payment request with a QR code is ready to send.</p></div>
          <div className="step reveal d3"><h3>WhatsApp, done for you</h3><p>Reminders and weekly schedules are written for you; send them with one tap.</p></div>
        </div>
      </section>

      <section className="band reveal">
        <Photo name="rehab" />
        <div className="band-inner">
          <span className="kicker" style={{ color: "#5EEAD4", background: "none" }}>Already using {APP_NAME}?</span>
          <h2>Your sessions, packages and payments, all in one place</h2>
          <p>Add {APP_NAME} to your home screen. It works on iPhone, Android and any computer.</p>
          <Link href="/login" className="btn light lg">Log in</Link>
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} {APP_NAME}</span>
        <Link href="/login?as=physio">Physio login</Link>
      </footer>
    </div>
  );
}
