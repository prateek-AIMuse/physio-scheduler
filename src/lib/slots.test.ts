import { describe, expect, it } from "vitest";
import { openSlots } from "@/lib/slots";
import { zone } from "@/lib/time";

const z = zone("Asia/Kolkata");
const base = {
  from: "2026-11-02", days: 1, availability: [{ weekday: 1, start: 9 * 60, end: 12 * 60 }],
  sessionMinutes: 60, location: "clinic" as const, bufferMinutes: 30, noticeHours: 0, now: new Date("2026-11-01T00:00:00Z"), zone: z,
};
const times = (s: ReturnType<typeof openSlots>) => s.map((x) => z.time(x.start));

describe("openSlots", () => {
  it("offers half-hourly starts that fit inside the free slot", () => {
    expect(times(openSlots({ ...base, booked: [] }))).toEqual(["9:00 am", "9:30 am", "10:00 am", "10:30 am", "11:00 am"]);
  });
  it("skips times that clash with booked visits, keeping travel time around home visits", () => {
    const booked = [{ patientId: "x", start: z.instant("2026-11-02", 10 * 60), end: z.instant("2026-11-02", 11 * 60), location: "home" as const }];
    expect(times(openSlots({ ...base, booked }))).toEqual([]);
    expect(times(openSlots({ ...base, booked, availability: [{ weekday: 1, start: 9 * 60, end: 14 * 60 }] }))).toEqual(["11:30 am", "12:00 pm", "12:30 pm", "1:00 pm"]);
  });
  it("respects the booking notice", () => {
    expect(times(openSlots({ ...base, booked: [], noticeHours: 2, now: z.instant("2026-11-02", 8 * 60) }))).toEqual(["10:00 am", "10:30 am", "11:00 am"]);
  });
  it("lets a visit being moved free up its own time", () => {
    const own = { patientId: "me", start: z.instant("2026-11-02", 9 * 60), end: z.instant("2026-11-02", 10 * 60), location: "clinic" as const };
    expect(times(openSlots({ ...base, booked: [own], bufferMinutes: 0 }))[0]).toBe("10:00 am");
    expect(times(openSlots({ ...base, booked: [own], bufferMinutes: 0, ignorePatientVisit: { start: own.start } }))[0]).toBe("9:00 am");
  });
});
