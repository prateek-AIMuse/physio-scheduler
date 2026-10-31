import Link from "next/link";
import { addMyPreference, cancelSession, deleteMyPreference } from "@/app/me/actions";
import { changeable } from "@/lib/booking";
import { Flash } from "@/components/flash";
import { InstallPrompt } from "@/components/install-prompt";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/brand";
import { Photo } from "@/components/photo";
import { PreferenceEditor } from "@/components/preference-editor";
import { requirePatient } from "@/lib/auth";
import { money } from "@/lib/format";
import { payUrl } from "@/lib/messages";
import { packageStates } from "@/lib/packages";
import { getSettings, practiceLabel } from "@/lib/settings";
import { formatDay, zone } from "@/lib/time";
import type { Package, PaymentRequest, Preference, Visit } from "@/lib/types";

export default async function MyPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; practice?: string }> }) {
  const { practice, ...flash } = await searchParams;
  const { patient, others, db } = await requirePatient(practice);
  const [s, { data: visits }, { data: counted }, { data: packages }, { data: prefs }, { data: requests }] = await Promise.all([
    getSettings(db),
    db.from("visits").select("*").eq("patient_id", patient.id).eq("status", "scheduled").gt("starts_at", new Date().toISOString()).order("starts_at").limit(20),
    db.from("visits").select("package_id").eq("patient_id", patient.id).not("package_id", "is", null),
    db.from("packages").select("*").eq("patient_id", patient.id),
    db.from("preferences").select("*").eq("patient_id", patient.id),
    db.from("payment_requests").select("*").eq("patient_id", patient.id).eq("status", "pending").order("created_at"),
  ]);
  /* Names of the patient's other physios, for the switcher */
  const { data: otherNames } = others.length
    ? await db.raw.from("settings").select("practice_id, practice_name, physio_name").in("practice_id", others.map((o) => o.practice_id))
    : { data: [] };
  const nameOf = (practiceId: string) => {
    const n = (otherNames ?? []).find((x) => x.practice_id === practiceId);
    return n?.practice_name || n?.physio_name || "Another physio";
  };
  const { current } = packageStates((packages ?? []) as Package[], (counted ?? []) as Pick<Visit, "package_id">[]);
  const clinic = s.clinic_name || "the clinic";
  const z = zone(s.time_zone);
  const now = new Date();

  return (
    <div className="shell">
      <header className="top">
        <div className="top-row">
          <span className="brand"><Logo /><span>{APP_NAME}<small>{practiceLabel(s)}</small></span></span>
          <form action="/auth/signout" method="post"><button className="btn sm">Log out</button></form>
        </div>
      </header>
      <main className="stack">
        <section className="banner">
          <Photo name="hero" />
          <div className="banner-body">
            <p className="small" style={{ opacity: 0.8 }}>{practiceLabel(s)}</p>
            <h1>Welcome, {patient.full_name}</h1>
            <p>{visits?.length ? `Next session: ${formatDay(z.day(new Date(visits[0].starts_at)), true)} at ${z.time(new Date(visits[0].starts_at))}${visits[0].location === "home" ? ", at home" : `, ${clinic}`}` : "Add the times that suit you below, and your physio will plan your sessions."}</p>
          </div>
        </section>
        {others.length > 0 && (
          <nav className="row" aria-label="Your physios">
            <span className="small muted">Your physios:</span>
            <span className="chip scheduled">{practiceLabel(s)}</span>
            {others.map((o) => <a key={o.id} className="chip" href={`/me?practice=${o.practice_id}`}>{nameOf(o.practice_id)}</a>)}
          </nav>
        )}
        <InstallPrompt />
        <Flash {...flash} />
        {((requests ?? []) as PaymentRequest[]).map((r) => (
          <a key={r.id} href={payUrl(r)} className="notice warn" style={{ textDecoration: "none", color: "inherit" }}>
            <b>{money(Number(r.amount), s.currency)} due</b>{r.description && ` · ${r.description}`}. Tap to pay →
          </a>
        ))}

        <section className="card">
          <div className="card-head">
            <h2 style={{ margin: 0 }}>Your next sessions</h2>
            {s.self_booking && <Link className="btn primary sm" href={`/me/book?practice=${patient.practice_id}`}>Book a session</Link>}
          </div>
          {visits?.length ? (
            <ul className="list">
              {(visits as Visit[]).map((v) => {
                const start = new Date(v.starts_at);
                const canChange = changeable(v, s, now);
                return (
                  <li key={v.id} className="stack-sm">
                    <div className="row between">
                      <span><span className="strong">{formatDay(z.day(start), true)}</span>, {z.time(start)}</span>
                      {v.location === "home" ? <span className="chip home">At home</span>
                        : <a className={`chip clinic`} href={s.clinic_maps_url || undefined} target="_blank" rel="noreferrer">{clinic}</a>}
                    </div>
                    {canChange && (
                      <div className="row">
                        <Link className="btn sm" href={`/me/book?practice=${patient.practice_id}&visit=${v.id}`}>Move</Link>
                        <form action={cancelSession} className="inline">
                          <input type="hidden" name="practice" value={patient.practice_id} />
                          <input type="hidden" name="visit" value={v.id} />
                          <input type="hidden" name="back" value={`/me?practice=${patient.practice_id}`} />
                          <button className="btn sm danger">Cancel</button>
                        </form>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <p className="empty">{s.self_booking ? "Nothing booked yet. Book a session, or add the times that suit you below." : "Nothing booked yet. Your physio plans the week ahead using the times below."}</p>}
          {s.self_booking && <p className="small muted" style={{ marginTop: 10 }}>You can move or cancel a session up to {s.booking_notice_hours} hours before it starts.</p>}
        </section>

        <section className="card">
          <h2>Your package</h2>
          {current ? (
            <div className="stack-sm">
              <p><span className="stat">{current.used}</span> <span className="muted">of {current.total_visits} sessions done · {current.left} left</span></p>
              <div className="counter" aria-hidden>{Array.from({ length: current.total_visits }, (_, i) => <span key={i} className={i < current.used ? "used" : ""} />)}</div>
            </div>
          ) : <p className="empty">No active package.</p>}
          <p className="small muted" style={{ marginTop: 8 }}>Only sessions that take place count. Cancelled or missed ones don&apos;t.</p>
        </section>

        <section className="card">
          <h2>Times that suit you</h2>
          <p className="small muted" style={{ marginBottom: 12 }}>
            Add the days and times you can usually make. Your physio books your {patient.session_minutes}-minute sessions inside these.
          </p>
          <PreferenceEditor prefs={(prefs ?? []) as Preference[]} practiceId={patient.practice_id} back={`/me?practice=${patient.practice_id}`} add={addMyPreference} remove={deleteMyPreference} clinicName={s.clinic_name || "Clinic"} />
        </section>
      </main>
    </div>
  );
}
