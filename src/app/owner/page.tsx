import Link from "next/link";
import { setPracticeStatus } from "@/app/owner/actions";
import { Flash, type FlashParams } from "@/components/flash";
import { Logo } from "@/components/logo";
import { requireOwner } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { formatPhone } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDay } from "@/lib/time";
import type { Practice } from "@/lib/types";

export const metadata = { title: "Owner" };

/* For the platform owner (emails in ADMIN_EMAILS): approve physios who signed up, pause or restore practices */
export default async function Owner({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const viewer = await requireOwner();
  const db = createAdminClient();
  const [{ data: practices }, { data: patients }] = await Promise.all([
    db.from("practices").select("*").order("created_at", { ascending: false }),
    db.from("patients").select("practice_id").eq("active", true),
  ]);
  const list = (practices ?? []) as Practice[];
  const count = (id: string) => (patients ?? []).filter((p) => p.practice_id === id).length;
  const groups: [string, Practice[]][] = [
    ["Waiting for approval", list.filter((p) => p.status === "pending")],
    ["Approved", list.filter((p) => p.status === "approved")],
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
      <header className="top">
        <div className="top-row">
          <Link href="/owner" className="brand"><Logo /><span>{APP_NAME}<small>Owner</small></span></Link>
          <div className="row">
            {viewer.role === "physio" && <Link href="/admin" className="btn sm">My practice</Link>}
            <form action="/auth/signout" method="post"><button className="btn sm">Log out</button></form>
          </div>
        </div>
      </header>
      <main className="stack">
        <div>
          <h1>Physios on {APP_NAME}</h1>
          <p className="muted">New physios can use {APP_NAME} once you approve them. Pausing a practice blocks the physio&apos;s login and its reminders; nothing is deleted.</p>
        </div>
        <Flash {...flash} />
        {groups.map(([title, items]) => (
          <section key={title} className="card">
            <h2>{title} <span className="muted small">({items.length})</span></h2>
            {items.length ? (
              <ul className="list">
                {items.map((p) => (
                  <li key={p.id} className="row between">
                    <div className="grow">
                      <p className="strong">{p.physio_name || "Unnamed practice"}</p>
                      <p className="small muted">
                        {[p.email, p.phone && formatPhone(p.phone), p.city, p.registration_no && `Reg. ${p.registration_no}`].filter(Boolean).join(" · ")}
                      </p>
                      <p className="small muted">Signed up {formatDay(p.created_at.slice(0, 10))} · {count(p.id)} active patients</p>
                    </div>
                    <div className="row">
                      {p.status !== "approved" && btn(p, "approved", "Approve", "primary")}
                      {p.status === "approved" && p.owner_user_id !== viewer.user.id && btn(p, "suspended", "Pause", "danger")}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="empty">None.</p>}
          </section>
        ))}
      </main>
    </div>
  );
}
