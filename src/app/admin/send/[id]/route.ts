import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { waLink } from "@/lib/whatsapp";

/* The one-tap Send button: marks the message sent and opens WhatsApp with it typed in */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") return NextResponse.redirect(new URL("/login", request.url));
  const { id } = await params;
  const db = createAdminClient();
  const { data: m } = await db.from("messages").select("body, status, patients(phone)").eq("id", id).maybeSingle();
  if (!m) return NextResponse.redirect(new URL("/admin/messages?error=Message+not+found", request.url));
  if (m.status === "pending" || m.status === "failed") {
    await db.from("messages").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", id);
  }
  const phone = (m.patients as unknown as { phone: string }).phone;
  return NextResponse.redirect(waLink(phone, m.body));
}
