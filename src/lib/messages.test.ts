import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/env", () => ({ env: { siteUrl: "https://physio.example" }, whatsappApiConfigured: () => false }));

const { dayReminderText, paymentText, weeklySummaryText } = await import("@/lib/messages");
import type { Patient, PaymentRequest, Settings, Visit } from "@/lib/types";

const s: Settings = {
  practice_name: "Om Physio", physio_name: "", clinic_name: "Dominate Performance", clinic_maps_url: "https://share.google/nQacWV52Jb7u5K6CU",
  upi_id: "omchavanl10-2@okhdfcbank", upi_payee_name: "", home_visit_fee: 300, travel_buffer_minutes: 30, whatsapp_mode: "manual",
};
const p = { id: "p", full_name: "Asha Rao", phone: "919820011111" } as Patient;
const v = (start: string, location: "clinic" | "home") =>
  ({ id: "v", patient_id: "p", starts_at: start, ends_at: new Date(Date.parse(start) + 45 * 60_000).toISOString(), location, status: "scheduled" }) as Visit;

describe("WhatsApp wording", () => {
  it("day-before reminder", () => {
    const t = dayReminderText(v("2026-11-03T02:00:00Z", "clinic"), p, s);
    expect(t.body).toBe("Hi Asha, a reminder of your physio session tomorrow, Tuesday, 3 Nov at 7:30 am (45 min), at Dominate Performance (https://share.google/nQacWV52Jb7u5K6CU).\nReply here if you need to change it.\n– Om Physio");
    expect(t.params).toEqual(["Asha", "Tuesday, 3 Nov at 7:30 am", "at Dominate Performance"]);
  });
  it("weekly schedule", () => {
    const t = weeklySummaryText([v("2026-11-03T02:00:00Z", "clinic"), v("2026-11-06T12:00:00Z", "home")], p, s, "2026-11-02");
    expect(t.body).toContain("• Tue, 3 Nov, 7:30 am – Dominate Performance\n• Fri, 6 Nov, 5:30 pm – Home visit");
  });
  it("payment request", () => {
    const r = { token: "ab", amount: 7500, description: "Next package: 6 visits + Home-visit fees: ₹300.00" } as PaymentRequest;
    expect(paymentText(r, p, s).body).toContain("The amount due is ₹7,500 (Next package: 6 visits + Home-visit fees: ₹300.00).\nPay by UPI here: https://physio.example/pay/ab\nor send it to UPI ID omchavanl10-2@okhdfcbank.");
  });
});
