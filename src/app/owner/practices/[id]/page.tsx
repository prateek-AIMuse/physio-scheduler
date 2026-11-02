import Link from "next/link";
import { notFound } from "next/navigation";
import { setPracticeStatus } from "@/app/owner/actions";
import { OwnerHeader } from "@/components/owner-header";
import { requireOwner } from "@/lib/auth";
import { formatPhone, money } from "@/lib/format";
import { practiceStats } from "@/lib/owner-stats";
import { packageStates } from "@/lib/packages";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDay, zone } from "@/lib/time";
import type { Package, Patient, Practice, Settings, Visit } from "@/lib/types";

export const metadata = { title: "Practice" };

/* Read-only view of one practice for the platform owner: the physio's details, activity and patients */
export default async function PracticeView({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireOwner();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = createAdminClient();
  const now = new Date();
  const [{ data: p }, { data: s }, { data: patients }, { data: packages }, { data: counted }, { data: upcoming }, { data: recent }] = await Promise.all([
    db.from("practices").select("*").eq("id", id).maybeSingle(),
    db.from("settings").select("*").eq("practice_id", id).maybeSingle(),
    db.from("patients").select("*").eq("practice_id", id).order("active", { ascending: false }).order("full_name"),
    db.from("packages").select("*").eq("practice_id", id),
    db.from("visits").select("patient_id, package_id").eq("practice_id", id).not("package_id", "is", null),
    db.from("visits").select("patient_id, starts_at").eq("practice_id", id).eq("status", "scheduled").gt("starts_at", now.toISOString()).order("starts_at"),
    db.from("visits").select("patient_id, starts_at").eq("practice_id", id).eq("status", "completed").order("starts_at", { ascending: false }).limit(500),
  ]);
  if (!p) notFound();
  const practice = p as Practice, settings = (s ?? {}) as Partial<Settings>;
  const z = zone(settings.time_zone);
  const cur = settings.currency ?? "INR";
  const st = (await practiceStats([id], now)).get(id)!;
  const list = (patients ?? []) as Patient[];
  const when = (iso?: string) => (iso ? `${formatDay(z.day(new Date(iso)))}, ${z.time(new Date(iso))}` : "—");

  return (
    <div className="shell">
      <OwnerHeader physio={viewer.role === "physio"} />
      <main className="stack">
        <div className="row between">
          <div>
            <Link href="/owner" className="small">← All physios</Link>
            <h1>{practice.physio_name || settings.practice_name || "Unnamed practice"}</h1>
            <p className="muted small">
              {[settings.practice_name, practice.email, practice.phone && formatPhone(practice.phone), practice.city, practice.registration_no && `Reg. ${practice.registration_no}`].filter(Boolean).join(" · ")}
            </p>
            <p className="muted small">
              {settings.clinic_name && `Clinic: ${settings.clinic_name} · `}{z.tz.replace(/_/g, " ")} · {cur} · signed up {formatDay(practice.created_at.slice(0, 10))}
            </p>
          </div>
          <div className="row">
            <span className={`chip ${practice.status === "approved" ? "completed" : practice.status === "pending" ? "pending" : "cancelled"}`}>{practice.status === "suspended" ? "Paused" : practice.status}</span>
            {practice.status !== "approved" && (
              <form action={setPracticeStatus} className="inline"><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="approved" /><input type="hidden" name="back" value={`/owner/practices/${id}`} /><button className="btn sm primary">Approve</button></form>
            )}
          </div>
        </div>

        <div className="grid2">
          <div className="card stat-card"><p className="muted small">Active patients</p><p className="stat">{st.activePatients}</p><p className="small">{st.archivedPatients} archived</p></div>
          <div className="card stat-card"><p className="muted small">Sessions, last 30 days</p><p className="stat">{st.completed30}</p><p className="small">{st.cancelled30} cancelled · {st.noShows30} no-shows</p></div>
          <div className="card stat-card"><p className="muted small">Booked, next 7 days</p><p className="stat">{st.upcoming7}</p></div>
          <div className="card stat-card"><p className="muted small">Collected, last 30 days</p><p className="stat">{money(st.collected30, cur)}</p><p className="small">{money(st.pendingAmount, cur)} waiting ({st.pendingCount})</p></div>
        </div>

        <section className="card">
          <h2>Patients <span className="muted small">({list.length})</span></h2>
          {list.length ? (
            <div>
              <table className="cards">
                <thead><tr><th>Patient</th><th>Condition</th><th>Sessions</th><th>Package</th><th>Last visit</th><th>Next visit</th></tr></thead>
                <tbody>
                  {list.map((pt) => {
                    const { current } = packageStates(((packages ?? []) as Package[]).filter((k) => k.patient_id === pt.id), (counted ?? []) as Pick<Visit, "package_id">[]);
                    const next = (upcoming ?? []).find((v) => v.patient_id === pt.id);
                    const last = (recent ?? []).find((v) => v.patient_id === pt.id);
                    return (
                      <tr key={pt.id} style={pt.active ? undefined : { opacity: 0.55 }}>
                        <td><span className="strong">{pt.full_name}</span>{!pt.active && " (archived)"}<div className="small muted">{formatPhone(pt.phone)}</div></td>
                        <td data-label="Condition">{pt.condition || <span className="muted">—</span>}</td>
                        <td data-label="Sessions" className="small">{pt.session_minutes} min · {pt.visits_per_week}/week<div className="muted">{pt.default_location === "home" ? "Home visits" : "Clinic"}</div></td>
                        <td data-label="Package" className="small">{current ? <>{current.used}/{current.total_visits} used<div>{current.paid_at ? <span className="chip paid">Paid</span> : <span className="chip pending">Unpaid</span>}</div></> : <span className="muted">None</span>}</td>
                        <td data-label="Last visit" className="small nowrap">{when(last?.starts_at)}</td>
                        <td data-label="Next visit" className="small nowrap">{when(next?.starts_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="empty">No patients yet.</p>}
          <p className="small muted" style={{ marginTop: 10 }}>Read-only. Treatment notes, messages and payments stay with the physio.</p>
        </section>
      </main>
    </div>
  );
}
