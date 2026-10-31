import type { PracticeDb } from "@/lib/practice-db";
import type { Settings } from "@/lib/types";

type Db = PracticeDb;

export async function getSettings(db: Db): Promise<Settings> {
  const { data, error } = await db.from("settings").select("*").maybeSingle();
  if (error || !data) throw new Error(`Settings missing for this practice: run supabase/migrations/0002_practices.sql (${error?.message})`);
  return { ...data, home_visit_fee: Number(data.home_visit_fee) } as Settings;
}

export const clinicLabel = (s: Settings) => s.clinic_name || "the clinic";
export const practiceLabel = (s: Settings) => s.practice_name || s.physio_name || "Physio";

