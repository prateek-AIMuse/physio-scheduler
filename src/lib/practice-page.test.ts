import { describe, expect, it } from "vitest";
import { bookableServices, cleanServices, DEFAULT_SERVICE, initials, offers, slugError, slugify, tags } from "@/lib/practice-page";

describe("page addresses", () => {
  it("makes an address from a name", () => {
    expect(slugify("Dr. Priya Shah")).toBe("dr-priya-shah");
    expect(slugify("  Shah's Physio & Rehab!  ")).toBe("shah-s-physio-rehab");
    expect(slugify("José Núñez")).toBe("jose-nunez");
    expect(slugify("x".repeat(60))).toHaveLength(40);
  });
  it("accepts ordinary addresses", () => {
    expect(slugError("dr-priya-shah")).toBeNull();
    expect(slugError("physio24")).toBeNull();
  });
  it("refuses short, odd and reserved addresses", () => {
    expect(slugError("ab")).toMatch(/at least 3/);
    expect(slugError("Dr-Priya")).toMatch(/small letters/);
    expect(slugError("dr--priya")).toMatch(/small letters/);
    expect(slugError("-priya")).toMatch(/small letters/);
    expect(slugError("admin")).toMatch(/used by the app/);
    expect(slugError("login")).toMatch(/used by the app/);
  });
});

describe("services", () => {
  it("keeps valid rows and drops the rest", () => {
    expect(cleanServices([
      { name: " Clinic session ", minutes: "45", price: "800", where: "clinic" },
      { name: "", minutes: 60, price: 100 },
      { name: "Too short", minutes: 5 },
      { name: "Home visit", minutes: 60, price: "", where: "home" },
      { name: "Either", minutes: 30, price: -5, where: "nowhere" },
      null,
    ])).toEqual([
      { name: "Clinic session", minutes: 45, price: 800, where: "clinic" },
      { name: "Home visit", minutes: 60, price: null, where: "home" },
      { name: "Either", minutes: 30, price: null, where: "both" },
    ]);
    expect(cleanServices("nope")).toEqual([]);
  });
  it("keeps at most six", () => {
    expect(cleanServices(Array.from({ length: 9 }, (_, i) => ({ name: `S${i}`, minutes: 30 })))).toHaveLength(6);
  });
  it("offers one plain session when none are set up", () => {
    expect(bookableServices({ services: [] })).toEqual([DEFAULT_SERVICE]);
  });
  it("knows where a service is offered", () => {
    expect(offers({ name: "a", minutes: 30, price: null, where: "both" }, "home")).toBe(true);
    expect(offers({ name: "a", minutes: 30, price: null, where: "clinic" }, "home")).toBe(false);
  });
});

describe("display helpers", () => {
  it("splits tags", () => expect(tags("Sports rehab, Post-surgery ,, \n Neuro")).toEqual(["Sports rehab", "Post-surgery", "Neuro"]));
  it("makes initials without the title", () => {
    expect(initials("Dr Priya Shah")).toBe("PS");
    expect(initials("Om")).toBe("O");
    expect(initials("")).toBe("PT");
  });
});
