import { describe, expect, it } from "vitest";
import { upiLink } from "@/lib/upi";
import { money, normalizePhone } from "@/lib/format";

describe("upiLink", () => {
  it("builds an NPCI link with the amount and note", () => {
    expect(upiLink({ upiId: "omchavanl10-2@okhdfcbank", payee: "Om Physio", amount: 3500, note: "Next package: 6 visits" }))
      .toBe("upi://pay?pa=omchavanl10-2@okhdfcbank&pn=Om%20Physio&am=3500.00&cu=INR&tn=Next%20package%3A%206%20visits");
  });
});

describe("normalizePhone", () => {
  it("accepts Indian numbers in the usual ways", () => {
    for (const s of ["98200 11111", "+91 98200 11111", "098200 11111", "0091-9820011111", "919820011111"]) expect(normalizePhone(s)).toBe("919820011111");
  });
  it("rejects nonsense", () => expect(normalizePhone("12345")).toBeNull());
  it("uses the practice's country for local numbers", () => {
    expect(normalizePhone("07700 900123", "44")).toBe("447700900123");
    expect(normalizePhone("050 123 4567", "971")).toBe("971501234567");
    expect(normalizePhone("+1 415 555 0123", "91")).toBe("14155550123");
    expect(normalizePhone("44 7700 900123", "44")).toBe("447700900123");
  });
});

describe("money", () => {
  it("formats in the practice's currency", () => {
    expect(money(7500, "INR")).toBe("₹7,500");
    expect(money(120, "USD")).toBe("$120");
    expect(money(85.5, "GBP")).toBe("£85.50");
    expect(money(300, "AED")).toMatch(/AED\s?300/);
  });
});
