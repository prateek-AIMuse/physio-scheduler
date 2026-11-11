import "server-only";
import { practiceDb } from "@/lib/practice-db";
import { cleanServices, type PracticePage } from "@/lib/practice-page";
import { getSettings } from "@/lib/settings";
import { supabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import type { Practice } from "@/lib/types";

export const toPage = (row: Record<string, unknown>): PracticePage => ({ ...(row as unknown as PracticePage), services: cleanServices(row.services) });

/* A practice's own page row, or a blank one before the physio has set it up */
export async function getPracticePage(db: ReturnType<typeof practiceDb>): Promise<PracticePage> {
  const { data } = await db.from("practice_pages").select("*").maybeSingle();
  return data ? toPage(data) : {
    practice_id: db.practiceId, slug: null, published: false, headline: "", about: "", qualifications: "", specialities: "",
    home_areas: "", services: [], show_whatsapp: true, accept_bookings: true,
  };
}

/* The public page at /<slug>: only published pages of approved practices. Nothing about patients
   is read here; open times come from openTimes(), which returns times only. */
export async function getPublicPractice(slug: string) {
  if (!supabaseConfigured() || !/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const raw = createAdminClient();
  const { data: row } = await raw.from("practice_pages").select("*").eq("slug", slug).eq("published", true).maybeSingle();
  if (!row) return null;
  const { data: practice } = await raw.from("practices").select("*").eq("id", row.practice_id).eq("status", "approved").maybeSingle();
  if (!practice) return null;
  const db = practiceDb(row.practice_id);
  return { page: toPage(row), practice: practice as Practice, db, settings: await getSettings(db) };
}
