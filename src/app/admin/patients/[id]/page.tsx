import Link from "next/link";
import { notFound } from "next/navigation";
import { addPackage, addPreference, deletePackage, deletePreference, markPackagePaid, requestPackagePayment, sendLoginLink, setPatientActive } from "@/app/admin/actions";
import { Flash } from "@/components/flash";
import { PatientForm } from "@/components/patient-form";
import { PreferenceEditor } from "@/components/preference-editor";
import { formatPhone, mapsLink, money } from "@/lib/format";
import { packageStates } from "@/lib/packages";
import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";
import { formatDay, zone, type Zone } from "@/lib/time";
import { LOCATION_LABEL, STATUS_LABEL, type Package, type Patient, type PaymentRequest, type Preference, type Visit } from "@/lib/types";

export default async function PatientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, flash] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db } = await requireAdmin();
  const [s, { data: p }, { data: prefs }, { data: packages }, { data: visits }, { data: requests }, { data: counted }] = await Promise.all([
    getSettings(db),
    db.from("patients").select("*").eq("id", id).maybeSingle(),
    db.from("preferences").select("*").eq("patient_id", id),
    db.from("packages").select("*").eq("patient_id", id),
    db.from("visits").select("*").eq("patient_id", id).order("starts_at", { ascending: false }).limit(60),
    db.from("payment_requests").select("*").eq("patient_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("visits").select("package_id").eq("patient_id", id).not("package_id", "is", null),
  ]);
  if (!p) notFound();
  const z = zone(s.time_zone);
  const patient = p as Patient;
  const back = `/admin/patients/${id}`;
  const vlist = (visits ?? []) as Visit[];
  const { states, current } = packageStates((packages ?? []) as Package[], (counted ?? []) as Pick<Visit, "package_id">[]);
  const now = new Date().getTime();
  const upcoming = vlist.filter((v) => ["scheduled", "proposed"].includes(v.status) && Date.parse(v.starts_at) > now).reverse();
  const past = vlist.filter((v) => !upcoming.includes(v)).slice(0, 30);
  const map = mapsLink(patient.address, patient.maps_url);
  const clinic = s.clinic_name || "Clinic";
  const hiddenBack = <input type="hidden" name="back" value={back} />;

  return (
    <main className="stack">
      <div className="row between">
        <div>
          <h1>{patient.full_name}</h1>
          <p className="muted small">{formatPhone(patient.phone)} · {patient.session_minutes}-minute sessions · {patient.visits_per_week} a week{!patient.active && " · Archived"}</p>
        </div>
        <div className="row">
          <a className="btn wa sm" href={`https://wa.me/${patient.phone}`} target="_blank" rel="noreferrer">WhatsApp</a>
          {map && <a className="btn sm" href={map} target="_blank" rel="noreferrer">Home on map</a>}
        </div>
      </div>
      <Flash {...flash} />

      <section className="card">
        <div className="card-head">
          <h2>Package</h2>
          {current && <span className="small muted">{current.left} visit{current.left === 1 ? "" : "s"} left</span>}
        </div>
        {current ? (
          <div className="stack-sm">
            <p><span className="stat">{current.used}</span> <span className="muted">of {current.total_visits} visits used · {money(current.price, s.currency)}</span>
              {current.paid_at ? <span className="chip paid" style={{ marginLeft: 8 }}>Paid</span> : <span className="chip pending" style={{ marginLeft: 8 }}>Not paid</span>}</p>
            <div className="counter" aria-hidden>{Array.from({ length: current.total_visits }, (_, i) => <span key={i} className={i < current.used ? "used" : ""} />)}</div>
          </div>
        ) : <p className="empty">No package with visits left. Completed visits won&apos;t be counted until you add one.</p>}

        <ul className="list" style={{ marginTop: 16 }}>
          {[...states].reverse().map((k) => (
            <li key={k.id} className="row between">
              <div>
                <span className="strong">{k.total_visits} visits · {money(k.price, s.currency)}</span>
                <span className="small muted"> · {k.used} used · added {formatDay(z.day(new Date(k.created_at)))}{k.auto_from_visit && " (renewal)"}{k.notes && ` · ${k.notes}`}</span>
              </div>
              <div className="row">
                {k.paid_at ? <span className="chip paid">Paid {formatDay(z.day(new Date(k.paid_at)))}</span> : <>
                  <span className="chip pending">Not paid</span>
                  <form action={markPackagePaid} className="inline"><input type="hidden" name="id" value={k.id} />{hiddenBack}<button className="btn sm">Mark paid</button></form>
                  {!((requests ?? []) as PaymentRequest[]).some((r) => r.package_id === k.id && r.status === "pending") && k.price > 0 &&
                    <form action={requestPackagePayment} className="inline"><input type="hidden" name="id" value={k.id} />{hiddenBack}<button className="btn sm">Ask for payment</button></form>}
                </>}
                {k.used === 0 && <form action={deletePackage} className="inline"><input type="hidden" name="id" value={k.id} />{hiddenBack}<button className="btn sm danger">Delete</button></form>}
              </div>
            </li>
          ))}
        </ul>

        <details style={{ marginTop: 12 }}>
          <summary>+ Add a package</summary>
          <form action={addPackage} className="stack-sm">
            <input type="hidden" name="patient_id" value={id} />{hiddenBack}
            <div className="fields">
              <label>Visits<input type="number" name="total_visits" min={1} max={200} required defaultValue={current?.total_visits ?? 6} /></label>
              <label>Price ({s.currency})<input type="number" name="price" min={0} step="any" required defaultValue={current?.price} /></label>
              <label>Note<input name="notes" placeholder="Optional" /></label>
            </div>
            <label className="check"><input type="checkbox" name="paid" /> Already paid</label>
            <label className="check"><input type="checkbox" name="request" defaultChecked /> If not paid, send a payment request on WhatsApp</label>
            <div><button className="btn primary">Add package</button></div>
          </form>
        </details>
        <p className="small muted" style={{ marginTop: 12 }}>
          Clinic and home visits both count. Home visits add {money(s.home_visit_fee, s.currency)} each, asked for with the next payment.
          When the last visit is marked done, the next package (same size and price) is made and the payment request goes out.
        </p>
      </section>

      <section className="card">
        <h2>Preferred times</h2>
        <PreferenceEditor prefs={(prefs ?? []) as Preference[]} patientId={id} back={back} add={addPreference} remove={deletePreference} clinicName={clinic} />
      </section>

      <section className="card">
        <h2>Upcoming visits</h2>
        {upcoming.length ? <ul className="list">{upcoming.map((v) => <li key={v.id}><VisitLine v={v} clinic={clinic} z={z} currency={s.currency} /></li>)}</ul> : <p className="empty">None booked.</p>}
        <p className="small" style={{ marginTop: 8 }}><Link href="/admin/calendar">Book or change visits in Calendar</Link></p>
      </section>

      <section className="card">
        <h2>Past visits</h2>
        {past.length ? <ul className="list">{past.map((v) => <li key={v.id}><VisitLine v={v} clinic={clinic} z={z} currency={s.currency} /></li>)}</ul> : <p className="empty">None yet.</p>}
      </section>

      <section className="card stack-sm">
        <h2>Patient login</h2>
        <p className="small muted">
          {patient.full_name.split(" ")[0]} can log in with their phone number to see visits and set preferred times.
          Until text-message codes are switched on, send them a one-time login link.
        </p>
        <form action={sendLoginLink}><input type="hidden" name="patient_id" value={id} />{hiddenBack}<button className="btn">Prepare login link for WhatsApp</button></form>
      </section>

      <section className="card">
        <details>
          <summary>Edit details</summary>
          <PatientForm p={patient} clinicName={clinic} />
        </details>
      </section>

      <form action={setPatientActive}>
        <input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={String(!patient.active)} />{hiddenBack}
        <button className={`btn ${patient.active ? "danger" : ""}`}>{patient.active ? "Archive patient (cancels upcoming visits)" : "Make active again"}</button>
      </form>
    </main>
  );
}

function VisitLine({ v, clinic, z, currency }: { v: Visit; clinic: string; z: Zone; currency: string }) {
  const start = new Date(v.starts_at);
  return (
    <div className="row between">
      <span>{formatDay(z.day(start))}, {z.time(start)} <span className={`chip ${v.location}`} style={{ marginLeft: 6 }}>{v.location === "clinic" ? clinic : LOCATION_LABEL[v.location]}</span></span>
      <span className="row">
        {v.visit_no && <span className="chip">Visit {v.visit_no}</span>}
        {v.home_fee > 0 && <span className="small muted">+{money(v.home_fee, currency)}</span>}
        <span className={`chip ${v.status}`}>{STATUS_LABEL[v.status]}</span>
      </span>
    </div>
  );
}
