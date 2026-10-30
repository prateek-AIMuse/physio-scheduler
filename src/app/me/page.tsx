import { addMyPreference, deleteMyPreference } from "@/app/me/actions";
import { Flash, type FlashParams } from "@/components/flash";
import { InstallPrompt } from "@/components/install-prompt";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/brand";
import { Photo } from "@/components/photo";
import { PreferenceEditor } from "@/components/preference-editor";
import { requirePatient } from "@/lib/auth";
import { rupees } from "@/lib/format";
import { payUrl } from "@/lib/messages";
import { packageStates } from "@/lib/packages";
import { getSettings, practiceLabel } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDay, formatInstantTime, istDay } from "@/lib/time";
import type { Package, PaymentRequest, Preference, Visit } from "@/lib/types";

export default async function MyPage({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const { patient } = await requirePatient();
  const db = createAdminClient();
  const [s, { data: visits }, { data: counted }, { data: packages }, { data: prefs }, { data: requests }] = await Promise.all([
    getSettings(db),
    db.from("visits").select("*").eq("patient_id", patient.id).eq("status", "scheduled").gt("starts_at", new Date().toISOString()).order("starts_at").limit(20),
    db.from("visits").select("package_id").eq("patient_id", patient.id).not("package_id", "is", null),
    db.from("packages").select("*").eq("patient_id", patient.id),
    db.from("preferences").select("*").eq("patient_id", patient.id),
    db.from("payment_requests").select("*").eq("patient_id", patient.id).eq("status", "pending").order("created_at"),
  ]);
  const { current } = packageStates((packages ?? []) as Package[], (counted ?? []) as Pick<Visit, "package_id">[]);
  const clinic = s.clinic_name || "the clinic";

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
            <h1>Hi {patient.full_name.split(" ")[0]}</h1>
            <p>{visits?.length ? `Next session: ${formatDay(istDay(new Date(visits[0].starts_at)), true)} at ${formatInstantTime(new Date(visits[0].starts_at))}${visits[0].location === "home" ? ", at home" : `, ${clinic}`}` : "Add the times that suit you below, and your physio will plan your sessions."}</p>
          </div>
        </section>
        <InstallPrompt />
        <Flash {...flash} />
        {((requests ?? []) as PaymentRequest[]).map((r) => (
          <a key={r.id} href={payUrl(r)} className="notice warn" style={{ textDecoration: "none", color: "inherit" }}>
            <b>{rupees(Number(r.amount))} due</b>{r.description && ` · ${r.description}`}. Tap to pay by UPI →
          </a>
        ))}

        <section className="card">
          <h2>Your next sessions</h2>
          {visits?.length ? (
            <ul className="list">
              {(visits as Visit[]).map((v) => {
                const start = new Date(v.starts_at);
                return (
                  <li key={v.id} className="row between">
                    <span><span className="strong">{formatDay(istDay(start), true)}</span>, {formatInstantTime(start)}</span>
                    {v.location === "home" ? <span className="chip home">At home</span>
                      : <a className={`chip clinic`} href={s.clinic_maps_url || undefined} target="_blank" rel="noreferrer">{clinic}</a>}
                  </li>
                );
              })}
            </ul>
          ) : <p className="empty">Nothing booked yet. Your physio plans the week ahead using the times below.</p>}
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
          <PreferenceEditor prefs={(prefs ?? []) as Preference[]} back="/me" add={addMyPreference} remove={deleteMyPreference} clinicName={s.clinic_name || "Clinic"} />
        </section>
      </main>
    </div>
  );
}
