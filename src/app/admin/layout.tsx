import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { requireAdmin } from "@/lib/auth";
import { getSettings, practiceLabel } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const db = createAdminClient();
  const [s, { count }] = await Promise.all([
    getSettings(db),
    db.from("messages").select("id", { count: "exact", head: true }).eq("status", "pending").lte("due_at", new Date().toISOString()),
  ]);
  return (
    <div className="shell">
      <header className="top">
        <div className="top-row">
          <Link href="/admin" className="brand">{practiceLabel(s)}<small>Physio scheduler</small></Link>
          <form action="/auth/signout" method="post"><button className="btn sm">Log out</button></form>
        </div>
        <AdminNav toSend={s.whatsapp_mode === "manual" ? count ?? 0 : 0} />
      </header>
      {children}
    </div>
  );
}
