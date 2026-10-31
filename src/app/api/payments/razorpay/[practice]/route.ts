import { NextResponse, type NextRequest } from "next/server";
import { getGateways, markPaid, razorpaySignatureOk } from "@/lib/gateways";

/* Razorpay webhook for one practice (event: payment_link.paid). The signature is checked with the
   webhook secret the practice saved in Settings. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ practice: string }> }) {
  const { practice } = await params;
  const body = await request.text();
  const g = /^[0-9a-f-]{36}$/.test(practice) ? await getGateways(practice) : null;
  if (!g || !(await razorpaySignatureOk(g.razorpay_webhook_secret, body, request.headers.get("x-razorpay-signature")))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const event = JSON.parse(body) as { event?: string; payload?: { payment_link?: { entity?: { reference_id?: string; notes?: { request_id?: string } } } } };
  if (event.event === "payment_link.paid") {
    const link = event.payload?.payment_link?.entity;
    const id = link?.notes?.request_id ?? link?.reference_id;
    if (id) await markPaid(practice, id, "razorpay");
  }
  return NextResponse.json({ ok: true });
}
