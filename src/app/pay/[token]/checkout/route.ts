import { NextResponse, type NextRequest } from "next/server";
import { createCheckout, getGateways, pickGateway } from "@/lib/gateways";
import { practiceDb } from "@/lib/practice-db";
import { getSettings, practiceLabel } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/server";

/* "Pay online": opens (or reuses) a checkout on the practice's Razorpay or Stripe account */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = new URL(`/pay/${token}`, request.url);
  if (!/^[0-9a-f]{32}$/.test(token)) return NextResponse.redirect(page, 303);
  const db = createAdminClient();
  const { data: r } = await db.from("payment_requests").select("*, patients(full_name, phone)").eq("token", token).maybeSingle();
  if (!r || r.status !== "pending") return NextResponse.redirect(page, 303);
  const s = await getSettings(practiceDb(r.practice_id));
  const g = await getGateways(r.practice_id);
  const gateway = pickGateway(g, s.currency);
  if (!g || !gateway) return NextResponse.redirect(page, 303);
  /* A checkout already made for this amount is reused, so the patient can't end up paying twice */
  if (r.gateway === gateway && r.gateway_url) return NextResponse.redirect(r.gateway_url, 303);
  try {
    const patient = r.patients as { full_name: string; phone: string };
    const c = await createCheckout(g, gateway, { ...r, amount: Number(r.amount) }, s.currency, r.description || `${practiceLabel(s)} sessions`, { name: patient.full_name, phone: patient.phone });
    await db.from("payment_requests").update({ gateway: c.gateway, gateway_ref: c.ref, gateway_url: c.url }).eq("id", r.id).eq("status", "pending");
    return NextResponse.redirect(c.url, 303);
  } catch (e) {
    page.searchParams.set("error", e instanceof Error ? e.message : "Couldn't start the payment");
    return NextResponse.redirect(page, 303);
  }
}
