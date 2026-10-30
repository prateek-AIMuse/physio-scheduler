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

/* For public pages: falls back to defaults if the database isn't reachable yet */
export async function getPublicSettings(): Promise<Pick<Settings, "practice_name" | "physio_name" | "clinic_name" | "clinic_maps_url">> {
  const fallback = { practice_name: "", physio_name: "", clinic_name: "Dominate Performance", clinic_maps_url: "https://share.google/nQacWV52Jb7u5K6CU" };
  try {
    return { ...fallback, ...(await getSettings(createAdminClient())) };
  } catch {
    return fallback;
  }
}
