import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;
const withPractice = (rows: Row | Row[], practiceId: string) =>
  Array.isArray(rows) ? rows.map((r) => ({ ...r, practice_id: practiceId })) : { ...rows, practice_id: practiceId };

/* The database as one practice sees it. Every read, update and delete is limited to that practice,
   and every insert is stamped with it, so a physio can never see or change another practice's data.
   The database also refuses rows that point at another practice's patient (0002_practices.sql). */
export function practiceDb(practiceId: string) {
  const raw = createAdminClient();
  return {
    practiceId,
    /* For the few unscoped needs: login accounts (auth) and the shared visit functions (rpc) */
    raw,
    auth: raw.auth,
    from(table: string) {
      const q = raw.from(table);
      return {
        /* Typed like select("*") on the untyped client: rows come back loosely typed, as before */
        select: (columns: string = "*", options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) =>
          q.select(columns as "*", options).eq("practice_id", practiceId),
        insert: (rows: Row | Row[]) => q.insert(withPractice(rows, practiceId)),
        upsert: (rows: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) =>
          q.upsert(withPractice(rows, practiceId), options),
        update: (values: Row) => q.update(values).eq("practice_id", practiceId),
        delete: () => q.delete().eq("practice_id", practiceId),
      };
    },
  };
}

export type PracticeDb = ReturnType<typeof practiceDb>;
