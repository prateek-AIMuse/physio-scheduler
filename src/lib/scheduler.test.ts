import { describe, expect, it } from "vitest";
import { planWeek, type PlannerPatient } from "@/lib/scheduler";
import { zone } from "@/lib/time";

const z = zone("Asia/Kolkata");
const MON = "2026-11-02";
const allWeek = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: 9 * 60, end: 13 * 60 }));
const before = new Date("2026-11-01T00:00:00Z");
const patient = (id: string, over: Partial<PlannerPatient> = {}): PlannerPatient => ({
  id, sessionMinutes: 60, visitsPerWeek: 1, defaultLocation: "clinic",
  preferences: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: 9 * 60, end: 13 * 60, location: null })),
  ...over,
});
const describeOut = (r: ReturnType<typeof planWeek>) =>
  r.proposals.map((p) => `${p.patientId} ${z.day(p.start)} ${z.time(p.start)} ${p.location}`);

describe("planWeek", () => {
  it("fits a session inside both the physio's slot and the patient's window", () => {
    const r = planWeek({ zone: z, weekStart: MON, availability: allWeek, bufferMinutes: 30, now: before, booked: [],
      patients: [patient("a", { sessionMinutes: 45, preferences: [{ weekday: 3, start: 12 * 60, end: 18 * 60, location: null }] })] });
    expect(describeOut(r)).toEqual(["a 2026-11-04 12:00 pm clinic"]);
    expect(r.proposals[0].end.getTime() - r.proposals[0].start.getTime()).toBe(45 * 60_000);
  });

  it("spreads a patient's visits across the week", () => {
    const r = planWeek({ zone: z, weekStart: MON, availability: allWeek, bufferMinutes: 30, now: before, booked: [],
      patients: [patient("a", { visitsPerWeek: 2 })] });
    expect(r.proposals.map((p) => z.day(p.start))).toEqual(["2026-11-02", "2026-11-05"]);
  });

  it("keeps the travel gap around home visits but not between clinic visits", () => {
    const one = [{ weekday: 1, start: 9 * 60, end: 13 * 60, location: null }];
    const r = planWeek({ zone: z, weekStart: MON, availability: allWeek, bufferMinutes: 30, now: before, booked: [],
      patients: [patient("a", { preferences: one, defaultLocation: "home" }), patient("b", { preferences: one }), patient("c", { preferences: one })] });
    const times = describeOut(r).sort();
    expect(times).toContain("a 2026-11-02 9:00 am home");
    expect(times).toContain("b 2026-11-02 10:30 am clinic");
    expect(times).toContain("c 2026-11-02 11:30 am clinic");
  });

  it("places the most constrained patient first and reports who couldn't be fitted", () => {
    const monOnly = [{ weekday: 1, start: 9 * 60, end: 10 * 60, location: null }];
    const r = planWeek({ zone: z, weekStart: MON, availability: [{ weekday: 1, start: 9 * 60, end: 10 * 60 }, { weekday: 2, start: 9 * 60, end: 10 * 60 }], bufferMinutes: 0, now: before, booked: [],
      patients: [patient("flexible", { visitsPerWeek: 2 }), patient("strict", { preferences: monOnly })] });
    expect(describeOut(r)).toEqual(["strict 2026-11-02 9:00 am clinic", "flexible 2026-11-03 9:00 am clinic"]);
    expect(r.shortfalls).toEqual([{ patientId: "flexible", wanted: 2, placed: 1 }]);
  });

  it("counts visits already booked that week and avoids them", () => {
    const booked = [{ patientId: "x", start: z.instant(MON, 9 * 60), end: z.instant(MON, 10 * 60), location: "clinic" as const },
      { patientId: "a", start: z.instant("2026-11-03", 9 * 60), end: z.instant("2026-11-03", 10 * 60), location: "clinic" as const }];
    const r = planWeek({ zone: z, weekStart: MON, availability: allWeek, bufferMinutes: 0, now: before, booked,
      patients: [patient("a", { visitsPerWeek: 2 }), patient("b")] });
    expect(describeOut(r)).toEqual(["b 2026-11-02 10:00 am clinic", "a 2026-11-06 9:00 am clinic"]);
  });

  it("never suggests a time in the past", () => {
    const r = planWeek({ zone: z, weekStart: MON, availability: allWeek, bufferMinutes: 0, now: z.instant("2026-11-04", 11 * 60), booked: [],
      patients: [patient("a")] });
    expect(describeOut(r)).toEqual(["a 2026-11-04 11:15 am clinic"]);
  });
});

describe("zone", () => {
  it("handles daylight saving: 9 am in London is 09:00 UTC in winter and 08:00 UTC in summer", () => {
    const london = zone("Europe/London");
    expect(london.instant("2026-01-15", 9 * 60).toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(london.instant("2026-07-15", 9 * 60).toISOString()).toBe("2026-07-15T08:00:00.000Z");
    expect(london.day(new Date("2026-07-15T23:30:00Z"))).toBe("2026-07-16");
    expect(london.time(new Date("2026-07-15T08:00:00Z"))).toBe("9:00 am");
  });
  it("works for zones ahead of and behind UTC", () => {
    expect(zone("Asia/Kolkata").instant("2026-11-02", 9 * 60).toISOString()).toBe("2026-11-02T03:30:00.000Z");
    expect(zone("America/New_York").instant("2026-11-02", 9 * 60).toISOString()).toBe("2026-11-02T14:00:00.000Z");
    expect(zone("Not/AZone").tz).toBe("Asia/Kolkata");
  });
  it("plans a week in the practice's own time zone", () => {
    const ny = zone("America/New_York");
    const r = planWeek({ zone: ny, weekStart: MON, availability: [{ weekday: 1, start: 9 * 60, end: 10 * 60 }], bufferMinutes: 0, now: before, booked: [],
      patients: [patient("a", { preferences: [{ weekday: 1, start: 9 * 60, end: 12 * 60, location: null }] })] });
    expect(r.proposals[0].start.toISOString()).toBe("2026-11-02T14:00:00.000Z");
  });
});
