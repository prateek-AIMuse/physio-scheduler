import type { Package, Visit } from "@/lib/types";

export type PackageState = Package & { used: number; left: number };

/* Each package with how many of its visits are used. The current one is the oldest with visits left,
   which is where the next completed visit will be counted. */
export function packageStates(packages: Package[], visits: Pick<Visit, "package_id">[]) {
  const states: PackageState[] = [...packages]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((p) => {
      const used = visits.filter((v) => v.package_id === p.id).length;
      return { ...p, price: Number(p.price), used, left: Math.max(0, p.total_visits - used) };
    });
  return { states, current: states.find((s) => s.left > 0) ?? null };
}
