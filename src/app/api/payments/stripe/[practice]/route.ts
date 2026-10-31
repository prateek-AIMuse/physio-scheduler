import { NextResponse, type NextRequest } from "next/server";
import { getGateways, markPaid, stripeSignatureOk } from "@/lib/gateways";

/* Stripe webhook for one practice (events: checkout.session.completed and
   checkout.session.async_payment_succeeded). The signature is checked with the practice's signing secret. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ practice: string }> }) {
  const { practice } = await params;
  const body = await request.text();
  const g = /^[0-9a-f-]{36}$/.test(practice) ? await getGateways(practice) : null;
  if (!g || !(await stripeSignatureOk(g.stripe_webhook_secret, body, request.headers.get("stripe-signature")))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const event = JSON.parse(body) as { type?: string; data?: { object?: { payment_status?: string; metadata?: { request_id?: string }; client_reference_id?: string } } };
  const session = event.data?.object;
  const paid = event.type === "checkout.session.async_payment_succeeded" || (event.type === "checkout.session.completed" && session?.payment_status === "paid");
  const id = session?.metadata?.request_id ?? session?.client_reference_id;
  if (paid && id) await markPaid(practice, id, "stripe");
  return NextResponse.json({ ok: true });
}
