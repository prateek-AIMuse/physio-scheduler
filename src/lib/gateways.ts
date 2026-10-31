import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { PaymentRequest } from "@/lib/types";

/* Online payments through the practice's own Razorpay or Stripe account. Creating a checkout happens
   when the patient taps Pay online; the gateway's webhook (signature checked) marks the request paid. */

export type Gateways = {
  razorpay_key_id: string; razorpay_key_secret: string; razorpay_webhook_secret: string;
  stripe_secret_key: string; stripe_webhook_secret: string;
};
export type GatewayName = "razorpay" | "stripe";

export async function getGateways(practiceId: string): Promise<Gateways | null> {
  const { data } = await createAdminClient().from("payment_gateways").select("*").eq("practice_id", practiceId).maybeSingle();
  return (data as Gateways | null) ?? null;
}

/* Razorpay for rupees (and any currency it supports), Stripe for everything else */
export function pickGateway(g: Gateways | null, currency: string): GatewayName | null {
  if (!g) return null;
  const razorpay = Boolean(g.razorpay_key_id && g.razorpay_key_secret);
  const stripe = Boolean(g.stripe_secret_key);
  if (currency === "INR") return razorpay ? "razorpay" : stripe ? "stripe" : null;
  return stripe ? "stripe" : razorpay ? "razorpay" : null;
}

/* Amount in the currency's smallest unit (paise, cents; three decimals for KWD, BHD, OMR) */
export function minorUnits(amount: number, currency: string) {
  let digits = 2;
  try { digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2; } catch {}
  const minor = Math.round(Number(amount) * 10 ** digits);
  /* Stripe takes three-decimal currencies only in multiples of 10 */
  return digits === 3 ? Math.round(minor / 10) * 10 : minor;
}

type Checkout = { gateway: GatewayName; ref: string; url: string };

export async function createCheckout(g: Gateways, gateway: GatewayName, r: PaymentRequest, currency: string, description: string, patient: { name: string; phone: string }): Promise<Checkout> {
  const returnUrl = `${env.siteUrl}/pay/${r.token}?done=1`;
  if (gateway === "razorpay") {
    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${g.razorpay_key_id}:${g.razorpay_key_secret}`)}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: minorUnits(r.amount, currency), currency, description: description.slice(0, 2048),
        reference_id: r.id, customer: { name: patient.name, contact: `+${patient.phone}` },
        notify: { sms: false, email: false }, callback_url: returnUrl, callback_method: "get",
        notes: { request_id: r.id },
      }),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; short_url?: string; error?: { description?: string } } | null;
    if (!res.ok || !body?.id || !body.short_url) throw new Error(body?.error?.description ?? `Razorpay returned ${res.status}`);
    return { gateway, ref: body.id, url: body.short_url };
  }
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(minorUnits(r.amount, currency)),
    "line_items[0][price_data][product_data][name]": description.slice(0, 250) || "Physiotherapy",
    success_url: returnUrl, cancel_url: `${env.siteUrl}/pay/${r.token}`,
    client_reference_id: r.id, "metadata[request_id]": r.id, "payment_intent_data[metadata][request_id]": r.id,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${g.stripe_secret_key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const body = (await res.json().catch(() => null)) as { id?: string; url?: string; error?: { message?: string } } | null;
  if (!res.ok || !body?.id || !body.url) throw new Error(body?.error?.message ?? `Stripe returned ${res.status}`);
  return { gateway, ref: body.id, url: body.url };
}

/* ---------- Webhook signatures ---------- */

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function razorpaySignatureOk(secret: string, body: string, signature: string | null) {
  return Boolean(secret && signature) && sameHex(await hmacHex(secret, body), signature!);
}

/* Stripe-Signature: t=timestamp,v1=signature; signed payload is "t.body"; rejects events older than 5 minutes */
export async function stripeSignatureOk(secret: string, body: string, header: string | null, now = Date.now()) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const expected = await hmacHex(secret, `${t}.${body}`);
  return header.split(",").some((kv) => kv.startsWith("v1=") && sameHex(kv.slice(3), expected));
}

/* Marks a request (and the package it buys) paid. Safe to call twice. */
export async function markPaid(practiceId: string, requestId: string, via: GatewayName) {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data: r } = await db.from("payment_requests").update({ status: "paid", paid_at: now, paid_via: via })
    .eq("id", requestId).eq("practice_id", practiceId).eq("status", "pending").select().maybeSingle();
  if (r?.package_id) await db.from("packages").update({ paid_at: now }).eq("id", r.package_id).is("paid_at", null);
  return Boolean(r);
}
