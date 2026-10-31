import Link from "next/link";
import { Flash, type FlashParams } from "@/components/flash";
import { formatPhone } from "@/lib/format";
import { packageStates } from "@/lib/packages";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDay, zone } from "@/lib/time";
import type { Package, Patient, Visit } from "@/lib/types";

export default async function Patients({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const { db } = await requireAdmin();
  const [{ data: patients }, { data: packages }, { data: counted }, { data: upcoming }, { data: prefs }] = await Promise.all([
    db.from("patients").select("*").order("active", { ascending: false }).order("full_name"),
    db.from("packages").select("*"),
    db.from("visits").select("patient_id, package_id").not("package_id", "is", null),
    db.from("visits").select("patient_id, starts_at").eq("status", "scheduled").gt("starts_at", new Date().toISOString()).order("starts_at"),
    db.from("preferences").select("patient_id"),
  ]);
  const list = (patients ?? []) as Patient[];
  const z = zone((await getSettings(db)).time_zone);
  return (
    <main className="stack">
      <div className="row between"><h1>Patients</h1><Link className="btn primary" href="/admin/patients/new">Add patient</Link></div>
      <Flash {...flash} />
      <section className="card">
        {list.length ? (
          <ul className="list">
            {list.map((p) => {
              const { current } = packageStates(((packages ?? []) as Package[]).filter((k) => k.patient_id === p.id), (counted ?? []) as Visit[]);
              const next = (upcoming ?? []).find((v) => v.patient_id === p.id);
              const hasPrefs = (prefs ?? []).some((x) => x.patient_id === p.id);
              return (
                <li key={p.id} className="row between">
                  <div className="grow">
                    <Link href={`/admin/patients/${p.id}`} className="strong">{p.full_name}</Link>
                    {!p.active && <span className="chip" style={{ marginLeft: 8 }}>Archived</span>}
                    <p className="small muted">
                      {formatPhone(p.phone)} · {p.session_minutes} min · {p.visits_per_week}/week · {p.default_location === "home" ? "Home" : "Clinic"}
                      {!hasPrefs && p.active && " · no preferred times"}
                    </p>
                  </div>
                  <div className="small" style={{ textAlign: "right" }}>
                    {current ? <p>{current.used} of {current.total_visits} used{!current.paid_at && <span className="chip pending" style={{ marginLeft: 6 }}>Unpaid</span>}</p>
                      : <p className="muted">No package</p>}
                    {next && <p className="muted">Next {formatDay(z.day(new Date(next.starts_at)))} {z.time(new Date(next.starts_at))}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="empty">No patients yet. <Link href="/admin/patients/new">Add the first one</Link>.</p>}
      </section>
    </main>
  );
}
