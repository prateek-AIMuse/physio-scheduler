import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/* Activity figures for the platform owner's dashboard. Windows are rolling (last 30 days, next 7
   days) so they mean the same in every practice's time zone. */
export type PracticeStats = {
  activePatients: number;
  archivedPatients: number;
  completed30: number;
  cancelled30: number;
  noShows30: number;
  upcoming7: number;
  collected30: number;
  pendingAmount: number;
  pendingCount: number;
  lastActivity: string | null;
};

const DAY = 86_400_000;

export async function practiceStats(practiceIds: string[], now = new Date()): Promise<Map<string, PracticeStats>> {
  const db = createAdminClient();
  const since = new Date(now.getTime() - 30 * DAY).toISOString(), until = new Date(now.getTime() + 7 * DAY).toISOString();
  const [{ data: patients }, { data: visits }, { data: payments }] = await Promise.all([
    db.from("patients").select("practice_id, active").in("practice_id", practiceIds),
    db.from("visits").select("practice_id, status, starts_at, completed_at").in("practice_id", practiceIds).gte("starts_at", since).lt("starts_at", until),
    db.from("payment_requests").select("practice_id, status, amount, paid_at, created_at").in("practice_id", practiceIds).or(`status.eq.pending,paid_at.gte.${since}`),
  ]);
  const out = new Map<string, PracticeStats>();
  for (const id of practiceIds) {
    const pv = (visits ?? []).filter((v) => v.practice_id === id);
    const past = pv.filter((v) => Date.parse(v.starts_at) <= now.getTime());
    const pp = (payments ?? []).filter((p) => p.practice_id === id);
    const pending = pp.filter((p) => p.status === "pending");
    const times = [...pv.map((v) => v.completed_at ?? v.starts_at), ...pp.map((p) => p.paid_at ?? p.created_at)]
      .filter((t): t is string => Boolean(t) && Date.parse(t) <= now.getTime()).sort();
    out.set(id, {
      activePatients: (patients ?? []).filter((p) => p.practice_id === id && p.active).length,
      archivedPatients: (patients ?? []).filter((p) => p.practice_id === id && !p.active).length,
      completed30: past.filter((v) => v.status === "completed").length,
      cancelled30: past.filter((v) => v.status === "cancelled").length,
      noShows30: past.filter((v) => v.status === "no_show").length,
      upcoming7: pv.filter((v) => v.status === "scheduled" && Date.parse(v.starts_at) > now.getTime()).length,
      collected30: pp.filter((p) => p.status === "paid" && p.paid_at && p.paid_at >= since).reduce((s, p) => s + Number(p.amount), 0),
      pendingAmount: pending.reduce((s, p) => s + Number(p.amount), 0),
      pendingCount: pending.length,
      lastActivity: times.at(-1) ?? null,
    });
  }
  return out;
}
