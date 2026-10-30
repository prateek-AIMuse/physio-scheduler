import { NextResponse, type NextRequest } from "next/server";
import { env, supabaseConfigured } from "@/lib/env";
import { refreshQueue } from "@/lib/messages";
import { createAdminClient } from "@/lib/supabase/server";

/* Called hourly by .github/workflows/reminders.yml. Queues the day-before reminders and weekly
   schedules, and in automatic mode sends whatever is due. */
export async function POST(request: NextRequest) {
  if (!env.cronSecret || request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ error: "Supabase isn't configured" }, { status: 503 });
  await refreshQueue(createAdminClient());
  return NextResponse.json({ ok: true });
}
