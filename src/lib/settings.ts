import { createAdminClient } from "@/lib/supabase/server";
import type { Settings } from "@/lib/types";

type Db = ReturnType<typeof createAdminClient>;

export async function getSettings(db: Db): Promise<Settings> {
  const { data, error } = await db.from("settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error(`Settings missing: run supabase/migrations/0001_schema.sql (${error?.message})`);
  return { ...data, home_visit_fee: Number(data.home_visit_fee) } as Settings;
}

export const clinicLabel = (s: Settings) => s.clinic_name || "the clinic";
export const practiceLabel = (s: Settings) => s.practice_name || s.physio_name || "Physio";
