import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Photo } from "@/components/photo";
import { Reveal } from "@/components/reveal";
import { getViewer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { getPublicSettings } from "@/lib/settings";

export default async function Home() {
  const viewer = supabaseConfigured() ? await getViewer() : null;
  if (viewer?.role === "admin") redirect("/admin");
  if (viewer?.role === "patient") redirect("/me");
  const s = await getPublicSettings();
  const name = s.practice_name || s.physio_name || "Physio";
  const clinic = s.clinic_name || "the clinic";

  return (
    <div className="landing">
      <Reveal />
      <header className="hero">
        <Photo name="hero" zoom />
        <nav className="hero-nav">
          <span className="brand"><Logo />{name}<small>Physiotherapy</small></span>
          <Link href="/login" className="btn ghost sm">Log in</Link>
        </nav>
        <div className="hero-inner">
          <span className="eyebrow reveal">At {clinic} or in your home</span>
          <h1 className="reveal d1">Move better. <em>Recover stronger.</em></h1>
          <p className="lede reveal d2">
            One-to-one physiotherapy, planned around the times that suit you. See your sessions, track your package and get reminders on WhatsApp.
          </p>
          <div className="cta reveal d3">
            <Link href="/login" className="btn light lg">Patient login</Link>
            {s.clinic_maps_url && <a href={s.clinic_maps_url} target="_blank" rel="noreferrer" className="btn ghost lg">Find {clinic}</a>}
          </div>
          {viewer?.role === "unknown" && (
            <p className="notice warn reveal" style={{ marginTop: 18, color: "var(--ink)" }}>
              You&apos;re signed in as {viewer.user.phone ? `+${viewer.user.phone}` : viewer.user.email}, but that isn&apos;t on the patient list. Ask your physio to add this number.{" "}
              <form action="/auth/signout" method="post" className="inline"><button className="linkbtn">Log out</button></form>
            </p>
          )}
          <div className="hero-stats reveal d3">
            <div><b>45–60 min</b><span>one-to-one sessions</span></div>
            <div><b>2 places</b><span>clinic or home visits</span></div>
            <div><b>WhatsApp</b><span>reminders, the day before</span></div>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="section-head reveal">
          <span className="kicker">Where we see you</span>
          <h2>Wherever recovery works best for you</h2>
          <p className="muted">Each session can be at the clinic or at home, and you can mix both within one package.</p>
        </div>
        <div className="places">
          <article className="place reveal">
            <Photo name="clinic" />
            <div className="place-body">
              <span className="place-tag">Clinic</span>
              <h3>{clinic}</h3>
              <p>Full equipment, strength and mobility work, and sports rehab.</p>
              {s.clinic_maps_url && <a href={s.clinic_maps_url} target="_blank" rel="noreferrer" className="btn ghost sm" style={{ justifySelf: "start" }}>Open in Maps</a>}
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
          <span className="kicker">How it works</span>
          <h2>Less juggling, more getting better</h2>
        </div>
        <div className="steps">
          <div className="step reveal"><h3>Tell us your times</h3><p>Log in with your phone number and add the days and hours you can usually make.</p></div>
          <div className="step reveal d1"><h3>We plan your week</h3><p>Your physio fits your sessions into the week and sends you the schedule every Sunday.</p></div>
          <div className="step reveal d2"><h3>Reminders on WhatsApp</h3><p>A message the day before each session, with the time and the place.</p></div>
          <div className="step reveal d3"><h3>Pay by UPI</h3><p>When a package is complete, pay in one tap with GPay, PhonePe or any UPI app.</p></div>
        </div>
      </section>

      <section className="band reveal">
        <Photo name="rehab" />
        <div className="band-inner">
          <span className="kicker" style={{ color: "#5EEAD4", background: "none" }}>Already a patient?</span>
          <h2>Your sessions, package and payments in one place</h2>
          <p>Add this app to your home screen. It works on iPhone, Android and any computer.</p>
          <Link href="/login" className="btn light lg">Log in with your phone</Link>
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} {name}</span>
        <Link href="/login">Physio login</Link>
      </footer>
    </div>
  );
}
