import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/env", () => ({ env: { siteUrl: "https://x" } }));
const { minorUnits, pickGateway, razorpaySignatureOk, stripeSignatureOk } = await import("@/lib/gateways");

const g = { razorpay_key_id: "rzp", razorpay_key_secret: "s", razorpay_webhook_secret: "w", stripe_secret_key: "sk", stripe_webhook_secret: "whsec" };

describe("gateways", () => {
  it("prefers Razorpay for rupees and Stripe for other currencies", () => {
    expect(pickGateway(g, "INR")).toBe("razorpay");
    expect(pickGateway(g, "GBP")).toBe("stripe");
    expect(pickGateway({ ...g, stripe_secret_key: "" }, "GBP")).toBe("razorpay");
    expect(pickGateway({ ...g, razorpay_key_id: "", stripe_secret_key: "" }, "INR")).toBeNull();
  });
  it("converts to the smallest currency unit", () => {
    expect(minorUnits(7500, "INR")).toBe(750000);
    expect(minorUnits(85.5, "GBP")).toBe(8550);
    expect(minorUnits(12.345, "KWD")).toBe(12350);
  });
  it("checks Razorpay signatures", async () => {
    const body = '{"event":"payment_link.paid"}';
    const sig = createHmac("sha256", "secret").update(body).digest("hex");
    expect(await razorpaySignatureOk("secret", body, sig)).toBe(true);
    expect(await razorpaySignatureOk("secret", body + " ", sig)).toBe(false);
    expect(await razorpaySignatureOk("", body, sig)).toBe(false);
  });
  it("checks Stripe signatures and rejects old events", async () => {
    const body = '{"type":"checkout.session.completed"}', t = 1_800_000_000;
    const sig = createHmac("sha256", "whsec_x").update(`${t}.${body}`).digest("hex");
    expect(await stripeSignatureOk("whsec_x", body, `t=${t},v1=${sig}`, t * 1000)).toBe(true);
    expect(await stripeSignatureOk("whsec_x", body, `t=${t},v1=${sig}`, (t + 600) * 1000)).toBe(false);
    expect(await stripeSignatureOk("whsec_x", body, `t=${t},v1=deadbeef`, t * 1000)).toBe(false);
  });
});
