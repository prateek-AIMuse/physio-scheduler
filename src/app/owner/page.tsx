import Link from "next/link";
import { setPracticeStatus } from "@/app/owner/actions";
import { Flash, type FlashParams } from "@/components/flash";
import { OwnerHeader } from "@/components/owner-header";
import { requireOwner } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { formatPhone, money } from "@/lib/format";
import { practiceStats } from "@/lib/owner-stats";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDay } from "@/lib/time";
import type { Practice, Settings } from "@/lib/types";

export const metadata = { title: "Owner" };

/* For the platform owner (emails in ADMIN_EMAILS): every physio on Movera with their activity,
   approvals for new sign-ups, and pausing or restoring practices */
export default async function Owner({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const viewer = await requireOwner();
  const db = createAdminClient();
  const [{ data: practices }, { data: settings }] = await Promise.all([
    db.from("practices").select("*").order("created_at", { ascending: false }),
    db.from("settings").select("practice_id, practice_name, clinic_name, currency"),
  ]);
  const list = (practices ?? []) as Practice[];
  const settingsOf = (id: string) => (settings ?? []).find((s) => s.practice_id === id) as Pick<Settings, "practice_name" | "clinic_name" | "currency"> | undefined;
  const stats = await practiceStats(list.map((p) => p.id));
  const approved = list.filter((p) => p.status === "approved");
  const total = (f: (s: NonNullable<ReturnType<typeof stats.get>>) => number) => approved.reduce((n, p) => n + f(stats.get(p.id)!), 0);
  /* Money is summed per currency, since practices can charge in different ones */
  const collected = new Map<string, number>(), pending = new Map<string, number>();
  for (const p of approved) {
    const cur = settingsOf(p.id)?.currency ?? "INR", st = stats.get(p.id)!;
    collected.set(cur, (collected.get(cur) ?? 0) + st.collected30);
    pending.set(cur, (pending.get(cur) ?? 0) + st.pendingAmount);
  }
  const moneyList = (m: Map<string, number>) => [...m].filter(([, v]) => v > 0).map(([c, v]) => money(v, c)).join(" + ") || money(0, "INR");

  const groups: [string, Practice[]][] = [
    ["Waiting for approval", list.filter((p) => p.status === "pending")],
    ["Approved physios", approved],
    ["Paused", list.filter((p) => p.status === "suspended")],
  ];
  const btn = (p: Practice, status: string, label: string, cls = "") => (
    <form action={setPracticeStatus} className="inline">
      <input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={status} />
      <button className={`btn sm ${cls}`}>{label}</button>
    </form>
  );

  return (
    <div className="shell">
      <OwnerHeader physio={viewer.role === "physio"} />
      <main className="stack">
        <div>
          <h1>Physios on {APP_NAME}</h1>
          <p className="muted">Every practice on the platform and how it&apos;s doing. Figures cover the last 30 days and the next 7.</p>
        </div>
        <Flash {...flash} />

        <div className="grid2">
          <div className="card stat-card"><p className="muted small">Approved physios</p><p className="stat">{approved.length}</p><p className="small">{groups[0][1].length} waiting for approval</p></div>
          <div className="card stat-card"><p className="muted small">Active patients</p><p className="stat">{total((s) => s.activePatients)}</p><p className="small">{total((s) => s.upcoming7)} sessions booked in the next 7 days</p></div>
          <div className="card stat-card"><p className="muted small">Sessions done, last 30 days</p><p className="stat">{total((s) => s.completed30)}</p><p className="small">{total((s) => s.cancelled30)} cancelled · {total((s) => s.noShows30)} no-shows</p></div>
          <div className="card stat-card"><p className="muted small">Collected, last 30 days</p><p className="stat" style={{ fontSize: "1.4rem" }}>{moneyList(collected)}</p><p className="small">{moneyList(pending)} waiting</p></div>
        </div>

        {groups.map(([title, items]) => (
          <section key={title} className="card">
            <h2>{title} <span className="muted small">({items.length})</span></h2>
            {items.length ? (
              <ul className="list">
                {items.map((p) => {
                  const st = stats.get(p.id)!, s = settingsOf(p.id), cur = s?.currency ?? "INR";
                  return (
                    <li key={p.id} className="stack-sm">
                      <div className="row between">
                        <div className="grow">
                          <Link href={`/owner/practices/${p.id}`} className="strong">{p.physio_name || s?.practice_name || "Unnamed practice"}</Link>
                          {s?.practice_name && s.practice_name !== p.physio_name && <span className="small muted"> · {s.practice_name}</span>}
                          <p className="small muted">{[p.email, p.phone && formatPhone(p.phone), p.city, p.registration_no && `Reg. ${p.registration_no}`].filter(Boolean).join(" · ")}</p>
                        </div>
                        <div className="row">
                          <Link href={`/owner/practices/${p.id}`} className="btn sm">View</Link>
                          {p.status !== "approved" && btn(p, "approved", "Approve", "primary")}
                          {p.status === "approved" && p.owner_user_id !== viewer.user.id && btn(p, "suspended", "Pause", "danger")}
                        </div>
                      </div>
                      <div className="row small">
                        <span className="chip scheduled">{st.activePatients} patients</span>
                        <span className="chip completed">{st.completed30} sessions / 30 days</span>
                        <span className="chip">{st.upcoming7} booked next 7 days</span>
                        <span className="chip clinic">{money(st.collected30, cur)} collected</span>
                        {st.pendingCount > 0 && <span className="chip pending">{money(st.pendingAmount, cur)} waiting</span>}
                        <span className="muted">Signed up {formatDay(p.created_at.slice(0, 10))}{st.lastActivity && ` · last active ${formatDay(st.lastActivity.slice(0, 10))}`}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="empty">None.</p>}
          </section>
        ))}
      </main>
    </div>
  );
}
