import { describe, expect, it } from "vitest";
import { upiLink } from "@/lib/upi";
import { normalizePhone } from "@/lib/format";

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
});
