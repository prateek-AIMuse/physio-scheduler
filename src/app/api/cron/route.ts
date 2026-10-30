import { NextResponse, type NextRequest } from "next/server";
import { env, supabaseConfigured } from "@/lib/env";
import { refreshQueue } from "@/lib/messages";
import { createAdminClient } from "@/lib/supabase/server";
import { practiceDb } from "@/lib/practice-db";

/* Called hourly by .github/workflows/reminders.yml. For every approved practice, queues the day-before reminders and weekly
   schedules, and in automatic mode sends whatever is due. */
export async function POST(request: NextRequest) {
  if (!env.cronSecret || request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ error: "Supabase isn't configured" }, { status: 503 });
  const { data: practices } = await createAdminClient().from("practices").select("id").eq("status", "approved");
  const failed: string[] = [];
  for (const p of practices ?? []) {
    /* One practice's problem (say, missing settings) shouldn't stop the others' reminders */
    try { await refreshQueue(practiceDb(p.id)); } catch { failed.push(p.id); }
  }
  return NextResponse.json({ ok: failed.length === 0, practices: practices?.length ?? 0, failed });
}
