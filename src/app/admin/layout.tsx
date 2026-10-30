import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/brand";
import { requireAdmin } from "@/lib/auth";
import { getSettings, practiceLabel } from "@/lib/settings";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { db, owner } = await requireAdmin();
  const [s, { count }] = await Promise.all([
    getSettings(db),
    db.from("messages").select("id", { count: "exact", head: true }).eq("status", "pending").lte("due_at", new Date().toISOString()),
  ]);
  return (
    <div className="shell">
      <header className="top">
        <div className="top-row">
          <Link href="/admin" className="brand"><Logo /><span>{APP_NAME}<small>{practiceLabel(s)} · Physio</small></span></Link>
          <div className="row">
            {owner && <Link href="/owner" className="btn sm">Owner</Link>}
            <form action="/auth/signout" method="post"><button className="btn sm">Log out</button></form>
          </div>
        </div>
        <AdminNav toSend={s.whatsapp_mode === "manual" ? count ?? 0 : 0} />
      </header>
      {children}
    </div>
  );
}
