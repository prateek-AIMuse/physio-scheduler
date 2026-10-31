import { AdminHeader } from "@/components/admin-header";
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
      <AdminHeader practice={practiceLabel(s)} owner={owner} toSend={s.whatsapp_mode === "manual" ? count ?? 0 : 0} />
      {children}
    </div>
  );
}
